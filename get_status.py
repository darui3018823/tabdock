import json
import socket
from httpx import get
import psutil
import subprocess
import os
import GPUtil


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


def get_ram_usage():
    try:
        return f"{int(psutil.virtual_memory().percent)}%"
    except Exception:
        return "Error"


def get_drive_e_status():
    return "All Ready!" if os.path.exists("E:\\") else "Not Found"


def get_gpu_load():
    try:
        gpus = GPUtil.getGPUs()
        if not gpus:
            return "N/A"
        gpu = gpus[0]
        return f"{gpu.load * 100:.1f}%"
    except Exception:
        return "Error"
    
def get_gpu_info():
    try:
        gpus = GPUtil.getGPUs()
        if not gpus:
            return "N/A"
        return gpus[0].name  # 最初のGPU名を返す
    except Exception:
        return "N/A"

def check_egpu():
    try:
        gpu = get_gpu_info()
        if gpu == "N/A":
            return "Disconnected"
        else:
            return "Active!"
        
    except Exception:
        print("Error checking eGPU")
        return "Error"

def get_status():
    return {
        "pc": socket.gethostname(),
        "battery": get_battery(),
        "wan": check_wan(),
        "vpn": "Disconnected",  # 仮の値
        "port21": check_port_21(),
        "ram": get_ram_usage(),
        "egpu": check_egpu(),
        "gpu": get_gpu_info(),
        "driveE": get_drive_e_status()
    }


if __name__ == "__main__":
    print(json.dumps(get_status()))
