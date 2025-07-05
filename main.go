// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// const
const version = "2.9.4"

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

type PCStatus struct {
	PC      string `json:"pc"`
	Battery string `json:"battery"`
	WAN     string `json:"wan"`
	VPN     string `json:"vpn"`
	Port21  string `json:"port21"`
	RAM     string `json:"ram"`
	EGPU    string `json:"egpu"`
	GPU     string `json:"gpu"`
	DriveE  string `json:"driveE"`
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

// func
func (rw *responseWriterWithStatus) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func serve(mux http.Handler) {
	update1 := "Added About and Status."
	update2 := "The transparency slider is still being adjusted."
	update3 := "Extended the reload process after a certain period."

	port := os.Getenv("DOCKER_PORT")
	useDocker := port != ""

	log.Println("Tabdock Version:", version)
	log.Println("==== Updates ====")
	log.Println(update1)
	log.Println(update2)
	log.Println(update3)
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
	// ローカルの祝日データを事前に読み込み
	fallbackHolidays = preloadHolidays()

	// main page!
	mux.Handle("/main/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/main/", http.FileServer(http.Dir("./main")))).ServeHTTP))
	mux.Handle("/home/", secureHandler(withSlashAndErrorHandler(http.StripPrefix("/home/", http.FileServer(http.Dir("./home")))).ServeHTTP))

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
	mux.HandleFunc("/api/upload-wallpaper", secureHandler(handleWallpaperUpload))
	mux.HandleFunc("/api/list-wallpapers", secureHandler(listWallpapersHandler))

	// ルートアクセス時
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home/", http.StatusFound)
	})

	serve(mux)
}

// ミドルウェア：スラッシュ補完＆エラーハンドラ
func withSlashAndErrorHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// スラッシュが必要なのにない場合はリダイレクト
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

// APIハンドラ関数
func handleStatusAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	status, err := getPCStatus()
	if err != nil {
		log.Println("status error:", err)
		http.Error(w, "Failed to get status", http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(status); err != nil {
		log.Println("encode error:", err)
	}
}

func getPCStatus() (*PCStatus, error) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("./get_status.exe")
	} else {
		cmd = exec.Command("python3", "Python/get_status.py")
	}

	output, err := cmd.Output()
	if err != nil {
		log.Println("Command execution failed:", err)
		return nil, err
	}

	var status PCStatus
	if err := json.Unmarshal(output, &status); err != nil {
		log.Println("JSON parse failed:", err)
		return nil, err
	}
	return &status, nil
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
	r.ParseMultipartForm(10 << 20) // 最大10MB

	file, handler, err := r.FormFile("wallpaper")
	if err != nil {
		http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		return
	}
	defer file.Close()

	filename := handler.Filename
	filepath := "home/wallpapers/" + filename

	out, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}
	defer out.Close()
	io.Copy(out, file)

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
