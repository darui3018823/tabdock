// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.10.5_devtools-r1

let debugLog = [];
let maxLogEntries = 200;
let lastFullSync = null;
let burnInOverlayCleanup = null;
const BURN_IN_SLEEP_TIMEOUT = 60000;
let burnInIsSleeping = false;
let burnInSleepTimer = null;

function getBurnInOverlay() {
    return document.getElementById('burnInOverlay');
}

function isBurnInOverlayActive() {
    const overlay = getBurnInOverlay();
    return !!overlay && !overlay.classList.contains('hidden');
}

function cancelBurnInSleepTimer() {
    if (burnInSleepTimer) {
        clearTimeout(burnInSleepTimer);
        burnInSleepTimer = null;
    }
}

function scheduleBurnInSleep() {
    cancelBurnInSleepTimer();
    burnInSleepTimer = window.setTimeout(() => {
        enterBurnInSleep();
    }, BURN_IN_SLEEP_TIMEOUT);
}

function enterBurnInSleep() {
    const overlay = getBurnInOverlay();
    if (!overlay || overlay.classList.contains('hidden')) {
        return;
    }
    overlay.classList.add('sleeping');
    burnInIsSleeping = true;
}

function wakeBurnInOverlayMode() {
    const overlay = getBurnInOverlay();
    if (!overlay) return;
    if (burnInIsSleeping) {
        overlay.classList.remove('sleeping');
        burnInIsSleeping = false;
    }
    scheduleBurnInSleep();
}

function handleBurnInActivity() {
    if (!isBurnInOverlayActive()) {
        return false;
    }
    if (burnInIsSleeping) {
        wakeBurnInOverlayMode();
        return true;
    }
    scheduleBurnInSleep();
    return false;
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatLogTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }
    const datePart = date.toLocaleDateString('ja-JP');
    const timePart = date.toLocaleTimeString('ja-JP', { hour12: false });
    return `${datePart} ${timePart}`;
}

function getDebugLogSlice(level = 'all', limit = 20) {
    const normalizedLevel = (level || 'all').toLowerCase();
    let entries = debugLog;
    if (normalizedLevel !== 'all') {
        entries = entries.filter(log => log.level === normalizedLevel);
    }
    return entries.slice(0, Math.max(1, limit));
}

function renderDebugLogEntries(container, options = {}) {
    if (!container) return;
    const { level = 'all', limit = 20 } = options;
    const entries = getDebugLogSlice(level, limit);
    if (entries.length === 0) {
        container.innerHTML = '<p class="text-gray-400">該当するログはありません</p>';
        return;
    }

    const levelColors = {
        info: 'text-blue-500',
        warn: 'text-yellow-400',
        error: 'text-red-500',
        debug: 'text-slate-300'
    };

    container.innerHTML = entries.map(log => {
        const levelLabel = escapeHtml(log.level?.toUpperCase() || 'INFO');
        const levelClass = levelColors[log.level] || 'text-blue-500';
        const timestamp = formatLogTimestamp(log.timestamp);
        const message = escapeHtml(log.message || '');
        const dataSection = log.data != null
            ? `<details class="mt-1"><summary class="cursor-pointer text-xs text-white/70">詳細データ</summary><pre class="mt-1 bg-black/40 rounded p-2 text-[10px] whitespace-pre-wrap">${escapeHtml(JSON.stringify(log.data, null, 2))}</pre></details>`
            : '';
        return `
            <article class="bg-black/30 rounded-md px-3 py-2">
                <div class="flex justify-between text-[11px] tracking-wide text-white/70">
                    <span class="font-semibold ${levelClass}">${levelLabel}</span>
                    <time>${escapeHtml(timestamp)}</time>
                </div>
                <div class="mt-1 text-xs leading-relaxed">${message}</div>
                ${dataSection}
            </article>
        `;
    }).join('');
}

function openBurnInOverlay() {
    const overlay = getBurnInOverlay();
    if (!overlay) {
        console.warn('burnInOverlay が見つかりません');
        return;
    }

    if (!overlay.classList.contains('hidden')) {
        handleBurnInActivity();
        return;
    }

    const exitButton = document.getElementById('exitBurnInBtn');
    const content = overlay.querySelector('.burnin-content');
    const stopPropagation = (event) => event.stopPropagation();

    const pointerActivity = () => handleBurnInActivity();

    const close = () => {
        cancelBurnInSleepTimer();
        burnInIsSleeping = false;
        overlay.classList.add('hidden');
        overlay.classList.remove('sleeping');
        overlay.removeEventListener('click', handleOverlayClick);
        overlay.removeEventListener('mousemove', pointerActivity);
        overlay.removeEventListener('mousedown', pointerActivity);
        overlay.removeEventListener('touchstart', pointerActivity);
        exitButton?.removeEventListener('click', handleExitButton);
        document.removeEventListener('keydown', escHandler);
        content?.removeEventListener('click', stopPropagation);
        burnInOverlayCleanup = null;
        Toast?.fire({ icon: 'info', title: '画面焼け防止モードを終了しました' });
    };

    const handleExitButton = (event) => {
        event.stopPropagation();
        if (handleBurnInActivity()) {
            return;
        }
        close();
    };

    const handleOverlayClick = () => {
        if (handleBurnInActivity()) {
            return;
        }
        close();
    };

    const escHandler = (event) => {
        if (event.key === 'Escape') {
            if (handleBurnInActivity()) {
                event.preventDefault();
                return;
            }
            close();
        } else {
            handleBurnInActivity();
        }
    };

    burnInOverlayCleanup = close;

    overlay.classList.remove('hidden', 'sleeping');
    burnInIsSleeping = false;
    scheduleBurnInSleep();
    Toast?.fire({ icon: 'success', title: '画面焼け防止モードを開始しました' });

    overlay.addEventListener('click', handleOverlayClick);
    overlay.addEventListener('mousemove', pointerActivity);
    overlay.addEventListener('mousedown', pointerActivity);
    overlay.addEventListener('touchstart', pointerActivity, { passive: true });
    exitButton?.addEventListener('click', handleExitButton);
    content?.addEventListener('click', stopPropagation);
    document.addEventListener('keydown', escHandler);
}

function closeBurnInOverlay() {
    if (typeof burnInOverlayCleanup === 'function') {
        burnInOverlayCleanup();
    }
}

function addDebugLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    debugLog.unshift(logEntry);
    if (debugLog.length > maxLogEntries) {
        debugLog = debugLog.slice(0, maxLogEntries);
    }
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
}

function checkJavaScriptLoadStatus() {
    const scripts = [
        { name: 'script.js', elements: ['clock', 'date'], globals: ['updatePCStatus'] },
        { name: 'weather.js', functions: ['fetchWeather'] },
        { name: 'status.js', functions: ['checkApi', 'fetchJsVersion'] },
        { name: 'calendar.js', functions: ['renderCalendar', 'fetchHolidayData', 'loadSchedules'], globals: ['calendarManager'] },
        { name: 'ui_visibility.js', functions: ['applyVisualSettings'] },
        { name: 'tabdock_about.js' },
        { name: 'passkey.js', functions: ['handlePasskeyLogin'] },
        { name: 'devtools.js', functions: ['addDebugLog', 'performFullSync'] },
        { name: 'subscription.js', globals: ['subscriptionManager'], module: true },
        { name: 'subscription_calendar.js', globals: ['subscriptionCalendarManager'], module: true }
    ];

    const results = scripts.map(script => {
        const checkDetails = [];
        const missing = [];
        const existing = [];

        if (Array.isArray(script.functions) && script.functions.length > 0) {
            const availableFns = script.functions.filter(fn => typeof window[fn] === 'function');
            const missingFns = script.functions.filter(fn => typeof window[fn] !== 'function');
            if (missingFns.length) {
                missing.push(`関数: ${missingFns.join(', ')}`);
            }
            if (availableFns.length) {
                existing.push(`関数: ${availableFns.join(', ')}`);
            }
            checkDetails.push({ type: 'functions', total: script.functions.length, ok: availableFns.length });
        }

        if (Array.isArray(script.elements) && script.elements.length > 0) {
            const availableElements = script.elements.filter(id => document.getElementById(id) !== null);
            const missingElements = script.elements.filter(id => document.getElementById(id) === null);
            if (missingElements.length) {
                missing.push(`要素: ${missingElements.join(', ')}`);
            }
            if (availableElements.length) {
                existing.push(`要素: ${availableElements.join(', ')}`);
            }
            checkDetails.push({ type: 'elements', total: script.elements.length, ok: availableElements.length });
        }

        if (Array.isArray(script.globals) && script.globals.length > 0) {
            const availableGlobals = script.globals.filter(key => typeof window[key] !== 'undefined' && window[key] !== null);
            const missingGlobals = script.globals.filter(key => typeof window[key] === 'undefined' || window[key] === null);
            if (missingGlobals.length) {
                missing.push(`グローバル: ${missingGlobals.join(', ')}`);
            }
            if (availableGlobals.length) {
                existing.push(`グローバル: ${availableGlobals.join(', ')}`);
            }
            checkDetails.push({ type: 'globals', total: script.globals.length, ok: availableGlobals.length });
        }

        const versionLabel = document.getElementById(`jsver-${script.name}-ver`);
        const version = versionLabel ? versionLabel.textContent?.trim() ?? 'Unknown' : 'Unknown';
        const scriptTag = document.querySelector(`script[src*="${script.name}"]`);

        const loaded = missing.length === 0 && (checkDetails.length > 0 || !!scriptTag);

        return {
            name: script.name,
            loaded,
            details: checkDetails,
            missing,
            existing,
            tagFound: !!scriptTag,
            module: !!script.module,
            version
        };
    });

    addDebugLog('info', 'JavaScript読み込み状態確認完了', results);
    return results;
}

async function performFullSync() {
    console.log('performFullSync関数の最初の行が実行されました！');
    console.log('try-catch外での実行確認:', new Date().toISOString());
    
    try {
        console.log('performFullSync関数のtry-catch内に入りました');
        console.log('performFullSync関数が開始されました');
        const startTime = performance.now();
        console.log('=== 完全同期処理開始 ===');
        console.log('開始時刻:', new Date().toLocaleTimeString());
        
        addDebugLog('info', '完全同期開始');
        
        const syncTasks = [
            {
                name: '天気データ',
                run: () => typeof window.fetchWeather === 'function' ? window.fetchWeather() : 'skip'
            },
            {
                name: '祝日データ',
                run: () => typeof window.fetchHolidayData === 'function' ? window.fetchHolidayData() : 'skip'
            },
            {
                name: '予定データ',
                run: () => {
                    if (window.calendarManager && typeof window.calendarManager.reloadSchedules === 'function') {
                        return window.calendarManager.reloadSchedules({ keepSelection: true });
                    }
                    if (typeof window.loadSchedules === 'function') {
                        return window.loadSchedules();
                    }
                    return 'skip';
                }
            },
            {
                name: 'サブスクリプション予定更新',
                run: () => {
                    if (window.subscriptionCalendarManager && typeof window.subscriptionCalendarManager.handleSubscriptionsUpdated === 'function') {
                        return window.subscriptionCalendarManager.handleSubscriptionsUpdated();
                    }
                    if (typeof window.loadSubscriptions === 'function') {
                        return window.loadSubscriptions();
                    }
                    return 'skip';
                }
            },
            {
                name: 'カレンダー再描画',
                run: () => {
                    if (window.calendarManager && typeof window.calendarManager.refreshCalendar === 'function') {
                        return window.calendarManager.refreshCalendar({ keepSelection: true });
                    }
                    if (typeof window.renderCalendar === 'function') {
                        window.renderCalendar();
                        if (typeof window.renderSchedule === 'function') {
                            const date = window.selectedDate || new Date().toISOString().split('T')[0];
                            window.renderSchedule(date);
                        }
                        return Promise.resolve();
                    }
                    return 'skip';
                }
            },
            {
                name: 'UI設定再適用',
                run: () => typeof window.applyVisualSettings === 'function' ? window.applyVisualSettings() : 'skip'
            },
            {
                name: 'PCステータス更新',
                run: () => {
                    if (typeof window.fetchStatus === 'function') {
                        return window.fetchStatus();
                    }
                    if (typeof window.updatePCStatus === 'function') {
                        return window.updatePCStatus();
                    }
                    return 'skip';
                }
            },
            {
                name: '通知スケジュール更新',
                run: () => {
                    if (window.subscriptionManager && typeof window.subscriptionManager.scheduleNotifications === 'function') {
                        return window.subscriptionManager.scheduleNotifications({ reschedule: true, immediate: true });
                    }
                    return 'skip';
                }
            },
            {
                name: 'PWAステータスチェック',
                run: () => typeof window.requestPwaStatus === 'function' ? window.requestPwaStatus({ force: true }) : 'skip'
            }
        ];

        console.log('同期タスク一覧:', syncTasks);

        const results = [];

        for (const task of syncTasks) {
            console.log(`${task.name} の同期を開始...`);
            try {
                if (typeof task.run !== 'function') {
                    results.push({ name: task.name, status: 'skipped', reason: 'ハンドラー未定義' });
                    console.log(`⚠️ ${task.name}同期スキップ: ハンドラーが未定義です`);
                    continue;
                }

                const taskStart = performance.now();
                const outcome = await task.run();
                if (outcome === 'skip') {
                    results.push({ name: task.name, status: 'skipped', reason: '依存関数が見つかりません' });
                    console.log(`⚠️ ${task.name}同期スキップ: 依存関数が見つかりません`);
                    addDebugLog('warn', `${task.name}同期スキップ: 依存関数が見つかりません`);
                    continue;
                }

                const taskTime = Math.round(performance.now() - taskStart);
                results.push({ name: task.name, status: 'success', time: taskTime });
                console.log(`✅ ${task.name}同期完了 (${taskTime}ms)`);
                addDebugLog('info', `${task.name}同期完了 (${taskTime}ms)`);
            } catch (error) {
                results.push({ name: task.name, status: 'error', error: error.message });
                console.error(`❌ ${task.name}同期エラー:`, error);
                addDebugLog('error', `${task.name}同期エラー`, error);
            }
        }
    
    console.log('=== 時計・日付更新開始 ===');
    try {
        const taskStart = performance.now();
        
        const clockEl = document.getElementById("clock");
        const dateEl = document.getElementById("date");
        console.log(`clock要素: ${clockEl ? '存在' : '不存在'}`);
        console.log(`date要素: ${dateEl ? '存在' : '不存在'}`);
        
        const now = new Date();
        if (clockEl) {
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}:${seconds}`;
            clockEl.textContent = timeStr;
            console.log(`時計を更新: ${timeStr}`);
        }
        
        if (dateEl) {
            const weekdays = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const day = weekdays[now.getDay()];
            const dateStr = `${y}/${m}/${d} (${day})`;
            dateEl.textContent = dateStr;
            console.log(`日付を更新: ${dateStr}`);
        }
        
        const taskTime = Math.round(performance.now() - taskStart);
        results.push({ name: '時計・日付更新', status: 'success', time: taskTime });
        console.log(`✅ 時計・日付更新完了 (${taskTime}ms)`);
        addDebugLog('info', `時計・日付更新完了 (${taskTime}ms)`);
    } catch (error) {
        results.push({ name: '時計・日付更新', status: 'error', error: error.message });
        console.error(`❌ 時計・日付更新エラー:`, error);
        addDebugLog('error', '時計・日付更新エラー', error);
    }
    
    console.log('=== APIステータス確認開始 ===');
    try {
        const taskStart = performance.now();
        
        console.log(`checkApi関数: ${typeof window.checkApi === 'function' ? '利用可能' : '利用不可'}`);
        if (typeof window.checkApi === 'function') {
            console.log('各種APIをチェック中...');
            window.checkApi("/api/ping", "statusPing", "HEAD");
            window.checkApi("/api/weather", "statusWeather", "HEAD");
            window.checkApi("/api/schedule", "statusSchedule", "HEAD");
            window.checkApi("/api/holidays", "statusHolidays", "HEAD");
        }
        
        const taskTime = Math.round(performance.now() - taskStart);
        results.push({ name: 'APIステータス確認', status: 'success', time: taskTime });
        console.log(`✅ APIステータス確認完了 (${taskTime}ms)`);
        addDebugLog('info', `APIステータス確認完了 (${taskTime}ms)`);
    } catch (error) {
        results.push({ name: 'APIステータス確認', status: 'error', error: error.message });
        console.error(`❌ APIステータス確認エラー:`, error);
        addDebugLog('error', 'APIステータス確認エラー', error);
    }
    
    const totalTime = Math.round(performance.now() - startTime);
    lastFullSync = new Date().toISOString();
    console.log(`=== 完全同期完了 (合計${totalTime}ms) ===`);
    addDebugLog('info', `完全同期完了 (${totalTime}ms)`, results);
    
    return { results, totalTime };
    } catch (error) {
        console.error('performFullSync関数内でエラーが発生:', error);
        console.error('エラースタック:', error.stack);
        throw error; // エラーを再スローして呼び出し元にも通知
    }
}

function analyzeLocalStorage() {
    const storage = {};
    const totalItems = localStorage.length;
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        totalSize += size;
        storage[key] = {
            size: size,
            value: value.length > 100 ? value.substring(0, 100) + '...' : value,
            type: typeof value
        };
    }
    
    return {
        totalItems,
        totalSize,
        items: storage,
        sizeFormatted: formatBytes(totalSize)
    };
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getSystemDiagnostics() {
    const basicMemory = performance.memory ? {
        used: formatBytes(performance.memory.usedJSHeapSize),
        total: formatBytes(performance.memory.totalJSHeapSize),
        limit: formatBytes(performance.memory.jsHeapSizeLimit)
    } : null;

    const deviceMemory = typeof navigator.deviceMemory === 'number'
        ? `${navigator.deviceMemory} GB`
        : 'Unknown';

    const uasSupported = typeof performance.measureUserAgentSpecificMemory === 'function';
    const coi = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;

    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        memory: basicMemory || 'Not available',
        memorySource: basicMemory ? 'performance.memory' : 'unavailable',
        deviceMemory: deviceMemory,
        uasMemoryApi: {
            supported: uasSupported,
            crossOriginIsolated: coi
        },
        timing: performance.timing ? {
            domLoading: performance.timing.domLoading - performance.timing.navigationStart,
            domComplete: performance.timing.domComplete - performance.timing.navigationStart
        } : 'Not available',
        lastFullSync: lastFullSync
    };
}

async function runPerformanceTest() {
    addDebugLog('info', 'パフォーマンステスト開始');
    const tests = [];
    console.log('=== パフォーマンステスト実行開始 ===');

    const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

    console.log('DOM構築テストを実行中...');
    try {
        const domStart = performance.now();
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-99999px;top:-99999px;';
        const frag = document.createDocumentFragment();
        const COUNT = 5000;
        for (let i = 0; i < COUNT; i++) {
            const el = document.createElement('div');
            el.className = 'perf-item';
            el.textContent = `Item ${i}`;
            el.style.cssText = 'padding:2px;margin:1px;border:1px solid #ccc';
            frag.appendChild(el);
        }
        container.appendChild(frag);
        document.body.appendChild(container);
        const height = container.offsetHeight;
        document.body.removeChild(container);
        const domTime = performance.now() - domStart;
        const domResult = {
            name: 'DOM構築/レイアウト (5000要素)',
            time: Math.round(domTime),
            description: '大量要素の生成・追加とレイアウト計算の速度を測定',
            result: `レイアウト高さ: ${height}px`
        };
        tests.push(domResult);
        console.log(`DOM構築テスト完了: ${domResult.time}ms`);
    } catch (error) {
        tests.push({ name: 'DOM構築/レイアウト (5000要素)', error: error.message, description: 'DOM操作テストでエラー' });
    }

    await yieldToUI();

    console.log('ネットワーク(並列Ping x5)テストを実行中...');
    try {
        const attempts = 5;
        const reqs = [];
        const t0 = performance.now();
        for (let i = 0; i < attempts; i++) {
            const s = performance.now();
            reqs.push(
                fetch('/api/ping', { method: 'HEAD' })
                    .then(r => ({ status: r.status, t: performance.now() - s }))
                    .catch(e => ({ error: e.message, t: performance.now() - s }))
            );
        }
        const results = await Promise.all(reqs);
        const total = performance.now() - t0;
        const times = results.map(r => r.t);
        const okTimes = results.filter(r => !r.error).map(r => r.t);
        const avg = okTimes.length ? Math.round(okTimes.reduce((a, b) => a + b, 0) / okTimes.length) : NaN;
        const min = okTimes.length ? Math.round(Math.min(...okTimes)) : NaN;
        const max = okTimes.length ? Math.round(Math.max(...okTimes)) : NaN;
        tests.push({
            name: 'ネットワーク応答(並列Ping x5)',
            time: Math.round(total),
            description: '5リクエストを同時送信して応答性能を測定',
            result: `平均${avg}ms / 最小${min}ms / 最大${max}ms`,
        });
        console.log(`ネットワーク(並列)テスト完了: total=${Math.round(total)}ms, avg=${avg}ms`);
    } catch (error) {
        tests.push({ name: 'ネットワーク応答(並列Ping x5)', error: error.message, description: 'ネットワークテストでエラー' });
    }

    await yieldToUI();

    console.log('ローカルストレージ(256KB)テストを実行中...');
    try {
        const storageStart = performance.now();
        const SIZE = 256 * 1024; // 256KB
        const testData = 'A'.repeat(SIZE);
        localStorage.setItem('perfTestBig', testData);
        const readData = localStorage.getItem('perfTestBig');
        localStorage.removeItem('perfTestBig');
        const storageTime = performance.now() - storageStart;
        tests.push({
            name: 'ローカルストレージ処理速度(256KB)',
            time: Math.round(storageTime),
            description: '256KBの保存・読み込み・削除の速度を測定',
            dataSize: formatBytes(SIZE)
        });
        void readData;
        console.log(`ローカルストレージ(256KB)完了: ${Math.round(storageTime)}ms`);
    } catch (error) {
        tests.push({ name: 'ローカルストレージ処理速度(256KB)', error: error.message, description: 'ストレージテストでエラー' });
    }

    await yieldToUI();

    console.log('計算負荷テストを実行中...');
    try {
        const calcStart = performance.now();
        let sum = 0;
        const N = 500_000;
        for (let i = 0; i < N; i++) {
            sum += Math.sin(i) * Math.sqrt(i + 1);
        }
        const arr = new Float64Array(100_000);
        for (let i = 0; i < arr.length; i++) arr[i] = Math.random();
        const rsum = arr.reduce((a, b) => a + Math.log1p(b), 0);
        const calcTime = performance.now() - calcStart;
        tests.push({
            name: 'JavaScript計算処理(ヘビー)',
            time: Math.round(calcTime),
            description: '50万回の数学計算 + 10万要素のreduce',
            result: `合計: ${Math.round(sum + rsum)}`
        });
        console.log(`計算負荷テスト完了: ${Math.round(calcTime)}ms`);
    } catch (error) {
        tests.push({ name: 'JavaScript計算処理(ヘビー)', error: error.message, description: '計算テストでエラー' });
    }

    await yieldToUI();

    console.log('JSONシリアライズ/デシリアライズを実行中...');
    try {
        const buildStart = performance.now();
        const ITEMS = 10_000;
        const list = [];
        for (let i = 0; i < ITEMS; i++) {
            list.push({
                id: i,
                name: `name_${i}`,
                value: Math.floor(Math.random() * 1000000),
                flag: i % 2 === 0,
                tags: ['a', 'b', 'c', String(i % 10)]
            });
        }
        const buildTime = performance.now() - buildStart;
        const sStart = performance.now();
        const json = JSON.stringify(list);
        const sTime = performance.now() - sStart;
        const pStart = performance.now();
        const parsed = JSON.parse(json);
        const pTime = performance.now() - pStart;
        void parsed;
        tests.push({
            name: 'JSONシリアライズ/デシリアライズ',
            time: Math.round(buildTime + sTime + pTime),
            description: '1万件のオブジェクト生成 + 文字列化 + 解析',
            result: `生成${Math.round(buildTime)}ms / stringify ${Math.round(sTime)}ms / parse ${Math.round(pTime)}ms`
        });
        console.log(`JSONテスト完了`);
    } catch (error) {
        tests.push({ name: 'JSONシリアライズ/デシリアライズ', error: error.message, description: 'JSONテストでエラー' });
    }

    await yieldToUI();

    console.log('WebCrypto(1MB SHA-256)を実行中...');
    try {
        if (window.crypto && window.crypto.subtle && window.crypto.getRandomValues) {
            const SIZE = 1 * 1024 * 1024;
            const data = new Uint8Array(SIZE);
            const MAX_CHUNK = 65536;
            for (let i = 0; i < SIZE; i += MAX_CHUNK) {
                const end = Math.min(i + MAX_CHUNK, SIZE);
                window.crypto.getRandomValues(data.subarray(i, end));
            }
            const cStart = performance.now();
            const digest = await window.crypto.subtle.digest('SHA-256', data);
            const cTime = performance.now() - cStart;
            void digest;
            tests.push({
                name: 'SHA-256ハッシュ(1MB)',
                time: Math.round(cTime),
                description: '1MBのランダムデータをハッシュ化',
                dataSize: formatBytes(SIZE)
            });
            console.log(`WebCryptoテスト完了: ${Math.round(cTime)}ms`);
        } else {
            tests.push({ name: 'SHA-256ハッシュ(1MB)', error: 'SubtleCrypto非対応', description: 'この環境ではWebCryptoが利用できません' });
        }
    } catch (error) {
        tests.push({ name: 'SHA-256ハッシュ(1MB)', error: error.message, description: 'WebCryptoテストでエラー' });
    }

    await yieldToUI();

    console.log('Canvas描画テストを実行中...');
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2Dコンテキストが取得できません');
        const cStart = performance.now();
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `hsl(${i % 360} 80% 60%)`;
            ctx.fillRect((i * 7) % 512, (i * 11) % 512, 50, 50);
            ctx.strokeStyle = '#000';
            ctx.beginPath();
            ctx.moveTo((i * 13) % 512, (i * 17) % 512);
            ctx.lineTo((i * 19) % 512, (i * 23) % 512);
            ctx.stroke();
        }
        const cTime = performance.now() - cStart;
        tests.push({
            name: 'Canvas描画(1000回)',
            time: Math.round(cTime),
            description: '512x512キャンバスに矩形と線分を描画'
        });
        console.log(`Canvas描画テスト完了: ${Math.round(cTime)}ms`);
    } catch (error) {
        tests.push({ name: 'Canvas描画(1000回)', error: error.message, description: 'Canvasテストでエラー' });
    }

    if (performance.memory) {
        const memoryInfo = {
            name: 'メモリ使用状況',
            description: 'ブラウザのメモリ使用量を確認',
            used: formatBytes(performance.memory.usedJSHeapSize),
            total: formatBytes(performance.memory.totalJSHeapSize),
            limit: formatBytes(performance.memory.jsHeapSizeLimit)
        };
        tests.push(memoryInfo);
        console.log(`メモリ使用量: ${memoryInfo.used} / ${memoryInfo.total}`);
    }

    console.log('=== パフォーマンステスト完了 ===');
    addDebugLog('info', 'パフォーマンステスト完了', tests);
    return tests;
}

console.log('=== イベントリスナー登録開始 ===');
const forceSyncButton = document.getElementById("forceSyncBtn");
console.log('forceSyncBtn要素:', forceSyncButton);

if (!forceSyncButton) {
    console.error('forceSyncBtn要素が見つかりません！');
} else {
    console.log('forceSyncBtn要素が見つかりました、イベントリスナーを登録します');
}

let isFullSyncRunning = false;
let isPerfTestRunning = false;

function setFullSyncRunning(value, reason = '') {
    console.log(`実行中フラグを ${isFullSyncRunning} から ${value} に変更 ${reason ? `(理由: ${reason})` : ''}`);
    isFullSyncRunning = value;
}

forceSyncButton?.addEventListener("click", async (event) => {
    console.log('=== 完全同期ボタンが押されました ===');
    console.log('イベントオブジェクト:', event);
    console.log('現在時刻:', new Date().toISOString());
    console.log('実行中フラグ:', isFullSyncRunning);
    
    if (isFullSyncRunning) {
        console.log('⚠️ 既に完全同期が実行中です。処理をスキップします。');
        return;
    }
    
    setFullSyncRunning(true, 'ボタンクリック開始');
    
    forceSyncButton.disabled = true;
    forceSyncButton.textContent = '同期中...';
    console.log('ボタンを無効化しました');
    
    try {
        console.log('Swalチェック開始...');
        if (typeof Swal === 'undefined') {
            console.error('SweetAlert2が利用できません');
            alert('SweetAlert2が読み込まれていません。ページを再読み込みしてください。');
            return;
        }
        
        console.log('SweetAlert2は利用可能です');
        
        console.log('SweetAlertダイアログを表示中...');
        console.log('Swal.fire呼び出し前の状態確認完了');
        
        Swal.fire({
            title: '完全同期中…',
            text: '全データをサーバーから再取得しています。',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                console.log('SweetAlertダイアログが開かれました');
                Swal.showLoading();
            }
        });
        console.log('SweetAlertダイアログを開始しました（非同期）');
        
        console.log('performFullSync関数の存在確認:', typeof performFullSync);
        console.log('performFullSync関数を呼び出し中...');
        console.log('performFullSync呼び出し直前の時刻:', new Date().toISOString());
        
        const result = await performFullSync();
        console.log('performFullSync呼び出し完了の時刻:', new Date().toISOString());
        console.log('完全同期結果:', result);
        
        const successCount = result.results.filter(r => r.status === 'success').length;
        const errorCount = result.results.filter(r => r.status === 'error').length;
        const skippedCount = result.results.filter(r => r.status === 'skipped').length;
        
        console.log('同期結果詳細:');
        result.results.forEach(r => {
            console.log(`- ${r.name}: ${r.status}${r.time ? ` (${r.time}ms)` : ''}${r.error ? ` - Error: ${r.error}` : ''}${r.reason ? ` - Reason: ${r.reason}` : ''}`);
        });
        
        const rowsHtml = result.results.map(r => {
            const statusLabel = r.status === 'success' ? '成功' : r.status === 'error' ? '失敗' : 'スキップ';
            const statusClass = r.status === 'success' ? 'text-green-400' : r.status === 'error' ? 'text-red-400' : 'text-yellow-300';
            const detail = r.error ? escapeHtml(r.error) : r.reason ? escapeHtml(r.reason) : (typeof r.time === 'number' ? `${r.time}ms` : '—');
            return `<tr>
                <td class="py-1 pr-2 align-top text-white/80">${escapeHtml(r.name)}</td>
                <td class="py-1 pr-2 align-top ${statusClass}">${statusLabel}</td>
                <td class="py-1 align-top text-white/60">${detail}</td>
            </tr>`;
        }).join('');

        await Swal.fire({
            icon: errorCount > 0 ? 'warning' : 'success',
            title: '同期完了',
            html: `
                <div class="text-left text-xs space-y-3">
                    <div>
                        <p class="text-sm text-white/90">同期処理が完了しました (${result.totalTime}ms)</p>
                        <div class="mt-2 flex gap-4">
                            <span class="text-green-400">成功: ${successCount}</span>
                            <span class="text-red-400">失敗: ${errorCount}</span>
                            <span class="text-yellow-300">スキップ: ${skippedCount}</span>
                        </div>
                    </div>
                    <div class="max-h-40 overflow-y-auto border border-white/10 rounded">
                        <table class="w-full text-[11px]">
                            <thead class="bg-white/5 text-white/70">
                                <tr>
                                    <th class="text-left font-medium px-2 py-1">タスク</th>
                                    <th class="text-left font-medium px-2 py-1">状態</th>
                                    <th class="text-left font-medium px-2 py-1">詳細</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">${rowsHtml}</tbody>
                        </table>
                    </div>
                    <div class="text-white/50">詳細なログはコンソールまたはデバッグログから確認できます。</div>
                </div>
            `,
            timer: 6000,
            showConfirmButton: true,
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white'
            }
        });
        
    } catch (error) {
        console.error('同期処理中にエラーが発生:', error);
        console.error('エラーの詳細:', error.stack);
        addDebugLog('error', '同期処理中にエラー', error);
        
        try {
            await Swal.fire({
                icon: 'error',
                title: '同期失敗',
                html: `
                    <div class="text-left">
                        <p>同期処理中に予期しないエラーが発生しました。</p>
                        <div class="mt-2 text-sm text-red-400">
                            エラー: ${error.message || error}
                        </div>
                        <div class="mt-2 text-xs text-gray-400">
                            詳細はブラウザのコンソールを確認してください
                        </div>
                    </div>
                `,
                footer: 'F12を押してコンソールを開き、エラーの詳細を確認してください。',
                customClass: {
                    popup: 'bg-gray-800 text-white',
                    title: 'text-white',
                    htmlContainer: 'text-white',
                    footer: 'text-white'
                }
            });
        } catch (swalErr) {
            console.error('エラーダイアログの表示でもエラー:', swalErr);
            alert('エラーが発生しました: ' + (error.message || error));
        }
    } finally {
        setFullSyncRunning(false, '処理完了');
        forceSyncButton.disabled = false;
        forceSyncButton.textContent = '完全同期';
        console.log('ボタンを復元しました');
        
        if (typeof Swal !== 'undefined') {
            console.log('SweetAlertダイアログを閉じます');
            Swal.close();
        }
    }
});

document.getElementById("regenerateCalendarBtn")?.addEventListener("click", async () => {
    addDebugLog('info', 'カレンダー再生成を開始');
    try {
        if (window.calendarManager && typeof window.calendarManager.refreshCalendar === 'function') {
            await window.calendarManager.refreshCalendar({ keepSelection: true, forceReload: true });
        } else {
            await Promise.all([
                typeof window.fetchHolidayData === 'function' ? window.fetchHolidayData() : Promise.resolve(),
                typeof window.loadSchedules === 'function' ? window.loadSchedules() : Promise.resolve()
            ]);
            if (typeof window.renderCalendar === 'function') {
                window.renderCalendar();
            }
            if (typeof window.renderSchedule === 'function') {
                const dateStr = window.selectedDate || new Date().toISOString().split('T')[0];
                window.renderSchedule(dateStr);
            }
        }

        Toast?.fire({ icon: 'success', title: 'カレンダーを再生成しました' });
        addDebugLog('info', 'カレンダー再生成完了');
    } catch (error) {
        console.error('カレンダー再生成エラー:', error);
        addDebugLog('error', 'カレンダー再生成中にエラー', error);
        Swal.fire({
            title: 'エラー',
            text: error.message || 'カレンダー再生成に失敗しました',
            icon: 'error',
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white'
            }
        });
    }
});

document.getElementById("toggleBurnInProtectionBtn")?.addEventListener("click", () => {
    openBurnInOverlay();
});

document.getElementById("openDevMenuBtn").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("devMenuModal").classList.remove("hidden");
});

document.getElementById("closeDevMenuModal").addEventListener("click", () => {
    document.getElementById("devMenuModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
});

document.getElementById("checkJsStatusBtn").addEventListener("click", async () => {
    const results = checkJavaScriptLoadStatus();

    const loadedCount = results.filter(r => r.loaded).length;
    const totalCount = results.length;

    let resultHtml = `<div class="text-left text-xs space-y-3">`;
    resultHtml += `<p class="text-sm font-semibold text-white/80">読み込み状況: <span class="text-white">${loadedCount}</span>/<span class="text-white">${totalCount}</span></p>`;

    results.forEach(script => {
        const statusClass = script.loaded ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10';
        const badgeText = script.loaded ? 'OK' : 'NG';
        const moduleBadge = script.module ? '<span class="ml-2 rounded-full border border-blue-500/40 px-2 text-[10px] uppercase tracking-widest text-blue-300">module</span>' : '';
        const tagInfo = script.tagFound ? '検出済み' : '未検出';

        resultHtml += `
            <section class="rounded-lg border border-white/10 bg-black/20 p-3">
                <div class="flex justify-between items-center">
                    <div class="font-semibold text-white/90">${escapeHtml(script.name)}${moduleBadge}</div>
                    <span class="px-3 py-0.5 rounded-full text-[11px] font-semibold ${statusClass}">${badgeText}</span>
                </div>
                <div class="mt-1 text-white/60">バージョン: <span class="text-white/80">${escapeHtml(script.version)}</span></div>
                <div class="mt-1 text-white/50">scriptタグ: ${tagInfo}</div>
        `;

        if (script.existing.length > 0) {
            resultHtml += `<div class="mt-2 text-xs text-green-300">確認済み: ${escapeHtml(script.existing.join(' / '))}</div>`;
        }

        if (script.missing.length > 0) {
            resultHtml += `<div class="mt-1 text-xs text-red-300">不足: ${escapeHtml(script.missing.join(' / '))}</div>`;
        }

        if (Array.isArray(script.details) && script.details.length > 0) {
            const detailText = script.details.map(detail => `${detail.type}: ${detail.ok}/${detail.total}`).join(' ・ ');
            resultHtml += `<div class="mt-2 text-[11px] text-white/60">検査内訳: ${escapeHtml(detailText)}</div>`;
        }

        resultHtml += `</section>`;
    });

    resultHtml += `</div>`;

    await Swal.fire({
        title: 'JavaScript読み込み状態',
        html: resultHtml,
        icon: loadedCount === totalCount ? 'success' : 'warning',
        confirmButtonText: 'OK',
        width: '500px',
        customClass: {
            popup: 'bg-gray-800 text-white',
            title: 'text-white',
            htmlContainer: 'text-white'
        }
    });
});

document.getElementById("quickDiagBtn").addEventListener("click", async () => {
    const diagnostics = performQuickDiagnostics();

    const makeList = (entries) => Object.entries(entries).map(([key, value]) => `<li class="flex justify-between"><span>${escapeHtml(key)}</span><span>${value ? '✅' : '❌'}</span></li>`).join('');

    const pwaStatus = diagnostics.pwaStatus;
    const pwaHtml = pwaStatus
        ? `<div class="mt-1">利用可否: <span class="${pwaStatus.available ? 'text-green-400' : 'text-red-400'}">${pwaStatus.available ? '利用可能' : '未対応'}</span></div>
           <div class="text-white/60 text-[11px]">Safari: ${escapeHtml(pwaStatus.safariVersion || '不明')} / 理由: ${escapeHtml(pwaStatus.reason || '情報なし')}</div>`
        : '<div class="text-white/60 text-[11px]">PWA ステータスは未取得です</div>';

    let resultHtml = `<div class="text-left text-xs space-y-4">`;
    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">基本チェック</h4>
            <ul class="space-y-1">
                <li class="flex justify-between"><span>SweetAlert2</span><span>${diagnostics.swalLoaded ? '✅' : '❌'}</span></li>
                <li class="flex justify-between"><span>ServiceWorker</span><span>${diagnostics.serviceWorker ? '✅' : '❌'}</span></li>
            </ul>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">DOM 要素</h4>
            <ul class="space-y-1">${makeList(diagnostics.domElements)}</ul>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">グローバル関数</h4>
            <ul class="space-y-1">${makeList(diagnostics.globalFunctions)}</ul>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">DevTools 関連</h4>
            <ul class="space-y-1">${makeList(diagnostics.devtoolsFunctions)}</ul>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">ストレージ</h4>
            <div>項目数: <span class="text-white/80">${diagnostics.storage.totalItems}</span></div>
            <div>合計サイズ: <span class="text-white/80">${escapeHtml(diagnostics.storage.sizeFormatted)}</span></div>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">ネットワーク</h4>
            <div>オンライン: ${diagnostics.network.online ? '✅ 接続中' : '❌ オフライン'}</div>
            <div class="text-white/60 text-[11px]">通信品質: ${escapeHtml(diagnostics.network.effectiveType)}</div>
        </section>`;

    resultHtml += `
        <section>
            <h4 class="font-bold mb-2 text-white/80">PWA ステータス</h4>
            ${pwaHtml}
        </section>`;

    resultHtml += `</div>`;

    const hasIssues = !diagnostics.swalLoaded ||
                     Object.values(diagnostics.domElements).some(v => !v) ||
                     Object.values(diagnostics.globalFunctions).some(v => !v) ||
                     !diagnostics.network.online;

    await Swal.fire({
        title: '簡易診断結果',
        html: resultHtml,
        icon: hasIssues ? 'warning' : 'success',
        confirmButtonText: 'OK',
        width: '600px',
        footer: 'ブラウザコンソール(F12)で詳細を確認できます',
        customClass: {
            popup: 'bg-gray-800 text-white',
            title: 'text-white',
            htmlContainer: 'text-white',
            footer: 'text-white'
        }
    });
});

document.getElementById("clearLocalStorageBtn").addEventListener("click", async () => {
    const storageInfo = analyzeLocalStorage();
    
    const result = await Swal.fire({
        title: 'ローカルストレージを初期化',
        html: `
            <div class="text-left text-sm">
                <p class="mb-2">現在の状況:</p>
                <ul class="mb-4">
                    <li>項目数: ${storageInfo.totalItems}</li>
                    <li>合計サイズ: ${storageInfo.sizeFormatted}</li>
                </ul>
                <p class="text-red-400 font-bold">この操作は元に戻せません。</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '初期化する',
        cancelButtonText: 'キャンセル',
        confirmButtonColor: '#dc2626',
        customClass: {
            popup: 'bg-gray-800 text-white',
            title: 'text-white',
            htmlContainer: 'text-white'
        }
    });
    
    if (result.isConfirmed) {
        addDebugLog('info', 'ローカルストレージ初期化実行', storageInfo);
        localStorage.clear();
        
        await Swal.fire({
            icon: 'success',
            title: '初期化完了',
            text: 'ローカルストレージを初期化しました。',
            timer: 1500,
            showConfirmButton: false,
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white'
            }
        });
    }
});

document.getElementById("showDebugLogBtn").addEventListener("click", () => {
    const modal = document.getElementById('debugLogModal');
    const content = document.getElementById('debugLogContent');
    if (!modal || !content) return;

    const diagnostics = getSystemDiagnostics();

    content.innerHTML = `
        <section class="bg-black/25 border border-white/10 rounded-lg p-3 space-y-1">
            <h4 class="font-semibold text-white/80">システム情報</h4>
            <div>ブラウザ: <span class="text-white/80">${escapeHtml(diagnostics.userAgent.split(' ').pop() || '不明')}</span></div>
            <div>画面: <span class="text-white/80">${diagnostics.screen.width}×${diagnostics.screen.height}</span></div>
            <div>メモリ: <span class="text-white/80">${escapeHtml(typeof diagnostics.memory === 'object' ? diagnostics.memory.used : diagnostics.memory)}</span></div>
            <div>デバイスメモリ: <span class="text-white/80">${escapeHtml(diagnostics.deviceMemory)}</span></div>
            <div>最終完全同期: <span class="text-white/80">${escapeHtml(lastFullSync || '未実行')}</span></div>
        </section>
        <section>
            <div class="flex flex-wrap items-center gap-3 mb-3">
                <label class="flex items-center gap-1">レベル
                    <select id="debugLogLevelFilter" class="bg-black/40 border border-white/20 rounded px-2 py-1">
                        <option value="all">すべて</option>
                        <option value="info">INFO</option>
                        <option value="warn">WARN</option>
                        <option value="error">ERROR</option>
                        <option value="debug">DEBUG</option>
                    </select>
                </label>
                <label class="flex items-center gap-1">件数
                    <select id="debugLogLimit" class="bg-black/40 border border-white/20 rounded px-2 py-1">
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </label>
                <div class="ml-auto flex gap-2">
                    <button id="debugLogCopyBtn" class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white">コピー</button>
                    <button id="debugLogDownloadBtn" class="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white">JSON出力</button>
                </div>
            </div>
            <div class="text-white/60 text-[11px] mb-2">保持件数: ${debugLog.length} / 表示上限: ${maxLogEntries}</div>
            <div id="debugLogEntries" class="space-y-2 max-h-64 overflow-y-auto pr-1"></div>
        </section>
    `;

    const levelSelect = content.querySelector('#debugLogLevelFilter');
    const limitSelect = content.querySelector('#debugLogLimit');
    const entriesContainer = content.querySelector('#debugLogEntries');
    const copyBtn = content.querySelector('#debugLogCopyBtn');
    const downloadBtn = content.querySelector('#debugLogDownloadBtn');

    const refresh = () => {
        const level = levelSelect.value;
        const limit = parseInt(limitSelect.value, 10);
        renderDebugLogEntries(entriesContainer, { level, limit });
    };

    levelSelect.addEventListener('change', refresh);
    limitSelect.addEventListener('change', refresh);

    copyBtn?.addEventListener('click', async () => {
        try {
            const level = levelSelect.value;
            const limit = parseInt(limitSelect.value, 10);
            const slice = getDebugLogSlice(level, limit);
            await navigator.clipboard.writeText(JSON.stringify(slice, null, 2));
            Toast?.fire({ icon: 'success', title: 'ログをコピーしました' });
        } catch (error) {
            console.error('ログコピーに失敗しました:', error);
            Toast?.fire({ icon: 'error', title: 'コピーに失敗しました' });
        }
    });

    downloadBtn?.addEventListener('click', () => {
        try {
            const level = levelSelect.value;
            const limit = parseInt(limitSelect.value, 10);
            const slice = getDebugLogSlice(level, limit);
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), level, limit, entries: slice }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tabdock-debug-log-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            Toast?.fire({ icon: 'success', title: 'ログをエクスポートしました' });
        } catch (error) {
            console.error('ログエクスポートに失敗しました:', error);
            Toast?.fire({ icon: 'error', title: 'エクスポートに失敗しました' });
        }
    });

    refresh();
    modal.classList.remove('hidden');
});

document.getElementById("closeDebugLogModal")?.addEventListener("click", () => {
    document.getElementById('debugLogModal').classList.add('hidden');
});

document.getElementById("deleteAllShiftsBtn").addEventListener("click", async () => {
    await deleteAllShiftsForUser();
});

document.getElementById("showSubscriptionPreviewBtn")?.addEventListener("click", async () => {
    try {
        await showDevtoolsSubscriptionPreview();
    } catch (error) {
        console.error('支払予定プレビューの表示に失敗しました:', error);
        Toast?.fire({ icon: 'error', title: 'プレビューの表示に失敗しました' });
    }
});

document.getElementById("runPerfTestBtn").addEventListener("click", async () => {
    console.log('=== パフォーマンステストボタンが押されました ===');
    if (isPerfTestRunning) {
        console.log('⚠️ パフォーマンステストは既に実行中です。重複起動をスキップします。');
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'info',
                title: 'テスト実行中',
                text: '現在テストを実行中です。完了までお待ちください。',
                timer: 1500,
                showConfirmButton: false,
                customClass: {
                    popup: 'bg-gray-800 text-white',
                    title: 'text-white',
                    htmlContainer: 'text-white'
                }
            });
        }
        return;
    }
    isPerfTestRunning = true;
    const perfBtn = document.getElementById("runPerfTestBtn");
    if (perfBtn) {
        if (!perfBtn.dataset.originalLabel) {
            perfBtn.dataset.originalLabel = perfBtn.innerHTML;
        }
        perfBtn.disabled = true;
        perfBtn.innerHTML = 'テスト中...';
    }
    
    Swal.fire({
        title: 'パフォーマンステスト実行中...',
        text: 'ブラウザとシステムの性能を測定しています',
        allowOutsideClick: false,
        showConfirmButton: false,
        customClass: {
            popup: 'bg-gray-800 text-white',
            title: 'text-white',
            htmlContainer: 'text-white'
        },
        didOpen: () => {
            console.log('パフォーマンステストのローディングダイアログが表示されました');
            Swal.showLoading();
        }
    });
    console.log('パフォーマンステストのローディングダイアログを開始しました（非同期）');
    
    try {
        console.log('パフォーマンステスト実行開始');
        const results = await runPerformanceTest();
        console.log('パフォーマンステスト実行完了:', results);
        
        let resultHtml = `<div class="text-left text-sm">`;
        resultHtml += `<h4 class="font-bold mb-3 text-blue-400">📊 パフォーマンステスト結果</h4>`;
        
        results.forEach(test => {
            resultHtml += `<div class="mb-3 p-2 border border-gray-600 rounded">`;
            resultHtml += `<div class="font-semibold text-white">${test.name}</div>`;
            
            if (test.description) {
                resultHtml += `<div class="text-xs text-gray-400 mb-1">${test.description}</div>`;
            }
            
            if (test.error) {
                resultHtml += `<div class="text-red-400 font-mono text-xs">❌ エラー: ${test.error}</div>`;
            } else if (test.time !== undefined) {
                const timeClass = test.time < 50 ? 'text-green-400' : test.time < 200 ? 'text-yellow-400' : 'text-red-400';
                let performanceLevel = '';
                if (test.time < 50) performanceLevel = '(高速 🚀)';
                else if (test.time < 200) performanceLevel = '(標準 ✅)';
                else performanceLevel = '(低速 ⚠️)';
                
                resultHtml += `<div class="${timeClass} font-bold">⏱️ ${test.time}ms ${performanceLevel}</div>`;
                
                if (test.status) {
                    resultHtml += `<div class="text-xs text-gray-400">HTTP Status: ${test.status}</div>`;
                }
                if (test.dataSize) {
                    resultHtml += `<div class="text-xs text-gray-400">データサイズ: ${test.dataSize}</div>`;
                }
                if (test.result) {
                    resultHtml += `<div class="text-xs text-gray-400">${test.result}</div>`;
                }
            } else if (test.used) {
                resultHtml += `<div class="text-blue-400">`;
                resultHtml += `<div>使用中: ${test.used}</div>`;
                resultHtml += `<div>総容量: ${test.total}</div>`;
                resultHtml += `<div>上限: ${test.limit}</div>`;
                resultHtml += `</div>`;
            }
            
            resultHtml += `</div>`;
        });
        
    resultHtml += `<div class="mt-4 p-2 bg-black/20 rounded text-xs">`;
    resultHtml += `<h5 class="font-bold text-blue-300 mb-1">📝 テスト内容説明(ヘビー):</h5>`;
    resultHtml += `<ul class="text-blue-200 space-y-1">`;
    resultHtml += `<li>• DOM構築/レイアウト: 大量要素追加とレイアウト計算</li>`;
    resultHtml += `<li>• ネットワーク(並列): 5本の同時Ping平均/分散</li>`;
    resultHtml += `<li>• ストレージ: 256KBの保存・読み込み・削除</li>`;
    resultHtml += `<li>• 計算処理(ヘビー): 50万回の数学計算 + 10万要素reduce</li>`;
    resultHtml += `<li>• JSON: 1万件のシリアライズ/デシリアライズ</li>`;
    resultHtml += `<li>• ハッシュ: 1MBのSHA-256</li>`;
    resultHtml += `<li>• Canvas: 512x512への1000回描画</li>`;
    resultHtml += `<li>• メモリ: 現在の使用量/上限</li>`;
    resultHtml += `</ul>`;
    resultHtml += `</div>`;
        
        resultHtml += `</div>`;
        
        console.log('パフォーマンステスト結果ダイアログを表示します');
        await Swal.fire({
            title: '🔍 パフォーマンステスト結果',
            html: resultHtml,
            icon: 'info',
            confirmButtonText: 'OK',
            width: '600px',
            footer: '数値が小さいほど高速です。ブラウザの性能や負荷状況により結果は変動します。',
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white',
                footer: 'text-white'
            }
        });
        
    } catch (error) {
        console.error('パフォーマンステスト中にエラーが発生:', error);
        
        try {
            await Swal.fire({
                icon: 'error',
                title: 'パフォーマンステスト失敗',
                html: `
                    <div class="text-left">
                        <p>パフォーマンステスト中にエラーが発生しました。</p>
                        <div class="mt-2 text-sm text-red-400">
                            エラー: ${error.message || error}
                        </div>
                    </div>
                `,
                footer: 'F12を押してコンソールを確認してください。',
                customClass: {
                    popup: 'bg-gray-800 text-white',
                    title: 'text-white',
                    htmlContainer: 'text-white',
                    footer: 'text-white'
                }
            });
        } catch (swalErr) {
            console.error('エラーダイアログの表示でもエラー:', swalErr);
            alert('パフォーマンステストでエラーが発生しました: ' + (error.message || error));
        }
    } finally {
        isPerfTestRunning = false;
        const btn = document.getElementById("runPerfTestBtn");
        if (btn) {
            btn.disabled = false;
            if (btn.dataset.originalLabel) {
                btn.innerHTML = btn.dataset.originalLabel;
                delete btn.dataset.originalLabel;
            }
        }
    }
});

document.getElementById("reloadPageBtn").addEventListener("click", async () => {
    const result = await Swal.fire({
        title: 'ページを再読み込み',
        text: '現在の作業内容は失われます。続行しますか？',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '再読み込み',
        cancelButtonText: 'キャンセル',
        customClass: {
            popup: 'bg-gray-800 text-white',
            title: 'text-white',
            htmlContainer: 'text-white'
        }
    });
    
    if (result.isConfirmed) {
        addDebugLog('info', 'ページ再読み込み実行');
        location.reload();
    }
});

console.log('=== DevTools JavaScript読み込み開始 ===');
console.log('現在時刻:', new Date().toISOString());
console.log('document.readyState:', document.readyState);
addDebugLog('info', 'DevTools初期化完了', { version: '3.1.0_devtools-r8' });

console.log('=== 即座実行: 基本確認 ===');
console.log('Swal:', typeof Swal);
console.log('performFullSync:', typeof performFullSync);
console.log('addDebugLog:', typeof addDebugLog);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('=== DOMContentLoaded時の確認 ===');
        console.log('forceSyncBtn要素:', document.getElementById("forceSyncBtn"));
    });
} else {
    console.log('=== DOM既に読み込み済み ===');
    console.log('forceSyncBtn要素:', document.getElementById("forceSyncBtn"));
}

function performQuickDiagnostics() {
    console.log('=== クイック診断開始 ===');

    const diagnostics = {
        timestamp: new Date().toISOString(),
        swalLoaded: typeof Swal !== 'undefined',
        domElements: {
            clock: !!document.getElementById('clock'),
            date: !!document.getElementById('date'),
            forceSyncBtn: !!document.getElementById('forceSyncBtn')
        },
        globalFunctions: {
            fetchWeather: typeof window.fetchWeather === 'function',
            loadSchedules: typeof window.loadSchedules === 'function',
            fetchHolidayData: typeof window.fetchHolidayData === 'function',
            renderCalendar: typeof window.renderCalendar === 'function',
            checkApi: typeof window.checkApi === 'function'
        },
        devtoolsFunctions: {
            performFullSync: typeof performFullSync === 'function',
            addDebugLog: typeof addDebugLog === 'function'
        },
        storage: (() => {
            const info = analyzeLocalStorage();
            return {
                totalItems: info.totalItems,
                sizeFormatted: info.sizeFormatted
            };
        })(),
        network: {
            online: navigator.onLine,
            effectiveType: navigator.connection?.effectiveType || 'unknown'
        },
        serviceWorker: typeof navigator.serviceWorker === 'object',
        pwaStatus: window.__pwaStatus || null
    };

    console.log('診断結果:', diagnostics);
    addDebugLog('info', 'クイック診断実行', diagnostics);

    return diagnostics;
}

function resolveSubscriptionUsername() {
    try {
        if (typeof window.getLoggedInUser === 'function') {
            const user = window.getLoggedInUser();
            if (user?.username) return user.username;
        }
    } catch (error) {
        console.warn('ログインユーザー取得に失敗しました:', error);
    }

    try {
        const storedUser = localStorage.getItem('tabdock_user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed?.username) return parsed.username;
        }
    } catch (error) {
        console.warn('ローカルストレージのユーザー情報解析に失敗しました:', error);
    }

    return null;
}

async function fetchUpcomingSubscriptionsForDevtools() {
    const manager = window.subscriptionManager;
    if (manager?.cachedUpcoming?.length) {
        return { entries: manager.cachedUpcoming, source: 'cache' };
    }

    const username = resolveSubscriptionUsername();
    if (!username) {
        return { entries: [], source: 'no-user' };
    }

    try {
        const response = await fetch('/api/subscriptions/upcoming', {
            headers: { 'X-Username': encodeURIComponent(username) },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('支払予定の取得に失敗しました');
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            return { entries: [], source: 'empty' };
        }

        return { entries: data, source: 'fetched' };
    } catch (error) {
        console.error('支払予定プレビューの取得に失敗しました:', error);
        addDebugLog('error', '支払予定プレビューの取得に失敗', error);
        return { entries: [], source: 'error', error };
    }
}

function formatSubscriptionAmount(sub) {
    if (typeof sub?.amount === 'number') {
        return `${sub.amount.toLocaleString()} ${sub.currency || ''}`.trim();
    }
    if (typeof sub?.amount === 'string' && sub.amount.trim() !== '') {
        return `${sub.amount} ${sub.currency || ''}`.trim();
    }
    return '金額未設定';
}

function createSubscriptionPreviewHtml(entries = [], source = 'unknown') {
    const sourceLabel = {
        cache: 'キャッシュ済みデータを表示',
        fetched: '最新の支払予定を取得しました',
        empty: '検索結果: 予定は見つかりませんでした',
        'no-user': 'ユーザー未特定のため取得できません',
        error: '取得時にエラーが発生しました'
    }[source] || '支払予定の確認';

    if (!Array.isArray(entries) || entries.length === 0) {
        return `
            <div class="devtools-subscription-container">
                <p class="devtools-subscription-title">近い支払予定はありません</p>
                <p class="devtools-subscription-hint">${escapeHtml(sourceLabel)}</p>
                <div class="devtools-subscription-empty"></div>
            </div>
        `;
    }

    const items = entries.map((sub) => {
        const name = escapeHtml(sub?.serviceName || '名称未設定');
        const amount = escapeHtml(formatSubscriptionAmount(sub));
        const paymentDate = sub?.nextPaymentDate ? new Date(sub.nextPaymentDate) : null;
        const dateLabel = paymentDate && !Number.isNaN(paymentDate.getTime())
            ? paymentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
            : '日付未設定';
        const cycle = escapeHtml(sub?.billingCycle || '周期未設定');
        return `
            <li class="devtools-subscription-item">
                <div class="devtools-subscription-header">
                    <span class="devtools-subscription-name">${name}</span>
                    <span class="devtools-subscription-amount">${amount}</span>
                </div>
                <div class="devtools-subscription-meta">
                    <span class="devtools-subscription-badge">${escapeHtml(dateLabel)}</span>
                    <span class="devtools-subscription-cycle">${cycle}</span>
                </div>
            </li>
        `;
    }).join('');

    return `
        <div class="devtools-subscription-container">
            <p class="devtools-subscription-title">支払予定プレビュー</p>
            <p class="devtools-subscription-hint">${escapeHtml(sourceLabel)}</p>
            <ul class="devtools-subscription-list">${items}</ul>
        </div>
    `;
}

async function showDevtoolsSubscriptionPreview() {
    if (typeof Swal === 'undefined') {
        console.warn('SweetAlert2 が読み込まれていないため、支払予定プレビューを表示できません。');
        return;
    }

    const { entries, source } = await fetchUpcomingSubscriptionsForDevtools();
    addDebugLog('info', '支払予定プレビューを開きました', { count: entries?.length || 0, source });

    const html = createSubscriptionPreviewHtml(entries, source);

    await Swal.fire({
        title: '支払予定 (確認用)',
        html,
        icon: entries?.length ? 'info' : 'question',
        confirmButtonText: '閉じる',
        width: '640px',
        customClass: {
            popup: 'devtools-subscription-popup',
            title: 'text-white',
            htmlContainer: 'text-white'
        },
        background: '#0b1220',
        color: '#e5e7eb'
    });
}

// シフト削除機能
async function deleteAllShiftsForUser() {
    try {
        const user = getLoggedInUser();
        if (!user || !user.username) {
            throw new Error('ログインユーザーが見つかりません');
        }
        const username = user.username;

        // サーバーにユーザー情報を確認
        const userResponse = await fetch('/api/auth/user-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        });

        const userData = await userResponse.json();
        if (!userData.success) {
            throw new Error('ユーザー認証に失敗しました');
        }

        const result = await Swal.fire({
            title: '全シフトの削除',
            html: `
                <div class="text-left">
                    <p class="mb-2">ユーザー "${username}" の全シフトを削除します。</p>
                    <p class="text-red-400 font-bold">この操作は元に戻せません！</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '削除する',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#dc2626',
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white'
            }
        });

        if (result.isConfirmed) {
            const response = await fetch('/api/shift', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Username': encodeURIComponent(username)
                }
            });

            if (!response.ok) {
                throw new Error('シフトの削除に失敗しました');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'シフトの削除に失敗しました');
            }

            await Swal.fire({
                icon: 'success',
                title: '削除完了',
                text: 'すべてのシフトを削除しました',
                timer: 2000,
                showConfirmButton: false,
                customClass: {
                    popup: 'bg-gray-800 text-white',
                    title: 'text-white',
                    htmlContainer: 'text-white'
                }
            });

            // カレンダーを再読み込み
            if (typeof loadSchedules === 'function') {
                await loadSchedules();
            }
        }
    } catch (error) {
        console.error('シフト削除エラー:', error);
        await Swal.fire({
            icon: 'error',
            title: 'エラー',
            text: error.message,
            confirmButtonText: '閉じる',
            customClass: {
                popup: 'bg-gray-800 text-white',
                title: 'text-white',
                htmlContainer: 'text-white'
            }
        });
    }
}

console.log('=== DevTools自動診断開始 ===');
setTimeout(() => {
    console.log('=== 1秒後の自動診断実行 ===');
    
    const forceSyncBtn = document.getElementById("forceSyncBtn");
    console.log('forceSyncBtn要素の確認:', forceSyncBtn);
    console.log('forceSyncBtn要素のイベントリスナー数:', forceSyncBtn?.getEventListeners ? forceSyncBtn.getEventListeners() : 'getEventListeners不利用可能');
    
    console.log('performFullSync関数:', typeof performFullSync);
    console.log('Swal:', typeof Swal);
    console.log('SweetAlert2のバージョン:', typeof Swal !== 'undefined' ? Swal.version : '未定義');
    
    performQuickDiagnostics();
    
    console.log('=== DevTools初期化完了 ===');
}, 1000);

window.manualTestPerformFullSync = async function() {
    console.log('=== 手動テスト: performFullSync ===');
    console.log('実行中フラグ確認:', isFullSyncRunning);
    
    if (isFullSyncRunning) {
        console.log('⚠️ 既に実行中のため手動テストをスキップします');
        return { skipped: true, reason: '既に実行中' };
    }
    
    try {
        const result = await performFullSync();
        console.log('手動テスト結果:', result);
        return result;
    } catch (error) {
        console.error('手動テストでエラー:', error);
        throw error;
    }
};

window.manualTestButtonClick = function() {
    console.log('=== 手動テスト: ボタンクリック ===');
    console.log('実行中フラグ確認:', isFullSyncRunning);
    const btn = document.getElementById("forceSyncBtn");
    console.log('ボタン要素:', btn);
    console.log('ボタン状態 - disabled:', btn?.disabled, 'textContent:', btn?.textContent);
    
    if (btn) {
        btn.click();
        console.log('ボタンクリック実行完了');
    } else {
        console.error('ボタン要素が見つかりません');
    }
};

window.checkSyncStatus = function() {
    console.log('=== 現在の同期状態 ===');
    console.log('実行中フラグ:', isFullSyncRunning);
    const btn = document.getElementById("forceSyncBtn");
    console.log('ボタン状態:', {
        disabled: btn?.disabled,
        textContent: btn?.textContent,
        exists: !!btn
    });
    return {
        isRunning: isFullSyncRunning,
        buttonState: {
            disabled: btn?.disabled,
            textContent: btn?.textContent,
            exists: !!btn
        }
    };
};

window.resetSyncFlag = function() {
    console.log('=== 手動でフラグをリセット ===');
    const oldValue = isFullSyncRunning;
    setFullSyncRunning(false, '手動リセット');
    const btn = document.getElementById("forceSyncBtn");
    if (btn) {
        btn.disabled = false;
        btn.textContent = '完全同期';
        console.log('ボタンも復元しました');
    }
    return { old: oldValue, new: isFullSyncRunning };
};

console.log('=== DevTools読み込み完了 ===');
console.log('手動テスト関数が利用可能です:');
console.log('- window.manualTestPerformFullSync()');
console.log('- window.manualTestButtonClick()');
console.log('- window.checkSyncStatus()');
console.log('- window.resetSyncFlag()');
console.log('重複実行防止機能が追加されました（SweetAlert非同期対応版）');
console.log('devtools.js読み込み完了時刻:', new Date().toISOString());
