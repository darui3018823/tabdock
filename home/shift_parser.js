// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.7.0_shift-parser-r2

function getLoggedInUsername() {
    try {
        if (typeof window.getLoggedInUser === 'function') {
            const user = window.getLoggedInUser();
            if (user?.username) return user.username;
        }
        const stored = localStorage.getItem('tabdock_user');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.username) return parsed.username;
        }
    } catch (error) {
        console.warn('ユーザー情報の取得に失敗しました:', error);
    }
    return null;
}

function parseShiftText(text) {
    const lines = text.trim().split('\n');
    const shifts = [];
    let currentShift = null;
    
    for (const line of lines) {
        const dateTimeMatch = line.match(/(\d+)\/(\d+)（([月火水木金土日])）\s*(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
        if (dateTimeMatch) {
            if (currentShift) {
                shifts.push(currentShift);
            }
            const [_, month, date, dayOfWeek, startHour, startMin, endHour, endMin] = dateTimeMatch;
            
            const locationMatch = line.match(/・(.+)$/);
            let location = '';
            let title = '';
            
            if (locationMatch) {
                const fullMatch = locationMatch[1].trim();
                // シフトボードの場合、"［シフトボード］"で始まるタイトルが含まれる
                const shiftboardMatch = fullMatch.match(/^［シフトボード］(.+)/);
                if (shiftboardMatch) {
                    title = shiftboardMatch[1].trim();
                } else {
                    location = fullMatch;
                }
            }
            
            const currentYear = new Date().getFullYear();
            
            currentShift = {
                date: `${currentYear}-${month.padStart(2, '0')}-${date.padStart(2, '0')}`,
                startTime: `${startHour.padStart(2, '0')}:${startMin.padStart(2, '0')}`,
                endTime: `${endHour.padStart(2, '0')}:${endMin.padStart(2, '0')}`,
                dayOfWeek,
                location,
                title
            };
        }
    }
    
    if (currentShift) {
        shifts.push(currentShift);
    }
    return shifts;
}

async function registerShifts(shifts, username) {
    if (!username) {
        throw new Error('シフトを登録するにはログインが必要です');
    }

    const scheduleData = shifts.map(shift => ({
        date: shift.date,
        time: shift.startTime,
        endTime: shift.endTime,
        title: shift.title || `シフト${shift.location ? ` @ ${shift.location}` : ''}`,
        description: `勤務時間: ${shift.startTime} - ${shift.endTime}\n${shift.location ? `勤務先: ${shift.location}` : ''}`
    }));

    try {
        const res = await fetch('/api/shift', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData),
            credentials: 'include'
        });

        if (!res.ok) {
            throw new Error('シフト登録に失敗しました');
        }

        const result = await res.json();
        return result.message;
    } catch (error) {
        console.error('シフト登録エラー:', error);
        throw error;
    }
}

window.parseAndRegisterShifts = async function(text) {
    try {
        const shifts = parseShiftText(text);
        if (shifts.length === 0) {
            await Swal.fire({
                icon: 'error',
                title: 'エラー',
                text: 'シフト情報を認識できませんでした',
                confirmButtonText: '閉じる'
            });
            throw new Error('シフト情報を認識できませんでした');
        }

        const username = getLoggedInUsername();
        if (!username) {
            await Swal.fire({
                icon: 'warning',
                title: 'ログインが必要です',
                text: 'シフトの登録にはログインが必要です。',
                confirmButtonText: '閉じる'
            });
            throw new Error('ログインが必要です');
        }

        // 登録中の表示
        const loadingAlert = Swal.fire({
            title: '処理中...',
            text: 'シフトを登録しています',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        await registerShifts(shifts, username);

        // 登録完了の表示
        await loadingAlert.close();
        await Swal.fire({
            icon: 'success',
            title: '完了',
            text: `${shifts.length}件のシフトを登録しました`,
            timer: 2000,
            showConfirmButton: false
        });

        return `${shifts.length}件のシフトを登録しました`;
    } catch (error) {
        await Swal.fire({
            icon: 'error',
            title: 'エラー',
            text: error.message,
            confirmButtonText: '閉じる'
        });
        throw error;
    }
};
