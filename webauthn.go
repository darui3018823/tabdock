// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 3.0.0_alpha-r4

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/duo-labs/webauthn/webauthn"
	"github.com/google/uuid"
)

var (
	webAuthnInstance *webauthn.WebAuthn
	once             sync.Once
)

var challengeStore = map[string]*webauthn.SessionData{}
var db *sql.DB

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
			RPID:          "127.0.0.1",
			RPOrigin:      "https://127.0.0.1",
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
