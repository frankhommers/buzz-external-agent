package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigureWithStaleReceiptsAfterProcessExit(t *testing.T) {
	paths, original := fixture(t)
	cmd := exec.Command(testBinary, "acp")
	in, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { in.Close(); _ = cmd.Process.Kill() })
	pid := uint32(cmd.Process.Pid)
	if running, err := processRunning(pid); err != nil || !running {
		t.Fatalf("live process: running=%v, err=%v", running, err)
	}
	dir := filepath.Join(paths.data, "agents", "agent-pids")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	receipts := map[string][]byte{
		"test-public-key.pid":         []byte(fmt.Sprint(pid)),
		"test-public-key__relay.json": []byte(fmt.Sprintf(`{"key":{"pubkey":"test-public-key","relayUrl":"wss://example.invalid"},"pid":%d,"desktop_instance_id":"fixture","started_at":"2026-01-01T00:00:00Z"}`, pid)),
	}
	for name, data := range receipts {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	// Exercise the real binary, not just a mocked liveness check.
	configureCmd := func() *exec.Cmd {
		return exec.Command(testBinary, "configure", "--data-dir", paths.data, "--bin-dir", paths.bin, "Test agent")
	}
	output, err := configureCmd().CombinedOutput()
	if err == nil || !bytes.Contains(output, []byte("is still present")) {
		t.Fatalf("did not block live receipt: %s (%v)", output, err)
	}
	store := filepath.Join(paths.data, "agents", "managed-agents.json")
	current, err := os.ReadFile(store)
	if err != nil || !bytes.Equal(current, original) {
		t.Fatal("live receipt refusal modified store")
	}
	if err := in.Close(); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Wait(); err != nil {
		t.Fatal(err)
	}
	if running, err := processRunning(pid); err != nil || running {
		t.Fatalf("exited process: running=%v, err=%v", running, err)
	}
	// Also simulate the legacy scalar left behind alongside both receipt formats.
	var records []map[string]json.RawMessage
	if err := json.Unmarshal(original, &records); err != nil {
		t.Fatal(err)
	}
	records[1]["runtime_pid"] = json.RawMessage(fmt.Sprint(pid))
	before, err := json.Marshal(records)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store, before, 0600); err != nil {
		t.Fatal(err)
	}
	output, err = configureCmd().CombinedOutput()
	if err != nil {
		t.Fatalf("stale receipt blocked configure: %s (%v)", output, err)
	}
	if bytes.Count(output, []byte("Ignoring stale local runtime reference:")) != 3 {
		t.Fatalf("missing diagnostics: %s", output)
	}
	for name, data := range receipts {
		current, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil || !bytes.Equal(current, data) {
			t.Fatalf("receipt changed: %s", name)
		}
	}
	current, err = os.ReadFile(store)
	if err != nil {
		t.Fatal(err)
	}
	var after []map[string]json.RawMessage
	if err := json.Unmarshal(current, &after); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"pubkey", "private_key", "persona_id", "runtime_pid", "future_large_number"} {
		if !bytes.Equal(records[1][key], after[1][key]) {
			t.Fatalf("preserved field changed: %s", key)
		}
	}
	if field(after[1], "runtime") != "external-agent" {
		t.Fatal("configuration not applied")
	}
	backups, _ := filepath.Glob(filepath.Join(paths.data, "external-agent-backup-*", "managed-agents.json"))
	if len(backups) != 1 {
		t.Fatal("expected one backup")
	}
	saved, err := os.ReadFile(backups[0])
	if err != nil || !bytes.Equal(saved, before) {
		t.Fatal("backup mismatch")
	}
}

func TestRuntimeCheckBlocksUncertainState(t *testing.T) {
	for _, scenario := range []string{"live", "denied", "invalid-json", "missing-pid", "zero-pid", "negative-pid", "overflow-pid", "mismatched-key", "unknown-file", "invalid-legacy", "live-scalar", "invalid-scalar"} {
		t.Run(scenario, func(t *testing.T) {
			paths, _ := fixture(t)
			agent := map[string]json.RawMessage{"pubkey": json.RawMessage(`"test-public-key"`)}
			dir := filepath.Join(paths.data, "agents", "agent-pids")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			name := "test-public-key__relay.json"
			data := `{"key":{"pubkey":"test-public-key"},"pid":123}`
			probe := func(uint32) (bool, error) { t.Fatal("invalid metadata should not reach OS probe"); return false, nil }
			switch scenario {
			case "live":
				probe = func(uint32) (bool, error) { return true, nil }
			case "denied":
				probe = func(uint32) (bool, error) { return false, errors.New("access denied") }
			case "invalid-json":
				data = "{private-receipt-contents"
			case "missing-pid":
				data = `{"key":{"pubkey":"test-public-key"}}`
			case "zero-pid":
				data = strings.ReplaceAll(data, "123", "0")
			case "negative-pid":
				data = strings.ReplaceAll(data, "123", "-1")
			case "overflow-pid":
				data = strings.ReplaceAll(data, "123", "4294967296")
			case "mismatched-key":
				data = strings.ReplaceAll(data, "test-public-key", "other-public-key")
			case "unknown-file":
				name = "test-public-key.unknown"
			case "invalid-legacy":
				name, data = "test-public-key.pid", "not-a-pid"
			case "live-scalar":
				agent["runtime_pid"] = json.RawMessage("123")
				probe = func(uint32) (bool, error) { return true, nil }
			case "invalid-scalar":
				agent["runtime_pid"] = json.RawMessage(`"123"`)
			}
			if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0600); err != nil {
				t.Fatal(err)
			}
			err := checkLocalRuntime(paths, agent, probe, io.Discard)
			if err == nil {
				t.Fatal("uncertain state allowed")
			}
			if strings.Contains(err.Error(), "private-receipt-contents") {
				t.Fatal("receipt contents leaked")
			}
			current, readErr := os.ReadFile(filepath.Join(dir, name))
			if readErr != nil || string(current) != data {
				t.Fatal("receipt modified")
			}
		})
	}
}

func TestStaleReceiptDoesNotHideAnotherLiveRelay(t *testing.T) {
	paths, _ := fixture(t)
	agent := map[string]json.RawMessage{"pubkey": json.RawMessage(`"test-public-key"`)}
	dir := filepath.Join(paths.data, "agents", "agent-pids")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 2; i++ {
		data := fmt.Sprintf(`{"key":{"pubkey":"test-public-key"},"pid":%d}`, i)
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("test-public-key__relay%d.json", i)), []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := checkLocalRuntime(paths, agent, func(pid uint32) (bool, error) { return pid == 2, nil }, io.Discard); err == nil {
		t.Fatal("live second relay was ignored")
	}
}
