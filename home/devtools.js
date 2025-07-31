// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.1.0_devtools-r8

// グローバル変数: デバッグログを保存するためのキューと診断情報
let debugLog = [];
let maxLogEntries = 100;
let lastFullSync = null;

// デバッグログ記録用のヘルパー関数
function addDebugLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    debugLog.unshift(logEntry);
    if (debugLog.length > maxLogEntries) {
        debugLog = debugLog.slice(0, maxLogEntries);
    }
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
}

// JavaScriptファイルの読み込み状態をチェックする関数
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
            // 関数ベースの確認
            loadedFunctions = script.functions.filter(func => typeof window[func] === 'function');
            missingFunctions = script.functions.filter(func => typeof window[func] !== 'function');
            isLoaded = loadedFunctions.length > 0;
        } else if (script.elements && script.elements.length > 0) {
            // DOM要素ベースの確認
            const existingElements = script.elements.filter(id => document.getElementById(id) !== null);
            isLoaded = existingElements.length === script.elements.length;
            loadedFunctions = existingElements;
            missingFunctions = script.elements.filter(id => document.getElementById(id) === null);
        } else {
            // 関数もDOM要素もない場合（passkey.jsなど）
            isLoaded = true; // 読み込まれているとみなす
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

// 完全同期処理
async function performFullSync() {
    try {
        console.log('performFullSync関数が開始されました');
        const startTime = performance.now();
        console.log('=== 完全同期処理開始 ===');
        console.log('開始時刻:', new Date().toLocaleTimeString());
        
        addDebugLog('info', '完全同期開始');
        
        const syncTasks = [
            { name: '天気データ', func: 'fetchWeather' },
            { name: 'スケジュール読み込み', func: 'loadSchedules' },
            { name: '祝日データ', func: 'fetchHolidayData' },
            { name: 'カレンダー再描画', func: 'renderCalendar' }
        ];
        
        console.log('同期タスク一覧:', syncTasks);
        
        const results = [];
        
        // 利用可能な関数をチェック
        console.log('=== 利用可能な関数をチェック ===');
        syncTasks.forEach(task => {
            const isAvailable = typeof window[task.func] === 'function';
            console.log(`${task.func}: ${isAvailable ? '利用可能' : '利用不可'} (type: ${typeof window[task.func]})`);
        });
        
        console.log('関数チェック完了、同期処理を開始します');
        
        // グローバル関数の同期
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
    
    // script.js内の関数を直接実行（DOM要素を使用）
    console.log('=== 時計・日付更新開始 ===');
    try {
        const taskStart = performance.now();
        
        // DOM要素の存在確認
        const clockEl = document.getElementById("clock");
        const dateEl = document.getElementById("date");
        console.log(`clock要素: ${clockEl ? '存在' : '不存在'}`);
        console.log(`date要素: ${dateEl ? '存在' : '不存在'}`);
        
        // 時計更新を直接実行
        const now = new Date();
        if (clockEl) {
            // 24時間形式で時刻を更新
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}:${seconds}`;
            clockEl.textContent = timeStr;
            console.log(`時計を更新: ${timeStr}`);
        }
        
        // 日付更新を直接実行
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
    
    // API status check も追加
    console.log('=== APIステータス確認開始 ===');
    try {
        const taskStart = performance.now();
        
        // checkApi関数が利用可能な場合は各種APIをチェック
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

// ローカルストレージの詳細確認・初期化
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

// バイト数をフォーマットする関数
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// システム診断情報を取得
function getSystemDiagnostics() {
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
        memory: performance.memory ? {
            used: formatBytes(performance.memory.usedJSHeapSize),
            total: formatBytes(performance.memory.totalJSHeapSize),
            limit: formatBytes(performance.memory.jsHeapSizeLimit)
        } : 'Not available',
        timing: performance.timing ? {
            domLoading: performance.timing.domLoading - performance.timing.navigationStart,
            domComplete: performance.timing.domComplete - performance.timing.navigationStart
        } : 'Not available',
        lastFullSync: lastFullSync
    };
}

// パフォーマンステスト実行
async function runPerformanceTest() {
    addDebugLog('info', 'パフォーマンステスト開始');
    const tests = [];
    
    // DOM操作テスト
    const domStart = performance.now();
    const testDiv = document.createElement('div');
    for (let i = 0; i < 1000; i++) {
        testDiv.innerHTML = `<span>Test ${i}</span>`;
    }
    const domTime = performance.now() - domStart;
    tests.push({ name: 'DOM操作 (1000回)', time: Math.round(domTime) });
    
    // API ping テスト
    try {
        const pingStart = performance.now();
        await fetch('/api/ping', { method: 'HEAD' });
        const pingTime = performance.now() - pingStart;
        tests.push({ name: 'API Ping', time: Math.round(pingTime) });
    } catch (error) {
        tests.push({ name: 'API Ping', error: error.message });
    }
    
    // ローカルストレージテスト
    const storageStart = performance.now();
    localStorage.setItem('perfTest', 'test'.repeat(1000));
    localStorage.getItem('perfTest');
    localStorage.removeItem('perfTest');
    const storageTime = performance.now() - storageStart;
    tests.push({ name: 'ローカルストレージ', time: Math.round(storageTime) });
    
    addDebugLog('info', 'パフォーマンステスト完了', tests);
    return tests;
}

// 「完全同期」ボタン押下時の処理
document.getElementById("forceSyncBtn").addEventListener("click", async () => {
    console.log('=== 完全同期ボタンが押されました ===');
    
    // SweetAlert2が利用可能かチェック
    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2が利用できません');
        alert('SweetAlert2が読み込まれていません。ページを再読み込みしてください。');
        return;
    }
    
    console.log('SweetAlert2は利用可能です');
    
    try {
        console.log('SweetAlertダイアログを表示中...');
        const swalInstance = await Swal.fire({
            title: '完全同期中…',
            text: '全データをサーバーから再取得しています。',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                console.log('SweetAlertダイアログが開かれました');
                Swal.showLoading();
            }
        });
        console.log('SweetAlertダイアログが作成されました');
    } catch (swalError) {
        console.error('SweetAlertダイアログの作成でエラー:', swalError);
        alert('ダイアログの表示に失敗しました: ' + swalError.message);
        return;
    }

    try {
        console.log('performFullSync関数の存在確認:', typeof performFullSync);
        console.log('performFullSync関数を呼び出し中...');
        
        const result = await performFullSync();
        console.log('完全同期結果:', result);
        
        const successCount = result.results.filter(r => r.status === 'success').length;
        const errorCount = result.results.filter(r => r.status === 'error').length;
        const skippedCount = result.results.filter(r => r.status === 'skipped').length;
        
        // 結果の詳細をコンソールに出力
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
    } catch (err) {
        console.error('同期処理中にエラーが発生:', err);
        console.error('エラーの詳細:', err.stack);
        addDebugLog('error', '同期処理中にエラー', err);
        
        try {
            await Swal.fire({
                icon: 'error',
                title: '同期失敗',
                html: `
                    <div class="text-left">
                        <p>同期処理中に予期しないエラーが発生しました。</p>
                        <div class="mt-2 text-sm text-red-600">
                            エラー: ${err.message || err}
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
            alert('エラーが発生しました: ' + (err.message || err));
        }
    }
});

document.getElementById("openDevMenuBtn").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("devMenuModal").classList.remove("hidden");
});

document.getElementById("closeDevMenuModal").addEventListener("click", () => {
    document.getElementById("devMenuModal").classList.add("hidden");
});

// JavaScriptロード状態確認
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

// 簡易診断実行
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

// ローカルストレージ初期化
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

// デバッグログ表示
document.getElementById("showDebugLogBtn").addEventListener("click", async () => {
    const diagnostics = getSystemDiagnostics();
    
    let logHtml = `<div class="text-left text-xs">`;
    logHtml += `<div class="mb-4 p-2 bg-gray-100 rounded">`;
    logHtml += `<h4 class="font-bold mb-2">システム情報</h4>`;
    logHtml += `<div>ブラウザ: ${diagnostics.userAgent.split(' ').pop()}</div>`;
    logHtml += `<div>画面: ${diagnostics.screen.width}x${diagnostics.screen.height}</div>`;
    logHtml += `<div>メモリ使用量: ${typeof diagnostics.memory === 'object' ? diagnostics.memory.used : diagnostics.memory}</div>`;
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

// パフォーマンステスト実行
document.getElementById("runPerfTestBtn").addEventListener("click", async () => {
    await Swal.fire({
        title: 'パフォーマンステスト実行中...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    const results = await runPerformanceTest();
    
    let resultHtml = `<div class="text-left text-sm">`;
    results.forEach(test => {
        if (test.error) {
            resultHtml += `<div class="mb-2 flex justify-between">`;
            resultHtml += `<span>${test.name}</span>`;
            resultHtml += `<span class="text-red-600">エラー</span>`;
            resultHtml += `</div>`;
        } else {
            const timeClass = test.time < 100 ? 'text-green-600' : test.time < 500 ? 'text-yellow-600' : 'text-red-600';
            resultHtml += `<div class="mb-2 flex justify-between">`;
            resultHtml += `<span>${test.name}</span>`;
            resultHtml += `<span class="${timeClass}">${test.time}ms</span>`;
            resultHtml += `</div>`;
        }
    });
    resultHtml += `</div>`;
    
    await Swal.fire({
        title: 'パフォーマンステスト結果',
        html: resultHtml,
        icon: 'info',
        confirmButtonText: 'OK'
    });
});

// ページ再読み込み
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

// 初期化時にデバッグログを開始
addDebugLog('info', 'DevTools初期化完了', { version: '3.1.0_devtools-r8' });

// 開発者向け：簡易診断機能を追加
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

// ページ読み込み時に自動診断を実行
setTimeout(() => {
    performQuickDiagnostics();
}, 1000);
