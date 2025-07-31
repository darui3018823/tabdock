import json
import socket
from httpx import get
import psutil
import subprocess
import os
import GPUtil
import time
import win32api
import win32gui


def check_port_21():
    try:
        with socket.create_connection(("127.0.0.1", 21), timeout=1):
            return "Active"
    except Exception:
        return "Closed"


def check_wan():
    try:
        result = subprocess.run(
            ["ping", "-n", "1", "-w", "1000", "1.1.1.1"],
            stdout=subprocess.DEVNULL
        )
        return "Active" if result.returncode == 0 else "Offline"
    except Exception:
        return "Error"


def get_battery():
    try:
        battery = psutil.sensors_battery()
        return f"{battery.percent}%" if battery else "N/A"
    except Exception:
        return "Error"


def get_uptime():
    try:
        uptime_seconds = time.time() - psutil.boot_time()
        days, remainder = divmod(uptime_seconds, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, _ = divmod(remainder, 60)
        return f"{int(days)}d {int(hours)}h {int(minutes)}m"
    except Exception:
        return "Unavailable"


def get_cpu_usage():
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        return f"{cpu_percent}%"
    except Exception:
        return "Unavailable"


def get_memory_usage():
    try:
        memory = psutil.virtual_memory()
        used_gb = memory.used / (1024 ** 3)
        total_gb = memory.total / (1024 ** 3)
        percent = memory.percent
        return f"{percent}% ({used_gb:.1f}GB/{total_gb:.1f}GB)"
    except Exception:
        return "Unavailable"


def get_gpu_usage():
    try:
        gpus = GPUtil.getGPUs()
        gpu0 = f"{gpus[0].load * 100:.0f}%" if len(gpus) > 0 else "N/A"
        gpu1 = f"{gpus[1].load * 100:.0f}%" if len(gpus) > 1 else "N/A"
        return gpu0, gpu1
    except Exception:
        return "Unavailable", "N/A"


def get_vram_usage():
    try:
        gpus = GPUtil.getGPUs()
        if not gpus:
            return "Unavailable"
        
        total_vram = 0
        used_vram = 0
        for gpu in gpus:
            total_vram += gpu.memoryTotal
            used_vram += gpu.memoryUsed
        
        used_gb = used_vram / 1024
        total_gb = total_vram / 1024
        percent = (used_vram / total_vram) * 100 if total_vram > 0 else 0
        return f"{percent:.0f}% ({used_gb:.1f}GB/{total_gb:.1f}GB)"
    except Exception:
        return "Unavailable"


def get_drive_usage(drive_letter):
    try:
        if os.path.exists(f"{drive_letter}:\\"):
            usage = psutil.disk_usage(f"{drive_letter}:\\")
            used_gb = usage.used / (1024 ** 3)
            total_gb = usage.total / (1024 ** 3)
            percent = (usage.used / usage.total) * 100
            return f"{percent:.0f}% ({used_gb:.0f}GB/{total_gb:.0f}GB)"
        else:
            return "N/A"
    except Exception:
        return "Unavailable"


def get_main_window():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            window_text = win32gui.GetWindowText(hwnd)
            if not window_text:
                return "Unknown"
            
            # 2行に収まる程度の長さに調整（約35-40文字程度）
            max_length = 35
            if len(window_text) > max_length:
                return window_text[:max_length] + "..."
            else:
                return window_text
        else:
            return "None"
    except Exception:
        return "Unavailable"


def get_status():
    gpu0, gpu1 = get_gpu_usage()
    
    return {
        "pc": socket.gethostname(),
        "battery": get_battery(),
        "wan": check_wan(),
        "uptime": get_uptime(),
        "cpu": get_cpu_usage(),
        "mem": get_memory_usage(),
        "gpu0": gpu0,
        "gpu1": gpu1,
        "vram": get_vram_usage(),
        "driveC": get_drive_usage("C"),
        "driveD": get_drive_usage("D"),
        "mainWindow": get_main_window()
    }


if __name__ == "__main__":
    print(json.dumps(get_status()))
