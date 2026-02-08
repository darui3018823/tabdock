// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

// Package wallpaper manages user wallpapers and storage.
package wallpaper

import (
	"database/sql"
	"log"
	"time"
)

// Wallpaper describes a stored wallpaper file.
type Wallpaper struct {
	ID           int64     `json:"id"`
	UserID       string    `json:"userId"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"originalName,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

// WallpaperDB handles wallpaper persistence.
//
//revive:disable-next-line:exported
type WallpaperDB struct {
	db *sql.DB
}

// NewWallpaperDB creates a WallpaperDB wrapper.
func NewWallpaperDB(db *sql.DB) *WallpaperDB {
	return &WallpaperDB{db: db}
}

// Create inserts a wallpaper record.
func (w *WallpaperDB) Create(wallpaper *Wallpaper) error {
	query := `
		INSERT INTO wallpapers (user_id, filename, original_name)
		VALUES (?, ?, ?)
	`

	result, err := w.db.Exec(query, wallpaper.UserID, wallpaper.Filename, wallpaper.OriginalName)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	wallpaper.ID = id
	return nil
}

// GetByUserID returns wallpapers for the user and defaults.
func (w *WallpaperDB) GetByUserID(userID string) ([]Wallpaper, error) {
	query := `
		SELECT id, user_id, filename, original_name, created_at
		FROM wallpapers
		WHERE user_id = ? OR user_id = 'default'
		ORDER BY created_at DESC
	`

	rows, err := w.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			log.Printf("Failed to close rows: %v", err)
		}
	}()

	var wallpapers []Wallpaper
	for rows.Next() {
		var wp Wallpaper
		var originalName sql.NullString
		err := rows.Scan(&wp.ID, &wp.UserID, &wp.Filename, &originalName, &wp.CreatedAt)
		if err != nil {
			return nil, err
		}
		wp.OriginalName = originalName.String
		wallpapers = append(wallpapers, wp)
	}
	return wallpapers, nil
}

// Delete removes a wallpaper by id and user.
func (w *WallpaperDB) Delete(id int64, userID string) error {
	query := `
		DELETE FROM wallpapers
		WHERE id = ? AND user_id = ? AND user_id != 'default'
	`

	result, err := w.db.Exec(query, id, userID)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
