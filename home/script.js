// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.6_scripts-r2

document.addEventListener("DOMContentLoaded", () => {
    let is24Hour = true;

    const clockEl = document.getElementById("clock");
    const dateEl = document.getElementById("date");
    const toggleBtn = document.getElementById("toggleFormat");
  
    const weekdays = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  
    function formatTime(now) {
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
    
        if (is24Hour) {
            return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
        } else {
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            return `${ampm} ${hours}:${minutes}:${seconds}`;
        }
    }
  
    function updateClock() {
        const now = new Date();
        clockEl.textContent = formatTime(now);
    }
  
    function updateDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const day = weekdays[now.getDay()];
        dateEl.textContent = `${y}/${m}/${d} (${day})`;
    }
  
    toggleBtn.addEventListener("click", () => {
        is24Hour = !is24Hour;
        updateClock();
    });
  
    // 初回更新
    updateClock();
    updateDate();
  
    // 毎秒時刻更新（秒のため）
    setInterval(updateClock, 1000);
  
    // 日付（曜日）は10秒ごとに更新（そんなに変化しないので）
    setInterval(updateDate, 10000);
  
    function updateLastUpdateTime() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const formatted = `${hh}:${mm}:${ss}`;
        document.getElementById("last-update").textContent = `Last Update: ${formatted}`;
    }
  
    function updatePCStatus() {
        fetch("/api/status")
            .then(res => res.json())
            .then(data => {
                document.getElementById("pc").textContent = " (" + data.pc + ") : Online";
                document.getElementById("port21").textContent = data.port21;
                document.getElementById("battery").textContent = data.battery;
                document.getElementById("egpu").textContent = data.egpu;
                document.getElementById("wan").textContent = data.wan;
        
                // 以下は右側カラム
                document.getElementById("gpu").textContent = data.gpu;
                document.getElementById("ram").textContent = data.ram;
                document.getElementById("drive-e").textContent = data.driveE;
                document.getElementById("vpn").textContent = data.vpn;
        
                updateLastUpdateTime();
        })
        .catch(err => console.error("Status fetch error:", err));
    }

    updatePCStatus();
    setInterval(updatePCStatus, 120000); // 120秒ごとに更新

    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        if (data.version) {
          const vEl = document.getElementById('version-text');
          if (vEl) vEl.textContent = 'Tabdock: v' + data.version;
        }
    });
    
});

window.fetchStatus = updatePCStatus;
