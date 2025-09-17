// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package getstatus

import (
	"fmt"
	"net"
	"os"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"golang.org/x/sys/windows"
)

// Windows
var (
	user32             = windows.NewLazySystemDLL("user32.dll")
	procGetForeground  = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW = user32.NewProc("GetWindowTextW")
)

func getWindowsStatus() (*PCStatus, error) {
	status := &PCStatus{}
	status.PC = getPCName()
	status.Battery = getBattery()
	status.WAN = getWAN()
	status.Uptime = getUptime()
	status.CPU = getCPU()
	status.Mem = getMem()
	status.GPU0 = getGPU()
	status.VRAM = getVRAM()
	status.DriveC = getDriveC()
	status.MainWindow = getMainWindow()
	return status, nil
}

func getPCName() string {
	name, _ := os.Hostname()
	return name
}

func getBattery() string {
	return runPS(`(Get-CimInstance Win32_Battery).EstimatedChargeRemaining`)
}

func getWAN() string {
	conn, err := net.DialTimeout("tcp", "1.1.1.1:53", 200*time.Millisecond)
	if err != nil {
		return "Offline"
	}
	conn.Close()
	return "Active"
}

func getCPU() string {
	p, _ := cpu.Percent(time.Second, false)
	if len(p) > 0 {
		return strings.TrimSpace(fmt.Sprintf("%.0f%%", p[0]))
	}
	return "Unavailable"
}

func getMem() string {
	v, _ := mem.VirtualMemory()
	return fmt.Sprintf("%.0f%% (%.1fGB/%.1fGB)", v.UsedPercent,
		float64(v.Used)/1e9, float64(v.Total)/1e9)
}

func getDriveC() string {
	d, _ := disk.Usage("C:\\")
	return fmt.Sprintf("%.0f%% (%.0fGB/%.0fGB)",
		d.UsedPercent, float64(d.Used)/1e9, float64(d.Total)/1e9)
}

func getUptime() string {
	up, _ := host.Uptime()
	d := up / 86400
	h := (up % 86400) / 3600
	m := (up % 3600) / 60
	return fmt.Sprintf("%dd %dh %dm", d, h, m)
}

func getGPU() string {
	return runPS(`nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | Select-Object -First 1`)
}

func getVRAM() string {
	return runPS(`nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | ForEach-Object {
        $p=$_.Split(",")
        $u=[double]$p[0]
        $t=[double]$p[1]
        $pr=[math]::Round(($u/$t)*100,0)
        $uGB = [math]::Round($u/1024,1)
        $tGB = [math]::Round($t/1024,1)
        "$pr% ($uGB" + "GB/$tGB" + "GB)"
    } | Select-Object -First 1`)
}

func getMainWindow() string {
	hwnd, _, _ := procGetForeground.Call()
	if hwnd == 0 {
		return "None"
	}
	buf := make([]uint16, 256)
	procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return syscall.UTF16ToString(buf)
}

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
