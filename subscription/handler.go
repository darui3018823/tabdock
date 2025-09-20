package subscription

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type Handler struct {
	subDB     *SubscriptionDB
	getUserID func(*http.Request) (string, error)
}

func NewHandler(db *sql.DB, getUserID func(*http.Request) (string, error)) *Handler {
	return &Handler{
		subDB:     NewSubscriptionDB(db),
		getUserID: getUserID,
	}
}

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

	var sub Subscription
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if sub.NextPaymentDate.IsZero() {
		var raw map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&raw); err == nil {
			if v, ok := raw["nextPaymentDate"].(string); ok {
				var t time.Time
				var err error
				// ISO8601
				t, err = time.Parse("2006-01-02T15:04:05Z07:00", v)
				if err != nil {
					// YYYY-MM-DD
					t, err = time.Parse("2006-01-02", v)
				}
				if err == nil {
					sub.NextPaymentDate = t
				} else {
					http.Error(w, "Invalid nextPaymentDate format", http.StatusBadRequest)
					return
				}
			}
		}
	}

	sub.UserID = userID
	sub.Status = "active"

	if err := h.subDB.Create(&sub); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sub)
}

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
	json.NewEncoder(w).Encode(subs)
}

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
	json.NewEncoder(w).Encode(subs)
}

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

	if statusUpdate.Status != "active" && statusUpdate.Status != "cancelled" && statusUpdate.Status != "expired" {
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
