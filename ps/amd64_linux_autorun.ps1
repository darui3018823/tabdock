# Recommended PowerShell Core Version: 7.5.0 or later
Write-Host "Note: There is no guarantee that this script will work correctly on Linux."
Write-Host "Building TabDock for Linux arm64..."
Write-Host "Removing old build files..."
Remove-Item ./dist/tabdock_linux_arm64 -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:GOOS = "linux"
$env:GOARCH = "arm64"

Write-Host "Building the application..."
go build -o ./dist/tabdock_linux_arm64 main.go log.go

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at ./dist/tabdock_linux_arm64"
Write-Host "Running the application..."
Write-Host "===================================================="
./dist/tabdock_linux_arm64