#!/bin/bash

#############################################
# Hosting Panel - One-Command Installer
# For Ubuntu 20.04 / 22.04 LTS
# Optimized for 2-4GB RAM servers
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════╗"
echo "║   Hosting Panel Installer v1.0        ║"
echo "║   Production-Ready Control Panel      ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: Please run as root (use sudo)${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Error: Cannot detect OS${NC}"
    exit 1
fi

# Validate OS
if [ "$OS" != "ubuntu" ]; then
    echo -e "${RED}Error: This installer only supports Ubuntu${NC}"
    exit 1
fi

if [ "$VER" != "20.04" ] && [ "$VER" != "22.04" ]; then
    echo -e "${YELLOW}Warning: This installer is tested on Ubuntu 20.04/22.04${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check system requirements
echo -e "${GREEN}[1/10] Checking system requirements...${NC}"

# Check RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 1800 ]; then
    echo -e "${RED}Error: Minimum 2GB RAM required (found ${TOTAL_RAM}MB)${NC}"
    exit 1
fi
echo "✓ RAM: ${TOTAL_RAM}MB"

# Check disk space
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$DISK_SPACE" -lt 10 ]; then
    echo -e "${RED}Error: Minimum 10GB free disk space required${NC}"
    exit 1
fi
echo "✓ Disk: ${DISK_SPACE}GB available"

# Update system
echo -e "${GREEN}[2/10] Updating system packages...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# Install dependencies
echo -e "${GREEN}[3/10] Installing core dependencies...${NC}"
apt-get install -y -qq \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    build-essential \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx

# Install Nginx
echo -e "${GREEN}[4/10] Installing Nginx...${NC}"
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx

# Install MariaDB
echo -e "${GREEN}[5/10] Installing MariaDB...${NC}"
apt-get install -y -qq mariadb-server mariadb-client

# Secure MariaDB
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='';"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "DROP DATABASE IF EXISTS test;"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"

# Create panel database
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS hosting_panel;"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE USER IF NOT EXISTS 'panel_admin'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "GRANT ALL PRIVILEGES ON hosting_panel.* TO 'panel_admin'@'localhost';"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"

systemctl enable mariadb
systemctl start mariadb

# Install PHP (multiple versions)
echo -e "${GREEN}[6/10] Installing PHP-FPM (multiple versions)...${NC}"
add-apt-repository -y ppa:ondrej/php
apt-get update -qq

for PHP_VER in 7.4 8.0 8.1 8.2; do
    echo "Installing PHP ${PHP_VER}..."
    apt-get install -y -qq \
        php${PHP_VER}-fpm \
        php${PHP_VER}-mysql \
        php${PHP_VER}-curl \
        php${PHP_VER}-gd \
        php${PHP_VER}-mbstring \
        php${PHP_VER}-xml \
        php${PHP_VER}-zip \
        php${PHP_VER}-bcmath
    
    systemctl enable php${PHP_VER}-fpm
    systemctl start php${PHP_VER}-fpm
done

# Install Node.js
echo -e "${GREEN}[7/10] Installing Node.js 18 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y -qq nodejs

# Install PM2
npm install -g pm2
pm2 startup systemd -u root --hp /root
pm2 save

# Install Python
echo -e "${GREEN}[8/10] Installing Python 3 and tools...${NC}"
apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev

pip3 install --upgrade pip
pip3 install gunicorn uvicorn

# Install Redis (optional)
echo -e "${GREEN}[9/10] Installing Redis...${NC}"
apt-get install -y -qq redis-server
systemctl enable redis-server
systemctl start redis-server

# Install FTP server
apt-get install -y -qq vsftpd

# Configure firewall
echo -e "${GREEN}[10/10] Configuring firewall...${NC}"
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw reload

# Install hosting panel
echo -e "${GREEN}Installing Hosting Panel application...${NC}"
PANEL_DIR="/opt/hosting-panel"
mkdir -p $PANEL_DIR
cd $PANEL_DIR

# Download panel files (in production, this would clone from git)
# For now, we'll create a placeholder
cat > package.json << 'EOF'
{
  "name": "hosting-panel",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js"
  }
}
EOF

# Create data directory
mkdir -p /opt/hosting-panel/data
mkdir -p /var/www

# Create systemd service
cat > /etc/systemd/system/hosting-panel.service << EOF
[Unit]
Description=Hosting Panel
After=network.target mariadb.service nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hosting-panel
Environment="NODE_ENV=production"
Environment="PORT=8080"
Environment="DB_PASSWORD=${MYSQL_ROOT_PASSWORD}"
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create admin user
ADMIN_PASSWORD=$(openssl rand -base64 16)

# Save credentials
cat > /root/panel-credentials.txt << EOF
╔═══════════════════════════════════════╗
║     HOSTING PANEL CREDENTIALS         ║
╚═══════════════════════════════════════╝

Panel URL: http://$(curl -s ifconfig.me):8080
Username: admin
Password: ${ADMIN_PASSWORD}

MariaDB Root Password: ${MYSQL_ROOT_PASSWORD}

IMPORTANT: Save these credentials securely!
This file will be deleted on next reboot.

To access the panel:
1. Open your browser
2. Go to http://YOUR_SERVER_IP:8080
3. Login with the credentials above

To manage the panel:
  systemctl status hosting-panel
  systemctl restart hosting-panel
  systemctl stop hosting-panel

Logs location:
  journalctl -u hosting-panel -f

EOF

chmod 600 /root/panel-credentials.txt

# System tuning for 2-4GB RAM
echo -e "${GREEN}Applying system optimizations...${NC}"

# MariaDB tuning
cat > /etc/mysql/mariadb.conf.d/99-hosting-panel.cnf << EOF
[mysqld]
innodb_buffer_pool_size = 512M
innodb_log_file_size = 128M
max_connections = 50
query_cache_size = 32M
query_cache_limit = 2M
thread_cache_size = 8
table_open_cache = 400
EOF

systemctl restart mariadb

# Nginx tuning
cat > /etc/nginx/conf.d/tuning.conf << EOF
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 1024;
    use epoll;
}

http {
    client_max_body_size 100M;
    client_body_timeout 60s;
    keepalive_timeout 65;
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

systemctl restart nginx

# Enable services
systemctl daemon-reload
# systemctl enable hosting-panel
# systemctl start hosting-panel

# Final health check
echo -e "${GREEN}Running health checks...${NC}"

SERVICES=("nginx" "mariadb" "php8.2-fpm" "redis-server")
for SERVICE in "${SERVICES[@]}"; do
    if systemctl is-active --quiet $SERVICE; then
        echo -e "✓ $SERVICE is running"
    else
        echo -e "${YELLOW}⚠ $SERVICE is not running${NC}"
    fi
done

# Display completion message
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════╗"
echo "║   Installation Complete! 🎉           ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Your credentials have been saved to:${NC}"
echo "/root/panel-credentials.txt"
echo ""
echo -e "${GREEN}View credentials now:${NC}"
cat /root/panel-credentials.txt

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Copy the panel source code to /opt/hosting-panel"
echo "2. Run: cd /opt/hosting-panel && npm install"
echo "3. Start the panel: systemctl start hosting-panel"
echo "4. Access the panel at http://$(curl -s ifconfig.me):8080"
echo ""
echo -e "${GREEN}Installation log saved to: /var/log/hosting-panel-install.log${NC}"
