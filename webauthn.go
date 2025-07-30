// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.5-webauthn-r5

package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"github.com/duo-labs/webauthn/protocol"
	"github.com/duo-labs/webauthn/webauthn"
	"github.com/google/uuid"
)

var (
	webAuthnInstance *webauthn.WebAuthn
	once             sync.Once
)

var challengeStore = map[string]*webauthn.SessionData{}
var db *sql.DB
var loginSessionStore = map[string]*webauthn.SessionData{}

// base64urlデコード用ヘルパー関数
func base64URLDecode(s string) ([]byte, error) {
	// base64url → base64 変換
	s = strings.ReplaceAll(s, "-", "+")
	s = strings.ReplaceAll(s, "_", "/")
	// パディング追加
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.StdEncoding.DecodeString(s)
}

type User struct {
	ID          []byte
	Name        string
	DisplayName string
}

type DBUser struct {
	ID          string
	Username    string
	DisplayName string
}

func (u User) WebAuthnID() []byte                         { return u.ID }
func (u User) WebAuthnName() string                       { return u.Name }
func (u User) WebAuthnDisplayName() string                { return u.DisplayName }
func (u User) WebAuthnIcon() string                       { return "" }
func (u User) WebAuthnCredentials() []webauthn.Credential { return []webauthn.Credential{} }

type WebAuthnUser struct {
	ID          []byte
	Name        string
	DisplayName string
	Credentials []webauthn.Credential
}

func (u WebAuthnUser) WebAuthnID() []byte                         { return u.ID }
func (u WebAuthnUser) WebAuthnName() string                       { return u.Name }
func (u WebAuthnUser) WebAuthnDisplayName() string                { return u.DisplayName }
func (u WebAuthnUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }
func (u WebAuthnUser) WebAuthnIcon() string                       { return "" }

func DBUserToUser(dbUser DBUser) *User {
	return &User{
		ID:          []byte(dbUser.ID),
		Name:        dbUser.Username,
		DisplayName: dbUser.DisplayName,
	}
}

func initDB() error {
	var err error
	db, err = sql.Open("sqlite", "./database/acc.db")
	if err != nil {
		return err
	}

	// 初回のみ実行（CREATE TABLE IF NOT EXISTS）
	query := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE,
		display_name TEXT,
		credential_id TEXT,
		credential_public_key TEXT,
		sign_count INTEGER
	);`
	_, err = db.Exec(query)
	return err
}

func insertUser(id, username, displayName string) error {
	_, err := db.Exec("INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)",
		id, username, displayName)
	if err != nil {
		log.Printf("ユーザー登録失敗: %v", err)
	}
	return err
}

// ユーザーが既に存在するか確認
func userExists(username string) bool {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	return err == nil && count > 0
}

func initWebAuthn() {
	once.Do(func() {
		var err error
		webAuthnInstance, err = webauthn.New(&webauthn.Config{
			RPDisplayName: "Tabdock",
			RPID:          "tabdock.daruks.com",
			RPOrigin:      "https://tabdock.daruks.com",
		})
		if err != nil {
			log.Fatalf("WebAuthn init failed: %v", err)
		}
	})
}

func HandleWebAuthnRegisterStart(w http.ResponseWriter, r *http.Request) {
	initWebAuthn()

	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// ユーザーが既に存在するかチェック
	var user *User
	if userExists(req.Username) {
		// 既存ユーザーを取得
		existingUser, err := FindUserByUsername(req.Username)
		if err != nil {
			http.Error(w, "Failed to find existing user", http.StatusInternalServerError)
			return
		}
		user = existingUser
		fmt.Println("[DEBUG] 既存ユーザーに新しいパスキー追加:", req.Username)
	} else {
		// 新規ユーザー作成
		userID := uuid.New().String()
		displayName := req.Username

		user = &User{
			ID:          []byte(userID),
			Name:        req.Username,
			DisplayName: displayName,
		}

		// DBに保存
		if err := insertUser(userID, req.Username, displayName); err != nil {
			log.Println("リクエストボディ:", req.Username)
			log.Println("WebAuthnユーザー構造体:", user)
			http.Error(w, "ユーザー登録失敗", http.StatusInternalServerError)
			return
		}
		fmt.Println("[DEBUG] 新規ユーザー作成:", req.Username)
	}

	// WebAuthn開始
	options, sessionData, err := webAuthnInstance.BeginRegistration(user)
	if err != nil {
		http.Error(w, "Failed to begin registration", http.StatusInternalServerError)
		return
	}

	challengeStore[req.Username] = sessionData

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

func HandleWebAuthnRegisterFinish(w http.ResponseWriter, r *http.Request) {
	initWebAuthn()

	bodyBytes, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	fmt.Println("[DEBUG] body:", string(bodyBytes))

	// カスタム構造体でbase64urlデータを受信
	var rawReq struct {
		Username   string `json:"username"`
		Credential struct {
			ID       string `json:"id"`
			RawID    string `json:"rawId"`
			Type     string `json:"type"`
			Response struct {
				ClientDataJSON    string `json:"clientDataJSON"`
				AttestationObject string `json:"attestationObject"`
			} `json:"response"`
		} `json:"credential"`
	}

	if err := json.Unmarshal(bodyBytes, &rawReq); err != nil {
		fmt.Println("[ERROR] Unmarshal失敗:", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if rawReq.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// base64urlデコード
	rawID, err := base64URLDecode(rawReq.Credential.RawID)
	if err != nil {
		fmt.Println("[ERROR] RawID decode失敗:", err)
		http.Error(w, "Invalid rawId", http.StatusBadRequest)
		return
	}

	clientDataJSON, err := base64URLDecode(rawReq.Credential.Response.ClientDataJSON)
	if err != nil {
		fmt.Println("[ERROR] ClientDataJSON decode失敗:", err)
		http.Error(w, "Invalid clientDataJSON", http.StatusBadRequest)
		return
	}

	attestationObject, err := base64URLDecode(rawReq.Credential.Response.AttestationObject)
	if err != nil {
		fmt.Println("[ERROR] AttestationObject decode失敗:", err)
		http.Error(w, "Invalid attestationObject", http.StatusBadRequest)
		return
	}

	// 標準的なWebAuthnフォーマットに変換してからJSONに戻す
	// WebAuthn仕様に従った正確な形式で構築
	standardReq := map[string]interface{}{
		"id":    rawReq.Credential.ID,
		"rawId": base64.StdEncoding.EncodeToString(rawID),
		"type":  rawReq.Credential.Type,
		"response": map[string]interface{}{
			"clientDataJSON":    base64.StdEncoding.EncodeToString(clientDataJSON),
			"attestationObject": base64.StdEncoding.EncodeToString(attestationObject),
		},
	}

	standardReqBytes, err := json.Marshal(standardReq)
	if err != nil {
		fmt.Println("[ERROR] 標準形式への変換失敗:", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	fmt.Println("[DEBUG] 変換後のリクエスト:", string(standardReqBytes))

	// WebAuthnライブラリ用にHTTPリクエストを再構築
	// Content-Typeも設定
	newRequest, err := http.NewRequest("POST", r.URL.String(), bytes.NewReader(standardReqBytes))
	if err != nil {
		fmt.Println("[ERROR] リクエスト再構築失敗:", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	newRequest.Header.Set("Content-Type", "application/json")

	// 元のリクエストのヘッダーをコピー
	for key, values := range r.Header {
		if key != "Content-Length" { // Content-Lengthは自動で設定される
			for _, value := range values {
				newRequest.Header.Add(key, value)
			}
		}
	}

	user, err := FindUserByUsername(rawReq.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := challengeStore[rawReq.Username]
	if !ok {
		http.Error(w, "Session data not found", http.StatusBadRequest)
		return
	}

	fmt.Printf("[DEBUG] セッションデータ: %+v\n", sessionData)
	fmt.Printf("[DEBUG] ユーザー情報: %+v\n", user)

	// まずprotocolレベルでパースを試行してエラー詳細を取得
	parsedCred, parseErr := protocol.ParseCredentialCreationResponseBody(bytes.NewReader(standardReqBytes))
	if parseErr != nil {
		fmt.Printf("[ERROR] プロトコルパース失敗: %v\n", parseErr)
		// パースエラーの詳細を表示
		fmt.Printf("[ERROR] パースしようとしたデータ: %s\n", string(standardReqBytes))
	} else {
		fmt.Printf("[DEBUG] プロトコルパース成功: %+v\n", parsedCred)
	}

	// FinishRegistrationを実行（newRequestを使用）
	credential, err := webAuthnInstance.FinishRegistration(user, *sessionData, newRequest)
	if err != nil {
		fmt.Printf("[ERROR] FinishRegistration失敗: %v\n", err)
		http.Error(w, fmt.Sprintf("Failed to finish registration: %v", err), http.StatusInternalServerError)
		return
	}

	if err := saveCredentialToDB(user.WebAuthnName(), credential); err != nil {
		http.Error(w, "保存失敗", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func saveCredentialToDB(username string, cred *webauthn.Credential) error {
	_, err := db.Exec(`UPDATE users SET credential_id=?, credential_public_key=?, sign_count=? WHERE username=?`,
		string(cred.ID),
		string(cred.PublicKey),
		int(cred.Authenticator.SignCount),
		username)
	return err
}

func HandleWebAuthnLoginStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	user, err := FindWebAuthnUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	options, sessionData, err := webAuthnInstance.BeginLogin(user)
	if err != nil {
		http.Error(w, "Failed to begin login", http.StatusInternalServerError)
		return
	}

	SaveSessionData(req.Username, sessionData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

func SaveSessionData(username string, data *webauthn.SessionData) {
	loginSessionStore[username] = data
}

// WebAuthnユーザーを取得（credentialも含む）
func FindWebAuthnUserByUsername(username string) (*WebAuthnUser, error) {
	fmt.Printf("[DEBUG] 入力された username: %q\n", username)

	dbPath, _ := filepath.Abs("database/acc.db")
	fmt.Println("[DEBUG] 使用しているDBファイル:", dbPath)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Println("[ERROR] DB接続失敗:", err)
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, username FROM users")
	if err == nil {
		fmt.Println("[DEBUG] 現在登録されているユーザー:")
		for rows.Next() {
			var id, uname string
			rows.Scan(&id, &uname)
			fmt.Printf(" - id: %s / username: %q\n", id, uname)
		}
		rows.Close()
	}

	var dbUser struct {
		ID               string
		Username         string
		DisplayName      string
		CredentialID     sql.NullString
		CredentialPubKey sql.NullString
		SignCount        sql.NullInt64
	}

	row := db.QueryRow("SELECT id, username, display_name, credential_id, credential_public_key, sign_count FROM users WHERE username = ?", username)
	err = row.Scan(&dbUser.ID, &dbUser.Username, &dbUser.DisplayName, &dbUser.CredentialID, &dbUser.CredentialPubKey, &dbUser.SignCount)
	if err != nil {
		fmt.Println("[WARN] 該当ユーザーが見つかりませんでした")
		return nil, err
	}

	fmt.Println("[DEBUG] ユーザー見つかりました:", dbUser.Username)

	// WebAuthnUserを構築
	user := &WebAuthnUser{
		ID:          []byte(dbUser.ID),
		Name:        dbUser.Username,
		DisplayName: dbUser.DisplayName,
		Credentials: []webauthn.Credential{},
	}

	// 既存のcredentialがあれば追加
	if dbUser.CredentialID.Valid && dbUser.CredentialPubKey.Valid {
		cred := webauthn.Credential{
			ID:        []byte(dbUser.CredentialID.String),
			PublicKey: []byte(dbUser.CredentialPubKey.String),
		}
		if dbUser.SignCount.Valid {
			cred.Authenticator.SignCount = uint32(dbUser.SignCount.Int64)
		}
		user.Credentials = append(user.Credentials, cred)
		fmt.Printf("[DEBUG] 既存credential追加: ID=%s\n", dbUser.CredentialID.String)
	}

	return user, nil
}

// 元のUser型取得関数（登録時用）
func FindUserByUsername(username string) (*User, error) {
	fmt.Printf("[DEBUG] 入力された username: %q\n", username)

	dbPath, _ := filepath.Abs("database/acc.db")
	fmt.Println("[DEBUG] 使用しているDBファイル:", dbPath)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Println("[ERROR] DB接続失敗:", err)
		return nil, err
	}
	defer db.Close()

	var dbUser DBUser
	row := db.QueryRow("SELECT id, username, display_name FROM users WHERE username = ?", username)
	err = row.Scan(&dbUser.ID, &dbUser.Username, &dbUser.DisplayName)
	if err != nil {
		fmt.Println("[WARN] 該当ユーザーが見つかりませんでした")
		return nil, err
	}

	fmt.Println("[DEBUG] ユーザー見つかりました:", dbUser.Username)
	return DBUserToUser(dbUser), nil
}

func HandleWebAuthnLoginFinish(w http.ResponseWriter, r *http.Request) {
	initWebAuthn()

	bodyBytes, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	fmt.Println("[DEBUG] login body:", string(bodyBytes))

	// カスタム構造体でbase64urlデータを受信
	var rawReq struct {
		Username   string `json:"username"`
		Credential struct {
			ID       string `json:"id"`
			RawID    string `json:"rawId"`
			Type     string `json:"type"`
			Response struct {
				AuthenticatorData string  `json:"authenticatorData"`
				ClientDataJSON    string  `json:"clientDataJSON"`
				Signature         string  `json:"signature"`
				UserHandle        *string `json:"userHandle"`
			} `json:"response"`
		} `json:"credential"`
	}

	if err := json.Unmarshal(bodyBytes, &rawReq); err != nil {
		fmt.Println("[ERROR] Login Unmarshal失敗:", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// base64urlデコード
	rawID, err := base64URLDecode(rawReq.Credential.RawID)
	if err != nil {
		fmt.Println("[ERROR] Login RawID decode失敗:", err)
		http.Error(w, "Invalid rawId", http.StatusBadRequest)
		return
	}

	clientDataJSON, err := base64URLDecode(rawReq.Credential.Response.ClientDataJSON)
	if err != nil {
		fmt.Println("[ERROR] Login ClientDataJSON decode失敗:", err)
		http.Error(w, "Invalid clientDataJSON", http.StatusBadRequest)
		return
	}

	authenticatorData, err := base64URLDecode(rawReq.Credential.Response.AuthenticatorData)
	if err != nil {
		fmt.Println("[ERROR] Login AuthenticatorData decode失敗:", err)
		http.Error(w, "Invalid authenticatorData", http.StatusBadRequest)
		return
	}

	signature, err := base64URLDecode(rawReq.Credential.Response.Signature)
	if err != nil {
		fmt.Println("[ERROR] Login Signature decode失敗:", err)
		http.Error(w, "Invalid signature", http.StatusBadRequest)
		return
	}

	var userHandle []byte
	if rawReq.Credential.Response.UserHandle != nil {
		userHandle, err = base64URLDecode(*rawReq.Credential.Response.UserHandle)
		if err != nil {
			fmt.Println("[ERROR] Login UserHandle decode失敗:", err)
			http.Error(w, "Invalid userHandle", http.StatusBadRequest)
			return
		}
	}

	// 標準的なWebAuthnフォーマットに変換
	standardReq := map[string]interface{}{
		"id":    rawReq.Credential.ID,
		"rawId": base64.StdEncoding.EncodeToString(rawID),
		"type":  rawReq.Credential.Type,
		"response": map[string]interface{}{
			"authenticatorData": base64.StdEncoding.EncodeToString(authenticatorData),
			"clientDataJSON":    base64.StdEncoding.EncodeToString(clientDataJSON),
			"signature":         base64.StdEncoding.EncodeToString(signature),
		},
	}

	if userHandle != nil {
		standardReq["response"].(map[string]interface{})["userHandle"] = base64.StdEncoding.EncodeToString(userHandle)
	}

	standardReqBytes, err := json.Marshal(standardReq)
	if err != nil {
		fmt.Println("[ERROR] Login 標準形式への変換失敗:", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// 新しいリクエストボディでHTTPリクエストを再構成
	r.Body = io.NopCloser(bytes.NewReader(standardReqBytes))

	user, err := FindWebAuthnUserByUsername(rawReq.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := loginSessionStore[rawReq.Username]
	if !ok {
		http.Error(w, "Session data not found", http.StatusBadRequest)
		return
	}

	// 認証処理
	_, err = webAuthnInstance.FinishLogin(user, *sessionData, r)

	if err != nil {
		log.Println("Login failed:", err)
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%s"}`, err.Error()), http.StatusUnauthorized)
		return
	}

	// 成功時のレスポンス
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}
