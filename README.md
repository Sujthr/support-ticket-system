# SupportDesk - Customer Support Ticketing System

A production-ready, multi-tenant SaaS platform for managing customer support via tickets, agents, and automation. Built with **NestJS**, **Next.js**, **Prisma**, and **Tailwind CSS**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Demo Accounts](#demo-accounts)
- [User Guide](#user-guide)
  - [Getting Started](#getting-started)
  - [Dashboard](#dashboard)
  - [Managing Tickets](#managing-tickets)
  - [Agent Workspace](#agent-workspace)
  - [Comments and Conversations](#comments-and-conversations)
  - [JIRA Integration](#jira-integration)
  - [Agent KPIs and Analytics](#agent-kpis-and-analytics)
  - [Knowledge Base](#knowledge-base)
  - [Team Management](#team-management)
  - [SLA Policies](#sla-policies)
  - [Settings](#settings)
- [API Documentation](#api-documentation)
- [API Endpoints Reference](#api-endpoints-reference)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Switching to PostgreSQL](#switching-to-postgresql)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Multi-Tenant Architecture** - Each organization has fully isolated data
- **Role-Based Access Control** - Admin, Agent, and End User roles
- **Ticket Management** - Create, assign, update, close with full activity logging
- **SLA Engine** - Automated breach detection with cron-based monitoring
- **Comments System** - Public replies and private internal notes
- **JIRA Integration** - Create dev tickets directly from support issues
- **Agent KPIs** - Resolution rate, response time, SLA compliance per agent
- **Analytics Dashboard** - Ticket volume, priority/status breakdown, agent performance
- **Knowledge Base** - Searchable help articles with categories
- **In-App Notifications** - Real-time notification bell with unread count
- **Full-Text Search** - Search across tickets (Meilisearch with database fallback)
- **File Attachments** - Upload files to tickets and comments
- **Bulk Actions** - Resolve or close multiple tickets at once
- **Dark Mode** - Toggle between light and dark themes
- **Swagger API Docs** - Interactive API documentation at `/api/docs`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand, Axios |
| Backend | NestJS 10, Node.js, Passport.js, class-validator |
| Database | SQLite (dev) / PostgreSQL (production), Prisma ORM |
| Auth | JWT access tokens + refresh token rotation |
| Search | Meilisearch (optional, falls back to database) |
| API Docs | Swagger / OpenAPI |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   Customer Portal (Next.js)  │  Agent Dashboard (Next.js)   │
└──────────────┬───────────────┴──────────────┬────────────────┘
               │            HTTPS             │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Backend API                        │
│  ┌──────┐ ┌────────┐ ┌──────┐ ┌──────────┐ ┌─────┐ ┌─────┐│
│  │ Auth │ │Tickets │ │Users │ │Analytics │ │JIRA │ │ KB  ││
│  └──────┘ └────────┘ └──────┘ └──────────┘ └─────┘ └─────┘│
│  ┌────────────────────────────────────────────────────────┐ │
│  │         RBAC Middleware + Multi-Tenant Guard            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌─────────────┐  ┌───────────┐
   │   SQLite   │  │ Meilisearch │  │  AWS S3    │
   │ /PostgreSQL│  │  (optional) │  │ (optional) │
   └────────────┘  └─────────────┘  └───────────┘
```

---

## Prerequisites

- **Node.js** v18 or higher ([download](https://nodejs.org))
- **npm** v9 or higher (comes with Node.js)
- **Git** ([download](https://git-scm.com))

That's it for development. SQLite is used by default, so no database server is needed.

For production, you'll also want:
- PostgreSQL 14+
- Meilisearch (optional, for fast full-text search)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Sujthr/support-ticket-system.git
cd support-ticket-system
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

The default `.env` works out of the box with SQLite. Edit it if you want to change JWT secrets or ports:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### 4. Set up the database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates the SQLite database)
npx prisma migrate dev --name init

# Seed demo data
npx prisma db seed
```

You should see:
```
Seed complete!

Demo accounts (password: password123):
  Admin: admin@demo.com
  Agent: agent@demo.com
  User:  user@demo.com
  Org slug: demo
```

### 5. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the Application

You need **two terminal windows** running simultaneously.

### Terminal 1 - Backend API (port 3001)

```bash
cd backend
npm run start:dev
```

You should see NestJS boot up with all routes mapped:
```
Server running on http://localhost:3001
API Docs: http://localhost:3001/api/docs
```

### Terminal 2 - Frontend (port 3000)

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3000
```

### Open the application

Navigate to **http://localhost:3000** in your browser.

---

## Demo Accounts

The seed script creates a demo organization with three users:

| Role | Email | Password | Org Slug |
|------|-------|----------|----------|
| **Admin** | admin@demo.com | password123 | demo |
| **Agent** | agent@demo.com | password123 | demo |
| **End User** | user@demo.com | password123 | demo |

Each role has different permissions and sees different UI elements.

---

## User Guide

### Getting Started

#### Signing Up (New Organization)

1. Go to **http://localhost:3000/signup**
2. Enter your **Organization Name** (e.g., "Acme Corp")
3. Fill in your name, email, and password (min 8 characters)
4. Click **Create Organization**
5. You'll be logged in as the Admin of your new organization

#### Logging In (Existing Organization)

1. Go to **http://localhost:3000/login**
2. Enter the **Organization Slug** (e.g., `demo`, `acme-corp`)
3. Enter your email and password
4. Click **Sign In**

> The organization slug is a URL-friendly identifier created when the org was registered. It's the lowercase, hyphenated version of the organization name.

---

### Dashboard

The dashboard is the first page you see after login. It shows:

- **Stat Cards** - Total tickets, open, resolved, and SLA breached counts
- **Recent Tickets** - The 5 most recently created tickets with status and priority badges

Click **"View all"** to go to the full tickets list.

---

### Managing Tickets

#### Creating a Ticket

1. Go to **Tickets** in the sidebar
2. Click the **"+ New Ticket"** button (top right)
3. Fill in:
   - **Title** - Brief summary of the issue
   - **Description** - Detailed explanation
   - **Priority** - Low, Medium, High, or Urgent
   - **Assign To** - (Optional) Pick an agent from the dropdown
   - **Tags** - (Optional) Comma-separated labels like `bug, billing, urgent`
4. Click **Create Ticket**

The ticket is automatically assigned an SLA policy based on its priority.

#### Viewing Tickets

The tickets list page shows:

- **Search bar** - Search by title or description
- **Status filter** - Filter by Open, Pending, Resolved, Closed
- **Priority filter** - Filter by Low, Medium, High, Urgent
- **Sortable table** with ticket number, title, status, priority, assignee, and creation date
- **Pagination** at the bottom for large lists

Tickets with SLA breaches are highlighted with a red badge.

#### Updating a Ticket

1. Click on a ticket to open its detail view
2. In the **right sidebar**, you can change:
   - **Status** - Open, Pending, Resolved, Closed
   - **Priority** - Low, Medium, High, Urgent
   - **Assignee** - Reassign to another agent
3. Changes are saved immediately and logged in the activity feed

#### Bulk Actions

1. On the tickets list, use the **checkboxes** to select multiple tickets
2. Click **"Resolve"** or **"Close"** in the action bar that appears
3. All selected tickets are updated at once

> Bulk actions are only available to Admins and Agents.

#### My Tickets

Click **"My Tickets"** in the sidebar to see:
- **Agents/Admins**: Tickets assigned to you
- **End Users**: Tickets you created

---

### Agent Workspace

Agents and Admins see the full dashboard with:

- All tickets in the system (filtered by organization)
- Ability to assign, reassign, and change priorities
- Internal notes (hidden from end users)
- SLA tracking with due dates
- JIRA integration for escalation

**End Users** see a simplified view:
- Can only see their own tickets
- Cannot see internal notes
- Can add public comments and close their own tickets

---

### Comments and Conversations

#### Adding a Public Reply

1. Open a ticket
2. Scroll to the **Conversation** section
3. Select **"Public reply"** (default)
4. Type your message
5. Click **Reply**

The customer will see this reply. It also tracks the first response time for SLA.

#### Adding an Internal Note

1. Open a ticket
2. Select **"Internal note"** (yellow icon)
3. Type your note
4. Click **Add Note**

Internal notes are only visible to Admins and Agents. They appear with a yellow background and a lock icon. End users never see these.

---

### JIRA Integration

The JIRA integration allows you to create development tickets directly from support issues.

#### Setting Up JIRA

1. Go to **Settings** > **JIRA Integration** tab (Admin only)
2. Fill in:
   - **JIRA Base URL** - e.g., `https://yourcompany.atlassian.net`
   - **JIRA Email** - Your Atlassian account email
   - **API Token** - Generate at [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
   - **Project Key** - e.g., `DEV`, `PROJ`, `ENG`
   - **Issue Type** - Task, Bug, Story, or Epic
3. Click **Connect JIRA**
4. The system verifies your credentials before saving

#### Creating a JIRA Ticket from a Support Ticket

1. Open any support ticket
2. In the right sidebar, find the **JIRA** section
3. Click **"Create JIRA Ticket"**
4. A JIRA issue is created with:
   - Title: `[Support #123] Original ticket title`
   - Description: Ticket details, reporter info, priority, and tags
   - Priority: Automatically mapped (Urgent→Highest, High→High, etc.)
   - Label: `support-ticket`
5. The support ticket now shows the linked JIRA issue key (e.g., `DEV-42`) as a clickable link

#### Syncing JIRA Status

1. Once a JIRA issue is linked, click **"Sync Status"** in the JIRA card
2. The current JIRA status (e.g., "In Progress", "Done") is pulled and displayed
3. This helps agents track dev progress without leaving the support tool

#### Disconnecting JIRA

Go to **Settings** > **JIRA Integration** > click **Disconnect** to remove the configuration.

---

### Agent KPIs and Analytics

#### Overview Dashboard

Go to **Analytics** in the sidebar to see:

- **Summary Cards** - Total, Open, Pending, Resolved, SLA Breached
- **Tickets by Priority** - Bar chart showing distribution
- **Tickets by Status** - Bar chart showing distribution
- **Agent Performance Table** - All agents with their KPIs

#### Agent KPI Metrics

The agent performance table shows for each agent:

| Metric | Description |
|--------|------------|
| **Assigned** | Total tickets assigned to the agent |
| **Open** | Currently active tickets (highlighted if > 5) |
| **Resolved** | Tickets the agent has resolved |
| **Resolution Rate** | % of assigned tickets resolved (green ≥ 70%, yellow ≥ 40%, red < 40%) |
| **Avg Response** | Average time to first reply (hours) |
| **Avg Resolution** | Average time to resolve (hours) |
| **SLA Compliance** | % of tickets within SLA (green ≥ 90%, yellow ≥ 70%, red < 70%) |

#### Detailed Agent KPI Page

Click on any agent's name to see their detailed KPI page:

- **8 KPI Cards** - All key metrics at a glance
- **Weekly Resolved Chart** - Bar chart of tickets resolved per week (last 12 weeks)
- **Resolution Times** - Visual breakdown of how long each ticket took to resolve
  - Green: resolved in < 4 hours
  - Yellow: resolved in < 24 hours
  - Red: resolved in > 24 hours
- **Recent Tickets Table** - The agent's 10 most recent tickets with status and SLA indicators

---

### Knowledge Base

#### Viewing Articles

1. Go to **Knowledge Base** in the sidebar
2. Use the **search bar** to find articles
3. Filter by **category** using the dropdown
4. Click an article to read it

End users see only published articles. Agents and Admins can also see drafts.

#### Creating Articles (Admin/Agent)

1. Click **"+ New Article"**
2. Select a **Category** (create categories first if needed)
3. Enter the **Title** and **Content**
4. Check **"Publish immediately"** or leave unchecked to save as draft
5. Click **Create Article**

#### Managing Categories

Categories are created via the knowledge base API. A "Getting Started" category is included in the demo seed.

---

### Team Management

#### Inviting Team Members

1. Go to **Settings** > **Team** tab (Admin only)
2. Fill in the invite form:
   - **First Name** and **Last Name**
   - **Email** address
   - **Role**: Agent, Admin, or End User
3. Click **Send Invite**
4. A temporary password is generated and displayed
5. Share the password securely with the new team member
6. They can log in using the org slug, their email, and the temp password

#### Viewing Team Members

The team table shows all users in your organization with:
- Name, email, role, and active status

#### Deactivating Users

Admins can deactivate users via the API (`PATCH /api/v1/users/:id/toggle-active`). Deactivated users cannot log in.

---

### SLA Policies

#### Viewing SLA Policies

Go to **Settings** > **SLA Policies** tab to see the configured policies:

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Urgent | 30 min | 4 hours |
| High | 60 min | 8 hours |
| Medium | 4 hours | 24 hours |
| Low | 8 hours | 48 hours |

#### How SLA Works

1. When a ticket is created, it's automatically assigned an SLA policy based on its priority
2. A **due date** is calculated based on the resolution time
3. A background job checks every 5 minutes for breaches
4. Breached tickets are:
   - Marked with a **"SLA Breached"** badge
   - Trigger a notification to the assigned agent
   - Logged in the activity feed
5. Changing a ticket's priority automatically updates its SLA policy and due date

---

### Settings

The Settings page (Admin only) has four tabs:

1. **Organization** - Update org name and domain
2. **Team** - Invite members and view the team roster
3. **SLA Policies** - View SLA rules per priority
4. **JIRA Integration** - Configure JIRA connection

---

## API Documentation

Interactive Swagger documentation is available at:

```
http://localhost:3001/api/docs
```

This provides:
- All endpoints with request/response schemas
- Try-it-out functionality
- Bearer token authentication

To authenticate in Swagger:
1. Call `POST /api/v1/auth/login` with demo credentials
2. Copy the `accessToken` from the response
3. Click **"Authorize"** (top right) and paste: `Bearer <your-token>`

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/signup` | Register new organization + admin | No |
| POST | `/api/v1/auth/login` | Login | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/invite` | Invite user to org | Admin |
| POST | `/api/v1/auth/logout` | Logout (invalidate refresh token) | No |

### Tickets
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/tickets` | Create ticket | Any |
| GET | `/api/v1/tickets` | List tickets (with filters) | Any |
| GET | `/api/v1/tickets/my` | My assigned/created tickets | Any |
| GET | `/api/v1/tickets/:id` | Get ticket details | Any |
| PATCH | `/api/v1/tickets/:id` | Update ticket | Any |
| PATCH | `/api/v1/tickets/bulk/update` | Bulk update tickets | Admin/Agent |

### Comments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/tickets/:ticketId/comments` | Add comment | Any |
| PATCH | `/api/v1/tickets/:ticketId/comments/:commentId` | Edit comment | Author/Admin |
| DELETE | `/api/v1/tickets/:ticketId/comments/:commentId` | Delete comment | Author/Admin |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/users` | List org users | Admin/Agent |
| GET | `/api/v1/users/agents` | List agents (for dropdowns) | Any |
| GET | `/api/v1/users/me` | Get current user | Any |
| PATCH | `/api/v1/users/me` | Update profile | Any |
| PATCH | `/api/v1/users/:id/toggle-active` | Activate/deactivate | Admin |

### Organizations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/organizations/current` | Get org details | Any |
| PATCH | `/api/v1/organizations/current` | Update org | Admin |
| GET | `/api/v1/organizations/tags` | List org tags | Any |

### Analytics
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/analytics/dashboard` | Dashboard stats | Admin/Agent |
| GET | `/api/v1/analytics/volume?days=30` | Ticket volume by day | Admin/Agent |
| GET | `/api/v1/analytics/agent-performance` | All agents KPIs | Admin/Agent |
| GET | `/api/v1/analytics/agent/:agentId` | Single agent detailed KPI | Admin/Agent |
| GET | `/api/v1/analytics/by-priority` | Tickets by priority | Admin/Agent |
| GET | `/api/v1/analytics/by-status` | Tickets by status | Admin/Agent |

### JIRA
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/jira/config` | Get JIRA config | Admin |
| POST | `/api/v1/jira/config` | Save JIRA config | Admin |
| DELETE | `/api/v1/jira/config` | Remove JIRA config | Admin |
| POST | `/api/v1/jira/create-issue` | Create JIRA issue from ticket | Admin/Agent |
| GET | `/api/v1/jira/sync/:ticketId` | Sync JIRA status | Admin/Agent |

### Notifications
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/notifications` | List notifications | Any |
| GET | `/api/v1/notifications/unread-count` | Unread count | Any |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read | Any |
| PATCH | `/api/v1/notifications/read-all` | Mark all read | Any |

### Knowledge Base
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/knowledge-base/categories` | Create category | Admin/Agent |
| GET | `/api/v1/knowledge-base/categories` | List categories | Any |
| POST | `/api/v1/knowledge-base/articles` | Create article | Admin/Agent |
| GET | `/api/v1/knowledge-base/articles` | List articles | Any |
| GET | `/api/v1/knowledge-base/articles/:id` | Get article | Any |
| PATCH | `/api/v1/knowledge-base/articles/:id` | Update article | Admin/Agent |
| DELETE | `/api/v1/knowledge-base/articles/:id` | Delete article | Admin |

### SLA Policies
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/sla-policies` | List SLA policies | Any |
| PATCH | `/api/v1/sla-policies/:id` | Update SLA policy | Admin |

### Search
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/search/tickets?q=keyword` | Full-text search | Any |

### Attachments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/attachments/upload` | Upload file | Any |
| DELETE | `/api/v1/attachments/:id` | Delete attachment | Any |

---

## Database Schema

```
organizations ──┬── users ──┬── tickets ──┬── comments ──── attachments
                │           │             ├── ticket_tags ── tags
                │           │             ├── attachments
                │           │             └── activity_logs
                │           ├── refresh_tokens
                │           └── notifications
                ├── sla_policies ─── tickets
                ├── article_categories ── articles
                └── jira_configs
```

**13 tables** with proper foreign keys, indexes, and cascade deletes. Multi-tenant isolation is enforced via `organization_id` on all data tables.

---

## Project Structure

```
support-ticket-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   ├── seed.ts                # Demo data seeder
│   │   └── migrations/            # SQL migrations
│   ├── src/
│   │   ├── main.ts                # Entry point + Swagger setup
│   │   ├── app.module.ts          # Root module
│   │   ├── database/              # Prisma service
│   │   ├── common/                # Shared guards, decorators, DTOs
│   │   │   ├── guards/            # JWT + RBAC guards
│   │   │   ├── decorators/        # @CurrentUser, @Roles
│   │   │   ├── dto/               # Pagination DTO
│   │   │   └── filters/           # Global exception filter
│   │   └── modules/
│   │       ├── auth/              # JWT signup/login/refresh
│   │       ├── tickets/           # CRUD + bulk + SLA
│   │       ├── comments/          # Public + internal notes
│   │       ├── users/             # User management
│   │       ├── organizations/     # Tenant management
│   │       ├── notifications/     # In-app notifications
│   │       ├── sla/               # SLA policies + breach cron
│   │       ├── analytics/         # Dashboard + agent KPIs
│   │       ├── jira/              # JIRA integration
│   │       ├── knowledge-base/    # Articles + categories
│   │       ├── search/            # Full-text search
│   │       └── attachments/       # File upload
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   │   ├── login/             # Login page
│   │   │   ├── signup/            # Registration page
│   │   │   ├── dashboard/         # Main dashboard
│   │   │   ├── tickets/           # Ticket list + detail
│   │   │   ├── analytics/         # Analytics + agent KPI detail
│   │   │   ├── knowledge-base/    # KB articles
│   │   │   └── settings/          # Org, Team, SLA, JIRA settings
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar, Header, AppLayout
│   │   │   └── tickets/           # CreateTicketModal
│   │   ├── lib/
│   │   │   ├── api.ts             # Axios API client
│   │   │   └── utils.ts           # Formatting helpers
│   │   ├── stores/
│   │   │   └── auth.ts            # Zustand auth store
│   │   └── types/
│   │       └── index.ts           # TypeScript interfaces
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## Switching to PostgreSQL

For production, switch from SQLite to PostgreSQL:

### 1. Update `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Update `.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/support_tickets"
```

### 3. Re-run migrations

```bash
npx prisma migrate dev --name switch_to_postgres
npx prisma db seed
```

### 4. (Optional) Re-enable PostgreSQL features

In the service files, you can restore `mode: 'insensitive'` for case-insensitive search:

```typescript
{ title: { contains: query, mode: 'insensitive' } }
```

You can also switch `details` and `metadata` fields back to `Json` type in the schema.

---

## Deployment

### Backend (Railway / Render / AWS)

```bash
cd backend
npm run build
npm run start:prod
```

Environment variables to set:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong random string
- `JWT_REFRESH_SECRET` - Another strong random string
- `FRONTEND_URL` - Your frontend domain (for CORS)
- `PORT` - Usually auto-set by the platform

### Frontend (Vercel)

```bash
cd frontend
npm run build
```

Environment variables to set:
- `NEXT_PUBLIC_API_URL` - Your backend API URL (e.g., `https://api.yourdomain.com/api/v1`)

---

## Troubleshooting

### "npm is not recognized"

Node.js is not in your PATH. Install from [nodejs.org](https://nodejs.org) and restart your terminal.

### Backend won't start - "Cannot find module"

Run `npm install` and `npx prisma generate` in the `backend/` directory.

### "EPERM: operation not permitted" on Prisma generate

Another process is using the database file. Stop the running backend server, then re-run `npx prisma generate`.

### Login fails with "Organization not found"

Make sure you're using the correct org slug. For the demo, use `demo`. Check exact slug by looking at the seed output.

### JIRA integration returns "Could not connect"

- Verify your JIRA base URL includes `https://` and no trailing slash
- Ensure the API token is correct (not your password)
- The email must match your Atlassian account

### Tickets list is empty

Ensure the backend is running on port 3001 and the database has been seeded (`npx prisma db seed`).

### Dark mode not working

Click the sun/moon icon in the top-right header. The preference is stored in the browser.

---

## License

MIT

---

Built with NestJS, Next.js, Prisma, and Tailwind CSS.
