#!/bin/bash

# ConvertNest Backend - Quick Deployment Script
# This script automates the deployment process on Digital Ocean

set -e  # Exit on error

echo "🚀 ConvertNest Backend Deployment Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root. Run as convertnest user."
    exit 1
fi

# Step 1: Pull latest code
print_info "Pulling latest code from GitHub..."
cd ~/convertnest_backend
git pull origin main
print_success "Code updated"

# Step 2: Install dependencies
print_info "Installing dependencies..."
npm install --production
print_success "Dependencies installed"

# Step 3: Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_info "Please create .env file with production settings"
    exit 1
fi
print_success ".env file found"

# Step 4: Create required directories
print_info "Creating required directories..."
mkdir -p uploads logs
chmod 755 uploads logs
print_success "Directories created"

# Step 5: Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_info "PM2 not found. Installing PM2 globally..."
    sudo npm install -g pm2
    print_success "PM2 installed"
fi

# Step 6: Restart application
print_info "Restarting application with PM2..."
if pm2 list | grep -q "convertnest-backend"; then
    pm2 restart convertnest-backend
    print_success "Application restarted"
else
    pm2 start src/server.js --name convertnest-backend
    pm2 save
    print_success "Application started"
fi

# Step 7: Show status
echo ""
print_success "Deployment completed successfully!"
echo ""
echo "Application Status:"
pm2 status convertnest-backend
echo ""
echo "Recent Logs:"
pm2 logs convertnest-backend --lines 20 --nostream
echo ""
print_info "To view real-time logs: pm2 logs convertnest-backend"
print_info "To restart: pm2 restart convertnest-backend"
print_info "To monitor: pm2 monit"
