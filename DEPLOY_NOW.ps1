# ConvertNest Backend - Complete Deployment Command
# This is ONE complete command that does everything

# IMPORTANT: Copy this ENTIRE block and paste it into your PowerShell terminal
# When prompted for password, enter: First523@#$SH

$commands = @'
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x, Nginx, Git, Certbot
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx certbot python3-certbot-nginx build-essential

# Install PM2
npm install -g pm2

# Verify installations
echo "========================================
"
echo "Installed versions:"
node --version
npm --version
pm2 --version
echo "========================================
"

# Create application user
adduser --disabled-password --gecos "" convertnest || echo "User already exists"

# Clone repository as convertnest user
su - convertnest << 'EOF'
if [ -d convertnest_backend ]; then
    cd convertnest_backend
    git pull origin main
else
    git clone https://github.com/rjit1/convertnest_backend.git
fi
cd convertnest_backend

# Create .env file
cat > .env << 'ENVEOF'
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://www.convertnest.tech,https://convertnest.tech,http://64.227.133.82
MAX_FILE_SIZE=104857600
CLEANUP_INTERVAL_HOURS=1
FILE_RETENTION_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EXCHANGERATE_API_KEY=761b4a8979e49eaf282165b2
ENVEOF

# Install dependencies
npm install --production

# Create directories
mkdir -p uploads logs
chmod 755 uploads logs

# Start with PM2
pm2 delete convertnest-backend 2>/dev/null || true
pm2 start src/server.js --name convertnest-backend
pm2 save

echo "========================================
"
echo "PM2 Status:"
pm2 status
echo "========================================
"
EOF

# Setup PM2 auto-start
env PATH=$PATH:/usr/bin pm2 startup systemd -u convertnest --hp /home/convertnest | grep 'sudo' | bash

# Configure Nginx
cat > /etc/nginx/sites-available/convertnest-backend << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
NGINXEOF

# Remove default Nginx site
rm -f /etc/nginx/sites-enabled/default

# Enable the site
ln -sf /etc/nginx/sites-available/convertnest-backend /etc/nginx/sites-enabled/

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Configure firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "========================================
"
echo "Firewall Status:"
ufw status
echo "========================================
"

# Final verification
echo "========================================
"
echo "✅ DEPLOYMENT COMPLETED!"
echo "========================================
"
echo "Backend is running at: http://64.227.133.82"
echo ""
echo "PM2 Status:"
su - convertnest -c 'pm2 status'
echo ""
echo "Test the API:"
echo "curl http://64.227.133.82"
echo "========================================
"
'@

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ConvertNest Backend - One-Command Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: 64.227.133.82" -ForegroundColor Yellow
Write-Host "Password: First523@#`$SH" -ForegroundColor Yellow
Write-Host ""
Write-Host "STEP 1: Copy and run this command:" -ForegroundColor Green
Write-Host ""
Write-Host 'ssh root@64.227.133.82' -ForegroundColor White
Write-Host ""
Write-Host "STEP 2: When prompted, type 'yes' to accept the host key" -ForegroundColor Yellow
Write-Host ""
Write-Host "STEP 3: Enter password when prompted: First523@#`$SH" -ForegroundColor Yellow
Write-Host ""
Write-Host "STEP 4: Once logged in, copy and paste the ENTIRE deployment script below:" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT SCRIPT (Copy from here)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host $commands -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "END OF SCRIPT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "After deployment completes:" -ForegroundColor Green
Write-Host "1. Type 'exit' to disconnect from droplet" -ForegroundColor White
Write-Host "2. Update your frontend .env.local file:" -ForegroundColor White
Write-Host "   E:\tool\convertnest\.env.local" -ForegroundColor Gray
Write-Host "   NEXT_PUBLIC_API_URL=http://64.227.133.82" -ForegroundColor Yellow
Write-Host "3. Test: http://64.227.133.82" -ForegroundColor White
Write-Host ""
