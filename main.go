package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type responseWriterWithStatus struct {
	http.ResponseWriter
	status int
}

// ステータス構造体（任意の値で拡張）
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

func (rw *responseWriterWithStatus) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// クライアントIPを取得する関数
func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}

	if strings.Contains(ip, ":") {
		host, _, err := net.SplitHostPort(ip)
		if err == nil {
			return host
		}
	}
	return ip
}

func logToFile(ip, content string) error {
	now := time.Now()
	date := now.Format("2006-01-02")
	fileName := fmt.Sprintf("%s_%s.log", ip, date)
	logDir := "./log"

	// ログディレクトリを作成（存在しない場合）
	if err := os.MkdirAll(logDir, os.ModePerm); err != nil {
		return err
	}

	fullPath := filepath.Join(logDir, fileName)
	f, err := os.OpenFile(fullPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(content)
	return err
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		method := r.Method
		path := r.URL.Path
		ua := r.UserAgent()
		t := time.Now().Format("2006/01/02 15:04:05")

		logLine := fmt.Sprintf("[%s] %s %s UA: %s\n", t, method, path, ua)
		fmt.Print("ログ出力 → ", logLine)

		// ログファイルに出力
		_ = logToFile(ip, logLine)

		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()
	loggedMux := logMiddleware(mux)

	// main page!
	mux.Handle("/main/", withSlashAndErrorHandler(http.StripPrefix("/main/", http.FileServer(http.Dir("./main")))))
	mux.Handle("/home/", withSlashAndErrorHandler(http.StripPrefix("/home/", http.FileServer(http.Dir("./home")))))

	// Error Pages
	mux.Handle("/error/404/", http.StripPrefix("/error/404/", http.FileServer(http.Dir("./error/404")))) // Not Found
	mux.Handle("/error/503/", http.StripPrefix("/error/503/", http.FileServer(http.Dir("./error/503")))) // Service Unavailable

	// apis
	mux.HandleFunc("/api/status", handleStatusAPI)
	mux.HandleFunc("/api/weather", handleWeather)
	mux.HandleFunc("/api/upload-wallpaper", handleWallpaperUpload)

	// ルートアクセス時 → /home/ にリダイレクト
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home/", http.StatusFound)
	})

	log.Println("Serving on https://127.0.0.1:443 ...")
	err := http.ListenAndServeTLS(":443", "tabdock.crt", "tabdock.key", loggedMux)
	if err != nil {
		log.Fatal("HTTPS Server error:", err)
	}
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

		if rw.status == 404 {
			http.Redirect(w, r, "/error/404/", http.StatusFound)
			return
		} else if rw.status == 503 {
			http.Redirect(w, r, "/error/503/", http.StatusFound)
			return
		}
	})
}

// APIハンドラ関数
func handleStatusAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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
	cmd := exec.Command("./get_status.exe")
	output, err := cmd.Output()
	if err != nil {
		log.Println("Command execution failed:", err)
		return nil, err
	}

	log.Println("== get_status.exe output ==")
	log.Println(string(output))

	var status PCStatus
	if err := json.Unmarshal(output, &status); err != nil {
		log.Println("JSON parse failed:", err)
		return nil, err
	}
	return &status, nil
}

func handleWeather(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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
