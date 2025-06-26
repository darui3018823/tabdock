function applyVisualSettings() {
    const blur = document.getElementById("blurRange")?.value || 0;
    const brightness = document.getElementById("brightnessRange")?.value || 100;
    const opacity = document.getElementById("opacityRange")?.value || 100;

    const blurLayer = document.getElementById("wallpaperBlurLayer");
    const widgetContainer = document.getElementById("widgetContainer");

    if (blurLayer) {
        blurLayer.style.backdropFilter = `blur(${blur}px) brightness(${brightness}%)`;
    }
    if (widgetContainer) {
        widgetContainer.style.opacity = `${opacity / 100}`;
    }

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
    applyVisualSettings();
})();
