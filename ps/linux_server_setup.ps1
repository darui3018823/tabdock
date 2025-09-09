# Recommended PowerShell Core Version: 7.5.0 or later
Write-Host "Setting up Nginx and Systemd on Linux."
Write-Host "This script assumes it is run as root."

# Get Current Directory
$currentDir = (Get-Location).Path
Write-Host "Current Directory: $currentDir"

# Install Nginx if not installed
if (-not (Get-Command nginx -ErrorAction SilentlyContinue)) {
    Write-Host "Nginx not found. Installing Nginx..."
    apt-get update -y
    apt-get install -y nginx
} else {
    Write-Host "Nginx is already installed."
    Write-Host "Continuing with setup..."
}

# Create Nginx configuration
$nginxConfig = @'
server {
    listen 80;
    server_name tabdock.daruks.com;

    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tabdock.daruks.com;

    ssl_certificate     /etc/ssl/certs/cert.crt;
    ssl_certificate_key /etc/ssl/private/private.key;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
'@

$nginxConfigPath = "/etc/nginx/sites-available/tabdock.daruks.com"

# Create Certificate and Key placeholders
$certPath = "/etc/ssl/certs/cert.crt"
$keyPath = "/etc/ssl/private/private.key"

# Ensure OpenSSL
try {
    $version = & openssl version
    Write-Output "OpenSSL is available: $version"
} catch {
    Write-Output "OpenSSL is not installed or not accessible."
    try {
        apt-get update -y
        apt-get install -y openssl
        try {
            $version = & openssl version
            Write-Output "OpenSSL installed successfully: $version"
        } catch {
            Write-Output "Failed to verify OpenSSL installation."
        }
    } catch {
        Write-Output "Failed to install OpenSSL."
    }
}

# Ensure directories exist
if (-not (Test-Path "/etc/ssl/private" -PathType Container)) { & mkdir -p "/etc/ssl/private" | Out-Null }
if (-not (Test-Path "/etc/ssl/certs"   -PathType Container)) { & mkdir -p "/etc/ssl/certs"   | Out-Null }

if (Test-Path $certPath -PathType Leaf) {
    Write-Host "Certificate file already exists at $certPath"
    Write-Host "Continuing with setup..."
} else {
    Write-Host "Creating self-signed certificate at $certPath"
    try {
        & openssl req -x509 -newkey rsa:2048 -nodes -keyout $keyPath -out $certPath -days 3650 -subj "/C=JP/ST=Tokyo/L=Chiyoda-Ku/O=Example Corp/OU=EXAMPLE/CN=tabdock.daruks.com"
        try {
            & openssl x509 -in $certPath -noout -subject -issuer -dates -serial -fingerprint -sha256
            & chmod 600 $keyPath
            & chown root:root $keyPath $certPath
            Write-Host "Self-signed certificate created successfully."
        } catch {
            Write-Host "Certificate verification or permission setting failed."
        }
    } catch {
        Write-Host "Failed to create self-signed certificate. Please ensure OpenSSL is installed and accessible."
    }
}

# Create Nginx configuration file
Set-Content -Path $nginxConfigPath -Value $nginxConfig -Force -Encoding UTF8
Write-Host "Nginx configuration created at $nginxConfigPath"

# Enable the new site (sites-available -> sites-enabled), disable default if present
if (-not (Test-Path "/etc/nginx/sites-enabled/tabdock.daruks.com")) {
    try {
        & ln -s $nginxConfigPath "/etc/nginx/sites-enabled/tabdock.daruks.com"
        Write-Host "Enabled site: tabdock.daruks.com"
    } catch {
        Write-Host "Failed to enable site symlink."
    }
}

if (Test-Path "/etc/nginx/sites-enabled/default") {
    try {
        & rm "/etc/nginx/sites-enabled/default"
        Write-Host "Disabled default site."
    } catch {
        Write-Host "Failed to disable default site."
    }
}

# Systemd service
$systemdServicePath = "/etc/systemd/system/tabdock.service"

if (Test-Path $systemdServicePath) {
    Write-Host "Systemd service file already exists at $systemdServicePath"
    Write-Host "Continuing with setup..."
} else {
    Write-Host "Creating systemd service file at $systemdServicePath"
    $systemdService = @"
[Unit]
Description=Tabdock Service
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$currentDir
ExecStart=$currentDir/dist/tabdock_linux_amd64
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"@

    Set-Content -Path $systemdServicePath -Value $systemdService -Force -Encoding UTF8
    Write-Host "Systemd service created at $systemdServicePath"
}

# Nginx Configuration Test
Write-Host "Testing Nginx configuration..."
try {
    & nginx -t
    Write-Host "Nginx configuration test passed."
} catch {
    Write-Host "Nginx configuration test failed. Please check the configuration."
    exit 1
}

# Enable and start services
Write-Host "Enabling and starting Nginx and Tabdock services..."
try {
    & systemctl daemon-reload
    & systemctl enable nginx
    & systemctl restart nginx
    & systemctl enable tabdock
    & systemctl start tabdock
} catch {
    Write-Host "Failed to enable or start services. Please check the service status."
    exit 1
}

Write-Host "Setup complete. Please ensure that your DNS is configured to point tabdock.daruks.com to this server's IP address."
Write-Host "You can check the status of the services using:"
Write-Host "  systemctl status nginx"
Write-Host "  systemctl status tabdock"
Write-Host "===================================================="
