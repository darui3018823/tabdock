// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

// Package getstatus provides system status collection helpers.
package getstatus

import (
	"os/exec"
	"runtime"
	"strings"
)

// PCStatus is the aggregated device status snapshot.
type PCStatus struct {
	PC, Battery, WAN, Uptime, CPU, Mem, GPU0, GPU1, VRAM, DriveC, MainWindow string
}

// Supported OS identifiers and standard status labels.
const (
	OSWindows = "windows"
	OSLinux   = "linux"
	OSDarwin  = "darwin"

	StatusNA    = "N/A"
	StatusError = "Error"

	FieldPC         = "PC"
	FieldBattery    = "Battery"
	FieldWAN        = "WAN"
	FieldUptime     = "Uptime"
	FieldCPU        = "CPU"
	FieldMem        = "Mem"
	FieldGPU0       = "GPU0"
	FieldGPU1       = "GPU1"
	FieldVRAM       = "VRAM"
	FieldDriveC     = "DriveC"
	FieldMainWindow = "MainWindow"
)

func runPS(cmd string) string {
	switch runtime.GOOS {
	case OSWindows:
		out, err := exec.Command("powershell", "-Command", cmd).Output()
		if err != nil {
			return StatusError
		}
		return strings.TrimSpace(string(out))
	case OSLinux, OSDarwin:
		out, err := exec.Command("sh", "-c", cmd).Output()
		if err != nil {
			return StatusError
		}
		return strings.TrimSpace(string(out))
	default:
		return StatusNA
	}
}
