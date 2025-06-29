// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.9.2_weather-r2

let weatherDetailData = [];
let weatherData = null;
let weatherDetailParsedData = {};

async function fetchWeather() {
    let tempAlertShown = false;

    function safeTempText(temp) {
        return temp?.celsius ?? "--";
    }

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

        const nowHour = new Date().getHours();
        let rainTimeKey = "";
        if (nowHour < 6) rainTimeKey = "T00_06";
        else if (nowHour < 12) rainTimeKey = "T06_12";
        else if (nowHour < 18) rainTimeKey = "T12_18";
        else rainTimeKey = "T18_24";

        const rainEl = document.getElementById("todayRain");
        if (rainEl && forecasts[0]?.chanceOfRain && rainTimeKey in forecasts[0].chanceOfRain) {
            const rainVal = forecasts[0].chanceOfRain[rainTimeKey];
            if (typeof rainVal === "string" && rainVal.trim() !== "") {
                rainEl.textContent = `降水確率: ${rainVal}`;
            }
        }

        const parsed = JSON.parse(data.body.main_data);
        weatherDetailData = parsed.forecasts;
        weatherOverview = parsed.description.bodyText || "";

        if (todayTempEl && todayTelopEl && forecasts[0]?.temperature) {
            const max = forecasts[0].temperature.max;
            const min = forecasts[0].temperature.min;
            const maxC = (max && max.celsius != null && max.celsius !== "") ? max.celsius : null;
            const minC = (min && min.celsius != null && min.celsius !== "") ? min.celsius : null;

            if (maxC !== null && minC !== null) {
                todayTempEl.textContent = `${maxC}℃ / ${minC}℃`;
            }
            if (typeof forecasts[0].telop === "string" && forecasts[0].telop.trim() !== "") {
                todayTelopEl.textContent = forecasts[0].telop;
            }

            if ((max?.celsius === null || min?.celsius === null) && !tempAlertShown) {
                Swal.fire({
                    icon: 'warning',
                    title: '本日の気温は未定です',
                    text: '気象庁の発表時刻により、気温がまだ未定の場合があります。',
                    timer: 6000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                tempAlertShown = true;
            }
        }

        if (tomorrowTempEl && tomorrowTelopEl && forecasts[1]?.temperature) {
            const max = forecasts[1].temperature.max;
            const min = forecasts[1].temperature.min;
            const maxC = (max && max.celsius != null && max.celsius !== "") ? max.celsius : null;
            const minC = (min && min.celsius != null && min.celsius !== "") ? min.celsius : null;

            if (maxC !== null && minC !== null) {
                tomorrowTempEl.textContent = `${maxC}℃ / ${minC}℃`;
            }
            if (typeof forecasts[1].telop === "string" && forecasts[1].telop.trim() !== "") {
                tomorrowTelopEl.textContent = forecasts[1].telop;
            }
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: '天気情報を更新しました',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
        });

        const updateTime = new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        document.getElementById("weather-last-update").textContent = updateTime;

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

    const index = key === "today" ? 0 : key === "tomorrow" ? 1 : 2;
    const rain = weatherData.forecasts[index].chanceOfRain;

    const rainHtml = Object.entries(rain)
        .map(([time, percent]) => {
            const label = time.replace("T", "").replace("_", "–");
            return `<div class="inline-block mr-4">${label}時: ${percent}</div>`;
        }).join("");

    modalTitle.textContent = `${label} の天気の詳細`;
    modalText.innerHTML = `
        <p><strong>天気:</strong> ${detail.weather}</p>
        <p><strong>風:</strong> ${detail.wind}</p>
        <p><strong>波:</strong> ${detail.wave}</p>
        <p><strong>降水確率:</strong><br>${rainHtml}</p>
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
    setInterval(fetchWeather, 60 * 60 * 1000);

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
