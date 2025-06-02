const calendarGrid = document.getElementById("calendarGrid");
const currentMonthElem = document.getElementById("currentMonth");

let today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;

// 祝日判定（簡易版、日本の固定祝日のみ一部例示）
function isHoliday(year, month, day) {
    const holidays = [
        `${year}-01-01`, // 元日
        `${year}-02-11`, // 建国記念の日
        `${year}-04-29`, // 昭和の日
        `${year}-05-03`, // 憲法記念日
        `${year}-05-04`, // みどりの日
        `${year}-05-05`, // こどもの日
        `${year}-11-03`, // 文化の日
        `${year}-11-23`  // 勤労感謝の日
    ];
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return holidays.includes(d);
}

// カレンダー描画
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    currentMonthElem.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    calendarGrid.innerHTML = "";

    let totalCells = 35;
    const totalNeeded = firstDay + lastDate;

    let day = 1;
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");

        if (i >= firstDay && day <= lastDate) {
            const isFinalWeek = i >= 28;
            const remaining = lastDate - day + 1;

            if (i === 34 && remaining === 2) {
                // 最後の2日を1マスに収める
                const nextDay = day + 1;
                cell.innerHTML = `
                    <div>${day}</div>
                    <div class="text-white/50 text-xs">${nextDay}</div>
                `;
                cell.className = "p-1 rounded cursor-pointer hover:bg-white/20 transition text-sm leading-tight";
                applyColor(cell, i % 7, year, month, day);

                const mainDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                cell.addEventListener("click", () => renderSchedule(mainDateStr));

                calendarGrid.appendChild(cell);
                day += 2;
                continue;
            }

            // 通常表示
            cell.textContent = day;
            cell.className = "p-1 rounded cursor-pointer hover:bg-white/20 transition";
            applyColor(cell, i % 7, year, month, day);

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            cell.addEventListener("click", () => renderSchedule(dateStr));

            calendarGrid.appendChild(cell);
            day++;
        } else {
            calendarGrid.appendChild(document.createElement("div")); // 空白
        }
    }
}

// 曜日色＆今日判定
function applyColor(cell, weekday, year, month, day) {
    if (weekday === 0 || isHoliday(year, month, day)) {
        cell.classList.add("text-red-400");
    } else if (weekday === 6) {
        cell.classList.add("text-blue-400");
    }

    if (
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day
    ) {
        cell.classList.add("bg-white/20", "font-bold");
    }
}


// 月移動
document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// 初期描画
renderCalendar();
