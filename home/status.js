// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.7.0_status-r1

document.getElementById("openStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.remove("hidden");

    // 各APIの確認
    fetch("/api/ping")
        .then(res => {
            document.getElementById("pingStatus").textContent = res.ok ? "OK" : "エラー";
            document.getElementById("pingStatus").className = res.ok ? "text-green-400" : "text-red-400";
        })
        .catch(() => {
            document.getElementById("pingStatus").textContent = "失敗";
            document.getElementById("pingStatus").className = "text-red-400";
        });

    fetch("/api/weather", { method: "HEAD" }) // HEADにして軽量に
        .then(res => {
            document.getElementById("weatherStatus").textContent = res.ok ? "OK" : "エラー";
            document.getElementById("weatherStatus").className = res.ok ? "text-green-400" : "text-red-400";
        })
        .catch(() => {
            document.getElementById("weatherStatus").textContent = "失敗";
            document.getElementById("weatherStatus").className = "text-red-400";
        });
});

document.getElementById("closeStatusModal").addEventListener("click", () => {
    document.getElementById("statusModal").classList.add("hidden");
});
