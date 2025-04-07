package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// 信頼済みIPの定義
var trustedCIDRs []*net.IPNet
var scoreFile = "ip_scores.json"
var ipScores = map[string]int{}

func loadTrustedIPs(filepath string) error {
	file, err := os.Open(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	var data struct {
		Trusted []string `json:"trusted"`
	}

	if err := json.NewDecoder(file).Decode(&data); err != nil {
		return err
	}

	for _, cidr := range data.Trusted {
		_, ipnet, err := net.ParseCIDR(cidr)
		if err != nil {
			// 単一IPの場合（例: "127.0.0.1"）
			ip := net.ParseIP(cidr)
			if ip != nil {
				ipnet = &net.IPNet{
					IP:   ip,
					Mask: net.CIDRMask(32, 32),
				}
			} else {
				continue // 無効なIPはスキップ
			}
		}
		trustedCIDRs = append(trustedCIDRs, ipnet)
	}

	return nil
}

func isTrustedIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	for _, cidr := range trustedCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

// ロード
func loadScores() {
	data, err := os.ReadFile(scoreFile)
	if err == nil {
		json.Unmarshal(data, &ipScores)
	}
}

// 保存
func saveScores() {
	data, _ := json.MarshalIndent(ipScores, "", "  ")
	_ = os.WriteFile(scoreFile, data, 0644)
}

// スコア加算
func incrementScore(ip string, amount int) {
	ipScores[ip] += amount
	saveScores()
}

// レベル取得
func getLevel(ip string) string {
	score := ipScores[ip]
	if score >= 10 {
		return "warn"
	}
	return "info"
}

// Cloudflareからかどうか判定
func isFromCloudflare(r *http.Request) bool {
	return r.Header.Get("CF-Connecting-IP") != "" || r.Header.Get("cf-ray") != ""
}

// 信頼IPかどうか
func isTrusted(ip string) bool {
	for _, trusted := range trustedCIDRs {
		if trusted.Contains(net.ParseIP(ip)) {
			return true
		}
	}
	return false
}

// User-Agent の判定
func detectSuspiciousUA(ua string) string {
	lower := strings.ToLower(ua)
	if ua == "" {
		return "deny"
	}
	if strings.Contains(lower, "sqlmap") || strings.Contains(lower, "nessus") {
		return "deny"
	}
	if strings.Contains(lower, "curl") || strings.Contains(lower, "python") || strings.Contains(lower, "bot") {
		return "warn"
	}
	return "ok"
}

// ログ保存
func logRequest(r *http.Request, ip string, level string) {
	now := time.Now().Format("[2006/01/02 15:04:05]")
	logLine := fmt.Sprintf("%s %s %s UA: %s ReqIP: %s\n",
		now, r.Method, r.URL.Path, r.UserAgent(), ip)

	dir := fmt.Sprintf("./log/%s/%s", level, ip)
	_ = os.MkdirAll(dir, fs.ModePerm)
	path := fmt.Sprintf("%s/%s.log", dir, time.Now().Format("2006-01-02"))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer f.Close()
		f.WriteString(logLine)
	}
}

// ミドルウェア的なログ処理
func secureHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getIPAddress(r)
		ua := r.UserAgent()
		loadScores()

		// UA判定
		uaStatus := detectSuspiciousUA(ua)
		level := getLevel(ip)

		// UAがない
		if uaStatus == "deny" {
			incrementScore(ip, 5)
			logRequest(r, ip, "warn")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		// 明らかに悪質
		if uaStatus == "warn" {
			incrementScore(ip, 3)
			logRequest(r, ip, "warn")
		} else {
			logRequest(r, ip, level)
		}

		// IPチェック
		if !isTrusted(ip) && !isFromCloudflare(r) {
			if strings.HasPrefix(ip, "60.") {
				logRequest(r, ip, "warn")
				http.Redirect(w, r, "/error/403", http.StatusFound)
				return
			}
		}

		// 次の処理へ
		next(w, r)
	}
}

// IP取得
func getIPAddress(r *http.Request) string {
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		return cf
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}
