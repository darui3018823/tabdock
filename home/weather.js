let weatherDetailData = [];

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

function showDetail(dayKey) {
    if (!weatherDetailData.length) return;

    const modal = document.getElementById("weatherModal");
    const modalText = document.getElementById("modalText");

    let forecast;
    if (dayKey === "today") forecast = weatherDetailData[0];
    else if (dayKey === "tomorrow") forecast = weatherDetailData[1];
    else if (dayKey === "dayafter") forecast = weatherDetailData[2];
    else return;

    modalText.textContent =
        (forecast?.detail?.weather || forecast?.telop || "") + "\n" +
        (forecast?.detail?.wind || "") + "\n" +
        (forecast?.detail?.wave || "");
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
});

function getCookie(name) {
    const value = document.cookie.match(`(^|;)\\s*${name}=([^;]*)`);
    return value ? decodeURIComponent(value[2]) : null;
}
