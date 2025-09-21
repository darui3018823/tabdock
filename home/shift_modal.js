// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.3.0-shift_modal-r1

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('shiftScheduleModal');
    const textarea = document.getElementById('scheduleShiftText');
    const closeBtn = document.getElementById('closeShiftScheduleModal');
    const addBtn = document.getElementById('addShiftScheduleBtn');
    const addAndContinueBtn = document.getElementById('addShiftScheduleAndContinueBtn');

    function closeModal() {
        modal.classList.add('hidden');
        document.getElementById('scheduleTypeModal')?.classList.remove('hidden');
    }

    function clearInputs() {
        textarea.value = '';
    }

    closeBtn?.addEventListener('click', () => {
        clearInputs();
        closeModal();
    });

    async function addShift({ continueAfter = false } = {}) {
        const text = textarea.value;
        if (!text.trim()) {
            await Swal.fire({ icon: 'warning', title: '未入力', text: 'シフト情報を入力してください' });
            return;
        }

        // 登録処理
        try {
            const loading = Swal.fire({
                title: '処理中...',
                text: 'シフトを登録しています',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading(),
            });

            const result = await window.parseAndRegisterShifts(text);

            await (await loading).close();

            if (continueAfter) {
                Toast?.fire({ icon: 'success', title: '登録しました（続けて入力できます）' });
                clearInputs();
                textarea.focus();
            } else {
                Toast?.fire({ icon: 'success', title: result || 'シフトを登録しました' });
                clearInputs();
                closeModal();
            }

            // カレンダーの再取得
            if (typeof loadSchedules === 'function') {
                await loadSchedules();
            }

            // 先頭のシフト日付にスクロール/表示
            try {
                const shifts = parseShiftText(text);
                if (Array.isArray(shifts) && shifts.length > 0) {
                    renderSchedule(shifts[0].date);
                }
            } catch (_) {}
        } catch (error) {
            console.error('シフト登録エラー:', error);
            await Swal.fire({ icon: 'error', title: '失敗', text: error?.message || '登録に失敗しました' });
        }
    }

    addBtn?.addEventListener('click', () => addShift({ continueAfter: false }));
    addAndContinueBtn?.addEventListener('click', () => addShift({ continueAfter: true }));

    // キーボードショートカット（Ctrl+Enter で続けて追加、Esc で閉じる）
    document.addEventListener('keydown', (e) => {
        const isOpen = !modal.classList.contains('hidden');
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeBtn?.click();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addShift({ continueAfter: true });
        }
    });
});
