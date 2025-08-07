// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.3.3_acc-r1

// ページ読み込み時にログイン状態をチェック
document.addEventListener("DOMContentLoaded", () => {
    // パスキーログイン成功時のコールバック関数を設定
    window.onPasskeyLoginSuccess = function(user) {
        // サーバーからユーザー情報を再取得してプロフィール画像も同期
        fetch('/api/auth/user-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const userInfo = {
                    username: user.username,
                    email: user.email || data.user.email || '',
                    loginAt: Math.floor(Date.now() / 1000),
                    loginMethod: "パスキー",
                    profileImage: data.user.profileImage || null
                };
                saveLoginState(userInfo);
                
                Swal.fire("成功", "パスキーでログインしました。", "success");
                setupAccountModal();
            } else {
                // サーバーから情報を取得できない場合は従来通り
                const userInfo = {
                    username: user.username,
                    email: user.email || '',
                    loginAt: Math.floor(Date.now() / 1000),
                    loginMethod: "パスキー",
                    profileImage: null
                };
                saveLoginState(userInfo);
                
                Swal.fire("成功", "パスキーでログインしました。", "success");
                setupAccountModal();
            }
        })
        .catch(error => {
            console.error('ユーザー情報取得エラー:', error);
            // エラーの場合は従来通り
            const userInfo = {
                username: user.username,
                email: user.email || '',
                loginAt: Math.floor(Date.now() / 1000),
                loginMethod: "パスキー",
                profileImage: null
            };
            saveLoginState(userInfo);
            
            Swal.fire("成功", "パスキーでログインしました。", "success");
            setupAccountModal();
        });
    };
});

// アカウント管理モーダルを開く
document.getElementById("openAccManage").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("accountModal").classList.remove("hidden");
    setupAccountModal();
});

// ログイン状態をチェック
function isLoggedIn() {
    return localStorage.getItem("tabdock_user") !== null;
}

// ログインユーザー情報を取得
function getLoggedInUser() {
    const userStr = localStorage.getItem("tabdock_user");
    return userStr ? JSON.parse(userStr) : null;
}

// ログイン状態を保存
function saveLoginState(user) {
    localStorage.setItem("tabdock_user", JSON.stringify(user));
}

// ログアウト
function logout() {
    localStorage.removeItem("tabdock_user");
    Swal.fire("ログアウト", "正常にログアウトしました。", "success");
    setupAccountModal(); // モーダルを再構築
}

// アカウントモーダルのセットアップ
function setupAccountModal() {
    const modal = document.getElementById("accountModal");
    
    // ログイン状態をチェック
    if (isLoggedIn()) {
        // ログイン済みの場合のモーダル
        setupLoggedInModal(modal);
    } else {
        // 未ログインの場合のモーダル
        setupLoginModal(modal);
    }
}

// ログイン済みユーザー用のモーダル
function setupLoggedInModal(modal) {
    const user = getLoggedInUser();
    
    modal.innerHTML = `
        <div class="bg-white/30 text-white backdrop-blur-md rounded-xl p-6 w-full max-w-4xl shadow-lg border border-white/20 mx-auto">
            <h2 class="text-xl font-bold mb-6 text-center">アカウント管理</h2>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- 左側：ユーザー情報 -->
                <div class="space-y-6">
                    <div class="bg-black/20 rounded-lg p-6">
                        <div class="flex flex-col items-center space-y-4 mb-4">
                            <div class="relative">
                                <div id="profileIcon" class="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold cursor-pointer hover:bg-blue-500 transition-colors">
                                    ${user.profileImage ? 
                                        `<img src="${user.profileImage}" alt="Profile" class="w-full h-full rounded-full object-cover">` : 
                                        user.username.charAt(0).toUpperCase()
                                    }
                                </div>
                                <button id="uploadIcon" class="absolute -bottom-2 -right-2 w-8 h-8 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center text-white text-sm transition-colors">
                                    <img src="/home/assets/icon/upload_file.png" alt="Upload" class="w-4 h-4 object-contain">
                                </button>
                            </div>
                            <div class="text-center">
                                <h3 class="text-lg font-semibold">${user.username}</h3>
                                <p class="text-white/70 text-sm">${user.email || 'メールアドレス未設定'}</p>
                            </div>
                        </div>
                        
                        <div class="space-y-3 text-center">
                            <div class="flex justify-between">
                                <span class="text-white/70">ログイン方式:</span>
                                <span class="text-green-400">${user.loginMethod || 'パスワード'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-white/70">最終ログイン:</span>
                                <span class="text-white/90">${new Date(user.loginAt * 1000).toLocaleDateString('ja-JP')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <button id="addPasskeyBtn" class="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg transition-colors font-medium">
                            パスキーを追加
                        </button>
                        <button id="changePasswordBtn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg transition-colors font-medium">
                            パスワード変更
                        </button>
                        <button id="logoutBtn" class="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg transition-colors font-medium">
                            ログアウト
                        </button>
                    </div>
                </div>

                <!-- 右側：アカウント設定 -->
                <div class="space-y-6">
                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">アカウント設定</h3>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-white/80">パスキー認証</span>
                                <span class="text-xs px-2 py-1 rounded-full bg-yellow-600/20 text-yellow-400">
                                    試験的
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-white/80">二段階認証</span>
                                <span class="text-xs px-2 py-1 rounded-full bg-yellow-600/20 text-yellow-400">
                                    計画中
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">セキュリティ情報</h3>
                        <div class="space-y-2">
                            <p class="text-xs text-white/70">
                                アカウントのセキュリティを向上させるため、パスキーの利用をお勧めします。
                            </p>
                            <p class="text-xs text-white/70">
                                定期的なパスワード変更も推奨されます。
                            </p>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">アカウントデータ</h3>
                        <div class="space-y-2">
                            <button class="w-full text-left text-xs text-white/70 hover:text-white/90 py-2 px-3 rounded hover:bg-white/10 transition-colors">
                                データエクスポート
                            </button>
                            <button class="w-full text-left text-xs text-red-400 hover:text-red-300 py-2 px-3 rounded hover:bg-red-600/10 transition-colors">
                                アカウント削除
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-center mt-6">
                <button id="closeAccountModal" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
                    閉じる
                </button>
            </div>
        </div>
    `;
    
    // ログイン済みユーザー用のイベントリスナーを設定
    setupLoggedInEventListeners();
}

// 未ログインユーザー用のモーダル
function setupLoginModal(modal) {
    
    // モーダル内容を構築
    modal.innerHTML = `
        <div class="bg-white/30 text-white backdrop-blur-md rounded-xl p-6 w-full max-w-4xl shadow-lg border border-white/20 mx-auto">
            <h2 class="text-xl font-bold mb-6 text-center">アカウント管理</h2>
            
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
            
            <div class="flex justify-center mt-6">
                <button id="closeAccountModal" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
                    閉じる
                </button>
            </div>
        </div>
    `;
    
    // イベントリスナーを設定
    setupAccountEventListeners();
}

// プロフィール画像のアップロード処理
function handleProfileImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            showImageResizeModal(file);
        }
    };
    input.click();
}

// 画像リサイズモーダルを表示
function showImageResizeModal(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // 画像の元サイズを取得
            const originalWidth = img.width;
            const originalHeight = img.height;
            const aspectRatio = originalWidth / originalHeight;
            
            // Canvas サイズを動的に決定 (最大500px、最小300px)
            let canvasSize = Math.min(Math.max(Math.max(originalWidth, originalHeight) / 4, 300), 500);
            canvasSize = Math.round(canvasSize);
            
            // スケールの範囲を動的に計算
            const maxImageSize = Math.max(originalWidth, originalHeight);
            const minScale = Math.max(0.1, canvasSize / maxImageSize); // 画像全体がCanvasに収まる最小スケール
            const maxScale = Math.min(5.0, (maxImageSize / canvasSize) * 2); // 適切な最大スケール
            const initialScale = Math.max(minScale, Math.min(1.0, canvasSize / maxImageSize));
            
            // 位置調整の範囲を動的に計算
            const positionRange = Math.round(canvasSize * 0.8); // Canvasサイズの80%
            
            Swal.fire({
                title: "プロフィール画像を調整",
                html: `
                    <div class="space-y-4">
                        <div class="text-xs text-gray-600 mb-2">
                            元画像: ${originalWidth}×${originalHeight}px (縦横比: ${aspectRatio.toFixed(2)})
                        </div>
                        <div class="flex justify-center">
                            <canvas id="imageCanvas" width="${canvasSize}" height="${canvasSize}" style="border: 2px solid #ccc; border-radius: 50%; max-width: 100%;"></canvas>
                        </div>
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-gray-700">サイズ調整:</label>
                            <input type="range" id="scaleSlider" min="${minScale}" max="${maxScale}" step="0.01" value="${initialScale}" class="w-full">
                            <div class="flex justify-between text-xs text-gray-500">
                                <span>最小 (${Math.round(minScale * 100)}%)</span>
                                <span id="scaleValue">${Math.round(initialScale * 100)}%</span>
                                <span>最大 (${Math.round(maxScale * 100)}%)</span>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-gray-700">位置調整:</label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs text-gray-500">X座標:</label>
                                    <input type="range" id="xSlider" min="-${positionRange}" max="${positionRange}" value="0" class="w-full">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500">Y座標:</label>
                                    <input type="range" id="ySlider" min="-${positionRange}" max="${positionRange}" value="0" class="w-full">
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 text-center">
                                位置: X=<span id="xValue">0</span>px, Y=<span id="yValue">0</span>px
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: "設定",
                cancelButtonText: "キャンセル",
                width: Math.max(400, canvasSize + 100),
                didOpen: () => {
                    setupImageEditor(img, canvasSize);
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const canvas = document.getElementById("imageCanvas");
                    // Canvasから高品質なBlobを取得
                    canvas.toBlob((blob) => {
                        uploadProfileImageToServer(blob);
                    }, 'image/jpeg', 0.9); // 品質を90%に向上
                }
            });
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 画像エディターのセットアップ
function setupImageEditor(img, canvasSize) {
    const canvas = document.getElementById("imageCanvas");
    const ctx = canvas.getContext("2d");
    const scaleSlider = document.getElementById("scaleSlider");
    const xSlider = document.getElementById("xSlider");
    const ySlider = document.getElementById("ySlider");
    
    // 値表示用の要素
    const scaleValue = document.getElementById("scaleValue");
    const xValue = document.getElementById("xValue");
    const yValue = document.getElementById("yValue");
    
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = canvasSize / 2;
    
    function drawImage() {
        const scale = parseFloat(scaleSlider.value);
        const offsetX = parseInt(xSlider.value);
        const offsetY = parseInt(ySlider.value);
        
        // 値を表示
        if (scaleValue) scaleValue.textContent = Math.round(scale * 100) + '%';
        if (xValue) xValue.textContent = offsetX;
        if (yValue) yValue.textContent = offsetY;
        
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        
        // 円形クリッピング
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // スケールを適用した画像サイズを計算
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // 画像を中央配置してオフセットを適用
        const x = centerX - (drawWidth / 2) + offsetX;
        const y = centerY - (drawHeight / 2) + offsetY;
        
        // 高品質描画設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        ctx.restore();
        
        // デバッグ用の円枠表示（オプション）
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // イベントリスナー設定
    scaleSlider.addEventListener("input", drawImage);
    xSlider.addEventListener("input", drawImage);
    ySlider.addEventListener("input", drawImage);
    
    // 初期描画
    drawImage();
    
    // キーボードショートカット
    document.addEventListener("keydown", function handleKeydown(e) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
            const step = parseFloat(e.target.step) || 1;
            let currentValue = parseFloat(e.target.value);
            
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.target.value = Math.max(parseFloat(e.target.min), currentValue - step);
                drawImage();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.target.value = Math.min(parseFloat(e.target.max), currentValue + step);
                drawImage();
            }
        }
        
        // モーダルが閉じられる時にイベントリスナーをクリーンアップ
        if (e.key === 'Escape') {
            document.removeEventListener("keydown", handleKeydown);
        }
    });
}

// サーバーにプロフィール画像をアップロード
function uploadProfileImageToServer(blob) {
    const user = getLoggedInUser();
    if (!user) {
        Swal.fire('エラー', 'ログインが必要です', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('profileImage', blob, 'profile.jpg');
    formData.append('username', user.username); // ユーザー名を追加

    Swal.fire({
        title: 'アップロード中...',
        text: 'プロフィール画像を保存しています',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    fetch('/api/upload-profile-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        if (data.status === 'success') {
            saveProfileImagePath(data.path);
        } else {
            Swal.fire('エラー', 'アップロードに失敗しました', 'error');
        }
    })
    .catch(error => {
        Swal.close();
        console.error('Upload error:', error);
        Swal.fire('エラー', 'アップロード処理中にエラーが発生しました', 'error');
    });
}

// プロフィール画像のパスを保存
function saveProfileImagePath(imagePath) {
    const user = getLoggedInUser();
    user.profileImage = imagePath;
    saveLoginState(user);
    
    // UIを更新
    setupAccountModal();
    
    Swal.fire("完了", "プロフィール画像を更新しました。", "success");
}

// アカウントモーダルを閉じる
function closeAccountModal() {
    document.getElementById("accountModal").classList.add("hidden");
}

// ログイン済みユーザー用のイベントリスナー
function setupLoggedInEventListeners() {
    // プロフィール画像アップロード
    document.getElementById("uploadIcon").addEventListener("click", () => {
        handleProfileImageUpload();
    });
    
    // プロフィール画像をクリックしてもアップロード
    document.getElementById("profileIcon").addEventListener("click", () => {
        handleProfileImageUpload();
    });
    
    // パスキー追加
    document.getElementById("addPasskeyBtn").addEventListener("click", () => {
        const user = getLoggedInUser();
        if (typeof handlePasskeyRegistration === 'function') {
            handlePasskeyRegistration(user.username);
        } else {
            Swal.fire("エラー", "パスキー機能が利用できません。", "error");
        }
    });
    
    // パスワード変更
    document.getElementById("changePasswordBtn").addEventListener("click", () => {
        Swal.fire({
            title: "パスワード変更",
            text: "この機能は近日実装予定です。",
            icon: "info"
        });
    });
    
    // ログアウト
    document.getElementById("logoutBtn").addEventListener("click", () => {
        Swal.fire({
            title: "ログアウトしますか？",
            text: "現在のセッションが終了します。",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "ログアウト",
            cancelButtonText: "キャンセル"
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
            }
        });
    });
    
    // モーダル閉じる
    document.getElementById("closeAccountModal").addEventListener("click", closeAccountModal);
}

// イベントリスナーの設定（未ログインユーザー用）
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

    // APIにリクエストを送信
    fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // ログイン情報をLocalStorageに保存（サーバーからの情報を使用）
            const userInfo = {
                username: data.user.username,
                email: data.user.email,
                loginAt: data.user.loginAt,
                loginMethod: "パスワード",
                profileImage: data.user.profileImage || null // サーバーからプロフィール画像パスを取得
            };
            saveLoginState(userInfo);
            
            Swal.fire("ログイン成功", "正常にログインしました。", "success");
            closeAccountModal();
            
            // UIを更新
            updateUIForLoggedInUser(userInfo);
            setupAccountModal(); // モーダル内容を更新
        } else {
            Swal.fire("ログイン失敗", data.message || "ログインに失敗しました。", "error");
        }
    })
    .catch(error => {
        console.error("ログインエラー:", error);
        Swal.fire("エラー", "ログイン処理中にエラーが発生しました。", "error");
    });
}

// パスキーログイン処理（passkey.jsの関数を呼び出し）
function handlePasskeyLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    if (!username) {
        Swal.fire("エラー", "ユーザー名を入力してください。", "error");
        return;
    }
    
    if (typeof startLogin === 'function') {
        // パスキーログイン成功時のコールバックを設定
        window.onPasskeyLoginSuccess = function(user) {
            // サーバーからユーザー情報を再取得してプロフィール画像も同期
            fetch('/api/auth/user-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username || username })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const userInfo = {
                        username: user.username || username,
                        email: user.email || data.user.email || "",
                        loginAt: Math.floor(Date.now() / 1000),
                        loginMethod: "パスキー",
                        profileImage: data.user.profileImage || null
                    };
                    saveLoginState(userInfo);
                    
                    Swal.fire("ログイン成功", "パスキーでログインしました。", "success");
                    closeAccountModal();
                    updateUIForLoggedInUser(userInfo);
                } else {
                    // サーバーから情報を取得できない場合は従来通り
                    const userInfo = {
                        username: user.username || username,
                        email: user.email || "",
                        loginAt: Math.floor(Date.now() / 1000),
                        loginMethod: "パスキー",
                        profileImage: null
                    };
                    saveLoginState(userInfo);
                    
                    Swal.fire("ログイン成功", "パスキーでログインしました。", "success");
                    closeAccountModal();
                    updateUIForLoggedInUser(userInfo);
                }
            })
            .catch(error => {
                console.error('ユーザー情報取得エラー:', error);
                // エラーの場合は従来通り
                const userInfo = {
                    username: user.username || username,
                    email: user.email || "",
                    loginAt: Math.floor(Date.now() / 1000),
                    loginMethod: "パスキー",
                    profileImage: null
                };
                saveLoginState(userInfo);
                
                Swal.fire("ログイン成功", "パスキーでログインしました。", "success");
                closeAccountModal();
                updateUIForLoggedInUser(userInfo);
            });
        };
        
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

    // APIにリクエストを送信
    fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 登録成功時に自動的にログイン状態にする
            const userInfo = {
                username: data.user.username,
                email: data.user.email,
                loginAt: data.user.registerId,
                loginMethod: "パスワード"
            };
            saveLoginState(userInfo);
            
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
                    updateUIForLoggedInUser(userInfo);
                }
            });
        } else {
            Swal.fire("登録失敗", data.message || "アカウント作成に失敗しました。", "error");
        }
    })
    .catch(error => {
        console.error("登録エラー:", error);
        Swal.fire("エラー", "登録処理中にエラーが発生しました。", "error");
    });
}

// ログイン状態をUIに反映
function updateUIForLoggedInUser(user) {
    console.log("ログインユーザー:", user);
    
    // メニューのアカウント管理ボタンのテキストを変更
    const accManageBtn = document.getElementById("openAccManage");
    if (accManageBtn) {
        accManageBtn.innerHTML = `
            <div class="flex items-center justify-center">
                <span class="mr-2">アカウント管理</span>
                <span class="text-xs text-green-400">●</span>
            </div>
        `;
        accManageBtn.title = `${user.username} としてログイン中`;
    }
    
    // 他のUI要素もここで更新可能
}

// ページ読み込み時にログイン状態をチェック
document.addEventListener("DOMContentLoaded", () => {
    if (isLoggedIn()) {
        const user = getLoggedInUser();
        updateUIForLoggedInUser(user);
    }
});

// アカウントモーダルを閉じる
function closeAccountModal() {
    document.getElementById("accountModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
}