const calendarGrid = document.getElementById("calendarGrid");
const currentMonthElem = document.getElementById("currentMonth");

let today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;

// 祝日判定
let holidayMap = {};

function isHoliday(year, month, day) {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return d in holidayMap;
}


async function fetchHolidayData() {
    try {
        const res = await fetch("/api/holidays");
        holidayMap = await res.json();
    } catch (e) {
        console.error("祝日取得失敗:", e);
        holidayMap = {}; // fallback: 無祝日モード
    }
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
    let day = 1;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");

        if (i >= firstDay && day <= lastDate) {
            cell.textContent = day;
            cell.className = "p-1 rounded cursor-pointer hover:bg-white/20 transition";
            applyColor(cell, i % 7, year, month, day);

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            cell.addEventListener("click", () => renderSchedule(dateStr));

            calendarGrid.appendChild(cell);
            day++;
        } else {
            calendarGrid.appendChild(document.createElement("div")); // 空白マス
        }
    }
}


const scheduleList = document.getElementById("scheduleList");

// 仮の予定データ
const schedules = [
    { date: "2025-06-03", title: "提出物締切", time: "17:00", description: "課題提出" },
    { date: "2025-06-04", title: "定例ミーティング", time: "19:00", description: "プロジェクト進捗" },
    { date: "2025-06-10", title: "通院", time: "09:30", description: "歯医者" },
];

function renderSchedule(dateStr) {
    selectedDate = dateStr;
    const filtered = schedules.filter(e => e.date === dateStr);
    scheduleList.innerHTML = "";

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.textContent = "この日には予定がありません";
        li.className = "text-white/50";
        scheduleList.appendChild(li);
        return;
    }

    for (const sched of filtered) {
        const li = document.createElement("li");
        li.classList.add("mb-2");

        const line1 = sched.time
            ? `${sched.time}${sched.endTime ? `~${sched.endTime}` : ""}`
            : "(時間未定)";

        const line2 = sched.title || "無題の予定";

        const content = document.createElement("div");
        content.innerHTML = `
            <div class="text-sm font-semibold">${line1}</div>
            <div class="text-xs text-white/70">${line2}</div>
        `;

        const detailBtn = document.createElement("button");
        detailBtn.textContent = "詳細";
        detailBtn.className = "text-xs text-blue-400 hover:underline ml-2";
        detailBtn.addEventListener("click", () => showScheduleDetail(sched));

        li.appendChild(content);
        li.appendChild(detailBtn);
        scheduleList.appendChild(li);
    }
}


document.getElementById("upcomingBtn").addEventListener("click", () => {
    const now = new Date();
    const upcoming = schedules
        .filter(e => new Date(e.date + "T" + (e.time || "00:00")) >= now)
        .sort((a, b) => new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00")));

    scheduleList.innerHTML = "";

    if (upcoming.length === 0) {
        const li = document.createElement("li");
        li.textContent = "今後の予定はありません";
        li.className = "text-white/50";
        scheduleList.appendChild(li);
        return;
    }

    for (const sched of upcoming.slice(0, 5)) { // 直近5件のみ表示（必要なら調整可）
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="font-semibold">${sched.date} ${sched.time} - ${sched.title}</div>
            <div class="text-xs text-white/70">${sched.description}</div>
        `;
        scheduleList.appendChild(li);
    }
});


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

window.addEventListener("DOMContentLoaded", async () => {
    await fetchHolidayData();
    await loadSchedules(); // ← ここを追加
    renderCalendar();

    // 本日の予定を表示
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    renderSchedule(todayStr);
});



// モーダル制御
document.getElementById("openScheduleModal").addEventListener("click", () => {
    document.getElementById("scheduleModal").classList.remove("hidden");
    document.getElementById("menuModal").classList.add("hidden");
});
document.getElementById("closeScheduleModal").addEventListener("click", () => {
    document.getElementById("scheduleModal").classList.add("hidden");
});

// 予定を追加
document.getElementById("addScheduleBtn").addEventListener("click", () => {
    const date = document.getElementById("scheduleDate").value;
    const time = document.getElementById("scheduleTime").value;
    const title = document.getElementById("scheduleTitle").value;
    const description = document.getElementById("scheduleDesc").value;

    if (!date || !title) {
        alert("日付とタイトルは必須です");
        return;
    }

    schedules.push({ date, time, title, description });
    document.getElementById("scheduleModal").classList.add("hidden");

    // 今見ている日と一致していれば更新
    if (selectedDate === date) {
        renderSchedule(date);
    }
});

async function loadSchedules() {
    try {
        const res = await fetch("/api/schedule");
        const data = await res.json();
        schedules.splice(0, schedules.length, ...data);
    } catch (e) {
        console.warn("予定読み込み失敗:", e);
    }
}


function convertToEmbedURL(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("google.com") && u.pathname.includes("/maps")) {
            // 任意の形式: 実際にはAPIによって変える必要あり
            return url.replace("/maps", "/maps/embed");
        }
    } catch (_) {}
    return null;
}

function showScheduleDetail(sched) {
    const content = document.getElementById("scheduleDetailContent");

    let timeStr = sched.allday
        ? "終日"
        : `${sched.date}${sched.time ? ` ${sched.time}` : ""}${sched.endTime ? `~${sched.endTime}` : ""}`;

    const formattedDescription = (sched.description || "なし").replace(/\n/g, "<br>");

    let locationHTML = "未指定";
    if (sched.location && sched.location.startsWith("http")) {
        locationHTML = `<a href="${sched.location}" target="_blank" class="text-blue-400 underline break-all">${sched.location}</a>`;
    } else if (sched.location) {
        locationHTML = sched.location;
    }

    const mapEmbed = sched.embedmap
        ? `<iframe src="${sched.embedmap}" class="w-full h-64 rounded border border-white/20 mt-2" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
        : "";

    content.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6 text-sm">
            <div class="md:w-1/2 space-y-3 leading-relaxed">
                <div>
                    <div class="font-semibold text-white/80">タイトル</div>
                    <div>${sched.title || "無題の予定"}</div>
                </div>
                <div>
                    <div class="font-semibold text-white/80">日付</div>
                    <div>${timeStr}</div>
                </div>
                <div>
                    <div class="font-semibold text-white/80">場所</div>
                    <div>${locationHTML}</div>
                </div>
                <div>
                    <div class="font-semibold text-white/80">メモ</div>
                    <div>${formattedDescription}</div>
                </div>
                ${sched.attachment ? `
                    <div>
                        <div class="font-semibold text-white/80">添付</div>
                        <div><a href="/home/assets/calendar/${sched.attachment}" class="text-blue-400 underline" target="_blank">${sched.attachment}</a></div>
                    </div>
                ` : ""}
            </div>
            <div class="md:w-1/2">${mapEmbed}</div>
        </div>
    `;

    document.getElementById("scheduleDetailModal").classList.remove("hidden");
}




document.getElementById("closeScheduleDetail").addEventListener("click", () => {
    document.getElementById("scheduleDetailModal").classList.add("hidden");
});
