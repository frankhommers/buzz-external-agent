# Changelog

## 0.9.0-beta.1

Pre-release. A TypeScript plugin for Buzz Desktop 1.0.5 replaces the Go placeholder, which
only worked with old Buzz (last Go release: tag `v0.1.1`, see the GitHub releases page).

- Self-hosted agent type with owner and operator roles, Buzz DM protocol, age-sealed keys.
- Bring existing agents into Buzz, retire (also adopted agents) and delete.
- Operator view with Known owners and a shell-quoting command template.
- Generic reference installer, shellchecked and tested under `dash`.
- Release workflow: `selfhosted-agents-<version>.zip` and `SHA256SUMS`.
- Known limitation: publishing a new agent's profile is a stub, so creating new agents does
  not work end to end yet; adopting, retiring and deleting are not yet verified live.

## 0.1.1

- Allow configuration when the OS confirms that a saved local PID has exited,
  including legacy `.pid` files, pair-scoped JSON receipts, and `runtime_pid`.
- Keep blocking live PIDs, permission failures, and unreadable/invalid receipts.
  No processes are killed and no runtime references are deleted.
- Test live-to-exited process transitions on macOS, Linux, and Windows.
- Include the AI-agent installation guide in release archives.

## 0.1.0

- Standalone Go binaries for macOS, Linux, and Windows (ARM64 and x86-64).
- Inert local host and silent ACP model discovery, with no network or tool execution.
- Built-in installation and configuration of existing Buzz identities, with backups.
- Protocol, process lifecycle, installation, and identity preservation tests.
