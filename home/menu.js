document.addEventListener("DOMContentLoaded", () => {
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const menuModal = document.getElementById("menuModal");
    const closeMenuModal = document.getElementById("closeMenuModal");

    hamburgerBtn.addEventListener("click", () => {
        menuModal.classList.remove("hidden");
    });

    closeMenuModal.addEventListener("click", () => {
        menuModal.classList.add("hidden");
    });

    document.getElementById("hamburgerBtn").onclick = () => {
        document.getElementById("menuModal").classList.remove("hidden");
    };
    
    document.getElementById("closeMenuModal").onclick = () => {
        document.getElementById("menuModal").classList.add("hidden");
    };
    
    document.getElementById("openWallpaperModal").onclick = () => {
        document.getElementById("menuModal").classList.add("hidden");
        document.getElementById("wallpaperModal").classList.remove("hidden");
    };
    
    document.getElementById("closeWallpaperModal").onclick = () => {
        document.getElementById("wallpaperModal").classList.add("hidden");
    };

    const presetImages = document.querySelectorAll("#presetWallpapers img");

    presetImages.forEach(img => {
        img.addEventListener("click", () => {
        document.body.style.backgroundImage = `url('${img.src}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundRepeat = "no-repeat";
        });
    });


    const uploadInput = document.getElementById("wallpaperUpload");
    const presetContainer = document.getElementById("presetWallpapers");

    uploadInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;

        // 壁紙として反映
        document.body.style.backgroundImage = `url('${imageData}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";

        // プリセットに追加
        const img = document.createElement("img");
        img.src = imageData;
        img.alt = "uploaded-wallpaper";
        img.className = "rounded cursor-pointer hover:ring-2 ring-white";
        img.onclick = () => {
        document.body.style.backgroundImage = `url('${imageData}')`;
        };
        presetContainer.appendChild(img);

        // CookieかlocalStorageに保存する処理を後で追加してもOK
    };
    reader.readAsDataURL(file);
    });

    document.getElementById("confirmUploadBtn").onclick = () => {
        document.getElementById("uploadConfirmModal").classList.remove("hidden");
      };
      
      document.getElementById("cancelUploadConfirm").onclick = () => {
        document.getElementById("uploadConfirmModal").classList.add("hidden");
      };
      
      document.getElementById("acceptUploadConfirm").onclick = () => {
        document.getElementById("uploadConfirmModal").classList.add("hidden");
      };
    
      document.getElementById("confirmUploadBtn").addEventListener("click", () => {
        const file = document.getElementById("wallpaperUpload").files[0];
        if (!file) {
            alert("画像を選択してください。");
            return;
        }
        // アップロード確認モーダルを表示
        document.getElementById("uploadConfirmModal").classList.remove("hidden");
    });
    
    document.getElementById("cancelUploadConfirm").addEventListener("click", () => {
        document.getElementById("uploadConfirmModal").classList.add("hidden");
    });
    
    document.getElementById("acceptUploadConfirm").addEventListener("click", async () => {
        const input = document.getElementById("wallpaperUpload");
        const file = input.files[0];
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
    
            // 背景にすぐ適用したい場合（任意）
            document.body.style.backgroundImage = `url(wallpapers/${result.filename})`;
    
            // モーダルを閉じる
            document.getElementById("uploadConfirmModal").classList.add("hidden");
        } catch (e) {
            alert("アップロードに失敗しました。");
            console.error(e);
        }
    });

    // 開閉処理
    document.getElementById("openWallpaperAdvancedBtn").onclick = () => {
        document.getElementById("wallpaperAdvancedModal").classList.remove("hidden");
    };
    document.getElementById("closeWallpaperAdvancedModal").onclick = () => {
        document.getElementById("wallpaperAdvancedModal").classList.add("hidden");
    };

    // スライダーで反映
    const brightnessSlider = document.getElementById("brightnessSlider");
    const blurSlider = document.getElementById("blurSlider");

    function updateWallpaperFilter() {
        const brightness = brightnessSlider.value;
        const blur = blurSlider.value;
        document.body.style.backdropFilter = `brightness(${brightness}%) blur(${blur}px)`;
    }
    brightnessSlider.oninput = updateWallpaperFilter;
    blurSlider.oninput = updateWallpaperFilter;
    
});