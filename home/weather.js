// weather.js

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("weatherModal");
    const modalText = document.getElementById("weatherModalText");
    const closeModalBtn = document.getElementById("closeWeatherModal");

    function showDetail(day) {
        const key = `weather-${day}-detail`;
        const text = localStorage.getItem(key) || "詳細情報が見つかりませんでした。";
        modalText.textContent = text;
        modal.classList.remove("hidden");
    }

    window.showDetail = showDetail;

    closeModalBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    function fetchWeather() {
        const prefname = getCookie("prefname");
        const cityname = getCookie("cityname");
        if (!prefname || !cityname) return;

        fetch("/api/weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefname, cityname })
        })
            .then(res => res.json())
            .then(data => {
                const today = data.forecasts[0];
                const tomorrow = data.forecasts[1];
                const dayafter = data.forecasts[2];

                document.getElementById("weather-today-label").textContent = today.dateLabel;
                document.getElementById("weather-today-temp").textContent = `${today.temperature.max?.celsius || "--"}℃ / ${today.temperature.min?.celsius || "--"}℃`;
                document.getElementById("weather-today-telop").textContent = today.telop;

                document.getElementById("weather-tomorrow-label").textContent = tomorrow.dateLabel;
                document.getElementById("weather-tomorrow-temp").textContent = `${tomorrow.temperature.max?.celsius || "--"}℃ / ${tomorrow.temperature.min?.celsius || "--"}℃`;
                document.getElementById("weather-tomorrow-telop").textContent = tomorrow.telop;

                // 詳細データを保存
                localStorage.setItem("weather-today-detail", today.detail.weather);
                localStorage.setItem("weather-tomorrow-detail", tomorrow.detail.weather);
                localStorage.setItem("weather-dayafter-detail", dayafter.detail.weather || "詳細情報なし");
            })
            .catch(err => console.error("天気取得エラー:", err));
    }

    function getCookie(name) {
        const cookies = document.cookie.split("; ");
        for (let c of cookies) {
            const [key, val] = c.split("=");
            if (key === name) return decodeURIComponent(val);
        }
        return null;
    }

    fetchWeather();
});
