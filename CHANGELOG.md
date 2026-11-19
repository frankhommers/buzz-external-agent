# Changelog

## 1.0.1

- Install from GitHub: in Buzz, add repository `frankhommers/buzz-external-agent` with branch
  `release`. That branch holds only the built plugin of the latest stable version, and the
  manifest opts in to Buzz's update checks, so Buzz offers **Update and reload** for new
  versions instead of a delete and re-add.
- No functional changes.

## 1.0.0

First stable release, for Buzz Desktop 1.0.5 and newer.

- Verified live end to end on Buzz Desktop 1.0.5 and 1.0.6 (Linux), including a relay with
  closed membership: offer a server, create an agent, install its key with the reference
  installer, Installed, Retire, Retired, Delete; bring an existing agent into Buzz, retire and
  delete it. Delete before Retire is refused.
- No functional changes since 0.9.0-beta.2.
- Known limitations: hosted agents always look online; Retire before Delete; if Delete is
  refused right after Retired while Buzz is reconnecting, try Delete again; Cancel retire
  request only cancels locally; an agent brought into Buzz appears on the Agents page after
  Buzz reconnects or restarts; updating the plugin means removing it and adding the new zip.

## 0.9.0-beta.2

Pre-release. The full flow was verified live on Buzz Desktop 1.0.5 (Linux) against a test
relay: offer, create, install with the reference installer, Installed, Retire, Retired,
Delete; bring an existing agent into Buzz, retire and delete it; Delete before Retire is
refused.

- Creating new agents works: the agent profile is published signed by the agent over the
  plugin's own connection, signed in as the agent (NIP-42).
- The operator settings card is listed only for the community's operator, titled
  "Self-hosted agents — operator".
- Cards, the create picker and the Server tab are styled with Buzz design tokens: labelled,
  bordered inputs, host-style buttons, a readable servers table and red error lines.
- Delivered DMs are dismissed from the Buzz outbox, which caps pending entries.
- A failure to sign the agent sign-in now fails cleanly; relay text in errors is capped at
  200 characters without control characters.
- `scripts/legacy-record.ts`: test-only tool that publishes an old-Buzz-style agent record.
- Creating an agent while an earlier create for the same server is still publishing joins
  that create (same name) or is refused (other name), so it can no longer leave Buzz with an
  agent that cannot be activated or deleted. A create whose setup changed meanwhile fails.
- A retried create reads the agent profile fresh from the relay, so a stale read cannot
  discard a published key.
- A sent agent whose profile was never published now asks to retire it, not remove it.
- Activate and Delete wait up to 5 seconds for Buzz to finish reconnecting instead of
  failing at once.
- Known limitations: hosted agents always look online; Retire before Delete; if Delete is
  refused right after Retired while Buzz is reconnecting, try Delete again; Cancel retire
  request only cancels locally; updating the plugin on Buzz 1.0.5 means delete and add again.

## 0.9.0-beta.1

Pre-release. A TypeScript plugin for Buzz Desktop 1.0.5 replaces the Go placeholder, which
only worked with old Buzz.

- Self-hosted agent type with owner and operator roles, Buzz DM protocol, age-sealed keys.
- Bring existing agents into Buzz, retire (also adopted agents) and delete.
- Operator view with Known owners and a shell-quoting command template.
- Generic reference installer, shellchecked and tested under `dash`.
- Release workflow: `selfhosted-agents-<version>.zip` and `SHA256SUMS`.
- Known limitation: publishing a new agent's profile is a stub, so creating new agents does
  not work end to end yet; adopting, retiring and deleting are not yet verified live (fixed
  in 0.9.0-beta.2).

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
