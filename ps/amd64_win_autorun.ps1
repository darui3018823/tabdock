# Recomended PowerShell Core Version: 7.5.0 or later
$DistPath = "./dist/tabdock_win_amd64.exe"

# ----------------------------------------------------------------
# JSON Files Initialization
# ----------------------------------------------------------------
$JsonDir = "./json"
if (-not (Test-Path $JsonDir)) {
    New-Item -ItemType Directory -Force -Path $JsonDir | Out-Null
    Write-Host "Created json directory."
}

# 1. ip_scores.json
$IpScoresPath = "$JsonDir/ip_scores.json"
if (-not (Test-Path $IpScoresPath)) {
    Set-Content -Path $IpScoresPath -Value "{}" -Encoding UTF8
    Write-Host "Created empty $IpScoresPath"
}

# 2. first_access_ips.json
$FirstAccessIpsPath = "$JsonDir/first_access_ips.json"
if (-not (Test-Path $FirstAccessIpsPath)) {
    Set-Content -Path $FirstAccessIpsPath -Value "{`r`n  `"ips`": {}`r`n}" -Encoding UTF8
    Write-Host "Created default $FirstAccessIpsPath"
}

# 3. security_config.json
$SecurityConfigPath = "$JsonDir/security_config.json"
$SecurityConfigExamplePath = "$JsonDir/security_config.example.json"
if (-not (Test-Path $SecurityConfigPath)) {
    if (Test-Path $SecurityConfigExamplePath) {
        Copy-Item -Path $SecurityConfigExamplePath -Destination $SecurityConfigPath
        Write-Host "Created $SecurityConfigPath from example."
    } else {
        Write-Host "Warning: $SecurityConfigExamplePath not found. Skipping security_config.json creation."
    }
}
# ----------------------------------------------------------------

Write-Host "Building TabDock for Windows amd64..."
Write-Host "Removing old build files..."
Remove-Item $DistPath -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:CGO_ENABLED="1"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

# Check for update flag file
Write-Host "Checking for update flag..."
$FlagPath = "./update_flag.txt"
if (Test-Path $FlagPath) {
    Write-Host "Update flag detected. Do you want to perform 'git pull'? (y/n)"
    $UserInput = Read-Host "Enter your choice"

    if ($UserInput -eq "y") {
        Write-Host "Performing 'git pull'..."
        try {
            git pull
            Write-Host "Git pull completed successfully."
            
            # Remove flag file with error handling
            if (Test-Path $FlagPath) {
                try {
                    Remove-Item $FlagPath -Force -ErrorAction Stop
                    Write-Host "Update flag removed successfully."
                } catch {
                    Write-Host "Warning: Failed to remove update flag: $_"
                }
            }
            
            Write-Host ""
            Write-Host "====================================================="
            Write-Host "Code has been updated. Please run this script again."
            Write-Host "====================================================="
            exit 0
        } catch {
            Write-Host "Error during 'git pull': $_"
            Write-Host "Please resolve conflicts manually."
            
            # Try to remove flag file even on error
            if (Test-Path $FlagPath) {
                try {
                    Remove-Item $FlagPath -Force -ErrorAction Stop
                    Write-Host "Update flag removed."
                } catch {
                    Write-Host "Warning: Failed to remove update flag: $_"
                }
            }
            exit 1
        }
    } else {
        Write-Host "Skipping 'git pull'."
        
        # Remove flag file
        if (Test-Path $FlagPath) {
            try {
                Remove-Item $FlagPath -Force -ErrorAction Stop
                Write-Host "Update flag removed."
            } catch {
                Write-Host "Warning: Failed to remove update flag: $_"
            }
        }
    }
} else {
    Write-Host "No update flag detected. Proceeding with the build."
}

Write-Host "Building the application..."
go build -o $DistPath

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:CGO_ENABLED
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at $DistPath"

$SignExec = $True # Set to $True to sign the executable, $False to skip signing
if ($SignExec) {
    # Load .env file for sensitive data
    $EnvPath = "./.env"
    if (Test-Path $EnvPath) {
        $EnvContent = Get-Content $EnvPath | ForEach-Object {
            if ($_ -match "^(?<key>[^=]+)=(?<value>.+)$") {
                $key = $matches['key'].Trim()
                $value = $matches['value'].Trim()
                Set-Item -Path "Env:$key" -Value $value
            } else {
                Write-Host "Skipping invalid .env line: $_" # Debug output for invalid lines
            }
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
    $PfxPath = "./cert/tabdock.pfx" # Path to your .pfx certificate file
    $KeyPath = "./cert/tabdock.key" # Path to your private key file
    $CertPath = "./cert/tabdock.crt" # Path to your certificate file

    try {
        openssl version
        try {
            openssl pkcs12 -export `
                -out $PfxPath `
                -inkey $KeyPath `
                -in $CertPath `
                -passout pass:$CertPassword

            if (Test-Path $PfxPath) {
                Write-Host ".pfx file created successfully."
                try {
                    $exists = [bool](Get-Command signtool -ErrorAction SilentlyContinue)

                    if ($exists) {
                        try {
                            signtool sign `
                                /f $PfxPath `
                                /p $CertPassword `
                                /fd SHA256 `
                                /tr http://timestamp.sectigo.com `
                                /td SHA256 `
                                $DistPath

                            Write-Host "Executable signed successfully."
                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "Signature verification successful."
                            } else {
                                Write-Host "Signature verification failed."
                                exit 1
                            }
                        } catch {
                            Write-Host "Error executing signtool. Please ensure it is installed correctly."
                            exit 1
                        }
                    } else {
                        Write-Host "signtool not found. Please install the Windows SDK to get signtool."
                        exit 1
                    }
                } catch {
                    Write-Host "Error checking for signtool. Please ensure it is installed correctly."
                    exit 1
                }
            } else {
                Write-Host "Failed to create .pfx file. Please check your certificate and key files."
                exit 1
            }
        } catch {
            Write-Host "Error creating .pfx file. Please check your certificate and key files."
            exit 1
        }
    } catch {
        Write-Host "OpenSSL is not installed or not found in PATH. Please install OpenSSL to sign the executable."
    }
} else {
    Write-Host "Skipping signing process as per configuration."
}

Write-Host "Running the application..."
Write-Host "===================================================="
& $DistPath