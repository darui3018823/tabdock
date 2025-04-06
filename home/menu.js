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
    
});