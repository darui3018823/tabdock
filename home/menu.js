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
});