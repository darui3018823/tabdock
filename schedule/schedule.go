// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

// Package schedule manages calendar schedules stored in SQLite.
package schedule

import (
	"database/sql"
	"log"
	"time"
)

// Schedule represents a calendar schedule entry.
type Schedule struct {
	ID          int64     `json:"id"`
	UserID      string    `json:"userId"`
	Title       string    `json:"title"`
	Date        string    `json:"date"`
	Time        string    `json:"time,omitempty"`
	EndTime     string    `json:"endTime,omitempty"`
	Location    string    `json:"location,omitempty"`
	Description string    `json:"description,omitempty"`
	Attachment  string    `json:"attachment,omitempty"`
	EmbedMap    string    `json:"embedmap,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ScheduleDB handles schedule persistence.
//
//revive:disable-next-line:exported
type ScheduleDB struct {
	db *sql.DB
}

// NewScheduleDB creates a ScheduleDB wrapper.
func NewScheduleDB(db *sql.DB) *ScheduleDB {
	return &ScheduleDB{db: db}
}

// Create inserts a new schedule entry.
func (s *ScheduleDB) Create(sched *Schedule) error {
	query := `
		INSERT INTO schedules (user_id, title, date, time, end_time, location, description, attachment, embed_map)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := s.db.Exec(
		query,
		sched.UserID,
		sched.Title,
		sched.Date,
		sched.Time,
		sched.EndTime,
		sched.Location,
		sched.Description,
		sched.Attachment,
		sched.EmbedMap,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	sched.ID = id
	return nil
}

// GetByUserID returns schedules for a user.
func (s *ScheduleDB) GetByUserID(userID string) ([]Schedule, error) {
	query := `
		SELECT id, user_id, title, date, time, end_time, location, description, attachment, embed_map, created_at
		FROM schedules
		WHERE user_id = ?
		ORDER BY date ASC, time ASC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			log.Printf("Failed to close rows: %v", err)
		}
	}()

	var schedules []Schedule
	for rows.Next() {
		var sched Schedule
		var timeVal, endTimeVal, locationVal, descVal, attachVal, embedVal sql.NullString
		err := rows.Scan(
			&sched.ID,
			&sched.UserID,
			&sched.Title,
			&sched.Date,
			&timeVal,
			&endTimeVal,
			&locationVal,
			&descVal,
			&attachVal,
			&embedVal,
			&sched.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		sched.Time = timeVal.String
		sched.EndTime = endTimeVal.String
		sched.Location = locationVal.String
		sched.Description = descVal.String
		sched.Attachment = attachVal.String
		sched.EmbedMap = embedVal.String
		schedules = append(schedules, sched)
	}
	return schedules, nil
}

// Delete removes a schedule by id and user.
func (s *ScheduleDB) Delete(id int64, userID string) error {
	query := `
		DELETE FROM schedules
		WHERE id = ? AND user_id = ?
	`

	result, err := s.db.Exec(query, id, userID)
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

// DeleteAll removes all schedules for a user.
func (s *ScheduleDB) DeleteAll(userID string) error {
	query := `DELETE FROM schedules WHERE user_id = ?`
	_, err := s.db.Exec(query, userID)
	return err
}

// DeleteByTitlePrefix removes schedules whose title starts with prefix.
func (s *ScheduleDB) DeleteByTitlePrefix(userID string, prefix string) error {
	query := `DELETE FROM schedules WHERE user_id = ? AND title LIKE ?`
	_, err := s.db.Exec(query, userID, prefix+"%")
	return err
}
