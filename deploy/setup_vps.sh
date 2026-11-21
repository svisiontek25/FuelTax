#!/usr/bin/env bash
# ==============================================================================
# Hostinger VPS Initial Setup Script for FuelTaxPulse
# OS: Ubuntu 22.04 / 24.04 LTS or Debian 11 / 12
# Run as root: sudo bash deploy/setup_vps.sh
# ==============================================================================

set -e
export DEBIAN_FRONTEND=noninteractive

echo "=========================================================="
echo " Starting FuelTaxPulse VPS Setup on Hostinger"
echo "=========================================================="

# 1. Update OS packages
echo "--> Updating system packages..."
apt-get update && apt-get upgrade -y

# 2. Install essential system dependencies (Python, Git, Nginx, Curl)
echo "--> Installing Python 3, venv, build tools, Nginx..."
apt-get install -y python3 python3-pip python3-venv git nginx curl ufw certbot python3-certbot-nginx

# 3. Install Node.js (v20 LTS) & npm
if ! command -v node &> /dev/null; then
    echo "--> Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# 4. Prepare application directory
APP_DIR="/var/www/fueltax"
echo "--> Setting up application directory at $APP_DIR..."
mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
    echo "--> Cloning repository from GitHub..."
    git clone https://github.com/svisiontek25/FuelTax.git "$APP_DIR"
else
    echo "--> Repository already exists. Pulling latest main branch..."
    cd "$APP_DIR"
    git fetch origin main
    git reset --hard origin/main
fi

cd "$APP_DIR"

# 5. Set up Python Virtual Environment & dependencies
echo "--> Setting up Python virtual environment..."
if [ ! -d "$APP_DIR/venv" ]; then
    python3 -m venv "$APP_DIR/venv"
fi
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# 6. Build Frontend
echo "--> Installing frontend dependencies and building production bundle..."
cd "$APP_DIR/frontend"
npm install
npm run build
cd "$APP_DIR"

# 7. Install Systemd Service for Backend
echo "--> Installing systemd backend service..."
cp "$APP_DIR/deploy/fueltax-backend.service" /etc/systemd/system/fueltax-backend.service
systemctl daemon-reload
systemctl enable fueltax-backend
systemctl restart fueltax-backend

# 8. Configure Nginx
echo "--> Configuring Nginx reverse proxy..."

# Stop and disable apache2 if present to free port 80
if systemctl is-active --quiet apache2 2>/dev/null || which apache2 &>/dev/null; then
    echo "Stopping and disabling Apache2 to free port 80 for Nginx..."
    systemctl stop apache2 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
fi

# Print any active listeners on port 80/443
echo "Active listeners on port 80 / 443:"
ss -tulpn | grep -E ':80|:443' || true

if command -v docker &>/dev/null; then
    echo "Active Docker containers:"
    docker ps || true
fi

# Clear any lingering process on port 80
fuser -k 80/tcp 2>/dev/null || true

cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/fueltax
ln -sf /etc/nginx/sites-available/fueltax /etc/nginx/sites-enabled/fueltax
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx || {
    echo "❌ Nginx failed to start. Logs:"
    journalctl -xeu nginx --no-pager -n 30 || true
    exit 1
}

# 9. Configure Firewall (UFW)
echo "--> Configuring UFW firewall (OpenSSH, Nginx Full)..."
ufw allow 'OpenSSH'
ufw allow 'Nginx Full'
ufw --force enable

echo "=========================================================="
echo " ✅ FuelTaxPulse Setup Complete!"
echo " Backend Status: $(systemctl is-active fueltax-backend)"
echo " Nginx Status:   $(systemctl is-active nginx)"
echo " Application is now running on your VPS IP / Domain!"
echo "=========================================================="
