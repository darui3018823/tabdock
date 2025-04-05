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

    function updateStatusDisplay(data) {
        document.getElementById("pc-name").textContent = `PC (${data.pcName}): Online`;
        document.getElementById("port21").textContent = data.port21 ? "Active" : "Closed";
        document.getElementById("egpu").textContent = data.egpu ? "Active" : "Inactive";
        document.getElementById("wan").textContent = navigator.onLine ? "Active" : "Offline";
      
        navigator.getBattery().then(battery => {
          document.getElementById("battery").textContent = `${Math.round(battery.level * 100)}%`;
        });
    }
      
  });
