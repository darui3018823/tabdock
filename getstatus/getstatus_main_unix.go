//go:build !windows

// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package getstatus

import "runtime"

// Darwin
func getDarwinStatus() (*PCStatus, error) {
	status := &PCStatus{}
	status.PC = runPS(`scutil --get ComputerName`)
	status.Battery = runPS(`pmset -g batt | grep -Eo "\d+%" | head -1`)
	status.WAN = runPS(`ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`)
	status.Uptime = runPS(`uptime | awk '{print $3 " " $4 " " $5}'`)
	status.CPU = runPS(`ps -A -o %cpu | awk '{s+=$1} END {print s "%"}'`)
	status.Mem = runPS(`vm_stat | grep "Pages active" | awk '{print $3}'`)
	status.GPU0 = "N/A" // macOSでは実装予定なし
	status.VRAM = "N/A" // macOSでは実装予定なし
	status.DriveC = runPS(`df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`)
	status.MainWindow = runPS(`osascript -e 'tell application "System Events" to get name of (processes where frontmost is true)'`)
	return status, nil
}

// Linux
func getLinuxStatus() (*PCStatus, error) {
	status := &PCStatus{}
	status.PC = runPS(`hostname`)
	status.Battery = runPS(`cat /sys/class/power_supply/BAT0/capacity`) // バッテリーが存在しない場合は変更してください。
	status.WAN = runPS(`ping -c 1 -W 1 1.1.1.1 >/dev/null; if ($?) { "Active" } else { "Offline" }`)
	status.Uptime = runPS(`uptime -p`)
	status.CPU = runPS(`top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | ForEach-Object { "$_%" }`)
	status.Mem = runPS(`free -m | awk 'NR==2{printf "%.0f%% (%dMB/%dMB)", $3*100/$2, $3, $2 }'`)
	status.GPU0 = runPS(`nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | Select-Object -First 1`)
	status.VRAM = runPS(`nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | ForEach-Object {
        $p=$_.Split(",");$u=[double]$p[0];$t=[double]$p[1];$pr=[math]::Round(($u/$t)*100,0);
        "$pr% ($u" + "MiB/$t" + "MiB)"
    } | Select-Object -First 1`)
	status.DriveC = runPS(`df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}'`)
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
