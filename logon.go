// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/duo-labs/webauthn/protocol"
	"github.com/duo-labs/webauthn/webauthn"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var (
	db     *sql.DB
	dbPath = getEnv("DB_ACC_PATH", "./database/acc.db")
)

const (
	sessionCookieName  = "tabdock_session"
	deviceIDCookieName = "tabdock_device_id"
	restoreTokenName   = "tabdock_restore"
)

// WebAuthn関連の変数
var (
	webAuthnInstance *webauthn.WebAuthn
	once             sync.Once
)

var (
	sessionSecretOnce sync.Once
	sessionSecret     []byte
	sessionTTLOnce    sync.Once
	sessionTTL        = 24 * time.Hour
	restoreTTLOnce    sync.Once
	restoreTTL        = 30 * 24 * time.Hour
)

type webAuthnSession struct {
	data      *webauthn.SessionData
	expiresAt time.Time
}

var challengeStore = map[string]webAuthnSession{}
var challengeStoreMu sync.Mutex
var loginSessionStore = map[string]webAuthnSession{}
var loginSessionStoreMu sync.Mutex
var webAuthnSessionTTL = 5 * time.Minute

// AuthRequest is the request payload for auth endpoints.
type AuthRequest struct {
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Password string `json:"password"`
}

// AuthResponse is the standard auth API response.
type AuthResponse struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message,omitempty"`
	User         interface{} `json:"user,omitempty"`
	RestoreToken string      `json:"restoreToken,omitempty"`
}

// AuthUser represents a database user record for auth APIs.
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

// User is the WebAuthn user used for registration.
type User struct {
	ID          []byte
	Name        string
	DisplayName string
}

// DBUser represents the database user record for WebAuthn.
type DBUser struct {
	ID          string
	Username    string
	DisplayName string
}

// WebAuthnID returns the binary user ID.
func (u User) WebAuthnID() []byte { return u.ID }

// WebAuthnName returns the username.
func (u User) WebAuthnName() string { return u.Name }

// WebAuthnDisplayName returns the display name.
func (u User) WebAuthnDisplayName() string { return u.DisplayName }

// WebAuthnIcon returns the user icon URL (unused).
func (u User) WebAuthnIcon() string { return "" }

// WebAuthnCredentials returns stored credentials (none for registration).
func (u User) WebAuthnCredentials() []webauthn.Credential { return []webauthn.Credential{} }

// WebAuthnUser holds a WebAuthn user with credentials.
type WebAuthnUser struct {
	ID          []byte
	Name        string
	DisplayName string
	Credentials []webauthn.Credential
}

// WebAuthnID returns the binary user ID.
func (u WebAuthnUser) WebAuthnID() []byte { return u.ID }

// WebAuthnName returns the username.
func (u WebAuthnUser) WebAuthnName() string { return u.Name }

// WebAuthnDisplayName returns the display name.
func (u WebAuthnUser) WebAuthnDisplayName() string { return u.DisplayName }

// WebAuthnCredentials returns stored credentials.
func (u WebAuthnUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }

// WebAuthnIcon returns the user icon URL (unused).
func (u WebAuthnUser) WebAuthnIcon() string { return "" }

// DBUserToUser converts a DBUser into a WebAuthn User.
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
	if _, err := db.Exec("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"); err != nil {
		log.Printf("ユーザー作成日時更新エラー: %v", err)
	}
	if _, err := db.Exec("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"); err != nil {
		log.Printf("ユーザー更新日時更新エラー: %v", err)
	}

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

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func randomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return b, nil
}

func getSessionSecret() []byte {
	sessionSecretOnce.Do(func() {
		if raw := strings.TrimSpace(getEnv("SESSION_SECRET", "")); raw != "" {
			sessionSecret = []byte(raw)
			return
		}

		randomSecret, err := randomBytes(32)
		if err != nil {
			sessionSecret = []byte(uuid.NewString())
			log.Printf("[WARN] SESSION_SECRETの生成に失敗したためフォールバックを使用します: %v", err)
			return
		}
		sessionSecret = randomSecret
		log.Println("[WARN] SESSION_SECRET未設定のため一時キーを生成しました。再起動でセッションは失効します")
	})
	return sessionSecret
}

func getSessionTTL() time.Duration {
	sessionTTLOnce.Do(func() {
		raw := strings.TrimSpace(getEnv("SESSION_TTL_HOURS", "24"))
		hours, err := strconv.Atoi(raw)
		if err != nil || hours <= 0 {
			sessionTTL = 24 * time.Hour
			return
		}
		sessionTTL = time.Duration(hours) * time.Hour
	})
	return sessionTTL
}

func getRestoreTokenTTL() time.Duration {
	restoreTTLOnce.Do(func() {
		raw := strings.TrimSpace(getEnv("RESTORE_TOKEN_TTL_DAYS", "30"))
		days, err := strconv.Atoi(raw)
		if err != nil || days <= 0 {
			restoreTTL = 30 * 24 * time.Hour
			return
		}
		restoreTTL = time.Duration(days) * 24 * time.Hour
	})
	return restoreTTL
}

func shouldUseSecureCookie(r *http.Request) bool {
	switch strings.ToLower(strings.TrimSpace(getEnv("COOKIE_SECURE", "auto"))) {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	default:
		if r.TLS != nil {
			return true
		}
		return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
	}
}

func createSessionCookieValue(username string, now time.Time) (string, time.Time, error) {
	if strings.TrimSpace(username) == "" {
		return "", time.Time{}, errors.New("username is required")
	}

	expiresAt := now.Add(getSessionTTL())
	nonceBytes, err := randomBytes(16)
	if err != nil {
		return "", time.Time{}, err
	}
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)
	payload := username + "\n" + strconv.FormatInt(expiresAt.Unix(), 10) + "\n" + nonce

	mac := hmac.New(sha256.New, getSessionSecret())
	if _, err := mac.Write([]byte(payload)); err != nil {
		return "", time.Time{}, err
	}
	sig := mac.Sum(nil)

	value := base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(sig)
	return value, expiresAt, nil
}

func parseAndVerifySessionCookieValue(value string) (string, error) {
	parts := strings.Split(value, ".")
	if len(parts) != 2 {
		return "", errors.New("invalid cookie format")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}

	mac := hmac.New(sha256.New, getSessionSecret())
	if _, err := mac.Write(payloadBytes); err != nil {
		return "", err
	}
	expectedSig := mac.Sum(nil)
	if !hmac.Equal(sigBytes, expectedSig) {
		return "", errors.New("invalid cookie signature")
	}

	segments := strings.Split(string(payloadBytes), "\n")
	if len(segments) != 3 {
		return "", errors.New("invalid payload")
	}

	username := strings.TrimSpace(segments[0])
	if username == "" {
		return "", errors.New("invalid username")
	}

	expiresUnix, err := strconv.ParseInt(segments[1], 10, 64)
	if err != nil {
		return "", err
	}
	if time.Now().After(time.Unix(expiresUnix, 0)) {
		return "", errors.New("session expired")
	}

	return username, nil
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, username string) error {
	value, expiresAt, err := createSessionCookieValue(username, time.Now())
	if err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   shouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
	})

	return nil
}

func getDeviceIDFromCookie(r *http.Request) string {
	cookie, err := r.Cookie(deviceIDCookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie.Value)
}

func setDeviceIDCookie(w http.ResponseWriter, r *http.Request, deviceID string) (string, error) {
	id := strings.TrimSpace(deviceID)
	if id == "" {
		bytes, err := randomBytes(16)
		if err != nil {
			return "", err
		}
		id = base64.RawURLEncoding.EncodeToString(bytes)
	}

	expiresAt := time.Now().Add(180 * 24 * time.Hour)
	http.SetCookie(w, &http.Cookie{
		Name:     deviceIDCookieName,
		Value:    id,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   shouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
	})

	return id, nil
}

func ensureDeviceIDCookie(w http.ResponseWriter, r *http.Request) (string, error) {
	if existing := getDeviceIDFromCookie(r); existing != "" {
		return existing, nil
	}
	return setDeviceIDCookie(w, r, "")
}

func createRestoreToken(username, deviceID string, now time.Time) (string, time.Time, error) {
	username = strings.TrimSpace(username)
	deviceID = strings.TrimSpace(deviceID)
	if username == "" || deviceID == "" {
		return "", time.Time{}, errors.New("username and device id are required")
	}

	expiresAt := now.Add(getRestoreTokenTTL())
	nonceBytes, err := randomBytes(16)
	if err != nil {
		return "", time.Time{}, err
	}
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)
	payload := username + "\n" + deviceID + "\n" + strconv.FormatInt(expiresAt.Unix(), 10) + "\n" + nonce

	mac := hmac.New(sha256.New, getSessionSecret())
	if _, err := mac.Write([]byte(payload)); err != nil {
		return "", time.Time{}, err
	}
	sig := mac.Sum(nil)

	value := base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(sig)
	return value, expiresAt, nil
}

func parseAndVerifyRestoreToken(token string) (string, string, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 {
		return "", "", errors.New("invalid token format")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", err
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", err
	}

	mac := hmac.New(sha256.New, getSessionSecret())
	if _, err := mac.Write(payloadBytes); err != nil {
		return "", "", err
	}
	expectedSig := mac.Sum(nil)
	if !hmac.Equal(sigBytes, expectedSig) {
		return "", "", errors.New("invalid token signature")
	}

	segments := strings.Split(string(payloadBytes), "\n")
	if len(segments) != 4 {
		return "", "", errors.New("invalid token payload")
	}

	username := strings.TrimSpace(segments[0])
	deviceID := strings.TrimSpace(segments[1])
	expiresUnix, err := strconv.ParseInt(strings.TrimSpace(segments[2]), 10, 64)
	if err != nil {
		return "", "", err
	}

	if username == "" || deviceID == "" {
		return "", "", errors.New("token missing identity")
	}

	if time.Now().After(time.Unix(expiresUnix, 0)) {
		return "", "", errors.New("restore token expired")
	}

	return username, deviceID, nil
}

func issueSessionAndRestore(w http.ResponseWriter, r *http.Request, username string) (string, error) {
	if err := setSessionCookie(w, r, username); err != nil {
		return "", err
	}

	deviceID, err := ensureDeviceIDCookie(w, r)
	if err != nil {
		return "", err
	}

	restoreToken, _, err := createRestoreToken(username, deviceID, time.Now())
	if err != nil {
		return "", err
	}

	return restoreToken, nil
}

func getUsernameFromSession(r *http.Request) (string, error) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return "", err
	}

	username, err := parseAndVerifySessionCookieValue(cookie.Value)
	if err != nil {
		return "", err
	}

	return username, nil
}

func headerAuthFallbackEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(getEnv("ALLOW_HEADER_AUTH_FALLBACK", "true"))) {
	case "false", "0", "no", "off":
		return false
	default:
		return true
	}
}

func getHeaderUsername(r *http.Request) string {
	raw := strings.TrimSpace(r.Header.Get("X-Username"))
	if raw == "" {
		return ""
	}
	if decoded, err := url.QueryUnescape(raw); err == nil {
		return strings.TrimSpace(decoded)
	}
	return raw
}

func getUsernameFromRequest(r *http.Request) (string, error) {
	if username, err := getUsernameFromSession(r); err == nil {
		return username, nil
	}

	if !headerAuthFallbackEnabled() {
		return "", errors.New("invalid session")
	}

	username := getHeaderUsername(r)
	if username == "" {
		return "", errors.New("missing auth identity")
	}

	ip := getIPAddress(r)
	if !(isPrivateOrLoopback(ip) || isTrustedIP(ip)) {
		return "", errors.New("header auth is not allowed from this ip")
	}

	return username, nil
}

func isLocalRequest(r *http.Request) bool {
	ip := getIPAddress(r)
	return isPrivateOrLoopback(ip) || isTrustedIP(ip)
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

	hashedPassword, err := hashPassword(password)
	if err != nil {
		log.Printf("[ERROR] パスワードのハッシュ化に失敗しました: %v", err)
		return nil, fmt.Errorf("パスワードのハッシュ化に失敗しました: %w", err)
	}
	userID := uuid.New().String()
	now := time.Now()

	query := `INSERT INTO users (id, username, display_name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err = db.Exec(query, userID, username, username, email, hashedPassword, now.Format("2006-01-02 15:04:05"), now.Format("2006-01-02 15:04:05"))
	if err != nil {
		log.Printf("[ERROR] ユーザー作成エラー: %v", err)
		return nil, err
	}

	log.Printf("[DEBUG] ユーザー作成成功: %s", username)
	return &AuthUser{
		ID:        0,
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

	query := `SELECT id, password, username, COALESCE(email, ''), COALESCE(profile_image, ''),
                        COALESCE(created_at, CURRENT_TIMESTAMP),
                        COALESCE(updated_at, CURRENT_TIMESTAMP)
                        FROM users WHERE username = ?`
	row := db.QueryRow(query, username)

	var user AuthUser
	var userID, storedPassword, createdAtStr, updatedAtStr string
	err := row.Scan(&userID, &storedPassword, &user.Username, &user.Email, &user.ProfileImage, &createdAtStr, &updatedAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("[INFO] ユーザーが見つかりません: %s", username)
		} else {
			log.Printf("[ERROR] 認証エラー (ユーザー取得): %v", err)
		}
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password))
	if err != nil {
		log.Printf("[DEBUG] bcrypt比較失敗: %v. 平文比較を試みます。", err)

		if storedPassword == password {
			log.Printf("[INFO] ユーザー '%s' がハッシュ化されていないパスワードでログインしました。パスワードをハッシュ化します。", username)

			newHashedPassword, hashErr := hashPassword(password)
			if hashErr != nil {
				log.Printf("[ERROR] ログイン成功後のパスワードハッシュ化に失敗: %v", hashErr)
			} else {
				_, updateErr := db.Exec("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newHashedPassword, userID)
				if updateErr != nil {
					log.Printf("[ERROR] ハッシュ化済みパスワードのDB更新に失敗: %v", updateErr)
				} else {
					log.Printf("[INFO] ユーザー '%s' のパスワードを正常にハッシュ化して更新しました。", username)
				}
			}
			err = nil
		} else {
			log.Printf("[INFO] ユーザー '%s' のパスワードが一致しませんでした。", username)
			return nil, sql.ErrNoRows
		}
	}

	if err == nil {
		user.LoginAt = time.Now().Unix()
		user.CreatedAt, _ = parseSQLiteTime(createdAtStr)
		user.UpdatedAt, _ = parseSQLiteTime(updatedAtStr)
		log.Printf("[INFO] ユーザー '%s' が正常にログインしました。", username)
	}

	return &user, err
}

func updateAuthUserPassword(username, newPassword string) error {
	if db == nil {
		return fmt.Errorf("データベース接続がありません")
	}

	hashed, err := hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("パスワードのハッシュ化に失敗しました: %w", err)
	}
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
		startWebAuthnSessionCleanup()
	})
}

func startWebAuthnSessionCleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for range ticker.C {
			cleanupExpiredWebAuthnSessions()
		}
	}()
}

func cleanupExpiredWebAuthnSessions() {
	now := time.Now()
	challengeStoreMu.Lock()
	for username, entry := range challengeStore {
		if now.After(entry.expiresAt) {
			delete(challengeStore, username)
		}
	}
	challengeStoreMu.Unlock()

	loginSessionStoreMu.Lock()
	for username, entry := range loginSessionStore {
		if now.After(entry.expiresAt) {
			delete(loginSessionStore, username)
		}
	}
	loginSessionStoreMu.Unlock()
}

func setChallengeSession(username string, data *webauthn.SessionData) {
	challengeStoreMu.Lock()
	challengeStore[username] = webAuthnSession{
		data:      data,
		expiresAt: time.Now().Add(webAuthnSessionTTL),
	}
	challengeStoreMu.Unlock()
}

func popChallengeSession(username string) (*webauthn.SessionData, bool) {
	challengeStoreMu.Lock()
	entry, ok := challengeStore[username]
	if ok {
		delete(challengeStore, username)
	}
	challengeStoreMu.Unlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func setLoginSession(username string, data *webauthn.SessionData) {
	loginSessionStoreMu.Lock()
	loginSessionStore[username] = webAuthnSession{
		data:      data,
		expiresAt: time.Now().Add(webAuthnSessionTTL),
	}
	loginSessionStoreMu.Unlock()
}

func popLoginSession(username string) (*webauthn.SessionData, bool) {
	loginSessionStoreMu.Lock()
	entry, ok := loginSessionStore[username]
	if ok {
		delete(loginSessionStore, username)
	}
	loginSessionStoreMu.Unlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func saveCredentialToDB(username string, cred *webauthn.Credential) error {
	_, err := db.Exec(`UPDATE users SET credential_id=?, credential_public_key=?, sign_count=? WHERE username=?`,
		string(cred.ID),
		string(cred.PublicKey),
		int(cred.Authenticator.SignCount),
		username)
	return err
}

// SaveSessionData stores WebAuthn session data for the user.
func SaveSessionData(username string, data *webauthn.SessionData) {
	setLoginSession(username, data)
}

// FindWebAuthnUserByUsername loads a WebAuthn user with credentials.
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
			if scanErr := rows.Scan(&id, &uname); scanErr != nil {
				fmt.Printf("[WARN] ユーザー読み込み失敗: %v\n", scanErr)
				continue
			}
			fmt.Printf(" - id: %s / username: %q\n", id, uname)
		}
		if closeErr := rows.Close(); closeErr != nil {
			fmt.Printf("[WARN] 行クローズ失敗: %v\n", closeErr)
		}
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

// FindUserByUsername returns a WebAuthn User for registration.
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
		if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
			log.Printf("JSON encode error: %v", encodeErr)
		}
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
		if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
			log.Printf("JSON encode error: %v", encodeErr)
		}
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
	restoreToken, err := issueSessionAndRestore(w, r, user.Username)
	if err != nil {
		log.Printf("[ERROR] セッション発行失敗: %v", err)
		http.Error(w, "認証セッションの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	response.RestoreToken = restoreToken
	w.Header().Set("Content-Type", "application/json")
	if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
}

func handleAuthChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username, err := getUsernameFromRequest(r)
	if err != nil {
		http.Error(w, "認証情報が確認できません", http.StatusUnauthorized)
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
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

	if _, err := authenticateAuthUser(username, req.CurrentPassword); err != nil {
		http.Error(w, "現在のパスワードが正しくありません", http.StatusUnauthorized)
		return
	}

	if err := updateAuthUserPassword(username, req.NewPassword); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "ユーザーが見つかりません", http.StatusNotFound)
			return
		}
		log.Printf("[ERROR] パスワード更新失敗: %v", err)
		http.Error(w, "パスワード更新に失敗しました", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if encodeErr := json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "パスワードを更新しました",
	}); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
}

func handleAuthRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RestoreToken string `json:"restoreToken"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RestoreToken) == "" {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username, tokenDeviceID, err := parseAndVerifyRestoreToken(req.RestoreToken)
	if err != nil {
		http.Error(w, "認証情報が無効です", http.StatusUnauthorized)
		return
	}

	isLocal := isLocalRequest(r)
	deviceID := getDeviceIDFromCookie(r)

	if !isLocal {
		if tokenDeviceID == "" || deviceID == "" || tokenDeviceID != deviceID {
			http.Error(w, "デバイス認証が必要です", http.StatusUnauthorized)
			return
		}
	} else if deviceID == "" && tokenDeviceID != "" {
		if _, cookieErr := setDeviceIDCookie(w, r, tokenDeviceID); cookieErr != nil {
			log.Printf("[WARN] デバイスIDクッキー設定失敗: %v", cookieErr)
		}
	}

	restoreToken, issueErr := issueSessionAndRestore(w, r, username)
	if issueErr != nil {
		log.Printf("[ERROR] リストア用セッション発行失敗: %v", issueErr)
		http.Error(w, "リストアに失敗しました", http.StatusInternalServerError)
		return
	}

	user, err := getUserByUsername(username)
	if err != nil {
		log.Printf("[ERROR] ユーザー情報取得エラー: %v", err)
		http.Error(w, "ユーザー情報を取得できませんでした", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if encodeErr := json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"message":      "セッションを再発行しました",
		"restoreToken": restoreToken,
		"user": map[string]interface{}{
			"username":     user.Username,
			"email":        user.Email,
			"profileImage": user.ProfileImage,
			"loginAt":      time.Now().Unix(),
		},
	}); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
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

	if response := validateAuthRegisterRequest(req); response != nil {
		writeAuthResponse(w, http.StatusOK, *response)
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
		writeAuthResponse(w, http.StatusInternalServerError, response)
		return
	}

	if exists {
		response := AuthResponse{
			Success: false,
			Message: "ユーザー名またはメールアドレスが既に使用されています",
		}
		writeAuthResponse(w, http.StatusOK, response)
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
		writeAuthResponse(w, http.StatusInternalServerError, response)
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
	writeAuthResponse(w, http.StatusOK, response)
}

func validateAuthRegisterRequest(req AuthRequest) *AuthResponse {
	if req.Username == "" || req.Email == "" || req.Password == "" {
		return &AuthResponse{
			Success: false,
			Message: "すべての項目を入力してください",
		}
	}

	if len(req.Password) < 6 {
		return &AuthResponse{
			Success: false,
			Message: "パスワードは6文字以上で入力してください",
		}
	}

	return nil
}

func writeAuthResponse(w http.ResponseWriter, status int, response AuthResponse) {
	w.Header().Set("Content-Type", "application/json")
	if status != http.StatusOK {
		w.WriteHeader(status)
	}
	if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
}

// ===== WebAuthn APIハンドラ =====

// HandleWebAuthnRegisterStart begins a WebAuthn registration ceremony.
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

	setChallengeSession(req.Username, sessionData)

	w.Header().Set("Content-Type", "application/json")
	if encodeErr := json.NewEncoder(w).Encode(options); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
}

// HandleWebAuthnRegisterFinish completes a WebAuthn registration ceremony.
func HandleWebAuthnRegisterFinish(w http.ResponseWriter, r *http.Request) {
	initWebAuthn()
	defer func() {
		if closeErr := r.Body.Close(); closeErr != nil {
			log.Printf("Failed to close request body: %v", closeErr)
		}
	}()

	rawReq, bodyBytes, err := decodeRegisterFinishRequest(w, r)
	if err != nil {
		return
	}

	fmt.Println("[DEBUG] body:", string(bodyBytes))

	standardReqBytes, err := buildStandardRegisterRequest(rawReq)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	fmt.Println("[DEBUG] 変換後のリクエスト:", string(standardReqBytes))

	newRequest, err := buildJSONRequest(r, standardReqBytes)
	if err != nil {
		fmt.Println("[ERROR] リクエスト再構築失敗:", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	user, err := FindUserByUsername(rawReq.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := popChallengeSession(rawReq.Username)
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
	if _, writeErr := w.Write([]byte(`{"success":true}`)); writeErr != nil {
		log.Printf("Failed to write response: %v", writeErr)
	}
}

type registerFinishRawRequest struct {
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

func decodeRegisterFinishRequest(w http.ResponseWriter, r *http.Request) (*registerFinishRawRequest, []byte, error) {
	bodyBytes, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return nil, nil, err
	}

	var rawReq registerFinishRawRequest
	if parseErr := json.Unmarshal(bodyBytes, &rawReq); parseErr != nil {
		fmt.Println("[ERROR] Unmarshal失敗:", parseErr)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return nil, bodyBytes, parseErr
	}
	if rawReq.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return nil, bodyBytes, fmt.Errorf("missing username")
	}

	return &rawReq, bodyBytes, nil
}

func buildStandardRegisterRequest(rawReq *registerFinishRawRequest) ([]byte, error) {
	rawID, err := base64URLDecode(rawReq.Credential.RawID)
	if err != nil {
		fmt.Println("[ERROR] RawID decode失敗:", err)
		return nil, err
	}

	clientDataJSON, err := base64URLDecode(rawReq.Credential.Response.ClientDataJSON)
	if err != nil {
		fmt.Println("[ERROR] ClientDataJSON decode失敗:", err)
		return nil, err
	}

	attestationObject, err := base64URLDecode(rawReq.Credential.Response.AttestationObject)
	if err != nil {
		fmt.Println("[ERROR] AttestationObject decode失敗:", err)
		return nil, err
	}

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
		return nil, err
	}

	return standardReqBytes, nil
}

func buildJSONRequest(r *http.Request, payload []byte) (*http.Request, error) {
	newRequest, err := http.NewRequest(http.MethodPost, r.URL.String(), bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	newRequest.Header.Set("Content-Type", "application/json")

	for key, values := range r.Header {
		if key == "Content-Length" {
			continue
		}
		for _, value := range values {
			newRequest.Header.Add(key, value)
		}
	}

	return newRequest, nil
}

// HandleWebAuthnLoginStart begins a WebAuthn login ceremony.
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
	if encodeErr := json.NewEncoder(w).Encode(options); encodeErr != nil {
		log.Printf("JSON encode error: %v", encodeErr)
	}
}

// HandleWebAuthnLoginFinish completes a WebAuthn login ceremony.
func HandleWebAuthnLoginFinish(w http.ResponseWriter, r *http.Request) {
	initWebAuthn()
	defer func() {
		if closeErr := r.Body.Close(); closeErr != nil {
			log.Printf("Failed to close request body: %v", closeErr)
		}
	}()

	rawReq, bodyBytes, err := decodeLoginFinishRequest(w, r)
	if err != nil {
		return
	}

	fmt.Println("[DEBUG] login body:", string(bodyBytes))

	standardReqBytes, err := buildStandardLoginRequest(rawReq)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	newRequest, err := buildJSONRequest(r, standardReqBytes)
	if err != nil {
		fmt.Println("[ERROR] Login リクエスト再構築失敗:", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	user, err := FindWebAuthnUserByUsername(rawReq.Username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	sessionData, ok := popLoginSession(rawReq.Username)
	if !ok {
		http.Error(w, "Session data not found", http.StatusBadRequest)
		return
	}

	// 認証処理
	_, err = webAuthnInstance.FinishLogin(user, *sessionData, newRequest)

	if err != nil {
		log.Println("Login failed:", err)
		http.Error(w, fmt.Sprintf(`{"success":false,"error":"%s"}`, err.Error()), http.StatusUnauthorized)
		return
	}

	restoreToken, err := issueSessionAndRestore(w, r, user.Name)
	if err != nil {
		log.Printf("[ERROR] セッション発行失敗: %v", err)
		http.Error(w, "認証セッションの作成に失敗しました", http.StatusInternalServerError)
		return
	}

	// 成功時のレスポンス
	w.Header().Set("Content-Type", "application/json")
	if encodeErr := json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"restoreToken": restoreToken,
	}); encodeErr != nil {
		log.Printf("Failed to write response: %v", encodeErr)
	}
}

type loginFinishRawRequest struct {
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

func decodeLoginFinishRequest(w http.ResponseWriter, r *http.Request) (*loginFinishRawRequest, []byte, error) {
	bodyBytes, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return nil, nil, err
	}

	var rawReq loginFinishRawRequest
	if parseErr := json.Unmarshal(bodyBytes, &rawReq); parseErr != nil {
		fmt.Println("[ERROR] Login Unmarshal失敗:", parseErr)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return nil, bodyBytes, parseErr
	}

	if rawReq.Username == "" {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return nil, bodyBytes, fmt.Errorf("missing username")
	}

	return &rawReq, bodyBytes, nil
}

func buildStandardLoginRequest(rawReq *loginFinishRawRequest) ([]byte, error) {
	rawID, err := base64URLDecode(rawReq.Credential.RawID)
	if err != nil {
		fmt.Println("[ERROR] Login RawID decode失敗:", err)
		return nil, err
	}

	clientDataJSON, err := base64URLDecode(rawReq.Credential.Response.ClientDataJSON)
	if err != nil {
		fmt.Println("[ERROR] Login ClientDataJSON decode失敗:", err)
		return nil, err
	}

	authenticatorData, err := base64URLDecode(rawReq.Credential.Response.AuthenticatorData)
	if err != nil {
		fmt.Println("[ERROR] Login AuthenticatorData decode失敗:", err)
		return nil, err
	}

	signature, err := base64URLDecode(rawReq.Credential.Response.Signature)
	if err != nil {
		fmt.Println("[ERROR] Login Signature decode失敗:", err)
		return nil, err
	}

	var userHandle []byte
	if rawReq.Credential.Response.UserHandle != nil {
		userHandle, err = base64URLDecode(*rawReq.Credential.Response.UserHandle)
		if err != nil {
			fmt.Println("[ERROR] Login UserHandle decode失敗:", err)
			return nil, err
		}
	}

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
		return nil, err
	}

	return standardReqBytes, nil
}
