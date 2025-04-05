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
        messages[0].textContent = "お探しのページは存在しません。";
        messages[1].textContent = "URLを確認し、もう一度お試しください。";
        messages[2].innerHTML = '正しいURLであるのに404になる場合は入力したURLを添えて<a href="https://daruks.com/redirect/mailto">お問い合わせ</a>ください。。';
    } else {
        messages[0].textContent = "The page you are looking for does not exist.";
        messages[1].textContent = "Please check the URL and try again.";
        messages[2].innerHTML = 'If you believe this is an error, please contact us with the URL: <a href="https://daruks.com/redirect/mailto">Contact Us</a>';
    }
});
