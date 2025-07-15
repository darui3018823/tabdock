// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.6_devtools-r2

document.getElementById("forceSyncBtn").addEventListener("click", async () => {
    await Swal.fire({
        title: '完全同期中…',
        text: '全データをサーバーから再取得しています。',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // 天気
        if (typeof fetchWeather === "function") await fetchWeather();

        // ステータス
        if (typeof fetchStatus === "function") await fetchStatus();

        // 予定一覧
        if (typeof loadSchedule === "function") await loadSchedule();

        // 祝日再取得
        if (typeof fetchHolidayData === "function") await fetchHolidayData();

        // カレンダー再描画
        if (typeof renderCalendar === "function") renderCalendar();

        // 日付再描画
        if (typeof updateDate === "function") updateDate();

        // 時刻再描画
        if (typeof updateClock === "function") updateClock();

        await Swal.fire({
            icon: 'success',
            title: '同期完了',
            text: 'すべての情報を最新状態に更新しました。',
            timer: 1800,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("同期中にエラー:", err);
        await Swal.fire({
            icon: 'error',
            title: '同期失敗',
            text: '一部または全体のデータ取得に失敗しました。'
        });
    }
});


document.getElementById("openDevMenuBtn").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("devMenuModal").classList.remove("hidden");
});
document.getElementById("closeDevMenuModal").addEventListener("click", () => {
    document.getElementById("devMenuModal").classList.add("hidden");
});
document.getElementById("reloadScriptsBtn").addEventListener("click", () => {
    location.reload();
});
document.getElementById("clearLocalStorageBtn").addEventListener("click", () => {
    localStorage.clear();
    alert("ローカルストレージを初期化しました。");
});
document.getElementById("showDebugLogBtn").addEventListener("click", () => {
    console.log("現在の状態:");
    console.log(localStorage);
});

window.fetchStatus = updatePCStatus;
window.updateDate = updateDate;
window.updateClock = updateClock;
