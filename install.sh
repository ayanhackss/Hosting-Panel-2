#!/bin/bash

#############################################
# NexPanel - One-Command Installer
# For Ubuntu 20.04 / 22.04 LTS
# Next-generation hosting management
#############################################

set -e

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Log file setup with validation
LOG_FILE="/var/log/nexpanel-install.log"
STATE_FILE="/tmp/nexpanel-install-state"
BACKUP_DIR="/tmp/nexpanel-backup-$(date +%s)"

# Ensure log directory exists and is writable
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
if ! touch "$LOG_FILE" 2>/dev/null; then
    LOG_FILE="/tmp/nexpanel-install.log"
    echo "Warning: Using temporary log file: $LOG_FILE"
fi

exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

# Progress tracking
TOTAL_STEPS=12
CURRENT_STEP=0

# Track installed components for rollback
INSTALLED_PACKAGES=()
CREATED_FILES=()
MODIFIED_FILES=()

#############################################
# Helper Functions
#############################################

print_banner() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║                    🚀 NEXPANEL INSTALLER                     ║"
    echo "║                                                              ║"
    echo "║            Next-Generation Hosting Management                ║"
    echo "║                        v1.0.0                                ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local step_name="$1"
    local percentage=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    
    echo ""
    echo -e "${BOLD}${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}[${CURRENT_STEP}/${TOTAL_STEPS}]${NC} ${GREEN}${BOLD}${step_name}${NC} ${DIM}(${percentage}%)${NC}"
    echo -e "${BOLD}${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

spinner() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${CYAN}${spin:$i:1}${NC} ${message}..."
        sleep 0.1
    done
    printf "\r"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

save_state() {
    echo "$CURRENT_STEP" > "$STATE_FILE"
}

load_state() {
    if [ -f "$STATE_FILE" ]; then
        CURRENT_STEP=$(cat "$STATE_FILE")
        print_info "Resuming from step $CURRENT_STEP"
    fi
}

backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$file" "$BACKUP_DIR/$(basename "$file").backup"
        MODIFIED_FILES+=("$file")
        print_info "Backed up: $file"
    fi
}

cleanup_on_failure() {
    echo ""
    print_error "Installation failed! Initiating cleanup..."
    
    # Don't cleanup if user wants to keep partial installation
    read -p "$(echo -e ${YELLOW}Do you want to rollback changes? [y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Keeping partial installation. You can resume later."
        print_info "State saved to: $STATE_FILE"
        print_info "Backups saved to: $BACKUP_DIR"
        return
    fi
    
    # Stop services that were started
    print_info "Stopping services..."
    systemctl stop nexpanel 2>/dev/null || true
    
    # Restore backed up files
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        print_info "Restoring backed up files..."
        for backup in "$BACKUP_DIR"/*.backup; do
            if [ -f "$backup" ]; then
                original="${backup%.backup}"
                original="$(basename "$original")"
                # Find original location from MODIFIED_FILES
                for file in "${MODIFIED_FILES[@]}"; do
                    if [[ "$file" == *"$original"* ]]; then
                        cp "$backup" "$file"
                        print_success "Restored: $file"
                    fi
                done
            fi
        done
    fi
    
    # Remove created files
    for file in "${CREATED_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm -f "$file"
            print_success "Removed: $file"
        fi
    done
    
    # Remove state file
    rm -f "$STATE_FILE"
    
    print_warning "Cleanup complete. System restored to pre-installation state."
    print_info "Backup files are kept in: $BACKUP_DIR"
}

handle_error() {
    local line_no=$1
    local error_code=$2
    print_error "Installation failed at line ${line_no} with error code ${error_code}"
    print_info "Check the log file: ${LOG_FILE}"
    cleanup_on_failure
    exit 1
}

run_with_timeout() {
    local timeout_duration=$1
    shift
    local command="$@"
    
    timeout "$timeout_duration" bash -c "$command" || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_error "Command timed out after ${timeout_duration}s: $command"
        fi
        return $exit_code
    }
}

trap 'handle_error ${LINENO} $?' ERR
trap cleanup_on_failure EXIT


#############################################
# Pre-Installation Checks
#############################################

print_banner

print_step "Pre-Installation Checks"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "This script must be run as root"
    echo -e "${YELLOW}Please run: ${WHITE}sudo bash install.sh${NC}"
    exit 1
fi
print_success "Running as root"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    print_error "Cannot detect OS"
    exit 1
fi

# Validate OS
if [ "$OS" != "ubuntu" ]; then
    print_error "This installer only supports Ubuntu"
    print_info "Detected OS: $OS"
    exit 1
fi
print_success "OS: Ubuntu $VER"

if [ "$VER" != "20.04" ] && [ "$VER" != "22.04" ]; then
    print_warning "This installer is tested on Ubuntu 20.04/22.04"
    print_warning "You are running Ubuntu $VER"
    read -p "$(echo -e ${YELLOW}Continue anyway? [y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 1800 ]; then
    print_error "Minimum 2GB RAM required (found ${TOTAL_RAM}MB)"
    exit 1
fi
print_success "RAM: ${TOTAL_RAM}MB"

# Check disk space
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$DISK_SPACE" -lt 10 ]; then
    print_error "Minimum 10GB free disk space required"
    exit 1
fi
print_success "Disk: ${DISK_SPACE}GB available"

# Check internet connectivity
if ! ping -c 1 8.8.8.8 &> /dev/null; then
    print_error "No internet connection detected"
    exit 1
fi
print_success "Internet connection active"

#############################################
# System Update
#############################################

print_step "Updating System Packages"

print_info "Updating package lists..."
timeout 300 apt-get update -qq 2>&1 | tee -a "$LOG_FILE" > /dev/null &
PID=$!
spinner $PID "Updating package lists"
wait $PID || handle_error $LINENO $?
print_success "Package lists updated"

print_info "Upgrading packages (this may take a while)..."
DEBIAN_FRONTEND=noninteractive timeout 600 apt-get upgrade -y -qq 2>&1 | tee -a "$LOG_FILE" > /dev/null &
PID=$!
spinner $PID "Upgrading packages"
wait $PID || handle_error $LINENO $?
print_success "System packages upgraded"

save_state

#############################################
# Install Core Dependencies
#############################################

print_step "Installing Core Dependencies"

CORE_PACKAGES=(
    "curl"
    "wget"
    "git"
    "unzip"
    "software-properties-common"
    "build-essential"
    "ufw"
    "fail2ban"
    "certbot"
    "python3-certbot-nginx"
)

for package in "${CORE_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        print_success "$package already installed"
    else
        print_info "Installing $package..."
        apt-get install -y -qq "$package" 2>&1 | tee -a "$LOG_FILE" > /dev/null
        print_success "$package installed"
    fi
done

#############################################
# Install Nginx
#############################################

print_step "Installing Nginx Web Server"

if systemctl is-active --quiet nginx; then
    print_success "Nginx already running"
else
    apt-get install -y -qq nginx 2>&1 | tee -a "$LOG_FILE" > /dev/null
    systemctl enable nginx
    systemctl start nginx
    print_success "Nginx installed and started"
fi

#############################################
# Install MariaDB
#############################################

print_step "Installing MariaDB Database"

if systemctl is-active --quiet mariadb; then
    print_success "MariaDB already running"
else
    print_info "Installing MariaDB..."
    apt-get install -y -qq mariadb-server mariadb-client 2>&1 | tee -a "$LOG_FILE" > /dev/null
    systemctl enable mariadb
    systemctl start mariadb
    print_success "MariaDB installed and started"
fi

# Secure MariaDB
print_info "Securing MariaDB installation..."
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';" 2>/dev/null || true
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='';" 2>/dev/null || true
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "DROP DATABASE IF EXISTS test;" 2>/dev/null || true
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;" 2>/dev/null || true
print_success "MariaDB secured"

# Create panel database
print_info "Creating NexPanel database..."
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS nexpanel;" 2>/dev/null
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE USER IF NOT EXISTS 'panel_admin'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';" 2>/dev/null
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "GRANT ALL PRIVILEGES ON nexpanel.* TO 'panel_admin'@'localhost';" 2>/dev/null
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;" 2>/dev/null
print_success "Database 'nexpanel' created"

#############################################
# Install PHP-FPM (Multiple Versions)
#############################################

print_step "Installing PHP-FPM (Multiple Versions)"

print_info "Adding Ondřej Surý's PHP repository..."
add-apt-repository -y ppa:ondrej/php 2>&1 | tee -a "$LOG_FILE" > /dev/null
apt-get update -qq 2>&1 | tee -a "$LOG_FILE" > /dev/null
print_success "PHP repository added"

PHP_VERSIONS=("7.4" "8.0" "8.1" "8.2")
PHP_EXTENSIONS=("fpm" "mysql" "curl" "gd" "mbstring" "xml" "zip" "bcmath")

for PHP_VER in "${PHP_VERSIONS[@]}"; do
    print_info "Installing PHP ${PHP_VER}..."
    
    for EXT in "${PHP_EXTENSIONS[@]}"; do
        apt-get install -y -qq "php${PHP_VER}-${EXT}" 2>&1 | tee -a "$LOG_FILE" > /dev/null
    done
    
    systemctl enable "php${PHP_VER}-fpm" 2>/dev/null
    systemctl start "php${PHP_VER}-fpm" 2>/dev/null
    print_success "PHP ${PHP_VER} installed"
done

#############################################
# Install Node.js
#############################################

print_step "Installing Node.js 18 LTS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js already installed: $NODE_VERSION"
else
    print_info "Downloading Node.js setup script..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - 2>&1 | tee -a "$LOG_FILE" > /dev/null
    
    print_info "Installing Node.js..."
    apt-get install -y -qq nodejs 2>&1 | tee -a "$LOG_FILE" > /dev/null
    print_success "Node.js $(node -v) installed"
fi

# Install PM2
print_info "Installing PM2 process manager..."
npm install -g pm2 2>&1 | tee -a "$LOG_FILE" > /dev/null
pm2 startup systemd -u root --hp /root 2>&1 | tee -a "$LOG_FILE" > /dev/null
pm2 save 2>&1 | tee -a "$LOG_FILE" > /dev/null
print_success "PM2 installed"

#############################################
# Install Python
#############################################

print_step "Installing Python 3 and Tools"

PYTHON_PACKAGES=("python3" "python3-pip" "python3-venv" "python3-dev")

for package in "${PYTHON_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        print_success "$package already installed"
    else
        apt-get install -y -qq "$package" 2>&1 | tee -a "$LOG_FILE" > /dev/null
        print_success "$package installed"
    fi
done

print_info "Upgrading pip..."
pip3 install --upgrade pip 2>&1 | tee -a "$LOG_FILE" > /dev/null
pip3 install gunicorn uvicorn 2>&1 | tee -a "$LOG_FILE" > /dev/null
print_success "Python tools installed"

#############################################
# Install Redis
#############################################

print_step "Installing Redis Cache Server"

if systemctl is-active --quiet redis-server; then
    print_success "Redis already running"
else
    apt-get install -y -qq redis-server 2>&1 | tee -a "$LOG_FILE" > /dev/null
    systemctl enable redis-server
    systemctl start redis-server
    print_success "Redis installed and started"
fi

# Install FTP server
print_info "Installing VSFTPD..."
apt-get install -y -qq vsftpd 2>&1 | tee -a "$LOG_FILE" > /dev/null
print_success "VSFTPD installed"

#############################################
# Configure Firewall
#############################################

print_step "Configuring Firewall (UFW)"

ufw --force enable 2>&1 | tee -a "$LOG_FILE" > /dev/null
ufw allow 22/tcp comment 'SSH' 2>&1 | tee -a "$LOG_FILE" > /dev/null
ufw allow 80/tcp comment 'HTTP' 2>&1 | tee -a "$LOG_FILE" > /dev/null
ufw allow 443/tcp comment 'HTTPS' 2>&1 | tee -a "$LOG_FILE" > /dev/null
ufw allow 8080/tcp comment 'NexPanel' 2>&1 | tee -a "$LOG_FILE" > /dev/null
ufw reload 2>&1 | tee -a "$LOG_FILE" > /dev/null

print_success "Firewall configured"
print_info "Allowed ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (Panel)"

#############################################
# Install NexPanel Application
#############################################

print_step "Installing NexPanel Application"

PANEL_DIR="/opt/nexpanel"
print_info "Creating directory: $PANEL_DIR"
mkdir -p "$PANEL_DIR"
cd "$PANEL_DIR"

# Create package.json
cat > package.json << 'EOF'
{
  "name": "nexpanel",
  "version": "1.0.0",
  "description": "NexPanel - Next-generation hosting management",
  "scripts": {
    "start": "node src/server.js"
  }
}
EOF

# Create data directories
mkdir -p "$PANEL_DIR/data"
mkdir -p /var/www
print_success "NexPanel directories created"

save_state

#############################################
# Create Systemd Service
#############################################

print_step "Creating Systemd Service"

backup_file "/etc/systemd/system/nexpanel.service"
cat > /etc/systemd/system/nexpanel.service << EOF
[Unit]
Description=NexPanel - Next-Generation Hosting Management
After=network.target mariadb.service nginx.service
Wants=mariadb.service nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nexpanel
Environment="NODE_ENV=production"
Environment="PORT=8080"
Environment="DB_PASSWORD=${MYSQL_ROOT_PASSWORD}"
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

CREATED_FILES+=("/etc/systemd/system/nexpanel.service")
systemctl daemon-reload
print_success "Systemd service created"

save_state

#############################################
# Generate Admin Credentials
#############################################

ADMIN_PASSWORD=$(openssl rand -base64 16)

# Save credentials
backup_file "/root/nexpanel-credentials.txt"
cat > /root/nexpanel-credentials.txt << EOF
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                    NEXPANEL CREDENTIALS                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Panel URL: http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080
Username: admin
Password: ${ADMIN_PASSWORD}

MariaDB Root Password: ${MYSQL_ROOT_PASSWORD}

═══════════════════════════════════════════════════════════════

IMPORTANT: Save these credentials securely!
This file will be deleted on next reboot.

To access the panel:
1. Open your browser
2. Go to http://YOUR_SERVER_IP:8080
3. Login with the credentials above

To manage the panel:
  systemctl status nexpanel
  systemctl restart nexpanel
  systemctl stop nexpanel
  systemctl start nexpanel

View logs:
  journalctl -u nexpanel -f

Panel directory:
  /opt/nexpanel

═══════════════════════════════════════════════════════════════
EOF

chmod 600 /root/nexpanel-credentials.txt
CREATED_FILES+=("/root/nexpanel-credentials.txt")
print_success "Credentials saved to /root/nexpanel-credentials.txt"

#############################################
# System Optimization
#############################################

print_step "Applying System Optimizations"

# MariaDB tuning
print_info "Optimizing MariaDB for 2-4GB RAM..."
backup_file "/etc/mysql/mariadb.conf.d/99-nexpanel.cnf"
cat > /etc/mysql/mariadb.conf.d/99-nexpanel.cnf << EOF
[mysqld]
innodb_buffer_pool_size = 512M
innodb_log_file_size = 128M
max_connections = 50
query_cache_size = 32M
query_cache_limit = 2M
thread_cache_size = 8
table_open_cache = 400
EOF

CREATED_FILES+=("/etc/mysql/mariadb.conf.d/99-nexpanel.cnf")
systemctl restart mariadb
print_success "MariaDB optimized"

# Nginx tuning
print_info "Optimizing Nginx..."
backup_file "/etc/nginx/conf.d/tuning.conf"
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

CREATED_FILES+=("/etc/nginx/conf.d/tuning.conf")
systemctl restart nginx
print_success "Nginx optimized"

save_state

#############################################
# Health Checks
#############################################

print_step "Running Health Checks"

SERVICES=("nginx" "mariadb" "php8.2-fpm" "redis-server")
ALL_HEALTHY=true

for SERVICE in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$SERVICE"; then
        print_success "$SERVICE is running"
    else
        print_warning "$SERVICE is not running"
        ALL_HEALTHY=false
    fi
done

# Check Node.js
if check_command "node"; then
    :
else
    ALL_HEALTHY=false
fi

# Check npm
if check_command "npm"; then
    :
else
    ALL_HEALTHY=false
fi

#############################################
# Installation Complete
#############################################

echo ""
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║              🎉 INSTALLATION COMPLETE! 🎉                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ All services are running properly${NC}"
else
    echo -e "${YELLOW}⚠ Some services may need attention${NC}"
fi

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}${BOLD}Your credentials:${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cat /root/nexpanel-credentials.txt
echo ""

echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}${BOLD}Next steps:${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}1.${NC} Copy the panel source code to ${CYAN}/opt/nexpanel${NC}"
echo -e "${YELLOW}2.${NC} Run: ${WHITE}cd /opt/nexpanel && npm install${NC}"
echo -e "${YELLOW}3.${NC} Start the panel: ${WHITE}systemctl start nexpanel${NC}"
echo -e "${YELLOW}4.${NC} Access at ${WHITE}http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080${NC}"
echo ""

echo -e "${DIM}Installation log: ${LOG_FILE}${NC}"
echo -e "${DIM}Credentials file: /root/nexpanel-credentials.txt${NC}"
echo ""

echo -e "${GREEN}${BOLD}Thank you for choosing NexPanel! 🚀${NC}"
echo ""

# Clean up state file on successful installation
rm -f "$STATE_FILE"

# Disable cleanup trap on successful completion
trap - EXIT
