// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

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
        "strings"
        "sync"
        "time"
        "unicode"

	"github.com/duo-labs/webauthn/protocol"
	"github.com/duo-labs/webauthn/webauthn"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

var (
	db     *sql.DB
	dbPath = "./database/acc.db"
)

// WebAuthn関連の変数
var (
	webAuthnInstance *webauthn.WebAuthn
	once             sync.Once
)

var challengeStore = map[string]*webauthn.SessionData{}
var loginSessionStore = map[string]*webauthn.SessionData{}

// 構造体定義
type AuthRequest struct {
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	User    interface{} `json:"user,omitempty"`
}

type AuthUser struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	Password     string    `json:"-"` // JSONには含めない
	ProfileImage string    `json:"profile_image,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	LoginAt      int64     `json:"login_at"`
}

// WebAuthn用のUser構造体
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

// ===== データベース初期化・操作関数 =====

func initDB() error {
	var err error

	// データベース接続を開く
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Printf("データベース接続エラー: %v", err)
		return err
	}

	// 接続確認
	if err = db.Ping(); err != nil {
		log.Printf("データベース接続確認エラー: %v", err)
		return err
	}

	// テーブル作成（通常認証とパスキー認証の両方をサポート）
	query := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE,
		display_name TEXT,
		email TEXT,
		password TEXT,
		profile_image TEXT,
		credential_id TEXT,
		credential_public_key TEXT,
		sign_count INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	_, err = db.Exec(query)
	if err != nil {
		log.Printf("テーブル作成エラー: %v", err)
		return err
	}

	// 既存のテーブルに不足している列があれば追加
	err = addMissingColumns()
	if err != nil {
		log.Printf("カラム追加エラー: %v", err)
		return err
	}

	log.Println("Database initialized successfully.")
	return nil
}

// 不足している列を追加する関数
func addMissingColumns() error {
	// 必要な列のリスト
	requiredColumns := []string{
		"email TEXT",
		"password TEXT",
		"profile_image TEXT",
		"created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
		"updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
	}

	for _, column := range requiredColumns {
		columnName := strings.Split(column, " ")[0]

		// 列が存在するかチェック
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = ?", columnName).Scan(&count)
		if err != nil {
			continue // エラーは無視して次に進む
		}

		if count == 0 {
			// 列が存在しない場合は追加
			alterQuery := fmt.Sprintf("ALTER TABLE users ADD COLUMN %s", column)
			_, err = db.Exec(alterQuery)
			if err != nil {
				log.Printf("列追加エラー (%s): %v", columnName, err)
			} else {
				log.Printf("列を追加しました: %s", columnName)
			}
		}
	}

	// NULL値のタイムスタンプを更新
	db.Exec("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
	db.Exec("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")

	return nil
}

func insertUser(id, username, displayName string) error {
	_, err := db.Exec("INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)",
		id, username, displayName)
	if err != nil {
		log.Printf("ユーザー登録失敗: %v", err)
	}
	return err
}

// ===== 通常認証用のヘルパー関数 =====

func hashPassword(password string) string {
        // 簡単なハッシュ化（本番では更に強力なハッシュを使用）
        return password // 仮実装
}

func validatePasswordStrength(password string) error {
        if len(password) < 8 {
                return fmt.Errorf("パスワードは8文字以上で入力してください")
        }

        var hasUpper, hasLower, hasDigit bool
        for _, r := range password {
                switch {
                case unicode.IsUpper(r):
                        hasUpper = true
                case unicode.IsLower(r):
                        hasLower = true
                case unicode.IsDigit(r):
                        hasDigit = true
                }
        }

        if !hasUpper || !hasLower || !hasDigit {
                return fmt.Errorf("大文字・小文字・数字をそれぞれ1文字以上含めてください")
        }

        return nil
}

// SQLiteの日時文字列をtime.Timeに変換
func parseSQLiteTime(timeStr string) (time.Time, error) {
	// SQLiteの日時フォーマットのパターンを試行
	formats := []string{
		"2006-01-02 15:04:05",      // DATETIME
		"2006-01-02T15:04:05Z",     // ISO 8601
		"2006-01-02T15:04:05.000Z", // ISO 8601 with milliseconds
		"2006-01-02 15:04:05.000",  // DATETIME with milliseconds
		time.RFC3339,               // RFC3339
		time.RFC3339Nano,           // RFC3339 with nanoseconds
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t, nil
		}
	}

	// 全てのフォーマットで失敗した場合
	return time.Time{}, fmt.Errorf("unsupported time format: %s", timeStr)
}

// 通常認証用ユーザー作成
func createAuthUser(username, email, password string) (*AuthUser, error) {
	if db == nil {
		log.Printf("[ERROR] データベース接続がありません")
		return nil, fmt.Errorf("データベース接続がありません")
	}

	hashedPassword := hashPassword(password)
	userID := uuid.New().String()
	now := time.Now()

	query := `INSERT INTO users (id, username, display_name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := db.Exec(query, userID, username, username, email, hashedPassword, now.Format("2006-01-02 15:04:05"), now.Format("2006-01-02 15:04:05"))
	if err != nil {
		log.Printf("[ERROR] ユーザー作成エラー: %v", err)
		return nil, err
	}

	log.Printf("[DEBUG] ユーザー作成成功: %s", username)
	return &AuthUser{
		ID:        0, // SQLiteでは自動採番ではないため
		Username:  username,
		Email:     email,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// 通常認証
func authenticateAuthUser(username, password string) (*AuthUser, error) {
        if db == nil {
                log.Printf("[ERROR] データベース接続がありません")
                return nil, fmt.Errorf("データベース接続がありません")
        }

	hashedPassword := hashPassword(password)

	query := `SELECT username, COALESCE(email, ''), COALESCE(profile_image, ''),
			COALESCE(created_at, CURRENT_TIMESTAMP), 
			COALESCE(updated_at, CURRENT_TIMESTAMP) 
			FROM users WHERE username = ? AND password = ?`
	row := db.QueryRow(query, username, hashedPassword)

	var user AuthUser
	var createdAtStr, updatedAtStr string
	err := row.Scan(&user.Username, &user.Email, &user.ProfileImage, &createdAtStr, &updatedAtStr)
	if err != nil {
		log.Printf("[ERROR] 認証エラー: %v", err)
		return nil, err
	}

	// ログイン時刻を設定
	user.LoginAt = time.Now().Unix()

	// 文字列をtime.Timeに変換
	user.CreatedAt, err = parseSQLiteTime(createdAtStr)
	if err != nil {
		// パースに失敗した場合は現在時刻を使用
		user.CreatedAt = time.Now()
		log.Printf("[WARN] created_at パース失敗、現在時刻を使用: %v", err)
	}

	user.UpdatedAt, err = parseSQLiteTime(updatedAtStr)
	if err != nil {
		// パースに失敗した場合は現在時刻を使用
		user.UpdatedAt = time.Now()
		log.Printf("[WARN] updated_at パース失敗、現在時刻を使用: %v", err)
	}

        log.Printf("[DEBUG] 認証成功: %s", username)
        return &user, nil
}

func updateAuthUserPassword(username, newPassword string) error {
        if db == nil {
                return fmt.Errorf("データベース接続がありません")
        }

        hashed := hashPassword(newPassword)
        res, err := db.Exec("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?", hashed, username)
        if err != nil {
                return err
        }

        affected, err := res.RowsAffected()
        if err == nil && affected == 0 {
                return sql.ErrNoRows
        }

        return err
}

// ユーザー名でユーザー情報を取得（AuthUser型）
func getUserByUsername(username string) (*AuthUser, error) {
	if db == nil {
		return nil, fmt.Errorf("データベース接続がありません")
	}

	query := `SELECT username, COALESCE(email, ''), COALESCE(profile_image, ''),
			COALESCE(created_at, CURRENT_TIMESTAMP), 
			COALESCE(updated_at, CURRENT_TIMESTAMP) 
			FROM users WHERE username = ?`
	row := db.QueryRow(query, username)

	var user AuthUser
	var createdAtStr, updatedAtStr string
	err := row.Scan(&user.Username, &user.Email, &user.ProfileImage, &createdAtStr, &updatedAtStr)
	if err != nil {
		return nil, err
	}

	// 文字列をtime.Timeに変換
	user.CreatedAt, err = parseSQLiteTime(createdAtStr)
	if err != nil {
		user.CreatedAt = time.Now()
	}

	user.UpdatedAt, err = parseSQLiteTime(updatedAtStr)
	if err != nil {
		user.UpdatedAt = time.Now()
	}

	user.LoginAt = time.Now().Unix()
	return &user, nil
}

// プロフィール画像のパスをデータベースに保存
func updateUserProfileImage(username, imagePath string) error {
	if db == nil {
		return fmt.Errorf("データベース接続がありません")
	}

	query := `UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?`
	_, err := db.Exec(query, imagePath, username)
	if err != nil {
		log.Printf("[ERROR] プロフィール画像更新エラー: %v", err)
		return err
	}

	log.Printf("[INFO] プロフィール画像を更新しました: %s -> %s", username, imagePath)
	return nil
}

// ユーザー存在チェック（通常認証用）
func authUserExists(username, email string) (bool, error) {
	if db == nil {
		log.Printf("[ERROR] データベース接続がありません")
		return false, fmt.Errorf("データベース接続がありません")
	}

	query := `SELECT COUNT(*) FROM users WHERE username = ? OR email = ?`
	var count int
	err := db.QueryRow(query, username, email).Scan(&count)
	if err != nil {
		log.Printf("[ERROR] ユーザー存在チェックエラー: %v", err)
		return false, err
	}

	log.Printf("[DEBUG] ユーザー存在チェック: %s/%s -> count: %d", username, email, count)
	return count > 0, nil
}

// ユーザーが既に存在するか確認（WebAuthn用）
func userExists(username string) bool {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	return err == nil && count > 0
}

// ===== WebAuthn関連のヘルパー関数 =====

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

func saveCredentialToDB(username string, cred *webauthn.Credential) error {
	_, err := db.Exec(`UPDATE users SET credential_id=?, credential_public_key=?, sign_count=? WHERE username=?`,
		string(cred.ID),
		string(cred.PublicKey),
		int(cred.Authenticator.SignCount),
		username)
	return err
}

func SaveSessionData(username string, data *webauthn.SessionData) {
	loginSessionStore[username] = data
}

// WebAuthnユーザーを取得（credentialも含む）
func FindWebAuthnUserByUsername(username string) (*WebAuthnUser, error) {
	fmt.Printf("[DEBUG] 入力された username: %q\n", username)

	if db == nil {
		return nil, fmt.Errorf("データベース接続がありません")
	}

	// デバッグ用：現在登録されているユーザー一覧を表示
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
		fmt.Printf("[WARN] 該当ユーザーが見つかりませんでした: %v\n", err)
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

	if db == nil {
		return nil, fmt.Errorf("データベース接続がありません")
	}

	var dbUser DBUser
	row := db.QueryRow("SELECT id, username, display_name FROM users WHERE username = ?", username)
	err := row.Scan(&dbUser.ID, &dbUser.Username, &dbUser.DisplayName)
	if err != nil {
		fmt.Printf("[WARN] 該当ユーザーが見つかりませんでした: %v\n", err)
		return nil, err
	}

	fmt.Println("[DEBUG] ユーザー見つかりました:", dbUser.Username)
	return DBUserToUser(dbUser), nil
}

// ===== 通常認証APIハンドラ =====

// 通常ログインハンドラ
func handleAuthLogin(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 入力検証
	if req.Username == "" || req.Password == "" {
		response := AuthResponse{
			Success: false,
			Message: "ユーザー名とパスワードが必要です",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// データベース認証
	user, err := authenticateAuthUser(req.Username, req.Password)
	if err != nil {
		response := AuthResponse{
			Success: false,
			Message: "ユーザー名またはパスワードが間違っています",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(response)
		return
	}

	response := AuthResponse{
		Success: true,
		Message: "ログイン成功",
		User: map[string]interface{}{
			"username":     user.Username,
			"email":        user.Email,
			"profileImage": user.ProfileImage,
			"loginAt":      time.Now().Unix(),
		},
	}
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(response)
}

func handleAuthChangePassword(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        var req struct {
                Username        string `json:"username"`
                CurrentPassword string `json:"currentPassword"`
                NewPassword     string `json:"newPassword"`
        }

        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                http.Error(w, "Invalid JSON", http.StatusBadRequest)
                return
        }

        req.Username = strings.TrimSpace(req.Username)

        if req.Username == "" || req.CurrentPassword == "" || req.NewPassword == "" {
                http.Error(w, "必須項目が不足しています", http.StatusBadRequest)
                return
        }

        if req.CurrentPassword == req.NewPassword {
                http.Error(w, "新しいパスワードが現在のパスワードと同じです", http.StatusBadRequest)
                return
        }

        if err := validatePasswordStrength(req.NewPassword); err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
        }

        if _, err := authenticateAuthUser(req.Username, req.CurrentPassword); err != nil {
                http.Error(w, "現在のパスワードが正しくありません", http.StatusUnauthorized)
                return
        }

        if err := updateAuthUserPassword(req.Username, req.NewPassword); err != nil {
                if err == sql.ErrNoRows {
                        http.Error(w, "ユーザーが見つかりません", http.StatusNotFound)
                        return
                }
                log.Printf("[ERROR] パスワード更新失敗: %v", err)
                http.Error(w, "パスワード更新に失敗しました", http.StatusInternalServerError)
                return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
                "success": true,
                "message": "パスワードを更新しました",
        })
}

// 通常登録ハンドラ
func handleAuthRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 入力検証
	if req.Username == "" || req.Email == "" || req.Password == "" {
		response := AuthResponse{
			Success: false,
			Message: "すべての項目を入力してください",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// パスワード強度チェック
	if len(req.Password) < 6 {
		response := AuthResponse{
			Success: false,
			Message: "パスワードは6文字以上で入力してください",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// ユーザー存在チェック
	exists, err := authUserExists(req.Username, req.Email)
	if err != nil {
		log.Printf("[ERROR] ユーザー存在チェック失敗: %v", err)
		response := AuthResponse{
			Success: false,
			Message: "データベースエラーが発生しました",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	if exists {
		response := AuthResponse{
			Success: false,
			Message: "ユーザー名またはメールアドレスが既に使用されています",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// ユーザー作成
	user, err := createAuthUser(req.Username, req.Email, req.Password)
	if err != nil {
		log.Printf("ユーザー作成エラー: %v", err)
		response := AuthResponse{
			Success: false,
			Message: "アカウント作成に失敗しました",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("新規ユーザー登録: %s (%s)", req.Username, req.Email)

	response := AuthResponse{
		Success: true,
		Message: "アカウントが正常に作成されました",
		User: map[string]interface{}{
			"username":   user.Username,
			"email":      user.Email,
			"registerId": time.Now().Unix(),
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ===== WebAuthn APIハンドラ =====

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
