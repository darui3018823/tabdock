// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.5-webauthn-r4

package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
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
	db, err = sql.Open("sqlite3", "./database/acc.db")
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

	// 仮ユーザー作成
	userID := uuid.New().String()
	displayName := req.Username

	user := &User{
		ID:          []byte(userID),
		Name:        req.Username,
		DisplayName: displayName,
	}

	if userExists(req.Username) {
		http.Error(w, "既に存在するユーザー名です", http.StatusConflict) // ← 409 Conflict
		return
	}

	// DBに保存
	if err := insertUser(userID, req.Username, displayName); err != nil {
		log.Println("リクエストボディ:", req.Username)
		log.Println("WebAuthnユーザー構造体:", user)
		http.Error(w, "ユーザー登録失敗", http.StatusInternalServerError)
		return
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

	var req struct {
		Username   string                                `json:"username"`
		Credential protocol.ParsedCredentialCreationData `json:"credential"`
	}
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		fmt.Println("[ERROR] Unmarshal失敗:", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if req.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	user, err := FindWebAuthnUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := challengeStore[req.Username]
	if !ok {
		http.Error(w, "Session data not found", http.StatusBadRequest)
		return
	}

	// r.Body を credential 情報ごと復元
	r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	credential, err := webAuthnInstance.FinishRegistration(user, *sessionData, r)
	if err != nil {
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

func FindWebAuthnUserByUsername(username string) (*User, error) {
	fmt.Printf("[DEBUG] 入力された username: %q\n", username)

	dbPath, _ := filepath.Abs("database/acc.db")
	fmt.Println("[DEBUG] 使用しているDBファイル:", dbPath)

	db, err := sql.Open("sqlite3", dbPath)
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

	var req struct {
		Username   string                                 `json:"username"`
		Credential protocol.ParsedCredentialAssertionData `json:"credential"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	user, err := FindWebAuthnUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := loginSessionStore[req.Username]
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
