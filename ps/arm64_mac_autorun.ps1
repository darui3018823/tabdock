# Recommended PowerShell Core Version: 7.5.0 or later
Write-Host "Note: There is no guarantee that this script will work correctly on macOS."
Write-Host "Building TabDock for macOS arm64..."
Write-Host "Removing old build files..."
Remove-Item ./dist/tabdock_mac_arm64 -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:GOOS = "darwin"
$env:GOARCH = "arm64"

Write-Host "Building the application..."
go build -o ./dist/tabdock_mac_arm64 main.go log.go

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at ./dist/tabdock_mac_arm64"
Write-Host "Running the application..."
Write-Host "===================================================="
./dist/tabdock_mac_arm64