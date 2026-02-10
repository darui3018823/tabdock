// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.21.0_about-r1

let tabdockVersion = "Unknown";

document.getElementById("openAboutModal").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("aboutModal").classList.remove("hidden");
});
document.getElementById("closeAboutModal").addEventListener("click", () => {
    document.getElementById("aboutModal").classList.add("hidden");
    document.getElementById("menuModal").classList.remove("hidden");
});

const envEl = (id) => document.getElementById(id);

const setEnvText = (id, value) => {
    const el = envEl(id);
    if (el) el.textContent = value;
};

const getDisplayMode = () => {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (document.referrer && document.referrer.startsWith('android-app://')) return 'twa';
    return 'browser';
};

const updateViewportInfo = () => {
    setEnvText('envViewport', `${window.innerWidth}x${window.innerHeight}`);
};

const updateEnvInfo = () => {
    setEnvText('envTabdockVersion', tabdockVersion);
    setEnvText('envDisplayMode', getDisplayMode());
    setEnvText('envPlatform', navigator.platform || 'Unknown');
    setEnvText('envLanguage', navigator.language || 'Unknown');
    setEnvText('envTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown');
    setEnvText('envScreen', `${screen.width}x${screen.height}`);
    updateViewportInfo();
    setEnvText('envMemory', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown');
    setEnvText('envCpu', navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}` : 'Unknown');
    setEnvText('envTouch', 'ontouchstart' in window ? 'Yes' : 'No');
    setEnvText('envUserAgent', navigator.userAgent || 'Unknown');
};

const buildEnvCopyText = () => {
    const lines = [
        `Tabdock: ${tabdockVersion}`,
        `DisplayMode: ${getDisplayMode()}`,
        `Platform: ${navigator.platform || 'Unknown'}`,
        `Language: ${navigator.language || 'Unknown'}`,
        `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'}`,
        `Screen: ${screen.width}x${screen.height}`,
        `Viewport: ${window.innerWidth}x${window.innerHeight}`,
        `Memory: ${navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown'}`,
        `CPU: ${navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}` : 'Unknown'}`,
        `Touch: ${'ontouchstart' in window ? 'Yes' : 'No'}`,
        `UserAgent: ${navigator.userAgent || 'Unknown'}`
    ];
    return lines.join('\n');
};

const copyEnvInfo = async () => {
    try {
        await navigator.clipboard.writeText(buildEnvCopyText());
        Toast?.fire({ icon: 'success', title: '環境情報をコピーしました' });
    } catch (error) {
        console.error('環境情報のコピーに失敗しました:', error);
        Toast?.fire({ icon: 'error', title: 'コピーに失敗しました' });
    }
};

envEl('copyEnvInfoBtn')?.addEventListener('click', copyEnvInfo);
window.addEventListener('resize', updateViewportInfo);
updateEnvInfo();

fetch('/api/version')
    .then(res => res.json())
    .then(data => {
    if (data.version) {
        tabdockVersion = `v${data.version}`;
        const vEl = document.getElementById('version');
        if (vEl) vEl.textContent = tabdockVersion;
        updateEnvInfo();
    }
})
