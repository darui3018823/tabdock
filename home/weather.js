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
    

    async function fetchWeather() {
        const pref = getCookie("prefname");
        const city = getCookie("cityname");
    
        if (!pref || !city) {
            console.warn("都道府県名または市区町村名がCookieに保存されていません。");
            return;
        }
    
        try {
            const response = await fetch("/api/weather", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
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
    
            const weather = JSON.parse(data.body.main_data); // ここでmain_dataをJSONにパース
    
            // UI 反映処理（例）
            document.getElementById("weather-today-label").textContent = weather.forecasts[0].dateLabel;
            document.getElementById("weather-today-temp").textContent =
                `${weather.forecasts[0].temperature.max?.celsius ?? "--"}℃ / ${weather.forecasts[0].temperature.min?.celsius ?? "--"}℃`;
            document.getElementById("weather-today-telop").textContent = weather.forecasts[0].telop;
    
            document.getElementById("weather-tomorrow-label").textContent = weather.forecasts[1].dateLabel;
            document.getElementById("weather-tomorrow-temp").textContent =
                `${weather.forecasts[1].temperature.max?.celsius ?? "--"}℃ / ${weather.forecasts[1].temperature.min?.celsius ?? "--"}℃`;
            document.getElementById("weather-tomorrow-telop").textContent = weather.forecasts[1].telop;
    
            // 明後日のために詳細を保存（必要に応じて）
            window.dayafterForecast = weather.forecasts[2];
        } catch (error) {
            console.error("天気取得エラー：", error);
        }
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

    const openLocationModalBtn = document.getElementById("openLocationModal");
    const closeLocationModalBtn = document.getElementById("closeLocationModal");
    const saveLocationBtn = document.getElementById("saveLocationBtn");
    const locationModal = document.getElementById("locationModal");

    const prefInput = document.getElementById("prefInput");
    const cityInput = document.getElementById("cityInput");

    // モーダル開閉
    openLocationModalBtn?.addEventListener("click", () => {
        locationModal?.classList.remove("hidden");
    });

    closeLocationModalBtn?.addEventListener("click", () => {
        locationModal?.classList.add("hidden");
    });

    // 保存ボタン処理
    saveLocationBtn?.addEventListener("click", () => {
        const prefname = prefInput?.value.trim();
        const cityname = cityInput?.value.trim();

        if (prefname && cityname) {
            document.cookie = `prefname=${encodeURIComponent(prefname)}; path=/`;
            document.cookie = `cityname=${encodeURIComponent(cityname)}; path=/`;

            locationModal?.classList.add("hidden");
            fetchWeather(); // 保存後に天気を再取得
        } else {
            alert("都道府県名と市区町村名を入力してください");
        }
    });
});
