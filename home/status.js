// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.2.1_status-r1

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

    document.getElementById("statusUpdateTimePC").textContent =
        document.getElementById("last-update")?.textContent.replace("Last Update: ", "") ?? "--";

    const weatherLastUpdate = document.getElementById("weather-last-update")?.textContent;
    if (weatherLastUpdate && weatherLastUpdate.trim() !== "未取得") {
        document.getElementById("statusUpdateTimeWeather").textContent = weatherLastUpdate.trim();
    } else {
        document.getElementById("statusUpdateTimeWeather").textContent = "--";
    }
});


document.getElementById("closeStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
});

function setJsVersion(id, version) {
    const el = document.getElementById(`jsver-${id}-ver`);
    if (el) el.textContent = version;
}

async function fetchJsVersion(filename, id) {
    try {
        const res = await fetch(filename, {cache: "no-store"});
        const text = await res.text();
        const match = text.match(/This code Version:\s*([^\s]+)/);
        setJsVersion(id, match ? match[1] : "Unknown");
    } catch {
        setJsVersion(id, "Error");
    }
}

fetchJsVersion("script.js", "scripts.js");
fetchJsVersion("status.js", "status.js");
fetchJsVersion("weather.js", "weather.js");
fetchJsVersion("calendar.js", "calendar.js");
fetchJsVersion("ui_visibility.js", "ui_visibility.js");
fetchJsVersion("tabdock_about.js", "tabdock_about.js");
fetchJsVersion("devtools.js", "devtools.js");
fetchJsVersion("passkey.js", "passkey.js");
