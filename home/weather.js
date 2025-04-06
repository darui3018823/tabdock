// weather.js

document.addEventListener("DOMContentLoaded", () => {
    function showDetail(day) {
        const key = `weather-${day}-detail`;
        const text = localStorage.getItem(key) || "詳細情報が見つかりませんでした。";
        const modal = document.getElementById(`modal-${day}`);
        const content = document.getElementById(`modal-${day}-content`);
    
        if (modal && content) {
            content.textContent = text;
            modal.classList.remove("hidden");
        } else {
            console.warn(`モーダルの要素が見つかりません: modal-${day} または modal-${day}-content`);
        }
    }
    window.showDetail = showDetail;
    
    function closeModal(day) {
        const modal = document.getElementById(`modal-${day}`);
        if (modal) {
            modal.classList.add("hidden");
        } else {
            console.warn(`閉じようとしたモーダルが見つかりません: modal-${day}`);
        }
    }
    window.closeModal = closeModal;
    

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
                const parsed = JSON.parse(data.body.main_data);
                const todayDetail = parsed.forecasts[0].detail.weather;

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
                localStorage.setItem("weather-today-detail", today.detail);
                localStorage.setItem("weather-tomorrow-detail", tomorrow.detail);
                localStorage.setItem("weather-dayafter-detail", dayafter.detail);

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
    setInterval(fetchWeather, 120000); // 120秒ごとに更新
});
