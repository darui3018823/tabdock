// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.0_shift-parser-r1

function parseShiftText(text) {
    const lines = text.trim().split('\n');
    const shifts = [];
    
    for (const line of lines) {
        // 日付と時間の部分をマッチ
        const dateTimeMatch = line.match(/(\d+)\/(\d+)（([月火水木金土日])）\s*(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
        if (dateTimeMatch) {
            const [_, month, date, dayOfWeek, startHour, startMin, endHour, endMin] = dateTimeMatch;
            
            // 勤務先の部分を抽出（存在する場合）
            const locationMatch = line.match(/・(.+)$/);
            const location = locationMatch ? locationMatch[1].trim() : '';
            
            // 現在の年を取得
            const currentYear = new Date().getFullYear();
            
            shifts.push({
                date: `${currentYear}-${month.padStart(2, '0')}-${date.padStart(2, '0')}`,
                startTime: `${startHour.padStart(2, '0')}:${startMin.padStart(2, '0')}`,
                endTime: `${endHour.padStart(2, '0')}:${endMin.padStart(2, '0')}`,
                dayOfWeek,
                location
            });
        }
    }
    
    return shifts;
}

// シフト情報をスケジュールとして登録
async function registerShifts(shifts) {
    const scheduleData = shifts.map(shift => ({
        date: shift.date,
        time: shift.startTime,
        endTime: shift.endTime,
        title: `シフト${shift.location ? ` @ ${shift.location}` : ''}`,
        description: `勤務時間: ${shift.startTime} - ${shift.endTime}\n${shift.location ? `勤務先: ${shift.location}` : ''}`
    }));

    try {
        const res = await fetch('/api/shift', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
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
            throw new Error('シフト情報を認識できませんでした');
        }
        await registerShifts(shifts);
        return `${shifts.length}件のシフトを登録しました`;
    } catch (error) {
        throw error;
    }
};
