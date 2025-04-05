package main

import (
	"log"
	"net/http"
	"strings"
)

// 自動スラッシュ付加＋404ハンドリング
func withSlashAndErrorHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// スラッシュが必要なのに付いていないときはリダイレクト
		if !strings.HasSuffix(r.URL.Path, "/") && !strings.Contains(r.URL.Path, ".") {
			http.Redirect(w, r, r.URL.Path+"/", http.StatusMovedPermanently)
			return
		}

		// レスポンスキャプチャ用ラッパー
		rw := &responseWriterWithStatus{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)

		// ステータスコードに応じてリダイレクト
		if rw.status == 404 {
			http.Redirect(w, r, "/error/404/", http.StatusFound)
			return
		} else if rw.status == 503 {
			http.Redirect(w, r, "/error/503/", http.StatusFound)
			return
		}
	})
}

// レスポンスのステータスをキャプチャするための構造体
type responseWriterWithStatus struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriterWithStatus) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func main() {
	// 各静的ルート
	http.Handle("/home/", withSlashAndErrorHandler(http.StripPrefix("/home/", http.FileServer(http.Dir("./home")))))
	http.Handle("/error/", http.StripPrefix("/error/", http.FileServer(http.Dir("./error"))))

	// ルートアクセス → /home/ にリダイレクト
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home/", http.StatusFound)
	})

	log.Println("Serving on https://127.0.0.1:443 ...")
	err := http.ListenAndServeTLS(":443", "tabdock.crt", "tabdock.key", nil)
	if err != nil {
		log.Fatal("HTTPS Server error:", err)
	}
}
