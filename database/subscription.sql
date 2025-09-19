-- サブスクリプションテーブルの作成
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'JPY',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    payment_method TEXT NOT NULL,
    payment_details TEXT,  -- JSON形式で保存
    next_payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES acc(id) ON DELETE CASCADE
);

-- 更新時のタイムスタンプを自動更新するトリガー
CREATE TRIGGER IF NOT EXISTS update_subscriptions_timestamp 
    AFTER UPDATE ON subscriptions
BEGIN
    UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;