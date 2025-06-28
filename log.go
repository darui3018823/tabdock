// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 2.6.0_log-r2

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

var trustedCIDRs []*net.IPNet
var scoreFile = "./json/ip_scores.json"
var ipScores = map[string]int{}
var blockedDirectIPs = []string{""}

func init() {
	err := loadTrustedIPs("./json/trusted_ips.json")
	if err != nil {
		fmt.Println("trusted_ips.json の読み込みに失敗しました:", err)
		os.Exit(1)
	}
}

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
			ip := net.ParseIP(cidr)
			if ip != nil {
				ipnet = &net.IPNet{IP: ip, Mask: net.CIDRMask(32, 32)}
			} else {
				continue
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

func isBlockedDirectIP(ip string) bool {
	for _, blocked := range blockedDirectIPs {
		if ip == blocked {
			return true
		}
	}
	return false
}

func isPrivateOrLoopback(ip string) bool {
	parsed := net.ParseIP(ip)
	return parsed.IsLoopback() || parsed.IsPrivate()
}

func loadScores() {
	data, err := os.ReadFile(scoreFile)
	if err == nil {
		_ = json.Unmarshal(data, &ipScores)
	}
}

func saveScores() {
	data, _ := json.MarshalIndent(ipScores, "", "  ")
	_ = os.WriteFile(scoreFile, data, 0644)
}

func incrementScore(ip string, amount int) {
	ipScores[ip] += amount
	saveScores()
}

func getLevel(ip string) string {
	score := ipScores[ip]
	if score >= 15 {
		return "block"
	} else if score >= 10 {
		return "warn"
	}
	return "info"
}

func isFromCloudflare(r *http.Request) bool {
	return r.Header.Get("CF-Connecting-IP") != "" || r.Header.Get("cf-ray") != ""
}

func detectSuspiciousUA(ua string) string {
	lower := strings.ToLower(ua)
	if ua == "" || strings.Contains(lower, "sqlmap") || strings.Contains(lower, "nessus") || strings.Contains(lower, "acunetix") {
		return "deny"
	}
	if strings.Contains(lower, "curl") || strings.Contains(lower, "python") || strings.Contains(lower, "bot") {
		return "warn"
	}
	return "ok"
}

func isSuspiciousPath(path string) bool {
	lower := strings.ToLower(path)
	attackPatterns := []string{".php", ".env", ".bak", ".old", ".git", ".htaccess", "wp-", "admin", "login"}
	for _, pattern := range attackPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

func logRequest(r *http.Request, ip, level string) {
	now := time.Now().Format("[2006/01/02 15:04:05]")
	msg := fmt.Sprintf("%s [%s] %s %s UA: %s ReqIP: %s\n", now, strings.ToUpper(level), r.Method, r.URL.Path, r.UserAgent(), ip)
	dir := fmt.Sprintf("./log/%s/%s", level, ip)
	_ = os.MkdirAll(dir, fs.ModePerm)
	path := fmt.Sprintf("%s/%s.log", dir, time.Now().Format("2006-01-02"))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer f.Close()
		f.WriteString(msg)
	}
	if level == "warn" || level == "attack" {
		go sendDiscordWebhook(ip, level, r.Method, r.URL.Path, r.UserAgent())
	}
}

func secureHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getIPAddress(r)
		ua := r.UserAgent()
		loadScores()

		internalLevelBoost := 0
		if !isFromCloudflare(r) {
			internalLevelBoost += 2
			if isPrivateOrLoopback(ip) {
				internalLevelBoost -= 3
			}
		}

		if isBlockedDirectIP(ip) {
			incrementScore(ip, 5+internalLevelBoost)
			logRequest(r, ip, "warn")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		if isSuspiciousPath(r.URL.Path) {
			incrementScore(ip, 5+internalLevelBoost)
			logRequest(r, ip, "attack")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		uaStatus := detectSuspiciousUA(ua)
		switch uaStatus {
		case "deny":
			incrementScore(ip, 5+internalLevelBoost)
			logRequest(r, ip, "warn")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		case "warn":
			incrementScore(ip, 3+internalLevelBoost)
			logRequest(r, ip, "warn")
		default:
			logRequest(r, ip, getLevel(ip))
		}

		if strings.HasPrefix(ip, "60.") && !isTrustedIP(ip) {
			incrementScore(ip, 3+internalLevelBoost)
			logRequest(r, ip, "warn")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		if isTrustedIP(ip) {
			logRequest(r, ip, "info")
		}

		next(w, r)
	}
}

func getIPAddress(r *http.Request) string {
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		return cf
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func sendDiscordWebhook(ip, level, method, path, ua string) {
	webhookURL := os.Getenv("DISCORD_WEBHOOK_URL") // 環境変数から取得
	if webhookURL == "" {
		fmt.Println("DISCORD_WEBHOOK_URL が設定されていません")
		return
	}

	color := 0xFFCC00
	if level == "attack" {
		color = 0xFF0000
	}

	content := fmt.Sprintf("```%s %s %s\nUA: %s\nIP: %s```", strings.ToUpper(level), method, path, ua, ip)

	payload := map[string]interface{}{
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("[ALERT] %s アクセス検出", strings.ToUpper(level)),
				"description": content,
				"color":       color,
			},
		},
	}

	jsonPayload, _ := json.Marshal(payload)
	http.Post(webhookURL, "application/json", bytes.NewBuffer(jsonPayload))
}
