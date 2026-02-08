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
		FieldPC:         `scutil --get ComputerName`,
		FieldBattery:    `pmset -g batt | grep -Eo "\d+%" | head -1`,
		FieldWAN:        `ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`,
		FieldUptime:     `uptime | awk '{print $3 " " $4 " " $5}'`,
		FieldCPU:        `ps -A -o %cpu | awk '{s+=$1} END {print s "%"}'`,
		FieldMem:        `vm_stat | grep "Pages active" | awk '{print $3}'`,
		FieldDriveC:     `df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`,
		FieldMainWindow: `osascript -e 'tell application "System Events" to get name of (processes where frontmost is true)'`,
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
		case FieldPC:
			status.PC = res.value
		case FieldBattery:
			status.Battery = res.value
		case FieldWAN:
			status.WAN = res.value
		case FieldUptime:
			status.Uptime = res.value
		case FieldCPU:
			status.CPU = res.value
		case FieldMem:
			status.Mem = res.value
		case FieldDriveC:
			status.DriveC = res.value
		case FieldMainWindow:
			status.MainWindow = res.value
		}
	}

	status.GPU0 = StatusNA // macOSでは実装予定なし
	status.VRAM = StatusNA // macOSでは実装予定なし

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
		FieldPC:      `hostname`,
		FieldBattery: `cat /sys/class/power_supply/BAT0/capacity`,
		FieldWAN:     `ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`,
		FieldUptime:  `uptime -p`,
		FieldCPU:     `top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | ForEach-Object { "$_%" }`,
		FieldMem:     `free -m | awk 'NR==2{printf "%.0f%% (%dMB/%dMB)", $3*100/$2, $3, $2 }'`,
		FieldGPU0:    `nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | Select-Object -First 1`,
		FieldVRAM: `nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | ForEach-Object {
        $p=$_.Split(",");$u=[double]$p[0];$t=[double]$p[1];$pr=[math]::Round(($u/$t)*100,0);
        "$pr% ($u" + "MiB/$t" + "MiB)"
    } | Select-Object -First 1`,
		FieldDriveC: `df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`,
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
		case FieldPC:
			status.PC = res.value
		case FieldBattery:
			status.Battery = res.value
		case FieldWAN:
			status.WAN = res.value
		case FieldUptime:
			status.Uptime = res.value
		case FieldCPU:
			status.CPU = res.value
		case FieldMem:
			status.Mem = res.value
		case FieldGPU0:
			status.GPU0 = res.value
		case FieldVRAM:
			status.VRAM = res.value
		case FieldDriveC:
			status.DriveC = res.value
		}
	}

	status.MainWindow = StatusNA // Linuxでは未実装

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
			Battery:    StatusNA,
			WAN:        StatusNA,
			Uptime:     StatusNA,
			CPU:        StatusNA,
			Mem:        StatusNA,
			GPU0:       StatusNA,
			VRAM:       StatusNA,
			DriveC:     StatusNA,
			MainWindow: StatusNA,
		}, nil
	}
}
