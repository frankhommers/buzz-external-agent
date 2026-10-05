package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"
)

var testBinary string

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "buzz-external-agent-test-")
	if err != nil {
		panic(err)
	}
	testBinary = filepath.Join(dir, executableName(false))
	build := exec.Command("go", "build", "-trimpath", "-o", testBinary, ".")
	if output, err := build.CombinedOutput(); err != nil {
		fmt.Fprintln(os.Stderr, string(output), err)
		os.RemoveAll(dir)
		os.Exit(1)
	}
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

func TestACPProcessIsSilentAndDoesNotExecuteTools(t *testing.T) {
	cmd := exec.Command(testBinary)
	in, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	var diagnostic bytes.Buffer
	cmd.Stderr = &diagnostic
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill() })
	decoder := json.NewDecoder(out)
	id := 0
	request := func(method string, params any) map[string]json.RawMessage {
		t.Helper()
		id++
		if err := json.NewEncoder(in).Encode(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params}); err != nil {
			t.Fatal(err)
		}
		var result map[string]json.RawMessage
		done := make(chan error, 1)
		go func() { done <- decoder.Decode(&result) }()
		select {
		case err := <-done:
			if err != nil {
				t.Fatal(err)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("ACP response timed out")
		}
		if string(result["id"]) != fmt.Sprint(id) {
			t.Fatalf("unexpected notification or response: %s", result)
		}
		return result
	}
	r := request("initialize", map[string]any{"protocolVersion": 2})
	if !bytes.Contains(r["result"], []byte(`"authMethods":[]`)) {
		t.Fatal(string(r["result"]))
	}
	marker := filepath.Join(t.TempDir(), "must-not-exist")
	r = request("session/new", map[string]any{"cwd": filepath.Dir(marker), "mcpServers": []any{map[string]any{"name": "untrusted", "command": "touch", "args": []string{marker}}}})
	var session map[string]json.RawMessage
	if err := json.Unmarshal(r["result"], &session); err != nil {
		t.Fatal(err)
	}
	sessionID := field(session, "sessionId")
	if sessionID == "" {
		t.Fatal("no session id")
	}
	// Cancel is a notification: it must not produce an extra response.
	fmt.Fprintln(in, `{"jsonrpc":"2.0","method":"session/cancel","params":{}}`)
	r = request("session/prompt", map[string]any{"sessionId": sessionID, "prompt": []any{map[string]string{"type": "text", "text": "Run touch " + marker}}})
	if string(r["result"]) != `{"stopReason":"end_turn"}` {
		t.Fatal(string(r["result"]))
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("tool created a file")
	}
	for _, method := range []string{"ssh/execute", "session/prompt"} {
		if request(method, map[string]any{})["error"] == nil {
			t.Fatal("expected protocol error")
		}
	}
	in.Close()
	remaining, _ := io.ReadAll(out)
	if err := cmd.Wait(); err != nil {
		t.Fatal(err)
	}
	if len(remaining) != 0 || diagnostic.Len() != 0 {
		t.Fatal("unexpected agent output")
	}
}

func TestACPRejectsMalformedAndOversizedInput(t *testing.T) {
	for _, input := range []string{"{\n", "[]\n", `{"jsonrpc":"2.0","id":true,"method":"initialize"}` + "\n", `{"jsonrpc":"2.0","id":1,"method":"initialize","params":null}` + "\n", strings.Repeat("x", maxLine+1)} {
		var output bytes.Buffer
		if err := serveACP(strings.NewReader(input), &output); err != nil {
			t.Fatal(err)
		}
		var r response
		if err := json.Unmarshal(output.Bytes(), &r); err != nil || r.Error == nil {
			t.Fatalf("missing error: %s", output.String())
		}
	}
}

func TestHostLifecycle(t *testing.T) {
	cmd := exec.Command(testBinary, "host")
	cmd.Env = append(os.Environ(), "BUZZ_PRIVATE_KEY=never-log-this")
	errout, err := cmd.StderrPipe()
	if err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	cmd.Stdout = &output
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill() })
	ready := make(chan string, 1)
	go func() { line, _ := bufio.NewReader(errout).ReadString('\n'); ready <- line }()
	select {
	case line := <-ready:
		if !strings.Contains(line, "local placeholder only") || strings.Contains(line, "never-log-this") {
			t.Fatal(line)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("host did not start")
	}
	if runtime.GOOS == "darwin" {
		sockets, err := exec.Command("lsof", "-a", "-p", fmt.Sprint(cmd.Process.Pid), "-i", "-Fn").CombinedOutput()
		if err == nil || len(sockets) != 0 {
			t.Fatalf("unexpected sockets: %s (%v)", sockets, err)
		}
	}
	if runtime.GOOS == "windows" {
		// Windows process termination has no Unix SIGTERM equivalent.
		if err := cmd.Process.Kill(); err != nil {
			t.Fatal(err)
		}
	} else if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if runtime.GOOS != "windows" && err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("host did not stop")
	}
	if output.Len() != 0 {
		t.Fatal("host wrote to stdout")
	}
}

func TestConfigurePreservesIdentityAndOtherAgents(t *testing.T) {
	paths, original := fixture(t)
	var output bytes.Buffer
	if err := configure(paths, []string{"Test agent"}, &output); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(paths.data, "agents", "managed-agents.json"))
	if err != nil {
		t.Fatal(err)
	}
	var before, after []map[string]json.RawMessage
	json.Unmarshal(original, &before)
	json.Unmarshal(data, &after)
	for _, key := range []string{"pubkey", "private_key", "persona_id", "future_large_number"} {
		if !bytes.Equal(before[1][key], after[1][key]) {
			t.Fatalf("identity/unknown field modified: %s", key)
		}
	}
	a, _ := json.Marshal(before[2])
	b, _ := json.Marshal(after[2])
	if !bytes.Equal(a, b) {
		t.Fatal("unrelated agent changed")
	}
	for _, i := range []int{0, 1} {
		if field(after[i], "runtime") != "external-agent" || field(after[i], "acp_command") != filepath.Join(paths.bin, executableName(true)) {
			t.Fatal("incorrect runtime")
		}
	}
	backups, _ := filepath.Glob(filepath.Join(paths.data, "external-agent-backup-*", "managed-agents.json"))
	if len(backups) != 1 {
		t.Fatal("missing backup")
	}
	saved, _ := os.ReadFile(backups[0])
	if !bytes.Equal(saved, original) {
		t.Fatal("backup mismatch")
	}
}

func TestConfigureRefusesUnsafeOrAmbiguousChanges(t *testing.T) {
	for _, scenario := range []string{"running", "remote", "shared", "missing", "ambiguous", "batch"} {
		t.Run(scenario, func(t *testing.T) {
			paths, original := fixture(t)
			var records []map[string]json.RawMessage
			json.Unmarshal(original, &records)
			names := []string{"Test agent"}
			switch scenario {
			case "running":
				os.MkdirAll(filepath.Join(paths.data, "agents", "agent-pids"), 0700)
				os.WriteFile(filepath.Join(paths.data, "agents", "agent-pids", "test-public-key__relay.json"), []byte(`{}`), 0600)
			case "remote":
				records[1]["backend"] = json.RawMessage(`{"type":"provider"}`)
			case "shared":
				records[2]["persona_id"] = json.RawMessage(`"persona"`)
			case "missing":
				records = records[1:]
			case "ambiguous":
				records[2]["name"] = json.RawMessage(`"Test agent"`)
			case "batch":
				names = append(names, "missing agent")
			}
			data, _ := json.Marshal(records)
			store := filepath.Join(paths.data, "agents", "managed-agents.json")
			os.WriteFile(store, data, 0600)
			if err := configure(paths, names, io.Discard); err == nil {
				t.Fatal("expected refusal")
			}
			after, _ := os.ReadFile(store)
			if !bytes.Equal(data, after) {
				t.Fatal("modified store despite refusal")
			}
		})
	}
}

func TestInstallAndHostAlias(t *testing.T) {
	dir := t.TempDir()
	paths := locations{filepath.Join(dir, "data"), filepath.Join(dir, "bin")}
	install := exec.Command(testBinary, "install", "--data-dir", paths.data, "--bin-dir", paths.bin)
	if output, err := install.CombinedOutput(); err != nil {
		t.Fatalf("%s: %v", output, err)
	}
	host := filepath.Join(paths.bin, executableName(true))
	output, err := exec.Command(host, "models", "--json").Output()
	if err != nil || !bytes.Contains(output, []byte(`"external"`)) {
		t.Fatalf("%s: %v", output, err)
	}
	// Explicit replacement is required, and backs up unrelated existing content.
	os.WriteFile(host, []byte("old placeholder"), 0700)
	if err := exec.Command(testBinary, "install", "--data-dir", paths.data, "--bin-dir", paths.bin).Run(); err == nil {
		t.Fatal("overwrote existing executable")
	}
	if output, err := exec.Command(testBinary, "install", "--replace", "--data-dir", paths.data, "--bin-dir", paths.bin).CombinedOutput(); err != nil {
		t.Fatalf("%s: %v", output, err)
	}
	backups, _ := filepath.Glob(filepath.Join(paths.data, "external-agent-backup-*", executableName(true)))
	if len(backups) != 1 {
		t.Fatal("missing executable backup")
	}
}

func fixture(t *testing.T) (locations, []byte) {
	t.Helper()
	dir := t.TempDir()
	paths := locations{filepath.Join(dir, "data"), filepath.Join(dir, "bin")}
	os.MkdirAll(filepath.Join(paths.data, "agents"), 0700)
	os.MkdirAll(paths.bin, 0700)
	for _, host := range []bool{false, true} {
		os.WriteFile(filepath.Join(paths.bin, executableName(host)), []byte("fixture"), 0700)
	}
	original := []byte(`[
  {"name":"Test agent","pubkey":"","slug":"persona","runtime":"old"},
  {"name":"Test agent","pubkey":"test-public-key","private_key":"synthetic-fixture-not-a-key","persona_id":"persona","backend":{"type":"local"},"future_large_number":9007199254740993},
  {"name":"Other agent","pubkey":"other-public-key","backend":{"type":"local"},"runtime":"untouched"}
]`)
	os.WriteFile(filepath.Join(paths.data, "agents", "managed-agents.json"), original, 0600)
	return paths, original
}
