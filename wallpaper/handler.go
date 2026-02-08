// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package wallpaper

import (
	"bytes"
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

const (
	MaxFileSize  = 50 << 20 // 50MB
	WallpaperDir = "home/wallpapers"
	KiloBytes    = 1024
	MegaBytes    = KiloBytes * KiloBytes
)

var AllowedExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

var AllowedMIMEs = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

type Handler struct {
	wallpaperDB *WallpaperDB
	getUserID   func(*http.Request) (string, error)
}

func NewHandler(db *sql.DB, getUserID func(*http.Request) (string, error)) *Handler {
	return &Handler{
		wallpaperDB: NewWallpaperDB(db),
		getUserID:   getUserID,
	}
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		if err.Error() == "http: request body too large" {
			http.Error(w, "File size exceeds 50MB limit", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		}
		return
	}

	file, handler, err := r.FormFile("wallpaper")
	if err != nil {
		http.Error(w, "ファイルを取得できません", http.StatusBadRequest)
		return
	}
	defer func() {
		if err := file.Close(); err != nil {
			log.Printf("Failed to close uploaded file: %v", err)
		}
	}()

	if handler.Size > MaxFileSize {
		http.Error(w, "File size exceeds 50MB limit", http.StatusRequestEntityTooLarge)
		return
	}

	ext := strings.ToLower(filepath.Ext(handler.Filename))
	if !AllowedExts[ext] {
		http.Error(w, "対応していないファイル形式です", http.StatusBadRequest)
		return
	}

	// MIME type validation
	sniffBuf := make([]byte, 512)
	n, err := file.Read(sniffBuf)
	if err != nil && err != io.EOF {
		http.Error(w, "ファイルの読み込みに失敗しました", http.StatusBadRequest)
		return
	}

	contentType := http.DetectContentType(sniffBuf[:n])
	if !AllowedMIMEs[contentType] {
		http.Error(w, "対応していないファイル形式です", http.StatusBadRequest)
		return
	}

	filename := uuid.New().String() + ext
	wallpaperDir := filepath.Clean(WallpaperDir)
	if err := os.MkdirAll(wallpaperDir, 0755); err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}

	destPath := filepath.Join(wallpaperDir, filename)
	destPath = filepath.Clean(destPath)
	if !strings.HasPrefix(destPath, wallpaperDir+string(os.PathSeparator)) {
		http.Error(w, "不正なファイルパスです", http.StatusBadRequest)
		return
	}

	out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}
	defer func() {
		if err := out.Close(); err != nil {
			log.Printf("Failed to close output file: %v", err)
		}
	}()

	reader := io.MultiReader(bytes.NewReader(sniffBuf[:n]), file)
	if _, err := io.Copy(out, reader); err != nil {
		http.Error(w, "ファイル保存に失敗しました", http.StatusInternalServerError)
		return
	}

	// Save to database
	wp := Wallpaper{
		UserID:       userID,
		Filename:     filename,
		OriginalName: handler.Filename,
	}
	if err := h.wallpaperDB.Create(&wp); err != nil {
		log.Printf("壁紙DB登録エラー: %v", err)
		http.Error(w, "データベース登録に失敗しました", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{
		"status":   "success",
		"filename": filename,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	wallpapers, err := h.wallpaperDB.GetByUserID(userID)
	if err != nil {
		http.Error(w, "壁紙一覧の取得に失敗しました", http.StatusInternalServerError)
		return
	}

	// Convert to relative paths for frontend
	files := make([]string, 0, len(wallpapers))
	for _, wp := range wallpapers {
		files = append(files, "home/wallpapers/"+wp.Filename)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"images": files,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

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
	if idStr == "" {
		http.Error(w, "IDが必要です", http.StatusBadRequest)
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "無効なIDです", http.StatusBadRequest)
		return
	}

	if err := h.wallpaperDB.Delete(id, userID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "壁紙が見つかりません", http.StatusNotFound)
			return
		}
		http.Error(w, "削除エラー", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "壁紙を削除しました",
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}
