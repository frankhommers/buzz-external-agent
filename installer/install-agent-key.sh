#!/bin/sh
# Install a sealed agent key on this server.
#
# Decrypts <slot>.age with the SSH ed25519 host key, verifies the key belongs to the expected
# agent pubkey, and rewrites BUZZ_RELAY_URL, BUZZ_PRIVATE_KEY and BUZZ_AUTH_TAG in an env file.
# Run as a user that can read the host private key (normally root).
#
# Usage:
#   install-agent-key.sh --sealed FILE --pubkey HEX --auth-tag JSON --relay URL --env-file PATH
#                        [--host-key /etc/ssh/ssh_host_ed25519_key] [--buzz PATH]
#
# Requires: age, jq and the buzz CLI. The secret key is never written to argv, stdout or stderr.
# Output: {"ok":true,"pubkey":"...","backup":"<path or null>"} or {"ok":false,"error":"..."}.
set -eu
umask 077

SEALED=''
PUBKEY=''
AUTH_TAG=''
RELAY=''
ENV_FILE=''
HOST_KEY='/etc/ssh/ssh_host_ed25519_key'
BUZZ='buzz'
TMP_FILE=''

cleanup()
{
  if [ -n "$TMP_FILE" ]; then
    rm -f "$TMP_FILE"
  fi
}
trap cleanup EXIT

# Messages passed here are static and never contain secrets.
fail()
{
  printf '{"ok":false,"error":"%s"}\n' "$1"
  exit 1
}

while [ $# -gt 0 ]; do
  [ $# -ge 2 ] || fail "missing value for $1"
  case "$1" in
    --sealed) SEALED=$2 ;;
    --pubkey) PUBKEY=$2 ;;
    --auth-tag) AUTH_TAG=$2 ;;
    --relay) RELAY=$2 ;;
    --env-file) ENV_FILE=$2 ;;
    --host-key) HOST_KEY=$2 ;;
    --buzz) BUZZ=$2 ;;
    *) fail "unknown option $1" ;;
  esac
  shift 2
done

[ -n "$SEALED" ] || fail "--sealed is required"
[ -n "$PUBKEY" ] || fail "--pubkey is required"
[ -n "$AUTH_TAG" ] || fail "--auth-tag is required"
[ -n "$RELAY" ] || fail "--relay is required"
[ -n "$ENV_FILE" ] || fail "--env-file is required"

for tool in age jq; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is not installed"
done
command -v "$BUZZ" >/dev/null 2>&1 || [ -x "$BUZZ" ] || fail "buzz CLI not found"

printf '%s' "$PUBKEY" | grep -Eq '^[0-9a-f]{64}$' || fail "pubkey must be 64 lowercase hex characters"

case "$RELAY" in
  *"'"* | *'
'*) fail "relay url contains invalid characters" ;;
esac

case "$AUTH_TAG" in
  *"'"*) fail "auth tag contains invalid characters" ;;
esac
AUTH_TAG=$(printf '%s' "$AUTH_TAG" | jq -ce '
  select(
    type == "array" and length == 4 and all(.[]; type == "string")
    and .[0] == "auth"
    and (.[1] | test("^[0-9a-f]{64}$"))
    and (.[3] | test("^[0-9a-f]{128}$"))
  )' 2>/dev/null) || fail "auth tag is not a valid NIP-OA auth tag"
[ -n "$AUTH_TAG" ] || fail "auth tag is not a valid NIP-OA auth tag"

[ -f "$SEALED" ] || fail "sealed file not found"
[ -r "$HOST_KEY" ] || fail "host key not readable"
ENV_DIR=$(dirname "$ENV_FILE")
[ -d "$ENV_DIR" ] || fail "env file directory does not exist"

# Decrypt into a shell variable only.
NSEC=$(age -d -i "$HOST_KEY" "$SEALED" 2>/dev/null) || fail "could not decrypt sealed file"
printf '%s' "$NSEC" | grep -Eq '^nsec1[02-9ac-hj-np-z]{58}$' || fail "decrypted secret is not a valid nsec"

# Verify the key via the buzz CLI; the secret travels in the environment only.
ACTUAL=$(BUZZ_PRIVATE_KEY=$NSEC BUZZ_RELAY_URL=$RELAY BUZZ_AUTH_TAG=$AUTH_TAG \
  "$BUZZ" users get 2>/dev/null | jq -r '.[0].pubkey' 2>/dev/null) || fail "buzz could not verify the key"
[ "$ACTUAL" = "$PUBKEY" ] || fail "decrypted key does not match the expected pubkey"

# Build the new env file next to the old one, then swap atomically.
TMP_FILE=$(mktemp "$ENV_FILE.tmp.XXXXXX") || fail "could not create temp file"
if [ -f "$ENV_FILE" ]; then
  grep -Ev '^(export[[:space:]]+)?(BUZZ_RELAY_URL|BUZZ_PRIVATE_KEY|BUZZ_AUTH_TAG)=' "$ENV_FILE" \
    >"$TMP_FILE" || [ $? -eq 1 ] || fail "could not read env file"
fi
{
  printf 'BUZZ_RELAY_URL=%s\n' "$RELAY"
  printf 'BUZZ_PRIVATE_KEY=%s\n' "$NSEC"
  printf "BUZZ_AUTH_TAG='%s'\n" "$AUTH_TAG"
} >>"$TMP_FILE" || fail "could not write env file"
chmod 600 "$TMP_FILE"

BACKUP=''
if [ -f "$ENV_FILE" ]; then
  BACKUP="$ENV_FILE.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  cp "$ENV_FILE" "$BACKUP" || fail "could not back up env file"
  chmod 600 "$BACKUP"
fi

mv "$TMP_FILE" "$ENV_FILE" || fail "could not replace env file"
TMP_FILE=''
rm -f "$SEALED"

if [ -n "$BACKUP" ]; then
  printf '{"ok":true,"pubkey":"%s","backup":"%s"}\n' "$PUBKEY" "$BACKUP"
else
  printf '{"ok":true,"pubkey":"%s","backup":null}\n' "$PUBKEY"
fi
