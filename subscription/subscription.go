// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.

package subscription

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"
)

type Subscription struct {
	ID              int64           `json:"id"`
	UserID          string          `json:"userId"`
	ServiceName     string          `json:"serviceName"`
	PlanName        string          `json:"planName"`
	Amount          float64         `json:"amount"`
	Currency        string          `json:"currency"`
	BillingCycle    string          `json:"billingCycle"`
	PaymentMethod   string          `json:"paymentMethod"`
	PaymentDetails  json.RawMessage `json:"paymentDetails"`
	NextPaymentDate time.Time       `json:"nextPaymentDate"`
	Status          string          `json:"status"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

type RenewalResult struct {
	ID           int64  `json:"id"`
	ServiceName  string `json:"serviceName"`
	PreviousDate string `json:"previousDate"`
	NextDate     string `json:"nextDate"`
	BillingCycle string `json:"billingCycle"`
}

type PaymentDetails struct {
	CardLastFour string `json:"cardLastFour,omitempty"`
	PaypalEmail  string `json:"paypalEmail,omitempty"`
	MethodName   string `json:"methodName,omitempty"`
	Label        string `json:"label,omitempty"`
}

type SubscriptionDB struct {
	db *sql.DB
}

func NewSubscriptionDB(db *sql.DB) *SubscriptionDB {
	return &SubscriptionDB{db: db}
}

func calculateNextPaymentDate(current time.Time, billingCycle string) (time.Time, bool) {
	switch strings.ToLower(billingCycle) {
	case "monthly":
		return current.AddDate(0, 1, 0), true
	case "yearly":
		return current.AddDate(1, 0, 0), true
	case "weekly":
		return current.AddDate(0, 0, 7), true
	case "daily":
		return current.AddDate(0, 0, 1), true
	default:
		return time.Time{}, false
	}
}

func (s *SubscriptionDB) RenewOverduePayments(userID string, now time.Time) ([]RenewalResult, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	rows, err := tx.Query(`
                SELECT id, service_name, billing_cycle, next_payment_date
                FROM subscriptions
                WHERE user_id = ?
                  AND status = 'active'
                  AND next_payment_date < ?
        `, userID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []RenewalResult

	for rows.Next() {
		var sub Subscription
		err := rows.Scan(
			&sub.ID,
			&sub.ServiceName,
			&sub.BillingCycle,
			&sub.NextPaymentDate,
		)
		if err != nil {
			return nil, err
		}

		nextDate := sub.NextPaymentDate
		var ok bool
		// Loop until the next payment date is in the future
		for nextDate.Before(now) {
			nextDate, ok = calculateNextPaymentDate(nextDate, sub.BillingCycle)
			if !ok {
				// Stop if we have an invalid billing cycle to prevent infinite loops
				break
			}
		}

		// If we failed to calculate a valid future date, skip this subscription
		if !ok {
			continue
		}

		// Update existing subscription: set next payment date and updated_at
		_, err = tx.Exec(`
			UPDATE subscriptions 
			SET next_payment_date = ?, updated_at = ? 
			WHERE id = ?
		`, nextDate, now, sub.ID)
		if err != nil {
			return nil, err
		}

		results = append(results, RenewalResult{
			ID:           sub.ID,
			ServiceName:  sub.ServiceName,
			PreviousDate: sub.NextPaymentDate.Format("2006-01-02"),
			NextDate:     nextDate.Format("2006-01-02"),
			BillingCycle: sub.BillingCycle,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *SubscriptionDB) Create(sub *Subscription) error {
	query := `
		INSERT INTO subscriptions (
			user_id, service_name, plan_name, amount, currency,
			billing_cycle, payment_method, payment_details, next_payment_date, status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := s.db.Exec(
		query,
		sub.UserID,
		sub.ServiceName,
		sub.PlanName,
		sub.Amount,
		sub.Currency,
		sub.BillingCycle,
		sub.PaymentMethod,
		sub.PaymentDetails,
		sub.NextPaymentDate,
		"active",
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	sub.ID = id
	return nil
}

func (s *SubscriptionDB) GetByUserID(userID string) ([]Subscription, error) {
	query := `
		SELECT id, user_id, service_name, plan_name, amount, currency,
			   billing_cycle, payment_method, payment_details, next_payment_date,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE user_id = ? AND status = 'active'
		ORDER BY next_payment_date ASC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		err := rows.Scan(
			&sub.ID,
			&sub.UserID,
			&sub.ServiceName,
			&sub.PlanName,
			&sub.Amount,
			&sub.Currency,
			&sub.BillingCycle,
			&sub.PaymentMethod,
			&sub.PaymentDetails,
			&sub.NextPaymentDate,
			&sub.Status,
			&sub.CreatedAt,
			&sub.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

func (s *SubscriptionDB) GetUpcoming(userID string) ([]Subscription, error) {
	query := `
		SELECT id, user_id, service_name, plan_name, amount, currency,
			   billing_cycle, payment_method, payment_details, next_payment_date,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE user_id = ? 
		  AND status = 'active'
		  AND next_payment_date BETWEEN datetime('now') AND datetime('now', '+3 days')
		ORDER BY next_payment_date ASC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		err := rows.Scan(
			&sub.ID,
			&sub.UserID,
			&sub.ServiceName,
			&sub.PlanName,
			&sub.Amount,
			&sub.Currency,
			&sub.BillingCycle,
			&sub.PaymentMethod,
			&sub.PaymentDetails,
			&sub.NextPaymentDate,
			&sub.Status,
			&sub.CreatedAt,
			&sub.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

func (s *SubscriptionDB) Update(sub *Subscription) error {
	query := `
		UPDATE subscriptions
		SET service_name = ?, plan_name = ?, amount = ?, currency = ?,
			billing_cycle = ?, payment_method = ?, payment_details = ?, 
			next_payment_date = ?
		WHERE id = ? AND user_id = ?
	`

	result, err := s.db.Exec(
		query,
		sub.ServiceName,
		sub.PlanName,
		sub.Amount,
		sub.Currency,
		sub.BillingCycle,
		sub.PaymentMethod,
		sub.PaymentDetails,
		sub.NextPaymentDate,
		sub.ID,
		sub.UserID,
	)
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

func (s *SubscriptionDB) UpdateStatus(id int64, userID string, status string) error {
	query := `
		UPDATE subscriptions
		SET status = ?
		WHERE id = ? AND user_id = ?
	`

	result, err := s.db.Exec(query, status, id, userID)
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

func (s *SubscriptionDB) Delete(id int64, userID string) error {
	query := `
		DELETE FROM subscriptions
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
