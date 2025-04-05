document.addEventListener("DOMContentLoaded", () => {
    let is24Hour = true;
  
    const clockEl = document.getElementById("clock");
    const ampmEl = document.getElementById("ampm");
    const toggleBtn = document.getElementById("toggleFormat");
  
    function updateClock() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
  
      if (is24Hour) {
        clockEl.textContent = `${String(hours).padStart(2, '0')}:${minutes}`;
      } else {
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        clockEl.textContent = `${ampm} ${hours}:${minutes}`;
      }
      
    }
  
    toggleBtn.addEventListener("click", () => {
      is24Hour = !is24Hour;
      updateClock();
    });
  
    updateClock();
    setInterval(updateClock, 10000); // 10秒ごと更新

    function updatePCStatus() {
        fetch("/api/status")
          .then(res => res.json())
          .then(data => {
            document.getElementById("pc-online").textContent = data.pc + ": Online";
            document.getElementById("port21").textContent = data.port21;
            document.getElementById("battery").textContent = data.battery;
            document.getElementById("egpu").textContent = data.egpu;
            document.getElementById("wan").textContent = data.wan;
      
            document.getElementById("temp").textContent = data.temp;
            document.getElementById("gpu-load").textContent = data.gpuLoad;
            document.getElementById("ram").textContent = data.ram;
            document.getElementById("drive-e").textContent = data.driveE;
            document.getElementById("vpn").textContent = data.vpn;
          })
          .catch(err => console.error("Status fetch error:", err));
      }
      
      setInterval(updatePCStatus, 5000); // 5秒ごと更新
      updatePCStatus(); // 初回実行      
      
  });
