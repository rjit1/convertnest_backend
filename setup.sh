#!/bin/bash

# ConvertNest Backend - Initial Server Setup Script
# Run this script ONCE on a fresh Digital Ocean droplet

set -e  # Exit on error

echo "🔧 ConvertNest Backend - Initial Server Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Must run as root for initial setup
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root: sudo bash setup.sh"
    exit 1
fi

# Step 1: Update system
print_info "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install Node.js 20.x
print_info "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node --version) installed"

# Step 3: Install essential tools
print_info "Installing Git, Nginx, Certbot..."
apt install -y git nginx certbot python3-certbot-nginx build-essential
print_success "Essential tools installed"

# Step 4: Install PM2
print_info "Installing PM2 process manager..."
npm install -g pm2
print_success "PM2 installed"

# Step 5: Create application user
print_info "Creating convertnest user..."
if id "convertnest" &>/dev/null; then
    print_info "User convertnest already exists"
else
    adduser --disabled-password --gecos "" convertnest
    print_success "User convertnest created"
fi

# Step 6: Setup firewall
print_info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable
print_success "Firewall configured"

# Step 7: Instructions for next steps
echo ""
echo "=============================================="
print_success "Initial server setup completed!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Switch to convertnest user:"
echo "   su - convertnest"
echo ""
echo "2. Clone the repository:"
echo "   git clone https://github.com/rjit1/convertnest_backend.git"
echo "   cd convertnest_backend"
echo ""
echo "3. Create .env file:"
echo "   nano .env"
echo "   (Copy settings from .env.example and update for production)"
echo ""
echo "4. Run the deployment script:"
echo "   bash deploy.sh"
echo ""
echo "5. Configure Nginx reverse proxy (as root):"
echo "   sudo nano /etc/nginx/sites-available/convertnest-backend"
echo "   (Follow the guide in DIGITAL_OCEAN_DEPLOYMENT.md)"
echo ""
print_info "For full instructions, see: DIGITAL_OCEAN_DEPLOYMENT.md"
