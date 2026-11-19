# Contributing

Requirements: [Bun](https://bun.sh). For installer tests also `age`, `jq` and `ssh-keygen`
(tests skip with a notice when missing locally; in CI they fail).

```sh
bun install
bunx biome check . && bunx tsc --noEmit && bun test && bun run build
```

- The plugin is one ES module, `dist/plugin/plugin.js`, with no `import` statements. React
  comes only from `ctx.react`; there are no top-level side effects.
- Never store, log or send a plaintext secret key. Only age ciphertext and public data.
- The plugin id, agent type id and runtime tag are frozen after the first release.
- Use synthetic identities in tests; do not attach real keys, stores or environment dumps.
- Keep the project generic: no organisation-specific names, hosts or tools.
- Installer: `shellcheck installer/install-agent-key.sh`, and
  `INSTALLER_SHELL=dash bun test tests/installer.test.ts` checks it under a strict POSIX shell.
- Commits use conventional messages.

Releases: set the version in `package.json` and `CHANGELOG.md`, then push a `v<version>` tag.
CI builds, zips `dist/plugin` as `selfhosted-agents-<version>.zip`, adds `SHA256SUMS` and
publishes a GitHub release (a pre-release when the version contains `-`).
