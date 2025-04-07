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
        messages[0].textContent = "あなたは何らかの問題により対象のURLへのアクセスを禁じられました。";
        messages[1].innerHTML = 'これが不服、または誤ったブロックであるという場合は、IPアドレスを添えて<a href="https://daruks.com/redirect/mailto">お問い合わせ</a>ください。';
    } else {
        messages[0].textContent = "You do not have permission to access this page.";
        messages[1].innerHTML = 'If you are unhappy with this or believe you have been blocked in error, please include your IP address and <a href="https://daruks.com/redirect/mailto">Contact Us</a>';
    }
});
