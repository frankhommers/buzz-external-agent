package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const appID = "xyz.block.buzz.app"

type locations struct{ data, bin string }

func defaultLocations() (locations, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return locations{}, err
	}
	var data, bin string
	switch runtime.GOOS {
	case "darwin":
		data = filepath.Join(home, "Library", "Application Support")
	case "windows":
		data = os.Getenv("APPDATA")
		local := os.Getenv("LOCALAPPDATA")
		if data == "" || local == "" {
			return locations{}, errors.New("APPDATA and LOCALAPPDATA must be set")
		}
		bin = filepath.Join(local, "BuzzExternalAgent", "bin")
	case "linux":
		data = os.Getenv("XDG_DATA_HOME")
		if !filepath.IsAbs(data) {
			data = filepath.Join(home, ".local", "share")
		}
	default:
		return locations{}, errors.New("supported platforms: macOS, Linux, Windows")
	}
	if bin == "" {
		bin = filepath.Join(home, ".local", "bin")
	}
	return locations{filepath.Join(data, appID), bin}, nil
}

func executableName(host bool) string {
	name := "buzz-external-agent"
	if host {
		name += "-host"
	}
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return name
}

func setup(command string, args []string, out io.Writer) error {
	paths, err := defaultLocations()
	if err != nil {
		return err
	}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	flags.SetOutput(out)
	flags.StringVar(&paths.data, "data-dir", paths.data, "Buzz app data directory")
	flags.StringVar(&paths.bin, "bin-dir", paths.bin, "installed executable directory")
	replace := false
	if command == "install" {
		flags.BoolVar(&replace, "replace", false, "back up and replace existing executables/runtime definition")
	}
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	paths.data, err = filepath.Abs(paths.data)
	if err != nil {
		return err
	}
	paths.bin, err = filepath.Abs(paths.bin)
	if err != nil {
		return err
	}
	if command == "install" {
		if flags.NArg() != 0 {
			return errors.New("install takes flags only")
		}
		return install(paths, replace, out)
	}
	if flags.NArg() == 0 {
		return errors.New("usage: configure [flags] NAME_OR_PUBLIC_KEY [...]; close Buzz first")
	}
	return configure(paths, flags.Args(), out)
}

// atomicWrite replaces the directory entry, never the target of an old symlink.
func atomicWrite(path string, data []byte, mode os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".external-agent-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err = f.Chmod(mode); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}

func backupDir(base string) (string, error) {
	if err := os.MkdirAll(base, 0700); err != nil {
		return "", err
	}
	return os.MkdirTemp(base, "external-agent-backup-"+time.Now().UTC().Format("20060102T150405Z")+"-")
}

func install(paths locations, replace bool, out io.Writer) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	binary, err := os.ReadFile(self)
	if err != nil {
		return err
	}
	catalog := filepath.Join(paths.data, "custom_harnesses")
	definition, err := json.MarshalIndent(map[string]any{
		"id": "external-agent", "label": "External agent",
		"command": filepath.Join(paths.bin, executableName(false)), "args": []string{}, "env": map[string]string{},
		"installHint": "Local registration placeholder. Also set ACP command to buzz-external-agent-host. VM runs independently.",
	}, "", "  ")
	if err != nil {
		return err
	}
	type file struct {
		path string
		data []byte
		mode os.FileMode
	}
	files := []file{
		{filepath.Join(paths.bin, executableName(false)), binary, 0755},
		{filepath.Join(paths.bin, executableName(true)), binary, 0755},
		{filepath.Join(catalog, "external-agent.json"), append(definition, '\n'), 0600},
	}
	// Validate every destination before making any changes.
	old := make(map[string][]byte)
	for _, target := range files {
		previous, readErr := os.ReadFile(target.path)
		if readErr != nil && !errors.Is(readErr, os.ErrNotExist) {
			return readErr
		}
		if readErr == nil && !bytes.Equal(previous, target.data) {
			if !replace {
				return fmt.Errorf("destination exists: %s; close Buzz and use install --replace to back up and replace it", target.path)
			}
			old[target.path] = previous
		}
	}
	if len(old) > 0 {
		backup, err := backupDir(paths.data)
		if err != nil {
			return err
		}
		for path, data := range old {
			if err := os.WriteFile(filepath.Join(backup, filepath.Base(path)), data, 0600); err != nil {
				return err
			}
		}
		fmt.Fprintln(out, "Previous installation backed up:", backup)
	}
	for _, target := range files {
		current, _ := os.ReadFile(target.path)
		if bytes.Equal(current, target.data) {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target.path), 0700); err != nil {
			return err
		}
		if err := atomicWrite(target.path, target.data, target.mode); err != nil {
			return err
		}
	}
	fmt.Fprintln(out, "Installed:", paths.bin)
	fmt.Fprintln(out, "Existing identities unchanged. With Buzz closed, run configure NAME_OR_PUBLIC_KEY for each existing local identity.")
	return nil
}

func configure(paths locations, names []string, out io.Writer) error {
	for _, host := range []bool{false, true} {
		if info, err := os.Stat(filepath.Join(paths.bin, executableName(host))); err != nil || !info.Mode().IsRegular() {
			return errors.New("executables not installed; run install first")
		}
	}
	store := filepath.Join(paths.data, "agents", "managed-agents.json")
	original, err := os.ReadFile(store)
	if err != nil {
		return err
	}
	var records []map[string]json.RawMessage
	if err := json.Unmarshal(original, &records); err != nil {
		return errors.New("invalid Buzz agent store; no changes made")
	}
	selected := map[int]bool{}
	for _, name := range names {
		index := -1
		for i, r := range records {
			if field(r, "pubkey") != "" && (field(r, "pubkey") == name || strings.EqualFold(field(r, "name"), name)) {
				if index != -1 {
					return errors.New("ambiguous agent name; use its full public hex key")
				}
				index = i
			}
		}
		if index == -1 {
			return fmt.Errorf("no existing local identity found for %q; restore its original identity first", name)
		}
		agent := records[index]
		var backend map[string]json.RawMessage
		if json.Unmarshal(agent["backend"], &backend) != nil || field(backend, "type") != "local" {
			return errors.New("only local registrations are supported; remote deployments are never modified")
		}
		if err := checkLocalRuntime(paths, agent, processRunning, out); err != nil {
			return err
		}
		selected[index] = true
		if persona := field(agent, "persona_id"); persona != "" {
			definition := -1
			for i, r := range records {
				if i != index && field(r, "pubkey") != "" && field(r, "persona_id") == persona {
					return errors.New("shared persona definition; refusing to change other identities")
				}
				if field(r, "pubkey") == "" && field(r, "slug") == persona {
					if definition != -1 {
						return errors.New("duplicate persona definition; repair the registration first")
					}
					definition = i
				}
			}
			if definition == -1 {
				return errors.New("linked persona definition is missing")
			}
			selected[definition] = true
		}
	}
	for index := range selected {
		r := records[index]
		agentCommand := ""
		if field(r, "pubkey") != "" {
			agentCommand = filepath.Join(paths.bin, executableName(false))
		}
		changes := map[string]any{
			"runtime": "external-agent", "acp_command": filepath.Join(paths.bin, executableName(true)),
			"agent_command": agentCommand, "agent_command_override": nil, "agent_args": []string{},
			"mcp_command": "", "model": "external", "provider": nil,
			"start_on_app_launch": false, "auto_restart_on_config_change": false,
			"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
		}
		for name, value := range changes {
			r[name], _ = json.Marshal(value)
		}
	}
	updated, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	backup, err := backupDir(paths.data)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(backup, "managed-agents.json"), original, 0600); err != nil {
		return err
	}
	current, err := os.ReadFile(store)
	if err != nil {
		return err
	}
	if !bytes.Equal(current, original) {
		return errors.New("Buzz changed its store concurrently; close Buzz and retry")
	}
	if err := atomicWrite(store, append(updated, '\n'), 0600); err != nil {
		return err
	}
	fmt.Fprintln(out, "Configured existing identities:", strings.Join(names, ", "))
	fmt.Fprintln(out, "Backup:", backup)
	fmt.Fprintln(out, "Reopen Buzz. Start/Stop controls only the local placeholder; the VM remains independent.")
	return nil
}
