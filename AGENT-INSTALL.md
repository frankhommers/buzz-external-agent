# Installation instructions for an AI agent

Use this guide when the user asks you to install Buzz External Agent for existing
remote-agent identities. Run on the **computer running Buzz Desktop**, not on the
remote agent's VM. This is an installation task, not a request to modify source code.

## Required inputs

- The existing agent names or full public hex keys the user wants configured.
- Access to the computer running Buzz Desktop and its current user's app data.
- Any nonstandard Buzz data or executable directory, if applicable.

Infer the OS, architecture, and normal directories locally. Ask only for missing
information you cannot safely establish, such as which identities to configure
or access to the desktop machine. Do not ask for private keys in chat.

## Boundaries

- Preserve existing public keys, private keys, persona links, and unrelated agents.
- Do not create a replacement identity merely because an existing one is missing.
- Do not delete, archive, unarchive, or rotate an identity as part of installation.
- Do not run SSH commands, remote service controls, provider shutdown actions,
  `!shutdown`, or test chat messages. This task requires no VM changes.
- Do not use a provider/remote backend for the placeholder. It requires `local`.
- Do not print, upload, or commit Buzz stores, private keys, or environment dumps.
- Selecting the custom runtime alone is insufficient. The outer ACP command must
  also point to `buzz-external-agent-host`, not the normal `buzz-acp` host.

## 1. Inspect the local registration

Read the repository [README](README.md) and note its Buzz compatibility limits.
Locate the app data directory:

| OS | Default Buzz data directory |
| --- | --- |
| macOS | `~/Library/Application Support/xyz.block.buzz.app` |
| Linux | `$XDG_DATA_HOME/xyz.block.buzz.app`, default `~/.local/share/xyz.block.buzz.app` |
| Windows | `%APPDATA%\xyz.block.buzz.app` |

Inspect `agents/managed-agents.json` locally, extracting only the public fields
needed to identify the selected records. A keyed instance has a nonempty `pubkey`;
its persona definition is a separate record linked by `persona_id` / `slug`.
Record the selected public keys for comparison after configuration. Keep any
complete pre-change snapshot private and local.

If the identity is absent, report that its original registration must be restored
first. Do not create another identity with the same name. If names are ambiguous,
use a verified public key. If the backend is not `local`, do not convert it blindly.

Check local running processes and `agents/agent-pids/` receipts. A null
`runtime_pid` field alone does **not** prove that the agent is stopped. Only stop
a process known to belong to Buzz Desktop's selected local registration. Never
use a remote Shutdown control. If the process ownership or action is unclear,
resolve that before stopping anything.

Close Buzz before installation/configuration. If that would interrupt unrelated
active local agents, arrange a safe pause with the user first. Remember which
selected placeholders were running so their local state can be restored later.

## 2. Download and verify the binary

Use the official [GitHub releases](https://github.com/frankhommers/buzz-external-agent/releases)
for this project. Resolve one concrete release tag, then download its archive
and `SHA256SUMS` from that **same release** into a fresh temporary directory.

| OS / CPU | Archive |
| --- | --- |
| macOS Apple Silicon | `buzz-external-agent-darwin-arm64.zip` |
| macOS Intel | `buzz-external-agent-darwin-amd64.zip` |
| Linux ARM64 | `buzz-external-agent-linux-arm64.zip` |
| Linux x86-64 | `buzz-external-agent-linux-amd64.zip` |
| Windows ARM64 | `buzz-external-agent-windows-arm64.zip` |
| Windows x64 | `buzz-external-agent-windows-amd64.zip` |

For example, with an authenticated GitHub CLI (replace the placeholders):

```sh
gh release view --repo frankhommers/buzz-external-agent --json tagName --jq .tagName
gh release download <TAG> --repo frankhommers/buzz-external-agent --pattern <ARCHIVE> --pattern SHA256SUMS --dir <TEMP_DIRECTORY>
```

Authentication/`gh` is optional; the public release assets can also be downloaded
directly. Verify the archive's SHA-256 against its exact filename in `SHA256SUMS`
using `shasum -a 256` (macOS), `sha256sum` (Linux), or `Get-FileHash -Algorithm SHA256`
(PowerShell). Stop on a mismatch. These checksums check integrity, not an independent
publisher signature. Extract the verified archive, then run `--version` and confirm
it matches the chosen tag without its `v` prefix.

Do not disable OS security protections to execute a downloaded binary. Release
binaries are not Developer ID notarized or Authenticode signed. If blocked, follow
the applicable user/OS approval flow or build the selected tag from source as
described in the README.

## 3. Install and configure

Run from the extracted archive directory. Names below are placeholders; substitute
only the identities selected by the user, with appropriate shell quoting.

macOS / Linux:

```sh
./buzz-external-agent install
./buzz-external-agent configure "My remote agent" "Another remote agent"
```

Windows PowerShell:

```powershell
.\buzz-external-agent.exe install
.\buzz-external-agent.exe configure "My remote agent" "Another remote agent"
```

For an existing installation, use `install --replace` from the newly downloaded
binary. This backs up differing executables/runtime definitions before replacing
them. Do not overwrite an unrelated program without resolving the path conflict.
On Windows, run the upgrade from outside the destination binary directory.

If needed, pass the **same** `--data-dir` and `--bin-dir` overrides to both commands.
Flags must precede agent names. The installer records absolute paths; no PATH edit
or system-wide installation is required.

The configure command validates the selected identities, backs up the original
store, and updates the linked local records. Note its printed backup location.
If it refuses an active runtime, shared persona, missing identity, or conflicting
store change, resolve that cause. Do not bypass the check by deleting receipts or
manually forcing a new key into the store.

## 4. Verify the result

1. Confirm each selected instance retains its original public key and persona link.
   Compare other identity fields and unrelated records locally without exposing keys.
2. Confirm the configured fields: `backend.type=local`, `runtime=external-agent`,
   `model=external`, absolute `acp_command` ending in `buzz-external-agent-host`
   (or `.exe`), and the corresponding inner agent executable. Autostart and
   restart-on-config-change should be off.
3. Run the installed host's `--version`, `models`, and `auth-methods` commands.
   Model discovery must offer `external`; authentication methods must be empty.
4. Reopen Buzz and verify that the selected registrations are present. When local
   UI access is available, test Start/Stop of a selected placeholder. Confirm that
   Buzz starts the installed native host and that Stop removes that local process.
   Check process ownership and local network sockets using OS tools. No network
   sockets or tool child processes should be opened by the placeholder.
5. Restore any selected placeholder's previous local running state. Do not send a
   test message or operate a remote service to prove this installation worked.

The relay's online/offline dot is not a success check for this dummy. Starting it
does not advertise remote presence. If Buzz UI verification is unavailable, report
that limitation instead of claiming a full Start/Stop test or remote-health check.

## Completion report

Report the release version, installed paths, configured agent names/public keys,
backup location, completed checks, and any verification limits. Tell the user that
Start/Stop is local only and that Delete/Archive still affects the identity.

For a brand-new identity or missing original key, this guide stops at the boundary
above. Use a separately authorized provisioning/recovery workflow and the README's
new-agent notes; do not silently turn an installation into a server migration.
