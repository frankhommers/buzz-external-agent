# Self-hosted Agents Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Buzz Desktop 1.0 plugin that registers a hosted ("remote") agent type so owners see and create self-hosted agents, while an operator deploys them with their own tools.

**Architecture:** Pure, unit-tested core modules (keys, NIP-OA, age sealing, events, DM protocol, state) with no Buzz dependency; a thin adapter layer over the plugin `ctx` (relay session, DMs, host authorization); React UI built with `ctx.react` (no JSX runtime). Bundled by Bun into one self-contained `plugin.js`.

**Tech Stack:** TypeScript (strict), Bun (build + `bun test`), Biome, Zod, `@noble/curves` + `@noble/hashes` (secp256k1/Schnorr, SHA-256), `@scure/base` (bech32), `age-encryption` (typage; `ssh-ed25519` recipients). Reference installer: POSIX `sh` + `age` + `jq`.

**Spec:** `docs/superpowers/specs/2026-11-19-selfhosted-agents-design.md` (read it first; the plan argues from it).

## Global Constraints

- Plugin id `io.github.frankhommers.selfhosted-agents`; agent type id `agent`; title `Self-hosted agent`; runtime tag value `io.github.frankhommers.selfhosted-agents/agent`. Frozen after first release.
- Manifest: `apiVersion: 1`; only keys `id`, `name`, `apiVersion`, `description` (≤280 bytes), `discovery`, `host`. No `host` grants unless Task 8 proves one is required.
- `dist/plugin/plugin.js` is one ES module exporting `inject` and `apply`, with **no** `import`/`import(` statements; React only via `ctx.react`; no top-level side effects.
- Target: Buzz Desktop 1.0.5 (`block/buzz-app` tag `desktop-v1.0.5`). Reference source checkout for API questions: `block/buzz-app@desktop-v1.0.5`.
- Never store/log/send a plaintext nsec or secret key: not in `localStorage`, DMs, relay events, clipboard, console, errors. Only age ciphertext and public data are persisted or sent.
- New kind 30177 records: content defaults `{"parallelism": 1, "respond_to": "anyone"}`; tags `["d", <agentPubkey>]`, `["runtime", "io.github.frankhommers.selfhosted-agents/agent"]`. Replacements keep all prior content keys and tags except `d`, `runtime`, `client-id`.
- NIP-OA tag shape `["auth", ownerHex, conditions, sigHex]`; signed message `SHA256("nostr:agent-auth:" + agentPubkey + ":" + conditions)`; BIP-340 Schnorr; owner ≠ agent; conditions grammar per NIP-OA (`kind=`, `created_at<`, `created_at>`, joined by `&`).
- age recipients: `ssh-ed25519` only; anything else is rejected.
- DM protocol blocks: a fenced code block with info string `selfhosted-agents` containing JSON with `"v": 1` and `"type"` ∈ `slot-offer | install-request | retire-request | retired | installed`, preceded by one human-readable line.
- Plugin storage: `localStorage` keys prefixed `io.github.frankhommers.selfhosted-agents:v1:` and scoped by community origin + viewer pubkey.
- TypeScript strict per repo standards (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.); 2-space indent, single quotes, no semicolons (Biome).
- Commits: conventional messages; no co-author or AI attribution lines.

## Review Focus

- An agent key that already exists as a **local** identity in this Buzz → "Bring into Buzz" refuses (no double presence). Test in Task 10.
- A DM block from someone other than the expected counterpart, or with a malformed/oversized field → ignored, never acted on. Test in Task 5.
- `provision` retried after a crash: same pending setup → same pubkey; changed slot or community → refused. Test in Task 9.
- A pasted host key that is not `ssh-ed25519` (RSA, ECDSA, garbage, trailing whitespace) → rejected with a clear message; valid key with comment → accepted. Test in Task 3.
- Reading the owner's records fails (network) vs. returns nothing → adoption shows "could not read", never "no agents"; never publishes on a failed read. Test in Task 7.

---

## File Structure

```
manifest.json                      — plugin manifest (copied to dist)
package.json, tsconfig.json, biome.json, bunfig.toml
scripts/build.ts                   — bundle + copy manifest + no-import check
src/plugin.ts                      — export inject/apply; wiring only
src/constants.ts                   — ids, runtime tag, storage prefix
src/core/keys.ts                   — key generation, hex/bech32
src/core/nipoa.ts                  — NIP-OA parse/verify
src/core/seal.ts                   — ssh-ed25519 host key parse, age seal
src/core/events.ts                 — agent profile event, 30177 record builders
src/core/messages.ts               — DM block encode/parse (zod)
src/core/template.ts               — operator command template rendering
src/core/store.ts                  — persistent plugin state over Storage
src/buzz/relay.ts                  — adapter over ctx.relay session (read/publish/DM)
src/buzz/provider.ts               — RemoteAgentType implementation
src/ui/*.ts                        — React components via ctx.react
installer/install-agent-key.sh     — generic reference installer
tests/**                           — bun tests mirroring src
```

Remove: `*.go`, `go.mod`, `tools/`, `AGENT-INSTALL.md` (Go-specific). Keep `LICENSE`, `CONTRIBUTING.md` (rewrite), `CHANGELOG.md` (append).

---

### Task 1: Toolchain, manifest and build

**Files:**
- Delete: `main.go`, `main_test.go`, `setup.go`, `runtime_check.go`, `runtime_check_test.go`, `process_unix.go`, `process_windows.go`, `go.mod`, `tools/`, `AGENT-INSTALL.md`
- Create: `package.json`, `tsconfig.json`, `biome.json`, `manifest.json`, `scripts/build.ts`, `src/constants.ts`, `src/plugin.ts`, `tests/build.test.ts`
- Modify: `.gitignore` (add `node_modules/`, `dist/`), `.github/workflows/ci.yml` (Bun: install, `biome check`, `tsc --noEmit`, `bun test`, `bun run build`)

**Interfaces:**
- Produces: `src/constants.ts` exports `PLUGIN_ID`, `TYPE_ID = 'agent'`, `RUNTIME = \`${PLUGIN_ID}/agent\``, `STORAGE_PREFIX = \`${PLUGIN_ID}:v1:\``, `BLOCK_INFO = 'selfhosted-agents'`, `BUZZ_TARGET = '1.0.5'`.
- Produces: `src/plugin.ts` exports `inject: readonly string[]` and `apply(ctx: PluginCtx): void`, where `PluginCtx` is a local structural type (Task 7 extends it). Initially `inject = ['react']` and `apply` does nothing.
- Produces: `bun run build` → `dist/plugin/plugin.js` + `dist/plugin/manifest.json`.

- [ ] **Step 1: Write failing test `tests/build.test.ts`**: runs `bun run build`; asserts `dist/plugin/manifest.json` deep-equals root `manifest.json`; manifest has exactly allowed keys, `apiVersion === 1`, `id === PLUGIN_ID`, description ≤ 280 bytes; `plugin.js` source matches neither `/^\s*import\s/m` nor `/\bimport\s*\(/`; dynamic `import()` of the file yields `inject` (array) and `apply` (function).
- [ ] **Step 2: Run `bun test tests/build.test.ts`** — expected FAIL (no build script).
- [ ] **Step 3: Implement** the files above. `scripts/build.ts` uses `Bun.build({ entrypoints: ['src/plugin.ts'], format: 'esm', target: 'browser', minify: false, splitting: false })`, writes output, copies manifest, and fails if an import statement survives. Manifest `name: "Self-hosted agents"`, `description` one sentence, `discovery: { category: "agents", tags: ["self-hosted", "agents"] }`.
- [ ] **Step 4: Run `bun test && bunx biome check . && bunx tsc --noEmit`** — expected PASS.
- [ ] **Step 5: Commit** `build: replace Go placeholder with Buzz 1.0 plugin scaffold`.

### Task 2: Keys and NIP-OA

**Files:** Create `src/core/keys.ts`, `src/core/nipoa.ts`, `tests/core/keys.test.ts`, `tests/core/nipoa.test.ts`

**Interfaces:**
- Produces: `generateSecretKey(): Uint8Array` (32 bytes, valid secp256k1 scalar); `publicKeyHex(secret: Uint8Array): string` (x-only, 64 lowercase hex); `encodeNsec(secret): string`; `encodeNpub(pubHex): string`; `decodeNpub(npub): string` (throws on bad checksum/prefix); `isHex64(s): boolean`.
- Produces: `type NipOaTag = readonly ['auth', string, string, string]`; `parseNipOaTag(value: unknown): NipOaTag | undefined` (shape + grammar only); `verifyNipOa(tag: NipOaTag, agentPubkey: string): boolean` (signature, owner ≠ agent, conditions grammar); `signNipOaForTests(ownerSecret, agentPubkey, conditions = ''): NipOaTag` (exported from the test helper file `tests/helpers/nipoa.ts`, not from src).

- [ ] **Step 1: Write failing tests**: npub/nsec round-trip against a NIP-19 test vector (`npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg` ↔ `7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e`); `generateSecretKey` returns 32 bytes and two calls differ; `verifyNipOa` true for a tag signed with empty conditions and with `kind=0&created_at<4294967295`; false for: tampered sig, different agent pubkey, owner == agent, conditions `kind=01`, `&kind=0`, `kind=0&&kind=1`, `kind=65536`, `foo=1`, whitespace; `parseNipOaTag` rejects 3- or 5-element arrays and uppercase hex.
- [ ] **Step 2: Run `bun test tests/core`** — expected FAIL.
- [ ] **Step 3: Implement** with `@noble/curves/secp256k1` (`schnorr`), `@noble/hashes/sha256`, `@scure/base` (`bech32`).
- [ ] **Step 4: Run `bun test tests/core`** — expected PASS.
- [ ] **Step 5: Commit** `feat(core): agent keys and NIP-OA verification`.

### Task 3: Host keys and age sealing

**Files:** Create `src/core/seal.ts`, `tests/core/seal.test.ts`

**Interfaces:**
- Produces: `type HostKey = { line: string; fingerprint: string }` (`fingerprint` = OpenSSH `SHA256:<base64-nopad>` of the key blob); `parseHostKey(text: string): HostKey` (accepts `ssh-ed25519 <b64> [comment]`, trims; throws `Error('Only ssh-ed25519 host keys are supported')` for other types, `Error('Not a valid SSH public key')` for malformed blobs); `sealSecret(secret: Uint8Array, host: HostKey): Promise<string>` returning ASCII-armored age (`-----BEGIN AGE ENCRYPTED FILE-----`) whose plaintext is the `nsec1…` string plus `\n`.

- [ ] **Step 1: Write failing tests**: valid key with comment parses and fingerprint equals `ssh-keygen -lf` output for a fixture key generated in the test (`ssh-keygen -t ed25519 -N '' -f <tmp>/k`); RSA/ECDSA/garbage/empty rejected with the messages above; `sealSecret` output decrypts with the real CLI `age -d -i <tmp>/k` to exactly `encodeNsec(secret)`. Skip the CLI round-trip with a clear message only if `age` is not on PATH (CI installs it).
- [ ] **Step 2: Run `bun test tests/core/seal.test.ts`** — expected FAIL.
- [ ] **Step 3: Implement** with `age-encryption` (`Encrypter.addRecipient` with the ssh-ed25519 line; armor). Zero the nsec string reference after use where possible; never log it.
- [ ] **Step 4: Run** — expected PASS. Add `brew/apt install age` to CI.
- [ ] **Step 5: Commit** `feat(core): seal agent keys to ssh-ed25519 host keys`.

### Task 4: Agent profile and 30177 records

**Files:** Create `src/core/events.ts`, `tests/core/events.test.ts`

**Interfaces:**
- Consumes: Task 2 key/NIP-OA functions.
- Produces: `type SignedEvent = { id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string }`; `buildAgentProfile(input: { secret: Uint8Array; name: string; picture?: string; auth: NipOaTag; createdAt: number }): SignedEvent` (kind 0, content JSON `{name, display_name, picture?, bot: true}`, tags `[auth]`); `verifyEvent(e: SignedEvent): boolean`; `profileOwner(e: SignedEvent): string | undefined` (owner hex when the event has exactly one valid `auth` tag satisfying its conditions); `type AgentRecord = { content: Record<string, unknown>; tags: string[][] }`; `newAgentRecord(i: { pubkey; name; picture? }): AgentRecord`; `mergeAgentRecord(prior: AgentRecord, i: { pubkey; name; picture? }): AgentRecord`; `recordRuntime(tags): string | undefined`.

- [ ] **Step 1: Write failing tests**: profile event verifies, has kind 0 and exactly one `auth` tag, `profileOwner` returns the owner; two `auth` tags → `profileOwner` undefined; `newAgentRecord` content equals `{parallelism: 1, respond_to: 'anyone', name}` and tags equal `[['d', pk], ['runtime', RUNTIME]]`; `mergeAgentRecord` keeps unknown content keys and extra tags, replaces `d`/`runtime`, drops `client-id`, drops an empty-string `picture`, keeps prior `respond_to`.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** (NIP-01 id = sha256 of the serialized array; Schnorr sign).
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `feat(core): agent profile and registration records`.

### Task 5: DM protocol and command template

**Files:** Create `src/core/messages.ts`, `src/core/template.ts`, `tests/core/messages.test.ts`, `tests/core/template.test.ts`

**Interfaces:**
- Produces: zod-backed union `type Block = SlotOffer | InstallRequest | RetireRequest | Retired | Installed` with fields:
  - `SlotOffer { v: 1; type: 'slot-offer'; slot: string; label: string; hostKey: string; community: string }`
  - `InstallRequest { v: 1; type: 'install-request'; slot: string; pubkey: string; name: string; auth: NipOaTag; sealed: string }`
  - `RetireRequest { v: 1; type: 'retire-request'; slot: string; pubkey: string }`
  - `Retired`/`Installed { v: 1; type: 'retired' | 'installed'; slot: string; pubkey: string }`
  - `slot`: `/^[a-z0-9][a-z0-9-]{0,62}$/`; `label` ≤ 80 chars; `name` 1–80 chars; `sealed` must start with the age armor header and be ≤ 4096 bytes; `community` a `wss://` URL.
- Produces: `encodeBlock(b: Block): string` (`<human line>\n\n\`\`\`selfhosted-agents\n<json>\n\`\`\``); `parseBlocks(text: string): Block[]` (ignores invalid blocks); `acceptBlock(b: Block, sender: string, ctx: { operator: string; viewer: string }): boolean` (offer/retired/installed only from operator to viewer; requests only when viewer is operator).
- Produces: `renderTemplate(template: string, vars: Record<'name'|'slot'|'host'|'pubkey'|'npub'|'auth_tag'|'file', string>): string`; unknown `{placeholder}` throws `Error('Unknown placeholder {x}')`; values are inserted verbatim (operator-owned template).

- [ ] **Step 1: Write failing tests**: encode→parse round-trip per type; a block containing `nsec1` anywhere is rejected by `parseBlocks` and `encodeBlock` throws; wrong `v`, extra keys, bad slot id, non-armored `sealed`, 5 KB `sealed` → ignored; `acceptBlock` false for an offer from a non-operator and for a request when viewer ≠ operator; template renders all placeholders and throws on `{oops}`.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `feat(core): owner/operator DM protocol`.

### Task 6: Plugin state store

**Files:** Create `src/core/store.ts`, `tests/core/store.test.ts`

**Interfaces:**
- Produces: `createStore(storage: Storage, scope: { origin: string; viewer: string }): Store` with
  - `settings(): { operator?: string; template?: string }`, `setSettings(s)`
  - owner side: `offers(): SlotOffer[]`, `addOffer(o)`, `pending(): PendingSetup[]`, `putPending(p: PendingSetup)`, `pendingFor(slot): PendingSetup | undefined`, `markInstalled(pubkey)`, `markRetired(pubkey)`, `isRetired(pubkey): boolean`, `statusOf(pubkey): 'awaiting-install' | 'installed' | 'retire-requested' | 'retired' | undefined`, `setStatus(pubkey, status)`
  - operator side: `slots(): OperatorSlot[]`, `putSlot(s)`, `requests(): InstallRequest[]`, `addRequest(r)` (dedupe by pubkey)
  - `type PendingSetup = { slot: string; community: string; owner: string; hostFingerprint: string; pubkey: string; sealed: string; profile: SignedEvent; name: string; picture?: string }`
  - `type OperatorSlot = { slot: string; label: string; host: HostKey; owner?: string; state: 'open' | 'offered' | 'requested' | 'installed' | 'retired' }`
- All writes go through one `write(key, value)` that throws `Error('Refusing to store secret material')` if the serialized value matches `/nsec1[02-9ac-hj-np-z]{20,}/`.

- [ ] **Step 1: Write failing tests** with an in-memory `Storage`: keys are prefixed with `STORAGE_PREFIX` and differ per scope; `addRequest` dedupes; secret guard throws; corrupt JSON in storage reads as empty, not crash.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `feat(core): namespaced plugin state without secrets`.

### Task 7: Buzz relay adapter

**Files:** Create `src/buzz/relay.ts`, `src/buzz/types.ts`, `tests/buzz/relay.test.ts`, `tests/helpers/fake-session.ts`

**Interfaces:**
- Produces in `types.ts`: minimal structural types for the parts of the 1.0.5 API used (`RelaySnapshot`, `RelaySession.read/outbox/directMessages`, `Host.prepareRemoteAgentAuthorization`). Copy shapes from `block/buzz-app@desktop-v1.0.5` `src/features/relay/service.ts`, `src/features/relay/direct-messages.ts`, `src/features/host/service.ts`; cite file:line in comments.
- Produces: `createRelay(ctx: PluginCtx): Relay` with
  - `ready(): Promise<{ origin: string; viewer: string; community: string }>` (current ready snapshot; throws if none)
  - `readOwnRecords(): Promise<{ ok: true; records: Map<string, AgentRecord> } | { ok: false; error: string }>` (kind 30177 by viewer, newest per `d`)
  - `readProfile(pubkey): Promise<SignedEvent | undefined>` (kind 0, newest; verified)
  - `publishRecord(record: AgentRecord): Promise<void>` (requires `outbox.supports(30177)`, awaits delivery)
  - `publishSigned(event: SignedEvent): Promise<void>` (foreign-signed event; Task 8 decides the path)
  - `sendBlock(to: string, block: Block): Promise<void>` (opens 1:1 DM via `directMessages.open([to])`, sends `encodeBlock`)
  - `readBlocks(withPubkey: string): Promise<Array<{ sender: string; block: Block }>>`
  - `isLocalIdentity(pubkey): boolean` (via the agents service snapshot: an agent with `place === 'here'` and this pubkey)

- [ ] **Step 1: Write failing tests** against `fake-session.ts`: `readOwnRecords` picks newest per `d`; a rejected read returns `{ ok: false }` (Review Focus); `publishRecord` throws when 30177 unsupported; `sendBlock` refuses blocks containing `nsec1` (delegates to Task 5); `readBlocks` returns only parseable blocks with sender pubkeys.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `feat(buzz): relay, record and DM adapter`.

### Task 8: Live check of host paths (checkpoint with the owner)

Needs a separate macOS user account or VM with Buzz 1.0.5 and two throwaway identities (owner, operator) on a test community. **Ask the owner to provide it; do not use their daily Buzz.**

**Files:** Create `docs/verification/2026-xx-xx-host-paths.md` (findings); adjust `src/buzz/relay.ts` and `manifest.json` per findings.

- [ ] **Step 1:** Build and install `dist/plugin` via Settings → Plugins → Add → Browse in the test account; confirm the plugin activates (`plugin_status` or Settings shows no error).
- [ ] **Step 2:** From a temporary debug settings card, verify each in turn and record the result: `ctx.relay.snapshot()` shape; `outbox.supports(30177)`; `directMessages.open([operator])` + send; `ctx.host.prepareRemoteAgentAuthorization(pubkey)` returns a tag that `verifyNipOa` accepts; whether `manifest.host` grants are needed for any of these.
- [ ] **Step 3:** Publish a freshly generated agent's kind 0 (Task 4) via the viewer outbox; then `buzz users get` with that key (test CLI, env-only key) must return it. If the relay rejects or drops it, implement `publishSigned` as a short-lived WebSocket authenticated as the agent (NIP-42) and re-run this step.
- [ ] **Step 4:** Remove the debug card; commit `fix(buzz): align adapter with Buzz 1.0.5 host behavior` with the findings document.

### Task 9: Remote agent provider and registration

**Files:** Create `src/buzz/provider.ts`, `tests/buzz/provider.test.ts`; Modify `src/plugin.ts` (inject `react`, `agents`, `relay`, `host`, `settingsCards`; register type)

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces: `createProvider(deps: { relay: Relay; store: Store; host: { prepareRemoteAgentAuthorization(pk: string, signal?: AbortSignal): Promise<NipOaTag> }; now(): number }): RemoteAgentType` and `agentType(deps): AgentType` with `id: TYPE_ID`, `title: 'Self-hosted agent'`, `defaults: () => ({ config: { slot: '' } })`, `remote`, `CreateConfiguration` (Task 11), `summary`.
- Behaviour (spec "New agent", "Retiring and deleting", "Other provider methods"):
  - `provision({ name, picture, community, config })`: require `config.slot` matching an unclaimed offer for this community; if `pendingFor(slot)` exists with same community → return its pubkey; with different community/host → throw `Error('This server is already being set up for another agent')`. Else generate key → authorization → `buildAgentProfile` → `publishSigned` → `sealSecret` → `putPending` → return `{ pubkey, picture }`.
  - `activate({ pubkey })`: find pending by pubkey; `sendBlock(operator, install-request)`; `setStatus(pubkey, 'awaiting-install')`.
  - `profile()`: throw `Error('Change the name or avatar on the server; this agent's key is not held in Buzz')`.
  - `remove({ pubkey })`: if `isRetired(pubkey)` resolve; else throw `Error('Retire this agent first, then delete it again')`.
  - No operator configured → `provision` throws `Error('Set the operator in Settings → Self-hosted agents first')`.

- [ ] **Step 1: Write failing tests** with fakes: happy path calls authorization, publishes a verified profile owned by the viewer, stores ciphertext (no `nsec1` in storage), returns pubkey; second `provision` same slot → same pubkey, no new key; changed community → throws (Review Focus); `activate` sends exactly one `install-request` to the operator; `remove` throws before `retired` and resolves after `markRetired`; `profile` throws the message above; registration object passes the 1.0.5 rule (has provision/activate/profile/remove; no `run`/`models`/`timeoutMs`).
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** and wire `apply` (`ctx.agents.register(agentType(deps))`).
- [ ] **Step 4: Run `bun test && bun run build`** — expected PASS.
- [ ] **Step 5: Commit** `feat: hosted self-hosted-agent type`.

### Task 10: Owner settings card

**Files:** Create `src/ui/OwnerCard.ts`, `src/buzz/adopt.ts`, `tests/buzz/adopt.test.ts`; Modify `src/plugin.ts`

**Interfaces:**
- Produces: `findAdoptable(relay): Promise<{ ok: true; items: Adoptable[] } | { ok: false; error: string }>` with `type Adoptable = { pubkey: string; name: string; state: 'ready' | 'unverified-owner' | 'local-key' | 'other-runtime' | 'already' }`; `adopt(relay, pubkey): Promise<void>` (refuses unless state is `ready`; publishes `mergeAgentRecord`).
- UI (settings card `owner`, title `Self-hosted agents`): operator npub field (validated with `decodeNpub`); list of offers with "Use in New agent" hint; "Bring into Buzz" list with per-state text; per-agent Retire button (sends `retire-request`, `setStatus('retire-requested')`) and status line; after adoption: "It appears on the Agents page after Buzz reconnects or restarts."; a background `ctx.effect` that polls the operator DM every 60 s while the card or app is active and applies `slot-offer`/`installed`/`retired` blocks accepted by `acceptBlock`.

- [ ] **Step 1: Write failing tests** for `findAdoptable`/`adopt`: local key → `local-key` and `adopt` throws (Review Focus); record with other runtime → `other-runtime`; profile without valid owner auth or owned by someone else → `unverified-owner`; already our runtime → `already`; failed read → `{ ok: false }` and no publish.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** logic and card (React via `ctx.react.createElement`, host classes such as `ui-card`).
- [ ] **Step 4: Run tests + build**; manual check in the Task 8 environment: adopt a test agent and see it as hosted after reconnect.
- [ ] **Step 5: Commit** `feat: owner settings — adopt, offers, retire`.

### Task 11: Create configuration and agent status tab

**Files:** Create `src/ui/CreateConfiguration.ts`, `src/ui/StatusTab.ts`; Modify `src/buzz/provider.ts`, `src/plugin.ts`

**Interfaces:**
- Consumes: `AgentCreateProps<Config>` + `harnessControl`, `onReadyChange` from 1.0.5 `AgentType.CreateConfiguration` (`src/features/agents/service.ts` ~1000); `ctx.agents.registerTab({ id: 'status', title: 'Server', component, when })`.
- Behaviour: Create shows the open offers for the selected community as a single-choice list (label + slot); `onReadyChange(true)` only when one is chosen; with no offers: "No server is ready for you yet. Ask your operator." Status tab (`when: agent.type === RUNTIME`) shows `statusOf(pubkey)` in plain words and the Retire button.

- [ ] **Step 1: Write a render test** with a minimal React test renderer (bun + `react-dom/server` `renderToStaticMarkup`): no offers → message above and not ready; one offer → listed.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + build**; manual: create a test agent end to end up to "awaiting install".
- [ ] **Step 5: Commit** `feat: server picker and status tab`.

### Task 12: Operator settings card

**Files:** Create `src/ui/OperatorCard.ts`, `src/buzz/operator.ts`, `tests/buzz/operator.test.ts`; Modify `src/plugin.ts`

**Interfaces:**
- Produces: `offerSlot(relay, store, i: { slot; label; hostKeyText; owner: string /* npub */ }): Promise<void>` (parses host key, stores slot, sends `slot-offer`); `importSlots(text: string): OperatorSlot[]` (JSON array of `{slot,label,hostKey}`); `handoff(request: InstallRequest, slot: OperatorSlot, template?: string): { filename: string; fileText: string; publicJson: string; command?: string }` (`filename = \`${slot.slot}.age\``; `publicJson` = `{name, host: slot.label, pubkey, auth_tag}`); `confirm(relay, store, kind: 'installed' | 'retired', pubkey)`.
- UI (card `operator`, shown only when viewer = configured operator): slots table with state; add/import slots; offer to owner npub; install requests with Download (`Blob` + temporary `<a download>`), Copy public data, rendered command, "Installed" button; retire requests with "Retired" button; template field with placeholder help.

- [ ] **Step 1: Write failing tests**: `handoff` filename/public JSON exact; command rendered when template set, absent otherwise; `offerSlot` rejects non-ed25519 keys; `importSlots` rejects duplicate slot ids; `confirm` sends the right block and updates slot state.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + build**; manual in Task 8 environment: full flow offer → create → request → download → `age -d` with the test host key yields the nsec → Installed → owner sees "installed"; Retire → Retired → owner Delete succeeds.
- [ ] **Step 5: Commit** `feat: operator settings — slots, requests, handoff`.

### Task 13: Reference installer

**Files:** Create `installer/install-agent-key.sh`, `tests/installer.test.ts`

**Interfaces:**
- CLI: `install-agent-key.sh --sealed FILE --pubkey HEX --auth-tag JSON --relay URL --env-file PATH [--host-key /etc/ssh/ssh_host_ed25519_key] [--buzz PATH]`. Decrypts with `age -d -i <host-key>`, checks the nsec format, verifies the key with `buzz users get` (env `BUZZ_PRIVATE_KEY`, never argv) equals `--pubkey`, validates the auth tag shape, backs up then atomically rewrites `BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, `BUZZ_AUTH_TAG` in the env file (mode 0600), deletes the sealed file, prints non-secret JSON `{ok, pubkey, backup}`. Must not print the nsec on any path.

- [ ] **Step 1: Write failing test** (temp dir, generated ed25519 host key, a fake `buzz` script echoing a chosen pubkey): success writes the three keys and keeps unrelated lines; pubkey mismatch exits non-zero and leaves the env file unchanged; stdout/stderr never contain `nsec1`.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** (POSIX sh, `set -eu`, `umask 077`).
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `feat: generic reference installer`.

### Task 14: Documentation and release

**Files:** Rewrite `README.md`, `CONTRIBUTING.md`; append `CHANGELOG.md` (`## 1.0.0`); Create `docs/operator-guide.md`, `docs/owner-guide.md`; Modify CI to attach `selfhosted-agents-<version>.zip` (contents of `dist/plugin`) + `SHA256SUMS` on tags.

- [ ] **Step 1:** README: what it is (generic), who it is for, requirements (Buzz Desktop 1.0.5 tested; plugin API is new), install (Settings → Plugins → Add → Browse), roles, flows, security model (what is encrypted for whom, DMs are not E2E, host-key verification is the operator's job), limits (no rename from Buzz, Retire before Delete, hosted agents always look online), the reference installer, an Ansible example pattern **without** organisation names/hosts, and a pointer to the last Go release for old Buzz.
- [ ] **Step 2:** Verify no organisation-specific strings: `git grep -niwE '<your organisation, host and agent names>'` returns nothing outside the CHANGELOG history note.
- [ ] **Step 3:** Run full suite: `bunx biome check . && bunx tsc --noEmit && bun test && bun run build` — all PASS.
- [ ] **Step 4: Commit** `docs: README and guides for 1.0.0`. Do not tag or push without the owner's go-ahead.
