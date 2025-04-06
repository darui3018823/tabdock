document.addEventListener("DOMContentLoaded", () => {
    let is24Hour = true;
  
    const clockEl = document.getElementById("clock");
    const toggleBtn = document.getElementById("toggleFormat");
  
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
    
        if (is24Hour) {
            clockEl.textContent = `${String(hours).padStart(2, '0')}:${minutes}`;
            if (document.getElementById("ampm")) {
            document.getElementById("ampm").textContent = "";
            }
        } else {
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            clockEl.textContent = `${ampm} ${hours}:${minutes}`;
            if (document.getElementById("ampm")) {
            document.getElementById("ampm").textContent = ampm;
            }
        }
    }
  
    toggleBtn.addEventListener("click", () => {
        is24Hour = !is24Hour;
        updateClock();
    });
  
    updateClock();
    setInterval(updateClock, 10000); // 10秒ごとに時計更新
  
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
                document.getElementById("pc-online").textContent = data.pc + ": Online";
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
  
    updatePCStatus(); // 初回実行
    setInterval(updatePCStatus, 120000); // 120秒ごとに更新
  });
  