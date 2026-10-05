// Build and package standalone binaries. Run from the repository root.
package main

import (
	"archive/zip"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	if err := release(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func release() error {
	if err := os.MkdirAll("dist", 0755); err != nil {
		return err
	}
	var sums strings.Builder
	for _, target := range []string{"darwin/arm64", "darwin/amd64", "linux/arm64", "linux/amd64", "windows/arm64", "windows/amd64"} {
		parts := strings.Split(target, "/")
		name := "buzz-external-agent"
		if parts[0] == "windows" {
			name += ".exe"
		}
		dir := filepath.Join("dist", strings.ReplaceAll(target, "/", "-"))
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
		binary := filepath.Join(dir, name)
		cmd := exec.Command("go", "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w", "-o", binary, ".")
		cmd.Env = append(os.Environ(), "CGO_ENABLED=0", "GOOS="+parts[0], "GOARCH="+parts[1])
		cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("build %s: %w", target, err)
		}
		archivePath := filepath.Join("dist", "buzz-external-agent-"+strings.ReplaceAll(target, "/", "-")+".zip")
		if err := archive(archivePath, binary); err != nil {
			return err
		}
		data, err := os.ReadFile(archivePath)
		if err != nil {
			return err
		}
		fmt.Fprintf(&sums, "%x  %s\n", sha256.Sum256(data), filepath.Base(archivePath))
		fmt.Println(archivePath)
	}
	return os.WriteFile(filepath.Join("dist", "SHA256SUMS"), []byte(sums.String()), 0644)
}

func archive(path, binary string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	writer := zip.NewWriter(f)
	for _, source := range []string{binary, "README.md", "LICENSE", "CHANGELOG.md", "AGENT-INSTALL.md"} {
		data, err := os.ReadFile(source)
		if err != nil {
			writer.Close()
			return err
		}
		header := &zip.FileHeader{Name: filepath.Base(source), Method: zip.Deflate}
		header.SetModTime(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
		header.SetMode(0644)
		if source == binary {
			header.SetMode(0755)
		}
		entry, err := writer.CreateHeader(header)
		if err != nil {
			writer.Close()
			return err
		}
		if _, err := entry.Write(data); err != nil {
			writer.Close()
			return err
		}
	}
	return writer.Close()
}
