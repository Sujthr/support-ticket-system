# AWS Production Deployment Guide

Complete guide to deploy the Support Ticket System on AWS with production-grade infrastructure.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [AWS Server Specifications](#aws-server-specifications)
- [Cost Estimate](#cost-estimate)
- [Step 1: AWS Account Setup](#step-1-aws-account-setup)
- [Step 2: Set Up PostgreSQL (RDS)](#step-2-set-up-postgresql-rds)
- [Step 3: Set Up S3 for File Storage](#step-3-set-up-s3-for-file-storage)
- [Step 4: Deploy Backend on EC2](#step-4-deploy-backend-on-ec2)
- [Step 5: Deploy Frontend on Vercel (or S3 + CloudFront)](#step-5-deploy-frontend)
- [Step 6: Set Up Domain and SSL](#step-6-set-up-domain-and-ssl)
- [Step 7: Set Up CI/CD with GitHub Actions](#step-7-set-up-cicd-with-github-actions)
- [Step 8: Monitoring and Logging](#step-8-monitoring-and-logging)
- [Step 9: Backups](#step-9-backups)
- [Production Environment Variables](#production-environment-variables)
- [Security Checklist](#security-checklist)
- [Scaling Guide](#scaling-guide)

---

## Architecture Overview

```
                         ┌──────────────┐
                         │  Route 53    │
                         │  (DNS)       │
                         └──────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              ┌─────▼─────┐          ┌──────▼──────┐
              │ CloudFront │          │     ALB     │
              │ (Frontend) │          │ (Backend LB)│
              └─────┬──────┘          └──────┬──────┘
                    │                        │
              ┌─────▼─────┐          ┌───────▼───────┐
              │ S3 Bucket  │          │   EC2 / ECS   │
              │ (Static)   │          │   (NestJS)    │
              └────────────┘          └───────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                        ┌─────▼────┐   ┌──────▼─────┐  ┌─────▼────┐
                        │ RDS      │   │ S3 Uploads │  │ElastiCache│
                        │PostgreSQL│   │ (Files)    │  │ (Redis)   │
                        └──────────┘   └────────────┘  └───────────┘
```

---

## AWS Server Specifications

### Minimum Setup (Small Team, < 50 agents, < 10k tickets/month)

| Service | Spec | Monthly Cost (approx.) |
|---------|------|----------------------|
| **EC2 (Backend)** | `t3.small` (2 vCPU, 2 GB RAM) | $15 |
| **RDS PostgreSQL** | `db.t3.micro` (2 vCPU, 1 GB RAM, 20 GB SSD) | $15 |
| **S3 (File Storage)** | Standard, 10 GB | $0.25 |
| **S3 + CloudFront (Frontend)** | Static hosting | $1-5 |
| **Route 53** | 1 hosted zone | $0.50 |
| **ACM (SSL)** | Free with CloudFront/ALB | $0 |
| **Total** | | **~$32-36/month** |

### Recommended Setup (Medium Team, 50-200 agents, < 100k tickets/month)

| Service | Spec | Monthly Cost (approx.) |
|---------|------|----------------------|
| **EC2 (Backend)** | `t3.medium` (2 vCPU, 4 GB RAM) x 2 behind ALB | $60 |
| **RDS PostgreSQL** | `db.t3.small` (2 vCPU, 2 GB RAM, 50 GB SSD, Multi-AZ) | $50 |
| **ElastiCache Redis** | `cache.t3.micro` (session/cache) | $13 |
| **S3 (File Storage)** | Standard, 100 GB | $2.30 |
| **CloudFront** | Frontend CDN | $5-10 |
| **ALB** | Application Load Balancer | $16 |
| **Route 53** | DNS | $0.50 |
| **Total** | | **~$147-152/month** |

### Enterprise Setup (200+ agents, 500k+ tickets/month)

| Service | Spec | Monthly Cost (approx.) |
|---------|------|----------------------|
| **ECS Fargate (Backend)** | 2 vCPU, 4 GB RAM x 3 tasks, auto-scaling | $150 |
| **RDS PostgreSQL** | `db.r6g.large` (2 vCPU, 16 GB RAM, 200 GB, Multi-AZ, read replicas) | $300 |
| **ElastiCache Redis** | `cache.r6g.large` cluster | $100 |
| **OpenSearch** | `t3.medium.search` (full-text search) | $50 |
| **S3 + CloudFront** | CDN + storage | $20 |
| **ALB + WAF** | Load balancer + web firewall | $40 |
| **CloudWatch** | Monitoring + alarms | $15 |
| **Total** | | **~$675/month** |

---

## Cost Estimate

| Scale | Users | Tickets/Month | AWS Cost/Month |
|-------|-------|--------------|---------------|
| Startup | < 50 | < 10,000 | $32-36 |
| Growth | 50-200 | 10,000-100,000 | $147-152 |
| Enterprise | 200+ | 500,000+ | $675+ |

---

## Step 1: AWS Account Setup

### 1.1 Create an IAM User

```bash
# Install AWS CLI (if not installed)
# Download from: https://aws.amazon.com/cli/

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1), Output format (json)
```

### 1.2 Create a VPC

Use the default VPC or create a new one:

```bash
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=support-ticket-vpc}]'
```

Create subnets in at least 2 availability zones for high availability.

---

## Step 2: Set Up PostgreSQL (RDS)

### 2.1 Create RDS Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier support-tickets-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username dbadmin \
  --master-user-password YOUR_STRONG_PASSWORD_HERE \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-name support_tickets \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted \
  --tags Key=Project,Value=SupportTickets
```

### 2.2 Configure Security Group

Allow inbound PostgreSQL (port 5432) only from your EC2 security group:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-group \
  --protocol tcp \
  --port 5432 \
  --source-group sg-ec2-group
```

### 2.3 Get Connection String

After the RDS instance is available:

```
postgresql://dbadmin:YOUR_PASSWORD@support-tickets-db.xxxx.us-east-1.rds.amazonaws.com:5432/support_tickets
```

---

## Step 3: Set Up S3 for File Storage

### 3.1 Create Bucket

```bash
aws s3 mb s3://support-ticket-uploads-YOUR_UNIQUE_ID --region us-east-1
```

### 3.2 Configure Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBackendAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ec2-support-ticket-role"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::support-ticket-uploads-YOUR_UNIQUE_ID/*"
    }
  ]
}
```

### 3.3 Enable CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## Step 4: Deploy Backend on EC2

### 4.1 Launch EC2 Instance

```bash
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.small \
  --key-name your-key-pair \
  --security-group-ids sg-ec2-group \
  --subnet-id subnet-xxxxx \
  --iam-instance-profile Name=ec2-support-ticket-role \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=support-ticket-backend}]'
```

### 4.2 SSH Into EC2 and Setup

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

### 4.3 Install Dependencies

```bash
# Update system
sudo yum update -y

# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo yum install -y git
```

### 4.4 Clone and Build

```bash
# Clone repo
git clone https://github.com/Sujthr/support-ticket-system.git
cd support-ticket-system/backend

# Install dependencies
npm install --production

# Create .env file
cat > .env << 'EOF'
DATABASE_URL="postgresql://dbadmin:YOUR_PASSWORD@your-rds-endpoint:5432/support_tickets"
JWT_SECRET="GENERATE_A_64_CHAR_RANDOM_STRING"
JWT_REFRESH_SECRET="GENERATE_ANOTHER_64_CHAR_RANDOM_STRING"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
PORT=3001
FRONTEND_URL="https://yourdomain.com"
MEILI_HOST="http://localhost:7700"
AWS_S3_BUCKET="support-ticket-uploads-YOUR_UNIQUE_ID"
AWS_S3_REGION="us-east-1"
EOF

# Generate secrets (run on your local machine)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.5 Update Prisma for PostgreSQL

```bash
# Edit prisma/schema.prisma - change provider to "postgresql"
# Then run:
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

### 4.6 Build and Start with PM2

```bash
# Build
npm run build

# Start with PM2
pm2 start dist/src/main.js --name support-ticket-api \
  --max-memory-restart 1G \
  --instances 2 \
  --exec-mode cluster

# Save PM2 config
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### 4.7 Set Up Nginx Reverse Proxy

```bash
sudo yum install -y nginx

sudo cat > /etc/nginx/conf.d/support-ticket.conf << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3001;
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
EOF

sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Step 5: Deploy Frontend

### Option A: Vercel (Recommended - Easiest)

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set the environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Option B: S3 + CloudFront

```bash
cd frontend

# Build
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 npm run build

# Export static files
npm run build

# Upload to S3
aws s3 sync .next/static s3://support-ticket-frontend/_next/static
aws s3 sync public s3://support-ticket-frontend/public
```

Then create a CloudFront distribution pointing to the S3 bucket.

---

## Step 6: Set Up Domain and SSL

### 6.1 Route 53

```bash
# Create hosted zone
aws route53 create-hosted-zone --name yourdomain.com --caller-reference $(date +%s)

# Add A record for API
# api.yourdomain.com → EC2 Elastic IP (or ALB DNS)

# Add CNAME for frontend
# app.yourdomain.com → Vercel domain (or CloudFront distribution)
```

### 6.2 SSL Certificate (ACM)

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names "*.yourdomain.com" \
  --validation-method DNS
```

Validate via DNS by adding the CNAME records ACM provides.

### 6.3 Install SSL on EC2 (if not using ALB)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renew
sudo crontab -e
# Add: 0 0 * * * /usr/bin/certbot renew --quiet
```

---

## Step 7: Set Up CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install and Build
        run: |
          cd backend
          npm ci --production
          npm run build

      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/support-ticket-system
            git pull origin master
            cd backend
            npm ci --production
            npx prisma generate
            npx prisma migrate deploy
            npm run build
            pm2 restart support-ticket-api

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
          vercel-args: '--prod'
```

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Your EC2 public IP or domain |
| `EC2_SSH_KEY` | Your EC2 private key (PEM) |
| `VERCEL_TOKEN` | Vercel access token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` |

---

## Step 8: Monitoring and Logging

### CloudWatch Alarms

```bash
# CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "HighCPU-SupportTicketBackend" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:YOUR_ACCOUNT:alerts

# RDS storage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "LowStorage-SupportTicketDB" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 2000000000 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:YOUR_ACCOUNT:alerts
```

### Application Logging

PM2 handles log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# View logs
pm2 logs support-ticket-api
```

---

## Step 9: Backups

### RDS Automated Backups

Already configured with 7-day retention in Step 2.

### Manual Snapshot

```bash
aws rds create-db-snapshot \
  --db-instance-identifier support-tickets-db \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)
```

### S3 Versioning

```bash
aws s3api put-bucket-versioning \
  --bucket support-ticket-uploads-YOUR_UNIQUE_ID \
  --versioning-configuration Status=Enabled
```

---

## Production Environment Variables

Complete `.env` for production:

```env
# Database
DATABASE_URL="postgresql://dbadmin:STRONG_PASSWORD@your-rds-endpoint:5432/support_tickets?sslmode=require"

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="a1b2c3d4e5f6... (64 chars)"
JWT_REFRESH_SECRET="f6e5d4c3b2a1... (64 chars)"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL="https://app.yourdomain.com"

# Search (optional - falls back to PostgreSQL)
MEILI_HOST="http://localhost:7700"
MEILI_API_KEY="your-meilisearch-key"

# File Storage
AWS_S3_BUCKET="support-ticket-uploads-YOUR_UNIQUE_ID"
AWS_S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."

# Email (for notifications)
SMTP_HOST="ses-smtp-prod-335357831.us-east-1.elb.amazonaws.com"
SMTP_PORT=587
SMTP_USER="AKIA..."
SMTP_PASS="..."
SMTP_FROM="support@yourdomain.com"
```

---

## Security Checklist

- [ ] Change all default JWT secrets to strong random strings
- [ ] Enable RDS encryption at rest
- [ ] Use SSL/TLS for all connections (HTTPS, database SSL)
- [ ] Restrict security groups to minimum required ports
- [ ] Enable S3 bucket versioning and encryption
- [ ] Set up IAM roles with least-privilege principle
- [ ] Enable CloudTrail for audit logging
- [ ] Configure WAF rules on ALB/CloudFront
- [ ] Set `NODE_ENV=production` in backend
- [ ] Never commit `.env` files to git
- [ ] Use AWS Secrets Manager for sensitive values
- [ ] Enable MFA on AWS root account
- [ ] Set CORS to only allow your frontend domain
- [ ] Rate limit the API (use NestJS throttler or ALB rules)

---

## Scaling Guide

### When to Scale

| Symptom | Action |
|---------|--------|
| API response > 500ms | Scale EC2 up or add instances |
| Database CPU > 70% | Scale RDS up or add read replicas |
| Search is slow | Add Meilisearch or OpenSearch |
| File uploads slow | Move to S3 direct upload with presigned URLs |
| 1000+ concurrent users | Move to ECS Fargate with auto-scaling |

### Horizontal Scaling

```bash
# Scale PM2 to all CPU cores
pm2 scale support-ticket-api max

# Or use ALB with multiple EC2 instances
# Ensure sessions are stateless (JWT already handles this)
```

### Database Scaling

```bash
# Add read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier support-tickets-db-replica \
  --source-db-instance-identifier support-tickets-db

# Scale up
aws rds modify-db-instance \
  --db-instance-identifier support-tickets-db \
  --db-instance-class db.t3.medium \
  --apply-immediately
```
