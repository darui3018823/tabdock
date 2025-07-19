// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.5_scripts-r2

document.getElementById("openAccManage").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("accountModal").classList.remove("hidden");
});
// Uint8ArrayやArrayBufferをbase64urlエンコードする関数（forループ方式で安全に変換）
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function closeAccountModal() {
    document.getElementById("accountModal").classList.add("hidden");
}

function handleRegister() {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !email || !password) {
        Swal.fire("エラー", "すべての項目を入力してください。", "error");
        return;
    }

    // 仮登録処理（ここで /api/register へ送信してもOK）
    console.log("[仮] 登録ユーザー：", { username, email, password });

    Swal.fire({
        title: "パスキーを登録しますか？",
        text: "この端末にパスワードレス認証を追加できます。",
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "登録する",
        cancelButtonText: "後で"
    }).then(result => {
        if (result.isConfirmed) {
            handlePasskeyRegistration();
        }
    });
}

function handleLogin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        Swal.fire("エラー", "ユーザー名とパスワードを入力してください。", "error");
        return;
    }

    // 仮ログイン処理（ここで /api/login へ送信してもOK）
    console.log("[仮] ログイン試行：", { username, password });

    Swal.fire("ログインしました", "（仮）通常ログイン成功", "success");
}

async function handlePasskeyRegistration() {
    const username = document.getElementById("username").value.trim();
    if (!username) {
        Swal.fire("エラー", "ユーザー名が必要です", "error");
        return;
    }

    fetch("/api/webauthn/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    })
    .then(async res => {
        if (res.status === 409) {
            const msg = await res.text();
            Swal.fire("エラー", msg, "warning");
            throw new Error(msg);
        }
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`サーバーエラー: ${msg}`);
        }
        return res.json();
    })
    .then(options => {
        if (!options || !options.publicKey) throw new Error("無効な応答: publicKey がありません");
        return startRegistration(options, username);
    })
    .then(attestation => {
        console.log("登録完了:", attestation);
        // ここで /finish へ送信など
    })
    .catch(err => {
        Swal.fire("エラー", err.message, "error");
    });
}

async function startRegistration(options, username) {
    // challenge, user.id をUint8Arrayに変換
    options.publicKey.challenge = Uint8Array.from(atob(options.publicKey.challenge), c => c.charCodeAt(0));
    options.publicKey.user.id = Uint8Array.from(atob(options.publicKey.user.id), c => c.charCodeAt(0));

    const cred = await navigator.credentials.create({ publicKey: options.publicKey });

    const attestation = {
        id: cred.id,
        rawId: bufferToBase64url(cred.rawId),
        type: cred.type,
        response: {
            clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
            attestationObject: bufferToBase64url(cred.response.attestationObject)
        }
    };

    // /finish へ送信
    await fetch("/api/webauthn/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, credential: attestation })
    });

    Swal.fire("登録完了", "パスキーが登録されました。", "success");
    return attestation;
}

async function startLogin() {
    const username = document.getElementById("username").value.trim();
    if (!username) {
        Swal.fire("エラー", "ユーザー名が必要です", "error");
        return;
    }

    const res = await fetch("/api/webauthn/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    });

    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    if (!res.ok) {
        throw new Error(`サーバーエラー (${res.status}):\n${rawText}`);
    }

    if (!contentType.includes("application/json")) {
        throw new Error(`JSONレスポンスではありません (${res.status}):\n${rawText}`);
    }

    // JSONとして解釈してみる
    let options;
    try {
        options = JSON.parse(rawText);
    } catch (e) {
        throw new Error(`JSONパース失敗:\n${rawText}`);
    }

    options.publicKey.challenge = Uint8Array.from(atob(options.publicKey.challenge), c => c.charCodeAt(0));
    options.publicKey.allowCredentials = options.publicKey.allowCredentials.map(cred => ({
        ...cred,
        id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0))
    }));

    const assertion = await navigator.credentials.get({ publicKey: options.publicKey });

    const response = {
        id: assertion.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
        type: assertion.type,
        response: {
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
            signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))),
            userHandle: assertion.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))) : null
        }
    };

    const verify = await fetch("/api/webauthn/login/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, credential: response })
    });

    const result = await verify.json();
    if (result.success) {
        Swal.fire("ログイン成功", "パスキーで認証されました。", "success");
        closeAccountModal();
    } else {
        Swal.fire("失敗", result.error || "認証に失敗しました。", "error");
    }
}
