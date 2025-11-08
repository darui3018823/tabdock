// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"tabdock/getstatus"
	"tabdock/subscription"
	"time"

	_ "modernc.org/sqlite"

	"github.com/google/uuid"
)

// const
const version = "5.8.1"

// var
var fallbackHolidays map[string]string

var (
	schedulePath  = "./json/schedule.json"
	calendarDir   = "./home/assets/calendar"
	forbiddenExts = map[string]bool{
		".htaccess": true, ".php": true, ".asp": true, ".aspx": true,
		".bat": true, ".cmd": true, ".exe": true, ".sh": true, ".dll": true,
	}
	mutex sync.Mutex
)

// type
type responseWriterWithStatus struct {
	http.ResponseWriter
	status int
}

type Forecast struct {
	Date    string `json:"date"`
	Label   string `json:"label"`
	Telop   string `json:"telop"`
	TempMin string `json:"temp_min"`
	TempMax string `json:"temp_max"`
	Detail  string `json:"detail"`
}

type WeatherResponse struct {
	City      string     `json:"city"`
	Forecasts []Forecast `json:"forecasts"`
}

type Schedule struct {
	Title       string `json:"title"`
	Date        string `json:"date"`
	Time        string `json:"time,omitempty"`
	EndTime     string `json:"endTime,omitempty"`
	Location    string `json:"location,omitempty"`
	Description string `json:"description,omitempty"`
	Attachment  string `json:"attachment,omitempty"`
	EmbedMap    string `json:"embedmap,omitempty"`
}

type ShiftEntry struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	Date        string `json:"date"`
	StartTime   string `json:"startTime"`
	EndTime     string `json:"endTime"`
	Location    string `json:"location"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

// func
func (rw *responseWriterWithStatus) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func serve(mux http.Handler) {
	update1 := "You can now view subscription schedules."
	update2 := "We will continue to apply optimizations and improvements in v5."
	update3 := "For performance improvements, we reduced the dependency on PowerShell Core and now use Windows PowerShell."
	update4 := "Since Core is still required outside Windows, we would appreciate your code contributions."
	update5 := "PWA is now supported (v5.8 and later). It may not be available on iOS."

	port := os.Getenv("DOCKER_PORT")
	useDocker := port != ""

	log.Println("Tabdock Version:", version)
	log.Println("==== Updates ====")
	log.Println(update1)
	log.Println(update2)
	log.Println(update3)
	log.Println(update4)
	log.Println(update5)
	log.Println("=================")

	if useDocker {
		log.Println("Started on Docker Mode：HTTP on port")
		log.Println("Serving on http://127.0.1:" + port)
		err := http.ListenAndServe(":"+port, mux)
		if err != nil {
			log.Fatal("HTTP Server error:", err)
		}
	} else {
		log.Println("Serving on https://127.0.0.1:443 ...")
		err := http.ListenAndServeTLS(":443", "./cert/tabdock.crt", "./cert/tabdock.key", mux)
		if err != nil {
			log.Fatal("HTTPS Server error:", err)
		}
	}
}

func main() {
	mux := http.NewServeMux()
	fallbackHolidays = preloadHolidays()

	if err := initDB(); err != nil {
		log.Fatal("DB初期化失敗:", err)
	}

	if err := initShiftDB(); err != nil {
		log.Fatal("シフトDB初期化失敗:", err)
	}

	if err := initSubscriptionDB(); err != nil {
		log.Fatal("サブスクリプションDB初期化失敗:", err)
	}

	// main page!
	mux.Handle("/main/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/main/", http.FileServer(http.Dir("./main")))).ServeHTTP))
	mux.Handle("/home/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/home/", http.FileServer(http.Dir("./home")))).ServeHTTP))

	// PWA manifest
	mux.Handle("/manifest.json", secureHandler(serveStaticJSON("./home/manifest.json")))

	// Error Pages
	mux.Handle("/error/404/", secureHandler(http.StripPrefix("/error/404/", http.FileServer(http.Dir("./error/404"))).ServeHTTP)) // Not Found
	mux.Handle("/error/503/", secureHandler(http.StripPrefix("/error/503/", http.FileServer(http.Dir("./error/503"))).ServeHTTP)) // Service Unavailable

	// legal
	mux.Handle("/legal/terms-of-service/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/legal/terms-of-service/", http.FileServer(http.Dir("./legal/terms-of-service/")))).ServeHTTP))
	mux.Handle("/legal/privacy-policy/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/legal/privacy-policy/", http.FileServer(http.Dir("./legal/privacy-policy/")))).ServeHTTP))

	// apis
	mux.HandleFunc("/api/ping", secureHandler(handlePing))
	mux.HandleFunc("/api/version", secureHandler(handleVesion))
	mux.HandleFunc("/api/status", secureHandler(handleStatusAPI))
	mux.HandleFunc("/api/weather", secureHandler(handleWeather))
	mux.HandleFunc("/api/holidays", secureHandler(holidaysHandler))
	mux.HandleFunc("/api/schedule", secureHandler(handleSchedule))
	mux.HandleFunc("/api/shift", secureHandler(handleShift))
	mux.HandleFunc("/api/upload-wallpaper", secureHandler(handleWallpaperUpload))
	mux.HandleFunc("/api/list-wallpapers", secureHandler(listWallpapersHandler))
	mux.HandleFunc("/api/upload-profile-image", secureHandler(handleProfileImageUpload))

	// Authentication APIs
	mux.HandleFunc("/api/auth/login", secureHandler(handleAuthLogin))
	mux.HandleFunc("/api/auth/register", secureHandler(handleAuthRegister))
	mux.HandleFunc("/api/auth/user-info", secureHandler(handleUserInfo))

	// Subscription APIs
	subscriptionDB, err := sql.Open("sqlite", "./database/subscription.db")
	if err != nil {
		log.Fatal("サブスクリプションDB接続失敗:", err)
	}
	subHandler := subscription.NewHandler(subscriptionDB, getUserIDFromSession)
	mux.HandleFunc("/api/subscriptions", secureHandler(subHandler.Create))
	mux.HandleFunc("/api/subscriptions/list", secureHandler(subHandler.GetUserSubscriptions))
	mux.HandleFunc("/api/subscriptions/upcoming", secureHandler(subHandler.GetUpcoming))
	mux.HandleFunc("/api/subscriptions/update", secureHandler(subHandler.Update))
	mux.HandleFunc("/api/subscriptions/status", secureHandler(subHandler.UpdateStatus))
	mux.HandleFunc("/api/subscriptions/delete", secureHandler(subHandler.Delete))

	// WebAuthn
	mux.HandleFunc("/api/webauthn/register/start", secureHandler(HandleWebAuthnRegisterStart))
	mux.HandleFunc("/api/webauthn/register/finish", secureHandler(HandleWebAuthnRegisterFinish))
	mux.HandleFunc("/api/webauthn/login/start", secureHandler(HandleWebAuthnLoginStart))
	mux.HandleFunc("/api/webauthn/login/finish", secureHandler(HandleWebAuthnLoginFinish))

	// ルートアクセス時
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home/", http.StatusFound)
	})

	serve(mux)
}

func initSubscriptionDB() error {
	// subscription.db
	subscriptionDB, err := sql.Open("sqlite", "./database/subscription.db")
	if err != nil {
		return fmt.Errorf("subscription.db接続エラー: %v", err)
	}
	defer subscriptionDB.Close()

	// サブスクリプションテーブル作成
	_, err = subscriptionDB.Exec(`
		CREATE TABLE IF NOT EXISTS subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL,
			service_name TEXT NOT NULL,
			plan_name TEXT NOT NULL,
			amount REAL NOT NULL,
			currency TEXT NOT NULL,
			billing_cycle TEXT NOT NULL,
			payment_method TEXT NOT NULL,
			payment_details TEXT,
			next_payment_date DATETIME NOT NULL,
			status TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return fmt.Errorf("サブスクリプションテーブル作成エラー: %v", err)
	}

	return nil
}

// スラッシュ補完
func withSlashAndErrorHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/") && !strings.Contains(r.URL.Path, ".") {
			http.Redirect(w, r, r.URL.Path+"/", http.StatusMovedPermanently)
			return
		}

		rw := &responseWriterWithStatus{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)

		switch rw.status {
		case 404:
			http.Redirect(w, r, "/error/404/", http.StatusFound)
			return
		case 503:
			http.Redirect(w, r, "/error/503/", http.StatusFound)
			return
		}
	})
}

func initShiftDB() error {
	db, err := sql.Open("sqlite", "./database/shift.db")
	if err != nil {
		return fmt.Errorf("シフトデータベース接続エラー: %v", err)
	}
	defer db.Close()

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS shifts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL,
			date TEXT NOT NULL,
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			location TEXT,
			description TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return fmt.Errorf("シフトテーブル作成エラー: %v", err)
	}

	return nil
}

func registerShift(username string, shift ShiftEntry) error {
	db, err := sql.Open("sqlite", "./database/shift.db")
	if err != nil {
		return fmt.Errorf("データベース接続エラー: %v", err)
	}
	defer db.Close()

	var userID string
	err = db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&userID)
	if err != nil {
		return fmt.Errorf("ユーザー認証エラー: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO shifts (user_id, date, start_time, end_time, location, description)
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, shift.Date, shift.StartTime, shift.EndTime, shift.Location, shift.Description)

	if err != nil {
		return fmt.Errorf("シフト登録エラー: %v", err)
	}

	return nil
}

func getShifts(username string) ([]ShiftEntry, error) {
	db, err := sql.Open("sqlite", "./database/shift.db")
	if err != nil {
		return nil, fmt.Errorf("データベース接続エラー: %v", err)
	}
	defer db.Close()

	var userID string
	err = db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("ユーザー認証エラー: %v", err)
	}

	rows, err := db.Query(`
		SELECT id, date, start_time, end_time, location, description, created_at
		FROM shifts
		WHERE user_id = ?
		ORDER BY date ASC, start_time ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("シフト取得エラー: %v", err)
	}
	defer rows.Close()

	var shifts []ShiftEntry
	for rows.Next() {
		var shift ShiftEntry
		err := rows.Scan(
			&shift.ID,
			&shift.Date,
			&shift.StartTime,
			&shift.EndTime,
			&shift.Location,
			&shift.Description,
			&shift.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("シフトデータ読み込みエラー: %v", err)
		}
		shift.Username = username // 表示用にユーザー名を設定
		shifts = append(shifts, shift)
	}

	return shifts, nil
}

// APIハンドラ関数
func handleStatusAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	statusCh := make(chan *getstatus.PCStatus)
	errCh := make(chan error)

	go func() {
		status, err := getPCStatus()
		if err != nil {
			errCh <- err
			return
		}
		statusCh <- status
	}()

	select {
	case status := <-statusCh:
		if err := json.NewEncoder(w).Encode(status); err != nil {
			log.Println("encode error:", err)
		}
	case err := <-errCh:
		log.Println("status error:", err)
		http.Error(w, "Failed to get status", http.StatusInternalServerError)
	case <-time.After(15 * time.Second):
		http.Error(w, "Timeout getting status", http.StatusGatewayTimeout)
	}
}

func getPCStatus() (*getstatus.PCStatus, error) {
	return getstatus.GetStatus()
}

func handleWeather(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// HEADリクエストならOKのみ返す
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	// クライアントからのリクエストボディを読み取る
	reqBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request", http.StatusBadRequest)
		return
	}

	// APIにリクエストを転送
	resp, err := http.Post("https://api.daruks.com/weather", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		http.Error(w, "failed to call weather API", http.StatusInternalServerError)
		log.Println("weather API error:", err)
		return
	}
	defer resp.Body.Close()

	// APIのレスポンスをそのまま返す
	apiRespBody, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "failed to read weather API response", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(resp.StatusCode)
	w.Write(apiRespBody)
}

func handleWallpaperUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		if err.Error() == "http: request body too large" {
			http.Error(w, "File size exceeds 50MB limit", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		}
		return
	}

	file, handler, err := r.FormFile("wallpaper")
	if err != nil {
		http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if handler.Size > 50<<20 {
		http.Error(w, "File size exceeds 50MB limit", http.StatusRequestEntityTooLarge)
		return
	}

	ext := strings.ToLower(filepath.Ext(handler.Filename))
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	}
	if !allowedExts[ext] {
		http.Error(w, "対応していないファイル形式です", http.StatusBadRequest)
		return
	}

	sniffBuf := make([]byte, 512)
	n, err := file.Read(sniffBuf)
	if err != nil && err != io.EOF {
		http.Error(w, "ファイルの読み込みに失敗しました", http.StatusBadRequest)
		return
	}

	contentType := http.DetectContentType(sniffBuf[:n])
	allowedMIMEs := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}
	if !allowedMIMEs[contentType] {
		http.Error(w, "対応していないファイル形式です", http.StatusBadRequest)
		return
	}

	filename := uuid.New().String() + ext
	wallpaperDir := filepath.Clean("home/wallpapers")
	if err := os.MkdirAll(wallpaperDir, 0755); err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}

	destPath := filepath.Join(wallpaperDir, filename)
	destPath = filepath.Clean(destPath)
	if !strings.HasPrefix(destPath, wallpaperDir+string(os.PathSeparator)) {
		http.Error(w, "不正なファイルパスです", http.StatusBadRequest)
		return
	}

	out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}
	defer out.Close()

	reader := io.MultiReader(bytes.NewReader(sniffBuf[:n]), file)
	if _, err := io.Copy(out, reader); err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "success",
		"filename": filename,
	})
}

func listWallpapersHandler(w http.ResponseWriter, r *http.Request) {
	wallpaperDir := "./home/wallpapers"
	files := []string{}

	err := filepath.Walk(wallpaperDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (strings.HasSuffix(info.Name(), ".jpg") || strings.HasSuffix(info.Name(), ".png")) || strings.HasSuffix(info.Name(), ".jpeg") || strings.HasSuffix(info.Name(), ".JPG") || strings.HasSuffix(info.Name(), ".gif") {
			relPath := strings.TrimPrefix(path, "./home/")
			relPath = strings.ReplaceAll(relPath, "\\", "/") // 追加！Windows対策
			files = append(files, relPath)
		}
		return nil
	})

	if err != nil {
		http.Error(w, "failed to read wallpapers", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"images": files,
	})
}

func handleProfileImageUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.ParseMultipartForm(10 << 20) // 最大10MB

	// ユーザー名を取得
	username := r.FormValue("username")
	if username == "" {
		http.Error(w, "ユーザー名が必要です", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("profileImage")
	if err != nil {
		http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// ファイル拡張子チェック
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
	}
	if !allowedExts[ext] {
		http.Error(w, "対応していないファイル形式です", http.StatusBadRequest)
		return
	}

	// ユニークなファイル名を生成
	uniqueID := uuid.New().String()
	filename := uniqueID + ext
	filepath := "home/assets/acc_icon/" + filename
	imagePath := "/home/assets/acc_icon/" + filename

	out, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		http.Error(w, "ファイル書き込みに失敗しました", http.StatusInternalServerError)
		return
	}

	// データベースにプロフィール画像パスを保存
	err = updateUserProfileImage(username, imagePath)
	if err != nil {
		log.Printf("[WARN] プロフィール画像のDB更新に失敗: %v", err)
		// ファイルは保存されているため、エラーにはしない
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"filename": filename,
		"path":     imagePath,
	})
}

// ユーザー情報を取得するAPI
func handleUserInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Username == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	// データベースからユーザー情報を取得
	user, err := getUserByUsername(req.Username)
	if err != nil {
		log.Printf("[ERROR] ユーザー情報取得エラー: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "ユーザー情報を取得できませんでした",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"user": map[string]interface{}{
			"username":     user.Username,
			"email":        user.Email,
			"profileImage": user.ProfileImage,
			"loginAt":      user.LoginAt,
		},
	})
}

func preloadHolidays() map[string]string {
	// ローカルの祝日JSONを事前に読み込み
	data, err := os.ReadFile("./json/holidays_fallback.json")
	if err != nil {
		log.Fatalf("ローカル祝日データの読み込みに失敗: %v", err)
	}
	var holidays map[string]string
	if err := json.Unmarshal(data, &holidays); err != nil {
		log.Fatalf("JSONパース失敗: %v", err)
	}
	return holidays
}

func holidaysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	const remoteURL = "https://holidays-jp.github.io/api/v1/date.json"

	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(remoteURL)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
		return
	}

	// 外部取得失敗 → fallback
	log.Println("外部APIからの取得に失敗。ローカルデータを返します。")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fallbackHolidays)
}

func handleSchedule(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	switch r.Method {
	case http.MethodGet:
		handleScheduleGet(w, r)
	case http.MethodPost:
		handleSchedulePost(w, r)
	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func handleSchedulePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		http.Error(w, "Form parse error", http.StatusBadRequest)
		return
	}

	// JSONパート
	jsonStr := r.FormValue("json")
	var sched Schedule
	if err := json.Unmarshal([]byte(jsonStr), &sched); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 添付ファイル（任意）
	file, handler, err := r.FormFile("attachment")
	if err != nil && err != http.ErrMissingFile {
		http.Error(w, "File error", http.StatusBadRequest)
		return
	}

	if handler != nil {
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(handler.Filename))
		if forbiddenExts[ext] {
			log.Println("アップロード拒否: 禁止拡張子", ext, "ファイル名:", handler.Filename, "リモートアドレス:", r.RemoteAddr)
			http.Error(w, "Forbidden file type", http.StatusBadRequest)
			return
		}

		uuidName := uuid.New().String() + ext
		outPath := filepath.Join(calendarDir, uuidName)

		out, err := os.Create(outPath)
		if err != nil {
			http.Error(w, "Save failed", http.StatusInternalServerError)
			return
		}
		defer out.Close()
		io.Copy(out, file)

		sched.Attachment = uuidName
	}

	// 書き込み（排他）
	mutex.Lock()
	defer mutex.Unlock()

	var existing []Schedule
	if data, err := os.ReadFile(schedulePath); err == nil {
		json.Unmarshal(data, &existing)
	}

	existing = append(existing, sched)

	f, err := os.Create(schedulePath)
	if err != nil {
		http.Error(w, "Write failed", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	enc.Encode(existing)

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte("OK"))
}

func handleScheduleGet(w http.ResponseWriter, _ *http.Request) {
	data, err := os.ReadFile("./json/schedule.json")
	if err != nil {
		http.Error(w, "読み込み失敗", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleShift(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		handleShiftPost(w, r)
	case http.MethodGet:
		handleShiftGet(w, r)
	case http.MethodDelete:
		username := getHeaderUsername(r)
		if username == "" {
			http.Error(w, "認証が必要です", http.StatusUnauthorized)
			return
		}

		log.Printf("[INFO] シフト削除リクエスト - ユーザー: %s, IPアドレス: %s", username, r.RemoteAddr)

		if err := deleteAllShiftsForUser(username); err != nil {
			log.Printf("[ERROR] シフト削除エラー - ユーザー: %s, エラー: %v", username, err)
			http.Error(w, "シフトの削除に失敗しました", http.StatusInternalServerError)
			return
		}

		log.Printf("[INFO] シフト削除成功 - ユーザー: %s", username)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "すべてのシフトを削除しました",
		})
	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func handleShiftPost(w http.ResponseWriter, r *http.Request) {
	username := getHeaderUsername(r)
	if username == "" {
		http.Error(w, "認証が必要です", http.StatusUnauthorized)
		return
	}

	var shifts []Schedule
	if err := json.NewDecoder(r.Body).Decode(&shifts); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("sqlite", "./database/shift.db")
	if err != nil {
		http.Error(w, "データベースエラー", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var userID string
	err = db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "ユーザーが見つかりません", http.StatusUnauthorized)
		} else {
			http.Error(w, "データベースエラー", http.StatusInternalServerError)
		}
		return
	}

	for _, s := range shifts {
		shift := ShiftEntry{
			Username:    username,
			Date:        s.Date,
			StartTime:   s.Time,
			EndTime:     s.EndTime,
			Location:    s.Location,
			Description: s.Description,
		}

		if err := registerShift(username, shift); err != nil {
			log.Printf("シフト登録エラー: %v", err)
			http.Error(w, "シフトの登録に失敗しました", http.StatusInternalServerError)
			return
		}
	}

	mutex.Lock()
	defer mutex.Unlock()

	var existing []Schedule
	if data, err := os.ReadFile(schedulePath); err == nil {
		json.Unmarshal(data, &existing)
	}

	filtered := make([]Schedule, 0)
	for _, s := range existing {
		if !strings.HasPrefix(s.Title, fmt.Sprintf("[シフト] %s:", username)) {
			filtered = append(filtered, s)
		}
	}

	for _, s := range shifts {
		sched := Schedule{
			Title:       fmt.Sprintf("[シフト] %s: %s", username, s.Location),
			Date:        s.Date,
			Time:        s.Time,
			EndTime:     s.EndTime,
			Location:    s.Location,
			Description: s.Description,
		}
		filtered = append(filtered, sched)
	}

	f, err := os.Create(schedulePath)
	if err != nil {
		http.Error(w, "スケジュール書き込みに失敗しました", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(filtered); err != nil {
		http.Error(w, "スケジュール書き込みに失敗しました", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": fmt.Sprintf("%d件のシフトを登録しました", len(shifts)),
	})
}

func handleShiftGet(w http.ResponseWriter, r *http.Request) {
	username := getHeaderUsername(r)
	if username == "" {
		http.Error(w, "認証が必要です", http.StatusUnauthorized)
		return
	}

	shifts, err := getShifts(username)
	if err != nil {
		log.Printf("シフト取得エラー: %v", err)
		http.Error(w, "シフトの取得に失敗しました", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shifts)
}

func deleteAllShiftsForUser(username string) error {
	db, err := sql.Open("sqlite", "./database/shift.db")
	if err != nil {
		return fmt.Errorf("データベース接続エラー: %v", err)
	}
	defer db.Close()

	var userID string
	err = db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("ログインユーザーが見つかりません: %s", username)
		}
		return fmt.Errorf("ユーザー確認エラー: %v", err)
	}

	_, err = db.Exec(`DELETE FROM shifts WHERE user_id = ?`, userID)
	if err != nil {
		return fmt.Errorf("シフト削除エラー: %v", err)
	}

	return nil
}

// getHeaderUsername は X-Username ヘッダーを取得し、URLデコードして返します（未設定時は空文字）。
func getHeaderUsername(r *http.Request) string {
	raw := r.Header.Get("X-Username")
	if raw == "" {
		return ""
	}
	// フロントエンド側で encodeURIComponent された値を復元
	if decoded, err := url.QueryUnescape(raw); err == nil {
		return decoded
	}
	// デコードに失敗した場合は生の値を返す（後方互換）
	return raw
}

func getUserIDFromSession(r *http.Request) (string, error) {
	username := getHeaderUsername(r)
	if username == "" {
		return "", fmt.Errorf("unauthorized: no username")
	}

	db, err := sql.Open("sqlite", "./database/acc.db")
	if err != nil {
		return "", fmt.Errorf("database error: %v", err)
	}
	defer db.Close()

	var id string
	err = db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("unauthorized: user not found")
		}
		return "", fmt.Errorf("database error: %v", err)
	}

	return id, nil
}

func handleVesion(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"version": version,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Println("JSONエンコード失敗:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

func handlePing(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"status": "ok",
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Println("JSONエンコード失敗:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

func serveStaticJSON(path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		http.ServeFile(w, r, path)
	}
}

func serveStaticPNG(path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		http.ServeFile(w, r, path)
	}
}
