# Release Notes (Generated from Git History)

Range: `d30d768` ... `0bc8210`

# Release Highlights (v3 - v5)

## v5

### Major Changes
- **Subscription Management Integration**: Implemented comprehensive subscription management including payment history tracking, notifications, and payment method management. (v5.0.0~)
- **Calendar Functionality**: Added a dynamic calendar UI which includes schedule management capabilities. (v5.15.0~)
- **Security Enhancements**: Significantly strengthened security with request rate limiting, dynamic blocking, and IP filtering. (v5.5.0, v5.16.x)
- **Database Migration**: Migrated schedule and wallpaper management from JSON to SQLite, optimizing data management for individual users. (v5.18.0, v5.19.3)

### Medium Changes
- **UI Overhaul**: Significantly improved UI/UX by introducing Glassmorphism, implementing Toast notifications, and improving payment popups. (v5.3.0)
- **Automation Scripts**: Added PowerShell scripts to automate building, signing, and updating for Windows (amd64). (v5.19.3, v5.20.0)
- **Account & Payment Improvements**: Added PayPal support, implemented dynamic field display for payment methods, and improved cancellation processing. (v5.2.1)

## v4

### Major Changes
- **Get Status Port to Golang**: Ported the system status retrieval logic to Golang, improving performance and stability. (v4.0.0)
- **Cross-Platform Support**: Enhanced environment compatibility by supporting PowerShell 5 and allowing the use of shell scripts (sh). (v4.0.0)

### Medium Changes
- **Frontend Refactoring**: Refined the frontend codebase and enforced UTF-8 encoding. (v4.0.0)

## v3

### Major Changes
- **Account Management System**: Built the foundation for account management, including user registration, login, and session management. (v3-alpha)
- **WebAuthn (Passkey) Support**: Implemented WebAuthn registration and authentication flows to enable passwordless login. (v3-alpha)

### Medium Changes
- **Database Management**: Introduced SQLite (modernc.org/sqlite) to start persisting user data and authentication capabilities. (v3-alpha)

---

## Latest (Post-release) (2026-02-08)

### Features
- Implement git update check to conditionally set the update flag. (468dd04)

### Bug Fixes
- Add error handling for resource cleanup and JSON encoding (9745dea)
- fix lint warnings and refactors (0e15dce)

### Improvements
- rearrange build steps for clarity and consistency (ac28482)
- Refactor .golangci.yml for improved linter settings (6d0ac75)
- Refactor .golangci.yml by simplifying linter settings (188cb97)

### Maintenance
- update golangci-lint to v1.64 (f202747)
- update .golangci.yml to align with Sem (c0b42d7)
- bump golang.org/x/sys from 0.40.0 to 0.41.0 (f7e099a)
- bump actions/checkout from 4 to 6 (9129ad5)
- bump actions/setup-go from 5 to 6 (0aa168c)
- bump modernc.org/sqlite from 1.44.3 to 1.45.0 (c1c6dce)
- bump golang.org/x/mod from 0.32.0 to 0.33.0 (b7ff289)
- bump golang.org/x/crypto from 0.47.0 to 0.48.0 (96a0d52)
- bump golangci/golangci-lint-action from 6 to 9 (32ef4ba)

### Other
- Update golangci-lint version to latest (0764ca8)
- Update .golangci.yml configuration (e6d249c)
- Remove typecheck from golangci-lint configuration (97f3b3e)
- Update .golangci.yml (8357fef)
- Remove goimports from linter configuration (919a15d)
- Remove unused linters from golangci configuration (c11a569)

## v5.20.0 (2026-02-08)

### Features
- Add cross-platform PowerShell automation scripts for build, setup, and signing, along with a security configuration example. (a70896f)

### Bug Fixes
- update Japanese README link and add new Japanese README file (4838065)

### Documentation
- add API documentation for English and Japanese (439f146)

### Maintenance
- remove a file. (329adf7)
- delete file (36bc86d)
- update .gitignore to include new database and JSON backup files (da494ee)
- add golangci-lint workflow and configuration (e2c9f09)
- add github.com/joho/godotenv dependency (24fa78b)

### Other
- Update .gitignore (cc0c54d)
- sem: refactor to use environment variables for configuration (3d096d4)
- sem: bump version to 5.20.0 (36b028a)

## v5.19.7 (2026-02-02)

### Features
- add interactive CLI tool for migrating legacy JSON schedules (v5.19.7) (1396b02)

## v5.19.6 (2026-02-02)

### Features
- add automatic cleanup for unlinked wallpapers (convert to public) (43d67ee)

### Bug Fixes
- inject X-Username header via global fetch interceptor to resolve 401 unauthorized errors (cd0a5dd)
- encode username in fetch interceptor to support multibyte characters (v5.19.6) (0bb6cce)

## v5.19.3 (2026-02-02)

### Features
- migrate wallpaper management to user-specific SQLite database (a3069aa)
- add subscription status toggle functionality (66ea5e1)
- Add a PowerShell script to automate Windows amd64 build, update, and code signing processes. (adf7d2d)
- Add `amd64_win_autorun.ps1` for automated Windows amd64 build, signing, and execution with update handling. (54504e1)

### Bug Fixes
- correct image path prefix and bump version to 5.19.3 (32abfe3)

### Improvements
- remove client-side schedule filtering as backend now handles user-specific data (be2f0c2)

### Documentation
- add v5 updates to changelog in main.go (33a4a05)

### Other
- home: Fix PC status color not resetting when going from Offline to Online (7b95d0a)

## v5.18.0 (2026-02-02)

### Features
- migrate schedule storage to SQLite database and separate to schedule package (b66729e)

### Maintenance
- Bump application version to 5.18.0. (93bc5b9)

## v5.17.0 (2026-01-27)

### Features
- add update flag handling and signing process for builds (e2db9d7)
- add update flag handling and clean up environment variable loading (7c1e425)

### Bug Fixes
- resolve timezone issue in subscription notifications (3ddf031)
- simplify date formatting in subscription notifications (18cd298)
- refine date logic with sv-SE locale and Math.round (b9123e3)
- update version number to 5.16.3_subsc-r1 (e90393d)

### Improvements
- extract toLocalDateString as class method (33ab483)

### Maintenance
- bump modernc.org/sqlite from 1.41.0 to 1.42.2 (230966b)
- bump golang.org/x/sys from 0.39.0 to 0.40.0 (eca1d72)
- bump modernc.org/sqlite from 1.42.2 to 1.43.0 (f56d124)
- bump golang.org/x/mod from 0.31.0 to 0.32.0 (3e47c2b)
- bump golang.org/x/crypto from 0.46.0 to 0.47.0 (74a707b)
- bump modernc.org/sqlite from 1.43.0 to 1.44.2 (cc46130)
- bump modernc.org/sqlite from 1.44.2 to 1.44.3 (08f9906)

### Other
- Update Latest Version (b060d18)
- Update License (9a10a01)
- 確認不足 (bba92f8)
- Remove Comentout (788ac07)
- Update PC status logic to handle offline state and bump version to 5.17.0 (bad0b42)

## v5.16.2-patch3 (2025-12-26)

### Bug Fixes
- Fix performance bottleneck and race condition in first-access IP tracking (1eeca97)
- fix (88566e7)

### Improvements
- apply code review fixes (375dec3)
- derive threshold map keys from constants (b483562)
- separate security mode logic in final score check (bd7efd8)
- remove redundant condition in strict mode check (489c8ce)

### Other
- Remove log_test.go as requested (5ad2fb3)
- Apply feedback: update timer on any score increase and add scoring in balanced-secure mode (7112114)
- Block high-severity attacks immediately even during grace period (1a1512d)
- Update log.go (eceeb76)
- Update log.go (754190f)
- Update log.go (0a3900b)
- Update log.go (9d35980)
- Block DoS/exploit attempts immediately and make Cloudflare requirement optional (248b5ed)
- Rename internalLevelBoost to nonCloudflareBoost for clarity (2248b40)
- Add comprehensive documentation comments to security functions (8e53542)
- Update log.go (17adba3)
- version to 5.16.2-patch3 (69f3f08)

## v5.16.0 (2025-12-22)

### Features
- add support for weekly and daily billing cycles in payment date calculation (20c8e41)

### Bug Fixes
- improve HTML escaping for payment popup and enhance next payment date calculation logic (44ad342)

### Improvements
- simplify next payment date calculation logic (55bf7e4)
- Refactor subscription UI logic and apply CSS fixes (216346a)

### Maintenance
- bump golang.org/x/mod from 0.30.0 to 0.31.0 (b3a243b)
- bump golang.org/x/sys from 0.38.0 to 0.39.0 (bf56529)
- bump golang.org/x/crypto from 0.45.0 to 0.46.0 (bc6097b)
- bump modernc.org/sqlite from 1.40.1 to 1.41.0 (2997b48)

### Other
- Adjust SweetAlert text color for payment popup (e447f1a)
- Update home/subscription_calendar.js (924d62b)
- Update home/subscription_calendar.js (631af85)
- Update home/subscription_calendar.js (cd025fa)
- Update SECURITY.md (cfa22d3)
- checkForUpdates function call added to serve for improved update handling (0ec82ea)
- ポート設定のロジックを改善 (5ce4db9)
- devtools: add subscription preview popup (7b22231)
- 不要なコードを削除 (b7b50c3)
- Initial plan (9730d5d)
- Implement balanced-secure mode with graduated scoring and auto-reset (07325f2)
- Add unit tests for balanced-secure mode functionality (9a01940)
- Address code review feedback: fix race conditions and improve logic (ad493f2)
- Update version to 5.16.0 for balanced-secure mode release (128683f)

## v5.15.3 (2025-12-02)

### Bug Fixes
- remove unused verifyPassword function and fix variable declaration (90284ba)

### Improvements
- adjust swal text color for payment popup (ccbfa2e)

### Maintenance
- resolve merge conflicts in subscription renewal logic (02a15a0)

### Other
- adjust swal text color for payment popup (46b1c7a)
- subscription: update overdue payment to store next payment date (654502c)
- Version 5.15.1 - Add logging to payment renewal handler (f0d4f3b)
- Update subscription/subscription.go (7f3f83e)
- Update subscription/subscription.go (547bd24)
- Update home/subscription_calendar.js (72a08a8)
- Update home/subscription_calendar.js (c1ad7de)
- v5.15.3: Adjust Swal text color and improve subscription renewal logic (23d4106)

## v5.15.0 (2025-12-02)

### Features
- enhance devtools, subscriptions, and account tools (8dd6766)
- Enhance security logging and UI features (cb3d0a1)
- implement subscription management with payment tracking and notifications. (38121a7)
- Add core styling for home page layout, modals, and burn-in protection. (1679897)
- implement calendar functionality with holiday and schedule management. (0427614)
- Add calendar view with dynamic schedule and holiday display. (15b800d)
- Add calendar component with schedule display and holiday integration (a89640c)
- Introduce a new JavaScript-based calendar view with schedule and holiday management. (0f607dd)
- implement a dynamic calendar with schedule display and holiday integration (da1e669)
- add calendar component with schedule and holiday display, and bump application version. (3b16739)
- Add calendar functionality (aac7317)
- Introduce calendar UI for displaying holidays and schedules, and update application version. (51b5f45)
- Introduce calendar view with holiday and schedule integration. (f6aead3)
- Add calendar UI with date navigation, holiday integration, and schedule display. (1f2175d)
- Implement calendar view with schedule display, holiday integration, and schedule form functionality. (be5dedc)
- implement calendar functionality with schedule display and form handling (01edc98)
- Implement interactive calendar with schedule display and holiday integration. (d65fadd)

### Bug Fixes
- fix (ab0f041)
- Fix burn-in overlay and wallpaper storage issues (c14496c)
- fix (cdbbc61)
- fix (06be624)
- fix (b893cdb)
- fix (82b2c37)
- fix (da70986)
- fix (17b03c6)
- fix (1118707)
- fix (ac0c48b)
- fix (d69e861)

### Improvements
- Remove unused burn-in styles and detail section from CSS (cac0211)

### Other
- Codexのミスを修正 (28888f0)
- タイムアウトを延長 (13e5f4b)
- Bump modernc.org/sqlite from 1.39.0 to 1.39.1 (ba4fce0)
- home: reschedule subscription reminders after updates (0b96665)
- add comment (8cd264d)
- Improve subscription workflows and devtools tooling (607cfda)
- ファイルアップロードのサイズ制限を50MBに引き上げ、エラーメッセージを改善 (66aec03)
- home: allow importing schedules from ics files (e32db58)
- update (63dbb94)
- Add manifest.json for PWA configuration with app details and icon (f0f4444)
- jsonを追加 (3176bf9)
- rename (362a333)
- typo (02a4958)
- start_urlの更新 (13d26ed)
- srcの更新 (9ea35fb)
- Harden auth hashing and subscription notifications (1a0b3f7)
- Secure password change session binding (c25b14b)
- All operations and checks have been completed, so I will update to version 5.9. (7922a81)
- pwaの問題を修正しました (68709e2)
- 依存関係の更新 (f5a42d0)
- bcryptによるハッシュ化を実装する前に作成したユーザーのパスワードに対する調整 (28cd72f)
- 遅延読み込みの追加 (c8da878)
- サブスクリプションの再処理を強化 (0c23d34)
- CQL v3の廃止に対応 (b0f7185)
- Bump actions/checkout from 4 to 5 (32e914a)
- Bump github/codeql-action from 3 to 4 (84219a8)
- Bump actions/setup-go from 4 to 6 (a237894)
- いくつかのMarkdownを更新しました (9abd494)
- 修正 (d2acf8e)
- 一部文面の書き換え (bfb37cf)
- 改行忘れ (a083d3c)
- バージョンの自動取得/通知を追加 (08f4840)
- ログを追加 (cd54393)
- URLを調整 (9e3d058)
- 一部モーダル等の視認性の向上 (77c4b70)
- 背景の詳細設定の実装 (6b8d781)
- 文字化けの問題を修正 (187540a)
- GeoLiteの追加 (23dc04e)
- distの削除 (fc88c54)
- 静的アセットにリミットの無効化 (a96ac93)
- 緩和モードの追加 (073e1f5)
- relaxedの強化 (85c9646)
- Bump modernc.org/sqlite from 1.40.0 to 1.40.1 (1455c84)
- Bump golang.org/x/crypto from 0.44.0 to 0.45.0 (10008ba)
- Bump actions/checkout from 5 to 6 (c8096ed)
- Revert SweetAlert popup styling (1d175ef)
- home: refactor counters and filesize helper (14d7658)
- Simplify detail toggle selectors (5eed015)
- Improve detail field labeling (b0efedb)
- home: simplify attachment label (72353c1)
- home: restore modal scrollability (b41cf33)
- home: refactor regular form helpers (29ad059)
- home: improve memo newline handling (a422f8e)
- home: cache detail toggle and reset times (ac767aa)
- Revert "We've made the modal for adding regular events easier to use." (c9edb6b)
- Add latest version file (58c1730)
- remove coment (22165c1)
- Gemini Code Assistからの要求に対応, 修正 (e646bea)
- Update home/calendar.js (0a6aa7f)
- Update home/calendar.js (dbb1045)
- Update home/calendar.js (e8557d8)
- Update home/calendar.js (97b8c17)
- 改行文字を追加 (94dd44b)
- Update home/calendar.js (200379d)
- Update home/calendar.js (30bd6be)
- Update home/calendar.js (ae2bf95)
- Update home/style.css (6285e61)
- Update home/calendar.js (d926dfd)
- Update home/calendar.js (fcb7c98)
- Update home/calendar.js (c4bdcc1)
- Update home/index.html (f54aacb)
- Update home/calendar.js (43aa53f)
- Update home/calendar.js (abed907)
- Update home/calendar.js (b754dec)
- Update home/calendar.js (3fd541b)
- Update supported version in SECURITY.md to reflect the latest stable version (937b28e)
- a (42cd742)
- HTTP/HTTPS mode enhancements: fallback to HTTP if certificates are not found, and improved port handling. (82ebdcd)
- subscription: renew overdue payments via backend (ebd575c)
- home: bump JS version headers to 5.15.0 (1aa3310)

## v5.5.0 (2025-10-10)

### Features
- 完全同期の強化とシフト削除機能の修正 (88c9e66)
- サブスクリプションリストの表示を改善し、スクロール制限を追加 (dc7e748)
- 通知と支払いの合計計算を改善し、通貨のフォーマット機能を追加 (429da16)
- セキュリティ機能を大幅に強化し、リクエストのレート制限と動的ブロックを追加 (0541ac8)

### Bug Fixes
- 通貨合計の表示形式を改善し、区切り文字を変更 (0000fa1)

### Improvements
- split getstatus implementation by OS using build tags (5a2667c)

### Other
- typo (da42242)
- 不要になったため削除 (efccb15)
- 少々処理負荷を向上 (ad60578)
- Subscriptionが自動的に次の支払日へ移行するように (87e3c6b)
- Windowsに変更 (3fcc612)
- 忘れ (042d630)
- Update dependabot.yml (4f62e0e)
- Bump modernc.org/sqlite from 1.38.0 to 1.39.0 (df15813)
- Revise SECURITY.md with supported versions and reporting (26fbab8)
- Goのバージョンを1.24に変更 (e75f2b5)
- IPフィルタリングを強化し、信頼されたIPおよびプライベートIPに対するスコアの増加とレート制限のチェックを無効化 (b142cc1)
- Add third-party licenses section to README (749023f)
- TwCss, Swalが読み込めない問題を修正 (ffea0e2)
- 忘れ (2d1548c)
- update notice (de90c62)
- Bump golang.org/x/sys from 0.36.0 to 0.37.0 (82124e6)
- subscription.jsのイベントリスナーを修正, AGENTS.mdを作成 (d8e3c09)
- security: validate proxy IPs and wallpaper uploads (7da72f8)
- Bump version identifiers to 5.5.0 (4dc0ebf)

## v5.3.0 (2025-09-21)

### Other
- v5.3.0 - すりガラス化へ (435b42f)

## v5.2.1 (2025-09-21)

### Bug Fixes
- fix (5204ecd)
- fix (1eef3ec)
- fix (93875bd)
- fix (0f1bbac)

### Other
- Logoを表示できるように (92f0bcb)
- h-6へ (4fb12c9)
- paypalを追加 (ae3eab1)
- 編集できるように (47009f6)
- 支払い方法の詳細情報を追加し、選択に応じたフィールドを動的に表示する機能を実装 (27cf06e)
- 記載されていなかったので記載 (8a45b6e)
- 支払い方法のロゴを更新し、支払い方法変更時のフィールド動的表示機能を追加 (5992f3a)
- 不要なコメントを削除/サブスクリプション管理ボタンの設定を改善し、支払い方法変更時のフィールド表示を最適化。 (c2c63fa)
- 支払方法を編集できるようにし、最適化 (7052411)
- 解約した場合の削除処理を作成 (566fe2c)
- v5.2.1 - 省略する処理を追加 (0d3e72c)

## v5.0.0 (2025-09-20)

### Bug Fixes
- fix (7b4d601)
- fix (818668b)
- fix (7378b49)
- fix (e343869)
- fix (16b41b0)
- fix (14a8dd6)
- fix (4488019)
- fix (00e63ff)

### Other
- UTF-8を強制 (2951f7e)
- フロントエンドの改修 (7ef419e)
- PowerShellの使用を削減 (c057654)
- PowerShell 5に変更、shも利用可能に (0091676)
- profileのIconを返すように修正 (f1582c3)
- tidy (7104882)
- フロント側でも取得を試行するように (6ef6687)
- 文字数制限を設置 (9eefcfc)
- localstorageの利用 (2085cd5)
- Swalの種類を修正 (2a9f9d7)
- Toast.jsの作成 (49ca44b)
- A-Zに並び替え (6b96e22)
- A-Zに並び替え (8793c8b)
- v5 - サブスクリプション管理の組み込み (c5aa25a)
- 機能の実装を予定 (b72ad16)
- サブスクリプション管理モジュールのUI改善とユーザー情報の取得機能を追加 (b83a856)
- Str形に統一 (bbcea5f)
- 日付のパースに関する問題を修正 (8ad8ac4)
- dbを修正 (9a3895a)
- カレンダーへ組み込み (3e10a65)
- v5.0.0 (914e179)

## v4.0.0 (2025-09-17)

### Bug Fixes
- fix (e402154)
- fix (83c8a98)
- fix (42110e7)
- fix (5074aab)
- fix (d20c604)
- fix (1e3a644)
- fix (9b08d54)

### Improvements
- test用に127へ (ca2527a)

### Other
- v3-alpha (eb5c2f8)
- WebAuthn機能の追加とビルドスクリプトの修正 (16eef3d)
- アカウント管理機能の追加 (7d633d1)
- アカウント管理機能の改善とデータベースの初期化処理を追加 (f1e4760)
- パスキー登録機能の改善とエラーハンドリングの追加 (7c0b3a6)
- ユーザー登録時のエラーログ追加 (d3dffd4)
- 409の追加 (aa872bd)
- RPIDの変更忘れ (8801aea)
- Local DNSを使う前提を追加、tabdock.daruks.comへ (628f3f0)
- message change (bd21646)
- 表記ミス (0a83ce1)
- WebAuthnログイン機能を追加 (f392db4)
- 127は除外するように (b01e37d)
- チェックを追加 (e73afe6)
- passkey.jsを追加 (0d093e5)
- startLogin関数のエラーハンドリングを改善し、JSONパース失敗時のエラーメッセージを追加。 (99b5ce1)
- 完全スルー化 (7c70769)
- secureHandler関数で127.0.0.1、::1、localhostを許可し、/api/webauthn/へのアクセスを完全スルー化 (0aee6ac)
- HandleWebAuthnRegisterFinish関数を追加し、ユーザーのWebAuthn登録を完了させる処理を実装。credential情報をDBに保存する機能を追加。 (bc74607)
- ハンドラの追加 (9d8fbb7)
- HandleWebAuthnRegisterFinish関数のリクエストボディを修正し、ユーザー名の検証を追加。セッションデータの存在確認を強化し、エラーハンドリングを改善。 (0506ce7)
- HandleWebAuthnRegisterFinish関数のリクエストボディを修正し、ユーザー名の検証を強化。セッションデータの取得方法を改善し、エラーハンドリングを向上させるための変更を実施。 (972a639)
- ユーザー情報の変換を行う関数を追加。 (cb0bcc5)
- HandleWebAuthnRegisterFinish関数のリクエストボディにcredentialフィールドを追加 (f314532)
- bufferToBase64url関数を追加し、パスキー登録時のデータエンコード処理を改善 (a6c333a)
- bufferToBase64url関数の実装を改善し、forループ方式で安全に変換するように修正。HandleWebAuthnRegisterFinish関数でのリクエストボディのエラーハンドリングを強化し、デバッグ情報を追加。 (bb6e17c)
- handlePasskeyRegistration関数のリクエストボディを修正し、credentialフィールドをオブジェクト形式で構築。認証情報の作成処理を明確化。 (c76ea87)
- go.modとgo.sumの依存関係を更新し、SQLiteドライバをmodernc.org/sqliteに変更。passkey.jsでbase64urlエンコーディングを適用し、webauthn.goでのユーザー処理を改善。 (b36099b)
- PC Statusを実用的に変更、調整 (cbd7bef)
- PCステータスの表示を改善し、iPad用に文字数制限を緩和。Drive Dの情報を削除し、メインウィンドウの表示形式を変更。 (4d7b757)
- 今後の調整のため一時削除 (bfa9235)
- devtoolsを大幅拡張、更新、実装(試験中) (a2cd6e1)
- swalの処理で停止を回避/コメント系の追加 (906bf0b)
- awaitを回避 (30c640a)
- git操作ミス (ff35008)
- GPU1を削除 (1fa3aa2)
- メニュー順を整理 (e3b933d)
- メニューを再度開くように調整 (af5bdab)
- 追加 (b179365)
- WebAuthnを利用せずにアカウントを作成できるように変更、logon.goへの統合 (bf6dcf9)
- アカウント機能を実装 (00d6b87)
- 名称の変更/追加 (662d9dc)
- アカウント機能の強化 (a81ea90)
- 制限を廃止し保存方法を少々変更 (3740141)
- 更新忘れ (ffe2508)
- Canvasサイズに応じた自動調整に変更 (b5fb180)
- gitignoreの更新 (e57610f)
- Google Material Symbolsに変更 (b28e17b)
- Apache 2.0 Licenseの要求に対する適合 (0ccc238)
- 調整(戻すかもしれません) (fdbdf1d)
- アカウント処理において、別端末での変更があった場合に自動同期を行うように修正 (9385cdf)
- ip_scores.jsonのスコア読み込みと保存時にスレッドセーフを確保するためのロックを追加 (38b47b5)
- 更新忘れ (2dfbc92)
- 邪魔なコメントアウトの削除 (d13e88e)
- 特に何もない (925493d)
- 年度の更新(念のため) (047f9eb)
- 更新のための予備配置 (21579c0)
- Stop tracking json/working_shedule.json (817e32a)
- gitignoreの更新 (4e87dfa)
- re update (ce2008e)
- 予定管理機能の改善とシフト処理の追加 - 予定種類選択モーダルを実装し、通常予定とシフト予定の追加機能を追加 - シフト情報を解析し、スケジュールとして登録する機能を追加 - APIエンドポイントを追加し、シフトデータの処理を実装 - .gitignoreを更新し、不要なファイルを除外 - バージョン番号を3.7.0に更新 (73ccb5c)
- miss (6f5b5f6)
- バージョンの修正, Emojiの削除 (3c9dadf)
- moderncのsqlを追加、db管理化 (d77d2af)
- シフト削除機能の追加とシフトモーダルの実装 (56bb511)
- ユーザー取得方法を改善 (8105836)
- シフト削除機能の追加とエラーハンドリングの改善 (94e0e3c)
- ユーザー認証の追加とシフト削除機能の改善 (58741c3)
- schedule function update (298ff30)
- ps1の追加 (2eb7ed6)
- .ps1の署名の処理を追加 (28e7701)
- 閉じ括弧の追加 (6d5d540)
- 無効なコマンドを削除 (d93623a)
- Get StatusをGolangへ移植 (09e7702)
- v4.0.0 (3716e29)

