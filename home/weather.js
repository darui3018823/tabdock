let weatherDetailData = [];
let weatherData = null;
let weatherDetailParsedData = {};


async function fetchWeather() {
    const pref = getCookie("prefname");
    const city = getCookie("cityname");
    if (!pref || !city) return;

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


function showDetail(dayKey) {
    if (!weatherDetailData || !Array.isArray(weatherDetailData)) return;

    let index = 0;
    let label = "今日";

    if (dayKey === "tomorrow") {
        index = 1;
        label = "明日";
    } else if (dayKey === "dayafter") {
        index = 2;
        label = "明後日";
    }

    const data = weatherDetailData[index];
    const parsed = weatherDetailParsedData;  // global変数（fetchで代入してる場合）

    const detail = data.detail;
    const overview = parsed.description?.bodyText || "情報なし";

    const modalTitle = document.getElementById("modalTitle");
    const modalText = document.getElementById("modalText");

    modalTitle.textContent = `${label} の天気の詳細`;

    modalText.innerHTML = `
        <div class="text-base leading-relaxed">
            <p><strong>天気:</strong> ${detail.weather || "情報なし"}</p>
            <p><strong>風:</strong> ${detail.wind || "情報なし"}</p>
            <p><strong>波:</strong> ${detail.wave || "情報なし"}</p>
        </div>
        <hr class="my-3 border-gray-600" />
        <div class="text-sm text-gray-300">
            <p><strong>概況:</strong><br>${overview.replace(/\n/g, "<br>")}</p>
        </div>
    `;

    document.getElementById("modal").classList.remove("hidden");
}



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
    document.addEventListener("DOMContentLoaded", () => {
        const closeModalBtn = document.getElementById("closeModalBtn");
        if (closeModalBtn) {
            closeModalBtn.addEventListener("click", closeModal);
        }
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
