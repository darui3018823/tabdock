// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.6_devtools-r1

document.getElementById("forceSyncBtn").addEventListener("click", async () => {
    // 同期中アラート（SweetAlert2）
    await Swal.fire({
        title: '同期中…',
        text: 'サーバーからすべての情報を取得しています。',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // 1. 天気再取得
        if (typeof fetchWeather === "function") {
            await fetchWeather(); // 定義済み関数想定
        }

        // 2. ステータス再取得
        if (typeof fetchStatus === "function") {
            await fetchStatus(); // 定義済み関数想定
        }

        // 3. 予定再取得
        if (typeof loadSchedule === "function") {
            await loadSchedule(); // 定義済み関数想定
        }

        // 4. カレンダー再表示
        if (typeof renderCalendar === "function") {
            renderCalendar(currentDate); // 現在の月を再描画
        }

        await Swal.fire({
            icon: 'success',
            title: '同期完了',
            text: 'すべての情報を最新状態に更新しました。',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("同期中にエラー:", err);
        await Swal.fire({
            icon: 'error',
            title: '同期失敗',
            text: 'データ取得中にエラーが発生しました。'
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
