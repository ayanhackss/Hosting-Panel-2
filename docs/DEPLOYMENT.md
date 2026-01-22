# Production Deployment Guide

## Pre-Deployment Checklist

- [ ] Ubuntu 22.04 LTS server with minimum 2GB RAM
- [ ] Root or sudo access
- [ ] Domain name pointed to server IP
- [ ] SSH access configured
- [ ] Firewall rules reviewed

## Deployment Steps

### 1. Prepare Server

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Set hostname
sudo hostnamectl set-hostname panel.yourdomain.com

# Configure timezone
sudo timedpkg-reconfigure tzdata
```

### 2. Run Installer

```bash
# Download and run installer
curl -sSL https://raw.githubusercontent.com/yourusername/hosting-panel/main/install.sh | sudo bash
```

### 3. Deploy Panel Code

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/yourusername/hosting-panel.git
cd hosting-panel

# Install dependencies
sudo npm install --production

# Create environment file
sudo cp .env.example .env
sudo nano .env
```

### 4. Configure Environment

Edit `/opt/hosting-panel/.env`:

```env
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_USER=panel_admin
DB_PASSWORD=your_secure_password
DB_NAME=hosting_panel

# Session
SESSION_SECRET=generate_random_32_char_string

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password
```

### 5. Initialize Database

```bash
# Run setup script
sudo node scripts/setup.js
```

### 6. Start Panel

```bash
# Enable and start service
sudo systemctl enable hosting-panel
sudo systemctl start hosting-panel

# Check status
sudo systemctl status hosting-panel
```

### 7. Configure SSL for Panel

```bash
# Install SSL certificate
sudo certbot --nginx -d panel.yourdomain.com

# Update Nginx config to proxy to panel
sudo nano /etc/nginx/sites-available/panel
```

Add:
```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name panel.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Verify Installation

```bash
# Check all services
sudo systemctl status nginx mariadb php8.2-fpm redis-server hosting-panel

# Check logs
sudo journalctl -u hosting-panel -f

# Test panel access
curl -I https://panel.yourdomain.com
```

## Post-Deployment

### Security Hardening

1. **Change Default Passwords**
```bash
# Change admin password via panel UI
# Change MariaDB root password
sudo mysql_secure_installation
```

2. **Enable 2FA**
- Login to panel
- Go to Settings → Security
- Enable Two-Factor Authentication

3. **Configure Fail2ban**
```bash
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[hosting-panel]
enabled = true
port = 80,443
filter = hosting-panel
logpath = /var/log/hosting-panel/access.log
maxretry = 5
bantime = 3600
```

4. **Restrict SSH Access**
```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PermitRootLogin no
PasswordAuthentication no
```

### Monitoring Setup

1. **Set Up Alerts**
- Configure email in panel settings
- Enable resource usage alerts
- Set thresholds (CPU >80%, RAM >90%, Disk >85%)

2. **Log Monitoring**
```bash
# Install logwatch
sudo apt-get install logwatch

# Configure daily reports
sudo nano /etc/cron.daily/00logwatch
```

### Backup Configuration

1. **Enable Automated Backups**
- Login to panel
- Go to Backups → Settings
- Enable daily backups
- Set retention policy (7 days)

2. **Off-site Backup**
```bash
# Install rclone for cloud backups
curl https://rclone.org/install.sh | sudo bash

# Configure cloud storage
rclone config
```

## Maintenance

### Regular Tasks

**Daily**:
- Check system resources
- Review error logs
- Verify backups completed

**Weekly**:
- Update packages: `sudo apt-get update && sudo apt-get upgrade`
- Review security logs
- Test backup restore

**Monthly**:
- Review user accounts
- Audit SSL certificates
- Performance optimization

### Troubleshooting

**Panel Won't Start**:
```bash
# Check logs
sudo journalctl -u hosting-panel -n 50

# Check port availability
sudo netstat -tulpn | grep 8080

# Restart service
sudo systemctl restart hosting-panel
```

**High Memory Usage**:
```bash
# Check top processes
ps aux --sort=-%mem | head -10

# Restart services
sudo systemctl restart nginx php8.2-fpm mariadb
```

**Database Connection Issues**:
```bash
# Check MariaDB status
sudo systemctl status mariadb

# Check connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Restart MariaDB
sudo systemctl restart mariadb
```

## Scaling

### Vertical Scaling (Upgrade Server)

1. Upgrade to 4GB or 8GB RAM
2. Update tuning configurations
3. Increase process limits
4. Restart services

### Horizontal Scaling (Multiple Servers)

1. Set up load balancer
2. Configure shared storage (NFS/GlusterFS)
3. Database replication
4. Session storage (Redis cluster)

## Rollback Procedure

If deployment fails:

```bash
# Stop panel
sudo systemctl stop hosting-panel

# Restore previous version
cd /opt/hosting-panel
sudo git checkout previous-tag

# Restore database
sudo mysql hosting_panel < backup.sql

# Restart panel
sudo systemctl start hosting-panel
```

---

**Support**: For issues, check logs first, then consult documentation or open an issue on GitHub.
