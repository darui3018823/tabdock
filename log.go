// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.16.1_log-r1
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

	"github.com/oschwald/geoip2-golang"
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

var firstAccessIPsFile = "./json/first_access_ips.json"
var firstAccessIPs = map[string]time.Time{}
var firstAccessIPsMutex sync.RWMutex
var ipScoreLastReset = map[string]time.Time{}
var ipScoreResetMutex sync.RWMutex

var rateLimitMap = map[string]*RateLimit{}
var rateLimitMutex sync.RWMutex

var dynamicBlockMap = map[string]time.Time{}
var dynamicBlockMutex sync.RWMutex

var rateLimitExemptExtensions = []string{
	".css", ".js",
	".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
	".woff", ".woff2", ".ttf", ".eot",
	".json",
}

var (
	sqlInjectionPattern    *regexp.Regexp
	xssPattern             *regexp.Regexp
	pathTraversalPattern   *regexp.Regexp
	maliciousUAPatterns    []string
	suspiciousUAPatterns   []string
	suspiciousPathPatterns []string
	geoipDB                *geoip2.Reader
)

// Default score thresholds for auto-reset mechanism
const (
	ScoreThresholdBlock  = 50
	ScoreThresholdHigh   = 25
	ScoreThresholdMedium = 15
	ScoreThresholdLow    = 0

	// Security Levels
	SecurityLevelBalanced = "balanced-secure"
	SecurityLevelRelaxed  = "relaxed"

	// Actions/Levels
	ActionBlock  = "block"
	ActionWarn   = "warn"
	ActionInfo   = "info"
	ActionAttack = "attack"
	ActionDeny   = "deny"
	ActionClean  = "clean"

	// Threats
	ThreatClean              = "clean"
	ThreatOversized          = "oversized"
	ThreatHeaderManipulation = "header_manipulation"
	ThreatLongHeader         = "long_header"
	ThreatLongHeaderName     = "long_header_name"
)

// RateLimit tracks request counts for rate limiting.
type RateLimit struct {
	Count     int
	LastReset time.Time
	Mutex     sync.Mutex
}

// DetectionPatterns defines regex patterns and UA lists for security checks.
type DetectionPatterns struct {
	SQLInjection   string   `json:"sql_injection"`
	XSS            string   `json:"xss"`
	PathTraversal  string   `json:"path_traversal"`
	MaliciousUA    []string `json:"malicious_ua"`
	SuspiciousUA   []string `json:"suspicious_ua"`
	SuspiciousPath []string `json:"suspicious_path"`
}

// SecurityConfig stores security-related configuration.
type SecurityConfig struct {
	MaxRequestSizeMB    int64                 `json:"max_request_size_mb"`
	RateLimitPerMin     int                   `json:"rate_limit_per_min"`
	DynamicBlockTimeMin int                   `json:"dynamic_block_time_min"`
	AllowedMethods      []string              `json:"allowed_methods"`
	BlockedCountries    []string              `json:"blocked_countries"`
	Patterns            DetectionPatterns     `json:"detection_patterns"`
	SecurityLevel       string                `json:"security_level"`
	BalancedSecure      *BalancedSecureConfig `json:"balanced_secure,omitempty"`
}

// BalancedSecureConfig tweaks balanced-secure behavior.
type BalancedSecureConfig struct {
	// FirstAccessGracePeriodMin is the grace period duration in minutes for first-time visitors
	// before stricter security checks or scoring are applied.
	FirstAccessGracePeriodMin int `json:"first_access_grace_period_min"`

	// RequireCloudflare when true, blocks all non-Cloudflare traffic after grace period.
	// Set to false to allow direct access from internal networks, VPNs, or during Cloudflare outages.
	RequireCloudflare bool `json:"require_cloudflare"`

	// ResetThresholds maps score thresholds (as string keys) to their corresponding reset behaviors.
	// Values are either:
	//   - a numeric duration in minutes, indicating when to reset the score, or
	//   - a string action such as "block_with_contact".
	ResetThresholds map[string]interface{} `json:"reset_thresholds"`
}

var secConfig SecurityConfig

func loadSecurityConfig(filepath string) error {
	file, err := os.Open(filepath)
	if err != nil {
		return fmt.Errorf("セキュリティ設定ファイルが開けません: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			fmt.Println("セキュリティ設定ファイルのクローズ失敗:", closeErr)
		}
	}()

	if decodeErr := json.NewDecoder(file).Decode(&secConfig); decodeErr != nil {
		return fmt.Errorf("セキュリティ設定のJSONデコードに失敗: %w", decodeErr)
	}

	if secConfig.SecurityLevel == "" {
		secConfig.SecurityLevel = SecurityLevelBalanced
	}

	// 正規表現をコンパイル
	sqlInjectionPattern, err = regexp.Compile(secConfig.Patterns.SQLInjection)
	if err != nil {
		return fmt.Errorf("SQL Injection パターンのコンパイルに失敗: %w", err)
	}
	xssPattern, err = regexp.Compile(secConfig.Patterns.XSS)
	if err != nil {
		return fmt.Errorf("XSS パターンのコンパイルに失敗: %w", err)
	}
	pathTraversalPattern, err = regexp.Compile(secConfig.Patterns.PathTraversal)
	if err != nil {
		return fmt.Errorf("path traversal パターンのコンパイルに失敗: %w", err)
	}

	maliciousUAPatterns = secConfig.Patterns.MaliciousUA
	suspiciousUAPatterns = secConfig.Patterns.SuspiciousUA
	suspiciousPathPatterns = secConfig.Patterns.SuspiciousPath

	return nil
}

// loadFirstAccessIPs loads the first access IP tracking data from disk.
// It reads from firstAccessIPsFile and populates the firstAccessIPs map.
// Errors during loading are silently ignored as the file may not exist on first run.
func loadFirstAccessIPs() {
	data, err := os.ReadFile(firstAccessIPsFile)
	if err != nil {
		return
	}

	var fileData struct {
		IPs map[string]string `json:"ips"`
	}

	if err := json.Unmarshal(data, &fileData); err != nil {
		return
	}

	firstAccessIPsMutex.Lock()
	defer firstAccessIPsMutex.Unlock()

	firstAccessIPs = make(map[string]time.Time)
	for ip, timeStr := range fileData.IPs {
		if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
			firstAccessIPs[ip] = t
		}
	}
}

// saveFirstAccessIPs persists the first access IP tracking data to disk.
// It writes the current state of firstAccessIPs to firstAccessIPsFile.
// This is called periodically (every 10 minutes) to batch writes and reduce disk I/O.
// Errors during saving are logged to stderr for administrator visibility.
func saveFirstAccessIPs() {
	firstAccessIPsMutex.RLock()
	defer firstAccessIPsMutex.RUnlock()

	fileData := struct {
		IPs map[string]string `json:"ips"`
	}{
		IPs: make(map[string]string),
	}

	for ip, t := range firstAccessIPs {
		fileData.IPs[ip] = t.Format(time.RFC3339)
	}

	data, err := json.MarshalIndent(fileData, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal first access IPs to JSON: %v\n", err)
		return
	}

	if err := os.WriteFile(firstAccessIPsFile, data, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write first access IPs file %q: %v\n", firstAccessIPsFile, err)
	}
}

// cleanupFirstAccessIPs removes expired first access IP entries.
// It deletes any IPs whose grace period has expired (expiry time has passed).
// This is called periodically by cleanupMaps() to prevent unbounded growth.
func cleanupFirstAccessIPs() {
	now := time.Now()
	firstAccessIPsMutex.Lock()
	defer firstAccessIPsMutex.Unlock()

	for ip, expiry := range firstAccessIPs {
		if now.After(expiry) {
			delete(firstAccessIPs, ip)
		}
	}
}

// isFirstAccessIP checks if an IP is within its first access grace period.
// It returns true and the expiry time if the IP is in grace period, false otherwise.
// The grace period allows new visitors lenient treatment before full security enforcement.
func isFirstAccessIP(ip string) (bool, time.Time) {
	firstAccessIPsMutex.RLock()
	defer firstAccessIPsMutex.RUnlock()

	if expiry, exists := firstAccessIPs[ip]; exists {
		if time.Now().Before(expiry) {
			return true, expiry
		}
	}
	return false, time.Time{}
}

// getGracePeriodMinutes returns the configured grace period in minutes.
// Returns 60 minutes as default if not configured.
func getGracePeriodMinutes() int {
	if secConfig.SecurityLevel == SecurityLevelBalanced && secConfig.BalancedSecure != nil {
		if secConfig.BalancedSecure.FirstAccessGracePeriodMin > 0 {
			return secConfig.BalancedSecure.FirstAccessGracePeriodMin
		}
	}
	return 60 // default
}

// getResetDuration returns the duration after which a score should be reset based on the current score level.
// It implements graduated reset thresholds:
//   - Score 50+: 0 (block, no reset)
//   - Score 25-49: 12 hours (or configured value)
//   - Score 15-24: 6 hours (or configured value)
//   - Score 0-14: 24 hours (or configured value)
//
// In balanced-secure mode, values are read from configuration; other modes use defaults.
func getResetDuration(score int) time.Duration {
	if secConfig.SecurityLevel != SecurityLevelBalanced || secConfig.BalancedSecure == nil {
		return getResetDurationDefault(score)
	}

	return getResetDurationBalanced(score, secConfig.BalancedSecure.ResetThresholds)
}

func getResetDurationDefault(score int) time.Duration {
	switch {
	case score >= ScoreThresholdBlock:
		return 0
	case score >= ScoreThresholdHigh:
		return 12 * time.Hour
	case score >= ScoreThresholdMedium:
		return 6 * time.Hour
	default:
		return 24 * time.Hour
	}
}

func getResetDurationBalanced(score int, thresholds map[string]interface{}) time.Duration {
	switch {
	case score >= ScoreThresholdBlock:
		if val, ok := thresholds[strconv.Itoa(ScoreThresholdBlock)]; ok {
			if strVal, ok := val.(string); ok && strVal == "block_with_contact" {
				return 0
			}
		}
		return 0
	case score >= ScoreThresholdHigh:
		return thresholdDuration(thresholds, ScoreThresholdHigh, 12*time.Hour)
	case score >= ScoreThresholdMedium:
		return thresholdDuration(thresholds, ScoreThresholdMedium, 6*time.Hour)
	default:
		return thresholdDuration(thresholds, ScoreThresholdLow, 24*time.Hour)
	}
}

func thresholdDuration(thresholds map[string]interface{}, score int, fallback time.Duration) time.Duration {
	if val, ok := thresholds[strconv.Itoa(score)]; ok {
		if minutes, ok := val.(float64); ok {
			return time.Duration(minutes) * time.Minute
		}
	}
	return fallback
}

// shouldResetScore determines if an IP's security score should be automatically reset.
// It checks if enough time has passed since the last reset based on the current score level.
// The reset timer is extended on any score increase to prevent gaming the system.
// Returns true if the score should be reset, false otherwise.
func shouldResetScore(ip string, currentScore int) bool {
	ipScoreResetMutex.Lock()
	defer ipScoreResetMutex.Unlock()

	lastReset, exists := ipScoreLastReset[ip]

	if !exists {
		// First time seeing this IP with a score, record reset time
		ipScoreLastReset[ip] = time.Now()
		return false
	}

	resetDuration := getResetDuration(currentScore)
	if resetDuration == 0 {
		return false // score is at block level
	}

	if time.Since(lastReset) >= resetDuration {
		return true
	}

	return false
}

// resetIPScore clears an IP's security score and reset timer.
// It removes the IP from both ipScores and ipScoreLastReset maps, then persists the change.
// This is called when an IP's score expires based on graduated reset thresholds.
func resetIPScore(ip string) {
	ipScoresMutex.Lock()
	delete(ipScores, ip)
	ipScoresMutex.Unlock()

	ipScoreResetMutex.Lock()
	delete(ipScoreLastReset, ip)
	ipScoreResetMutex.Unlock()

	saveScores()
}

func init() {
	if err := loadTrustedIPs("./json/trusted_ips.json"); err != nil {
		fmt.Println("trusted_ips.json の読み込みに失敗しました:", err)
		os.Exit(1)
	}

	if err := loadSecurityConfig("./json/security_config.json"); err != nil {
		fmt.Println("security_config.json の読み込みに失敗しました:", err)
		os.Exit(1)
	}

	loadFirstAccessIPs()

	if err := loadGeoIPDatabase("./geoip/GeoLite2-Country.mmdb"); err != nil {
		fmt.Println("警告: GeoIPデータベースが読み込めませんでした。国別ブロック機能は無効になります。:", err)
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
	blockDuration := time.Duration(secConfig.DynamicBlockTimeMin) * time.Minute
	for ip, blockTime := range dynamicBlockMap {
		if now.Sub(blockTime) > blockDuration {
			delete(dynamicBlockMap, ip)
		}
	}
	dynamicBlockMutex.Unlock()

	// Clean up ipScoreLastReset entries for IPs that no longer have scores.
	// This prevents ipScoreLastReset from growing unbounded over time.
	// Lock order: ipScoresMutex first, then ipScoreResetMutex to prevent deadlock
	ipScoresMutex.RLock()
	ipScoreResetMutex.Lock()
	for ip := range ipScoreLastReset {
		if _, exists := ipScores[ip]; !exists {
			delete(ipScoreLastReset, ip)
		}
	}
	ipScoreResetMutex.Unlock()
	ipScoresMutex.RUnlock()

	cleanupFirstAccessIPs()
	saveFirstAccessIPs()
}

func loadTrustedIPs(filepath string) error {
	file, err := os.Open(filepath)
	if err != nil {
		return err
	}
	defer func() {
		if err := file.Close(); err != nil {
			fmt.Println("Failed to close trusted IPs file:", err)
		}
	}()

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

func loadGeoIPDatabase(filepath string) error {
	var err error
	geoipDB, err = geoip2.Open(filepath)
	if err != nil {
		return err
	}
	return nil
}

func isBlockedCountry(ipStr string) bool {
	if geoipDB == nil || len(secConfig.BlockedCountries) == 0 {
		return false
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	country, err := geoipDB.Country(ip)
	if err != nil {
		return false
	}

	for _, blocked := range secConfig.BlockedCountries {
		if country.Country.IsoCode == blocked {
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

	// Update the reset timer on any score increase to prevent gaming the system.
	// This ensures that continued suspicious activity extends the reset period,
	// even if the score stays within the same threshold bracket.
	ipScoreResetMutex.Lock()
	ipScoreLastReset[ip] = time.Now()
	ipScoreResetMutex.Unlock()

	saveScores()
}

func isFromCloudflare(r *http.Request) bool {
	return r.Header.Get("CF-Connecting-IP") != "" || r.Header.Get("cf-ray") != ""
}

func detectSuspiciousUA(ua string) string {
	lower := strings.ToLower(ua)

	if ua == "" || len(ua) < 10 {
		return ActionDeny
	}

	for _, pattern := range maliciousUAPatterns {
		if strings.Contains(lower, pattern) {
			return ActionDeny
		}
	}

	for _, pattern := range suspiciousUAPatterns {
		if strings.Contains(lower, pattern) {
			return ActionWarn
		}
	}

	if len(ua) > 512 {
		return ActionWarn
	}

	if sqlInjectionPattern.MatchString(ua) || xssPattern.MatchString(ua) {
		return ActionDeny
	}

	return "ok"
}

func isSuspiciousPath(path string) bool {
	lower := strings.ToLower(path)
	for _, pattern := range suspiciousPathPatterns {
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

func checkRateLimit(ip string, path string) bool {
	for _, ext := range rateLimitExemptExtensions {
		if strings.HasSuffix(strings.ToLower(path), ext) {
			return true
		}
	}

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
	}

	rateLimitMap[ip] = &RateLimit{
		Count:     1,
		LastReset: time.Now(),
	}
	return true
}

func isDynamicallyBlocked(ip string) bool {
	if isTrustedIP(ip) || isPrivateOrLoopback(ip) {
		return false
	}

	dynamicBlockMutex.Lock()
	defer dynamicBlockMutex.Unlock()

	blockDuration := time.Duration(secConfig.DynamicBlockTimeMin) * time.Minute
	if blockTime, exists := dynamicBlockMap[ip]; exists {
		if time.Since(blockTime) < blockDuration {
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
	if secConfig.SecurityLevel != SecurityLevelRelaxed {
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdn.daruks.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

	// CORS headers for cross-origin requests
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Username")
}

func detectAdvancedThreats(r *http.Request) string {
	maxSize := secConfig.MaxRequestSizeMB * 1024 * 1024
	if r.Method == http.MethodPost || r.Method == http.MethodPut {
		if r.ContentLength > maxSize {
			return ThreatOversized
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
		return ThreatHeaderManipulation
	}

	for key, values := range r.Header {
		for _, value := range values {
			if len(value) > 8192 {
				return ThreatLongHeader
			}
		}
		if len(key) > 256 {
			return ThreatLongHeaderName
		}
	}

	return ThreatClean
}

// LogEntry represents a security log line.
type LogEntry struct {
	Timestamp   string `json:"timestamp"`
	Level       string `json:"level"`
	Method      string `json:"method"`
	Path        string `json:"path"`
	IP          string `json:"ip"`
	UserAgent   string `json:"user_agent"`
	RequestHash string `json:"request_hash"`
}

func logRequest(r *http.Request, ip, level string) {
	reqData := fmt.Sprintf("%s%s%s%s", r.Method, r.URL.Path, r.UserAgent(), ip)
	hasher := sha256.Sum256([]byte(reqData))
	reqHash := hex.EncodeToString(hasher[:])[:16]

	entry := LogEntry{
		Timestamp:   time.Now().Format(time.RFC3339),
		Level:       strings.ToUpper(level),
		Method:      r.Method,
		Path:        r.URL.Path,
		IP:          ip,
		UserAgent:   r.UserAgent(),
		RequestHash: reqHash,
	}

	logData, err := json.Marshal(entry)
	if err != nil {
		fmt.Println("Failed to marshal log entry:", err)
		return
	}

	switch level {
	case ActionInfo, ActionWarn, ActionAttack, "error", ActionBlock:
	default:
		level = ActionInfo
	}

	safeIP := sanitizeIP(ip)
	baseDir := "./log"
	dir := filepath.Join(baseDir, level, safeIP)
	dir = filepath.Clean(dir)

	if !strings.HasPrefix(dir, filepath.Clean(baseDir)) {
		return
	}

	if mkdirErr := os.MkdirAll(dir, fs.ModePerm); mkdirErr != nil {
		return
	}

	logFile := filepath.Join(dir, time.Now().Format("2006-01-02")+".log")
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer func() {
			if err := f.Close(); err != nil {
				fmt.Println("Failed to close log file:", err)
			}
		}()
		if _, writeErr := f.WriteString(string(logData) + "\n"); writeErr != nil {
			fmt.Println("Failed to write log file:", writeErr)
		}
	}

	if level == ActionWarn || level == ActionAttack || level == ActionBlock {
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

type securityContext struct {
	ip                 string
	ua                 string
	isPrivateIP        bool
	isTrusted          bool
	isRelaxedMode      bool
	isBalancedSecure   bool
	isFirstAccess      bool
	nonCloudflareBoost int
}

func handlePreflight(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodOptions {
		return false
	}
	w.WriteHeader(http.StatusOK)
	return true
}

func handleBypassRoutes(w http.ResponseWriter, r *http.Request, next http.HandlerFunc, ip string) bool {
	if ip == "127.0.0.1" || ip == "::1" || ip == "localhost" {
		next(w, r)
		return true
	}

	if strings.HasPrefix(r.URL.Path, "/api/webauthn/") {
		next(w, r)
		return true
	}

	return false
}

func handleTrustedRequest(w http.ResponseWriter, r *http.Request, next http.HandlerFunc, ctx securityContext) bool {
	if !ctx.isPrivateIP && !ctx.isTrusted {
		return false
	}

	if !isAllowedMethod(r.Method) {
		logRequest(r, ctx.ip, ActionWarn)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return true
	}

	if !checkRateLimit(ctx.ip, r.URL.Path) {
		logRequest(r, ctx.ip, ActionWarn)
	}

	if isSuspiciousPath(r.URL.Path) {
		logRequest(r, ctx.ip, ActionWarn)
	} else {
		logRequest(r, ctx.ip, ActionInfo)
	}

	next(w, r)
	return true
}

func prepareScoreState(ip string) int {
	ipScoresMutex.RLock()
	currentScore := ipScores[ip]
	ipScoresMutex.RUnlock()

	if currentScore > 0 && shouldResetScore(ip, currentScore) {
		resetIPScore(ip)
		currentScore = 0
	}

	return currentScore
}

func resolveFirstAccess(ip string, currentScore int) bool {
	isFirstAccess, _ := isFirstAccessIP(ip)
	if !isFirstAccess && currentScore == 0 {
		ipScoresMutex.RLock()
		_, hasScore := ipScores[ip]
		ipScoresMutex.RUnlock()

		if !hasScore {
			firstAccessIPsMutex.Lock()
			if _, alreadyRecorded := firstAccessIPs[ip]; !alreadyRecorded {
				gracePeriod := getGracePeriodMinutes()
				firstAccessIPs[ip] = time.Now().Add(time.Duration(gracePeriod) * time.Minute)
				isFirstAccess = true
			}
			firstAccessIPsMutex.Unlock()
		}
	}

	return isFirstAccess
}

func handleBalancedCloudflareBlock(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if !ctx.isBalancedSecure || ctx.isFirstAccess {
		return false
	}
	if secConfig.BalancedSecure == nil || !secConfig.BalancedSecure.RequireCloudflare {
		return false
	}
	if isFromCloudflare(r) {
		return false
	}

	logRequest(r, ctx.ip, ActionBlock)
	http.Error(w, "Access Denied", http.StatusForbidden)
	return true
}

func handleCountryBlock(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if ctx.isRelaxedMode || !isBlockedCountry(ctx.ip) {
		return false
	}

	logRequest(r, ctx.ip, ActionBlock)
	http.Error(w, "Access Denied", http.StatusForbidden)
	return true
}

func handleMethodValidation(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if isAllowedMethod(r.Method) {
		return false
	}

	incrementScore(ctx.ip, 10)
	if ctx.isBalancedSecure {
		logRequest(r, ctx.ip, ActionBlock)
	} else {
		logRequest(r, ctx.ip, ActionAttack)
	}
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	return true
}

func handleDirectIPBlock(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if ctx.isRelaxedMode || !isBlockedDirectIP(ctx.ip) {
		return false
	}

	if ctx.isBalancedSecure {
		logRequest(r, ctx.ip, ActionBlock)
		http.Redirect(w, r, "/error/403", http.StatusFound)
		return true
	}

	incrementScore(ctx.ip, 5)
	logRequest(r, ctx.ip, ActionWarn)
	http.Redirect(w, r, "/error/403", http.StatusFound)
	return true
}

func handleRateLimitCheck(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if checkRateLimit(ctx.ip, r.URL.Path) {
		return false
	}

	switch {
	case ctx.isRelaxedMode:
		logRequest(r, ctx.ip, ActionWarn)
		return false
	case ctx.isBalancedSecure:
		if ctx.isFirstAccess {
			incrementScore(ctx.ip, 5)
			logRequest(r, ctx.ip, ActionWarn)
			return false
		}
		incrementScore(ctx.ip, 5)
		logRequest(r, ctx.ip, ActionBlock)
		addDynamicBlock(ctx.ip)
		http.Error(w, "Rate Limit Exceeded", http.StatusTooManyRequests)
		return true
	default:
		incrementScore(ctx.ip, 5)
		logRequest(r, ctx.ip, ActionBlock)
		addDynamicBlock(ctx.ip)
		http.Error(w, "Rate Limit Exceeded", http.StatusTooManyRequests)
		return true
	}
}

func handleDynamicBlock(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if ctx.isRelaxedMode || !isDynamicallyBlocked(ctx.ip) {
		return false
	}

	logRequest(r, ctx.ip, ActionBlock)
	http.Error(w, "Access Denied", http.StatusForbidden)
	return true
}

func handleAdvancedThreats(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if ctx.isRelaxedMode {
		return false
	}

	threatLevel := detectAdvancedThreats(r)
	if threatLevel == ThreatClean {
		return false
	}

	switch threatLevel {
	case ThreatOversized:
		incrementScore(ctx.ip, 8)
		logRequest(r, ctx.ip, ActionAttack)
		http.Error(w, "Request Too Large", http.StatusRequestEntityTooLarge)
		return true
	case ThreatHeaderManipulation, ThreatLongHeader, ThreatLongHeaderName:
		incrementScore(ctx.ip, 7)
		logRequest(r, ctx.ip, ActionAttack)
		http.Redirect(w, r, "/error/403", http.StatusFound)
		return true
	default:
		return false
	}
}

func calculateNonCloudflareBoost(r *http.Request, isBalancedSecure bool) int {
	if isBalancedSecure || isFromCloudflare(r) {
		return 0
	}
	return 2
}

func handleSuspiciousPath(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	if !isSuspiciousPath(r.URL.Path) {
		return false
	}

	incrementScore(ctx.ip, 8+ctx.nonCloudflareBoost)
	logRequest(r, ctx.ip, ActionAttack)

	if strings.Contains(strings.ToLower(r.URL.Path), "sql") ||
		strings.Contains(strings.ToLower(r.URL.Path), "script") {
		addDynamicBlock(ctx.ip)
	}

	http.Redirect(w, r, "/error/403", http.StatusFound)
	return true
}

func handleUserAgent(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	uaStatus := detectSuspiciousUA(ctx.ua)
	switch uaStatus {
	case ActionDeny:
		if ctx.isRelaxedMode {
			incrementScore(ctx.ip, 1+ctx.nonCloudflareBoost)
			logRequest(r, ctx.ip, ActionWarn)
			return false
		}
		if ctx.isBalancedSecure && ctx.isFirstAccess {
			incrementScore(ctx.ip, 8+ctx.nonCloudflareBoost)
			logRequest(r, ctx.ip, ActionWarn)
			return false
		}
		incrementScore(ctx.ip, 8+ctx.nonCloudflareBoost)
		logRequest(r, ctx.ip, ActionAttack)
		addDynamicBlock(ctx.ip)
		http.Redirect(w, r, "/error/403", http.StatusFound)
		return true
	case ActionWarn:
		if ctx.isRelaxedMode {
			logRequest(r, ctx.ip, ActionInfo)
			return false
		}
		if ctx.isBalancedSecure && ctx.isFirstAccess {
			incrementScore(ctx.ip, 4+ctx.nonCloudflareBoost)
			logRequest(r, ctx.ip, ActionInfo)
			return false
		}
		incrementScore(ctx.ip, 4+ctx.nonCloudflareBoost)
		logRequest(r, ctx.ip, ActionWarn)
		return false
	default:
		logRequest(r, ctx.ip, ActionInfo)
		return false
	}
}

func handleFinalScore(w http.ResponseWriter, r *http.Request, ctx securityContext) bool {
	ipScoresMutex.RLock()
	finalScore := ipScores[ctx.ip]
	ipScoresMutex.RUnlock()

	if ctx.isRelaxedMode {
		if finalScore >= ScoreThresholdBlock {
			logRequest(r, ctx.ip, ActionWarn)
		}
		return false
	}

	if ctx.isBalancedSecure {
		if finalScore >= ScoreThresholdBlock {
			w.Header().Set("X-Blocked-Reason", "High Security Score")
			w.Header().Set("X-Contact-Support", "https://daruks.com/contact")
			addDynamicBlock(ctx.ip)
			logRequest(r, ctx.ip, ActionBlock)
			http.Redirect(w, r, "/error/503", http.StatusFound)
			return true
		}
		return false
	}

	if finalScore >= ScoreThresholdMedium {
		addDynamicBlock(ctx.ip)
		logRequest(r, ctx.ip, ActionBlock)
		http.Redirect(w, r, "/error/503", http.StatusFound)
		return true
	}

	return false
}

func secureHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		addSecurityHeaders(w)

		if handlePreflight(w, r) {
			return
		}

		ip := getIPAddress(r)
		ua := r.UserAgent()
		loadScores()

		if handleBypassRoutes(w, r, next, ip) {
			return
		}

		ctx := securityContext{
			ip:               ip,
			ua:               ua,
			isPrivateIP:      isPrivateOrLoopback(ip),
			isTrusted:        isTrustedIP(ip),
			isRelaxedMode:    secConfig.SecurityLevel == SecurityLevelRelaxed,
			isBalancedSecure: secConfig.SecurityLevel == SecurityLevelBalanced,
		}

		if handleTrustedRequest(w, r, next, ctx) {
			return
		}

		currentScore := prepareScoreState(ip)
		ctx.isFirstAccess = resolveFirstAccess(ip, currentScore)

		if handleBalancedCloudflareBlock(w, r, ctx) {
			return
		}
		if handleCountryBlock(w, r, ctx) {
			return
		}
		if handleMethodValidation(w, r, ctx) {
			return
		}
		if handleDirectIPBlock(w, r, ctx) {
			return
		}
		if handleRateLimitCheck(w, r, ctx) {
			return
		}
		if handleDynamicBlock(w, r, ctx) {
			return
		}
		if handleAdvancedThreats(w, r, ctx) {
			return
		}

		ctx.nonCloudflareBoost = calculateNonCloudflareBoost(r, ctx.isBalancedSecure)
		if handleSuspiciousPath(w, r, ctx) {
			return
		}
		if handleUserAgent(w, r, ctx) {
			return
		}
		if handleFinalScore(w, r, ctx) {
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
	case ActionAttack:
		color = 0xFF0000
	case ActionBlock:
		color = 0x800080
	case ActionWarn:
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
	resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		fmt.Println("Failed to send Discord webhook:", err)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			fmt.Println("Failed to close Discord webhook response body:", err)
		}
	}()
}
