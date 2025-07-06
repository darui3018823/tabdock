// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.5_about-r2

document.addEventListener('DOMContentLoaded', () => {
    const timerBtn = document.getElementById('startTimerBtn');
    if (!timerBtn) return;

    timerBtn.addEventListener('click', async () => {
        const { value: minutes } = await Swal.fire({
            title: 'タイマーをセット',
            input: 'number',
            inputLabel: '分数を入力してください（最大1440）',
            inputAttributes: {
                min: 1,
                max: 1440,
                step: 1
            },
            inputValue: 25,
            showCancelButton: true,
            confirmButtonText: '開始',
            cancelButtonText: 'キャンセル'
        });

        if (!minutes || minutes < 1) return;

        Swal.fire({
            title: 'タイマー開始',
            html: `残り <b>${minutes}</b> 分です`,
            timer: minutes * 60 * 1000,
            timerProgressBar: true,
            showConfirmButton: false,
            willClose: () => {
                Swal.fire({
                    title: '時間です！',
                    text: 'タイマーが終了しました。',
                    icon: 'success',
                    confirmButtonText: 'OK'
                });

                try {
                    const audio = new Audio('https://cdn.daruks.com/common/notify.mp3');
                    audio.play();
                } catch (e) {
                    console.warn('通知音の再生に失敗しました:', e);
                }

                if (Notification.permission === 'granted') {
                    new Notification('Tabdock タイマー', {
                        body: '設定したタイマーが終了しました。',
                        icon: '/home/assets/icon/alarm.png'
                    });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }
            }
        });
    });
});
