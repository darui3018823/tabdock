// 2025 TabDock: darui3018823 All rights reserved.
// Test file for log.go balanced-secure mode

package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestGetResetDuration(t *testing.T) {
	// Setup test config
	secConfig.SecurityLevel = "balanced-secure"
	secConfig.BalancedSecure = &BalancedSecureConfig{
		FirstAccessGracePeriodMin: 60,
		ResetThresholds: map[string]interface{}{
			"50": "block_with_contact",
			"25": float64(720),
			"15": float64(360),
			"0":  float64(1440),
		},
	}

	tests := []struct {
		name     string
		score    int
		expected time.Duration
	}{
		{"Score 0", 0, 24 * time.Hour},
		{"Score 10", 10, 24 * time.Hour},
		{"Score 15", 15, 6 * time.Hour},
		{"Score 20", 20, 6 * time.Hour},
		{"Score 25", 25, 12 * time.Hour},
		{"Score 40", 40, 12 * time.Hour},
		{"Score 50", 50, 0},
		{"Score 100", 100, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getResetDuration(tt.score)
			if result != tt.expected {
				t.Errorf("getResetDuration(%d) = %v, want %v", tt.score, result, tt.expected)
			}
		})
	}
}

func TestIsFirstAccessIP(t *testing.T) {
	// Clear the map for testing
	firstAccessIPsMutex.Lock()
	firstAccessIPs = make(map[string]time.Time)
	firstAccessIPsMutex.Unlock()

	testIP := "203.0.113.1"

	// Test: IP not in map
	isFirst, _ := isFirstAccessIP(testIP)
	if isFirst {
		t.Errorf("Expected IP %s to not be in first access map", testIP)
	}

	// Test: Add IP with future expiry
	firstAccessIPsMutex.Lock()
	firstAccessIPs[testIP] = time.Now().Add(1 * time.Hour)
	firstAccessIPsMutex.Unlock()

	isFirst, _ = isFirstAccessIP(testIP)
	if !isFirst {
		t.Errorf("Expected IP %s to be in first access map with future expiry", testIP)
	}

	// Test: Add IP with past expiry
	testIP2 := "203.0.113.2"
	firstAccessIPsMutex.Lock()
	firstAccessIPs[testIP2] = time.Now().Add(-1 * time.Hour)
	firstAccessIPsMutex.Unlock()

	isFirst, _ = isFirstAccessIP(testIP2)
	if isFirst {
		t.Errorf("Expected IP %s to not be valid with past expiry", testIP2)
	}
}

func TestRecordFirstAccessIP(t *testing.T) {
	// Setup temp file
	tmpFile := filepath.Join(os.TempDir(), "test_first_access_ips.json")
	firstAccessIPsFile = tmpFile
	defer os.Remove(tmpFile)

	// Clear the map
	firstAccessIPsMutex.Lock()
	firstAccessIPs = make(map[string]time.Time)
	firstAccessIPsMutex.Unlock()

	// Setup config
	secConfig.SecurityLevel = "balanced-secure"
	secConfig.BalancedSecure = &BalancedSecureConfig{
		FirstAccessGracePeriodMin: 60,
	}

	testIP := "203.0.113.10"
	recordFirstAccessIP(testIP)

	// Verify it was recorded
	firstAccessIPsMutex.RLock()
	expiry, exists := firstAccessIPs[testIP]
	firstAccessIPsMutex.RUnlock()

	if !exists {
		t.Errorf("Expected IP %s to be recorded in first access map", testIP)
	}

	// Check expiry is approximately 60 minutes in the future
	expectedExpiry := time.Now().Add(60 * time.Minute)
	if expiry.Sub(expectedExpiry) > 5*time.Second || expectedExpiry.Sub(expiry) > 5*time.Second {
		t.Errorf("Expected expiry to be around %v, got %v", expectedExpiry, expiry)
	}
}

func TestCleanupFirstAccessIPs(t *testing.T) {
	// Clear and setup test data
	firstAccessIPsMutex.Lock()
	firstAccessIPs = map[string]time.Time{
		"203.0.113.1": time.Now().Add(-1 * time.Hour),  // Expired
		"203.0.113.2": time.Now().Add(1 * time.Hour),   // Valid
		"203.0.113.3": time.Now().Add(-10 * time.Minute), // Expired
	}
	firstAccessIPsMutex.Unlock()

	cleanupFirstAccessIPs()

	firstAccessIPsMutex.RLock()
	count := len(firstAccessIPs)
	_, has1 := firstAccessIPs["203.0.113.1"]
	_, has2 := firstAccessIPs["203.0.113.2"]
	_, has3 := firstAccessIPs["203.0.113.3"]
	firstAccessIPsMutex.RUnlock()

	if count != 1 {
		t.Errorf("Expected 1 IP remaining after cleanup, got %d", count)
	}

	if has1 {
		t.Errorf("Expected expired IP 203.0.113.1 to be removed")
	}

	if !has2 {
		t.Errorf("Expected valid IP 203.0.113.2 to remain")
	}

	if has3 {
		t.Errorf("Expected expired IP 203.0.113.3 to be removed")
	}
}

func TestBalancedSecureConfig(t *testing.T) {
	// Test that the default security level is balanced-secure
	testConfig := SecurityConfig{}
	if testConfig.SecurityLevel == "" {
		testConfig.SecurityLevel = "balanced-secure"
	}

	if testConfig.SecurityLevel != "balanced-secure" {
		t.Errorf("Expected default security level to be 'balanced-secure', got '%s'", testConfig.SecurityLevel)
	}
}

func TestResetIPScore(t *testing.T) {
	testIP := "203.0.113.20"

	// Add a score
	ipScoresMutex.Lock()
	ipScores[testIP] = 25
	ipScoresMutex.Unlock()

	ipScoreResetMutex.Lock()
	ipScoreLastReset[testIP] = time.Now()
	ipScoreResetMutex.Unlock()

	// Reset the score
	resetIPScore(testIP)

	// Verify it's gone
	ipScoresMutex.RLock()
	_, hasScore := ipScores[testIP]
	ipScoresMutex.RUnlock()

	ipScoreResetMutex.RLock()
	_, hasReset := ipScoreLastReset[testIP]
	ipScoreResetMutex.RUnlock()

	if hasScore {
		t.Errorf("Expected IP %s score to be removed", testIP)
	}

	if hasReset {
		t.Errorf("Expected IP %s reset time to be removed", testIP)
	}
}
