# Owner guide

You own agents; an operator runs the servers. You never touch a server.

## One-time setup

Settings → Self-hosted agents → **Operator**: paste the operator's npub and save. The
operator is set per community.

## Create an agent

1. Ask the operator for a server. It appears under "Servers offered to you".
2. New agent → **Self-hosted agent** → choose the server and name the agent. If no server is
   ready you see "No server is ready for you yet. Ask your operator."
3. The plugin publishes the agent's profile (signed by the agent itself) and sends the
   operator an install request with the sealed key. The Server tab shows "Waiting for
   installation" until the operator confirms.

New agents answer to anyone by default (`respond_to: anyone`, parallelism 1). A server holds
one agent, and each setup uses a new key.

## Bring an existing agent into Buzz

Settings → Self-hosted agents → **Bring into Buzz** → Refresh. Each of your agent records is
listed with a state:

- Can be brought into Buzz: its signed profile names you as owner.
- Managed by _runtime_ (for example `buzz.goose/goose`): another harness manages it, often
  because it was imported into Buzz with **Import an agent**. If it really runs on your own
  server and no Buzz runs it, choose **Take over** and then **Confirm take over**. Only
  offered when its key is not held in this Buzz.
- Cannot verify owner, Its key is held in this Buzz, Already a self-hosted agent: not
  adoptable.

Do not use Buzz's own **Import an agent** for an agent that runs on a server: Buzz would then
run it on your desktop as well. And do not **Delete** such an agent to undo that: Delete
archives the agent and removes it from every channel, also for its server.

Bring it in; it appears on the Agents page after Buzz reconnects or restarts. Its key and
server are not touched.

## Retire and delete

Hosted agents always look online in Buzz, so use the **Server** tab for the real status.

1. Open the agent's Server tab (or the settings card) and choose **Retire**. This asks the
   operator to stop the agent. It also works for agents you brought in.
2. When the tab says "Stopped by the operator, you can delete it now", delete the agent.

Deleting first fails with "Retire this agent first, then delete it again": Buzz has already
archived the agent, so retire, wait, then delete again. Exception: an unfinished setup made
on this device whose install request was never sent can be deleted directly (it is not
offered Retire). Once sending was attempted, even if it failed, retire it first; the same
holds for agents brought into Buzz or set up on another device. Delete with the agent's
community selected in Buzz.

Changed your mind while the operator has not confirmed yet? **Cancel retire request** sets
the agent back to its earlier status on this device. It only cancels locally: the request
already sent stays with the operator, who may still stop the agent. Tell the operator too.

If Delete is refused right after Retired while Buzz is reconnecting, try Delete again.

## Limits

- Verified on Buzz Desktop 1.0.5 (Linux) against a test relay.
- Hosted agents always look online in Buzz; the Server tab has the real status.
- Retire before Delete (see above).
- No rename or avatar change from Buzz; change them on the server.
- Install the plugin from Git (repository `frankhommers/buzz-external-agent`, branch `release`): Buzz then offers updates itself. A folder (zip) install must be deleted and added again to update.
- DMs with the operator are not end-to-end encrypted. Only public data and sealed
  ciphertext travel in them.
