# Recomended PowerShell Core Version: 7.5.0 or later
Write-Host "Building TabDock for Windows amd64..."
Write-Host "Removing old build files..."
Remove-Item ./dist/tabdock_win_amd64.exe -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:GOOS = "windows"
$env:GOARCH = "amd64"

Write-Host "Building the application..."
go build -o ./dist/tabdock_win_amd64.exe

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at ./dist/tabdock_win_amd64.exe"
Write-Host "Running the application..."
Write-Host "===================================================="
./dist/tabdock_win_amd64.exe