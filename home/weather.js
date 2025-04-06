let weatherData = null;

function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
}

function fetchWeather() {
    const prefname = getCookie("prefname");
    const cityname = getCookie("cityname");

    if (!prefname || !cityname) {
        console.warn("Cookie に都道府県名または市区町村名がありません。");
        return;
    }

    fetch("/api/weather", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefname, cityname }),
    })
        .then((res) => res.json())
        .then((data) => {
            if (!data.body || !data.body.main_data) {
                console.error("weatherAPI: data.body.main_data is missing", data);
                return;
            }

            const mainData = JSON.parse(data.body.main_data);
            weatherData = mainData;

            const city = mainData.location?.city || "地域";
            document.getElementById("weather-city-label").textContent = `${city}の天気`;

            const today = mainData.forecasts?.[0];
            const tomorrow = mainData.forecasts?.[1];

            if (today) {
                document.getElementById("weather-today-label").textContent = today.dateLabel;
                document.getElementById("weather-today-temp").textContent = formatTemp(today.temperature);
                document.getElementById("weather-today-telop").textContent = today.telop || "--";
            }

            if (tomorrow) {
                document.getElementById("weather-tomorrow-label").textContent = tomorrow.dateLabel;
                document.getElementById("weather-tomorrow-temp").textContent = formatTemp(tomorrow.temperature);
                document.getElementById("weather-tomorrow-telop").textContent = tomorrow.telop || "--";
            }
        })
        .catch((err) => {
            console.error("天気取得エラー:", err);
        });
}

function formatTemp(temp) {
    const min = temp.min?.celsius || "--";
    const max = temp.max?.celsius || "--";
    return `${max}℃ / ${min}℃`;
}

function showDetail(dayLabel) {
    const modal = document.getElementById("weatherDetailModal");
    const modalText = document.getElementById("modalText");

    if (!weatherData || !Array.isArray(weatherData.forecasts)) {
        modalText.innerHTML = "天気データが取得できていません。";
        modal.classList.remove("hidden");
        return;
    }

    const forecast = weatherData.forecasts.find(f => f.dateLabel === dayLabel);
    if (!forecast || !forecast.detail) {
        modalText.innerHTML = "詳細情報が見つかりません。";
        modal.classList.remove("hidden");
        return;
    }

    const { weather, wind, wave } = forecast.detail;

    let html = "";
    if (weather) html += `<div><strong>天気：</strong>${weather}</div>`;
    if (wind) html += `<div><strong>風：</strong>${wind}</div>`;
    if (wave) html += `<div><strong>波：</strong>${wave}</div>`;

    modalText.innerHTML = html || "詳細情報がありません。";
    modal.classList.remove("hidden");
}

function closeModal() {
    const modal = document.getElementById("weatherDetailModal");
    if (modal) modal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
    fetchWeather();

    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }

    // 明後日ボタンがある場合も閉じられるように追加しておく
    window.showDetail = showDetail;
});
