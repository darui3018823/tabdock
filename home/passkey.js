// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.5_passkey-r3

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

async function handlePasskeyRegistration(usernameParam = null) {
    const username = usernameParam || document.getElementById("username")?.value.trim() || document.getElementById("registerUsername")?.value.trim();
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
    })
    .catch(err => {
        Swal.fire("エラー", err.message, "error");
    });
}

async function startRegistration(options, username) {
    options.publicKey.challenge = Uint8Array.from(atob(options.publicKey.challenge), c => c.charCodeAt(0));
    options.publicKey.user.id = Uint8Array.from(atob(options.publicKey.user.id), c => c.charCodeAt(0));

    const credential = await navigator.credentials.create({ publicKey: options.publicKey });

    const body = {
        username: username,
        credential: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                attestationObject: bufferToBase64url(credential.response.attestationObject),
            },
        },
    };

    await fetch("/api/webauthn/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    Swal.fire("登録完了", "パスキーが登録されました。", "success");
    return credential;
}

async function startLogin(usernameParam = null) {
    const username = usernameParam || document.getElementById("username")?.value.trim() || document.getElementById("loginUsername")?.value.trim();
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
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
            authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
            clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
            signature: bufferToBase64url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null
        }
    };

    const verify = await fetch("/api/webauthn/login/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, credential: response })
    });

    const result = await verify.json();
    if (result.success) {
        if (typeof window.onPasskeyLoginSuccess === 'function') {
            window.onPasskeyLoginSuccess({
                username: username,
                email: "",
                loginMethod: "パスキー"
            });
        } else {
            Swal.fire("ログイン成功", "パスキーで認証されました。", "success");
            if (typeof closeAccountModal === 'function') {
                closeAccountModal();
            }
        }
    } else {
        Swal.fire("失敗", result.error || "認証に失敗しました。", "error");
    }
}
