let today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
let holidayMap = {};

const calendarGrid = document.getElementById("calendarGrid");
const currentMonthElem = document.getElementById("currentMonth");

document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

window.addEventListener("DOMContentLoaded", async () => {
    await fetchHolidayData();
    renderCalendar();
});

async function fetchHolidayData() {
    try {
        const res = await fetch("/api/holidays");
        holidayMap = await res.json();
    } catch (e) {
        console.error("祝日データの取得に失敗:", e);
        holidayMap = {}; // fallback
    }
}

function isHoliday(year, month, day) {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return d in holidayMap;
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    currentMonthElem.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    calendarGrid.innerHTML = "";

    let totalCells = 35;
    let day = 1;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");

        if (i >= firstDay && day <= lastDate) {
            const remaining = lastDate - day + 1;

            // 最終マスで残り2日を合成
            if (i === 34 && remaining === 2) {
                const nextDay = day + 1;
                cell.innerHTML = `
                    <div>${day}</div>
                    <div class="text-white/50 text-xs">${nextDay}</div>
                `;
                applyCellStyle(cell, i % 7, year, month, day);
                cell.addEventListener("click", () => renderSchedule(getDateStr(year, month, day)));
                calendarGrid.appendChild(cell);
                break;
            }

            cell.textContent = day;
            applyCellStyle(cell, i % 7, year, month, day);
            cell.addEventListener("click", () => renderSchedule(getDateStr(year, month, day)));
            calendarGrid.appendChild(cell);
            day++;
        } else {
            const blank = document.createElement("div");
            calendarGrid.appendChild(blank);
        }
    }
}

function applyCellStyle(cell, weekday, year, month, day) {
    cell.className = `
        flex flex-col justify-center items-center
        min-h-[36px] p-1 text-sm leading-tight
        rounded cursor-pointer hover:bg-white/20 transition
    `.trim();

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

function getDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
