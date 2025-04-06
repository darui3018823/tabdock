package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
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

func main() {
	mux := http.NewServeMux()

	// main page!
	mux.Handle("/main/", withSlashAndErrorHandler(http.StripPrefix("/main/", http.FileServer(http.Dir("./main")))))
	mux.Handle("/home/", withSlashAndErrorHandler(http.StripPrefix("/home/", http.FileServer(http.Dir("./home")))))

	// Error Pages
	mux.Handle("/error/404/", http.StripPrefix("/error/404/", http.FileServer(http.Dir("./error/404")))) // Not Found
	mux.Handle("/error/503/", http.StripPrefix("/error/503/", http.FileServer(http.Dir("./error/503")))) // Service Unavailable

	// apis
	mux.HandleFunc("/api/status", handleStatusAPI)
	http.HandleFunc("/api/weather", handleWeather)

	// ルートアクセス時 → /home/ にリダイレクト
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

	response := WeatherResponse{
		City: "名瀬",
		Forecasts: []Forecast{
			{
				Date:    "2025-04-06",
				Label:   "今日",
				Telop:   "くもりのち晴れ",
				TempMin: "--",
				TempMax: "21",
				Detail:  "曇りで夕方から晴れ、一部で雨の可能性あり。",
			},
			{
				Date:    "2025-04-07",
				Label:   "明日",
				Telop:   "晴れ",
				TempMin: "17",
				TempMax: "22",
				Detail:  "晴れの予報。風は北から東へ変わる見込み。",
			},
			{
				Date:    "2025-04-08",
				Label:   "明後日",
				Telop:   "晴時々曇",
				TempMin: "8",
				TempMax: "23",
				Detail:  "晴れ時々曇り。昼頃に一時的に曇る時間帯があるかも。",
			},
		},
	}

	json.NewEncoder(w).Encode(response)
}
