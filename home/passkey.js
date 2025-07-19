// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.0_scripts-r2-alpha

document.getElementById("openAccManage").addEventListener("click", () => {
    document.getElementById("menuModal").classList.add("hidden");
    document.getElementById("accountModal").classList.remove("hidden");
});

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
            startRegistration();
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

async function startRegistration() {
    const username = document.getElementById("username").value.trim();
    if (!username) {
        Swal.fire("エラー", "ユーザー名が必要です", "error");
        return;
    }

    const res = await fetch("/api/webauthn/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    });
    const options = await res.json();

    options.publicKey.challenge = Uint8Array.from(atob(options.publicKey.challenge), c => c.charCodeAt(0));
    options.publicKey.user.id = Uint8Array.from(atob(options.publicKey.user.id), c => c.charCodeAt(0));

    const cred = await navigator.credentials.create({ publicKey: options.publicKey });

    const attestation = {
        id: cred.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
        type: cred.type,
        response: {
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))),
            attestationObject: btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject)))
        }
    };

    await fetch("/api/webauthn/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, credential: attestation })
    });

    Swal.fire("登録完了", "パスキーが登録されました。", "success");
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
    const options = await res.json();

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
