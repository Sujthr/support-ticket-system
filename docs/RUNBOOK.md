# SupportDesk Runbook

Operator and user guide for the SupportDesk multi-tenant customer support ticketing system.

**Version:** 1.1.0  
**Last updated:** 2026-04-14

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started](#2-getting-started)
3. [Daily Operations](#3-daily-operations)
4. [Admin Configuration](#4-admin-configuration)
5. [Analytics and Reporting](#5-analytics-and-reporting)
6. [Desktop Application](#6-desktop-application)
7. [Integration Testing Guide](#7-integration-testing-guide)
8. [Troubleshooting](#8-troubleshooting)
9. [Production Deployment](#9-production-deployment)
10. [Security Considerations](#10-security-considerations)
11. [Quick Reference](#11-quick-reference)

---

## 1. System Overview

SupportDesk is a production-ready, multi-tenant SaaS platform for managing customer support. Organizations create tickets from multiple channels (web, email, phone, WhatsApp), assign them to agents, track SLAs, and resolve issues through a unified interface.

### Components

| Component | Technology | Default Port | Purpose |
|-----------|-----------|-------------|---------|
| Backend API | NestJS 10, Prisma ORM, Node.js | 3001 | REST API, auth, business logic, webhooks |
| Web Portal | Next.js 14, React 18, Tailwind CSS | 3000 | Browser-based UI for all user roles |
| Desktop App | Electron 28 | 3051 (backend), 3052 (frontend) | Standalone Windows/Mac/Linux application |
| Database | SQLite (dev) / PostgreSQL (prod) | -- | Data persistence |
| Search | Meilisearch (optional) | 7700 | Full-text ticket search (falls back to DB) |

### User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access. Manage organization settings, team members, SLA policies, email/channel configuration, JIRA integration, categories, priorities, canned responses. View all tickets and analytics. |
| **Agent** | View all tickets in the organization. Create, update, assign, and resolve tickets. Add public replies and internal notes. Create JIRA issues. View analytics and agent KPIs. Manage knowledge base articles. |
| **End User** | Create tickets. View only their own tickets. Add public comments. Cannot see internal notes. Can close their own tickets. View published knowledge base articles. |

### Inbound Channels

Tickets can be created from:

- **Web** -- through the portal or API
- **Email (Inbound)** -- IMAP polling converts incoming emails into tickets
- **Phone (Voice)** -- Twilio voice webhooks create tickets from incoming calls
- **WhatsApp (Twilio)** -- Twilio WhatsApp Sandbox or production number
- **WhatsApp (Meta Cloud API)** -- Meta WhatsApp Business API with webhook integration

### Data Architecture

All data is isolated per organization using an `organization_id` foreign key on every data table. The schema contains 20+ models including organizations, users, tickets, comments, attachments, tags, SLA policies, notifications, email configs, channel configs, inbound messages, JIRA configs, knowledge base articles, canned responses, time entries, satisfaction ratings, and ticket watchers.

---

## 2. Getting Started

### 2.1 Prerequisites

- **Node.js** v18 or higher -- download from https://nodejs.org
- **npm** v9 or higher (included with Node.js)
- **Git** -- download from https://git-scm.com

No database server is needed for development. SQLite is used by default.

For production, additionally install:
- PostgreSQL 14+
- (Optional) Meilisearch for fast full-text search

### 2.2 Installation

#### Clone the repository

```bash
git clone https://github.com/Sujthr/support-ticket-system.git
cd support-ticket-system
```

#### Backend setup

```bash
cd backend
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

The default `.env` works out of the box with SQLite. Key variables:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

Set up the database:

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

Expected output:

```
Seed complete!

Demo accounts (password: password123):
  Admin: admin@demo.com
  Agent: agent@demo.com
  User:  user@demo.com
  Org slug: demo
```

#### Frontend setup

```bash
cd ../frontend
npm install
```

Create a `.env.local` file (optional -- defaults work for local dev):

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1' > .env.local
```

#### Starting dev servers

Open two terminal windows.

**Terminal 1 -- Backend (port 3001):**

```bash
cd backend
npm run start:dev
```

Wait for:
```
Server running on http://localhost:3001
API Docs: http://localhost:3001/api/docs
```

**Terminal 2 -- Frontend (port 3000):**

```bash
cd frontend
npm run dev
```

Wait for:
```
- Local: http://localhost:3000
```

Open **http://localhost:3000** in your browser.

### 2.3 First Login

#### Using demo accounts

The seed script creates a demo organization with three accounts:

| Role | Email | Password | Org Slug |
|------|-------|----------|----------|
| Admin | admin@demo.com | password123 | demo |
| Agent | agent@demo.com | password123 | demo |
| End User | user@demo.com | password123 | demo |

1. Navigate to http://localhost:3000/login
2. Enter the **Organization Slug**: `demo`
3. Enter an email and password from the table above
4. Click **Sign In**

#### Creating a new organization

1. Navigate to http://localhost:3000/signup
2. Enter your **Organization Name** (e.g., "Acme Corp")
3. Fill in your name, email, and password (minimum 8 characters)
4. Click **Create Organization**
5. You are logged in as the Admin of the new organization
6. The organization slug is auto-generated as a URL-friendly version of the name (e.g., `acme-corp`)

---

## 3. Daily Operations

### 3.1 Dashboard

After logging in, the dashboard displays:

- **Stat Cards** -- Total tickets, open count, resolved count, and SLA breached count
- **Recent Tickets** -- The 5 most recently created tickets with status and priority badges
- **Quick Actions** -- Click "View all" to jump to the full ticket list, or "+ New Ticket" to create one

Agents and Admins see organization-wide metrics. End Users see only their own ticket counts.

### 3.2 Managing Tickets

#### Creating tickets

**From the Web Portal:**

1. Go to **Tickets** in the sidebar
2. Click **"+ New Ticket"** (top right)
3. Fill in:
   - **Title** -- Brief summary of the issue
   - **Description** -- Detailed explanation
   - **Priority** -- Low, Medium, High, or Urgent
   - **Category** -- (Optional) Select a ticket category
   - **Assign To** -- (Optional) Pick an agent from the dropdown
   - **Tags** -- (Optional) Comma-separated labels like `bug, billing, urgent`
4. Click **Create Ticket**

The ticket is automatically assigned an SLA policy based on its priority. If the organization uses Round Robin or Load Balanced auto-assignment, an agent is assigned automatically.

**From Email:** When IMAP inbound is configured, emails sent to the configured mailbox are automatically converted into tickets. The email subject becomes the ticket title and the body becomes the description. The sender is identified by their email address.

**From Phone:** When Twilio voice is configured, incoming calls to the Twilio phone number trigger a webhook that creates a ticket. Caller information (number, city, state, country) is recorded.

**From WhatsApp:** Messages received via Twilio WhatsApp Sandbox or Meta WhatsApp Cloud API are automatically converted into tickets. If the same sender sends another message within the deduplication window (default 30 minutes), it is added as a comment on the existing ticket instead of creating a new one.

#### Viewing ticket list

The ticket list page provides:

- **Search bar** -- Search by title or description
- **Status filter** -- Filter by Open, Pending, Resolved, Closed
- **Priority filter** -- Filter by Low, Medium, High, Urgent
- **Sortable columns** -- Ticket number, title, status, priority, assignee, creation date
- **Pagination** -- Navigate large result sets at the bottom
- **SLA indicators** -- Tickets with SLA breaches show a red badge

#### Ticket detail view

Click on any ticket to open its detail view. The page shows:

- **Left panel**: Title, description, conversation thread (comments), and an input area for new replies
- **Right sidebar**: Status, priority, assignee, category, tags, SLA due date, JIRA link, creation date, and activity log

#### Updating ticket status

Tickets follow this lifecycle:

```
OPEN --> PENDING --> RESOLVED --> CLOSED
```

To update:

1. Open a ticket
2. In the right sidebar, change the **Status** dropdown
3. The change is saved immediately and logged in the activity feed
4. Changing to RESOLVED records the resolution timestamp and stops the SLA clock
5. Changing to CLOSED records the closure timestamp

#### Assigning tickets to agents

1. Open a ticket
2. In the right sidebar, select an agent from the **Assignee** dropdown
3. The assigned agent receives an in-app notification (and email notification if configured)

Alternatively, Admins can configure auto-assignment at the organization level:
- **Manual** -- No auto-assignment; agents pick up tickets manually
- **Round Robin** -- Tickets are assigned to agents in rotation
- **Load Balanced** -- Tickets are assigned to the agent with the fewest open tickets

#### Adding comments

**Public Reply:**

1. Open a ticket
2. Scroll to the **Conversation** section
3. Select **"Public reply"** (default)
4. Type your message
5. Click **Reply**

The customer sees this reply. The first public reply by an agent records the first response time for SLA tracking.

**Internal Note:**

1. Select **"Internal note"** (yellow icon)
2. Type your note
3. Click **Add Note**

Internal notes appear with a yellow background and a lock icon. They are visible only to Admins and Agents. End Users never see them.

#### Adding attachments

Files can be uploaded to tickets and comments via the attachment upload button. The system stores files locally in the `backend/uploads/` directory (or S3 if configured). File metadata (name, size, MIME type, URL) is saved in the database.

#### Bulk operations

1. On the tickets list, check the boxes next to multiple tickets
2. Click **"Resolve"** or **"Close"** in the action bar that appears
3. All selected tickets are updated at once

Bulk actions are available only to Admins and Agents.

### 3.3 Managing Users

#### Inviting new users

1. Go to **Settings** > **Team** tab (Admin only)
2. Fill in:
   - **First Name** and **Last Name**
   - **Email** address
   - **Role**: Admin, Agent, or End User
3. Click **Send Invite**
4. A temporary password is generated and displayed
5. Share the password securely with the new team member
6. They log in using the organization slug, their email, and the temporary password

#### User roles and permissions

| Permission | Admin | Agent | End User |
|-----------|-------|-------|----------|
| View all tickets | Yes | Yes | No (own only) |
| Create tickets | Yes | Yes | Yes |
| Assign tickets | Yes | Yes | No |
| Change priority | Yes | Yes | No |
| Add internal notes | Yes | Yes | No |
| Bulk operations | Yes | Yes | No |
| View analytics | Yes | Yes | No |
| Manage settings | Yes | No | No |
| Invite users | Yes | No | No |
| Configure integrations | Yes | No | No |
| Create KB articles | Yes | Yes | No |
| View KB articles | Yes | Yes | Yes (published only) |

#### Activating and deactivating users

Admins can toggle a user's active status via the API:

```
PATCH /api/v1/users/:id/toggle-active
```

Deactivated users cannot log in. Their existing tickets and comments remain in the system.

### 3.4 Notifications

#### In-app notifications

- A bell icon in the header shows the unread notification count
- Click the bell to see recent notifications
- Notifications are triggered by: ticket assignment, status changes, new comments, SLA breaches
- Click a notification to navigate to the relevant ticket
- Use **Mark all as read** to clear all unread notifications

#### Email notifications

When SMTP is configured (see Section 4.2), email notifications are sent for:

- Ticket created
- Ticket assigned to an agent
- Status changed
- New public comment added
- SLA breach detected
- Ticket resolved

Each trigger can be individually enabled or disabled in the email configuration.

#### Notification preferences

Notification triggers are configured at the organization level by the Admin through the email configuration page. Individual users receive notifications based on their role and relationship to the ticket (creator, assignee, watcher).

---

## 4. Admin Configuration

All settings pages are accessible from **Settings** in the sidebar (Admin only).

### 4.1 Organization Settings

Navigate to **Settings** > **Organization** tab.

Configurable fields:

| Field | Description |
|-------|------------|
| **Organization Name** | Display name shown in the UI and emails |
| **Domain** | Your company domain (e.g., `acme.com`) |
| **Logo** | Upload a company logo (displayed in sidebar and emails) |
| **Auto-Assignment Mode** | How tickets are assigned to agents |

Auto-assignment modes:

- **Manual** -- Tickets are created unassigned. Agents or admins assign manually.
- **Round Robin** -- Tickets are automatically assigned to the next available agent in rotation.
- **Load Balanced** -- Tickets are assigned to the agent with the fewest currently open tickets.

### 4.2 Email Configuration (SMTP)

Navigate to **Settings** > **Email** tab (or the email configuration section).

#### Setting up SMTP

Fill in the following fields:

| Field | Description | Example |
|-------|------------|---------|
| **SMTP Host** | Mail server hostname | `smtp.gmail.com` |
| **SMTP Port** | Server port (587 for TLS, 465 for SSL) | `587` |
| **SMTP User** | Authentication username | `yourname@gmail.com` |
| **SMTP Password** | Authentication password or app password | `abcd efgh ijkl mnop` |
| **From Email** | Sender address on outgoing emails | `support@yourcompany.com` |
| **From Name** | Sender display name | `Acme Support` |
| **Active** | Enable/disable all email sending | On/Off |

#### Email trigger toggles

Each of these can be enabled or disabled independently:

- **On Ticket Created** -- Email the creator confirming their ticket was received
- **On Ticket Assigned** -- Email the agent when a ticket is assigned to them
- **On Status Changed** -- Email the creator when ticket status changes
- **On New Comment** -- Email relevant parties when a new public comment is added
- **On SLA Breach** -- Email the assigned agent when an SLA is breached
- **On Ticket Resolved** -- Email the creator when their ticket is resolved

#### Testing email delivery

After saving your SMTP configuration:

1. Click **"Send Test Email"**
2. A test email is sent to the currently logged-in admin's email address
3. Check your inbox (and spam folder) for the test message
4. If it fails, verify your SMTP credentials and ensure the port is not blocked by a firewall

#### Free SMTP providers for development and testing

| Provider | Free Tier | Setup |
|----------|----------|-------|
| **Ethereal Email** | Unlimited test emails, no signup | Go to https://ethereal.email, click "Create Ethereal Account". Use the generated credentials. View sent emails in the Ethereal web inbox. |
| **Brevo (Sendinblue)** | 300 emails/day | Sign up at https://www.brevo.com. Go to SMTP & API > SMTP. Use `smtp-relay.brevo.com`, port 587, with your Brevo login and generated SMTP key. |
| **Mailtrap** | 100 emails/month (testing) | Sign up at https://mailtrap.io. Use the sandbox SMTP credentials from your inbox settings. Emails are captured in the Mailtrap web UI, not delivered to real addresses. |

**Ethereal Email quick setup (recommended for testing):**

```
SMTP Host: smtp.ethereal.email
SMTP Port: 587
SMTP User: (generated username)@ethereal.email
SMTP Pass: (generated password)
From Email: support@test.com
From Name: Test Support
```

### 4.3 Channel Configuration

Navigate to **Settings** > **Channels** tab (or use the API at `GET/POST /api/v1/channels/config`).

Channel configuration is stored per organization and covers three inbound channels: IMAP email, Twilio (voice + WhatsApp), and Meta WhatsApp Cloud API.

#### 4.3.1 Inbound Email (IMAP)

The system polls configured IMAP mailboxes every minute. New emails are converted into tickets (or appended as comments if the sender has an open ticket within the deduplication window).

**Configuration fields:**

| Field | Description | Example |
|-------|------------|---------|
| **IMAP Enabled** | Toggle IMAP polling on/off | On |
| **IMAP Host** | IMAP server hostname | `imap.gmail.com` |
| **IMAP Port** | IMAP server port | `993` |
| **IMAP User** | Mailbox username | `support@yourcompany.com` |
| **IMAP Password** | Mailbox password or app password | `abcd efgh ijkl mnop` |
| **IMAP TLS** | Use TLS encryption | On |

**Testing IMAP connection:**

1. Fill in the IMAP fields
2. Click **"Test IMAP Connection"** (calls `POST /api/v1/channels/test-imap`)
3. The system attempts to connect to the IMAP server and returns success or an error message
4. If successful, enable IMAP and save the configuration

**Gmail IMAP setup (free):**

1. Go to your Google Account > Security
2. Enable 2-Step Verification if not already enabled
3. Go to https://myaccount.google.com/apppasswords
4. Generate an App Password for "Mail"
5. Use these settings:
   ```
   IMAP Host: imap.gmail.com
   IMAP Port: 993
   IMAP User: youremail@gmail.com
   IMAP Pass: (16-character app password, no spaces)
   IMAP TLS: On
   ```

**Outlook/Office365 IMAP setup (free):**

1. Go to your Outlook.com account settings
2. Enable POP and IMAP access under "Sync email"
3. If using 2FA, generate an app password at https://account.live.com/proofs/manage
4. Use these settings:
   ```
   IMAP Host: outlook.office365.com
   IMAP Port: 993
   IMAP User: youremail@outlook.com
   IMAP Pass: (your password or app password)
   IMAP TLS: On
   ```

#### 4.3.2 Twilio Integration (Voice + WhatsApp)

Twilio provides both phone call (voice) and WhatsApp messaging capabilities through a single account.

**Configuration fields:**

| Field | Description | Example |
|-------|------------|---------|
| **Twilio Enabled** | Toggle Twilio integration on/off | On |
| **Account SID** | Twilio Account SID | `AC1234567890abcdef...` |
| **Auth Token** | Twilio Auth Token | `abcdef1234567890...` |
| **Phone Number** | Your Twilio phone number | `+15551234567` |
| **Record Calls** | Record incoming voice calls | Off |

**Step 1: Create a Twilio account**

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial (no credit card required initially)
3. You receive $15.50 in trial credit
4. Verify your personal phone number during signup

**Step 2: Get your credentials**

1. From the Twilio Console dashboard (https://console.twilio.com)
2. Copy the **Account SID** and **Auth Token** displayed on the main page
3. Enter these in the channel configuration

**Step 3: Set up a phone number**

1. In Twilio Console, go to Phone Numbers > Manage > Buy a Number
2. Search for a number in your country (one free trial number is included)
3. Purchase the number
4. Note the number in E.164 format (e.g., `+15551234567`)

**Step 4: Configure voice webhooks**

1. Go to Phone Numbers > Manage > Active Numbers
2. Click your phone number
3. Under "Voice & Fax", set:
   - **A Call Comes In**: Webhook, `https://your-domain.com/api/v1/webhooks/twilio/voice`, HTTP POST
   - **Call Status Changes**: `https://your-domain.com/api/v1/webhooks/twilio/voice/status`, HTTP POST
4. For local development, use ngrok (see Section 7.3)

**Twilio WhatsApp Sandbox setup (free for testing):**

1. In Twilio Console, go to Messaging > Try it out > Send a WhatsApp Message
2. Follow the instructions to join the sandbox:
   - Send `join <sandbox-keyword>` to the sandbox number (displayed on the page) from your WhatsApp
3. Configure the sandbox webhook:
   - Go to Messaging > Settings > WhatsApp Sandbox Settings
   - Set **When a message comes in** to: `https://your-domain.com/api/v1/webhooks/twilio/whatsapp`, HTTP POST
4. The sandbox number is shared across all Twilio trial accounts. Messages from your personal WhatsApp to the sandbox number will be routed through the webhook to create tickets.

**Webhook URLs for Twilio:**

| Webhook | URL |
|---------|-----|
| Voice incoming | `https://<your-domain>/api/v1/webhooks/twilio/voice` |
| Voice status | `https://<your-domain>/api/v1/webhooks/twilio/voice/status` |
| WhatsApp incoming | `https://<your-domain>/api/v1/webhooks/twilio/whatsapp` |

#### 4.3.3 Meta WhatsApp Cloud API

The Meta WhatsApp Cloud API provides a direct WhatsApp Business integration without Twilio as a middleman. It offers 1,000 free service conversations per month.

**Configuration fields:**

| Field | Description | Example |
|-------|------------|---------|
| **Meta WhatsApp Enabled** | Toggle Meta WhatsApp on/off | On |
| **Access Token** | Permanent or temporary access token | `EAAG...` |
| **Phone Number ID** | WhatsApp Business phone number ID | `123456789012345` |
| **Verify Token** | A secret string you choose for webhook verification | `my-secret-verify-token-2026` |
| **Business ID** | WhatsApp Business Account ID | `987654321098765` |

**Step 1: Create a Meta Developer account**

1. Go to https://developers.facebook.com
2. Sign in with your Facebook account
3. Create a new App: Choose "Business" type
4. Select "WhatsApp" as a product to add

**Step 2: Set up WhatsApp Business API**

1. In the Meta App Dashboard, go to WhatsApp > Getting Started
2. You get a temporary access token (valid 24 hours) and a test phone number
3. For a permanent token: go to Business Settings > System Users > Generate Token
4. Note the **Phone Number ID** displayed on the Getting Started page
5. Note the **WhatsApp Business Account ID** from the same page

**Step 3: Configure webhooks**

1. In the Meta App Dashboard, go to WhatsApp > Configuration
2. Under "Webhook", click **Edit**
3. Set:
   - **Callback URL**: `https://your-domain.com/api/v1/webhooks/meta/whatsapp`
   - **Verify Token**: The same string you entered in the channel config (e.g., `my-secret-verify-token-2026`)
4. Click **Verify and Save**
5. Subscribe to the **messages** webhook field

**Webhook verification flow:**

When you save the webhook URL, Meta sends a GET request to your callback URL with:
- `hub.mode=subscribe`
- `hub.verify_token=<your-verify-token>`
- `hub.challenge=<random-string>`

The system checks the verify token against all configured organizations and responds with the challenge string if it matches.

**Step 4: Test**

1. From the Meta Getting Started page, add your personal phone number as a test recipient
2. Send a WhatsApp message to the test phone number
3. The webhook receives the message and creates a ticket

#### Common channel settings

| Field | Description | Default |
|-------|------------|---------|
| **Auto Reply Enabled** | Send automatic confirmation reply to inbound messages | On |
| **Deduplicate Minutes** | Group messages from the same sender within this window into one ticket | 30 |

### 4.4 SLA Policies

Navigate to **Settings** > **SLA Policies** tab.

Default SLA policies (created by the seed):

| Priority | First Response Time | Resolution Time |
|----------|-------------------|-----------------|
| Urgent | 30 minutes | 4 hours |
| High | 1 hour | 8 hours |
| Medium | 4 hours | 24 hours |
| Low | 8 hours | 48 hours |

**How SLA works:**

1. When a ticket is created, an SLA policy is automatically assigned based on the ticket's priority
2. A **due date** is calculated based on the resolution time
3. A background cron job checks every 5 minutes for SLA breaches
4. Breached tickets are:
   - Marked with a red **"SLA Breached"** badge
   - Trigger a notification to the assigned agent
   - Trigger an email notification (if configured)
   - Logged in the activity feed
5. Changing a ticket's priority automatically updates its SLA policy and recalculates the due date

**Editing SLA policies:**

Admins can update the first response and resolution times for each priority level via the settings page or the API:

```
PATCH /api/v1/sla-policies/:id
```

### 4.5 Categories and Priorities

#### Ticket categories

Categories help organize tickets by topic (e.g., "Billing", "Technical Support", "Account Issues").

- **Create**: `POST /api/v1/categories` with `name`, `description`, `color`, `icon`
- **List**: `GET /api/v1/categories`
- **Update**: `PATCH /api/v1/categories/:id`
- **Delete**: `DELETE /api/v1/categories/:id`
- **Reorder**: Update the `sortOrder` field on each category

Each category has a color and optional icon for visual identification in the ticket list.

#### Custom priorities

In addition to the built-in priorities (Low, Medium, High, Urgent), organizations can define custom priority levels:

- **Create**: `POST /api/v1/priorities` with `name`, `level` (numeric, higher = more urgent), `color`, `icon`
- **List**: `GET /api/v1/priorities`
- **Update**: `PATCH /api/v1/priorities/:id`
- **Delete**: `DELETE /api/v1/priorities/:id`

The `level` field determines the sort order: level 1 is the lowest priority, higher numbers are more urgent.

### 4.6 Knowledge Base

Navigate to **Knowledge Base** in the sidebar.

#### Creating article categories

1. Use the API: `POST /api/v1/knowledge-base/categories` with `name`, `slug`, `description`
2. Categories group related articles (e.g., "Getting Started", "Billing FAQ", "Troubleshooting")

#### Writing and publishing articles

1. Click **"+ New Article"** on the Knowledge Base page
2. Select a **Category**
3. Enter the **Title** and **Content**
4. Check **"Publish immediately"** to make it visible to end users, or save as draft
5. Click **Create Article**

End users see only published articles. Agents and Admins can also see and edit drafts.

Articles can be managed via the API:

```
POST   /api/v1/knowledge-base/articles         -- Create
GET    /api/v1/knowledge-base/articles         -- List (with search and category filter)
GET    /api/v1/knowledge-base/articles/:id     -- Read
PATCH  /api/v1/knowledge-base/articles/:id     -- Update
DELETE /api/v1/knowledge-base/articles/:id     -- Delete (Admin only)
```

### 4.7 Canned Responses

Canned responses are pre-written reply templates that agents can quickly insert into ticket comments.

**Creating a canned response:**

```
POST /api/v1/canned-responses
{
  "title": "Refund Acknowledgment",
  "content": "Thank you for reaching out. We have initiated your refund and it will be processed within 5-7 business days.",
  "shortcut": "/refund",
  "categoryTag": "billing",
  "isShared": true
}
```

- **title** -- Display name in the canned response picker
- **content** -- The actual reply text
- **shortcut** -- A slash-command trigger (e.g., typing `/refund` in the comment box inserts the content)
- **categoryTag** -- Optional grouping tag
- **isShared** -- If true, all agents in the org can use it. If false, only the creator can use it.

**API endpoints:**

```
POST   /api/v1/canned-responses      -- Create
GET    /api/v1/canned-responses      -- List (shared + personal)
PATCH  /api/v1/canned-responses/:id  -- Update
DELETE /api/v1/canned-responses/:id  -- Delete
```

### 4.8 JIRA Integration

Navigate to **Settings** > **JIRA Integration** tab.

#### Connecting to JIRA Cloud

1. Fill in:
   - **JIRA Base URL**: e.g., `https://yourcompany.atlassian.net`
   - **JIRA Email**: Your Atlassian account email
   - **API Token**: Generate at https://id.atlassian.com/manage-profile/security/api-tokens
   - **Project Key**: e.g., `DEV`, `PROJ`, `ENG`
   - **Issue Type**: Task, Bug, Story, or Epic
2. Click **Connect JIRA**
3. The system verifies credentials before saving

#### Creating issues from tickets

1. Open any support ticket
2. In the right sidebar, find the **JIRA** section
3. Click **"Create JIRA Ticket"**
4. A JIRA issue is created with:
   - Title: `[Support #123] Original ticket title`
   - Description: Full ticket details, reporter info, priority, and tags
   - Priority: Automatically mapped (Urgent -> Highest, High -> High, Medium -> Medium, Low -> Low)
   - Label: `support-ticket`
5. The support ticket now shows the linked JIRA issue key (e.g., `DEV-42`) as a clickable link

#### Status synchronization

1. After a JIRA issue is linked, click **"Sync Status"** in the JIRA card
2. The current JIRA status (e.g., "In Progress", "Done") is pulled and displayed
3. This helps agents track development progress without leaving the support tool

#### Disconnecting JIRA

Go to **Settings** > **JIRA Integration** > click **Disconnect** to remove the configuration.

---

## 5. Analytics and Reporting

Navigate to **Analytics** in the sidebar (Admin and Agent only).

### Dashboard KPIs

The analytics dashboard displays summary cards:

- **Total Tickets** -- All tickets in the organization
- **Open** -- Currently open tickets
- **Pending** -- Tickets awaiting customer or third-party response
- **Resolved** -- Tickets resolved by agents
- **SLA Breached** -- Tickets that exceeded their SLA resolution time

### Ticket volume trends

A chart showing tickets created per day over a configurable period (default 30 days):

```
GET /api/v1/analytics/volume?days=30
```

### Agent performance metrics

The agent performance table shows for each agent:

| Metric | Description |
|--------|------------|
| **Assigned** | Total tickets assigned |
| **Open** | Currently active tickets (highlighted if > 5) |
| **Resolved** | Tickets resolved |
| **Resolution Rate** | Percentage of assigned tickets resolved. Green >= 70%, yellow >= 40%, red < 40% |
| **Avg Response Time** | Average time to first reply (hours) |
| **Avg Resolution Time** | Average time to resolve (hours) |
| **SLA Compliance** | Percentage of tickets resolved within SLA. Green >= 90%, yellow >= 70%, red < 70% |

Click on an agent's name to see their detailed KPI page, which includes:

- 8 KPI cards at a glance
- Weekly resolved chart (bar chart, last 12 weeks)
- Resolution time breakdown (green < 4h, yellow < 24h, red > 24h)
- Recent tickets table (10 most recent with status and SLA indicators)

### CSAT scores

Customer satisfaction ratings are collected after ticket resolution:

```
GET /api/v1/satisfaction/stats
```

Ratings are on a 1-5 star scale with optional text feedback.

### Priority and status breakdowns

```
GET /api/v1/analytics/by-priority    -- Ticket count per priority level
GET /api/v1/analytics/by-status      -- Ticket count per status
```

These are displayed as bar charts on the analytics dashboard.

---

## 6. Desktop Application

The SupportDesk desktop app packages the full system (backend + frontend) into a standalone Electron application.

### Installing the desktop app

**From source (development):**

```bash
cd desktop
npm install

# Build backend and frontend first
npm run build:backend
npm run build:frontend

# Run in dev mode
npm start
```

**Building an installer:**

```bash
cd desktop
npm run package
```

This produces a Windows installer at `desktop/dist/SupportDesk-Setup-1.1.0.exe`.

### First launch

1. Run the installer or start the app
2. A splash screen appears while the backend and frontend boot up
3. The backend starts on port **3051** and the frontend on port **3052** (different from dev ports to avoid conflicts)
4. The main window loads once both servers are ready
5. Log in with the same credentials as the web version

### Differences from web version

- The desktop app bundles its own backend and frontend -- it does not require external servers
- The database is stored in the user's application data directory (not the project folder)
- The app runs as a single-user local instance by default
- A system tray icon allows minimizing to tray

### Data location

| Platform | Database Path |
|----------|--------------|
| Windows | `%APPDATA%\SupportDesk\data\supportdesk.db` |
| macOS | `~/Library/Application Support/SupportDesk/data/supportdesk.db` |
| Linux | `~/.config/SupportDesk/data/supportdesk.db` |

On first launch, if no database exists, the app copies the seed database from the installation resources.

---

## 7. Integration Testing Guide

This section explains how to test each channel integration using free tools. No paid subscriptions are required.

### 7.1 Testing Email (Free)

#### Option A: Ethereal Email (recommended -- no signup)

Ethereal provides disposable SMTP credentials for testing. Emails are captured in a web inbox and never delivered to real addresses.

1. Go to https://ethereal.email
2. Click **"Create Ethereal Account"**
3. Copy the generated SMTP credentials
4. In SupportDesk, go to Settings > Email Configuration
5. Enter:
   ```
   SMTP Host:  smtp.ethereal.email
   SMTP Port:  587
   SMTP User:  <generated>@ethereal.email
   SMTP Pass:  <generated password>
   From Email: support@test.com
   From Name:  Test Support
   ```
6. Save and click **"Send Test Email"**
7. Go back to https://ethereal.email and log in to view the captured email

#### Option B: Mailtrap (free tier -- 100 emails/month)

1. Sign up at https://mailtrap.io
2. Create an inbox in the Email Testing sandbox
3. Copy the SMTP credentials from the inbox settings:
   ```
   SMTP Host:  sandbox.smtp.mailtrap.io
   SMTP Port:  587
   SMTP User:  <your mailtrap user>
   SMTP Pass:  <your mailtrap password>
   ```
4. Configure in SupportDesk and send a test email
5. View the email in the Mailtrap web UI

#### Option C: Brevo/Sendinblue (free tier -- 300 emails/day, delivers to real addresses)

1. Sign up at https://www.brevo.com
2. Go to SMTP & API > SMTP tab
3. Use credentials:
   ```
   SMTP Host:  smtp-relay.brevo.com
   SMTP Port:  587
   SMTP User:  <your Brevo login email>
   SMTP Pass:  <SMTP key from dashboard>
   ```
4. Configure in SupportDesk and send a test email
5. Check your real email inbox for the test message

### 7.2 Testing WhatsApp (Free)

#### Option A: Twilio WhatsApp Sandbox (completely free)

The Twilio sandbox lets you test WhatsApp messaging without a paid WhatsApp Business number.

**Step-by-step setup:**

1. Sign up for a free Twilio account at https://www.twilio.com/try-twilio
2. In the Twilio Console, go to **Messaging > Try it out > Send a WhatsApp Message**
3. Note the sandbox number and the join keyword (e.g., `join quiet-fox`)
4. On your personal phone, open WhatsApp and send the join message to the sandbox number
5. You should receive a confirmation that you joined the sandbox
6. In Twilio Console, go to **Messaging > Settings > WhatsApp Sandbox Settings**
7. Set "When a message comes in" to:
   ```
   https://<your-ngrok-url>/api/v1/webhooks/twilio/whatsapp
   ```
   (See "Using ngrok for local development" below)
8. In SupportDesk Settings > Channels, enable Twilio and enter your Account SID, Auth Token, and sandbox phone number
9. Send a WhatsApp message from your phone to the sandbox number
10. A ticket should appear in SupportDesk within seconds

**Limitations of the sandbox:**
- Only pre-joined numbers can send/receive messages
- The sandbox number is shared (not a dedicated number)
- Messages must be sent within 24 hours of the last interaction

#### Option B: Meta WhatsApp Test Mode (free)

1. Create a Meta Developer account at https://developers.facebook.com
2. Create a new App (Business type) and add WhatsApp
3. In the Getting Started page, you get a test phone number and a temporary access token
4. Add your personal phone number as a test recipient
5. Configure the webhook URL:
   ```
   https://<your-ngrok-url>/api/v1/webhooks/meta/whatsapp
   ```
6. Set the verify token to match what you configured in SupportDesk
7. Subscribe to the `messages` webhook field
8. Send a WhatsApp message from your personal number to the test number
9. A ticket should appear in SupportDesk

**Limitations of test mode:**
- Temporary access tokens expire after 24 hours (generate a permanent token via System Users)
- Only up to 5 pre-registered test phone numbers
- Free tier includes 1,000 service conversations per month

#### Using ngrok for local development

Twilio and Meta require a publicly accessible URL for webhooks. Use ngrok to tunnel your local backend:

```bash
# Install ngrok from https://ngrok.com or via npm
npm install -g ngrok

# Start a tunnel to your backend port
ngrok http 3001
```

ngrok displays a public URL like `https://abc123.ngrok-free.app`. Use this as the base URL for webhook configuration:

```
Voice:    https://abc123.ngrok-free.app/api/v1/webhooks/twilio/voice
WhatsApp: https://abc123.ngrok-free.app/api/v1/webhooks/twilio/whatsapp
Meta WA:  https://abc123.ngrok-free.app/api/v1/webhooks/meta/whatsapp
```

The ngrok free tier provides a random URL that changes on restart. Paid plans offer stable URLs.

### 7.3 Testing Phone/Voice (Free)

Twilio's free trial includes $15.50 in credit, enough for extensive voice testing.

**Step-by-step setup:**

1. Sign up for Twilio at https://www.twilio.com/try-twilio (no credit card required)
2. Verify your personal phone number during signup
3. In the Console, go to **Phone Numbers > Manage > Buy a Number**
4. Get a free trial phone number (one is included at no charge)
5. Start ngrok: `ngrok http 3001`
6. In Twilio Console, click your phone number and configure:
   - **A Call Comes In**: Webhook, POST, `https://<ngrok-url>/api/v1/webhooks/twilio/voice`
   - **Call Status Changes**: `https://<ngrok-url>/api/v1/webhooks/twilio/voice/status`
7. In SupportDesk, configure the Twilio channel with your Account SID, Auth Token, and phone number
8. Call the Twilio number from your verified personal phone
9. A ticket should be created in SupportDesk with caller information

**Limitations of the Twilio trial:**
- Can only call/send messages to verified phone numbers
- Outbound calls/messages include a "Twilio trial" prefix
- $15.50 credit is sufficient for many test calls (voice costs approximately $0.02/minute)

### 7.4 Testing Inbound Email (Free)

#### Gmail IMAP with App Passwords

1. Ensure 2-Step Verification is enabled on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and generate an app password
4. In SupportDesk Settings > Channels, configure IMAP:
   ```
   IMAP Host: imap.gmail.com
   IMAP Port: 993
   IMAP User: youremail@gmail.com
   IMAP Pass: <16-character app password>
   IMAP TLS:  On
   ```
5. Click **"Test IMAP Connection"** to verify
6. Enable IMAP and save
7. Send an email to `youremail@gmail.com` from another account
8. Within 1-2 minutes (the polling interval), a ticket should appear in SupportDesk

#### Outlook.com IMAP

1. Go to Outlook.com > Settings > View all Outlook settings > Mail > Sync email
2. Under "POP and IMAP", enable **Let devices and apps use IMAP**
3. If you have 2FA enabled, generate an app password at https://account.live.com/proofs/manage
4. Configure in SupportDesk:
   ```
   IMAP Host: outlook.office365.com
   IMAP Port: 993
   IMAP User: youremail@outlook.com
   IMAP Pass: <your password or app password>
   IMAP TLS:  On
   ```
5. Test the connection, enable, and save
6. Send a test email to your Outlook address

---

## 8. Troubleshooting

### 8.1 Common Issues

#### Backend won't start

**"Port 3001 is already in use"**

Another process is using the port. Find and kill it:

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :3001
kill -9 <pid>
```

Or change the port in `.env`:

```env
PORT=3002
```

**"Cannot find module '@prisma/client'"**

Run Prisma generate:

```bash
cd backend
npx prisma generate
```

**"EPERM: operation not permitted" on Prisma generate**

Another process (running backend or DB viewer) has a lock on the database file. Stop the running backend server, then re-run `npx prisma generate`.

**Missing environment variables**

Ensure `.env` exists in the `backend/` directory with at least `DATABASE_URL` and `JWT_SECRET`. Copy from `.env.example`:

```bash
cp .env.example .env
```

#### Frontend won't connect to backend

**CORS errors in browser console**

Ensure the `FRONTEND_URL` in the backend `.env` matches the frontend's actual URL:

```env
FRONTEND_URL="http://localhost:3000"
```

Restart the backend after changing this value.

**"Network Error" or API calls failing**

Verify the frontend's API URL. Check `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Ensure the backend is running and accessible at that URL.

#### Emails not sending

1. Verify SMTP credentials by clicking "Send Test Email" in settings
2. Check that your SMTP port (587 or 465) is not blocked by a firewall
3. For Gmail: ensure you are using an App Password, not your regular password
4. For corporate SMTP: check if the server requires VPN or specific IP allowlisting
5. Check backend logs for detailed error messages

#### IMAP not polling

1. Verify IMAP is enabled in the channel configuration
2. Use the "Test IMAP Connection" button to validate credentials
3. For Gmail: ensure IMAP is enabled in Gmail Settings > Forwarding and POP/IMAP
4. For Gmail: ensure you are using an App Password
5. Check that the IMAP port (993) is not blocked by a firewall
6. Check backend logs for `InboundEmailService` log entries

#### Webhooks not receiving (Twilio/Meta)

1. For local development, you need ngrok or a similar tunnel -- Twilio and Meta cannot reach `localhost`
2. Verify the webhook URL includes the full path: `/api/v1/webhooks/twilio/voice`
3. Ensure ngrok is running and the tunnel URL is current (free ngrok URLs change on restart)
4. Check the backend logs for webhook entries
5. In Twilio Console, check the Debugger for failed webhook deliveries

#### WhatsApp messages not arriving

1. **Twilio sandbox**: Ensure you joined the sandbox by sending the join message
2. **Meta webhook**: Verify the verify token matches exactly between Meta configuration and your channel config
3. **Meta webhook**: Ensure you subscribed to the `messages` field
4. Check the inbound message log: `GET /api/v1/channels/messages`

#### Desktop app stuck on splash screen

1. Check if ports 3051 and 3052 are available
2. Check the Electron main process logs in the terminal
3. The backend may be failing to start -- check the backend's console output
4. Try deleting the local database and restarting (the app will re-create it from the seed):
   - Windows: Delete `%APPDATA%\SupportDesk\data\supportdesk.db`

#### Login fails with "Organization not found"

Ensure you are entering the correct organization slug. For the demo, use `demo`. The slug is case-sensitive and uses hyphens (e.g., `acme-corp`, not `Acme Corp`).

### 8.2 Logs

#### Backend logs (NestJS Logger)

The backend uses NestJS's built-in logger. In development mode (`npm run start:dev`), all logs are printed to the terminal with timestamps and context labels:

```
[Nest] 12345  - 04/14/2026, 10:30:00 AM  LOG [ChannelsService] Creating ticket from WHATSAPP channel
[Nest] 12345  - 04/14/2026, 10:30:01 AM  WARN [InboundEmailService] Failed to poll mailbox...
```

Log levels: LOG, WARN, ERROR, DEBUG, VERBOSE.

#### Checking the inbound message log

All channel messages (phone, WhatsApp, inbound email) are recorded in the `inbound_messages` table. View them via the API:

```
GET /api/v1/channels/messages?limit=50
GET /api/v1/channels/messages?channel=WHATSAPP
GET /api/v1/channels/messages?channel=PHONE
GET /api/v1/channels/messages?channel=EMAIL_INBOUND
```

Each record contains: channel, sender identity, subject, body, raw payload, linked ticket ID, and timestamps.

#### Checking activity logs

Every ticket change (status update, assignment, comment, SLA breach) is logged in the `activity_logs` table. View them on the ticket detail page under the "Activity" section, or via the API:

```
GET /api/v1/tickets/:id    -- Includes activityLogs in the response
```

### 8.3 Database

#### Resetting the database

To reset the database and re-seed demo data:

```bash
cd backend

# Delete existing database and re-run migrations
npx prisma migrate reset

# This runs all migrations and then the seed script
```

Or manually:

```bash
rm prisma/dev.db
npx prisma migrate dev --name init
npx prisma db seed
```

#### Running migrations

After pulling code changes that include schema updates:

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

#### Backing up SQLite

The SQLite database is a single file. To back it up:

```bash
# Stop the backend first to avoid corruption
cp backend/prisma/dev.db backend/prisma/dev.db.backup
```

For the desktop app, back up the file from the user data directory (see Section 6).

#### Inspecting the database

Use Prisma Studio for a web-based database browser:

```bash
cd backend
npx prisma studio
```

This opens a browser interface at http://localhost:5555 where you can view and edit all tables.

---

## 9. Production Deployment

### Environment variables checklist

All variables that must be set for production:

| Variable | Required | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Strong random string (min 32 characters) |
| `JWT_REFRESH_SECRET` | Yes | Different strong random string |
| `JWT_EXPIRATION` | No | Access token lifetime (default: `15m`) |
| `JWT_REFRESH_EXPIRATION` | No | Refresh token lifetime (default: `7d`) |
| `PORT` | No | Backend port (default: `3001`, often auto-set by platform) |
| `FRONTEND_URL` | Yes | Frontend domain for CORS (e.g., `https://app.yourdomain.com`) |
| `NODE_ENV` | Yes | Set to `production` (disables Swagger docs) |
| `MEILI_HOST` | No | Meilisearch URL (optional) |
| `MEILI_API_KEY` | No | Meilisearch API key (optional) |

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### PostgreSQL setup

1. Update `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set the connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/support_tickets"
```

3. Run migrations:

```bash
cd backend
npx prisma migrate dev --name switch_to_postgres
npx prisma db seed
```

### Building for production

**Backend:**

```bash
cd backend
npm run build
npm run start:prod
```

**Frontend:**

```bash
cd frontend
npm run build
npm start
```

### Reverse proxy (nginx)

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # Backend API
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

        # Allow file uploads
        client_max_body_size 10M;
    }
}

server {
    listen 443 ssl;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL/TLS

For production, obtain SSL certificates via:
- **Let's Encrypt** (free): Use certbot with nginx
- **Cloudflare** (free): Proxy through Cloudflare for automatic SSL
- **Commercial CA**: Purchase from your preferred certificate authority

```bash
# Let's Encrypt with certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

### Process manager (PM2)

Use PM2 to keep the backend running and restart on crashes:

```bash
npm install -g pm2

# Start the backend
cd backend
pm2 start dist/src/main.js --name supportdesk-api

# Start the frontend
cd ../frontend
pm2 start node_modules/.bin/next -- start --name supportdesk-web

# Save the process list for auto-restart on reboot
pm2 save
pm2 startup
```

PM2 commands:

```bash
pm2 list              # View running processes
pm2 logs              # View live logs
pm2 restart all       # Restart all processes
pm2 monit             # Real-time monitoring dashboard
```

### Monitoring

- **PM2 monitoring**: `pm2 monit` for CPU, memory, and restart counts
- **Health check**: `GET /api/v1/` should return a response (or use a custom health endpoint)
- **Database**: Monitor PostgreSQL connection pool and query performance
- **Disk space**: Monitor the `uploads/` directory for attachment storage growth
- **Uptime monitoring**: Use a service like UptimeRobot (free tier) to ping your API endpoint

---

## 10. Security Considerations

### JWT secret strength

- Use cryptographically random strings of at least 64 characters for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Never use the default values from `.env.example` in production
- Rotate secrets periodically; users will need to re-authenticate after rotation

### SMTP credential storage

- SMTP passwords are stored in the database (EmailConfig table) in plain text
- The API masks passwords in responses (displayed as `--------`)
- For production, consider encrypting credentials at rest or using a secrets manager

### Webhook signature validation

- Twilio webhooks include a signature header. The system validates this using the `X-Twilio-Signature` header and the Twilio Auth Token
- Meta WhatsApp webhooks are verified using the verify token during subscription setup
- Never expose your Twilio Auth Token or Meta access tokens in client-side code

### Rate limiting

The backend uses `@nestjs/throttler` for rate limiting. Default configuration applies globally. Adjust thresholds in `app.module.ts` based on your traffic patterns.

### CORS configuration

CORS is configured via the `FRONTEND_URL` environment variable. Only the specified origin is allowed. In production, set this to your exact frontend domain:

```env
FRONTEND_URL="https://app.yourdomain.com"
```

Do not use wildcard (`*`) in production.

### File upload limits

- The `ValidationPipe` with `whitelist: true` strips unknown properties from requests
- Configure `client_max_body_size` in nginx to limit upload sizes (recommended: 10MB)
- The `multer` library handles multipart file uploads with configurable size limits

### Multi-tenant data isolation

- Every database query includes an `organizationId` filter via guards and service logic
- JWT tokens contain the user's `organizationId`, which is verified on every request
- Users can only access data within their own organization
- Ensure custom queries always include the organization filter

### Helmet security headers

The backend uses the `helmet` middleware to set security headers including:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY (configurable)
- X-XSS-Protection
- Strict-Transport-Security (when behind HTTPS)

---

## 11. Quick Reference

### API base URL and Swagger docs

| Resource | URL |
|----------|-----|
| API Base URL | `http://localhost:3001/api/v1` |
| Swagger API Docs | `http://localhost:3001/api/docs` (dev only, disabled when `NODE_ENV=production`) |
| Frontend | `http://localhost:3000` |

To authenticate in Swagger:
1. Call `POST /api/v1/auth/login` with `{ "email": "admin@demo.com", "password": "password123", "orgSlug": "demo" }`
2. Copy the `accessToken` from the response
3. Click "Authorize" (top right) and paste: `Bearer <your-token>`

### Default ports

| Component | Dev Port | Desktop App Port |
|-----------|---------|-----------------|
| Backend API | 3001 | 3051 |
| Frontend | 3000 | 3052 |
| Prisma Studio | 5555 | -- |
| Meilisearch | 7700 | -- |

### Key file locations

| File | Path | Purpose |
|------|------|---------|
| Backend entry point | `backend/src/main.ts` | NestJS bootstrap, Swagger setup, CORS |
| Database schema | `backend/prisma/schema.prisma` | All table definitions |
| Seed script | `backend/prisma/seed.ts` | Demo data generator |
| Database (SQLite) | `backend/prisma/dev.db` | Development database file |
| Backend env | `backend/.env` | Backend environment variables |
| Frontend env | `frontend/.env.local` | Frontend environment variables |
| API client | `frontend/src/lib/api.ts` | Axios instance with auth interceptors |
| Auth store | `frontend/src/stores/auth.ts` | Zustand auth state management |
| Desktop main | `desktop/main.js` | Electron main process |
| Uploads | `backend/uploads/` | File attachments storage |

### Environment variable reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Database connection string |
| `JWT_SECRET` | -- | JWT signing secret (required) |
| `JWT_REFRESH_SECRET` | -- | Refresh token signing secret (required) |
| `JWT_EXPIRATION` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRATION` | `7d` | Refresh token lifetime |
| `PORT` | `3001` | Backend server port |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin |
| `NODE_ENV` | -- | Set to `production` to disable Swagger |
| `MEILI_HOST` | `http://localhost:7700` | Meilisearch host URL |
| `MEILI_API_KEY` | -- | Meilisearch master key |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server (env fallback, per-org config preferred) |
| `SMTP_PORT` | `587` | SMTP port (env fallback) |
| `SMTP_USER` | -- | SMTP username (env fallback) |
| `SMTP_PASS` | -- | SMTP password (env fallback) |
| `SMTP_FROM` | -- | Default from email (env fallback) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Frontend API base URL |

### Webhook endpoint reference

| Channel | Method | Path |
|---------|--------|------|
| Twilio Voice (incoming call) | POST | `/api/v1/webhooks/twilio/voice` |
| Twilio Voice (status callback) | POST | `/api/v1/webhooks/twilio/voice/status` |
| Twilio WhatsApp | POST | `/api/v1/webhooks/twilio/whatsapp` |
| Meta WhatsApp (verification) | GET | `/api/v1/webhooks/meta/whatsapp` |
| Meta WhatsApp (messages) | POST | `/api/v1/webhooks/meta/whatsapp` |

### API endpoints summary

| Group | Base Path | Key Operations |
|-------|-----------|---------------|
| Auth | `/api/v1/auth` | signup, login, refresh, invite, logout |
| Tickets | `/api/v1/tickets` | CRUD, bulk update, my tickets |
| Comments | `/api/v1/tickets/:id/comments` | Create, edit, delete |
| Users | `/api/v1/users` | List, profile, toggle active |
| Organizations | `/api/v1/organizations` | Get/update current org, list tags |
| Analytics | `/api/v1/analytics` | Dashboard, volume, agent KPIs |
| JIRA | `/api/v1/jira` | Config, create issue, sync status |
| Notifications | `/api/v1/notifications` | List, unread count, mark read |
| Knowledge Base | `/api/v1/knowledge-base` | Categories, articles CRUD |
| SLA Policies | `/api/v1/sla-policies` | List, update |
| Email Config | `/api/v1/email-config` | Get/save config, send test |
| Channels | `/api/v1/channels` | Config, test IMAP, message log |
| Categories | `/api/v1/categories` | CRUD ticket categories |
| Priorities | `/api/v1/priorities` | CRUD custom priorities |
| Canned Responses | `/api/v1/canned-responses` | CRUD response templates |
| Satisfaction | `/api/v1/satisfaction` | Submit/view CSAT ratings |
| Time Tracking | `/api/v1/time-entries` | Log time against tickets |
| Watchers | `/api/v1/watchers` | Watch/unwatch tickets |
| Search | `/api/v1/search/tickets` | Full-text ticket search |
| Attachments | `/api/v1/attachments` | Upload, delete files |

---

*SupportDesk Runbook -- Version 1.1.0*
