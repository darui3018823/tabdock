// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.6.0_js-r1

let weatherDetailData = [];
let weatherData = null;
let weatherDetailParsedData = {};

async function fetchWeather() {
    const pref = getCookie("prefname");
    const city = getCookie("cityname");
    if (!pref || !city) return;
    document.getElementById("weather-title").textContent = `天気予報（地域：${pref}、${city}）`;

    try {
        const response = await fetch("/api/weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                program_type: "Get_Weather",
                program_langs: "Golang",
                data: {
                    prefname: pref,
                    cityname: city
                }
            })
        });

        const data = await response.json();

        if (!data.body || !data.body.main_data) {
            console.error("weatherAPI: data.body.main_data is missing", data);
            return;
        }

        weatherData = JSON.parse(data.body.main_data);
        const forecasts = weatherData.forecasts;
        weatherDetailData = forecasts;

        const todayTempEl = document.getElementById("weather-today-temp");
        const todayTelopEl = document.getElementById("weather-today-telop");
        const tomorrowTempEl = document.getElementById("weather-tomorrow-temp");
        const tomorrowTelopEl = document.getElementById("weather-tomorrow-telop");

        const parsed = JSON.parse(data.body.main_data);
        weatherDetailData = parsed.forecasts;
        weatherOverview = parsed.description.bodyText || "";

        if (todayTempEl && todayTelopEl) {
            todayTempEl.textContent =
                (forecasts[0].temperature.max.celsius || "--") + "℃ / " +
                (forecasts[0].temperature.min.celsius || "--") + "℃";
            todayTelopEl.textContent = forecasts[0].telop;
        }

        if (tomorrowTempEl && tomorrowTelopEl) {
            tomorrowTempEl.textContent =
                (forecasts[1].temperature.max.celsius || "--") + "℃ / " +
                (forecasts[1].temperature.min.celsius || "--") + "℃";
            tomorrowTelopEl.textContent = forecasts[1].telop;
        }

        // 詳細ボタンイベントの追加（初回のみ）
        setWeatherDetailEvents();

    } catch (err) {
        console.error("天気取得エラー:", err);
    }
}

function setWeatherDetailEvents() {
    const todayBtn = document.getElementById("todayDetailBtn");
    const tomorrowBtn = document.getElementById("tomorrowDetailBtn");
    const dayafterBtn = document.getElementById("dayafterDetailBtn");

    if (todayBtn) {
        todayBtn.onclick = () => {
            showDetail("today", "今日", weatherData.forecasts[0].detail, weatherData.description.bodyText);
        };
    }

    if (tomorrowBtn) {
        tomorrowBtn.onclick = () => {
            showDetail("tomorrow", "明日", weatherData.forecasts[1].detail, weatherData.description.bodyText);
        };
    }

    if (dayafterBtn) {
        dayafterBtn.onclick = () => {
            showDetail("dayafter", "明後日", weatherData.forecasts[2].detail, weatherData.description.bodyText);
        };
    }
}

function showDetail(key, label, detail, overview) {
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modalTitle");
    const modalText = document.getElementById("modalText");

    if (!modal || !modalTitle || !modalText) {
        console.error("Modal elements not found");
        return;
    }

    // タイトル更新
    modalTitle.textContent = `${label} の天気の詳細`;

    // モーダル内容組み立て
    modalText.innerHTML = `
        <p><strong>天気:</strong> ${detail.weather}</p>
        <p><strong>風:</strong> ${detail.wind}</p>
        <p><strong>波:</strong> ${detail.wave}</p>
        <hr class="my-2 border-gray-600" />
        <p><strong>概況:</strong><br>${overview || "情報なし"}</p>
    `;

    modal.classList.remove("hidden");
}

// モーダル閉じる処理
document.getElementById("modalCloseBtn")?.addEventListener("click", () => {
    document.getElementById("modal")?.classList.add("hidden");
});


function closeModal() {
    document.getElementById("weatherModal").classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
    fetchWeather();

    const locationBtn = document.getElementById("locationBtn");
    if (locationBtn) {
        locationBtn.addEventListener("click", () => {
            document.getElementById("locationModal").classList.remove("hidden");
        });
    }

    const locationSave = document.getElementById("saveLocation");
    if (locationSave) {
        locationSave.addEventListener("click", () => {
            const pref = document.getElementById("prefInput").value.trim();
            const city = document.getElementById("cityInput").value.trim();
            if (!pref || !city) return;

            document.cookie = `prefname=${encodeURIComponent(pref)}; path=/;`;
            document.cookie = `cityname=${encodeURIComponent(city)}; path=/;`;
            document.getElementById("locationModal").classList.add("hidden");
            fetchWeather();
        });
    }

    const closeBtns = document.querySelectorAll(".closeModalBtn");
    closeBtns.forEach(btn => {
        btn.addEventListener("click", closeModal);
    });

    const locationModal = document.getElementById("locationModal");
    const openLocationModalBtn = document.getElementById("openLocationModalBtn"); // 地域選択を開くボタン（仮）
    const closeLocationModalBtn = document.getElementById("closeLocationModal");
    const saveLocationBtn = document.getElementById("saveLocationBtn");

    // モーダルを開く
    if (openLocationModalBtn) {
        openLocationModalBtn.addEventListener("click", () => {
            locationModal.classList.remove("hidden");
        });
    }

    // モーダルを閉じる
    document.getElementById("modalCloseBtn")?.addEventListener("click", () => {
        document.getElementById("modal").classList.add("hidden");
    });
    

    // 保存ボタンの処理
    if (saveLocationBtn) {
        saveLocationBtn.addEventListener("click", () => {
            const pref = document.getElementById("prefInput").value.trim();
            const city = document.getElementById("cityInput").value.trim();

            if (pref && city) {
                document.cookie = `prefname=${encodeURIComponent(pref)}; path=/;`;
                document.cookie = `cityname=${encodeURIComponent(city)}; path=/;`;

                locationModal.classList.add("hidden");
                location.reload(); // Cookie反映のためリロード
            } else {
                alert("都道府県名と市区町村名を両方入力してください。");
            }
        });
    }

    document.getElementById("todayDetailBtn").onclick = () => {
        showDetail("today", "今日", weatherData.forecasts[0].detail, weatherData.description.bodyText);
    };
    
    document.getElementById("tomorrowDetailBtn").onclick = () => {
        showDetail("tomorrow", "明日", weatherData.forecasts[1].detail, weatherData.description.bodyText);
    };
    
    document.getElementById("dayafterDetailBtn").onclick = () => {
        showDetail("dayafter", "明後日", weatherData.forecasts[2].detail, weatherData.description.bodyText);
    };    
});

function getCookie(name) {
    const value = document.cookie.match(`(^|;)\\s*${name}=([^;]*)`);
    return value ? decodeURIComponent(value[2]) : null;
}

function closeModal() {
    const modal = document.getElementById("weatherDetailModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}
