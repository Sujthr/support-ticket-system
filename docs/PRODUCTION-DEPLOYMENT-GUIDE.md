# SupportDesk - Production Deployment Guide

> **Audience**: Junior support engineers and DevOps personnel.
> This guide covers every step required to deploy SupportDesk on a Linux server (Ubuntu 22.04/24.04 LTS).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Setup](#2-server-setup)
3. [Install System Dependencies](#3-install-system-dependencies)
4. [Install and Configure PostgreSQL](#4-install-and-configure-postgresql)
5. [Install and Configure Meilisearch (Optional)](#5-install-and-configure-meilisearch-optional)
6. [Clone the Repository](#6-clone-the-repository)
7. [Configure Backend Environment](#7-configure-backend-environment)
8. [Configure Frontend Environment](#8-configure-frontend-environment)
9. [Build the Application](#9-build-the-application)
10. [Run Database Migrations](#10-run-database-migrations)
11. [Set Up Process Manager (PM2)](#11-set-up-process-manager-pm2)
12. [Configure Nginx Reverse Proxy](#12-configure-nginx-reverse-proxy)
13. [Set Up SSL with Let's Encrypt](#13-set-up-ssl-with-lets-encrypt)
14. [Configure Firewall](#14-configure-firewall)
15. [Set Up Log Rotation](#15-set-up-log-rotation)
16. [Verify the Deployment](#16-verify-the-deployment)
17. [Backup Strategy](#17-backup-strategy)
18. [Updating the Application](#18-updating-the-application)
19. [Desktop App Installer Build](#19-desktop-app-installer-build)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

| Requirement           | Minimum        | Recommended     |
|-----------------------|----------------|-----------------|
| **Server OS**         | Ubuntu 22.04   | Ubuntu 24.04    |
| **RAM**               | 2 GB           | 4 GB            |
| **CPU**               | 1 vCPU         | 2 vCPU          |
| **Disk**              | 20 GB          | 50 GB SSD       |
| **Domain name**       | Required       | With DNS access |
| **SSH access**        | Root or sudo   |                 |

**Accounts needed:**
- SSH access to the server
- A domain name pointed to the server IP (e.g., `support.yourcompany.com`)
- SMTP email credentials (Gmail App Password, SendGrid, AWS SES, etc.)
- GitHub access to the repository

---

## 2. Server Setup

### 2.1. Connect to the server

```bash
ssh root@your-server-ip
# Or if using a non-root user:
ssh your-user@your-server-ip
```

### 2.2. Create a deployment user (if not exists)

```bash
sudo adduser supportdesk
sudo usermod -aG sudo supportdesk
su - supportdesk
```

### 2.3. Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Install System Dependencies

### 3.1. Install Node.js 20 LTS

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

### 3.2. Install essential build tools

```bash
sudo apt install -y build-essential git curl wget unzip
```

---

## 4. Install and Configure PostgreSQL

### 4.1. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Verify it's running
sudo systemctl status postgresql
```

### 4.2. Create the database and user

```bash
# Switch to postgres system user
sudo -u postgres psql

# Inside the PostgreSQL shell, run these commands:
CREATE USER supportdesk WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD_HERE';
CREATE DATABASE support_tickets OWNER supportdesk;
GRANT ALL PRIVILEGES ON DATABASE support_tickets TO supportdesk;
\q
```

> **IMPORTANT**: Replace `CHOOSE_A_STRONG_PASSWORD_HERE` with a strong, unique password.
> Save this password - you'll need it in Step 7.

### 4.3. Test the connection

```bash
psql -U supportdesk -d support_tickets -h localhost
# Enter the password when prompted
# Type \q to exit
```

---

## 5. Install and Configure Meilisearch (Optional)

Meilisearch provides fast full-text search. If you skip this, the app falls back to database search.

### 5.1. Install Meilisearch

```bash
curl -L https://install.meilisearch.com | sh
sudo mv ./meilisearch /usr/local/bin/

# Create data directory
sudo mkdir -p /var/lib/meilisearch
sudo chown supportdesk:supportdesk /var/lib/meilisearch
```

### 5.2. Create a systemd service

```bash
sudo tee /etc/systemd/system/meilisearch.service > /dev/null <<EOF
[Unit]
Description=Meilisearch Search Engine
After=network.target

[Service]
User=supportdesk
Group=supportdesk
ExecStart=/usr/local/bin/meilisearch --http-addr 127.0.0.1:7700 --db-path /var/lib/meilisearch/data --master-key YOUR_MEILI_MASTER_KEY
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

> **IMPORTANT**: Replace `YOUR_MEILI_MASTER_KEY` with a random string (at least 16 characters).
> Generate one with: `openssl rand -hex 16`

### 5.3. Start Meilisearch

```bash
sudo systemctl daemon-reload
sudo systemctl enable meilisearch
sudo systemctl start meilisearch

# Verify it's running
curl http://localhost:7700/health
# Should return: {"status":"available"}
```

---

## 6. Clone the Repository

```bash
cd /home/supportdesk
git clone https://github.com/Sujthr/support-ticket-system.git
cd support-ticket-system
```

### 6.1. Install dependencies

```bash
# Backend dependencies
cd backend
npm install --production=false
cd ..

# Frontend dependencies
cd frontend
npm install --production=false
cd ..
```

> **Note**: We use `--production=false` to include devDependencies needed for building.

---

## 7. Configure Backend Environment

### 7.1. Create the environment file

```bash
cd /home/supportdesk/support-ticket-system/backend
cp .env.example .env
```

### 7.2. Edit the environment file

```bash
nano .env
```

Update **every** value as follows:

```env
# ─── Database ───────────────────────────────────────────────
# Replace password with the one you created in Step 4.2
DATABASE_URL="postgresql://supportdesk:CHOOSE_A_STRONG_PASSWORD_HERE@localhost:5432/support_tickets?schema=public"

# ─── JWT Secrets (CRITICAL - generate unique values!) ──────
# Generate with: openssl rand -hex 32
JWT_SECRET="PASTE_RANDOM_HEX_STRING_HERE"
JWT_REFRESH_SECRET="PASTE_DIFFERENT_RANDOM_HEX_STRING_HERE"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# ─── Server ─────────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ─── Meilisearch (skip if not installed) ────────────────────
MEILI_HOST="http://localhost:7700"
MEILI_API_KEY="YOUR_MEILI_MASTER_KEY"

# ─── Email (SMTP) ──────────────────────────────────────────
# Example using Gmail with App Password:
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-char-app-password"
SMTP_FROM="support@yourdomain.com"

# ─── File Storage ───────────────────────────────────────────
# Leave empty for local storage (files saved to ./uploads/)
# For AWS S3 (recommended for production):
AWS_S3_BUCKET=""
AWS_S3_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# ─── Frontend URL (must match your domain) ──────────────────
FRONTEND_URL="https://support.yourdomain.com"
```

### 7.3. Generate JWT secrets

Run these commands to generate secure random secrets:

```bash
echo "JWT_SECRET: $(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET: $(openssl rand -hex 32)"
```

Copy the output and paste into the `.env` file.

### 7.4. Set file permissions

```bash
chmod 600 /home/supportdesk/support-ticket-system/backend/.env
```

> **SECURITY**: The `.env` file contains passwords and secrets. Never commit it to Git.
> Only the `supportdesk` user should be able to read it.

---

## 8. Configure Frontend Environment

### 8.1. Create the environment file

```bash
cd /home/supportdesk/support-ticket-system/frontend
```

Create `.env.production`:

```bash
cat > .env.production <<EOF
NEXT_PUBLIC_API_URL=https://support.yourdomain.com/api/v1
EOF
```

> **IMPORTANT**: Replace `support.yourdomain.com` with your actual domain.
> The `/api/v1` suffix is required - Nginx will proxy this to the backend.

---

## 9. Build the Application

### 9.1. Generate Prisma client

```bash
cd /home/supportdesk/support-ticket-system/backend
npx prisma generate
```

### 9.2. Build the backend

```bash
npx nest build
```

Expected output: No errors. Files are compiled to `backend/dist/`.

### 9.3. Build the frontend

```bash
cd /home/supportdesk/support-ticket-system/frontend
npm run build
```

Expected output: The build should complete with a summary showing pages and sizes.
The standalone output will be at `frontend/.next/standalone/`.

### 9.4. Create uploads directory

```bash
mkdir -p /home/supportdesk/support-ticket-system/backend/uploads/logos
mkdir -p /home/supportdesk/support-ticket-system/backend/uploads/attachments
```

---

## 10. Run Database Migrations

### 10.1. Switch Prisma to PostgreSQL

The default schema uses SQLite for development. For production with PostgreSQL:

Edit `backend/prisma/schema.prisma`:

```bash
cd /home/supportdesk/support-ticket-system/backend
nano prisma/schema.prisma
```

Change the datasource block:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 10.2. Create initial migration

```bash
npx prisma migrate dev --name init
```

> **Note**: If you see "Are you sure you want to create and apply this migration?", type `y`.

For subsequent deployments, use:

```bash
npx prisma migrate deploy
```

### 10.3. Seed initial data (optional)

```bash
npx ts-node prisma/seed.ts
```

This creates default SLA policies and sample data.

---

## 11. Set Up Process Manager (PM2)

PM2 keeps the application running, restarts it on crashes, and manages logs.

### 11.1. Install PM2

```bash
sudo npm install -g pm2
```

### 11.2. Create PM2 ecosystem file

```bash
cd /home/supportdesk/support-ticket-system
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'supportdesk-backend',
      cwd: './backend',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'supportdesk-frontend',
      cwd: './frontend/.next/standalone',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
EOF
```

### 11.3. Create logs directory

```bash
mkdir -p logs
```

### 11.4. Copy static assets for standalone frontend

```bash
cp -r frontend/public frontend/.next/standalone/public
cp -r frontend/.next/static frontend/.next/standalone/.next/static
```

### 11.5. Start the application

```bash
pm2 start ecosystem.config.js
```

### 11.6. Verify both processes are running

```bash
pm2 status
```

Expected output:
```
┌─────────────────────────┬────┬─────┬──────┬───────┬─────────┐
│ App name                │ id │ mode│ pid  │ status│ restart │
├─────────────────────────┼────┼─────┼──────┼───────┼─────────┤
│ supportdesk-backend     │ 0  │ fork│ 1234 │ online│ 0       │
│ supportdesk-frontend    │ 1  │ fork│ 1235 │ online│ 0       │
└─────────────────────────┴────┴─────┴──────┴───────┴─────────┘
```

### 11.7. Save PM2 configuration and set up auto-start on boot

```bash
pm2 save
pm2 startup
```

PM2 will print a command like:
```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u supportdesk --hp /home/supportdesk
```

**Copy and run that exact command.**

### 11.8. Useful PM2 commands

```bash
pm2 logs                          # View all logs (live)
pm2 logs supportdesk-backend      # View backend logs only
pm2 restart all                   # Restart all processes
pm2 reload all                    # Zero-downtime restart
pm2 stop all                      # Stop all processes
pm2 monit                         # Real-time monitoring dashboard
```

---

## 12. Configure Nginx Reverse Proxy

Nginx sits in front of the application, handles SSL, and routes traffic.

### 12.1. Install Nginx

```bash
sudo apt install -y nginx
```

### 12.2. Create the site configuration

```bash
sudo nano /etc/nginx/sites-available/supportdesk
```

Paste the following configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name support.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name support.yourdomain.com;

    # SSL certificates (will be added by Certbot in Step 13)
    ssl_certificate /etc/letsencrypt/live/support.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/support.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # File upload size limit (matches backend: 10MB)
    client_max_body_size 10M;

    # ─── Backend API ───────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # ─── Uploaded files (logos, attachments) ────────────────
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_valid 200 1d;
    }

    # ─── Frontend (Next.js) ────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3000;
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

> **IMPORTANT**: Replace `support.yourdomain.com` with your actual domain in ALL places.

### 12.3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/supportdesk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 12.4. Test configuration (before SSL)

For initial testing without SSL, temporarily comment out the SSL block and use only port 80:

```bash
sudo nginx -t
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

### 12.5. Restart Nginx

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 13. Set Up SSL with Let's Encrypt

### 13.1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 13.2. Obtain SSL certificate

```bash
sudo certbot --nginx -d support.yourdomain.com
```

Follow the prompts:
1. Enter your email address (for renewal notifications)
2. Agree to terms of service: `Y`
3. Redirect HTTP to HTTPS: Choose option `2` (redirect)

### 13.3. Verify auto-renewal

```bash
sudo certbot renew --dry-run
```

Expected: `Congratulations, all simulated renewals succeeded`

Certbot automatically adds a cron job for renewal.

---

## 14. Configure Firewall

### 14.1. Set up UFW (Uncomplicated Firewall)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh                  # Port 22
sudo ufw allow 'Nginx Full'        # Ports 80, 443
sudo ufw enable
```

### 14.2. Verify firewall rules

```bash
sudo ufw status verbose
```

Expected output:
```
Status: active
To                  Action      From
--                  ------      ----
22/tcp              ALLOW       Anywhere
80,443/tcp (Nginx)  ALLOW       Anywhere
```

> **Note**: Ports 3000 and 3001 are NOT exposed publicly. All traffic goes through Nginx.

---

## 15. Set Up Log Rotation

### 15.1. Configure PM2 log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

This keeps logs manageable (max 10MB per file, keeps 30 days, compressed).

---

## 16. Verify the Deployment

### 16.1. Check all services are running

```bash
# Check PM2 processes
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check Meilisearch (if installed)
sudo systemctl status meilisearch
```

### 16.2. Test the application

1. Open your browser and navigate to `https://support.yourdomain.com`
2. You should see the SupportDesk login page
3. Click **Sign Up** to create the first organization and admin account
4. After signup, log in and verify:
   - Dashboard loads with statistics
   - You can create a ticket
   - Settings page loads (check all tabs)
   - Logo upload works (try uploading a PNG)
   - Notifications appear when creating/assigning tickets

### 16.3. Test the API directly

```bash
# Health check (from the server)
curl -s http://localhost:3001/api/v1 | head -20

# From outside - should redirect to HTTPS
curl -sI http://support.yourdomain.com
```

### 16.4. Test email notifications

1. Go to **Settings > Email** tab
2. Enter your SMTP credentials
3. Enable desired notification triggers
4. Click **Test Email**
5. Verify you receive the test email

---

## 17. Backup Strategy

### 17.1. Database backup script

Create a backup script:

```bash
sudo nano /home/supportdesk/backup.sh
```

```bash
#!/bin/bash
# SupportDesk Database Backup Script
BACKUP_DIR="/home/supportdesk/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="support_tickets"
DB_USER="supportdesk"

mkdir -p "$BACKUP_DIR"

# Dump the database
PGPASSWORD="YOUR_DB_PASSWORD" pg_dump -U "$DB_USER" -h localhost "$DB_NAME" \
  | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

# Also backup uploaded files
tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" \
  -C /home/supportdesk/support-ticket-system/backend uploads/

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

echo "Backup complete: ${TIMESTAMP}"
```

```bash
chmod +x /home/supportdesk/backup.sh
```

> **IMPORTANT**: Replace `YOUR_DB_PASSWORD` with your actual database password.

### 17.2. Schedule daily backups

```bash
crontab -e
```

Add this line:
```
0 2 * * * /home/supportdesk/backup.sh >> /home/supportdesk/backups/backup.log 2>&1
```

This runs backups daily at 2:00 AM.

---

## 18. Updating the Application

When a new version is released, follow these steps:

### 18.1. Pull latest code

```bash
cd /home/supportdesk/support-ticket-system
git pull origin master
```

### 18.2. Install dependencies (if package.json changed)

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 18.3. Run database migrations (if schema changed)

```bash
cd backend
npx prisma migrate deploy
```

### 18.4. Rebuild both apps

```bash
# Backend
cd /home/supportdesk/support-ticket-system/backend
npx prisma generate
npx nest build

# Frontend
cd /home/supportdesk/support-ticket-system/frontend
npm run build

# Copy static assets for standalone
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

### 18.5. Restart with zero downtime

```bash
cd /home/supportdesk/support-ticket-system
pm2 reload all
```

### 18.6. Verify the update

```bash
pm2 status
pm2 logs --lines 20
```

---

## 19. Desktop App Installer Build

To build the Windows desktop installer (run on a Windows machine):

### 19.1. Prerequisites

- Windows 10/11 with Node.js 20+ installed
- Git installed
- The repository cloned locally

### 19.2. Build steps

```bash
cd support-ticket-system

# Install all dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd desktop && npm install && cd ..

# Run the full build + package
cd desktop
npm run package
```

This will:
1. Build the NestJS backend
2. Build the Next.js frontend (standalone mode)
3. Copy everything into the desktop app structure
4. Create the Windows installer using electron-builder

### 19.3. Output

The installer will be at:
```
desktop/dist/SupportDesk-Setup-1.1.0.exe
```

Distribute this `.exe` file to end users.

---

## 20. Troubleshooting

### Application won't start

```bash
# Check PM2 logs for errors
pm2 logs supportdesk-backend --lines 50
pm2 logs supportdesk-frontend --lines 50

# Common fix: restart everything
pm2 restart all
```

### Database connection error

```bash
# Test PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U supportdesk -d support_tickets -h localhost

# Check the DATABASE_URL in .env matches your PostgreSQL credentials
```

### "502 Bad Gateway" in browser

This means Nginx can't reach the backend/frontend:

```bash
# Check if PM2 processes are running
pm2 status

# If processes show "errored", check logs
pm2 logs --err --lines 30

# Restart the processes
pm2 restart all

# Check Nginx can reach the ports
curl http://localhost:3001/api/v1    # Backend
curl http://localhost:3000            # Frontend
```

### SSL certificate renewal failed

```bash
# Check certificate status
sudo certbot certificates

# Manual renewal
sudo certbot renew

# Check Nginx config
sudo nginx -t
sudo systemctl restart nginx
```

### File upload fails

```bash
# Check uploads directory exists and has correct permissions
ls -la /home/supportdesk/support-ticket-system/backend/uploads/

# Fix permissions if needed
chown -R supportdesk:supportdesk /home/supportdesk/support-ticket-system/backend/uploads/
chmod -R 755 /home/supportdesk/support-ticket-system/backend/uploads/
```

### Email notifications not sending

1. Go to **Settings > Email** in the app
2. Verify SMTP settings are correct
3. Click **Test Email** and check for errors
4. Check backend logs: `pm2 logs supportdesk-backend --lines 50`
5. Common issues:
   - Gmail: Must use App Password (not regular password). Enable 2FA first.
   - Port 587 for TLS, Port 465 for SSL
   - Some providers block port 25/587 by default (check with your hosting provider)

### Notifications not appearing in-app

- Notifications are created server-side when events occur (ticket created, assigned, comment, SLA breach)
- Verify the notification bell icon shows in the header
- Click the bell to open the notification panel
- Check backend logs for notification creation errors

### High memory usage

```bash
# Check memory usage
pm2 monit

# Restart if needed (PM2 auto-restarts at 512MB by default)
pm2 restart all
```

### Disk space running low

```bash
# Check disk usage
df -h

# Clean old backups
find /home/supportdesk/backups -name "*.gz" -mtime +7 -delete

# Clean PM2 logs
pm2 flush
```

---

## Quick Reference Card

| Action                    | Command                                          |
|---------------------------|--------------------------------------------------|
| Start app                 | `pm2 start ecosystem.config.js`                  |
| Stop app                  | `pm2 stop all`                                   |
| Restart app               | `pm2 reload all`                                 |
| View logs (live)          | `pm2 logs`                                       |
| View backend logs         | `pm2 logs supportdesk-backend`                   |
| Check status              | `pm2 status`                                     |
| Run DB migration          | `cd backend && npx prisma migrate deploy`        |
| Backup database           | `/home/supportdesk/backup.sh`                    |
| Renew SSL                 | `sudo certbot renew`                             |
| Restart Nginx             | `sudo systemctl restart nginx`                   |
| Check firewall            | `sudo ufw status`                                |
| Monitor resources         | `pm2 monit`                                      |

---

## Environment Variables Reference

| Variable               | Required | Description                                    | Example                                  |
|------------------------|----------|------------------------------------------------|------------------------------------------|
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                   | `postgresql://user:pass@localhost:5432/db`|
| `JWT_SECRET`           | Yes      | Access token signing secret (min 32 chars)     | `openssl rand -hex 32`                   |
| `JWT_REFRESH_SECRET`   | Yes      | Refresh token signing secret (min 32 chars)    | `openssl rand -hex 32`                   |
| `JWT_EXPIRATION`       | Yes      | Access token lifetime                          | `15m`                                    |
| `JWT_REFRESH_EXPIRATION`| Yes     | Refresh token lifetime                         | `7d`                                     |
| `PORT`                 | Yes      | Backend API port                               | `3001`                                   |
| `NODE_ENV`             | Yes      | Environment mode                               | `production`                             |
| `FRONTEND_URL`         | Yes      | Frontend URL for CORS                          | `https://support.yourdomain.com`         |
| `MEILI_HOST`           | No       | Meilisearch URL                                | `http://localhost:7700`                  |
| `MEILI_API_KEY`        | No       | Meilisearch master key                         | Random string                            |
| `SMTP_HOST`            | No*      | SMTP server hostname                           | `smtp.gmail.com`                         |
| `SMTP_PORT`            | No*      | SMTP server port                               | `587`                                    |
| `SMTP_USER`            | No*      | SMTP username/email                            | `noreply@company.com`                    |
| `SMTP_PASS`            | No*      | SMTP password/app-password                     | App-specific password                    |
| `SMTP_FROM`            | No*      | Sender email address                           | `support@company.com`                    |

*Required if you want email notifications to work. Configure these in the Settings > Email tab of the app.

---

**Document Version**: 1.1.0
**Last Updated**: 2026-04-09
**Author**: Sujit Kumar Thakur
