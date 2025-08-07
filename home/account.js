// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.2.1_account-management

// アカウント管理モーダルを開く
document.getElementById("openAccManage").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("accountModal").classList.remove("hidden");
    setupAccountModal();
});

// アカウントモーダルのセットアップ
function setupAccountModal() {
    const modal = document.getElementById("accountModal");
    
    // モーダル内容を構築
    modal.innerHTML = `
        <div class="bg-white/30 text-white backdrop-blur-md rounded-xl p-6 w-full max-w-4xl shadow-lg border border-white/20">
            <h2 class="text-xl font-bold mb-6">アカウント管理</h2>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- 左側：フォーム -->
                <div class="space-y-6">
                    <!-- タブ -->
                    <div class="flex mb-4 bg-black/20 rounded-lg p-1">
                        <button id="loginTab" class="flex-1 py-2 px-4 rounded-md bg-blue-600 text-white transition-colors">ログイン</button>
                        <button id="registerTab" class="flex-1 py-2 px-4 rounded-md hover:bg-white/10 transition-colors">登録</button>
                    </div>
                    
                    <!-- ログインフォーム -->
                    <div id="loginForm" class="space-y-4">
                        <input type="text" id="loginUsername" placeholder="ユーザー名" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        <input type="password" id="loginPassword" placeholder="パスワード" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        
                        <div class="flex flex-col space-y-2">
                            <button id="normalLoginBtn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg transition-colors font-medium">
                                ログイン
                            </button>
                            <button id="passkeyLoginBtn" class="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg transition-colors font-medium">
                                パスキーでログイン
                            </button>
                        </div>
                    </div>
                    
                    <!-- 登録フォーム -->
                    <div id="registerForm" class="space-y-4 hidden">
                        <input type="text" id="registerUsername" placeholder="ユーザー名" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        <input type="email" id="registerEmail" placeholder="メールアドレス" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        <input type="password" id="registerPassword" placeholder="パスワード" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        <input type="password" id="confirmPassword" placeholder="パスワード確認" 
                               class="w-full p-3 bg-white/20 text-white placeholder-white/70 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none" required>
                        
                        <button id="registerBtn" class="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg transition-colors font-medium">
                            アカウント作成
                        </button>
                    </div>
                </div>

                <!-- 右側：説明文 -->
                <div class="space-y-6">
                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">アカウント機能について</h3>
                        <p class="text-sm text-white/80 mb-4">
                            TabDockでは通常のパスワード認証とパスキー認証の両方をサポートしています。
                        </p>
                        
                        <div class="space-y-3">
                            <div class="flex items-start space-x-2">
                                <span class="text-blue-400 font-bold">1.</span>
                                <span class="text-sm text-white/80">パスキーは対応しているOSが必要です</span>
                            </div>
                            <div class="flex items-start space-x-2">
                                <span class="text-blue-400 font-bold">2.</span>
                                <span class="text-sm text-white/80">Chromium, Firefox, Safari等の対応しているブラウザが必要です</span>
                            </div>
                            <div class="flex items-start space-x-2">
                                <span class="text-blue-400 font-bold">3.</span>
                                <span class="text-sm text-white/80">この機能は現在テスト開発中であり、正常に動作しません</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">パスキーとは？</h3>
                        <p class="text-xs text-white/70 leading-relaxed">
                            パスキーは生体認証（指紋、顔認証など）やPINを使用してログインできる新しい認証方式です。
                            パスワードを覚える必要がなく、よりセキュアな認証が可能です。
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end mt-6">
                <button id="closeAccountModal" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
                    閉じる
                </button>
            </div>
        </div>
    `;
    
    // イベントリスナーを設定
    setupAccountEventListeners();
}

// イベントリスナーの設定
function setupAccountEventListeners() {
    // タブ切り替え
    document.getElementById("loginTab").addEventListener("click", () => switchToLogin());
    document.getElementById("registerTab").addEventListener("click", () => switchToRegister());
    
    // ログイン処理
    document.getElementById("normalLoginBtn").addEventListener("click", handleNormalLogin);
    document.getElementById("passkeyLoginBtn").addEventListener("click", handlePasskeyLogin);
    
    // 登録処理
    document.getElementById("registerBtn").addEventListener("click", handleRegister);
    
    // モーダル閉じる
    document.getElementById("closeAccountModal").addEventListener("click", closeAccountModal);
}

// ログインタブに切り替え
function switchToLogin() {
    document.getElementById("loginTab").classList.add("bg-blue-600", "text-white");
    document.getElementById("loginTab").classList.remove("hover:bg-white/10");
    document.getElementById("registerTab").classList.remove("bg-blue-600", "text-white");
    document.getElementById("registerTab").classList.add("hover:bg-white/10");
    
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");
}

// 登録タブに切り替え
function switchToRegister() {
    document.getElementById("registerTab").classList.add("bg-blue-600", "text-white");
    document.getElementById("registerTab").classList.remove("hover:bg-white/10");
    document.getElementById("loginTab").classList.remove("bg-blue-600", "text-white");
    document.getElementById("loginTab").classList.add("hover:bg-white/10");
    
    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
}

// 通常ログイン処理
function handleNormalLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
        Swal.fire("エラー", "ユーザー名とパスワードを入力してください。", "error");
        return;
    }

    // APIにリクエストを送信（将来の実装用）
    fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire("ログイン成功", "正常にログインしました。", "success");
            closeAccountModal();
            // ログイン状態をUIに反映する処理をここに追加
            updateUIForLoggedInUser(data.user);
        } else {
            Swal.fire("ログイン失敗", data.message || "ログインに失敗しました。", "error");
        }
    })
    .catch(error => {
        // 仮実装：サーバーサイドが未実装の場合の処理
        console.log("[仮] ログイン試行：", { username, password });
        Swal.fire("ログインしました", "（仮実装）通常ログイン成功", "success");
        closeAccountModal();
    });
}

// パスキーログイン処理（passkey.jsの関数を呼び出し）
function handlePasskeyLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    if (typeof startLogin === 'function') {
        startLogin(username);
    } else {
        Swal.fire("エラー", "パスキー機能が利用できません。", "error");
    }
}

// アカウント登録処理
function handleRegister() {
    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!username || !email || !password || !confirmPassword) {
        Swal.fire("エラー", "すべての項目を入力してください。", "error");
        return;
    }

    if (password !== confirmPassword) {
        Swal.fire("エラー", "パスワードが一致しません。", "error");
        return;
    }

    // パスワードの強度チェック（簡単な例）
    if (password.length < 6) {
        Swal.fire("エラー", "パスワードは6文字以上で入力してください。", "error");
        return;
    }

    // APIにリクエストを送信（将来の実装用）
    fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: "アカウント作成完了",
                text: "アカウントが作成されました。パスキーも登録しますか？",
                icon: "success",
                showCancelButton: true,
                confirmButtonText: "パスキーを登録",
                cancelButtonText: "後で"
            }).then(result => {
                if (result.isConfirmed && typeof handlePasskeyRegistration === 'function') {
                    handlePasskeyRegistration(username);
                } else {
                    closeAccountModal();
                }
            });
        } else {
            Swal.fire("登録失敗", data.message || "アカウント作成に失敗しました。", "error");
        }
    })
    .catch(error => {
        // 仮実装：サーバーサイドが未実装の場合の処理
        console.log("[仮] 登録ユーザー：", { username, email, password });
        
        Swal.fire({
            title: "アカウント作成完了",
            text: "（仮実装）アカウントが作成されました。パスキーも登録しますか？",
            icon: "success",
            showCancelButton: true,
            confirmButtonText: "パスキーを登録",
            cancelButtonText: "後で"
        }).then(result => {
            if (result.isConfirmed && typeof handlePasskeyRegistration === 'function') {
                // passkeyの登録処理を呼び出す
                handlePasskeyRegistration(username);
            } else {
                closeAccountModal();
            }
        });
    });
}

// ログイン状態をUIに反映
function updateUIForLoggedInUser(user) {
    // ここでログイン状態に応じたUI更新を行う
    console.log("ログインユーザー:", user);
    // 例：ユーザー名表示、ログアウトボタン表示など
}

// アカウントモーダルを閉じる
function closeAccountModal() {
    document.getElementById("accountModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
}