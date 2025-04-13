package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// テスト環境用の意図的な防御・偽装ロジック（http.Handlerに対応）
func secureTestHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 強制的にリダイレクトして逃がす
		if strings.HasSuffix(r.URL.Path, ".exe") || strings.Contains(r.URL.Path, "sql") || strings.Contains(strings.ToLower(r.UserAgent()), "curl") {
			http.Redirect(w, r, "https://example.com", http.StatusFound)
			return
		}

		// ヘッダー偽装（スクレイピング妨害）
		w.Header().Set("X-Fake-IP", getFakeIP())
		w.Header().Set("X-Fake-UA", getFakeUA())

		// 通常処理に渡す
		next.ServeHTTP(w, r)
	})
}

func getFakeIP() string {
	return fmt.Sprintf("%d.%d.%d.%d", rand.Intn(256), rand.Intn(256), rand.Intn(256), rand.Intn(256))
}

func getFakeUA() string {
	uas := []string{
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36",
		"curl/7.64.1",
		"Wget/1.21.1",
		"python-requests/2.28.1",
		"PostmanRuntime/7.29.2",
	}
	return uas[rand.Intn(len(uas))]
}

func handleTestLog(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Log test executed with method: %s, path: %s", r.Method, r.URL.Path)
}
