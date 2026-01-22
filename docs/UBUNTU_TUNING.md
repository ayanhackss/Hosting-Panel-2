# Ubuntu Tuning Guide for 2-4GB RAM Servers

This guide provides comprehensive optimization steps for running the Hosting Panel on resource-constrained servers.

## System Optimization

### 1. Swap Configuration

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. MariaDB Optimization

Edit `/etc/mysql/mariadb.conf.d/99-hosting-panel.cnf`:

```ini
[mysqld]
# Memory settings for 2-4GB RAM
innodb_buffer_pool_size = 512M
innodb_log_file_size = 128M
innodb_log_buffer_size = 8M

# Connection settings
max_connections = 50
thread_cache_size = 8
table_open_cache = 400

# Query cache
query_cache_type = 1
query_cache_size = 32M
query_cache_limit = 2M

# Performance
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
```

### 3. PHP-FPM Optimization

Edit `/etc/php/8.2/fpm/pool.d/www.conf`:

```ini
[www]
pm = ondemand
pm.max_children = 5
pm.process_idle_timeout = 10s
pm.max_requests = 500

# Memory limits
php_admin_value[memory_limit] = 128M
```

### 4. Nginx Optimization

Edit `/etc/nginx/nginx.conf`:

```nginx
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer settings
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 100M;
    large_client_header_buffers 2 1k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

### 5. Kernel Tuning

Edit `/etc/sysctl.conf`:

```bash
# Network optimization
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_tw_reuse = 1

# File descriptor limits
fs.file-max = 65535

# Memory management
vm.swappiness = 10
vm.vfs_cache_pressure = 50
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
```

Apply changes:
```bash
sudo sysctl -p
```

### 6. Log Rotation

Create `/etc/logrotate.d/hosting-panel`:

```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/var/log/php*-fpm/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
}
```

### 7. Disable Unnecessary Services

```bash
# List all services
systemctl list-unit-files --type=service --state=enabled

# Disable unnecessary services
sudo systemctl disable bluetooth.service
sudo systemctl disable cups.service
sudo systemctl disable avahi-daemon.service
```

### 8. Automatic Security Updates

```bash
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 9. Process Limits

Edit `/etc/security/limits.conf`:

```
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
```

### 10. PM2 Optimization

```bash
# Set PM2 to use less memory
pm2 set pm2:sysmonit false

# Optimize PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Monitoring Commands

### Check Memory Usage
```bash
free -h
```

### Check Disk Usage
```bash
df -h
```

### Check CPU Usage
```bash
top
# or
htop
```

### Check Service Status
```bash
systemctl status nginx mariadb php8.2-fpm redis-server
```

### Check Active Connections
```bash
netstat -an | grep ESTABLISHED | wc -l
```

### Check MySQL Performance
```bash
mysql -e "SHOW GLOBAL STATUS LIKE '%connection%';"
mysql -e "SHOW GLOBAL STATUS LIKE '%thread%';"
```

## Troubleshooting

### High Memory Usage

1. Check which process is using memory:
```bash
ps aux --sort=-%mem | head -10
```

2. Restart services:
```bash
systemctl restart nginx php8.2-fpm mariadb
```

### High CPU Usage

1. Check top processes:
```bash
top -o %CPU
```

2. Check for runaway PHP processes:
```bash
ps aux | grep php-fpm
```

### Disk Space Issues

1. Find large files:
```bash
du -h --max-depth=1 / | sort -hr | head -20
```

2. Clean old logs:
```bash
journalctl --vacuum-time=7d
```

## Performance Benchmarks

Expected performance on 2GB RAM server:
- **Panel RAM**: 400-600MB
- **MariaDB**: 300-500MB
- **Nginx**: 50-100MB
- **PHP-FPM**: 100-200MB per pool
- **Redis**: 50-100MB
- **Available for apps**: ~800MB-1.2GB

## Best Practices

1. **Monitor regularly** - Set up alerts for high resource usage
2. **Keep updated** - Regular security and package updates
3. **Limit websites** - Don't overload a 2GB server (max 5-10 sites)
4. **Use caching** - Enable Redis for dynamic sites
5. **Optimize databases** - Regular optimization and cleanup
6. **Clean logs** - Automated log rotation and cleanup
7. **Use CDN** - Offload static assets when possible

---

**Note**: These settings are optimized for 2-4GB RAM. Adjust based on your specific workload!
