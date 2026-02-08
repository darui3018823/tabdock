//go:build windows

// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package getstatus

import (
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"sync"
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
	type fieldResult struct {
		field string
		value string
	}

	tasks := map[string]func() string{
		"PC":         getPCName,
		"Battery":    getBattery,
		"WAN":        getWAN,
		"Uptime":     getUptime,
		"CPU":        getCPU,
		"Mem":        getMem,
		"GPU0":       getGPU,
		"VRAM":       getVRAM,
		"DriveC":     getDriveC,
		"MainWindow": getMainWindow,
	}

	results := make(chan fieldResult, len(tasks))
	var wg sync.WaitGroup

	for field, fn := range tasks {
		wg.Add(1)
		go func(field string, fn func() string) {
			defer wg.Done()
			results <- fieldResult{field: field, value: fn()}
		}(field, fn)
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
		case "MainWindow":
			status.MainWindow = res.value
		}
	}

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
	if closeErr := conn.Close(); closeErr != nil {
		log.Printf("failed to close WAN probe connection: %v", closeErr)
	}
	return "Active"
}

func getCPU() string {
	p, _ := cpu.Percent(0, false)
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
	usage, err := disk.Usage("C:\\")
	if err != nil {
		log.Printf("failed to query drive C usage: %v", err)
		return StatusNA
	}
	if usage == nil {
		log.Printf("drive C usage result is nil")
		return StatusNA
	}

	const gib = 1024 * 1024 * 1024
	return fmt.Sprintf("%.0f%% (%.1fGiB/%.1fGiB)",
		usage.UsedPercent, float64(usage.Used)/float64(gib), float64(usage.Total)/float64(gib))
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

func trimString(s string, limit int) string {
	runes := []rune(s)
	if len(runes) > limit {
		return string(runes[:limit]) + "..."
	}
	return s
}

func getMainWindow() string {
	hwnd, _, _ := procGetForeground.Call()
	if hwnd == 0 {
		return "None"
	}
	buf := make([]uint16, 256)
	if _, _, callErr := procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf))); callErr != nil && callErr != syscall.Errno(0) {
		log.Printf("failed to read window title: %v", callErr)
	}
	title := syscall.UTF16ToString(buf)

	return trimString(title, 50)
}

// GetStatus returns the current PC status for Windows
func GetStatus() (*PCStatus, error) {
	return getWindowsStatus()
}
