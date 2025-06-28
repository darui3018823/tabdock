// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.8.4_status-r6

function checkApi(endpoint, labelId, method = "HEAD") {
    const start = performance.now();
    fetch(endpoint, { method })
        .then(res => {
            const ms = Math.round(performance.now() - start);
            const elem = document.getElementById(labelId);
            if (res.ok) {
                elem.textContent = `OK, ${ms}ms`;
                elem.className = "text-green-400";
            } else {
                elem.textContent = `エラー`;
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
    document.getElementById("menuModal")?.classList.add("hidden");
    document.getElementById("statusModal").classList.remove("hidden");

    checkApi("/api/ping", "statusPing", "HEAD");
    checkApi("/api/weather", "statusWeather", "HEAD");
    checkApi("/api/schedule", "statusSchedule", "HEAD");
    checkApi("/api/status", "statusStatus", "HEAD");
    checkApi("/api/holidays", "statusHolidays", "HEAD");

    const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    document.getElementById("statusUpdateTimePC").textContent = `PC Status 最終更新: ${document.getElementById("last-update")?.textContent ?? "--"}`;
    document.getElementById("statusUpdateTimeWeather").textContent = `天気予報 最終更新: ${now}`;
});

document.getElementById("closeStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.add("hidden");
});