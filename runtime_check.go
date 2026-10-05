package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// A receipt is bookkeeping, not proof that its process is still running.
// Never kill a process or delete a receipt here. A reused PID, access denial,
// or an unknown receipt format must remain a blocker, not a reason to force setup.
func checkLocalRuntime(paths locations, agent map[string]json.RawMessage, probe func(uint32) (bool, error), out io.Writer) error {
	check := func(pid uint32, source string) error {
		if pid == 0 || pid > 0x7fffffff {
			return fmt.Errorf("invalid PID in %s; cannot verify local runtime state", source)
		}
		running, err := probe(pid)
		if err != nil {
			return fmt.Errorf("cannot verify local PID %d from %s: %w; keep Buzz closed and resolve the process state before retrying", pid, source, err)
		}
		if running {
			return fmt.Errorf("local PID %d from %s is still present; stop the owning local agent and close Buzz first; do not stop the VM service", pid, source)
		}
		fmt.Fprintf(out, "Ignoring stale local runtime reference: %s (PID %d has exited). Reference left unchanged.\n", source, pid)
		return nil
	}
	if raw := bytes.TrimSpace(agent["runtime_pid"]); len(raw) > 0 && string(raw) != "null" && string(raw) != "0" {
		var pid uint32
		if json.Unmarshal(raw, &pid) != nil {
			return errors.New("invalid runtime_pid; cannot verify local runtime state")
		}
		if err := check(pid, "runtime_pid"); err != nil {
			return err
		}
	}
	dir := filepath.Join(paths.data, "agents", "agent-pids")
	receipts, err := os.ReadDir(dir)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	pubkey := field(agent, "pubkey")
	for _, receipt := range receipts {
		name := receipt.Name()
		if !strings.Contains(name, pubkey) {
			continue
		}
		file, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("cannot inspect local runtime receipt %s: %w", name, err)
		}
		data, err := io.ReadAll(io.LimitReader(file, maxLine+1))
		file.Close()
		if err != nil {
			return fmt.Errorf("cannot read local runtime receipt %s: %w", name, err)
		}
		if len(data) > maxLine {
			return fmt.Errorf("local runtime receipt %s is too large to verify", name)
		}
		var pid uint32
		switch {
		case name == pubkey+".pid":
			// Legacy Buzz receipt: a plain decimal PID.
			value, err := strconv.ParseUint(strings.TrimSpace(string(data)), 10, 32)
			if err != nil {
				return fmt.Errorf("invalid PID in local runtime receipt %s", name)
			}
			pid = uint32(value)
		case strings.HasPrefix(name, pubkey+"__") && strings.HasSuffix(name, ".json"):
			var record struct {
				PID uint32 `json:"pid"`
				Key struct {
					Pubkey string `json:"pubkey"`
				} `json:"key"`
			}
			if json.Unmarshal(data, &record) != nil || record.Key.Pubkey != pubkey {
				return fmt.Errorf("invalid or mismatched local runtime receipt %s; cannot verify process state", name)
			}
			pid = record.PID
		default:
			return fmt.Errorf("unrecognized local runtime receipt %s; cannot verify process state", name)
		}
		if err := check(pid, name); err != nil {
			return err
		}
	}
	return nil
}
