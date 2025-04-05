document.addEventListener("DOMContentLoaded", function () {
    // ユーザーのブラウザ言語を取得
    let userLang = navigator.language || navigator.userLanguage;

    // タイムゾーン情報を取得（参考程度）
    let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 日本語かどうかの判定（"ja" で始まるなら日本語とする）
    let isJapanese = userLang.startsWith("ja") || timeZone.includes("Tokyo");

    // メッセージを書き換え
    const messages = document.querySelectorAll(".message");

    if (isJapanese) {
        messages[0].textContent = "現在、このページはメンテナンス中の可能性があります。";
        messages[1].textContent = "メンテナンスが完了しましたら、再度アクセスしてください。";
        messages[2].innerHTML = 'メンテナンスの詳細については、<a href="https://bot.daruks.com/thisisbot/status">こちらのページ</a>をご覧ください。';
    } else {
        messages[0].textContent = "This page may currently be undergoing maintenance.";
        messages[1].textContent = "Please try accessing it again once maintenance is complete.";
        messages[2].innerHTML = 'For more details on maintenance, visit <a href="https://bot.daruks.com/thisisbot/status">this page</a>.';
    }
});
