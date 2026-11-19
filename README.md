# Self-hosted agents for Buzz

A [Buzz Desktop](https://github.com/block/buzz-app) plugin that lists, creates and
retires agents running on your own servers.

> **1.0.0.** Requires Buzz Desktop 1.0.5 or newer. The full flow (offer, create, install,
> retire, delete, and bringing an existing agent into Buzz) was verified live on Buzz Desktop
> 1.0.5 and 1.0.6 (Linux). See [Known limitations](#known-limitations).

## Who it is for

- **Owners**: Buzz users who want agents that run on a server instead of their desktop.
  Owners need no deployment knowledge.
- **Operators**: the one person who provisions and maintains the servers with their own
  tools (Ansible, scripts, anything). The plugin hands the operator what they need.

Any agent that reads `BUZZ_PRIVATE_KEY` and `BUZZ_AUTH_TAG` (and `BUZZ_RELAY_URL`) from
its environment can be used. The plugin never contacts a server itself.

## Requirements

- Buzz Desktop **1.0.5** (tested target). The plugin API is new; later versions may differ.
- For the reference installer on a server: `age`, `jq` and the `buzz` CLI.

## Install

In Buzz: **Settings → Plugins → Manage plugins → Add**, then under _Git or GitHub repository_
enter `frankhommers/buzz-external-agent`, set _Branch or tag_ to `release`, and choose **Find**.
Install the plugin it finds and enable it.

The `release` branch holds only the built plugin of the latest stable version. Buzz checks it
for updates at startup and every hour and offers **Update and reload**; no reinstall needed.

Without Git access: download `selfhosted-agents-<version>.zip` and `SHA256SUMS` from
[Releases](https://github.com/frankhommers/buzz-external-agent/releases), verify the checksum,
unzip it and add the folder with **Browse**. A folder install does not update itself.

Or build it: `bun install && bun run build`, then add `dist/plugin`.

## Roles and flows

- **Setup**: the owner opens Settings → Self-hosted agents and pastes the operator's npub.
  The operator pastes their own npub as Operator in Settings → Self-hosted agents to get the
  operator view, Settings → "Self-hosted agents — operator" (listed only for the operator).
- **Offer**: the operator adds a server (slot id, label, SSH host public key) and offers
  it to an owner. The owner sees it under "Servers offered to you".
- **Create** (owner): New agent, type **Self-hosted agent**, choose an offered server. The
  plugin generates the key in memory, gets the owner proof from Buzz, seals the key to the
  server's host key, publishes the agent profile signed by the agent over the plugin's own
  connection (signed in as the agent, NIP-42) and sends an install request to the operator.
- **Install** (operator): download the `.age` file, copy the public data or the rendered
  command, deploy, then click **Installed**. See [the operator guide](docs/operator-guide.md).
- **Bring into Buzz** (owner): an agent you already run elsewhere is listed as hosted
  again, keeping its key. It appears after Buzz reconnects or restarts. An agent another
  runtime manages (for example after Buzz's own import) can be taken over, once its key is
  not held in this Buzz.
- **Retire and delete** (owner): Retire asks the operator to stop the agent; once they
  confirm, delete it. See [the owner guide](docs/owner-guide.md).

When the operator is also an owner, offers, requests and confirmations are handled locally;
no message is sent to yourself.

## Security model

- The agent's secret key exists in plaintext only in memory on the owner's desktop while it
  is created. It is then encrypted with `age` to the target server's SSH ed25519 host key
  (other recipient types are rejected) and only that ciphertext is stored or sent.
- Only the holder of the host private key, the target server, can decrypt it. The operator,
  the relay and Buzz cannot.
- Buzz DMs are **not end-to-end encrypted**. They carry public data and age ciphertext only.
- **Host-key verification is the operator's job.** Take the key from your provisioning tool,
  or from `ssh-keyscan` checked against a fingerprint you already trust. A wrong host key
  means the key is sealed to the wrong machine.
- Install requests are accepted only when the agent's own signed profile names the
  requesting owner. A server can hold only one agent.
- Retire requests for adopted agents are accepted only when the agent's signed profile names
  the requesting owner; the operator keeps a "Known owners" list so those DMs are read.
- The operator command template shell-quotes every value.

## Known limitations

- Verified on Buzz Desktop 1.0.5 (Linux) against a test relay only; other versions and
  platforms are untested.
- No rename or avatar change from Buzz; change them on the server.
- **Retire before Delete.** Buzz archives an agent before it asks the plugin to remove it.
  Delete only succeeds after the operator confirmed retirement, with the agent's community
  selected in Buzz. The one exception: an unfinished setup made on this device whose install
  request was never sent can be deleted directly. Once sending was attempted, even if it
  failed, the agent must be retired first; agents brought into Buzz or set up on another
  device too.
- If Delete is refused right after Retired while Buzz is reconnecting, try Delete again.
- **Cancel retire request** only cancels on this device. The request already sent stays with
  the operator, who may still act on it and stop the agent.
- Hosted agents always appear online in Buzz. Use the **Server** tab for the real status.
- No remote start or stop.
- A plugin added as a folder (zip) does not update itself: delete it and add the new version.
  Install from Git (branch `release`) to get updates in place.

## Reference installer

`installer/install-agent-key.sh` is a POSIX shell script for the server. It decrypts the
sealed file with the host key, checks that the key matches the expected pubkey using
`buzz users get`, and rewrites `BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY` and `BUZZ_AUTH_TAG` in
an env file (with a backup). The secret never appears in argv, stdout or stderr.

```sh
sudo ./install-agent-key.sh --sealed server-1.age --pubkey <hex> \
  --auth-tag '<json array>' --relay wss://relay.example.org --env-file /etc/agent/env
```

It prints `{"ok":true,...}` or `{"ok":false,"error":"..."}`.

## Example: Ansible pattern

Keep your own playbooks in a private repository. A typical pattern: the operator template is

```text
ansible-playbook install-agent.yml -l {host} -e agent_name={name} -e sealed_file={file} -e pubkey={pubkey} -e auth_tag={auth_tag}
```

and the playbook copies the `.age` file to the server, runs `install-agent-key.sh` with
`--host-key /etc/ssh/ssh_host_ed25519_key`, and restarts the agent service. The inventory
host name matches the slot's server label.

## Old Buzz

The plugin does not support the old Buzz app (before 1.0). The earlier Go placeholder for
old Buzz has been retired.

## Development

```sh
bun install
bunx biome check . && bunx tsc --noEmit && bun test && bun run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE). Independent
project; not affiliated with or endorsed by Block.
