// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.7.4_status-r3

function checkApi(endpoint, labelId) {
    const start = performance.now();
    fetch(endpoint, { method: "HEAD" })
        .then(res => {
            const ms = Math.round(performance.now() - start);
            const elem = document.getElementById(labelId);
            if (res.ok) {
                elem.textContent = `OK, ${ms}ms`;
                elem.className = "text-green-400";
            } else {
                elem.textContent = `Error`;
                elem.className = "text-red-400";
            }
        })
        .catch(() => {
            const elem = document.getElementById(labelId);
            elem.textContent = `失敗`;
            elem.className = "text-red-400";
        });
}

document.getElementById("openStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.remove("hidden");
    checkApi("/api/ping", "statusPing");
    checkApi("/api/weather", "statusWeather");
    checkApi("/api/schedule", "statusSchedule");
    checkApi("/api/status", "statusStatus");
    checkApi("/api/holidays", "statusHolidays");
});

document.getElementById("closeStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.add("hidden");
});

