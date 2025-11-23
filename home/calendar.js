// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.13.2_calendar-r1

const calendarGrid = document.getElementById("calendarGrid");
const currentMonthElem = document.getElementById("currentMonth");

let today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;

if (typeof window !== 'undefined') {
    window.selectedDate = selectedDate;
}

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
        holidayMap = {};
    }
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
            cell.textContent = day;
            cell.className = "p-1 rounded cursor-pointer hover:bg-white/20 transition flex items-center justify-center text-center";
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

const schedules = [
    { date: "2025-06-03", title: "提出物締切", time: "17:00", description: "課題提出" },
    { date: "2025-06-04", title: "定例ミーティング", time: "19:00", description: "プロジェクト進捗" },
    { date: "2025-06-10", title: "通院", time: "09:30", description: "歯医者" },
];

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

function renderSchedule(dateStr) {
    selectedDate = dateStr;
    if (typeof window !== 'undefined') {
        window.selectedDate = selectedDate;
    }
    const filtered = schedules.filter(e => e.date === dateStr);
    scheduleList.innerHTML = "";

    const holidayName = holidayMap[dateStr];
    if (holidayName) {
        const holidayItem = document.createElement('li');
        holidayItem.className = 'mb-2 rounded border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100 shadow';
        holidayItem.dataset.calendarFixed = 'holiday';
        holidayItem.innerHTML = `<div class="font-semibold text-red-200">祝日: ${holidayName}</div>`;
        scheduleList.appendChild(holidayItem);
    }

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.textContent = "この日には予定がありません";
        li.className = "text-white/50";
        scheduleList.appendChild(li);
        window.dispatchEvent(new CustomEvent('calendar:schedule-rendered', {
            detail: { date: dateStr, container: scheduleList }
        }));
        return;
    }

    filtered.forEach((sched, index) => {
        const li = document.createElement("li");
        li.classList.add("mb-2");
        li.dataset.scheduleItem = 'true';
        li.dataset.schedulePos = String(index);

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
    });

    trimScheduleListForPreview();

    window.dispatchEvent(new CustomEvent('calendar:schedule-rendered', {
        detail: { date: dateStr, container: scheduleList }
    }));
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
    await loadSchedules();
    renderCalendar();

    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    renderSchedule(todayStr);

    monitorDateChange();
});

window.fetchHolidayData = fetchHolidayData;


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

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: '新しい日付に更新されました。',
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true
            });
        }
    }, 60 * 1000);
}

class CalendarManager {
    async refreshCalendar({ keepSelection = false, forceReload = false, reloadHolidays = false, reloadSchedules = true } = {}) {
        const tasks = [];
        if (forceReload || reloadHolidays) {
            tasks.push(fetchHolidayData());
        }
        if (forceReload || reloadSchedules) {
            tasks.push(loadSchedules());
        }

        if (tasks.length) {
            try {
                await Promise.all(tasks);
            } catch (error) {
                console.warn('カレンダー再生成中にエラーが発生しました:', error);
            }
        }

        renderCalendar();

        const targetDate = keepSelection && window.selectedDate
            ? window.selectedDate
            : this.getTodayString();
        renderSchedule(targetDate);
    }

    async reloadSchedules({ keepSelection = true } = {}) {
        try {
            await loadSchedules();
        } catch (error) {
            console.warn('予定の再読み込みに失敗しました:', error);
        }
        renderCalendar();
        if (keepSelection && window.selectedDate) {
            renderSchedule(window.selectedDate);
        }
    }

    getTodayString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    getSelectedDate() {
        return window.selectedDate || null;
    }
}

// 予定種類選択モーダルの制御
document.getElementById("openScheduleTypeModal").addEventListener("click", () => {
    document.getElementById("scheduleTypeModal").classList.remove("hidden");
    document.getElementById("menuModal").classList.add("hidden");
});

document.getElementById("closeScheduleTypeModal").addEventListener("click", () => {
    document.getElementById("scheduleTypeModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
});

// 通常予定モーダルの制御
const regularDetailToggle = document.getElementById('regularToggleDetail');
const regularDetailSection = document.getElementById('regularDetailSection');

const regularForm = {
    date: document.getElementById("scheduleDate"),
    time: document.getElementById("scheduleTime"),
    allDay: document.getElementById('scheduleAllDay'),
    timeInputsRow: document.getElementById('timeInputsRow'),
    startTime: document.getElementById('scheduleStartTime'),
    endTime: document.getElementById('scheduleEndTime'),
    location: document.getElementById("scheduleLocation"),
    desc: document.getElementById("scheduleDesc"),
    descCounter: document.getElementById('scheduleDescCounter'),
    embedMap: document.getElementById("scheduleEmbedMap"),
    attachment: document.getElementById("scheduleAttachment"),
    icsFile: document.getElementById("scheduleIcsFile"),
    embedAuto: document.getElementById("embedAuto"),
    icsInfo: document.getElementById("scheduleIcsInfo"),
    attachmentName: document.getElementById("scheduleAttachmentName"),
    title: document.getElementById("scheduleTitle"),
    detailSection: regularDetailSection,
    detailToggle: regularDetailToggle,
    detailToggleIcon: regularDetailToggle?.querySelector('.td-detail-toggle-icon'),
    detailToggleText: regularDetailToggle?.querySelector('.td-detail-toggle-text'),
};

document.getElementById("openRegularScheduleBtn").addEventListener("click", () => {
    document.getElementById("scheduleTypeModal").classList.add("hidden");
    const modal = document.getElementById("regularScheduleModal");
    modal.classList.remove("hidden");

    // 初期選択日（selectedDate があればそれ、なければ今日）を date に反映
    const targetDate = selectedDate || (() => {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    })();
    if (regularForm.date && !regularForm.date.value) {
        regularForm.date.value = targetDate;
    }

    // 詳細セクションは最初閉じる
    if (regularForm.detailSection) {
        setRegularDetailState(false);
    }

    // 軽い初期化（タイトルは維持、説明/場所/時間/添付はクリア）
    if (regularForm.startTime) regularForm.startTime.value = "";
    if (regularForm.endTime) regularForm.endTime.value = "";
    if (regularForm.time) regularForm.time.value = "";
    if (regularForm.location) regularForm.location.value = "";
    if (regularForm.desc) regularForm.desc.value = "";
    if (regularForm.embedMap) {
        regularForm.embedMap.value = "";
        regularForm.embedMap.disabled = false;
        regularForm.embedMap.classList.remove("td-input-disabled");
    }
    if (regularForm.attachment) regularForm.attachment.value = "";
    if (regularForm.icsFile) regularForm.icsFile.value = "";
    if (regularForm.icsInfo) regularForm.icsInfo.textContent = "";
    if (regularForm.embedAuto) regularForm.embedAuto.checked = false;
    updateScheduleDescCounter();
    if (regularForm.attachmentName) regularForm.attachmentName.textContent = "";

    regularForm.title?.focus();
});

document.getElementById("closeRegularScheduleModal").addEventListener("click", () => {
    document.getElementById("regularScheduleModal").classList.add("hidden");
    document.getElementById("scheduleTypeModal").classList.remove("hidden");
});

document.getElementById("openShiftScheduleBtn").addEventListener("click", () => {
    document.getElementById("scheduleTypeModal").classList.add("hidden");
    document.getElementById("shiftScheduleModal").classList.remove("hidden");
});

document.getElementById("closeShiftScheduleModal").addEventListener("click", () => {
    document.getElementById("shiftScheduleModal").classList.add("hidden");
    document.getElementById("scheduleTypeModal").classList.remove("hidden");
});

function assembleTimeString() {
    const { allDay: allDayEl, startTime: startEl, endTime: endEl } = regularForm;
    const allDay = allDayEl?.checked;
    if (allDay) return '';
    const start = startEl?.value || '';
    const end = endEl?.value || '';
    if (start && end) return `${start}~${end}`;
    if (start) return start;
    return '';
}

function applyTimePreset(range) {
    const { startTime: startEl, endTime: endEl } = regularForm;
    if (range === 'now+60') {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const start = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const endDate = new Date(now.getTime() + 60 * 60000);
        const end = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
        startEl.value = start;
        endEl.value = end;
        return;
    }
    const [s, e] = range.split('-');
    startEl.value = s || '';
    endEl.value = e || '';
}

function setRegularDetailState(shouldOpen) {
    const { detailSection, detailToggle, detailToggleIcon, detailToggleText } = regularForm;
    if (!detailSection || !detailToggle) return;

    detailSection.classList.toggle('hidden', !shouldOpen);
    detailToggle.setAttribute('aria-expanded', String(shouldOpen));

    if (detailToggleIcon) detailToggleIcon.textContent = shouldOpen ? '▲' : '▼';
    if (detailToggleText) detailToggleText.textContent = shouldOpen ? '詳細設定を隠す' : '詳細設定を表示';
}

const KILO_BYTES = 1024;
const MEGA_BYTES = KILO_BYTES * KILO_BYTES;
const DESC_WARN_THRESHOLD = 50;

function encodeDescriptionForSave(text) {
    return (text || '').replace(/\n/g, '\\n');
}

function decodeDescriptionForEdit(text) {
    return (text || '').replace(/\\n/g, '\n');
}

function updateScheduleDescCounter() {
    const { desc, descCounter: counter } = regularForm;
    if (!desc || !counter) return;

    const max = typeof desc.maxLength === 'number' && desc.maxLength > 0 ? desc.maxLength : null;
    const length = desc.value.length;
    const remaining = max ? max - length : null;

    counter.textContent = max ? `${length}/${max}` : `${length}`;

    let state = '';
    if (remaining !== null) {
        if (remaining <= 0) {
            state = 'max';
        } else if (remaining <= DESC_WARN_THRESHOLD) {
            state = 'warn';
        }
    }

    if (state) {
        counter.dataset.state = state;
    } else {
        delete counter.dataset.state;
    }
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes >= MEGA_BYTES) return `${(bytes / MEGA_BYTES).toFixed(1)} MB`;
    if (bytes >= KILO_BYTES) return `${(bytes / KILO_BYTES).toFixed(1)} KB`;
    return `${bytes} B`;
}

document.getElementById('timeQuickPresets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-range]');
    if (!btn) return;
    applyTimePreset(btn.dataset.range);
});

regularForm.allDay?.addEventListener('change', (e) => {
    const disabled = e.target.checked;
    regularForm.timeInputsRow?.classList.toggle('opacity-50', disabled);
    if (regularForm.startTime) regularForm.startTime.disabled = disabled;
    if (regularForm.endTime) regularForm.endTime.disabled = disabled;
});

document.getElementById('scheduleAttachment')?.addEventListener('change', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    const nameEl = regularForm.attachmentName;
    if (!nameEl) return;
    const file = input.files?.[0];
    if (file) {
        const sizeLabel = formatFileSize(file.size);
        nameEl.textContent = `選択中: ${file.name}${sizeLabel ? ` (${sizeLabel})` : ''}`;
    } else {
        nameEl.textContent = '';
    }
});

document.getElementById('scheduleLocation')?.addEventListener('change', () => {
    updateEmbedFromLocation();
});

function updateEmbedFromLocation() {
    if (!regularForm.embedAuto?.checked) return;
    const locationValue = regularForm.location?.value.trim();
    if (!locationValue || !regularForm.embedMap) return;
    const embed = convertToEmbedURL(locationValue);
    if (embed) regularForm.embedMap.value = embed;
}

document.getElementById('embedAuto')?.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const auto = target.checked;
    regularForm.embedMap?.classList.toggle('td-input-disabled', auto);
    if (regularForm.embedMap) {
        regularForm.embedMap.disabled = auto;
    }
    if (auto) {
        updateEmbedFromLocation();
    }
});

document.getElementById('scheduleDesc')?.addEventListener('input', updateScheduleDescCounter);

document.getElementById('regularClearLocation')?.addEventListener('click', () => {
    if (regularForm.location) {
        regularForm.location.value = '';
        regularForm.location.focus();
    }
    if (regularForm.embedMap) regularForm.embedMap.value = '';
});

document.getElementById('regularClearMemo')?.addEventListener('click', () => {
    if (regularForm.desc) {
        regularForm.desc.value = '';
        regularForm.desc.focus();
    }
    if (regularForm.attachment) regularForm.attachment.value = '';
    if (regularForm.attachmentName) regularForm.attachmentName.textContent = '';
    updateScheduleDescCounter();
});

function unfoldIcsLines(raw) {
    if (typeof raw !== 'string') return [];
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const result = [];
    for (const line of lines) {
        if (/^[ \t]/.test(line)) {
            if (result.length === 0) continue;
            result[result.length - 1] += line.slice(1);
        } else {
            result.push(line);
        }
    }
    return result;
}

function parseIcsProperty(line) {
    if (!line || !line.includes(':')) return null;
    const colonIndex = line.indexOf(':');
    const propPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const segments = propPart.split(';');
    const name = segments.shift();
    if (!name) return null;
    const params = {};
    for (const segment of segments) {
        const [paramName, paramValue] = segment.split('=');
        if (paramName && paramValue) {
            params[paramName.toUpperCase()] = paramValue;
        }
    }
    return { name: name.toUpperCase(), value, params };
}

function decodeIcsText(text = '') {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

function parseIcsDateValue(prop) {
    if (!prop || !prop.value) return null;
    const rawValue = prop.value.trim();
    if (!rawValue) return null;

    const isDateOnly = prop.params?.VALUE === 'DATE' || /^\d{8}$/.test(rawValue);
    if (isDateOnly) {
        const y = rawValue.slice(0, 4);
        const m = rawValue.slice(4, 6);
        const d = rawValue.slice(6, 8);
        return { date: `${y}-${m}-${d}`, allDay: true };
    }

    const match = rawValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|([+\-]\d{2})(\d{2}))?$/);
    if (!match) return null;

    const [, y, m, d, hh, mm, ss, tz, tzHour, tzMin] = match;
    let dateObj;
    if (tz === 'Z' || tzHour) {
        let iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
        if (tz === 'Z') {
            iso += 'Z';
        } else if (tzHour) {
            iso += `${tzHour}:${tzMin}`;
        }
        dateObj = new Date(iso);
    } else {
        const year = Number(y);
        const month = Number(m) - 1;
        const day = Number(d);
        const hour = Number(hh);
        const minute = Number(mm);
        const second = Number(ss);
        dateObj = new Date(year, month, day, hour, minute, second);
    }

    if (Number.isNaN(dateObj.getTime())) {
        return {
            date: `${y}-${m}-${d}`,
            time: `${hh}:${mm}`,
            allDay: false
        };
    }

    const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    return { date: formattedDate, time: formattedTime, allDay: false };
}

function parseIcsEvent(text) {
    const lines = unfoldIcsLines(text);
    let inEvent = false;
    const props = {};

    for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            continue;
        }
        if (upper.startsWith('END:VEVENT')) {
            break;
        }
        if (!inEvent) continue;

        const prop = parseIcsProperty(line);
        if (!prop || !prop.name) continue;
        if (!(prop.name in props)) {
            props[prop.name] = prop;
        }
    }

    if (!inEvent || !props.DTSTART) {
        return null;
    }

    const start = parseIcsDateValue(props.DTSTART);
    const end = parseIcsDateValue(props.DTEND);

    if (!start || !start.date) {
        return null;
    }

    const event = {
        title: decodeIcsText(props.SUMMARY?.value || ''),
        location: decodeIcsText(props.LOCATION?.value || ''),
        description: decodeIcsText(props.DESCRIPTION?.value || ''),
        date: start.date,
        allDay: !!start.allDay,
        startTime: start.time || ''
    };

    if (end) {
        if (event.allDay) {
            if (end.date && end.date !== event.date) {
                event.endDate = end.date;
            }
        } else {
            if (end.time) {
                event.endTime = end.time;
            }
            if (end.date && end.date !== event.date) {
                event.endDate = end.date;
            }
        }
    }

    return event;
}

function applyIcsEventToForm(event) {
    if (!event) return;

    const {
        date: dateEl,
        allDay: allDayEl,
        startTime: startEl,
        endTime: endEl,
        title: titleEl,
        location: locationEl,
        embedAuto: autoEmbed,
        embedMap: embedEl,
        desc: descEl
    } = regularForm;

    if (dateEl && event.date) {
        dateEl.value = event.date;
    }

    if (allDayEl) {
        allDayEl.checked = !!event.allDay;
        allDayEl.dispatchEvent(new Event('change'));
    }

    if (event.allDay) {
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
    } else {
        if (startEl) startEl.value = event.startTime || '';
        if (endEl) endEl.value = event.endTime || '';
    }

    if (titleEl && event.title) {
        titleEl.value = event.title;
    }

    if (locationEl) {
        locationEl.value = event.location || '';
        if (autoEmbed?.checked && event.location) {
            const embed = convertToEmbedURL(event.location);
            if (embed && embedEl) {
                embedEl.value = embed;
            }
        }
    }

    if (descEl) {
        descEl.value = event.description || '';
        updateScheduleDescCounter();
    }
}

document.getElementById('scheduleIcsFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const infoEl = document.getElementById('scheduleIcsInfo');
    if (infoEl) infoEl.textContent = '';

    if (!file) return;

    try {
        const text = await file.text();
        const event = parseIcsEvent(text);
        if (!event) {
            throw new Error('VEVENT not found');
        }
        applyIcsEventToForm(event);

        if (infoEl) {
            const parts = [];
            if (event.title) parts.push(`件名: ${event.title}`);
            if (event.allDay) {
                let label = `日付: ${event.date} (終日)`;
                if (event.endDate) {
                    label += ` → ${event.endDate}`;
                }
                parts.push(label);
            } else {
                const times = [event.startTime, event.endTime].filter(Boolean).join(' ~ ');
                const datePart = times ? `${event.date} ${times}` : `${event.date}`;
                parts.push(`日時: ${datePart}`);
                if (event.endDate && event.endDate !== event.date) {
                    parts.push(`終了日: ${event.endDate}`);
                }
            }
            infoEl.textContent = parts.join(' / ') || `${file.name} を読み込みました`;
        }

        if (typeof Toast !== 'undefined' && typeof Toast.fire === 'function') {
            Toast.fire({ icon: 'success', title: 'ICSファイルを読み込みました' });
        } else {
            Swal.fire({ icon: 'success', title: 'ICSファイルを読み込みました', showConfirmButton: false, timer: 2000 });
        }
    } catch (error) {
        console.error('ICS読み込み失敗:', error);
        Swal.fire({ icon: 'error', title: 'ICSの読み込みに失敗しました', text: 'ファイルの内容を確認してください。' });
    } finally {
        e.target.value = '';
    }
});

function resetRegularScheduleForm() {
    if (regularForm.startTime) regularForm.startTime.value = '';
    if (regularForm.endTime) regularForm.endTime.value = '';
    if (regularForm.time) regularForm.time.value = '';
    if (regularForm.location) regularForm.location.value = '';
    if (regularForm.desc) regularForm.desc.value = '';
    if (regularForm.embedMap) {
        regularForm.embedMap.value = '';
        regularForm.embedMap.disabled = false;
        regularForm.embedMap.classList.remove('td-input-disabled');
    }
    if (regularForm.attachment) regularForm.attachment.value = '';
    if (regularForm.icsFile) regularForm.icsFile.value = '';
    if (regularForm.icsInfo) regularForm.icsInfo.textContent = '';
    if (regularForm.embedAuto) regularForm.embedAuto.checked = false;
    updateScheduleDescCounter();
    if (regularForm.attachmentName) regularForm.attachmentName.textContent = '';
}

async function submitRegularSchedule({ continueAfter = false } = {}) {
    const {
        date: dateEl,
        title: titleEl,
        location: locationEl,
        desc: descEl,
        embedMap: embedMapEl,
        attachment: attachmentEl
    } = regularForm;

    const date = dateEl.value;
    const time = assembleTimeString();
    const title = titleEl.value;
    const rawLocation = locationEl.value.trim();
    const description = encodeDescriptionForSave(descEl.value);
    const embedmap = embedMapEl.value;
    const attachmentFile = attachmentEl.files[0];

    if (!date || !title) {
        Swal.fire({ icon: 'warning', title: '未入力があります', text: '日付とタイトルは必須です。' });
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
        Swal.fire({ icon: 'error', title: '追加に失敗しました', text: 'しばらくしてから再度お試しください。' });
        return;
    }

    schedules.push(scheduleData);

    if (continueAfter) {
        resetRegularScheduleForm();
        Toast?.fire({ icon: 'success', title: '追加しました（続けて入力できます）' });
        regularForm.title?.focus();
    } else {
        document.getElementById("regularScheduleModal").classList.add("hidden");
        document.getElementById("menuModal").classList.remove("hidden");
        Toast?.fire({ icon: 'success', title: '予定を追加しました' });
    }

    if (selectedDate === date) renderSchedule(date);
}

document.getElementById("addRegularScheduleBtn").addEventListener("click", () => submitRegularSchedule({ continueAfter: false }));
document.getElementById("addRegularScheduleAndContinueBtn")?.addEventListener("click", () => submitRegularSchedule({ continueAfter: true }));

document.addEventListener('keydown', (e) => {
    const modalOpen = !document.getElementById('regularScheduleModal')?.classList.contains('hidden');
    if (!modalOpen) return;

    const active = document.activeElement;
    const isTextArea = active && active.tagName === 'TEXTAREA';

    if ((e.key === 'Enter' && !isTextArea) || (e.key === 'Enter' && e.ctrlKey)) {
        e.preventDefault();
        const cont = e.ctrlKey; // Ctrl+Enter で連続追加
        submitRegularSchedule({ continueAfter: cont });
    } else if (e.key === 'Escape') {
        e.preventDefault();
        document.getElementById('closeRegularScheduleModal')?.click();
    }
});

async function loadSchedules() {
    try {
        const res = await fetch("/api/schedule");
        const data = await res.json();
        const username = getLoggedInUsername();

        const filtered = Array.isArray(data) ? data.filter((entry) => {
            if (!entry || typeof entry.title !== 'string') return true;
            if (!entry.title.startsWith('[シフト]')) return true;

            const match = entry.title.match(/^\[シフト\]\s([^:]+):/);
            if (!match) return true;
            if (!username) return false;
            return match[1] === username;
        }) : [];

        schedules.splice(0, schedules.length, ...(Array.isArray(data) ? filtered : []));
    } catch (e) {
        console.warn("予定読み込み失敗:", e);
    }
}


function convertToEmbedURL(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("google.com") && u.pathname.includes("/maps")) {
            return url.replace("/maps", "/maps/embed");
        }
    } catch (_) { }
    return null;
}

function showScheduleDetail(sched) {
    const content = document.getElementById("scheduleDetailContent");

    let timeStr = sched.allday
        ? "終日"
        : `${sched.date}${sched.time ? ` ${sched.time}` : ""}${sched.endTime ? `~${sched.endTime}` : ""}`;

    const formattedDescription = decodeDescriptionForEdit(sched.description || "なし").replace(/\n/g, "<br>");

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

    const existingMore = document.getElementById("moreScheduleItem");
    if (existingMore) existingMore.remove();

    const hideableItems = items.filter((el) => !el.dataset.calendarFixed);
    hideableItems.forEach((el) => el.classList.remove('hidden'));

    if (hideableItems.length > 2) {
        hideableItems.forEach((el, index) => {
            el.classList.toggle("hidden", index >= 2);
        });

        const moreItem = document.createElement("li");
        moreItem.id = "moreScheduleItem";
        moreItem.innerHTML = `<button class="text-blue-400 hover:underline text-left">+ もっと見る...</button>`;
        moreItem.querySelector("button").addEventListener("click", openAllScheduleModal);
        list.insertBefore(moreItem, hideableItems[2]);
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

        const detailBtn = copy.querySelector("button");
        const pos = el.dataset.schedulePos;
        if (detailBtn && detailBtn.textContent.includes("詳細") && pos !== undefined) {
            const dateStr = window.selectedDate || selectedDate;
            const filtered = schedules.filter(e => e.date === dateStr);
            const sched = filtered[Number(pos)];
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

document.getElementById('regularToggleDetail')?.addEventListener('click', () => {
    const { detailSection } = regularForm;
    if (!detailSection) return;
    const isOpen = !detailSection.classList.contains('hidden');
    setRegularDetailState(!isOpen);
    if (!isOpen) {
        regularForm.location?.focus();
    }
});

updateScheduleDescCounter();

const calendarManager = new CalendarManager();
if (typeof window !== 'undefined') {
    window.calendarManager = calendarManager;
}

window.addEventListener('auth:state-changed', () => {
    calendarManager.refreshCalendar({ keepSelection: true, forceReload: true }).catch(() => { });
});
