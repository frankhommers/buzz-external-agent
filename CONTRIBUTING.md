# Contributing

Run `gofmt -w *.go tools/release/*.go`, `go vet ./...`, and `go test -race ./...`.
The project uses only the Go standard library. Production host and ACP modes
must never make network requests, launch tools, send relay presence, or control
a remote service. Setup commands may only edit explicitly selected local files.

Use synthetic identities in tests. Do not attach Buzz stores, private keys,
environment dumps, or personal paths to issues or pull requests.

Changes to Buzz's configuration schema should include preservation tests and
an update to the compatibility section in the README.

Maintainers can build all archives with `go run ./tools/release`. The release
workflow tests all three operating systems before publishing tag-triggered
release assets. Keep the version in `main.go` and `CHANGELOG.md` in sync with tags.
