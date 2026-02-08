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

	users, err := loadLegacyUsers()
	if err != nil {
		return err
	}

	schedules, err := readLegacySchedules(jsonPath)
	if err != nil {
		return err
	}

	printLegacyMigrationUsers(users, schedules)

	count, err := performLegacyMigration(users, schedules)
	if err != nil {
		return err
	}

	fmt.Printf("\nSuccessfully migrated %d schedules.\n", count)
	return renameLegacyScheduleFile(jsonPath)
}

type legacyUser struct {
	ID       string
	Username string
}

func loadLegacyUsers() ([]legacyUser, error) {
	accDB, err := sql.Open("sqlite", "./database/acc.db")
	if err != nil {
		return nil, fmt.Errorf("failed to open acc.db: %v", err)
	}
	defer func() {
		if closeErr := accDB.Close(); closeErr != nil {
			log.Printf("Failed to close accDB: %v", closeErr)
		}
	}()

	rows, err := accDB.Query("SELECT id, username FROM users")
	if err != nil {
		log.Printf("Could not query users (%v). Will use 'default' user.", err)
	}

	var users []legacyUser
	if rows != nil {
		defer func() {
			if closeErr := rows.Close(); closeErr != nil {
				log.Printf("Failed to close rows: %v", closeErr)
			}
		}()
		for rows.Next() {
			var u legacyUser
			if scanErr := rows.Scan(&u.ID, &u.Username); scanErr == nil {
				users = append(users, u)
			}
		}
	}

	if len(users) == 0 {
		users = append(users, legacyUser{ID: "default", Username: "Default User"})
	}

	return users, nil
}

func readLegacySchedules(jsonPath string) ([]LegacySchedule, error) {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read json: %v", err)
	}

	var schedules []LegacySchedule
	if parseErr := json.Unmarshal(data, &schedules); parseErr != nil {
		return nil, fmt.Errorf("failed to parse json: %v", parseErr)
	}

	return schedules, nil
}

func insertLegacySchedules(stmt *sql.Stmt, users []legacyUser, schedules []LegacySchedule) int {
	scanner := bufio.NewScanner(os.Stdin)
	count := 0

	for i, s := range schedules {
		targetUserID := resolveLegacyUserID(scanner, users, s, i, len(schedules))
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

	return count
}

func resolveLegacyUserID(scanner *bufio.Scanner, users []legacyUser, s LegacySchedule, index int, total int) string {
	if s.UserID != "" {
		for _, u := range users {
			if u.ID == s.UserID {
				return u.ID
			}
		}
		fmt.Printf("\n[Item %d/%d] Warning: JSON UserID '%s' not found in DB.\n", index+1, total, s.UserID)
	}

	for {
		fmt.Printf("\n[Item %d/%d] Assign User for:\n", index+1, total)
		fmt.Printf(" Title: %s\n", s.Title)
		fmt.Printf(" Date : %s %s\n", s.Date, s.Time)
		fmt.Printf("Select user (1-%d): ", len(users))
		if scanner.Scan() {
			input := strings.TrimSpace(scanner.Text())
			idx, err := strconv.Atoi(input)
			if err == nil && idx >= 1 && idx <= len(users) {
				fmt.Printf(" -> Assigned to: %s\n", users[idx-1].Username)
				return users[idx-1].ID
			}
			fmt.Println("Invalid selection. Please try again.")
		}
	}
}

func printLegacyMigrationUsers(users []legacyUser, schedules []LegacySchedule) {
	fmt.Printf("\n=== Schedule Migration (Found %d items) ===\n", len(schedules))
	fmt.Println("Existing users in DB:")
	for i, u := range users {
		fmt.Printf(" [%d] %s (ID: %s)\n", i+1, u.Username, u.ID)
	}
	fmt.Println("===========================================")
}

func performLegacyMigration(users []legacyUser, schedules []LegacySchedule) (int, error) {
	if initErr := initScheduleDB(); initErr != nil {
		return 0, initErr
	}

	schedDB, err := sql.Open("sqlite", "./database/schedule.db")
	if err != nil {
		return 0, fmt.Errorf("failed to open schedule.db: %v", err)
	}
	defer func() {
		if closeErr := schedDB.Close(); closeErr != nil {
			log.Printf("Failed to close schedDB: %v", closeErr)
		}
	}()

	tx, err := schedDB.Begin()
	if err != nil {
		return 0, err
	}

	stmt, err := tx.Prepare(`
		INSERT INTO schedules (user_id, title, date, time, end_time, location, description, embed_map)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil && rollbackErr != sql.ErrTxDone {
			log.Printf("Failed to rollback transaction: %v", rollbackErr)
		}
		return 0, err
	}
	defer func() {
		if closeErr := stmt.Close(); closeErr != nil {
			log.Printf("Failed to close statement: %v", closeErr)
		}
	}()

	count := insertLegacySchedules(stmt, users, schedules)
	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}

func renameLegacyScheduleFile(jsonPath string) error {
	bakPath := jsonPath + ".bak"
	if err := os.Rename(jsonPath, bakPath); err != nil {
		log.Printf("Warning: Failed to rename json file: %v. Please rename manually to avoid re-import.", err)
		return nil
	}
	log.Printf("Renamed %s to %s", jsonPath, bakPath)
	return nil
}
