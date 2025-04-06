package main

import (
	"encoding/json"
	"fmt"
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
	http.HandleFunc("/api/status", handleStatusAPI)

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
		http.Error(w, "Failed to get status", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(status)
}

func getPCStatus() (*PCStatus, error) {
	cmd := exec.Command("./get_status.exe") // .exe を必ず明示
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run binary: %w", err)
	}

	var status PCStatus
	if err := json.Unmarshal(output, &status); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}
	return &status, nil
}
