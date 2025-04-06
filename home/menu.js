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
});