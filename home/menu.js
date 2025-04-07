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
        loadWallpapers(); 
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

    // 修正: 閉じるボタンのIDを正しく設定
    document.getElementById("closeEffectModal").onclick = () => {
        const modal = document.getElementById("wallpaperAdvancedModal");
        if (modal) {
            modal.classList.add("hidden");
        } else {
            console.error("wallpaperAdvancedModalが見つかりません");
        }
    };

    // 修正: スライダの初期値を設定
    const brightnessSlider = document.getElementById("brightnessSlider");
    const blurSlider = document.getElementById("blurSlider");
    const brightnessValue = document.getElementById("brightnessValue");
    const blurValue = document.getElementById("blurValue");

    if (brightnessSlider && blurSlider && brightnessValue && blurValue) {
        // 初期値を設定
        brightnessValue.textContent = `${brightnessSlider.value}%`;
        blurValue.textContent = `${blurSlider.value}px`;

        // 背景フィルタの適用
        function updateBackgroundEffect() {
            const brightness = brightnessSlider.value;
            const blur = blurSlider.value;

            // 値が正しく取得できているか確認
            console.log(`Brightness: ${brightness}, Blur: ${blur}`);

            // フィルタを適用
            document.body.style.filter = `brightness(${brightness}%) blur(${blur}px)`;
        }

        // スライダのイベントリスナーを設定
        brightnessSlider.addEventListener("input", () => {
            brightnessValue.textContent = `${brightnessSlider.value}%`;
            updateBackgroundEffect();
        });

        blurSlider.addEventListener("input", () => {
            blurValue.textContent = `${blurSlider.value}px`;
            updateBackgroundEffect();
        });

        // デフォルトに戻すボタンの動作を修正
        document.getElementById("resetWallpaperEffect").addEventListener("click", () => {
            brightnessSlider.value = 100;
            blurSlider.value = 0;
            brightnessValue.textContent = "100%";
            blurValue.textContent = "0px";
            updateBackgroundEffect();
        });
    } else {
        console.error("スライダまたは値表示要素が見つかりません");
    }

    async function loadWallpapers() {
        try {
            const response = await fetch("/api/list-wallpapers");
            const data = await response.json();
    
            const presetWallpapers = document.getElementById("presetWallpapers");
            presetWallpapers.innerHTML = ""; // 一度クリア
    
            if (!data.images || data.images.length === 0) {
                presetWallpapers.innerHTML = "<p class='text-sm text-gray-300'>画像が見つかりませんでした。</p>";
                return;
            }
    
            data.images.forEach((path) => {
                const fileName = path.split("/").pop(); // ファイル名の抽出
                const img = document.createElement("img");
                img.src = "/" + path.replace(/\\/g, "/"); // スラッシュ統一
                img.alt = fileName;
                img.className = "rounded cursor-pointer hover:ring-2 ring-white";
                img.onclick = () => {
                    document.body.style.backgroundImage = `url('${img.src}')`;
                    // 必要ならここで Cookie や localStorage に保存も可能
                };
                presetWallpapers.appendChild(img);
            });
    
        } catch (error) {
            console.error("壁紙の読み込み中にエラーが発生しました:", error);
        }
    }
    
    
});