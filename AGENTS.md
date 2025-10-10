# Repository Guidelines

## Project Structure & Module Organization
- `main.go`, `log.go`, `logon.go`, and `subscription/*.go` implement the core service, with `getstatus/*.go` providing platform-specific probes.
- `home/` is the static tablet UI (HTML/CSS/JS) served by the Go HTTP layer; assets and wallpapers live under `home/assets/` and `home/wallpapers/`.
- `json/` contains sample schedules, IP lists, and weather payloads used as runtime fixtures; adjust copies rather than editing production data in place.
- `database/` stores bundled SQLite databases and the seed script `subscription.sql`; regenerate artifacts via migrations or scripted exports.
- `ps/` holds PowerShell automation, `Python/get_status.py` wraps the status collector, and `dist/` is reserved for release binaries built from CI.

## Build, Test, and Development Commands

Tabdock can be built and launched directly via PowerShell Core (`pwsh`) using the platform-specific scripts in the `ps/` directory.  
Each script sets up the required environment, builds the Go binary, and starts the service automatically.

### Platform-specific startup scripts
- `pwsh -File ps/amd64_win_autorun.ps1` — builds and launches Tabbock on **Windows**.
- `pwsh -File ps/arm64_mac_autorun.ps1` — performs local setup and starts the service on **macOS (Apple Silicon)**.
- `pwsh -File ps/linux_server_setup.ps1` — provisions a **Linux host or VPS** by installing dependencies, registering a systemd service, and starting it.

### Manual development commands (if needed)
- `go build -o dist/tabdock ./...` — compiles the Go backend manually.
- `go run .` — runs the server in local development mode; serves static assets from `./home`.
- `go test ./...` — executes all test suites. Use `-run <Name>` for targeted runs.
- To rebuild or deploy from scripts, keep `ps/` scripts **idempotent** and under version control.

## Coding Style & Naming Conventions
- Format Go code with `gofmt` (tabs) and `goimports`; prefer clear package-level names (`CamelCase` for exports, `camelCase` for locals).
- Front-end JavaScript favors ES modules and `const`/`let`; keep filenames lower-case with underscores (e.g., `shift_modal.js`), and CSS classes in kebab-case.
- Store configuration JSON with snake_case keys to match existing fixtures; document new attributes in `README.md` when they affect deployments.

## Testing Guidelines
- Begin each package with table-driven `_test.go` files co-located with the source; mirror filenames (`subscription_test.go`) for clarity.
- Target meaningful coverage for new logic (~70%+) and include regression tests for bug fixes touching `getstatus` or authentication flows.
- Use temporary directories (`t.TempDir`) instead of editing files under `database/` or `json/` during tests.

## Commit & Pull Request Guidelines
- Follow the existing short, present-tense summaries (English or Japanese acceptable); prefix with scope when helpful (`home:`, `subscription:`).
- Reference GitHub issues using `Fixes #NN` in the body and document user-visible changes or migrations.
- PRs should link screenshots of UI adjustments, describe backend impacts, list manual test steps, and request review from platform owners.

## Security & Configuration Tips
- Keep private certificates out of `cert/` in source control; distribute via secure channels and update deployment scripts accordingly.
- Review `trusted_ips.json` and `ip_scores.json` before release, and rotate secrets referenced by PowerShell scripts using environment variables.
