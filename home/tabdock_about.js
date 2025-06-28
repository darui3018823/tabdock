// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.7.5_about-r1

document.getElementById("openAboutModal").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("aboutModal").classList.remove("hidden");
});
document.getElementById("closeAboutModal").addEventListener("click", () => {
    document.getElementById("aboutModal").classList.add("hidden");
});
