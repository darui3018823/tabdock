# Recomended PowerShell Core Version: 7.5.0 or later
$DistPath = "./dist/tabdock_win_amd64.exe"
Write-Host "Building TabDock for Windows amd64..."
Write-Host "Removing old build files..."
Remove-Item $DistPath -Force

Write-Host "Setting environment variables for GOOS and GOARCH..."
$env:CGO_ENABLED="1"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

Write-Host "Building the application..."
go build -o $DistPath

Write-Host "Build complete. Cleaning up environment variables..."
Remove-Item Env:CGO_ENABLED
Remove-Item Env:GOOS
Remove-Item Env:GOARCH

Write-Host "Build successful! The executable is located at $DistPath"

# Optional: Sign the executable if you have a code signing certificate
$SignExec = $True # Set to $True to sign the executable, $False to skip signing
if ($SignExec) {
    Write-Host "Signing the executable..."
    $PfxPath = "./cert/tabdock.pfx" # Path to your .pfx certificate file
    $KeyPath = "./cert/tabdock.key" # Path to your private key file
    $CertPath = "./cert/tabdock.crt" # Path to your certificate file

    $CertPassword = "your_password_here" # Replace with your certificate password

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
                            signtool version

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