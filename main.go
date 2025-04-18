package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

func main() {
	mux := http.NewServeMux()

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
	mux.HandleFunc("/api/status", secureHandler(handleStatusAPI))
	mux.HandleFunc("/api/weather", secureHandler(handleWeather))
	mux.HandleFunc("/api/upload-wallpaper", secureHandler(handleWallpaperUpload))
	mux.HandleFunc("/api/list-wallpapers", secureHandler(listWallpapersHandler))

	// test
	mux.Handle("/test/log", secureTestHandler(secureHandler(http.HandlerFunc(handleTestLog))))
	mux.Handle("/test/", secureTestHandler(secureHandler(withSlashAndErrorHandler(http.StripPrefix("/test/", http.FileServer(http.Dir("./test")))).ServeHTTP)))

	// ルートアクセス時
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home/", http.StatusFound)
	})

	log.Println("Serving on https://127.0.0.1:443 ...")
	err := http.ListenAndServeTLS(":443", "tabdock.crt", "tabdock.key", mux)
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

func listWallpapersHandler(w http.ResponseWriter, r *http.Request) {
	wallpaperDir := "./home/wallpapers"
	files := []string{}

	err := filepath.Walk(wallpaperDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (strings.HasSuffix(info.Name(), ".jpg") || strings.HasSuffix(info.Name(), ".png")) {
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
