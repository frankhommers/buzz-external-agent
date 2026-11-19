# Operator guide

You run the servers; owners ask for agents. Give owners your npub, and paste your own npub
as Operator in Settings → Self-hosted agents to see the operator view. Everything is in
Settings → "Self-hosted agents: operator".

## Offer a server

Provision the server with your own tools first. Then under **Offer a server** enter a slot
id (lowercase letters, digits and dashes; `adopted` is reserved), a label, the owner's npub
and the server's SSH host public key (`ssh-ed25519 AAAA...`), then click Offer. A list of
servers can be imported as JSON, `[{"slot": "server-1", "label": "Server 1", "hostKey":
"ssh-ed25519 AAAA..."}]`, and offered one by one.

**You are responsible for the host key.** Take it from your provisioning tool or from
`ssh-keyscan` verified against a fingerprint you trust. A slot is offered once and holds a
single agent.

## Install

Under **Install requests**, per request:

1. Download the `.age` file (`<slot>.age`).
2. **Copy public data** (name, host, pubkey, auth tag) or **Copy command** when a template
   is set.
3. Deploy, for instance with `installer/install-agent-key.sh` (see the README).
4. Click **Installed**; the owner is told.

A request is listed only when the agent's own signed profile names the requesting owner, the
owner proof verifies, and the slot was offered to that owner. A newer request for the same
slot replaces the older one.

## Command template

Optional. Placeholders: `{name}`, `{slot}`, `{host}`, `{relay}`, `{pubkey}`, `{npub}`,
`{auth_tag}`, `{file}`. `{host}` is the slot's server label; `{relay}` is the community relay
URL (`wss://…`) the agent connects to. The public data also includes `relay`.

**Do not put quotes around placeholders; values are shell-quoted automatically.**

```text
ansible-playbook install-agent.yml -l {host} -e agent_name={name} -e sealed_file={file}
```

An unknown placeholder is shown as an error on the request instead of a command.

## Retire

Under **Retire requests**, stop the agent on its server, then click **Retired**; the owner
can then delete the agent in Buzz.

## Existing agents and Known owners

Owners can bring agents you already run into Buzz and later retire them. Those retire requests
have no slot, so list the owners' npubs under **Known owners** (one per line) and save; their
DMs are then read. A request is accepted only when the agent's signed profile names that owner.

## If you are also an owner

Offers, requests and confirmations are handled locally; no DM to yourself.

## Limits

DMs are not end-to-end encrypted and carry only public data and age ciphertext. The plugin
never contacts servers.
