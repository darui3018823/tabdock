// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package getstatus

import (
	"os/exec"
	"runtime"
	"strings"
)

type PCStatus struct {
	PC, Battery, WAN, Uptime, CPU, Mem, GPU0, GPU1, VRAM, DriveC, MainWindow string
}

func runPS(cmd string) string {
	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("powershell", "-Command", cmd).Output()
		if err != nil {
			return "Error"
		}
		return strings.TrimSpace(string(out))
	case "linux", "darwin":
		out, err := exec.Command("sh", "-c", cmd).Output()
		if err != nil {
			return "Error"
		}
		return strings.TrimSpace(string(out))
	default:
		return "N/A"
	}
}

func GetStatus() (*PCStatus, error) {
	switch runtime.GOOS {
	case "windows":
		return getWindowsStatus()
	case "linux":
		return getLinuxStatus()
	case "darwin":
		return getDarwinStatus()
	default:
		return &PCStatus{
			PC:         "Unknown",
			Battery:    "N/A",
			WAN:        "N/A",
			Uptime:     "N/A",
			CPU:        "N/A",
			Mem:        "N/A",
			GPU0:       "N/A",
			VRAM:       "N/A",
			DriveC:     "N/A",
			MainWindow: "N/A",
		}, nil
	}
}
