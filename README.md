# Buzz External Agent

Keep an independently hosted agent registered in [Buzz Desktop](https://github.com/block/buzz)
without giving local Start/Stop control over its remote process.

A small standalone executable written in Go. No Python, Node.js, Go installation,
model provider, or API key is required to run a release binary. Available for
macOS, Linux, and Windows, on ARM64 and x86-64.

## What it does

Buzz normally starts an outer `buzz-acp` host, which launches an inner ACP agent.
Replacing only the inner agent with a dummy still leaves the outer host connected
to the relay. This project replaces **both layers**:

```text
Buzz Desktop
  └─ buzz-external-agent-host     Local idle process; no relay connection

Remote agent / Hermes            Runs independently on your server
  └─ Buzz relay                  The actual messages and presence
```

- Local Start/Stop only starts or stops the placeholder.
- The placeholder does not open network connections, launch tools, call models,
  publish presence, or send messages. ACP prompts complete silently.
- The original identity remains in Buzz. No new identity or key is generated.
- Remote configuration and service lifecycle remain independent.
- The local placeholder does not need to stay running for registration to persist.

**Delete/Archive still removes or archives the identity in Buzz. Use Stop to stop
only the local process.** This tool does not intercept Buzz's other management actions.

## Install

Download the ZIP for your operating system and CPU from
[Releases](https://github.com/frankhommers/buzz-external-agent/releases), extract it,
and close Buzz. Each archive contains one binary, this README, and the MIT license.
Checksums are in `SHA256SUMS`. Releases are not Developer ID notarized or Windows
Authenticode signed; you can also build from source.

macOS / Linux:

```sh
./buzz-external-agent install
```

Windows PowerShell:

```powershell
.\buzz-external-agent.exe install
```

The installer copies the binary under two names: `buzz-external-agent` and
`buzz-external-agent-host` (with `.exe` on Windows). They contain identical code;
calling the host name selects idle host mode. Copies work without symlink privileges.
It also registers **External agent** in Buzz's custom runtime catalog.

| Platform | Installed binaries | Buzz data directory |
| --- | --- | --- |
| macOS | `~/.local/bin` | `~/Library/Application Support/xyz.block.buzz.app` |
| Linux | `~/.local/bin` | `$XDG_DATA_HOME/xyz.block.buzz.app`, default `~/.local/share/xyz.block.buzz.app` |
| Windows | `%LOCALAPPDATA%\BuzzExternalAgent\bin` | `%APPDATA%\xyz.block.buzz.app` |

Both `install` and `configure` accept `--bin-dir` and `--data-dir` overrides.
Flags go before agent names. Use the same overrides for both commands.
The installer does not change PATH. It records absolute executable paths in Buzz.

For upgrades, close Buzz and run the **newly downloaded binary** with
`install --replace`. Existing differing files are backed up before replacement.
On Windows, run updates from outside the installation directory.

## Configure an existing identity

Stop its **local** process, close Buzz, and run:

```sh
./buzz-external-agent configure "My remote agent"
```

PowerShell uses `.\buzz-external-agent.exe configure "My remote agent"`.
You can specify several names or full public hex keys in one command. All selected
records are validated before the agent store is changed.

The command requires an existing registration with a `local` backend. It preserves
keys, public identity, avatar, instructions, unknown fields, and unrelated agents.
It changes the linked persona and instance to:

| Setting | Value |
| --- | --- |
| Runtime | `external-agent` |
| ACP command | Absolute path to `buzz-external-agent-host` |
| Agent command | Absolute path to `buzz-external-agent` |
| Model | `external` (placeholder, no local model) |
| Autostart / restart on config change | Off |

Reopen Buzz. Local Start/Stop now controls only the placeholder. The status dot still
reflects relay presence; starting the placeholder cannot make a remote agent online.
The `external` model label does not describe the remote agent's actual model.

For an existing remote identity missing from Buzz, restore its original identity
first. Creating another agent with the same name produces a different key.
This project does not recover keys or unarchive relay identities.

## Registering a completely new remote agent

1. Install this runtime, reopen Buzz, and create an **External agent**.
2. Start it once to mint its new identity, then stop it and close Buzz.
   Do this **before** putting that identity into use on a server.
3. Run `configure "New agent name"` and reopen Buzz.
4. Provision your remote agent with the identity and required owner attestation,
   following [Buzz's remote-agent documentation](https://github.com/block/buzz/blob/main/docs/remote-agents.md).

Selecting the custom runtime alone is insufficient: Buzz initially uses its normal
outer host. The `configure` step replaces it. This new-identity sequence has not
been tested end to end; the verified integration uses existing registrations.

## Commands

```text
buzz-external-agent                  ACP over newline-delimited JSON on stdio
buzz-external-agent acp              Same explicit mode
buzz-external-agent host             Idle until local process termination
buzz-external-agent models           Buzz model-discovery JSON
buzz-external-agent auth-methods     Empty authentication-method list
buzz-external-agent install --help   Installation flags
buzz-external-agent configure --help Configuration flags
buzz-external-agent --version
```

ACP supports initialization, new sessions, silent prompts, and the single
`external` model. It ignores MCP servers and working directories. It never emits
`session/update` notifications. Unknown methods and invalid input receive JSON-RPC
errors. Input lines are limited to 1 MiB.

Host mode works with stdin closed and handles SIGINT/SIGTERM on Unix. On Windows,
Buzz can terminate the local process. Environment variables with credential-like
names are removed from the process environment; this is not a memory-erasure guarantee.

## Compatibility and backups

The Buzz Desktop integration was exercised on **macOS ARM64 with Buzz 0.5.26**.
CI runs executable/protocol, installation, and configuration tests on macOS, Linux,
and Windows. Linux/Windows Buzz UI integration and ARM64 Windows/Linux runtime
execution are not yet verified. All six targets are cross-compiled.

This is an independent integration using Buzz's on-disk configuration schema,
not an official Buzz plugin API. Check the custom runtime and ACP command after
Buzz updates. Keep Buzz closed during setup to avoid concurrent settings writes.
Runtime modes do not write configuration; only explicit setup commands do.

Backups are stored in `external-agent-backup-*` under the Buzz data directory.
The configuration backup is the original `managed-agents.json`; it may contain
sensitive data and is never uploaded. Files use owner-only permissions on Unix;
on Windows they inherit the directory's ACL.

To revert, close Buzz and restore the relevant agent's configuration from a backup,
or change its runtime and ACP command back in Buzz. Restore a whole store only
after checking for newer changes to other agents. Installer backups also include
replaced binaries/runtime definitions. This tool never touches server services.

## Build and test

Go 1.24 or later; standard library only.

```sh
go build -trimpath -o buzz-external-agent .
go vet ./...
go test -race ./...
go run ./tools/release
```

The release builder produces six ZIPs and `SHA256SUMS` in `dist/`, using
`CGO_ENABLED=0`. No container, cross C compiler, or external packaging tool is needed.
The tests check real process lifecycles, ACP communication, ignored tools,
configuration backups, identity preservation, and refusal of unsafe changes.
On macOS they also check that the idle host has no network sockets.

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
Independent project; not affiliated with or endorsed by Block.
