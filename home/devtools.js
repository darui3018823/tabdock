// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.3.0_devtools-r1

let debugLog = [];
let maxLogEntries = 100;
let lastFullSync = null;

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
        { name: 'script.js', functions: [], elements: ['clock', 'date'] }, // DOM要素で確認
        { name: 'weather.js', functions: ['fetchWeather'] },
        { name: 'status.js', functions: ['checkApi', 'fetchJsVersion'] },
        { name: 'calendar.js', functions: ['renderCalendar', 'fetchHolidayData', 'loadSchedules'] },
        { name: 'ui_visibility.js', functions: ['applyVisualSettings'] },
        { name: 'tabdock_about.js', functions: [] },
        { name: 'passkey.js', functions: [] },
        { name: 'devtools.js', functions: ['addDebugLog', 'performFullSync'] }
    ];
    
    const results = scripts.map(script => {
        let isLoaded = false;
        let loadedFunctions = [];
        let missingFunctions = [];
        
        if (script.functions && script.functions.length > 0) {
            loadedFunctions = script.functions.filter(func => typeof window[func] === 'function');
            missingFunctions = script.functions.filter(func => typeof window[func] !== 'function');
            isLoaded = loadedFunctions.length > 0;
        } else if (script.elements && script.elements.length > 0) {
            const existingElements = script.elements.filter(id => document.getElementById(id) !== null);
            isLoaded = existingElements.length === script.elements.length;
            loadedFunctions = existingElements;
            missingFunctions = script.elements.filter(id => document.getElementById(id) === null);
        } else {
            isLoaded = true;
        }
        
        return {
            name: script.name,
            loaded: isLoaded,
            functions: script.functions ? script.functions.length : 0,
            loadedFunctions: loadedFunctions.length,
            missingFunctions: missingFunctions,
            checkType: script.elements ? 'DOM elements' : 'functions'
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
            { name: '天気データ', func: 'fetchWeather' },
            { name: 'スケジュール読み込み', func: 'loadSchedules' },
            { name: '祝日データ', func: 'fetchHolidayData' },
            { name: 'サブスクリプション予定更新', func: 'loadSubscriptions' },
            { name: 'カレンダー再描画', func: 'renderCalendar' }
        ];
        
        console.log('同期タスク一覧:', syncTasks);
        
        const results = [];
        
        console.log('=== 利用可能な関数をチェック ===');
        syncTasks.forEach(task => {
            const isAvailable = typeof window[task.func] === 'function';
            console.log(`${task.func}: ${isAvailable ? '利用可能' : '利用不可'} (type: ${typeof window[task.func]})`);
        });
        
        console.log('関数チェック完了、同期処理を開始します');
        
        console.log('=== グローバル関数の同期開始 ===');
    for (const task of syncTasks) {
        console.log(`${task.name} (${task.func}) の同期を開始...`);
        try {
            if (typeof window[task.func] === 'function') {
                const taskStart = performance.now();
                console.log(`${task.func}() を実行中...`);
                await window[task.func]();
                const taskTime = Math.round(performance.now() - taskStart);
                results.push({ name: task.name, status: 'success', time: taskTime });
                console.log(`✅ ${task.name}同期完了 (${taskTime}ms)`);
                addDebugLog('info', `${task.name}同期完了 (${taskTime}ms)`);
            } else {
                results.push({ name: task.name, status: 'skipped', reason: '関数が見つかりません' });
                console.log(`⚠️ ${task.name}同期スキップ: 関数が見つかりません`);
                addDebugLog('warn', `${task.name}同期スキップ: 関数が見つかりません`);
            }
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
        
        await Swal.fire({
            icon: errorCount > 0 ? 'warning' : 'success',
            title: '同期完了',
            html: `
                <div class="text-left">
                    <p>同期処理が完了しました (${result.totalTime}ms)</p>
                    <ul class="mt-2 text-sm">
                        <li class="text-green-600">成功: ${successCount}件</li>
                        ${errorCount > 0 ? `<li class="text-red-600">エラー: ${errorCount}件</li>` : ''}
                        ${skippedCount > 0 ? `<li class="text-yellow-600">スキップ: ${skippedCount}件</li>` : ''}
                    </ul>
                    <div class="mt-3 text-xs text-gray-600">
                        詳細はブラウザのコンソールを確認してください
                    </div>
                </div>
            `,
            timer: 5000,
            showConfirmButton: true
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
                        <div class="mt-2 text-sm text-red-600">
                            エラー: ${error.message || error}
                        </div>
                        <div class="mt-2 text-xs text-gray-600">
                            詳細はブラウザのコンソールを確認してください
                        </div>
                    </div>
                `,
                footer: 'F12を押してコンソールを開き、エラーの詳細を確認してください。'
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
    
    let resultHtml = `<div class="text-left text-sm">`;
    resultHtml += `<p class="mb-3 font-bold">読み込み状況: ${loadedCount}/${totalCount}</p>`;
    
    results.forEach(script => {
        const statusIcon = script.loaded ? '✅' : '❌';
        const statusText = script.loaded ? 'OK' : 'NG';
        resultHtml += `<div class="mb-1 flex justify-between">`;
        resultHtml += `<span>${statusIcon} ${script.name}</span>`;
        resultHtml += `<span class="${script.loaded ? 'text-green-600' : 'text-red-600'}">${statusText}</span>`;
        resultHtml += `</div>`;
        
        if (!script.loaded && script.missingFunctions.length > 0) {
            const missingType = script.checkType === 'DOM elements' ? 'Missing elements' : 'Missing functions';
            resultHtml += `<div class="ml-4 text-xs text-red-500">${missingType}: ${script.missingFunctions.join(', ')}</div>`;
        }
        
        if (script.checkType) {
            resultHtml += `<div class="ml-4 text-xs text-gray-500">Check: ${script.checkType}</div>`;
        }
    });
    
    resultHtml += `</div>`;
    
    await Swal.fire({
        title: 'JavaScript読み込み状態',
        html: resultHtml,
        icon: loadedCount === totalCount ? 'success' : 'warning',
        confirmButtonText: 'OK',
        width: '500px'
    });
});

document.getElementById("quickDiagBtn").addEventListener("click", async () => {
    const diagnostics = performQuickDiagnostics();
    
    let resultHtml = `<div class="text-left text-xs">`;
    resultHtml += `<h4 class="font-bold mb-2">基本チェック</h4>`;
    resultHtml += `<div class="mb-2">SweetAlert2: ${diagnostics.swalLoaded ? '✅ 読み込み済み' : '❌ 未読み込み'}</div>`;
    
    resultHtml += `<h4 class="font-bold mb-2 mt-4">DOM要素</h4>`;
    Object.entries(diagnostics.domElements).forEach(([key, value]) => {
        resultHtml += `<div class="mb-1">${key}: ${value ? '✅' : '❌'}</div>`;
    });
    
    resultHtml += `<h4 class="font-bold mb-2 mt-4">グローバル関数</h4>`;
    Object.entries(diagnostics.globalFunctions).forEach(([key, value]) => {
        resultHtml += `<div class="mb-1">${key}: ${value ? '✅' : '❌'}</div>`;
    });
    
    resultHtml += `<h4 class="font-bold mb-2 mt-4">DevTools関数</h4>`;
    Object.entries(diagnostics.devtoolsFunctions).forEach(([key, value]) => {
        resultHtml += `<div class="mb-1">${key}: ${value ? '✅' : '❌'}</div>`;
    });
    
    resultHtml += `</div>`;
    
    const hasIssues = !diagnostics.swalLoaded || 
                     Object.values(diagnostics.domElements).some(v => !v) || 
                     Object.values(diagnostics.globalFunctions).some(v => !v);
    
    await Swal.fire({
        title: '簡易診断結果',
        html: resultHtml,
        icon: hasIssues ? 'warning' : 'success',
        confirmButtonText: 'OK',
        width: '600px',
        footer: 'ブラウザコンソール(F12)で詳細を確認できます'
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
                <p class="text-red-600 font-bold">この操作は元に戻せません。</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '初期化する',
        cancelButtonText: 'キャンセル',
        confirmButtonColor: '#dc2626'
    });
    
    if (result.isConfirmed) {
        addDebugLog('info', 'ローカルストレージ初期化実行', storageInfo);
        localStorage.clear();
        
        await Swal.fire({
            icon: 'success',
            title: '初期化完了',
            text: 'ローカルストレージを初期化しました。',
            timer: 1500,
            showConfirmButton: false
        });
    }
});

document.getElementById("showDebugLogBtn").addEventListener("click", async () => {
    const diagnostics = getSystemDiagnostics();
    
    let logHtml = `<div class="text-left text-xs">`;
    logHtml += `<div class="mb-4 p-2 bg-gray-100 rounded">`;
    logHtml += `<h4 class="font-bold mb-2">システム情報</h4>`;
    logHtml += `<div>ブラウザ: ${diagnostics.userAgent.split(' ').pop()}</div>`;
    logHtml += `<div>画面: ${diagnostics.screen.width}x${diagnostics.screen.height}</div>`;
    logHtml += `<div>メモリ使用量: ${typeof diagnostics.memory === 'object' ? diagnostics.memory.used : diagnostics.memory}</div>`;
    logHtml += `<div>デバイスメモリ(概算): ${diagnostics.deviceMemory}</div>`;
    logHtml += `<div>最終同期: ${lastFullSync || '未実行'}</div>`;
    logHtml += `</div>`;
    
    logHtml += `<h4 class="font-bold mb-2">デバッグログ (最新${Math.min(10, debugLog.length)}件)</h4>`;
    
    if (debugLog.length === 0) {
        logHtml += `<p class="text-gray-500">ログはありません</p>`;
    } else {
        debugLog.slice(0, 10).forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            const levelColor = {
                info: 'text-blue-600',
                warn: 'text-yellow-600',
                error: 'text-red-600'
            }[log.level] || 'text-gray-600';
            
            logHtml += `<div class="mb-1 p-1 border-l-2 border-gray-300">`;
            logHtml += `<div class="flex justify-between">`;
            logHtml += `<span class="${levelColor} font-mono">[${log.level.toUpperCase()}]</span>`;
            logHtml += `<span class="text-gray-500">${timeStr}</span>`;
            logHtml += `</div>`;
            logHtml += `<div class="mt-1">${log.message}</div>`;
            logHtml += `</div>`;
        });
    }
    
    logHtml += `</div>`;
    
    await Swal.fire({
        title: 'デバッグ情報',
        html: logHtml,
        width: '600px',
        confirmButtonText: 'OK'
    });
});

document.getElementById("deleteAllShiftsBtn").addEventListener("click", async () => {
    await deleteAllShiftsForUser();
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
                showConfirmButton: false
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
        resultHtml += `<h4 class="font-bold mb-3 text-blue-600">📊 パフォーマンステスト結果</h4>`;
        
        results.forEach(test => {
            resultHtml += `<div class="mb-3 p-2 border border-gray-200 rounded">`;
            resultHtml += `<div class="font-semibold text-gray-800">${test.name}</div>`;
            
            if (test.description) {
                resultHtml += `<div class="text-xs text-gray-500 mb-1">${test.description}</div>`;
            }
            
            if (test.error) {
                resultHtml += `<div class="text-red-600 font-mono text-xs">❌ エラー: ${test.error}</div>`;
            } else if (test.time !== undefined) {
                const timeClass = test.time < 50 ? 'text-green-600' : test.time < 200 ? 'text-yellow-600' : 'text-red-600';
                let performanceLevel = '';
                if (test.time < 50) performanceLevel = '(高速 🚀)';
                else if (test.time < 200) performanceLevel = '(標準 ✅)';
                else performanceLevel = '(低速 ⚠️)';
                
                resultHtml += `<div class="${timeClass} font-bold">⏱️ ${test.time}ms ${performanceLevel}</div>`;
                
                if (test.status) {
                    resultHtml += `<div class="text-xs text-gray-600">HTTP Status: ${test.status}</div>`;
                }
                if (test.dataSize) {
                    resultHtml += `<div class="text-xs text-gray-600">データサイズ: ${test.dataSize}</div>`;
                }
                if (test.result) {
                    resultHtml += `<div class="text-xs text-gray-600">${test.result}</div>`;
                }
            } else if (test.used) {
                resultHtml += `<div class="text-blue-600">`;
                resultHtml += `<div>使用中: ${test.used}</div>`;
                resultHtml += `<div>総容量: ${test.total}</div>`;
                resultHtml += `<div>上限: ${test.limit}</div>`;
                resultHtml += `</div>`;
            }
            
            resultHtml += `</div>`;
        });
        
    resultHtml += `<div class="mt-4 p-2 bg-blue-50 rounded text-xs">`;
    resultHtml += `<h5 class="font-bold text-blue-800 mb-1">📝 テスト内容説明(ヘビー):</h5>`;
    resultHtml += `<ul class="text-blue-700 space-y-1">`;
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
            footer: '数値が小さいほど高速です。ブラウザの性能や負荷状況により結果は変動します。'
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
                        <div class="mt-2 text-sm text-red-600">
                            エラー: ${error.message || error}
                        </div>
                    </div>
                `,
                footer: 'F12を押してコンソールを確認してください。'
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
        cancelButtonText: 'キャンセル'
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
        }
    };
    
    console.log('診断結果:', diagnostics);
    addDebugLog('info', 'クイック診断実行', diagnostics);
    
    return diagnostics;
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
                    <p class="text-red-600 font-bold">この操作は元に戻せません！</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '削除する',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#dc2626'
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
                showConfirmButton: false
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
            confirmButtonText: '閉じる'
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
