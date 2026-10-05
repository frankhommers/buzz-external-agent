# Changelog

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
