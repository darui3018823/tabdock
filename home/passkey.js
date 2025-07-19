document.getElementById("openAccManage").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("accountModal").classList.remove("hidden");
});

function closeAccountModal() {
    document.getElementById("accountModal").classList.add("hidden");
}