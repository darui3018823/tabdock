function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hh}:${mm}`;
}
// ==UserScript==
updateClock();
setInterval(updateClock, 10000); // 10秒おきに更新（1分でもOK）
