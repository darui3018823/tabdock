// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.5_about-r3

let timerInterval = null;
let remainingSeconds = 0;

function startTimer(minutes) {
    remainingSeconds = minutes * 60;

    const display = document.getElementById('timerDisplay');
    const cancelBtn = document.getElementById('cancelTimerBtn');

    if (timerInterval) clearInterval(timerInterval);

    updateTimerDisplay(); // 初期表示
    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            showTimerCompleted();
        }
    }, 1000);

    cancelBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        timerInterval = null;
        display.textContent = '--:--';
    });
}

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    document.getElementById('timerDisplay').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showTimerCompleted() {
    Swal.fire({
        title: '時間です！',
        text: 'タイマーが終了しました。',
        icon: 'success'
    });

    try {
        new Audio('https://cdn.daruks.com/common/notify.mp3').play();
    } catch (e) {
        console.warn(e);
    }
}
