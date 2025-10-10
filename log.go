// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.4.0_log-r1

package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var trustedCIDRs []*net.IPNet
var trustedProxyCIDRs = parseCIDRs([]string{
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
	"2400:cb00::/32",
	"2405:8100::/32",
	"2405:b500::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2c0f:f248::/32",
	"2a06:98c0::/29",
})
var scoreFile = "./json/ip_scores.json"
var ipScores = map[string]int{}
var ipScoresMutex sync.RWMutex
var blockedDirectIPs = []string{""}

var rateLimitMap = map[string]*RateLimit{}
var rateLimitMutex sync.RWMutex

var dynamicBlockMap = map[string]time.Time{}
var dynamicBlockMutex sync.RWMutex

var sqlInjectionPattern = regexp.MustCompile(`(?i)(union|select|insert|update|delete|drop|create|alter|exec|script|javascript|<script|onload|onerror|alert|confirm|prompt|document\.cookie)`)
var xssPattern = regexp.MustCompile(`(?i)(<script|javascript:|onload|onerror|alert\(|confirm\(|prompt\(|document\.|window\.|eval\()`)
var pathTraversalPattern = regexp.MustCompile(`(\.\./|\.\.\\|%2e%2e%2f|%2e%2e\\)`)

type RateLimit struct {
	Count     int
	LastReset time.Time
	Mutex     sync.Mutex
}

type SecurityConfig struct {
	MaxRequestSize   int64
	RateLimitPerMin  int
	AllowedMethods   []string
	BlockedCountries []string
	DynamicBlockTime time.Duration
}

var secConfig = SecurityConfig{
	MaxRequestSize:   10 * 1024 * 1024,
	RateLimitPerMin:  60,
	AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"},
	BlockedCountries: []string{"CN", "RU", "KP"},
	DynamicBlockTime: 30 * time.Minute,
}

func init() {
	err := loadTrustedIPs("./json/trusted_ips.json")
	if err != nil {
		fmt.Println("trusted_ips.json の読み込みに失敗しました:", err)
		os.Exit(1)
	}

	go startCleanupRoutine()
}

func startCleanupRoutine() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		cleanupMaps()
	}
}

func cleanupMaps() {
	now := time.Now()

	rateLimitMutex.Lock()
	for ip, rateLimit := range rateLimitMap {
		rateLimit.Mutex.Lock()
		if now.Sub(rateLimit.LastReset) > 5*time.Minute {
			delete(rateLimitMap, ip)
		}
		rateLimit.Mutex.Unlock()
	}
	rateLimitMutex.Unlock()

	dynamicBlockMutex.Lock()
	for ip, blockTime := range dynamicBlockMap {
		if now.Sub(blockTime) > secConfig.DynamicBlockTime {
			delete(dynamicBlockMap, ip)
		}
	}
	dynamicBlockMutex.Unlock()
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
		var tempScores map[string]int
		if json.Unmarshal(data, &tempScores) == nil {
			ipScoresMutex.Lock()
			ipScores = tempScores
			ipScoresMutex.Unlock()
		}
	}
}

func saveScores() {
	ipScoresMutex.RLock()
	data, _ := json.MarshalIndent(ipScores, "", "  ")
	ipScoresMutex.RUnlock()
	_ = os.WriteFile(scoreFile, data, 0644)
}

func incrementScore(ip string, amount int) {
	if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
		return
	}

	ipScoresMutex.Lock()
	ipScores[ip] += amount
	ipScoresMutex.Unlock()
	saveScores()
}

func getLevel(ip string) string {
	ipScoresMutex.RLock()
	score := ipScores[ip]
	ipScoresMutex.RUnlock()
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

	if ua == "" || len(ua) < 10 {
		return "deny"
	}

	maliciousPatterns := []string{
		"sqlmap", "nessus", "acunetix", "nikto", "dirb", "gobuster",
		"masscan", "zmap", "nmap", "burpsuite", "metasploit",
		"havij", "pangolin", "sqlninja", "beef", "w3af",
	}

	for _, pattern := range maliciousPatterns {
		if strings.Contains(lower, pattern) {
			return "deny"
		}
	}

	suspiciousPatterns := []string{
		"curl", "wget", "python", "perl", "ruby", "php", "java",
		"bot", "crawler", "spider", "scraper", "scanner",
		"test", "check", "monitor", "probe", "audit",
	}

	for _, pattern := range suspiciousPatterns {
		if strings.Contains(lower, pattern) {
			return "warn"
		}
	}

	if len(ua) > 512 {
		return "warn"
	}

	if sqlInjectionPattern.MatchString(ua) || xssPattern.MatchString(ua) {
		return "deny"
	}

	return "ok"
}

func isSuspiciousPath(path string) bool {
	lower := strings.ToLower(path)
	attackPatterns := []string{
		".php", ".env", ".bak", ".old", ".git", ".htaccess", "wp-", "admin", "login",
		".config", ".ini", ".conf", ".log", ".sql", ".db", ".backup", ".tmp",
		"phpmyadmin", "cpanel", "webmail", ".aws", ".ssh", "id_rsa", "passwd",
		"shadow", "etc/", "proc/", "var/log", "boot.ini", "web.config",
	}
	for _, pattern := range attackPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}

	if sqlInjectionPattern.MatchString(path) {
		return true
	}

	if xssPattern.MatchString(path) {
		return true
	}

	if pathTraversalPattern.MatchString(path) {
		return true
	}

	return false
}

func checkRateLimit(ip string) bool {
	if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
		return true
	}

	rateLimitMutex.Lock()
	defer rateLimitMutex.Unlock()

	if rateLimit, exists := rateLimitMap[ip]; exists {
		rateLimit.Mutex.Lock()
		defer rateLimit.Mutex.Unlock()

		if time.Since(rateLimit.LastReset) > time.Minute {
			rateLimit.Count = 0
			rateLimit.LastReset = time.Now()
		}

		rateLimit.Count++
		return rateLimit.Count <= secConfig.RateLimitPerMin
	} else {
		rateLimitMap[ip] = &RateLimit{
			Count:     1,
			LastReset: time.Now(),
		}
		return true
	}
}

func isDynamicallyBlocked(ip string) bool {
	if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
		return false
	}

	dynamicBlockMutex.RLock()
	defer dynamicBlockMutex.RUnlock()

	if blockTime, exists := dynamicBlockMap[ip]; exists {
		if time.Since(blockTime) < secConfig.DynamicBlockTime {
			return true
		}
		delete(dynamicBlockMap, ip)
	}
	return false
}

func addDynamicBlock(ip string) {
	if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
		return
	}

	dynamicBlockMutex.Lock()
	defer dynamicBlockMutex.Unlock()
	dynamicBlockMap[ip] = time.Now()
}

func isAllowedMethod(method string) bool {
	for _, allowed := range secConfig.AllowedMethods {
		if method == allowed {
			return true
		}
	}
	return false
}

func addSecurityHeaders(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdn.daruks.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

	// CORS headers for cross-origin requests
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Username")
}

func detectAdvancedThreats(r *http.Request) string {
	if r.Method == "POST" || r.Method == "PUT" {
		if r.ContentLength > secConfig.MaxRequestSize {
			return "oversized"
		}
	}

	suspiciousHeaders := []string{
		"X-Forwarded-For", "X-Real-IP", "X-Originating-IP",
		"Client-IP", "True-Client-IP", "X-Client-IP",
	}

	headerCount := 0
	for _, header := range suspiciousHeaders {
		if r.Header.Get(header) != "" {
			headerCount++
		}
	}

	if headerCount > 2 {
		return "header_manipulation"
	}

	for key, values := range r.Header {
		for _, value := range values {
			if len(value) > 8192 {
				return "long_header"
			}
		}
		if len(key) > 256 {
			return "long_header_name"
		}
	}

	return "clean"
}

func logRequest(r *http.Request, ip, level string) {
	now := time.Now().Format("[2006/01/02 15:04:05]")

	reqData := fmt.Sprintf("%s%s%s%s", r.Method, r.URL.Path, r.UserAgent(), ip)
	hasher := sha256.Sum256([]byte(reqData))
	reqHash := hex.EncodeToString(hasher[:])[:16]

	msg := fmt.Sprintf("%s [%s] %s %s UA: %s ReqIP: %s Hash: %s\n",
		now, strings.ToUpper(level), r.Method, r.URL.Path, r.UserAgent(), ip, reqHash)

	switch level {
	case "info", "warn", "attack", "error", "block":
	default:
		level = "info"
	}

	safeIP := sanitizeIP(ip)

	baseDir := "./log"
	dir := filepath.Join(baseDir, level, safeIP)
	dir = filepath.Clean(dir)

	if !strings.HasPrefix(dir, filepath.Clean(baseDir)) {
		return
	}

	if err := os.MkdirAll(dir, fs.ModePerm); err != nil {
		return
	}

	logFile := filepath.Join(dir, time.Now().Format("2006-01-02")+".log")
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer f.Close()
		f.WriteString(msg)
	}

	if level == "warn" || level == "attack" || level == "block" {
		if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
			return
		}
		go sendDiscordWebhook(ip, level, r.Method, r.URL.Path, r.UserAgent(), reqHash)
	}
}

func sanitizeIP(ip string) string {
	var sb strings.Builder
	for _, r := range ip {
		if (r >= '0' && r <= '9') || r == '.' || r == ':' || r == '-' || r == '_' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func secureHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		addSecurityHeaders(w)

		// CORS プリフライトリクエストの処理
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		ip := getIPAddress(r)
		ua := r.UserAgent()
		loadScores()

		// 最優先: localhost系のアクセスは常に許可
		if ip == "127.0.0.1" || ip == "::1" || ip == "localhost" {
			next(w, r)
			return
		}

		// WebAuthn APIは常に許可
		if strings.HasPrefix(r.URL.Path, "/api/webauthn/") {
			next(w, r)
			return
		}

		// 信頼できるIPアドレスかどうかを早期に判定
		isPrivateIP := isPrivateOrLoopback(ip)
		isTrusted := isTrustedIP(ip)

		// 信頼できるIPの場合、スコアやブロック状態に関係なく基本的なチェックのみで通す
		if isPrivateIP || isTrusted {
			// 基本的なメソッドチェックのみ実行
			if !isAllowedMethod(r.Method) {
				logRequest(r, ip, "warn") // 信頼できるIPなのでスコア増加は行わない
				http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
				return
			}

			// レート制限は信頼できるIPには適用しない（ログのみ）
			if !checkRateLimit(ip) {
				logRequest(r, ip, "warn") // ログは残すがブロックはしない
			}

			// 疑わしいパスでもログのみでブロックしない
			if isSuspiciousPath(r.URL.Path) {
				logRequest(r, ip, "warn")
			} else {
				uaStatus := detectSuspiciousUA(ua)
				if uaStatus == "deny" || uaStatus == "warn" {
					logRequest(r, ip, "info")
				} else {
					logRequest(r, ip, "info")
				}
			}
			next(w, r)
			return
		}

		// 信頼できないIPに対する通常のセキュリティチェック
		if !isAllowedMethod(r.Method) {
			incrementScore(ip, 10)
			logRequest(r, ip, "attack")
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		if !checkRateLimit(ip) {
			incrementScore(ip, 5)
			logRequest(r, ip, "block")
			addDynamicBlock(ip)
			http.Error(w, "Rate Limit Exceeded", http.StatusTooManyRequests)
			return
		}

		if isDynamicallyBlocked(ip) {
			logRequest(r, ip, "block")
			http.Error(w, "Access Denied", http.StatusForbidden)
			return
		}

		threatLevel := detectAdvancedThreats(r)
		switch threatLevel {
		case "oversized":
			incrementScore(ip, 8)
			logRequest(r, ip, "attack")
			http.Error(w, "Request Too Large", http.StatusRequestEntityTooLarge)
			return
		case "header_manipulation", "long_header", "long_header_name":
			incrementScore(ip, 7)
			logRequest(r, ip, "attack")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		internalLevelBoost := 0
		if !isFromCloudflare(r) {
			internalLevelBoost += 2
		}

		if isBlockedDirectIP(ip) {
			incrementScore(ip, 5+internalLevelBoost)
			logRequest(r, ip, "warn")
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		if isSuspiciousPath(r.URL.Path) {
			incrementScore(ip, 8+internalLevelBoost)
			logRequest(r, ip, "attack")

			if strings.Contains(strings.ToLower(r.URL.Path), "sql") ||
				strings.Contains(strings.ToLower(r.URL.Path), "script") {
				addDynamicBlock(ip)
			}

			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		}

		uaStatus := detectSuspiciousUA(ua)
		switch uaStatus {
		case "deny":
			incrementScore(ip, 8+internalLevelBoost)
			logRequest(r, ip, "attack")
			addDynamicBlock(ip)
			http.Redirect(w, r, "/error/403", http.StatusFound)
			return
		case "warn":
			incrementScore(ip, 4+internalLevelBoost)
			logRequest(r, ip, "warn")
		default:
			logRequest(r, ip, getLevel(ip))
		}

		if strings.HasPrefix(ip, "60.") {
			incrementScore(ip, 3+internalLevelBoost)
			logRequest(r, ip, "warn")
		}

		currentLevel := getLevel(ip)
		if currentLevel == "block" {
			addDynamicBlock(ip)
			logRequest(r, ip, "block")
			http.Redirect(w, r, "/error/503", http.StatusFound)
			return
		}

		next(w, r)
	}
}

func getIPAddress(r *http.Request) string {
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	if shouldTrustForwardedIP(remoteIP) {
		if cf := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cf != "" {
			if parsed := net.ParseIP(cf); parsed != nil {
				return parsed.String()
			}
		}

		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			for _, part := range parts {
				candidate := strings.TrimSpace(part)
				if parsed := net.ParseIP(candidate); parsed != nil {
					return parsed.String()
				}
			}
		}
	}

	return remoteIP
}

func shouldTrustForwardedIP(remoteIP string) bool {
	if remoteIP == "" {
		return false
	}

	if isPrivateOrLoopback(remoteIP) {
		return true
	}

	ip := net.ParseIP(remoteIP)
	if ip == nil {
		return false
	}

	for _, cidr := range trustedProxyCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}

	return false
}

func parseCIDRs(cidrs []string) []*net.IPNet {
	networks := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		cidr = strings.TrimSpace(cidr)
		if cidr == "" {
			continue
		}
		if !strings.Contains(cidr, "/") {
			if ip := net.ParseIP(cidr); ip != nil {
				bits := 32
				if ip.To4() == nil {
					bits = 128
				}
				networks = append(networks, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			}
			continue
		}
		if _, network, err := net.ParseCIDR(cidr); err == nil {
			networks = append(networks, network)
		}
	}
	return networks
}

func sendDiscordWebhook(ip, level, method, path, ua, reqHash string) {
	webhookURL := os.Getenv("DISCORD_WEBHOOK_URL") // 環境変数から取得
	if webhookURL == "" {
		fmt.Println("DISCORD_WEBHOOK_URL が設定されていません")
		return
	}

	color := 0xFFCC00
	switch level {
	case "attack":
		color = 0xFF0000
	case "block":
		color = 0x800080
	case "warn":
		color = 0xFFCC00
	}

	timestamp := time.Now().Format("2006/01/02 15:04:05")
	content := fmt.Sprintf("```%s %s %s\nUA: %s\nIP: %s\nTime: %s\nHash: %s```",
		strings.ToUpper(level), method, path, ua, ip, timestamp, reqHash)

	ipScoresMutex.RLock()
	currentScore := ipScores[ip]
	ipScoresMutex.RUnlock()

	fields := []map[string]interface{}{
		{
			"name":   "Current IP Score",
			"value":  strconv.Itoa(currentScore),
			"inline": true,
		},
		{
			"name":   "Request Hash",
			"value":  reqHash,
			"inline": true,
		},
	}

	payload := map[string]interface{}{
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("[ALERT] %s アクセス検出", strings.ToUpper(level)),
				"description": content,
				"color":       color,
				"fields":      fields,
				"timestamp":   time.Now().Format(time.RFC3339),
			},
		},
	}

	jsonPayload, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 10 * time.Second}
	client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonPayload))
}
