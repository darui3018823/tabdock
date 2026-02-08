// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package subscription

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

const (
	subscriptionStatusActive   = "active"
	subscriptionStatusCanceled = "canceled"
	subscriptionStatusExpired  = "expired"
)

// Handler serves subscription API requests.
type Handler struct {
	subDB     *SubscriptionDB
	getUserID func(*http.Request) (string, error)
}

// NewHandler returns a subscription handler with a DB accessor.
func NewHandler(db *sql.DB, getUserID func(*http.Request) (string, error)) *Handler {
	return &Handler{
		subDB:     NewSubscriptionDB(db),
		getUserID: getUserID,
	}
}

// Create registers a new subscription.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// セッション確認
	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// リクエストボディを一度だけ読み取り
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// 生データをパース
	var raw map[string]interface{}
	if parseErr := json.Unmarshal(body, &raw); parseErr != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// NextPaymentDateを事前パース
	if v, ok := raw["nextPaymentDate"].(string); ok {
		var t time.Time
		// YYYY-MM-DD
		t, parseErr := time.Parse("2006-01-02", v)
		if parseErr != nil {
			// ISO8601
			t, parseErr = time.Parse("2006-01-02T15:04:05Z07:00", v)
			if parseErr != nil {
				http.Error(w, "Invalid nextPaymentDate format", http.StatusBadRequest)
				return
			}
		}
		// パース成功した日付を書き戻す
		raw["nextPaymentDate"] = t
	}

	// 全体をSubscription構造体に変換
	jsonData, err := json.Marshal(raw)
	if err != nil {
		http.Error(w, "Failed to process data", http.StatusInternalServerError)
		return
	}

	var sub Subscription
	if err := json.Unmarshal(jsonData, &sub); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sub.UserID = userID
	sub.Status = subscriptionStatusActive

	if err := h.subDB.Create(&sub); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sub); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// GetUserSubscriptions returns subscriptions for the current user.
func (h *Handler) GetUserSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	subs, err := h.subDB.GetByUserID(userIDStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(subs); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// GetUpcoming returns upcoming subscriptions for the current user.
func (h *Handler) GetUpcoming(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	subs, err := h.subDB.GetUpcoming(userIDStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(subs); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// RenewPaymentDates recalculates overdue payments.
func (h *Handler) RenewPaymentDates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	results, err := h.subDB.RenewOverduePayments(userIDStr, time.Now())
	if err != nil {
		log.Printf("Failed to renew payments: %v", err)
		http.Error(w, "Failed to renew payments", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(results); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// Update modifies a subscription.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	subID, err := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	// リクエストボディを読み取り
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// 生データをパース
	var raw map[string]interface{}
	if parseErr := json.Unmarshal(body, &raw); parseErr != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// NextPaymentDateを事前パース
	if v, ok := raw["nextPaymentDate"].(string); ok {
		var t time.Time
		// YYYY-MM-DD
		t, parseErr := time.Parse("2006-01-02", v)
		if parseErr != nil {
			// ISO8601
			t, parseErr = time.Parse("2006-01-02T15:04:05Z07:00", v)
			if parseErr != nil {
				http.Error(w, "Invalid nextPaymentDate format", http.StatusBadRequest)
				return
			}
		}
		raw["nextPaymentDate"] = t
	}

	// 全体をSubscription構造体に変換
	jsonData, err := json.Marshal(raw)
	if err != nil {
		http.Error(w, "Failed to process data", http.StatusInternalServerError)
		return
	}

	var sub Subscription
	if err := json.Unmarshal(jsonData, &sub); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// IDとユーザーIDを設定
	sub.ID = subID
	sub.UserID = userIDStr

	// データベースを更新
	if err := h.subDB.Update(&sub); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Subscription not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(sub); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// UpdateStatus changes the subscription status.
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	subID, err := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	var statusUpdate struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&statusUpdate); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if statusUpdate.Status != subscriptionStatusActive &&
		statusUpdate.Status != subscriptionStatusCanceled &&
		statusUpdate.Status != subscriptionStatusExpired {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	if err := h.subDB.UpdateStatus(subID, userIDStr, statusUpdate.Status); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Subscription not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Delete removes a subscription.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	subID, err := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	if err := h.subDB.Delete(subID, userIDStr); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Subscription not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
