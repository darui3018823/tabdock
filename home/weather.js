document.addEventListener("DOMContentLoaded", () => {
    // モーダルの表示
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

    // モーダルの非表示
    function closeModal(day) {
        const modal = document.getElementById(`modal-${day}`);
        if (modal) {
            modal.classList.add("hidden");
        } else {
            console.warn(`閉じようとしたモーダルが見つかりません: modal-${day}`);
        }
    }
    window.closeModal = closeModal;

    // Cookieの取得
    function getCookie(name) {
        const cookies = document.cookie.split("; ");
        for (let c of cookies) {
            const [key, val] = c.split("=");
            if (key === name) return decodeURIComponent(val);
        }
        return null;
    }

    // 天気情報のUI更新
    function updateWeatherUI(weather) {
        const today = weather.forecasts[0];
        const tomorrow = weather.forecasts[1];

        document.getElementById("weather-today-label").textContent = today.dateLabel;
        document.getElementById("weather-today-temp").textContent =
            `${today.temperature.max?.celsius ?? "--"}℃ / ${today.temperature.min?.celsius ?? "--"}℃`;
        document.getElementById("weather-today-telop").textContent = today.telop;

        document.getElementById("weather-tomorrow-label").textContent = tomorrow.dateLabel;
        document.getElementById("weather-tomorrow-temp").textContent =
            `${tomorrow.temperature.max?.celsius ?? "--"}℃ / ${tomorrow.temperature.min?.celsius ?? "--"}℃`;
        document.getElementById("weather-tomorrow-telop").textContent = tomorrow.telop;

        // 明後日のデータを保存
        window.dayafterForecast = weather.forecasts[2];
    }

    // 天気情報の取得
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

            if (!response.ok) {
                console.error(`APIエラー: ${response.status} ${response.statusText}`);
                return;
            }

            const data = await response.json();

            if (!data.body || !data.body.main_data) {
                console.error("weatherAPI: data.body.main_data is missing", data);
                return;
            }

            const weather = JSON.parse(data.body.main_data);
            console.log(weather.description.text);
            updateWeatherUI(weather);
        } catch (error) {
            console.error("天気取得エラー：", error);
        }
    }

    // 初回の天気取得と定期更新
    fetchWeather();
    setInterval(fetchWeather, 120000); // 120秒ごとに更新

    // モーダル関連のイベントリスナー
    const openLocationModalBtn = document.getElementById("openLocationModal");
    const closeLocationModalBtn = document.getElementById("closeLocationModal");
    const saveLocationBtn = document.getElementById("saveLocationBtn");
    const locationModal = document.getElementById("locationModal");

    const prefInput = document.getElementById("prefInput");
    const cityInput = document.getElementById("cityInput");

    openLocationModalBtn?.addEventListener("click", () => {
        locationModal?.classList.remove("hidden");
    });

    closeLocationModalBtn?.addEventListener("click", () => {
        locationModal?.classList.add("hidden");
    });

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