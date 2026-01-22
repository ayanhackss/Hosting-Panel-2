# System Architecture

## Overview

The Hosting Panel is a single-panel hosting control system built with Node.js and designed for production use on Ubuntu 22.04 servers with 2-4GB RAM.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (443) / HTTP (80)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                         Nginx                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Panel (8080) │  │ PHP Sites    │  │ Node/Python  │      │
│  │ Reverse Proxy│  │ FastCGI      │  │ Reverse Proxy│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────┬────────────────┬────────────────┬──────────────────┘
         │                │                │
         ▼                ▼                ▼
┌────────────────┐  ┌─────────────┐  ┌──────────────┐
│ Hosting Panel  │  │  PHP-FPM    │  │  PM2         │
│ (Fastify)      │  │  Pools      │  │  (Node/Py)   │
│                │  │             │  │              │
│ Port: 8080     │  │ Multi-ver   │  │ Process Mgr  │
└────────┬───────┘  └──────┬──────┘  └──────┬───────┘
         │                 │                │
         ▼                 ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    System Services                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ MariaDB  │  │  Redis   │  │ Fail2ban │  │  UFW     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System                               │
│  /var/www/        - Website files                           │
│  /opt/hosting-panel/ - Panel application                    │
│  /etc/nginx/      - Nginx configs                           │
│  /etc/php/        - PHP-FPM pools                           │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Hosting Panel (Core)

**Technology**: Node.js 18 LTS with Fastify framework

**Responsibilities**:
- User authentication and session management
- Website/app lifecycle management
- Service orchestration
- API endpoints for all features
- Server-rendered UI

**Key Files**:
- `src/server.js` - Main application entry
- `src/config/database.js` - Database connections
- `src/routes/` - API route handlers
- `src/services/` - Business logic services
- `src/views/` - EJS templates

### 2. Web Server (Nginx)

**Responsibilities**:
- Reverse proxy for panel (port 8080)
- PHP-FPM integration via FastCGI
- Reverse proxy for Node.js/Python apps
- SSL termination
- Static file serving
- Load balancing (future)

**Configuration**:
- `/etc/nginx/sites-available/` - Virtual host configs
- `/etc/nginx/sites-enabled/` - Active sites (symlinks)
- `/etc/nginx/conf.d/` - Global configurations

### 3. Runtime Managers

#### PHP-FPM
- **Versions**: 7.4, 8.0, 8.1, 8.2
- **Pool Management**: One pool per website
- **Process Manager**: ondemand (memory efficient)
- **Resource Limits**: 5 children max, 128MB memory

#### PM2 (Node.js & Python)
- **Process Management**: Start/stop/restart apps
- **Auto-restart**: On crashes
- **Log Management**: Centralized logging
- **Memory Limits**: 256MB per app
- **Clustering**: Single instance per app (resource-constrained)

### 4. Databases

#### MariaDB
- **Purpose**: User databases, application data
- **Configuration**: Optimized for 2-4GB RAM
- **Buffer Pool**: 512MB
- **Max Connections**: 50

#### SQLite
- **Purpose**: Panel metadata (websites, users, configs)
- **Location**: `/opt/hosting-panel/data/panel.db`
- **Advantages**: No separate server, fast for small datasets

### 5. Security Layer

#### Authentication
- Session-based with secure cookies
- TOTP-based 2FA
- Rate limiting (5 attempts per 5 minutes)
- Audit logging

#### Fail2ban
- Monitors login attempts
- Auto-bans after failed attempts
- Configurable jails

#### UFW Firewall
- Default deny incoming
- Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (Panel)
- Managed via panel

## Data Flow

### Website Creation Flow

```
User Request → Panel API → Validation
    ↓
Create Database Record (SQLite)
    ↓
Create Directory (/var/www/sitename)
    ↓
Generate Nginx Config → Test Config → Reload Nginx
    ↓
Create PHP-FPM Pool (if PHP) → Reload PHP-FPM
    ↓
Return Success → Update UI
```

### Application Start Flow (Node.js/Python)

```
User Request → Panel API → Get Website Info
    ↓
Check if app exists → Validate package.json/requirements.txt
    ↓
Install Dependencies (npm install / pip install)
    ↓
Start with PM2 → Allocate Port → Update Database
    ↓
Health Check → Return Status
```

### SSL Certificate Issuance Flow

```
User Request → Panel API → Validate Domain
    ↓
Check DNS Resolution
    ↓
Run Certbot (Let's Encrypt)
    ↓
Update Nginx Config (add SSL block)
    ↓
Test Config → Reload Nginx
    ↓
Set up Auto-renewal Cron
    ↓
Update Database → Return Success
```

## Resource Management

### Memory Allocation (4GB Server)

```
System Reserved:     ~500MB
Panel:              ~500MB
MariaDB:            ~500MB
Nginx:              ~100MB
PHP-FPM Pools:      ~200MB (5 pools × 40MB)
Redis:              ~100MB
Available for Apps: ~2GB
```

### Process Limits

- **PHP-FPM**: Max 5 children per pool
- **Node.js**: Max 256MB per app
- **Python**: Max 2 workers per app
- **MariaDB**: Max 50 connections

### Idle App Management

Apps idle for >10 minutes are automatically stopped to free resources.

## Security Model

### File Permissions

```
/var/www/sitename/
  Owner: www-data:www-data
  Permissions: 755 (directories), 644 (files)

/opt/hosting-panel/
  Owner: root:root
  Permissions: 750

/etc/nginx/sites-available/
  Owner: root:root
  Permissions: 644
```

### User Isolation

- Each website runs under `www-data` user
- PHP-FPM pools are isolated
- Chroot jails for FTP users
- No shell access for website users

### Network Security

- UFW firewall enabled
- Fail2ban for brute-force protection
- Rate limiting on all API endpoints
- HTTPS enforced for panel access

## Scalability Considerations

### Current Limitations (2-4GB RAM)

- **Max Websites**: 10-15 (depending on traffic)
- **Max Concurrent PHP Requests**: ~25-50
- **Max Node.js Apps**: 5-8
- **Max Database Connections**: 50

### Future Enhancements

- **Load Balancing**: Multiple backend servers
- **Database Replication**: Master-slave setup
- **CDN Integration**: Offload static assets
- **Caching Layer**: Varnish or Redis caching
- **Horizontal Scaling**: Add more servers

## Monitoring & Logging

### Logs Location

```
Panel:      /var/log/hosting-panel/
Nginx:      /var/log/nginx/
PHP-FPM:    /var/log/php-fpm/
MariaDB:    /var/log/mysql/
System:     journalctl -u hosting-panel
```

### Monitoring Metrics

- CPU usage (per-core and average)
- Memory usage (total, used, free)
- Disk usage and I/O
- Network traffic
- Service status
- Application health

## Backup Strategy

### What's Backed Up

- Website files (`/var/www/`)
- Databases (MariaDB dumps)
- Nginx configurations
- Panel database (SQLite)

### Backup Schedule

- **Daily**: Incremental backups
- **Weekly**: Full backups
- **Retention**: 7 days daily, 4 weeks weekly

### Restore Process

1. Select backup from panel
2. Confirm restore
3. Stop affected services
4. Restore files and database
5. Restart services
6. Verify functionality

---

**Note**: This architecture is designed for single-server deployments. For multi-server setups, additional components (load balancer, shared storage) would be required.
