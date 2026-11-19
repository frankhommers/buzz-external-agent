# Self-hosted agents for Buzz 1.0 — design

Status: draft v2, awaiting owner approval. Date: 2026-11-19.
Reviewed by an independent reviewer (Astra) against the 1.0.5 source; its
findings are incorporated below.

## Why

Buzz Desktop 1.0 (`block/buzz-app`, data dir `xyz.block.buzz.desktop`) replaced
the old app (`block/buzz`, `xyz.block.buzz.app`). The old local launcher
mechanism (custom harness definitions, a per-agent `acp_command` that starts
`buzz-acp`) is gone, so this project's Go placeholder no longer does anything.

The project owner runs agents on their own servers (one agent per server; in
the reference deployment Hermes, installed by Ansible). Two things broke in
1.0:

1. **Existing self-hosted agents are not on the Agents page.** 1.0 lists the
   viewer's kind 30177 records only when they carry a `runtime` tag of the form
   `pluginId/typeId` (`src/features/agents/service.ts:1994`, `listedAgents`
   ~6530). Old Buzz's record writer emitted only `["d", pubkey]`
   (`block/buzz desktop/src-tauri/src/managed_agents/agent_events.rs:113`).
   "Import from old Buzz" is not an option: it makes them local agents that
   Buzz would run on the desktop with the same key as the server.
2. **New agents cannot be created.** An agent needs a NIP-OA attestation signed
   with the owner's key, which lives in Buzz, plus an agent-signed profile.
   Old Buzz did both when creating a local agent; that path is gone.

The plugin is published openly on GitHub, so it must be **generic**: nothing
specific to one organisation, relay, server list or deployment tool may be
hardcoded.

## What Buzz 1.0 offers (verified in 1.0.5 source)

- An installed plugin may register an agent type with a `remote` provider
  (`AgentType.remote: RemoteAgentType`; `register` at `service.ts:3042`, no
  bundled-only restriction). The type key is `pluginId/typeId`. A remote type
  must have `provision`, `activate`, `profile`, `remove` and no `run`,
  `models`, `timeoutMs`. Records whose runtime is a remote type show as
  `place: "hosted"`. A hosted listing never starts a local runner.
  Reference implementation: `src/bundled/builderlab`.
- `ctx.host.prepareRemoteAgentAuthorization(pubkey)` returns the owner's NIP-OA
  tag `["auth", ownerHex, "", sigHex]` (`src/features/host/service.ts:292`).
  This is exactly the shape the reference installer validates.
- Plugins write relay events via `session.outbox` (kind 30177 supported; follow
  `docs/relay-queries.md#managed-agent-registration-kind-30177` and keep the
  prior record's content/tags, as `publishAgentRecord` does,
  `src/features/agents/relay-removal.ts:113`).
- Sessions expose `directMessages.open(pubkeys)` (used by bundled plugins such
  as Bestie). Buzz DMs are relay channels, **not end-to-end encrypted**.
- Packaging: a folder with `manifest.json` + one self-contained ES module
  `plugin.js` (no runtime imports; React via `ctx.react`). Installed via
  Settings → Plugins → Manage plugins → Add → Browse.

Behaviour of the host that constrains this design:

- **Hosted agents are always shown online**, whatever the relay reports
  (`src/features/presence/hosted.ts`, `withHostedAgents`). The plugin cannot
  infer "stopped" from presence.
- **Delete archives first, then calls `remote.remove`** (`service.ts` ~5865).
  If `remove` throws, the agent stays archived/hidden and Buzz shows its own
  error ("may still be running. Delete it again"), not the plugin's message.
- `remote.profile` is awaited before the listing is rewritten; a throw shows
  the plugin's message and leaves the listing unchanged (`service.ts` ~4978).
- Creation: Buzz calls `provision`, saves an "unfinished" setup, gets the owner
  proof, calls `activate`, then publishes the listing. A retry can call
  `activate` without `provision`; a same-name retry can replace the config
  (`service.ts` ~4011, ~4345, ~4393).
- A plugin's own outbox writes do not refresh the Agents page's listing cache
  immediately; it updates on the next session rebind or app restart
  (`service.ts` ~6484, ~7142, ~7317).

## Goals

- Every owner sees their own existing self-hosted agents on the Agents page
  again, with their existing keys, without touching the servers.
- Owners create new agents from Buzz without knowing anything about servers or
  deployment tools.
- One **operator** installs and retires agents on servers with their own tools.
  The plugin hands them everything needed, and nothing more.
- Generic and open source: any self-hosted Buzz agent that takes an nsec and a
  NIP-OA tag (`BUZZ_PRIVATE_KEY` / `BUZZ_AUTH_TAG`) can use it.

## Non-goals

- No server-side service or API; the plugin never contacts servers.
- No remote start/stop of agents from Buzz.
- No support for the old Buzz app; no migration of `managed-agents.json`.
- No Builderlab integration.

## Anti-goals (failure even if it "works")

- An agent nsec in plaintext anywhere outside memory on the owner's desktop:
  no disk, plugin storage, clipboard, logs, relay or DM. (The server's own
  credential file is the installer's business and out of scope.)
- The operator, the relay or anyone but the target server being able to
  decrypt an agent key.
- Buzz on a desktop running an agent with a server's key (double presence).
- An owner believing an agent is deleted while it still runs.
- The plugin showing or adopting another owner's agent.
- A new identity created where an existing one should have been reused.

## Approaches considered

1. **Plugin + operator-run deployment (chosen).** The plugin creates keys,
   attestations and profiles on the owner's desktop and hands sealed artefacts
   to the operator via Buzz DMs; the operator deploys with their own tools.
2. **Full lifecycle from Buzz.** A provisioning service on the server side
   performs deployment. More work, needs authenticated access from the Buzz
   webview, duplicates existing deployment safety checks, and is not generic.
3. **Keep the old placeholder.** Impossible in 1.0.

Owner picked 1 on 2026-11-19, then asked for two roles (owners shouldn't need
deployment knowledge), Buzz DMs as transport, and a generic open-source design.

## Design

### Identity

- Plugin id `io.github.frankhommers.selfhosted-agents`, agent type id `agent`,
  title "Self-hosted agent". The runtime tag
  `io.github.frankhommers.selfhosted-agents/agent` is frozen at first release.
- Repository: this repo. The Go placeholder is retired; the README points old
  Buzz users to the last Go release.
- TypeScript, bundled to one `plugin.js` with inlined crypto: secp256k1
  Schnorr + bech32 (`@noble/curves`, `@scure/base`) and an age encryptor with
  `ssh-ed25519` recipients (e.g. `age-encryption`). Builder may swap libraries.

### Roles

- **Owner**: any Buzz user with the plugin. Sees and manages only agents whose
  attested owner is the signed-in viewer.
- **Operator**: one Buzz identity configured in the plugin settings (operator
  npub). The operator's plugin shows an operator view. The operator can also be
  an owner of their own agents. Configuration is per community.

### Messages (Buzz DMs owner ↔ operator)

All plugin traffic is a 1:1 Buzz DM between owner and operator, with a
machine-readable block (versioned JSON in a fenced code block, plus one human
line so the DM is readable without the plugin). Contents are public data or
age ciphertext only. Types:

| Type | From → to | Contents |
|---|---|---|
| `slot-offer` | operator → owner | slot id, server label, SSH host public key (`ssh-ed25519 …`), community |
| `install-request` | owner → operator | slot id, pubkey, NIP-OA tag, agent name, age ciphertext of the nsec (to the slot's host key) |
| `retire-request` | owner → operator | pubkey, slot id |
| `retired` | operator → owner | pubkey, slot id |
| `installed` | operator → owner | pubkey, slot id (informational) |

The plugin only acts on blocks from the expected counterpart (operator npub
for offers/`retired`; an owner for requests) and validates every field.

### Operator: offering a server ("slot")

The operator provisions a server with their own tools, then in the operator
view adds a slot (label + SSH host public key, pasted or imported as a JSON
list) and assigns it to an owner npub. The plugin sends `slot-offer`.
Host-key authenticity is the operator's responsibility; the README says to take
it from their provisioning tool or `ssh-keyscan` verified against a known
fingerprint, never from an unverified source. Each slot can be offered once;
the operator view tracks state (offered → requested → installed → retired).

### Owner: creating an agent

The owner's plugin lists received slot offers ("A server is ready for you").
"New agent" → type **Self-hosted agent**; its `Create` UI requires choosing an
open offer.

- `provision` (all in memory, then persisted **before returning**):
  1. generate a keypair;
  2. get the owner proof via `ctx.host.prepareRemoteAgentAuthorization(pubkey)`;
  3. sign the agent's kind 0 profile (name, picture, NIP-OA tag) with the
     agent key and publish it — required because the reference installer
     verifies the key with `buzz users get`, which needs a relay profile;
  4. age-encrypt the nsec to the slot's host key; drop the plaintext;
  5. persist `{owner, community, slot id, recipient fingerprint, pubkey,
     ciphertext, signed profile event}` in plugin storage; mark the slot as
     claimed locally;
  6. return `{pubkey, picture}`.
  A repeat call for the same pending setup returns the same pubkey. A retry
  with a different slot or community is refused.
- `activate`: send `install-request` to the operator (idempotent: resend is
  harmless, the operator view deduplicates by pubkey). Resolves once the DM is
  delivered. The agent then shows as hosted; the plugin's tab shows
  "Waiting for installation" until `installed` arrives (presence cannot tell).
- Open technical risk (builder spike first): publishing an event signed by the
  agent key. Try the viewer's outbox with a pre-signed event; if the relay
  refuses it, open a short-lived relay connection authenticated as the agent
  (NIP-42) from the plugin. Test with a key that never had a profile.

### Operator: installing

The operator view lists `install-request`s. Per request: download
`<slot-or-name>.age` (Blob download), copy the public data (pubkey, NIP-OA tag
as JSON array) and, if the operator configured one, a rendered **command
template**, e.g. `ansible-playbook … -e host={host} -e name={name}`
(placeholders: `{name}`, `{slot}`, `{host}`, `{pubkey}`, `{npub}`,
`{auth_tag}`, `{file}`). No template = data only. After deploying, the
operator clicks "Installed", which sends `installed`.

The repo ships a small **generic reference installer** (POSIX shell or Python)
that decrypts the `.age` with the server's SSH host key, verifies the pubkey,
and writes `BUZZ_PRIVATE_KEY` / `BUZZ_AUTH_TAG` / `BUZZ_RELAY_URL` to a given
env file. Organisation-specific automation (the reference deployment's Ansible
playbooks) stays in the operator's own private repository; the README describes
it only as an example pattern.

### Owner: existing agents ("Bring into Buzz")

Settings card lists the viewer's kind 30177 records without a runtime tag
whose agent profile carries a valid NIP-OA tag naming the viewer. For each the
owner may click "Bring into Buzz":

- refuse if the key exists locally in this Buzz (native identity) or the prior
  record names another runtime;
- republish the 30177 record with the runtime tag, keeping all prior content
  and tags (drop `client-id`), never touching keys;
- tell the owner the agent appears after reconnect/restart (cache behaviour).
Agents without a valid attestation are listed as "cannot verify owner" and not
adopted. Distinguish "no record" from "read failed".

### Owner: retiring and deleting

Because hosted agents always look online and Delete archives before asking the
plugin:

- The agent tab offers **Retire**: sends `retire-request` and shows
  "Waiting for the operator". Once `retired` arrives the tab says
  "Stopped by the operator — you can delete it now".
- `remove` succeeds only when `retired` was received for that pubkey; otherwise
  it throws. (Buzz will then have archived the agent and shows its generic
  error; the README and tab explain: Retire first, then Delete again.)
- `remove` never contacts the server.

### Other provider methods

- `profile`: the plugin no longer holds the agent key, so it cannot republish
  kind 0. Throws "Change the name or avatar on the server". (Buzz shows this
  message and keeps the listing.)
- `interrupt`, `instructions`: not in v1.

### New-record defaults

New 30177 records use `respond_to: "anyone"` (everyone may talk to the agent,
matching the reference deployment's policy) and `parallelism: 1`. Builder may
expose this in the Create UI.

### Testing

- Unit: key generation, bech32, age round-trip against a test `ssh-ed25519`
  key with the real `age` CLI, NIP-OA shape, 30177 merge, DM block
  parse/validation, provision idempotency and retry refusal.
- Integration: a separate macOS user account or VM with throwaway owner and
  operator identities on a test community. Not just a dev build on the main
  account: debug builds share a keychain identity
  (`docs/native-mcp.md:9`).
- Live on the reference fleet only after owner approval: adopt one of the
  owner's own existing agents first; new-agent flow on the first fresh server.

## Decisions taken by the owner

- Ansible/operator stays authoritative for servers (approach 1).
- Delete must remain possible (not a permanent refusal).
- Owners must not need deployment knowledge; an operator handles servers.
- Transport via Buzz itself; generic, publishable design.

## Calls made by the designer (check these)

- Operator offers servers first ("slot" flow); owners cannot request a server
  out of the blue (keeps the key sealed to a known server from the start).
- `respond_to: "anyone"` default.
- Profile rename refused rather than listing-only alias.
- Plugin id and runtime name above.

## Left to the builder

Library choice, bundler, UI layout, DM block format details, storage layout
(no plaintext secrets), operator-view UX, reference installer language.

## Related work (separate)

`frankhommers/buzz-cli-builds` PR #1 repins `upstream.json` to
`block/buzz@630922a9e1f891380a61f5b7d726d05ca948cc64`, the CLI bundled in
Buzz Desktop 1.0.5. Fleet rollout afterwards needs the installer's version
and checksum pins updated as well.
