# TabDock API Documentation

## Base URL
The API is served relative to the root URL (e.g., `https://your-server/api/`).

## Authentication (Auth)

All authenticated endpoints require a session context, usually established via login or a valid `X-Username` header (depending on internal implementation details, but primarily session-based).

### Login
**POST** `/api/auth/login`
- **Body:**
  ```json
  {
    "username": "user",
    "password": "password"
  }
  ```
- **Response:**
  - `200 OK`: Login successful.
  - `401 Unauthorized`: Invalid credentials.

### Register
**POST** `/api/auth/register`
- **Body:**
  ```json
  {
    "username": "user",
    "email": "user@example.com",
    "password": "password"
  }
  ```
- **Response:**
  - `200 OK`: Account created.

### Get User Info
**POST** `/api/auth/user-info`
- **Body:**
  ```json
  {
    "username": "user"
  }
  ```
- **Response:**
  - `200 OK`: Returns user details (email, profile image, login time).

### Change Password
**POST** `/api/auth/change-password`
- **Body:**
  ```json
  {
    "currentPassword": "old_password",
    "newPassword": "new_password"
  }
  ```
- **Response:**
  - `200 OK`: Password updated.

### Upload Profile Image
**POST** `/api/upload-profile-image`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `username`: The username.
  - `profileImage`: The image file (jpg, png, gif).
- **Response:**
  - `200 OK`: Returns file path.

---

## Schedules

### Get Schedules
**GET** `/api/schedule`
- **Headers:** `X-Username` (or session)
- **Response:**
  - `200 OK`: List of schedules.

### Create Schedule
**POST** `/api/schedule`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `json`: JSON string containing schedule details (`title`, `date`, `time`, `description`, etc.).
  - `attachment`: (Optional) File attachment.
- **Response:**
  - `201 Created`: Schedule created.

### Delete Schedule
**DELETE** `/api/schedule`
- **Query Params:**
  - `id`: (Optional) Schedule ID to delete. If omitted, **ALL** schedules for the user are deleted.
- **Response:**
  - `200 OK`: Deletion successful.

### Shift Management
**GET** `/api/shift`
- **Response:** List of shifts.

**POST** `/api/shift`
- **Body:** JSON array of shift objects.
  ```json
  [
    {
      "date": "2025-01-01",
      "time": "09:00",
      "endTime": "17:00",
      "location": "Office",
      "description": "Work"
    }
  ]
  ```
- **Response:**
  - `201 Created`

**DELETE** `/api/shift`
- **Response:** Deletes all shifts for the user.

---

## Wallpapers

### List Wallpapers
**GET** `/api/list-wallpapers`
- **Response:**
  - `200 OK`: JSON object with `images` array (relative paths).

### Upload Wallpaper
**POST** `/api/upload-wallpaper`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `wallpaper`: Image file (max 50MB, jpg/png/gif/webp).
- **Response:**
  - `200 OK`: Upload successful.

### Delete Wallpaper
**DELETE** `/api/delete-wallpaper`
- **Query Params:**
  - `id`: Wallpaper ID.
- **Response:**
  - `200 OK`: Deleted.

---

## Subscriptions

### List Subscriptions
**GET** `/api/subscriptions/list`
- **Response:** List of all subscriptions.

### Get Upcoming Renewals
**GET** `/api/subscriptions/upcoming`
- **Response:** Subscriptions renewing soon.

### Create Subscription
**POST** `/api/subscriptions`
- **Body:** JSON object with subscription details (`service_name`, `amount`, `currency`, `billing_cycle`, `nextPaymentDate`, etc.).
- **Response:**
  - `201 Created`

### Update Subscription
**PUT** `/api/subscriptions/update?id={id}`
- **Body:** JSON object with updated details.
- **Response:**
  - `200 OK`

### Update Status
**PATCH** `/api/subscriptions/status?id={id}`
- **Body:**
  ```json
  { "status": "active" }
  ```
  (Status can be `active`, `cancelled`, `expired`)
- **Response:**
  - `200 OK`

### Delete Subscription
**DELETE** `/api/subscriptions/delete?id={id}`
- **Response:**
  - `204 No Content`

### Renew Payments
**POST** `/api/subscriptions/renew`
- **Response:** Result of renewal process for overdue subscriptions.

---

## System & Status

### Ping
**GET** `/api/ping`
- **Response:** `{"status": "ok"}`

### Version
**GET** `/api/version`
- **Response:** `{"version": "x.y.z"}`

### System Status
**GET** `/api/status`
- **Response:** Returns PC stats (CPU, Memory, Battery, etc.).

### Weather Proxy
**POST** `/api/weather`
- **Body:** JSON object compatible with the upstream weather API.
- **Response:** Proxied weather data.

### Holidays
**GET** `/api/holidays`
- **Response:** JSON object of holidays (date -> name).

### PWA Status
**GET** `/api/pwa-status`
- **Response:** JSON object indicating if PWA is supported on the client device.
