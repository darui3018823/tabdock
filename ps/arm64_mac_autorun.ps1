# Recommended PowerShell Core Version: 7.5.0 or later
Write-Host "Note: There is no guarantee that this script will work correctly on macOS."
Write-Host "Building TabDock for macOS arm64..."
Write-Host "Removing old build files..."
Remove-Item ./dist/tabdock_mac_arm64 -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:CGO_ENABLED="1"
$env:GOOS = "darwin"
$env:GOARCH = "arm64"

Write-Host "Building the application..."
go build -o ./dist/tabdock_mac_arm64 main.go log.go

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:CGO_ENABLED
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at ./dist/tabdock_mac_arm64"

# Optional: Sign the executable if you have a code signing certificate
$SignExec = $True # Set to $True to sign the executable, $False to skip signing
if ($SignExec) {
    # Load .env file for sensitive data
    $EnvPath = "./.env"
    if (Test-Path $EnvPath) {
        $EnvContent = Get-Content $EnvPath | ForEach-Object {
            if ($_ -match "^(?<key>[^=]+)=(?<value>.+)$") {
                $matches.key, $matches.value
            }
        }
        foreach ($pair in $EnvContent) {
            $key, $value = $pair
            Set-Item -Path "Env:$key" -Value $value
        }
    } else {
        Write-Host ".env file not found. Please create one with the required variables."
        exit 1
    }

    # Use CERT_PASSWORD from .env
    $CertPassword = $env:CERT_PASSWORD
    if (-not $CertPassword) {
        Write-Host "CERT_PASSWORD not found in environment. Please check your .env file."
        exit 1
    }

    Write-Host "Signing the executable..."
    try {
        codesign --deep --force --verbose --sign "Developer ID Application" ./dist/tabdock_mac_arm64
        Write-Host "Executable signed successfully."
    } catch {
        Write-Host "Error signing the executable. Please ensure you have a valid certificate."
        exit 1
    }
} else {
    Write-Host "Skipping signing process as per configuration."
}

Write-Host "Running the application..."
Write-Host "===================================================="
./dist/tabdock_mac_arm64