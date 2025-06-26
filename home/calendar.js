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

    trimScheduleListForPreview();
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

    for (const sched of upcoming.slice(0, 5)) {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="font-semibold">${sched.date} ${sched.time} - ${sched.title}</div>
            <div class="text-xs text-white/70">${sched.description}</div>
        `;
        scheduleList.appendChild(li);
    }

    trimScheduleListForPreview();
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

    // 日付変更の監視
    monitorDateChange();
});

function monitorDateChange() {
    let lastDate = today.getDate();

    setInterval(() => {
        const now = new Date();
        if (
            now.getDate() !== lastDate ||
            now.getMonth() !== today.getMonth() ||
            now.getFullYear() !== today.getFullYear()
        ) {
            today = now;
            lastDate = now.getDate();

            renderCalendar();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            renderSchedule(todayStr);
        }
    }, 60 * 1000);
}

// モーダル制御
document.getElementById("openScheduleModal").addEventListener("click", () => {
    document.getElementById("scheduleModal").classList.remove("hidden");
    document.getElementById("menuModal").classList.add("hidden");
});
document.getElementById("closeScheduleModal").addEventListener("click", () => {
    document.getElementById("scheduleModal").classList.add("hidden");
});

// 予定を追加
document.getElementById("addScheduleBtn").addEventListener("click", async () => {
    const date = document.getElementById("scheduleDate").value;
    const time = document.getElementById("scheduleTime").value;
    const title = document.getElementById("scheduleTitle").value;
    const rawLocation = document.getElementById("scheduleLocation").value.trim();
    const description = document.getElementById("scheduleDesc").value;
    const embedmap = document.getElementById("scheduleEmbedMap").value;
    const attachmentFile = document.getElementById("scheduleAttachment").files[0];

    if (!date || !title) {
        alert("日付とタイトルは必須です");
        return;
    }

    let location = rawLocation;
    if (rawLocation.startsWith("https://maps.app.goo.gl")) {
        location = `<a href="${rawLocation}" class="text-blue-400 underline" target="_blank">Google Maps</a>`;
    }

    const scheduleData = { date, time, title, location, description, embedmap };

    const form = new FormData();
    form.append("json", JSON.stringify(scheduleData));
    if (attachmentFile) {
        form.append("attachment", attachmentFile);
    }

    const res = await fetch("/api/schedule", {
        method: "POST",
        body: form
    });

    if (!res.ok) {
        alert("予定の追加に失敗しました");
        return;
    }

    schedules.push(scheduleData);
    document.getElementById("scheduleModal").classList.add("hidden");
    if (selectedDate === date) renderSchedule(date);
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

    const isImage = sched.attachment && /\.(jpe?g|png|gif|webp)$/i.test(sched.attachment);
    const attachmentHTML = sched.attachment && sched.attachment !== "null" ? `
        <div>
            <div class="font-semibold text-white/80">添付</div>
            <div class="break-all mb-2">
                <a href="/home/assets/calendar/${sched.attachment}" class="text-blue-400 underline" target="_blank">${sched.attachment}</a>
            </div>
            ${isImage ? `
            <div>
                <img src="/home/assets/calendar/${sched.attachment}" alt="添付画像" class="max-w-full rounded border border-white/20">
            </div>` : ""}
        </div>
    ` : "";

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
                ${attachmentHTML}
            </div>
            <div class="md:w-1/2">${mapEmbed}</div>
        </div>
    `;

    document.getElementById("scheduleDetailModal").classList.remove("hidden");
}


document.getElementById("closeScheduleDetail").addEventListener("click", () => {
    document.getElementById("scheduleDetailModal").classList.add("hidden");
});

function trimScheduleListForPreview() {
    const list = document.getElementById("scheduleList");
    const items = Array.from(list.children);

    // 過去の「もっと見る」を削除
    const existingMore = document.getElementById("moreScheduleItem");
    if (existingMore) existingMore.remove();

    if (items.length > 3) {
        // 3件目以降を非表示
        items.forEach((el, index) => {
            el.classList.toggle("hidden", index >= 2);
        });

        // 「もっと見る」を3件目として追加
        const moreItem = document.createElement("li");
        moreItem.id = "moreScheduleItem";
        moreItem.innerHTML = `<button class="text-blue-400 hover:underline text-left">+ もっと見る...</button>`;
        moreItem.querySelector("button").addEventListener("click", openAllScheduleModal);
        list.insertBefore(moreItem, items[2]);
    }
}

function openAllScheduleModal() {
    const allModal = document.getElementById("allScheduleModal");
    const fullList = document.getElementById("allScheduleList");
    const scheduleList = document.getElementById("scheduleList");

    fullList.innerHTML = "";
    const cloned = Array.from(scheduleList.children).filter(el => el.id !== "moreScheduleItem");

    cloned.forEach(el => {
        const copy = el.cloneNode(true);
        copy.classList.remove("hidden");

        // 🔽 詳細ボタンを再検索してイベント追加
        const detailBtn = copy.querySelector("button");
        if (detailBtn && detailBtn.textContent.includes("詳細")) {
            const index = cloned.indexOf(el);  // 元の位置から予定データを推定
            const dateStr = selectedDate;
            const filtered = schedules.filter(e => e.date === dateStr);
            const sched = filtered[index];
            if (sched) {
                detailBtn.addEventListener("click", () => showScheduleDetail(sched));
            }
        }

        fullList.appendChild(copy);
    });

    allModal.classList.remove("hidden");
}

document.getElementById("closeAllScheduleModal").addEventListener("click", () => {
    document.getElementById("allScheduleModal").classList.add("hidden");
});
