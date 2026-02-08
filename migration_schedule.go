package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

// LegacySchedule defines the structure of the old JSON format
type LegacySchedule struct {
	UserID      string `json:"userId,omitempty"` // Added for migration flexibility
	Title       string `json:"title"`
	Date        string `json:"date"`
	Time        string `json:"time"`
	EndTime     string `json:"endTime,omitempty"`
	Location    string `json:"location,omitempty"`
	Description string `json:"description,omitempty"`
	EmbedMap    string `json:"embedmap,omitempty"`
}

func migrateLegacySchedules() error {
	jsonPath := "./json/schedule.json"
	if !fileExists(jsonPath) {
		log.Println("No legacy schedule.json found. Skipping migration.")
		return nil
	}

	// 1. Get Users
	accDB, err := sql.Open("sqlite", "./database/acc.db")
	if err != nil {
		return fmt.Errorf("failed to open acc.db: %v", err)
	}
	defer func() {
		if err := accDB.Close(); err != nil {
			log.Printf("Failed to close accDB: %v", err)
		}
	}()

	rows, err := accDB.Query("SELECT id, username FROM users")
	if err != nil {
		// If users table likely doesn't exist or other error, assume default
		log.Printf("Could not query users (%v). Will use 'default' user.", err)
	}

	type User struct {
		ID       string
		Username string
	}
	var users []User

	if rows != nil {
		defer func() {
			if err := rows.Close(); err != nil {
				log.Printf("Failed to close rows: %v", err)
			}
		}()
		for rows.Next() {
			var u User
			if err := rows.Scan(&u.ID, &u.Username); err == nil {
				users = append(users, u)
			}
		}
	}

	if len(users) == 0 {
		// Fallback if no users found (should not happen in normal usage)
		users = append(users, User{ID: "default", Username: "Default User"})
	}

	// 2. Read JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to read json: %v", err)
	}

	var schedules []LegacySchedule
	if err := json.Unmarshal(data, &schedules); err != nil {
		return fmt.Errorf("failed to parse json: %v", err)
	}

	fmt.Printf("\n=== Schedule Migration (Found %d items) ===\n", len(schedules))
	fmt.Println("Existing users in DB:")
	for i, u := range users {
		fmt.Printf(" [%d] %s (ID: %s)\n", i+1, u.Username, u.ID)
	}
	fmt.Println("===========================================")

	// 3. Insert to DB
	// Ensure DB is initialized
	if err := initScheduleDB(); err != nil {
		return err
	}

	schedDB, err := sql.Open("sqlite", "./database/schedule.db")
	if err != nil {
		return fmt.Errorf("failed to open schedule.db: %v", err)
	}
	defer func() {
		if err := schedDB.Close(); err != nil {
			log.Printf("Failed to close schedDB: %v", err)
		}
	}()

	tx, err := schedDB.Begin()
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
		INSERT INTO schedules (user_id, title, date, time, end_time, location, description, embed_map)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer func() {
		if err := stmt.Close(); err != nil {
			log.Printf("Failed to close statement: %v", err)
		}
	}()

	scanner := bufio.NewScanner(os.Stdin)
	count := 0

	for i, s := range schedules {
		targetUserID := ""

		// Check if explicit userId is provided and valid
		if s.UserID != "" {
			for _, u := range users {
				if u.ID == s.UserID {
					targetUserID = u.ID
					break
				}
			}
			if targetUserID == "" {
				fmt.Printf("\n[Item %d/%d] Warning: JSON UserID '%s' not found in DB.\n", i+1, len(schedules), s.UserID)
			}
		}

		// If no valid target user resolved, prompt user
		if targetUserID == "" {
			fmt.Printf("\n[Item %d/%d] Assign User for:\n", i+1, len(schedules))
			fmt.Printf(" Title: %s\n", s.Title)
			fmt.Printf(" Date : %s %s\n", s.Date, s.Time)

			for {
				fmt.Printf("Select user (1-%d): ", len(users))
				if scanner.Scan() {
					input := strings.TrimSpace(scanner.Text())
					idx, err := strconv.Atoi(input)
					if err == nil && idx >= 1 && idx <= len(users) {
						targetUserID = users[idx-1].ID
						fmt.Printf(" -> Assigned to: %s\n", users[idx-1].Username)
						break
					}
					fmt.Println("Invalid selection. Please try again.")
				}
			}
		}

		_, err := stmt.Exec(
			targetUserID,
			s.Title,
			s.Date,
			s.Time,
			s.EndTime,
			s.Location,
			s.Description,
			s.EmbedMap,
		)
		if err != nil {
			log.Printf("Failed to insert schedule '%s': %v", s.Title, err)
			continue
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	fmt.Printf("\nSuccessfully migrated %d schedules.\n", count)

	// 4. Rename JSON
	bakPath := jsonPath + ".bak"
	if err := os.Rename(jsonPath, bakPath); err != nil {
		log.Printf("Warning: Failed to rename json file: %v. Please rename manually to avoid re-import.", err)
	} else {
		log.Printf("Renamed %s to %s", jsonPath, bakPath)
	}

	return nil
}
