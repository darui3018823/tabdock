# TabDock API ドキュメント

## ベースURL
APIはルートURLからの相対パスで提供されます（例: `https://your-server/api/`）。

## 認証 (Authentication)

認証が必要なエンドポイントは、通常ログインによるセッション、または適切なヘッダー（`X-Username`など、実装依存）を必要とします。

### ログイン
**POST** `/api/auth/login`
- **リクエストボディ:**
  ```json
  {
    "username": "user",
    "password": "password"
  }
  ```
- **レスポンス:**
  - `200 OK`: ログイン成功。
  - `401 Unauthorized`: 認証失敗。

### 新規登録
**POST** `/api/auth/register`
- **リクエストボディ:**
  ```json
  {
    "username": "user",
    "email": "user@example.com",
    "password": "password"
  }
  ```
- **レスポンス:**
  - `200 OK`: アカウント作成成功。

### ユーザー情報取得
**POST** `/api/auth/user-info`
- **リクエストボディ:**
  ```json
  {
    "username": "user"
  }
  ```
- **レスポンス:**
  - `200 OK`: ユーザー詳細（メール、プロフィール画像、ログイン時刻など）を返します。

### パスワード変更
**POST** `/api/auth/change-password`
- **リクエストボディ:**
  ```json
  {
    "currentPassword": "old_password",
    "newPassword": "new_password"
  }
  ```
- **レスポンス:**
  - `200 OK`: パスワード更新成功。

### プロフィール画像アップロード
**POST** `/api/upload-profile-image`
- **Content-Type:** `multipart/form-data`
- **フォームデータ:**
  - `username`: ユーザー名。
  - `profileImage`: 画像ファイル (jpg, png, gif)。
- **レスポンス:**
  - `200 OK`: 画像のパスを返します。

---

## スケジュール (Schedules)

### スケジュール取得
**GET** `/api/schedule`
- **ヘッダー:** `X-Username` (またはセッション)
- **レスポンス:**
  - `200 OK`: スケジュール一覧。

### スケジュール作成
**POST** `/api/schedule`
- **Content-Type:** `multipart/form-data`
- **フォームデータ:**
  - `json`: スケジュール詳細を含むJSON文字列 (`title`, `date`, `time`, `description` など)。
  - `attachment`: (任意) 添付ファイル。
- **レスポンス:**
  - `201 Created`: 作成成功。

### スケジュール削除
**DELETE** `/api/schedule`
- **クエリパラメータ:**
  - `id`: (任意) 削除するスケジュールID。省略した場合、ユーザーの**すべての**スケジュールが削除されます。
- **レスポンス:**
  - `200 OK`: 削除成功。

### シフト管理
**GET** `/api/shift`
- **レスポンス:** シフト一覧。

**POST** `/api/shift`
- **リクエストボディ:** シフトオブジェクトの配列。
  ```json
  [
    {
      "date": "2025-01-01",
      "time": "09:00",
      "endTime": "17:00",
      "location": "オフィス",
      "description": "仕事"
    }
  ]
  ```
- **レスポンス:**
  - `201 Created`

**DELETE** `/api/shift`
- **レスポンス:** ユーザーのすべてのシフトを削除します。

---

## 壁紙 (Wallpapers)

### 壁紙一覧取得
**GET** `/api/list-wallpapers`
- **レスポンス:**
  - `200 OK`: `images` 配列（相対パス）を含むJSON。

### 壁紙アップロード
**POST** `/api/upload-wallpaper`
- **Content-Type:** `multipart/form-data`
- **フォームデータ:**
  - `wallpaper`: 画像ファイル (最大 50MB, jpg/png/gif/webp)。
- **レスポンス:**
  - `200 OK`: アップロード成功。

### 壁紙削除
**DELETE** `/api/delete-wallpaper`
- **クエリパラメータ:**
  - `id`: 壁紙ID。
- **レスポンス:**
  - `200 OK`: 削除成功。

---

## サブスクリプション (Subscriptions)

### サブスク一覧取得
**GET** `/api/subscriptions/list`
- **レスポンス:** 全サブスクリプション一覧。

### 次回の支払い一覧
**GET** `/api/subscriptions/upcoming`
- **レスポンス:** 近日更新予定のサブスクリプション。

### サブスク作成
**POST** `/api/subscriptions`
- **リクエストボディ:** サブスク詳細を含むJSON (`service_name`, `amount`, `currency`, `billing_cycle`, `nextPaymentDate` など)。
- **レスポンス:**
  - `201 Created`

### サブスク更新
**PUT** `/api/subscriptions/update?id={id}`
- **リクエストボディ:** 更新内容を含むJSON。
- **レスポンス:**
  - `200 OK`

### ステータス更新
**PATCH** `/api/subscriptions/status?id={id}`
- **リクエストボディ:**
  ```json
  { "status": "active" }
  ```
  (ステータスは `active`, `cancelled`, `expired` のいずれか)
- **レスポンス:**
  - `200 OK`

### サブスク削除
**DELETE** `/api/subscriptions/delete?id={id}`
- **レスポンス:**
  - `204 No Content`

### 支払い更新処理
**POST** `/api/subscriptions/renew`
- **レスポンス:** 期限切れの支払いを更新した結果。

---

## システム・ステータス (System & Status)

### Ping
**GET** `/api/ping`
- **レスポンス:** `{"status": "ok"}`

### バージョン情報
**GET** `/api/version`
- **レスポンス:** `{"version": "x.y.z"}`

### システムステータス
**GET** `/api/status`
- **レスポンス:** PCのステータス情報（CPU, メモリ, バッテリー, 稼働時間など）。

### 天気予報プロキシ
**POST** `/api/weather`
- **リクエストボディ:** 天気API互換のJSON。
- **レスポンス:** 取得した天気データ。

### 祝日情報
**GET** `/api/holidays`
- **レスポンス:** 日付と祝日名のマッピングJSON。

### PWAステータス
**GET** `/api/pwa-status`
- **レスポンス:** クライアントでPWAが利用可能かどうかを示すJSON。
