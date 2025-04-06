let weatherDetailData = [];
let weatherData = null;

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

        const parsed = JSON.parse(data.body.main_data);
        const forecasts = parsed.forecasts;
        weatherDetailData = forecasts;

        document.getElementById("weather-today-temp").textContent =
            (forecasts[0].temperature.max.celsius || "--") + "℃ / " +
            (forecasts[0].temperature.min.celsius || "--") + "℃";
        document.getElementById("weather-today-telop").textContent =
            forecasts[0].telop;

        document.getElementById("weather-tomorrow-temp").textContent =
            (forecasts[1].temperature.max.celsius || "--") + "℃ / " +
            (forecasts[1].temperature.min.celsius || "--") + "℃";
        document.getElementById("weather-tomorrow-telop").textContent =
            forecasts[1].telop;
    } catch (err) {
        console.error("天気取得エラー:", err);
    }
}

function showDetail(dayKey, label, detail, bodyText) {
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modalTitle");
    const modalText = document.getElementById("modalText");

    if (!modal || !modalTitle || !modalText) return;

    // タイトルと詳細情報の表示
    modalTitle.textContent = `${label}の天気の詳細`;
    modalText.innerHTML = `
        <p>${detail.weather}</p>
        <p>${detail.wind}</p>
        <p>${detail.wave}</p>
        <hr class="my-2 border-gray-600">
        <p class="text-xs text-gray-300 whitespace-pre-line">${bodyText}</p>
    `;

    modal.classList.remove("hidden");
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
    if (closeLocationModalBtn) {
        closeLocationModalBtn.addEventListener("click", () => {
            locationModal.classList.add("hidden");
        });
    }

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
