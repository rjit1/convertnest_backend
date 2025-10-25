# ConvertNest Backend - Automated Deployment to Digital Ocean
# This script automates the entire deployment process

$ErrorActionPreference = "Stop"

# Configuration
$DROPLET_IP = "64.227.133.82"
$DROPLET_USER = "root"
$DROPLET_PASSWORD = "First523@#${'$'}SH"
$APP_USER = "convertnest"
$REPO_URL = "https://github.com/rjit1/convertnest_backend.git"
$DOMAIN = "convertnest-api"  # Will use IP if no domain configured

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 ConvertNest Backend Auto-Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target: $DROPLET_IP" -ForegroundColor Yellow
Write-Host "Domain: $DOMAIN" -ForegroundColor Yellow
Write-Host ""

# Function to execute SSH commands
function Invoke-SSHCommand {
    param (
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "► $Description..." -ForegroundColor Yellow
    
    $sshCommand = "ssh"
    $sshArgs = @(
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "$DROPLET_USER@$DROPLET_IP",
        $Command
    )
    
    try {
        # Using plink (PuTTY) for password authentication
        $plinkPath = "plink"
        $plinkArgs = @(
            "-batch",
            "-pw", $DROPLET_PASSWORD,
            "$DROPLET_USER@$DROPLET_IP",
            $Command
        )
        
        $result = & $plinkPath $plinkArgs 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Success" -ForegroundColor Green
            return $result
        } else {
            Write-Host "  ⚠️  Warning: Exit code $LASTEXITCODE" -ForegroundColor Yellow
            return $result
        }
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        throw
    }
}

# Check if plink is available
Write-Host "Checking for PuTTY (plink)..." -ForegroundColor Cyan
try {
    $null = Get-Command plink -ErrorAction Stop
    Write-Host "✅ PuTTY found" -ForegroundColor Green
} catch {
    Write-Host "❌ PuTTY (plink) not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PuTTY:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.putty.org/" -ForegroundColor White
    Write-Host "2. Or run: winget install -e --id PuTTY.PuTTY" -ForegroundColor White
    Write-Host "3. Then run this script again" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: System Update & Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Update system
Invoke-SSHCommand -Command "apt update && apt upgrade -y" -Description "Updating system packages"

# Install Node.js 20.x
$installNode = @"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
apt install -y nodejs git nginx certbot python3-certbot-nginx build-essential
"@
Invoke-SSHCommand -Command $installNode -Description "Installing Node.js 20.x, Git, Nginx, Certbot"

# Install PM2
Invoke-SSHCommand -Command "npm install -g pm2" -Description "Installing PM2 process manager"

# Verify installations
Write-Host ""
Write-Host "Verifying installations:" -ForegroundColor Cyan
Invoke-SSHCommand -Command "node --version" -Description "Node.js version"
Invoke-SSHCommand -Command "npm --version" -Description "npm version"
Invoke-SSHCommand -Command "pm2 --version" -Description "PM2 version"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: Application User Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Create application user
$createUser = @"
if id '$APP_USER' &>/dev/null; then
    echo 'User already exists'
else
    adduser --disabled-password --gecos '' $APP_USER
    echo 'User created'
fi
"@
Invoke-SSHCommand -Command $createUser -Description "Creating application user"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Clone Repository" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Clone repository as convertnest user
$cloneRepo = @"
su - $APP_USER -c '
if [ -d convertnest_backend ]; then
    cd convertnest_backend
    git pull origin main
else
    git clone $REPO_URL
    cd convertnest_backend
fi
'
"@
Invoke-SSHCommand -Command $cloneRepo -Description "Cloning/updating repository"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 4: Environment Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Create .env file
$envContent = @"
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://www.convertnest.tech,https://convertnest.tech,http://$DROPLET_IP:3000
MAX_FILE_SIZE=104857600
CLEANUP_INTERVAL_HOURS=1
FILE_RETENTION_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EXCHANGERATE_API_KEY=761b4a8979e49eaf282165b2
"@

$createEnv = @"
su - $APP_USER -c 'cat > convertnest_backend/.env << EOL
$envContent
EOL'
"@
Invoke-SSHCommand -Command $createEnv -Description "Creating .env file"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 5: Install Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$installDeps = @"
su - $APP_USER -c '
cd convertnest_backend
npm install --production
mkdir -p uploads logs
chmod 755 uploads logs
'
"@
Invoke-SSHCommand -Command $installDeps -Description "Installing npm dependencies"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 6: Start Application with PM2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Start with PM2
$startPM2 = @"
su - $APP_USER -c '
cd convertnest_backend
pm2 delete convertnest-backend 2>/dev/null || true
pm2 start src/server.js --name convertnest-backend
pm2 save
'
"@
Invoke-SSHCommand -Command $startPM2 -Description "Starting application with PM2"

# Setup PM2 startup
Invoke-SSHCommand -Command "env PATH=\`$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER" -Description "Configuring PM2 auto-start"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 7: Configure Nginx Reverse Proxy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Nginx configuration
$nginxConfig = @"
server {
    listen 80;
    server_name $DROPLET_IP;
    
    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    
    # Increase upload size limit
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \`$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \`$host;
        proxy_set_header X-Real-IP \`$remote_addr;
        proxy_set_header X-Forwarded-For \`$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \`$scheme;
        proxy_cache_bypass \`$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
"@

$createNginx = @"
cat > /etc/nginx/sites-available/convertnest-backend << 'EOL'
$nginxConfig
EOL
ln -sf /etc/nginx/sites-available/convertnest-backend /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
"@
Invoke-SSHCommand -Command $createNginx -Description "Configuring Nginx"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 8: Configure Firewall" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$setupFirewall = @"
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo 'y' | ufw enable
ufw status
"@
Invoke-SSHCommand -Command $setupFirewall -Description "Configuring firewall"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 9: Verify Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check PM2 status
Invoke-SSHCommand -Command "su - $APP_USER -c 'pm2 status'" -Description "Checking PM2 status"

# Check if API is responding
Write-Host ""
Write-Host "Testing API endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "http://$DROPLET_IP" -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ API is responding!" -ForegroundColor Green
    Write-Host "Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor White
} catch {
    Write-Host "⚠️  API not responding yet (might need a few more seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your backend is now live at:" -ForegroundColor Cyan
Write-Host "   http://$DROPLET_IP" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Test the API:" -ForegroundColor White
Write-Host "   curl http://$DROPLET_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update your frontend .env.local:" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_API_URL=http://$DROPLET_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "3. (Optional) Setup domain and SSL:" -ForegroundColor White
Write-Host "   - Configure DNS A record for your domain to: $DROPLET_IP" -ForegroundColor Gray
Write-Host "   - SSH to server: ssh root@$DROPLET_IP" -ForegroundColor Gray
Write-Host "   - Run: sudo certbot --nginx -d your-domain.com" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Useful Commands:" -ForegroundColor Yellow
Write-Host "   SSH: ssh root@$DROPLET_IP" -ForegroundColor Gray
Write-Host "   View logs: ssh root@$DROPLET_IP 'su - convertnest -c \"pm2 logs\"'" -ForegroundColor Gray
Write-Host "   Restart: ssh root@$DROPLET_IP 'su - convertnest -c \"pm2 restart convertnest-backend\"'" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Happy deploying!" -ForegroundColor Green
