//go:build !windows

// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package getstatus

import (
	"runtime"
	"sync"
)

// Darwin
func getDarwinStatus() (*PCStatus, error) {
	status := &PCStatus{}
	type fieldResult struct {
		field string
		value string
	}

	commands := map[string]string{
		"PC":         `scutil --get ComputerName`,
		"Battery":    `pmset -g batt | grep -Eo "\d+%" | head -1`,
		"WAN":        `ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`,
		"Uptime":     `uptime | awk '{print $3 " " $4 " " $5}'`,
		"CPU":        `ps -A -o %cpu | awk '{s+=$1} END {print s "%"}'`,
		"Mem":        `vm_stat | grep "Pages active" | awk '{print $3}'`,
		"DriveC":     `df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`,
		"MainWindow": `osascript -e 'tell application "System Events" to get name of (processes where frontmost is true)'`,
	}

	results := make(chan fieldResult, len(commands))
	var wg sync.WaitGroup

	for field, cmd := range commands {
		wg.Add(1)
		go func(field, cmd string) {
			defer wg.Done()
			results <- fieldResult{field: field, value: runPS(cmd)}
		}(field, cmd)
	}

	wg.Wait()
	close(results)

	for res := range results {
		switch res.field {
		case "PC":
			status.PC = res.value
		case "Battery":
			status.Battery = res.value
		case "WAN":
			status.WAN = res.value
		case "Uptime":
			status.Uptime = res.value
		case "CPU":
			status.CPU = res.value
		case "Mem":
			status.Mem = res.value
		case "DriveC":
			status.DriveC = res.value
		case "MainWindow":
			status.MainWindow = res.value
		}
	}

	status.GPU0 = "N/A" // macOSでは実装予定なし
	status.VRAM = "N/A" // macOSでは実装予定なし

	return status, nil
}

// Linux
func getLinuxStatus() (*PCStatus, error) {
	status := &PCStatus{}
	type fieldResult struct {
		field string
		value string
	}

	commands := map[string]string{
		"PC":      `hostname`,
		"Battery": `cat /sys/class/power_supply/BAT0/capacity`,
		"WAN":     `ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`,
		"Uptime":  `uptime -p`,
		"CPU":     `top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | ForEach-Object { "$_%" }`,
		"Mem":     `free -m | awk 'NR==2{printf "%.0f%% (%dMB/%dMB)", $3*100/$2, $3, $2 }'`,
		"GPU0":    `nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | Select-Object -First 1`,
		"VRAM": `nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | ForEach-Object {
        $p=$_.Split(",");$u=[double]$p[0];$t=[double]$p[1];$pr=[math]::Round(($u/$t)*100,0);
        "$pr% ($u" + "MiB/$t" + "MiB)"
    } | Select-Object -First 1`,
		"DriveC": `df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`,
	}

	results := make(chan fieldResult, len(commands))
	var wg sync.WaitGroup

	for field, cmd := range commands {
		wg.Add(1)
		go func(field, cmd string) {
			defer wg.Done()
			results <- fieldResult{field: field, value: runPS(cmd)}
		}(field, cmd)
	}

	wg.Wait()
	close(results)

	for res := range results {
		switch res.field {
		case "PC":
			status.PC = res.value
		case "Battery":
			status.Battery = res.value
		case "WAN":
			status.WAN = res.value
		case "Uptime":
			status.Uptime = res.value
		case "CPU":
			status.CPU = res.value
		case "Mem":
			status.Mem = res.value
		case "GPU0":
			status.GPU0 = res.value
		case "VRAM":
			status.VRAM = res.value
		case "DriveC":
			status.DriveC = res.value
		}
	}

	status.MainWindow = "N/A" // Linuxでは未実装

	return status, nil
}

// GetStatus returns the current PC status for Unix systems (Linux/macOS)
func GetStatus() (*PCStatus, error) {
	switch runtime.GOOS {
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
