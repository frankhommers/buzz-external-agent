// Buzz External Agent is a local placeholder for independently hosted agents.
package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
)

const version = "0.1.0"
const maxLine = 1 << 20

var models = json.RawMessage(`{"currentModelId":"external","availableModels":[{"modelId":"external","name":"External — no local model","description":"Registration placeholder. The server agent runs independently."}]}`)

func main() {
	if err := run(os.Args[0], os.Args[1:], os.Stdin, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(name string, args []string, in io.Reader, out, diagnostic io.Writer) error {
	scrubCredentials()
	mode := "acp"
	if strings.TrimSuffix(filepath.Base(name), ".exe") == "buzz-external-agent-host" {
		mode = "host"
	}
	if len(args) > 0 {
		mode, args = args[0], args[1:]
	}
	switch mode {
	case "--help", "-h", "help":
		_, err := fmt.Fprintln(out, `Buzz External Agent — independent remote agents, local registration only.

Usage: buzz-external-agent [command]
  acp          Silent ACP placeholder over stdin/stdout (default)
  host         Local idle process, stopped by Buzz; no network or VM controls
  models       Buzz model-discovery response
  auth-methods Buzz authentication-discovery response
  install      Install both executable names and the custom runtime; --help for flags
  configure    Configure existing local identities; --help for flags
  --version    Print version

The installed buzz-external-agent-host executable defaults to host mode.
Close Buzz before install/configure. Keep existing agent identities.`)
		return err
	case "--version", "version":
		_, err := fmt.Fprintln(out, "buzz-external-agent "+version)
		return err
	case "install", "configure":
		return setup(mode, args, out)
	case "models":
		// Buzz passes discovery flags for the inner agent; no execution is needed.
		return json.NewEncoder(out).Encode(map[string]any{
			"agent":  map[string]string{"name": "external-agent", "version": version},
			"stable": map[string]any{"configOptions": []any{}}, "unstable": models,
		})
	case "auth-methods":
		_, err := fmt.Fprintln(out, `{"methods":[]}`)
		return err
	case "host":
		if len(args) != 0 {
			return errors.New("host takes no arguments")
		}
		stopped := make(chan os.Signal, 1)
		signal.Notify(stopped, os.Interrupt, syscall.SIGTERM)
		defer signal.Stop(stopped)
		fmt.Fprintln(diagnostic, "External agent: local placeholder only; no network or VM controls.")
		<-stopped
		return nil
	case "acp":
		if len(args) != 0 {
			return errors.New("acp takes no arguments")
		}
		return serveACP(in, out)
	default:
		return errors.New("unsupported command; use --help")
	}
}

func scrubCredentials() {
	for _, entry := range os.Environ() {
		name, _, _ := strings.Cut(entry, "=")
		for _, part := range []string{"PRIVATE_KEY", "TOKEN", "PASSWORD", "SECRET", "API_KEY"} {
			if strings.Contains(strings.ToUpper(name), part) {
				// Preserve Buzz ownership markers used to stop this local process.
				_ = os.Unsetenv(name)
				break
			}
		}
	}
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

func serveACP(in io.Reader, out io.Writer) error {
	reader := bufio.NewReaderSize(in, maxLine+1)
	encoder := json.NewEncoder(out)
	sessions := map[string]bool{}
	for {
		line, readErr := reader.ReadSlice('\n')
		if len(line) == 0 && readErr == io.EOF {
			return nil
		}
		r := response{JSONRPC: "2.0", ID: json.RawMessage("null")}
		if len(line) > maxLine || errors.Is(readErr, bufio.ErrBufferFull) {
			r.Error = &rpcError{-32600, "Request too large"}
			return encoder.Encode(r)
		}
		if readErr != nil && readErr != io.EOF {
			return readErr
		}
		var request map[string]json.RawMessage
		if !json.Valid(line) {
			r.Error = &rpcError{-32700, "Invalid JSON"}
		} else if json.Unmarshal(line, &request) != nil || request == nil || string(request["jsonrpc"]) != `"2.0"` || field(request, "method") == "" {
			r.Error = &rpcError{-32600, "Invalid request"}
		} else {
			id, exists := request["id"]
			if !exists { // Notifications never cause output or side effects.
				continue
			}
			if !(string(id) == "null" || len(id) > 0 && (id[0] == '"' || id[0] == '-' || id[0] >= '0' && id[0] <= '9')) {
				r.Error = &rpcError{-32600, "Invalid request id"}
			} else {
				r.ID = id
				params := map[string]json.RawMessage{}
				if raw, ok := request["params"]; ok && (json.Unmarshal(raw, &params) != nil || params == nil) {
					r.Error = &rpcError{-32602, "Invalid parameters"}
				} else {
					r.Result, r.Error = dispatch(field(request, "method"), params, sessions)
				}
			}
		}
		if err := encoder.Encode(r); err != nil {
			return err
		}
	}
}

func dispatch(method string, params map[string]json.RawMessage, sessions map[string]bool) (any, *rpcError) {
	switch method {
	case "initialize":
		protocol := 1
		if raw, ok := params["protocolVersion"]; ok {
			if json.Unmarshal(raw, &protocol) != nil || (protocol != 1 && protocol != 2) {
				protocol = 2
			}
		}
		return map[string]any{
			"protocolVersion": protocol, "agentCapabilities": map[string]bool{"loadSession": false},
			"agentInfo":   map[string]string{"name": "external-agent", "title": "External agent", "version": version},
			"authMethods": []any{},
		}, nil
	case "session/new":
		var token [16]byte
		if _, err := rand.Read(token[:]); err != nil {
			return nil, &rpcError{-32603, "Cannot allocate session"}
		}
		session := hex.EncodeToString(token[:])
		sessions[session] = true
		// Ignore cwd, MCP servers, and instructions; never launch tools.
		return map[string]any{"sessionId": session, "models": models}, nil
	case "session/prompt", "session/set_model":
		if !sessions[field(params, "sessionId")] {
			return nil, &rpcError{-32602, "Unknown session"}
		}
		if method == "session/prompt" {
			return map[string]string{"stopReason": "end_turn"}, nil
		}
		if field(params, "modelId") == "external" {
			return map[string]any{}, nil
		}
		return nil, &rpcError{-32602, "Only the external placeholder model exists"}
	default:
		return nil, &rpcError{-32601, "Method not supported"}
	}
}

func field(record map[string]json.RawMessage, name string) string {
	var value string
	_ = json.Unmarshal(bytes.TrimSpace(record[name]), &value)
	return value
}
