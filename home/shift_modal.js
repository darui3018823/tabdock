// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.1.0-shift_modal-r1

document.addEventListener('DOMContentLoaded', () => {
    const shiftModal = document.getElementById('shiftScheduleModal');
    const shiftTextArea = document.getElementById('scheduleShiftText');
    const closeShiftBtn = document.getElementById('closeShiftScheduleModal');
    const addShiftBtn = document.getElementById('addShiftScheduleBtn');

    // シフトモーダルを閉じるとき、テキストエリアをクリア
    closeShiftBtn.addEventListener('click', () => {
        shiftTextArea.value = '';
        shiftModal.classList.add('hidden');
    });

    // シフト追加後、テキストエリアをクリア
    addShiftBtn.addEventListener('click', async () => {
        const text = shiftTextArea.value;
        if (!text.trim()) {
            await Swal.fire({
                icon: 'error',
                title: 'エラー',
                text: 'シフト情報を入力してください',
                confirmButtonText: '閉じる'
            });
            return;
        }

        try {
            await window.parseAndRegisterShifts(text);
            shiftTextArea.value = ''; // シフト登録成功後にテキストエリアをクリア
            shiftModal.classList.add('hidden');
            
            // カレンダーを再読み込み
            if (typeof loadSchedules === 'function') {
                await loadSchedules();
            }
        } catch (error) {
            console.error('シフト登録エラー:', error);
        }
    });
});
