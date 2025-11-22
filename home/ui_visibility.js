// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.10.5_ui-r1

// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.10.0_ui-r1

let wallpaperStorageWarningShown = false;

function applyVisualSettings() {
    // ぼかしと明るさをlocalStorageから読み込む（今回は変更しないが、元のロジックを維持）
    const blur = parseInt(document.getElementById("blurRange")?.value || 0);
    const brightness = parseInt(document.getElementById("brightnessRange")?.value || 100);
    const blurLayer = document.getElementById("wallpaperBlurLayer");
    if (blurLayer) {
        blurLayer.style.backdropFilter = `blur(${blur}px) brightness(${brightness}%)`;
        blurLayer.style.webkitBackdropFilter = `blur(${blur}px) brightness(${brightness}%)`;
    }

    // 保存されたウィジェットの不透明度を適用
    const savedOpacity = localStorage.getItem('tabdock_widget_opacity') ?? 30; // デフォルトは30 (70%不透明)
    const alpha = (100 - parseInt(savedOpacity)) / 100;
    const widgets = document.querySelectorAll('.widget-box');
    widgets.forEach(widget => {
        widget.style.backgroundColor = `rgba(0, 0, 0, ${alpha})`;
    });

    // モーダル内のスライダーとテキスト表示を更新
    const opacitySlider = document.getElementById("opacityRange");
    const opacityValueEl = document.getElementById("opacityValue");
    if (opacitySlider) {
        opacitySlider.value = savedOpacity;
    }
    if (opacityValueEl) {
        opacityValueEl.textContent = `${100 - parseInt(savedOpacity)}%`; // ユーザーには不透明度として表示
    }
    
    // 他のスライダーのテキスト表示も更新
    const blurValue = document.getElementById("blurValue");
    const brightnessValue = document.getElementById("brightnessValue");
    if (blurValue) blurValue.textContent = `${blur}px`;
    if (brightnessValue) brightnessValue.textContent = `${brightness}%`;
}

function tempApplyOpacity() {
    const opacitySlider = document.getElementById("opacityRange");
    const sliderValue = parseInt(opacitySlider.value);
    const alpha = (100 - sliderValue) / 100;
    
    const widgets = document.querySelectorAll('.widget-box');
    widgets.forEach(widget => {
        widget.style.backgroundColor = `rgba(0, 0, 0, ${alpha})`;
    });

    const opacityValueEl = document.getElementById("opacityValue");
    if (opacityValueEl) {
        opacityValueEl.textContent = `${100 - sliderValue}%`; // ユーザーには不透明度として表示
    }
}

(function initVisibilitySettings() {
    const savedWallpaper = localStorage.getItem("tabdock_wallpaper")
        ?? sessionStorage.getItem("tabdock_wallpaper_session");
    if (savedWallpaper) {
        handlePresetClick(savedWallpaper, { persist: false });
    }

    // 元のぼかし・明るさスライダーのイベントリスナーはそのまま
    const blurSlider = document.getElementById("blurRange");
    const brightnessSlider = document.getElementById("brightnessRange");
    if (blurSlider) blurSlider.addEventListener("input", () => {
        const blurValue = document.getElementById("blurValue");
        if(blurValue) blurValue.textContent = `${blurSlider.value}px`;
    });
    if (brightnessSlider) brightnessSlider.addEventListener("input", () => {
        const brightnessValue = document.getElementById("brightnessValue");
        if(brightnessValue) brightnessValue.textContent = `${brightnessSlider.value}%`;
    });

    // 透明度スライダーはリアルタイムプレビュー
    const opacitySlider = document.getElementById("opacityRange");
    if (opacitySlider) {
        opacitySlider.addEventListener("input", tempApplyOpacity);
    }

    const applyBtn = document.getElementById("applyWallpaperAdvanced");
    const closeBtn = document.getElementById("closeWallpaperAdvancedModal");

    if (applyBtn) {
        applyBtn.addEventListener("click", () => {
            // 透明度の値を保存
            const opacity = document.getElementById("opacityRange").value;
            localStorage.setItem('tabdock_widget_opacity', opacity);
            
            // TODO: ぼかしや明るさもここで保存するのが望ましい
            // const blur = document.getElementById("blurRange").value;
            // localStorage.setItem('tabdock_wallpaper_blur', blur);
            // const brightness = document.getElementById("brightnessRange").value;
            // localStorage.setItem('tabdock_wallpaper_brightness', brightness);

            // 保存した値を正式に適用
            applyVisualSettings();
            
            document.getElementById("wallpaperAdvancedModal")?.classList.add("hidden");
            document.getElementById("menuModal")?.classList.remove("hidden");
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            document.getElementById("wallpaperAdvancedModal")?.classList.add("hidden");
            document.getElementById("menuModal")?.classList.remove("hidden");
            // キャンセル時は保存されている値にUIを戻す
            applyVisualSettings();
        });
    }

    initializeSliders();
    initWallpaperUploadHandlers();
    initMenuToggle();
})();

function initializeSliders() {
    // ぼかしと明るさの初期化は元のまま
    const blurSlider = document.getElementById("blurRange");
    const brightnessSlider = document.getElementById("brightnessRange");
    if (blurSlider) blurSlider.value = 0;
    if (brightnessSlider) brightnessSlider.value = 100;

    // 透明度スライダーの初期値を設定
    const opacitySlider = document.getElementById("opacityRange");
    if (opacitySlider) {
        opacitySlider.value = localStorage.getItem('tabdock_widget_opacity') ?? 30;
    }

    // 全ての視覚設定を適用
    applyVisualSettings();
}

function isQuotaExceeded(error) {
    if (!error) return false;
    return error.code === 22 || error.code === 1014 || error.name === 'QuotaExceededError';
}

function handlePresetClick(imgSrc, { persist = true } = {}) {
    const wallpaper = document.getElementById("wallpaper");
    if (wallpaper) {
        wallpaper.style.backgroundImage = `url('${imgSrc}')`;
        wallpaper.style.backgroundSize = "cover";
        wallpaper.style.backgroundPosition = "center";
        wallpaper.style.backgroundRepeat = "no-repeat";

        if (persist) {
            try {
                localStorage.setItem("tabdock_wallpaper", imgSrc);
                sessionStorage.removeItem("tabdock_wallpaper_session");
            } catch (error) {
                if (isQuotaExceeded(error)) {
                    sessionStorage.setItem("tabdock_wallpaper_session", imgSrc);
                    if (!wallpaperStorageWarningShown) {
                        wallpaperStorageWarningShown = true;
                        Toast?.fire?.({
                            icon: 'warning',
                            title: '壁紙の保存領域がいっぱいです'
                        }) ?? alert("壁紙を保存できませんでした。容量を確認してください。");
                    }
                } else {
                    console.error("壁紙設定の保存に失敗しました:", error);
                }
            }
        }
    }
}


function handleWallpaperUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        handlePresetClick(imageData, { persist: false });  // 背景に適用

        // プリセットに追加
    const img = document.createElement("img");
    img.src = imageData;
    img.alt = "uploaded-wallpaper";
    img.className = "rounded cursor-pointer hover:ring-2 ring-white";
        img.onclick = () => handlePresetClick(imageData, { persist: false });

        const presetContainer = document.getElementById("presetWallpapers");
        presetContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
}

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
            img.loading = "lazy";
            img.onclick = () => handlePresetClick(img.src);
            presetWallpapers.appendChild(img);
        });
    } catch (error) {
        console.error("壁紙の読み込み中にエラーが発生しました:", error);
    }
}

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

                if (!res.ok) {
                    const errorText = await res.text();
                    if (res.status === 413 || errorText.includes("exceeds")) { // 413: Payload Too Large
                        Toast?.fire?.({
                            icon: 'error',
                            title: 'ファイルサイズが大きすぎます',
                            text: '50MB以下のファイルを選択してください。'
                        }) ?? alert("ファイルサイズが50MBを超えています。");
                    } else {
                        throw new Error(`サーバーエラー: ${res.status} ${errorText}`);
                    }
                    return; 
                }

                const result = await res.json();
                console.log("アップロード完了:", result);

                handlePresetClick(`wallpapers/${result.filename}`);
                document.getElementById("uploadConfirmModal")?.classList.add("hidden");
            } catch (e) {
                Toast?.fire?.({
                    icon: 'error',
                    title: 'アップロードに失敗しました',
                }) ?? alert("アップロードに失敗しました。");
                console.error(e);
            }
        });
    }
}

function initMenuToggle() {
    document.getElementById("hamburgerBtn")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.remove("hidden");
    });

    document.getElementById("closeMenuModal")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.add("hidden");
    });

    document.getElementById("openWallpaperModal")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.add("hidden");
        document.getElementById("wallpaperModal")?.classList.remove("hidden");
        loadWallpapers();
    });

    document.getElementById("closeWallpaperModal")?.addEventListener("click", () => {
        document.getElementById("wallpaperModal")?.classList.add("hidden");
        document.getElementById("menuModal").classList.remove("hidden");
    });

    document.getElementById("openWallpaperAdvancedBtn")?.addEventListener("click", () => {
        document.getElementById("menuModal")?.classList.add("hidden");
        document.getElementById("wallpaperAdvancedModal")?.classList.remove("hidden");
    });

}
