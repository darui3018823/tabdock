// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.6.0_js-r1

function applyVisualSettings() {
    const blur = parseInt(document.getElementById("blurRange")?.value || 0);
    const brightness = parseInt(document.getElementById("brightnessRange")?.value || 100);
    const opacity = parseInt(document.getElementById("opacityRange")?.value || 100);

    const blurLayer = document.getElementById("wallpaperBlurLayer");
    const widgets = document.querySelectorAll('.widget-box'); 

    // 初期設定を反映
    if (blurLayer) {
        blurLayer.style.backdropFilter = `blur(${blur}px) brightness(${brightness}%)`;
        blurLayer.style.webkitBackdropFilter = `blur(${blur}px) brightness(${brightness}%)`;
    }

    // 各ウィジェットの背景色を alpha で調整
    widgets.forEach(widget => {
        const alpha = Math.max(opacity / 100, 0.1);
        document.documentElement.style.setProperty('--widget-bg', `rgba(30, 30, 30, ${alpha})`);
    });

    // 表示の更新
    const blurValue = document.getElementById("blurValue");
    const brightnessValue = document.getElementById("brightnessValue");
    const opacityValue = document.getElementById("opacityValue");
    if (blurValue) blurValue.textContent = `${blur}px`;
    if (brightnessValue) brightnessValue.textContent = `${brightness}%`;
    if (opacityValue) opacityValue.textContent = `${opacity}%`;
}

// 初期化処理
(function initVisibilitySettings() {
    // 前回の壁紙を復元
    const savedWallpaper = localStorage.getItem("tabdock_wallpaper");
    if (savedWallpaper) {
        handlePresetClick(savedWallpaper);
    }

    const sliders = ["blurRange", "brightnessRange", "opacityRange"];
    sliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", applyVisualSettings);
        }
    });

    const applyBtn = document.getElementById("applyWallpaperAdvanced");
    const closeBtn = document.getElementById("closeWallpaperAdvancedModal");

    if (applyBtn) {
        applyBtn.addEventListener("click", () => {
            applyVisualSettings();
            document.getElementById("wallpaperAdvancedModal")?.classList.add("hidden");
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            document.getElementById("wallpaperAdvancedModal")?.classList.add("hidden");
        });
    }

    // 初期状態を一度反映
    initializeSliders();
    applyVisualSettings();
    initWallpaperUploadHandlers();
    initMenuToggle();
})();

function initializeSliders() {
    const blurSlider = document.getElementById("blurRange");
    const brightnessSlider = document.getElementById("brightnessRange");
    const opacitySlider = document.getElementById("opacityRange");

    if (blurSlider) blurSlider.value = 0;
    if (brightnessSlider) brightnessSlider.value = 100;
    if (opacitySlider) opacitySlider.value = 100;

    applyVisualSettings();
}

// プリセット画像クリックで壁紙適用
function handlePresetClick(imgSrc) {
    const wallpaper = document.getElementById("wallpaper");
    if (wallpaper) {
        wallpaper.style.backgroundImage = `url('${imgSrc}')`;
        wallpaper.style.backgroundSize = "cover";
        wallpaper.style.backgroundPosition = "center";
        wallpaper.style.backgroundRepeat = "no-repeat";

        // セッションキャッシュとして保存（DataURL or パス）
        localStorage.setItem("tabdock_wallpaper", imgSrc);
    }
}


// ファイル選択→背景に反映＆プリセットへ追加
function handleWallpaperUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        handlePresetClick(imageData);  // 背景に適用

        // プリセットに追加
        const img = document.createElement("img");
        img.src = imageData;
        img.alt = "uploaded-wallpaper";
        img.className = "rounded cursor-pointer hover:ring-2 ring-white";
        img.onclick = () => handlePresetClick(imageData);

        const presetContainer = document.getElementById("presetWallpapers");
        presetContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
}

// 壁紙一覧読み込み
async function loadWallpapers() {
    try {
        const response = await fetch("/api/list-wallpapers");
        const data = await response.json();
        const presetWallpapers = document.getElementById("presetWallpapers");
        presetWallpapers.innerHTML = "";

        if (!data.images || data.images.length === 0) {
            presetWallpapers.innerHTML = "<p class='text-sm text-gray-300'>画像が見つかりませんでした。</p>";
            return;
        }

        data.images.forEach((path) => {
            const fileName = path.split("/").pop();
            const img = document.createElement("img");
            img.src = "/" + path.replace(/\\/g, "/");
            img.alt = fileName;
            img.className = "rounded cursor-pointer hover:ring-2 ring-white";
            img.onclick = () => handlePresetClick(img.src);
            presetWallpapers.appendChild(img);
        });
    } catch (error) {
        console.error("壁紙の読み込み中にエラーが発生しました:", error);
    }
}

// モーダル制御とアップロード処理
function initWallpaperUploadHandlers() {
    const uploadInput = document.getElementById("wallpaperUpload");
    const confirmBtn = document.getElementById("confirmUploadBtn");
    const cancelBtn = document.getElementById("cancelUploadConfirm");
    const acceptBtn = document.getElementById("acceptUploadConfirm");

    if (uploadInput) {
        uploadInput.addEventListener("change", handleWallpaperUpload);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
            const file = uploadInput?.files[0];
            if (!file) {
                alert("画像を選択してください。");
                return;
            }
            document.getElementById("uploadConfirmModal")?.classList.remove("hidden");
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            document.getElementById("uploadConfirmModal")?.classList.add("hidden");
        });
    }

    if (acceptBtn) {
        acceptBtn.addEventListener("click", async () => {
            const file = uploadInput?.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("wallpaper", file);

            try {
                const res = await fetch("/api/upload-wallpaper", {
                    method: "POST",
                    body: formData,
                });
                const result = await res.json();
                console.log("アップロード完了:", result);

                handlePresetClick(`wallpapers/${result.filename}`);
                document.getElementById("uploadConfirmModal")?.classList.add("hidden");
            } catch (e) {
                alert("アップロードに失敗しました。");
                console.error(e);
            }
        });
    }
}

// メニュー開閉処理
function initMenuToggle() {
    document.getElementById("hamburgerBtn")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.remove("hidden");
    });

    document.getElementById("closeMenuModal")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.add("hidden");
    });

    // 必要ならWallpaper選択モーダルへ遷移
    document.getElementById("openWallpaperModal")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.add("hidden");
        document.getElementById("wallpaperModal")?.classList.remove("hidden");
        loadWallpapers();
    });

    document.getElementById("closeWallpaperModal")?.addEventListener("click", () => {
        document.getElementById("wallpaperModal")?.classList.add("hidden");
    });

    document.getElementById("openWallpaperAdvancedBtn")?.addEventListener("click", () => {
    document.getElementById("menuModal")?.classList.add("hidden");
    document.getElementById("wallpaperAdvancedModal")?.classList.remove("hidden");
    });

}
