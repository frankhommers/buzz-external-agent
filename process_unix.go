//go:build darwin || linux

package main

import "syscall"

func processRunning(pid uint32) (bool, error) {
	if pid == 0 || pid > 0x7fffffff {
		return false, syscall.EINVAL
	}
	// Signal 0 checks existence/permission without delivering a signal.
	switch err := syscall.Kill(int(pid), 0); err {
	case nil, syscall.EPERM:
		return true, nil
	case syscall.ESRCH:
		return false, nil
	default:
		return false, err
	}
}
