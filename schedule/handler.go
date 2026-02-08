// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package schedule

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// CalendarDir is the base path for stored calendar attachments.
var (
	CalendarDir   = "./home/assets/calendar"
	ForbiddenExts = map[string]bool{
		".htaccess": true, ".php": true, ".asp": true, ".aspx": true,
		".bat": true, ".cmd": true, ".exe": true, ".sh": true, ".dll": true,
	}
)

// Handler serves schedule API requests.
type Handler struct {
	schedDB   *ScheduleDB
	getUserID func(*http.Request) (string, error)
}

// NewHandler returns a schedule handler with a DB accessor.
func NewHandler(db *sql.DB, getUserID func(*http.Request) (string, error)) *Handler {
	return &Handler{
		schedDB:   NewScheduleDB(db),
		getUserID: getUserID,
	}
}

// GetDB returns the underlying ScheduleDB for direct access (e.g., for shift sync)
// GetDB exposes the underlying ScheduleDB for internal use.
func (h *Handler) GetDB() *ScheduleDB {
	return h.schedDB
}

// Create registers a schedule entry.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err = r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		http.Error(w, "Form parse error", http.StatusBadRequest)
		return
	}

	// JSONパート
	jsonStr := r.FormValue("json")
	var sched Schedule
	if parseErr := json.Unmarshal([]byte(jsonStr), &sched); parseErr != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 添付ファイル（任意）
	file, handler, err := r.FormFile("attachment")
	if err != nil && err != http.ErrMissingFile {
		http.Error(w, "File error", http.StatusBadRequest)
		return
	}

	if handler != nil {
		defer func() {
			if err := file.Close(); err != nil {
				log.Printf("Failed to close uploaded file: %v", err)
			}
		}()
		ext := strings.ToLower(filepath.Ext(handler.Filename))
		if ForbiddenExts[ext] {
			log.Println("アップロード拒否: 禁止拡張子", ext, "ファイル名:", handler.Filename, "リモートアドレス:", r.RemoteAddr)
			http.Error(w, "Forbidden file type", http.StatusBadRequest)
			return
		}

		uuidName := uuid.New().String() + ext
		outPath := filepath.Join(CalendarDir, uuidName)

		out, err := os.Create(outPath)
		if err != nil {
			http.Error(w, "Save failed", http.StatusInternalServerError)
			return
		}
		defer func() {
			if err := out.Close(); err != nil {
				log.Printf("Failed to close output file: %v", err)
			}
		}()
		if _, err := io.Copy(out, file); err != nil {
			log.Printf("Failed to save attachment file: %v", err)
			http.Error(w, "Save failed", http.StatusInternalServerError)
			return
		}

		sched.Attachment = uuidName
	}

	sched.UserID = userID

	if err := h.schedDB.Create(&sched); err != nil {
		log.Printf("スケジュール登録エラー: %v", err)
		http.Error(w, "スケジュール登録に失敗しました", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sched); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// GetUserSchedules returns schedules for the current user.
func (h *Handler) GetUserSchedules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	schedules, err := h.schedDB.GetByUserID(userID)
	if err != nil {
		http.Error(w, "スケジュール取得エラー", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []Schedule{}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(schedules); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// Delete removes a schedule entry (or all entries) for the current user.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.URL.Query().Get("id")

	if idStr != "" {
		// 特定のスケジュールを削除
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, "無効なIDです", http.StatusBadRequest)
			return
		}

		if err := h.schedDB.Delete(id, userID); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "スケジュールが見つかりません", http.StatusNotFound)
				return
			}
			http.Error(w, "削除エラー", http.StatusInternalServerError)
			return
		}
	} else {
		// 全スケジュールを削除
		if err := h.schedDB.DeleteAll(userID); err != nil {
			http.Error(w, "削除エラー", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "スケジュールを削除しました",
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}
