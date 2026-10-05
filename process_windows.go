package main

import "syscall"

func processRunning(pid uint32) (bool, error) {
	const queryLimitedInformation = 0x1000
	const invalidParameter = syscall.Errno(87)
	const stillActive = 259
	if pid == 0 || pid > 0x7fffffff {
		return false, invalidParameter
	}
	// Query only: never request process termination or modification rights.
	handle, err := syscall.OpenProcess(queryLimitedInformation, false, pid)
	if err == invalidParameter {
		return false, nil
	} // PID no longer exists.
	if err != nil {
		return false, err
	} // Access denied is not proof of exit.
	defer syscall.CloseHandle(handle)
	var exitCode uint32
	if err := syscall.GetExitCodeProcess(handle, &exitCode); err != nil {
		return false, err
	}
	// An exited process can retain a handle. Exit code 259 is conservative:
	// it may also be an application's exit code, so keep blocking in that case.
	return exitCode == stillActive, nil
}
