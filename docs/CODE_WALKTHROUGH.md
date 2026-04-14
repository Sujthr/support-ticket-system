# SupportDesk -- Code Walkthrough for New Developers

> **Version:** 1.0 | **Last updated:** 2026-04-14
>
> This document is the definitive technical walkthrough of the SupportDesk codebase.
> It covers every layer of the stack -- from database schema to Electron packaging --
> and is intended to bring a new developer from zero to productive in the shortest
> possible time.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Backend Deep Dive](#3-backend-deep-dive)
   - 3.1 [Entry Point & Bootstrap](#31-entry-point--bootstrap)
   - 3.2 [Database Layer](#32-database-layer)
   - 3.3 [Authentication & Authorization](#33-authentication--authorization)
   - 3.4 [Core Modules Walkthrough](#34-core-modules-walkthrough)
   - 3.5 [Integration Modules](#35-integration-modules)
   - 3.6 [Automation](#36-automation)
4. [Frontend Deep Dive](#4-frontend-deep-dive)
   - 4.1 [Next.js App Router Structure](#41-nextjs-app-router-structure)
   - 4.2 [API Client](#42-api-client)
   - 4.3 [State Management](#43-state-management)
   - 4.4 [Key Pages](#44-key-pages)
   - 4.5 [Styling](#45-styling)
5. [Desktop App Deep Dive](#5-desktop-app-deep-dive)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Environment & Configuration](#7-environment--configuration)
8. [Development Workflow](#8-development-workflow)
9. [API Reference Quick Table](#9-api-reference-quick-table)
10. [Glossary](#10-glossary)

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```
+-----------------------------------------------------------------------+
|                          CLIENTS                                      |
|                                                                       |
|   +-------------+   +--------------+   +---------------------------+  |
|   | Web Browser |   | Desktop App  |   | External Channels         |  |
|   | (Next.js)   |   | (Electron)   |   | (Twilio / Meta / Email)   |  |
|   +------+------+   +------+-------+   +------------+--------------+  |
|          |                 |                         |                 |
+----------|-----------------|-------------------------|----------------+
           |                 |                         |
           v                 v                         v
+-----------------------------------------------------------------------+
|                       NestJS API  (port 3001)                         |
|                                                                       |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  |  Auth    |  | Tickets|  | Channels |  |  Email  |  |  Analytics |  |
|  |  Module  |  | Module |  | Module   |  |  Module |  |  Module    |  |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  |  Users   |  |Comments|  |   SLA    |  |  JIRA   |  | Knowledge  |  |
|  |  Module  |  | Module |  | Module   |  |  Module |  | Base Module|  |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  |  Orgs    |  |Watchers|  |Priorities|  |Satisfac.|  |  Canned    |  |
|  |  Module  |  | Module |  | Module   |  |  Module |  | Responses  |  |
|  +----------+  +--------+  +----------+  +---------+  +------------+  |
|  +----------+  +--------+  +----------+  +----------------------------+
|  |  Search  |  |  Time  |  |Categories|  |   Notifications / Attach.  |
|  |  Module  |  |Tracking|  | Module   |  |   Modules                  |
|  +----------+  +--------+  +----------+  +----------------------------+
|                                                                       |
|                  Global: ThrottlerGuard, ScheduleModule               |
+----------------------------------+------------------------------------+
                                   |
                                   v
+----------------------------------+------------------------------------+
|                     Prisma ORM + Database                             |
|                                                                       |
|   Development: SQLite  (file:./dev.db)                                |
|   Production:  PostgreSQL                                             |
|   Desktop:     SQLite  (file:<userData>/data/supportdesk.db)          |
+-----------------------------------------------------------------------+
                                   |
              +--------------------+---------------------+
              |                    |                     |
              v                    v                     v
        +-----------+       +------------+       +-----------+
        | Meilisearch|       |  SMTP      |       | JIRA REST |
        | (optional) |       |  Server    |       | API       |
        +-----------+       +------------+       +-----------+
```

### 1.2 Tech Stack

| Layer        | Technology                | Version   | Purpose                                     |
|-------------|---------------------------|-----------|---------------------------------------------|
| **Backend**  | NestJS                    | 10.3      | REST API framework                          |
| **ORM**      | Prisma                    | 5.8       | Type-safe database access                   |
| **Database** | SQLite / PostgreSQL       | --        | Relational data store                       |
| **Auth**     | Passport + JWT            | 4.0 / 10.2| Token-based authentication                 |
| **Validation**| class-validator          | 0.14      | DTO validation with decorators              |
| **Rate Limit**| @nestjs/throttler        | 6.5       | Per-IP rate limiting                        |
| **Scheduling**| @nestjs/schedule         | 4.0       | Cron jobs (SLA, IMAP polling)               |
| **Email**    | Nodemailer                | 6.9       | SMTP outbound emails                        |
| **Search**   | Meilisearch (optional)    | 0.37      | Full-text search with DB fallback           |
| **Docs**     | @nestjs/swagger           | 7.2       | Auto-generated OpenAPI docs                 |
| **Security** | Helmet                    | 8.1       | HTTP security headers                       |
| **Frontend** | Next.js (App Router)      | 14.1      | React SSR/CSR framework                     |
| **Styling**  | Tailwind CSS              | 3.4       | Utility-first CSS                           |
| **State**    | Zustand                   | 4.4       | Client-side state management                |
| **HTTP**     | Axios                     | 1.6       | HTTP client with interceptors               |
| **Charts**   | Recharts                  | 2.10      | Analytics data visualization                |
| **Icons**    | Heroicons                 | 2.1       | SVG icon library                            |
| **Desktop**  | Electron                  | 28.1      | Cross-platform desktop wrapper              |
| **Packaging**| electron-builder          | 24.9      | NSIS/DMG/AppImage installers                |

### 1.3 Multi-Tenant Architecture

SupportDesk uses a **single-database, shared-schema** multi-tenant model.

**How it works:**

1. Every `Organization` row is a tenant. Users, tickets, SLA policies, and all
   other data belong to exactly one organization via an `organizationId` foreign key.

2. During signup, a new `Organization` + `User` (role=ADMIN) are created in a
   single transaction. The org gets default SLA policies automatically.

3. Users authenticate with `email + organizationSlug + password`. The same email
   can exist in different organizations (the unique constraint is
   `@@unique([email, organizationId])`).

4. The JWT payload contains `organizationId`. Every service-layer query filters
   by `organizationId` from the authenticated user, ensuring complete data isolation.

5. `END_USER` role users can only see their own tickets. `AGENT` and `ADMIN` users
   see all tickets within their organization.

**Tenant isolation guarantee:**

```
Request --> JwtAuthGuard --> Extracts { organizationId } from JWT
        --> Service Layer --> WHERE organizationId = user.organizationId
        --> Response (tenant-scoped data only)
```

### 1.4 Request Flow from Browser to Database

```
Browser                   NestJS                          Prisma            Database
  |                         |                               |                  |
  |-- POST /api/v1/tickets --->                             |                  |
  |                         |                               |                  |
  |                    [ThrottlerGuard]                      |                  |
  |                    [JwtAuthGuard]                        |                  |
  |                    [RolesGuard]                          |                  |
  |                    [ValidationPipe]                      |                  |
  |                         |                               |                  |
  |                   TicketsController.create()             |                  |
  |                         |                               |                  |
  |                   TicketsService.create()                |                  |
  |                         |-- prisma.ticket.create() ---->|                  |
  |                         |                               |-- INSERT INTO -->|
  |                         |                               |<-- Row data -----|
  |                         |<-- Ticket object -------------|                  |
  |                         |                               |                  |
  |                    [fire-and-forget emails]              |                  |
  |                    [create notification]                 |                  |
  |                         |                               |                  |
  |<-- 201 { ticket } -----|                               |                  |
```

---

## 2. Project Structure

```
support-ticket-system/
|
|-- backend/                          # NestJS API server
|   |-- prisma/
|   |   |-- schema.prisma             # Database schema (all 21 models)
|   |   |-- seed.ts                   # Demo data seeder
|   |   |-- dev.db                    # SQLite database (development)
|   |   +-- migrations/               # Prisma migration history
|   |
|   |-- src/
|   |   |-- main.ts                   # Application entry point (bootstrap)
|   |   |-- app.module.ts             # Root module -- registers all 20 modules
|   |   |
|   |   |-- common/                   # Shared utilities
|   |   |   |-- decorators/
|   |   |   |   |-- current-user.decorator.ts   # @CurrentUser() param decorator
|   |   |   |   +-- roles.decorator.ts          # @Roles() metadata decorator
|   |   |   |-- dto/
|   |   |   |   +-- pagination.dto.ts           # PaginationDto + PaginatedResponse
|   |   |   |-- filters/
|   |   |   |   +-- http-exception.filter.ts    # Global exception filter
|   |   |   |-- guards/
|   |   |   |   |-- jwt-auth.guard.ts           # JwtAuthGuard (passport wrapper)
|   |   |   |   +-- roles.guard.ts              # RolesGuard (RBAC check)
|   |   |   +-- interfaces/
|   |   |       +-- jwt-payload.interface.ts     # JwtPayload & AuthenticatedUser
|   |   |
|   |   |-- database/
|   |   |   |-- prisma.module.ts      # @Global PrismaModule
|   |   |   +-- prisma.service.ts     # PrismaService (lifecycle hooks)
|   |   |
|   |   +-- modules/                  # Feature modules (one folder each)
|   |       |-- auth/                 # Signup, login, refresh, invite, logout
|   |       |-- users/                # User CRUD, agent listing, profile
|   |       |-- organizations/        # Org settings, logo upload, tags
|   |       |-- tickets/              # CRUD, filters, bulk update, auto-assign
|   |       |-- comments/             # Ticket comments (public + internal notes)
|   |       |-- notifications/        # In-app notification system
|   |       |-- sla/                  # SLA policies + breach detection cron
|   |       |-- analytics/            # Dashboard stats, agent KPIs, charts
|   |       |-- knowledge-base/       # Article categories + articles
|   |       |-- search/               # Meilisearch + Prisma fallback
|   |       |-- attachments/          # File upload/download (disk storage)
|   |       |-- email/                # SMTP config, transactional email templates
|   |       |-- jira/                 # JIRA Cloud integration (REST API)
|   |       |-- channels/             # Inbound channels (IMAP, Twilio, Meta)
|   |       |-- categories/           # Ticket category CRUD + reorder
|   |       |-- priorities/           # Custom priority CRUD + defaults
|   |       |-- watchers/             # Ticket watcher management
|   |       |-- satisfaction/         # CSAT ratings (1-5 stars + feedback)
|   |       |-- time-tracking/        # Agent time logging per ticket
|   |       +-- canned-responses/     # Template replies with shortcuts
|   |
|   |-- .env                          # Environment variables (active)
|   |-- .env.example                  # Template with all supported variables
|   |-- package.json                  # Dependencies and scripts
|   |-- nest-cli.json                 # NestJS CLI configuration
|   +-- tsconfig.json                 # TypeScript configuration
|
|-- frontend/                         # Next.js 14 application
|   |-- src/
|   |   |-- app/                      # App Router pages
|   |   |   |-- layout.tsx            # Root layout (Inter font, Toaster)
|   |   |   |-- page.tsx              # Landing / redirect page
|   |   |   |-- login/page.tsx        # Login form
|   |   |   |-- signup/page.tsx       # Signup form (creates org)
|   |   |   |-- dashboard/page.tsx    # Dashboard with stat cards
|   |   |   |-- tickets/
|   |   |   |   |-- page.tsx          # Ticket list with filters
|   |   |   |   +-- [id]/
|   |   |   |       |-- page.tsx      # Ticket detail (server component)
|   |   |   |       +-- TicketDetailClient.tsx  # Client component
|   |   |   |-- analytics/
|   |   |   |   |-- page.tsx          # Analytics dashboard
|   |   |   |   +-- agents/[id]/
|   |   |   |       |-- page.tsx
|   |   |   |       +-- AgentKpiClient.tsx      # Agent KPI detail
|   |   |   |-- settings/page.tsx     # Org settings, email, JIRA, channels
|   |   |   +-- knowledge-base/page.tsx # KB articles browser
|   |   |
|   |   |-- components/
|   |   |   |-- common/
|   |   |   |   +-- BrandLogo.tsx     # Configurable brand logo component
|   |   |   |-- layout/
|   |   |   |   |-- AppLayout.tsx     # Authenticated layout wrapper
|   |   |   |   |-- Header.tsx        # Top navigation bar
|   |   |   |   |-- Sidebar.tsx       # Side navigation menu
|   |   |   |   +-- Footer.tsx        # Footer with copyright
|   |   |   +-- tickets/
|   |   |       +-- CreateTicketModal.tsx  # New ticket dialog
|   |   |
|   |   |-- lib/
|   |   |   |-- api.ts               # Axios client + all API endpoint groups
|   |   |   |-- branding.ts          # App name, colors, copyright config
|   |   |   +-- utils.ts             # Date helpers, color mappers
|   |   |
|   |   |-- stores/
|   |   |   +-- auth.ts              # Zustand auth store
|   |   |
|   |   +-- types/
|   |       +-- index.ts             # TypeScript interfaces for all entities
|   |
|   |-- public/                       # Static assets (favicon, images)
|   |-- next.config.js                # Next.js config (standalone output)
|   |-- tailwind.config.ts            # Tailwind CSS configuration
|   |-- postcss.config.js             # PostCSS with Tailwind plugin
|   |-- package.json                  # Dependencies and scripts
|   +-- tsconfig.json                 # TypeScript configuration
|
|-- desktop/                          # Electron desktop application
|   |-- main.js                       # Electron main process
|   |-- preload.js                    # Context bridge (exposes desktopApp)
|   |-- splash.html                   # Splash screen during startup
|   |-- package.json                  # Electron + builder config
|   |-- scripts/
|   |   +-- prepare-build.js          # Build orchestrator (backend + frontend)
|   |-- app-backend/                  # Copied backend build (for packaging)
|   +-- app-frontend/                 # Copied frontend build (for packaging)
|
|-- docs/                             # Documentation
|   |-- AWS_DEPLOYMENT_GUIDE.md
|   |-- BRANDING_GUIDE.md
|   |-- DESKTOP_BUILD_GUIDE.md
|   |-- JIRA_INTEGRATION_GUIDE.md
|   |-- PRODUCTION-DEPLOYMENT-GUIDE.md
|   +-- CODE_WALKTHROUGH.md           # This file
|
|-- LICENSE                           # MIT License
+-- README.md                         # Project overview
```

---

## 3. Backend Deep Dive

### 3.1 Entry Point & Bootstrap

**File:** `backend/src/main.ts`

The bootstrap function creates a NestJS application using Express as the HTTP adapter
and configures the following global settings:

```typescript
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
```

**Global Prefix:**

```typescript
app.setGlobalPrefix('api/v1');
```

All routes are prefixed with `/api/v1/`. For example, the `TicketsController` at
`@Controller('tickets')` becomes `/api/v1/tickets`.

**Helmet (Security Headers):**

```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
```

Sets headers like `X-Content-Type-Options`, `X-Frame-Options`, etc. CSP is disabled
at the backend level because the frontend handles its own CSP.

**Static File Serving:**

```typescript
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
```

Files in the `uploads/` directory (logos, attachments) are served at `/uploads/`.

**CORS:**

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

Only the configured frontend origin is allowed. Credentials (cookies) are enabled.

**Validation Pipe:**

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // Strip unknown properties
  forbidNonWhitelisted: true, // Throw on unknown properties
  transform: true,          // Auto-transform types (string -> number)
}));
```

Every incoming request body is validated against its DTO class using `class-validator`
decorators. Unknown fields are rejected with a `400 Bad Request`.

**Swagger (Non-Production):**

```typescript
if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('Support Ticket System API')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
```

The interactive API documentation is available at `http://localhost:3001/api/docs`
in development. It is hidden in production.

**App Module (`app.module.ts`):**

The root module registers:

- `ScheduleModule.forRoot()` -- enables cron jobs across the application
- `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` -- 100 requests per
  minute per IP, applied globally via `APP_GUARD`
- `PrismaModule` -- global database access (no need to import in each feature module)
- All 20 feature modules

The `ThrottlerGuard` is registered as a global guard:

```typescript
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },
],
```

This means every endpoint is rate-limited by default. Individual endpoints can
override the limit using `@Throttle()` (e.g., signup is limited to 5/minute).

---

### 3.2 Database Layer

#### 3.2.1 Prisma Schema Overview

**File:** `backend/prisma/schema.prisma`

The schema defines **21 models** across a SQLite database (PostgreSQL in production).

| Model               | Table Name         | Purpose                                              |
|---------------------|--------------------|------------------------------------------------------|
| `Organization`      | `organizations`    | Tenant container (name, slug, plan, auto-assign mode)|
| `User`              | `users`            | All users with role-based access                     |
| `RefreshToken`      | `refresh_tokens`   | JWT refresh token storage (rotation)                 |
| `TicketCategory`    | `ticket_categories`| Customizable ticket categories per org               |
| `CustomPriority`    | `custom_priorities`| Custom priority levels per org                       |
| `Ticket`            | `tickets`          | Core ticket entity with SLA tracking                 |
| `Comment`           | `comments`         | Ticket replies + internal notes                      |
| `Attachment`        | `attachments`      | File uploads on tickets and comments                 |
| `Tag`               | `tags`             | Reusable labels per org                              |
| `TicketTag`         | `ticket_tags`      | Many-to-many join (ticket-tag)                       |
| `TicketWatcher`     | `ticket_watchers`  | Users watching a ticket for updates                  |
| `SatisfactionRating`| `satisfaction_ratings` | 1-5 star CSAT rating per resolved ticket         |
| `TimeEntry`         | `time_entries`     | Agent time logs per ticket                           |
| `CannedResponse`    | `canned_responses` | Template replies with shortcuts                      |
| `SlaPolicy`         | `sla_policies`     | SLA rules per priority level                         |
| `ActivityLog`       | `activity_logs`    | Audit trail of all ticket actions                    |
| `Notification`      | `notifications`    | In-app notifications per user                        |
| `EmailConfig`       | `email_configs`    | SMTP settings + notification trigger toggles         |
| `ArticleCategory`   | `article_categories` | Knowledge base category                           |
| `Article`           | `articles`         | Knowledge base article                               |
| `JiraConfig`        | `jira_configs`     | JIRA Cloud connection settings                       |
| `ChannelConfig`     | `channel_configs`  | Inbound channel settings (IMAP, Twilio, Meta)        |
| `InboundMessage`    | `inbound_messages` | Raw log of all inbound channel messages              |

#### 3.2.2 Key Relationships

```
Organization 1---* User
Organization 1---* Ticket
Organization 1---* SlaPolicy
Organization 1---* Tag
Organization 1---* TicketCategory
Organization 1---* CustomPriority
Organization 1---* CannedResponse
Organization 1---* Notification
Organization 1---1 JiraConfig
Organization 1---1 EmailConfig
Organization 1---1 ChannelConfig
Organization 1---* Article
Organization 1---* ArticleCategory

User 1---* Ticket (as creator)
User 1---* Ticket (as assignee)
User 1---* Comment
User 1---* RefreshToken
User 1---* Notification
User 1---* TimeEntry
User 1---* SatisfactionRating
User 1---* CannedResponse
User *---* Ticket (via TicketWatcher)

Ticket 1---* Comment
Ticket 1---* Attachment
Ticket 1---* ActivityLog
Ticket 1---* TimeEntry
Ticket 1---1 SatisfactionRating
Ticket *---* Tag (via TicketTag)
Ticket *---* User (via TicketWatcher)
Ticket *---1 SlaPolicy
Ticket *---1 TicketCategory

Comment 1---* Attachment
Article *---1 ArticleCategory
```

#### 3.2.3 Tenant Scoping

Every tenant-scoped model has:

```prisma
organizationId String @map("organization_id")
```

With a corresponding relation to `Organization` and `@@index([organizationId])`.

The compound unique constraint `@@unique([email, organizationId])` on `User` allows
the same email address to exist in different organizations.

#### 3.2.4 Ticket Model (In Detail)

The `Ticket` model is the most complex in the schema:

- **ticketNumber** -- Sequential integer per organization (compound unique with `organizationId`)
- **status** -- One of `OPEN`, `PENDING`, `RESOLVED`, `CLOSED`
- **priority** -- String value (typically `LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- **source** -- Where the ticket originated: `WEB`, `EMAIL`, `API`, `PHONE`, `WHATSAPP`, `EMAIL_INBOUND`
- **channelMessageId** -- External ID (Twilio SID, email Message-ID) for channel deduplication
- **callerInfo** -- Phone number or WhatsApp ID of the original sender
- **slaBreached** -- Boolean flag, set by the SLA cron job
- **dueAt** -- Calculated from the SLA policy's `resolutionMinutes`
- **firstResponseAt** -- Timestamp of the first non-internal agent reply
- **totalTimeMinutes** -- Denormalized sum of all time entries
- **jiraIssueKey/Url/Status** -- JIRA integration data

Performance indexes: `status`, `priority`, `assigneeId`, `creatorId`, `categoryId`,
`createdAt`, and compound indexes on `(organizationId, status)` and
`(organizationId, assigneeId)`.

#### 3.2.5 PrismaService and PrismaModule

**File:** `backend/src/database/prisma.service.ts`

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

The service extends `PrismaClient` directly and manages the database connection
lifecycle through NestJS hooks.

**File:** `backend/src/database/prisma.module.ts`

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

The `@Global()` decorator means `PrismaService` is available in every module without
explicitly importing `PrismaModule`.

#### 3.2.6 Migration Workflow

```bash
# Create a new migration after editing schema.prisma
cd backend
npx prisma migrate dev --name describe_your_change

# Generate the Prisma client (needed after any schema change)
npx prisma generate

# Seed the database with demo data
npx ts-node prisma/seed.ts

# Reset the database (drops all data, re-applies migrations, runs seed)
npx prisma migrate reset
```

The seed script creates:
- A "Demo Company" organization (slug: `demo`, plan: `PRO`)
- Default SLA policies for all four priority levels
- Three users: `admin@demo.com`, `agent@demo.com`, `user@demo.com` (password: `password123`)
- Sample tickets, comments, tags, and a knowledge base article

---

### 3.3 Authentication & Authorization

#### 3.3.1 Signup Flow

```
POST /api/v1/auth/signup
Body: { email, password, firstName, lastName, organizationName, organizationSlug? }
Rate limit: 5 requests/minute
```

**Step-by-step:**

1. Generate slug from `organizationName` if `organizationSlug` not provided
2. Check that the slug is unique across all organizations
3. Open a Prisma transaction:
   a. Create `Organization` with name and slug
   b. Hash password with bcrypt (12 rounds)
   c. Create `User` with role `ADMIN`
   d. Create four default `SlaPolicy` records (Urgent/High/Medium/Low)
4. Generate JWT access token (15m expiry) and refresh token (7d expiry, stored in DB)
5. Return sanitized user (no passwordHash), organization, and both tokens

#### 3.3.2 Login Flow

```
POST /api/v1/auth/login
Body: { email, password, organizationSlug }
Rate limit: 10 requests/minute
```

**Step-by-step:**

1. Find organization by slug (404 if not found)
2. Find user by compound key `(email, organizationId)` (401 if not found or inactive)
3. Compare password with bcrypt (401 if mismatch)
4. Update `lastLoginAt` timestamp
5. Generate token pair and return

#### 3.3.3 JWT Strategy

**File:** `backend/src/modules/auth/jwt.strategy.ts`

The strategy extracts the bearer token from the `Authorization` header and validates
it against the `JWT_SECRET`. On success, it loads the full user from the database
to verify the account is still active.

**JWT Payload structure:**

```typescript
interface JwtPayload {
  sub: string;           // userId
  email: string;
  role: string;          // ADMIN | AGENT | END_USER
  organizationId: string;
}
```

**AuthenticatedUser (attached to `request.user`):**

```typescript
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}
```

#### 3.3.4 Token Refresh Mechanism

```
POST /api/v1/auth/refresh
Body: { refreshToken }
```

1. Look up the refresh token in the `refresh_tokens` table
2. If not found or expired, throw `401 Unauthorized`
3. **Delete the old token** (rotation -- each refresh token is single-use)
4. Generate a new access + refresh token pair
5. Store the new refresh token in the database
6. Return both tokens

This implements **refresh token rotation**: once a token is used, it cannot be
used again. If an attacker steals a refresh token and uses it after the legitimate
user, the legitimate user's next refresh will fail, signaling a compromise.

#### 3.3.5 Guards

**JwtAuthGuard** (`backend/src/common/guards/jwt-auth.guard.ts`):

A thin wrapper around Passport's `AuthGuard('jwt')`. When applied, it:
1. Extracts the bearer token
2. Validates it using `JwtStrategy`
3. Attaches the user to `request.user`
4. Returns 401 if validation fails

**RolesGuard** (`backend/src/common/guards/roles.guard.ts`):

Reads the `roles` metadata set by the `@Roles()` decorator and checks if
`request.user.role` is in the allowed list. If no roles are specified, access is
granted (open to all authenticated users).

**Usage pattern:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT')
```

Important: `JwtAuthGuard` must come before `RolesGuard` because the latter depends
on `request.user` being populated.

#### 3.3.6 Decorators

**@CurrentUser()** -- Extracts the authenticated user from the request:

```typescript
@CurrentUser() user: AuthenticatedUser        // Full user object
@CurrentUser('id') userId: string             // Just the user ID
@CurrentUser('organizationId') orgId: string  // Just the org ID
```

**@Roles()** -- Sets metadata for `RolesGuard`:

```typescript
@Roles('ADMIN')            // Admin only
@Roles('ADMIN', 'AGENT')   // Admin or Agent
@Roles('END_USER')         // End User only (rare -- used for CSAT)
```

#### 3.3.7 Role Hierarchy

| Role       | Description                           | Permissions                                    |
|-----------|---------------------------------------|------------------------------------------------|
| `ADMIN`    | Organization administrator             | Full access. Can manage users, settings, SLAs. |
| `AGENT`    | Support agent                          | Can manage tickets, comments, time tracking.   |
| `END_USER` | Customer                               | Can create tickets, add comments, submit CSAT. |

Note: The hierarchy is **not implicit**. An `ADMIN` is not automatically granted
`AGENT` permissions -- you must list both in `@Roles()` decorators.

---

### 3.4 Core Modules Walkthrough

Each module follows the NestJS convention of:
- `*.module.ts` -- Declares the module's controllers, services, and imports
- `*.controller.ts` -- HTTP endpoint definitions
- `*.service.ts` -- Business logic
- `dto/*.dto.ts` -- Request/response validation schemas (where applicable)

---

#### 3.4.1 Auth Module

**Directory:** `backend/src/modules/auth/`

**Module configuration:**
- Imports `PassportModule` (default strategy: `jwt`) and `JwtModule` (secret from env,
  default expiry: 15 minutes)
- Exports `AuthService` and `JwtModule` for use in other modules

| Verb | Route                | Auth       | Description                          |
|------|----------------------|------------|--------------------------------------|
| POST | `/auth/signup`       | Public     | Register org + admin user            |
| POST | `/auth/login`        | Public     | Authenticate with credentials        |
| POST | `/auth/refresh`      | Public     | Rotate refresh token                 |
| POST | `/auth/invite`       | JWT+ADMIN  | Create a user in the current org     |
| POST | `/auth/logout`       | Public     | Invalidate refresh token             |

**Key design decisions:**
- Signup creates the entire organization. There is no separate org creation flow.
- Invite generates a temporary password. In production, this should trigger an
  email with a password-reset link.
- Auth endpoints have tighter rate limits than the global default.

---

#### 3.4.2 Users Module

**Directory:** `backend/src/modules/users/`

| Verb  | Route                     | Auth              | Description                      |
|-------|---------------------------|-------------------|----------------------------------|
| GET   | `/users`                  | JWT + ADMIN/AGENT | List users with pagination/role  |
| GET   | `/users/agents`           | JWT               | List agents (for dropdowns)      |
| GET   | `/users/me`               | JWT               | Get current user profile         |
| GET   | `/users/:id`              | JWT + ADMIN/AGENT | Get user by ID                   |
| PATCH | `/users/me`               | JWT               | Update own firstName/lastName    |
| PATCH | `/users/:id/toggle-active`| JWT + ADMIN       | Activate/deactivate a user       |

**Key design decisions:**
- The `getAgents` endpoint returns only active ADMINs and AGENTs, used to populate
  the ticket assignment dropdown.
- User passwords are never exposed (the `sanitizeUser` method strips `passwordHash`).
- `toggle-active` is a simple boolean flip -- deactivated users cannot log in.

---

#### 3.4.3 Organizations Module

**Directory:** `backend/src/modules/organizations/`

| Verb  | Route                     | Auth         | Description                      |
|-------|---------------------------|--------------|----------------------------------|
| GET   | `/organizations/current`  | JWT          | Get current org with user/ticket counts |
| PATCH | `/organizations/current`  | JWT + ADMIN  | Update org name, domain, logo URL, autoAssignMode |
| POST  | `/organizations/logo`     | JWT + ADMIN  | Upload org logo (multipart, max 2MB) |
| GET   | `/organizations/tags`     | JWT          | List all tags in the organization |

**Key design decisions:**
- Logo files are stored on disk in `uploads/logos/` with UUID filenames. The old
  logo file is deleted when a new one is uploaded.
- The `autoAssignMode` field (`MANUAL`, `ROUND_ROBIN`, `LOAD_BALANCED`) is set here
  and used by the ticket creation flow.
- Allowed image types: PNG, JPEG, GIF, SVG, WebP.

---

#### 3.4.4 Tickets Module

**Directory:** `backend/src/modules/tickets/`

| Verb  | Route                  | Auth              | Description                     |
|-------|------------------------|-------------------|---------------------------------|
| POST  | `/tickets`             | JWT               | Create a new ticket             |
| GET   | `/tickets`             | JWT               | List tickets with filters       |
| GET   | `/tickets/my`          | JWT               | My assigned (agent) or created (user) tickets |
| GET   | `/tickets/:id`         | JWT               | Full ticket detail with all relations |
| PATCH | `/tickets/:id`         | JWT               | Update ticket fields            |
| PATCH | `/tickets/bulk/update` | JWT + ADMIN/AGENT | Bulk update multiple tickets    |

**Ticket creation flow:**

1. Get the next sequential `ticketNumber` for the organization
2. Look up the matching `SlaPolicy` by priority
3. Calculate `dueAt` from the SLA's `resolutionMinutes`
4. If no `assigneeId` specified, run auto-assignment (see 3.6.3)
5. Create the ticket with all relations
6. Sync tags (upsert tags, create join records)
7. Log activity (`TICKET_CREATED`)
8. Fire-and-forget email to creator and assignee
9. Create in-app notifications for creator and assignee

**Filtering (TicketFilterDto):**

Extends `PaginationDto` with: `status`, `priority`, `assigneeId`, `categoryId`,
`search` (title/description contains), `tag`, `slaBreached`.

End users (`END_USER` role) automatically have `creatorId = user.id` applied to
all queries -- they can only see their own tickets.

**Ticket update flow:**

The update method tracks every field change, recording old and new values in the
activity log. It handles:
- Priority change: re-assigns the SLA policy and recalculates `dueAt`
- Status change: sets `resolvedAt`/`closedAt` timestamps, sends status-change
  emails, notifies the creator and all watchers
- Assignee change: sends assignment email and in-app notification
- Ticket resolved: sends a special "resolved" email to the creator

---

#### 3.4.5 Comments Module

**Directory:** `backend/src/modules/comments/`

| Verb   | Route                                    | Auth | Description              |
|--------|------------------------------------------|------|--------------------------|
| POST   | `/tickets/:ticketId/comments`            | JWT  | Add comment to ticket    |
| PATCH  | `/tickets/:ticketId/comments/:commentId` | JWT  | Edit a comment           |
| DELETE | `/tickets/:ticketId/comments/:commentId` | JWT  | Delete a comment         |

**Key behaviors:**

- **Internal notes:** Only ADMINs and AGENTs can create comments with `isInternal: true`.
  END_USERs never see internal notes (filtered in `TicketsService.findOne`).
- **First response tracking:** When an agent adds the first non-internal comment,
  `ticket.firstResponseAt` is set. This is used for SLA first-response metrics.
- **Notification recipients:** On a public comment, emails and in-app notifications
  are sent to the ticket creator, assignee, and all watchers (excluding the comment
  author).
- **Ownership:** Users can only edit/delete their own comments. ADMINs can edit/delete
  any comment.

---

#### 3.4.6 Notifications Module

**Directory:** `backend/src/modules/notifications/`

| Verb  | Route                       | Auth | Description                    |
|-------|-----------------------------|------|--------------------------------|
| GET   | `/notifications`            | JWT  | List notifications (paginated, filterable by unread) |
| GET   | `/notifications/unread-count`| JWT | Get unread count               |
| PATCH | `/notifications/:id/read`   | JWT  | Mark one as read               |
| PATCH | `/notifications/read-all`   | JWT  | Mark all as read               |

Notifications are created throughout the system (ticket creation, assignment,
status changes, comments, SLA breaches). They are purely in-app -- email
notifications are handled separately by the Email module.

---

#### 3.4.7 SLA Module

**Directory:** `backend/src/modules/sla/`

| Verb  | Route                | Auth         | Description              |
|-------|----------------------|--------------|--------------------------|
| GET   | `/sla-policies`      | JWT          | List SLA policies        |
| PATCH | `/sla-policies/:id`  | JWT + ADMIN  | Update policy times      |

The module has a **cron job** for breach detection -- see Section 3.6.1.

Default SLA policies are created during organization signup:

| Priority | First Response | Resolution |
|----------|---------------|------------|
| URGENT   | 30 min        | 4 hours    |
| HIGH     | 1 hour        | 8 hours    |
| MEDIUM   | 4 hours       | 24 hours   |
| LOW      | 8 hours       | 48 hours   |

---

#### 3.4.8 Analytics Module

**Directory:** `backend/src/modules/analytics/`

| Verb | Route                          | Auth              | Description                    |
|------|--------------------------------|-------------------|--------------------------------|
| GET  | `/analytics/dashboard`         | JWT + ADMIN/AGENT | Summary stats (total, open, resolved, breached) |
| GET  | `/analytics/volume`            | JWT + ADMIN/AGENT | Ticket volume by day (default 30 days) |
| GET  | `/analytics/agent-performance` | JWT + ADMIN/AGENT | All agents with KPIs           |
| GET  | `/analytics/by-priority`       | JWT + ADMIN/AGENT | Ticket count grouped by priority |
| GET  | `/analytics/by-status`         | JWT + ADMIN/AGENT | Ticket count grouped by status |
| GET  | `/analytics/agent/:agentId`    | JWT + ADMIN/AGENT | Detailed KPI for a single agent |

**Agent performance metrics:**
- Total assigned, open tickets, resolved count
- Average resolution time (hours)
- Average first response time (hours)
- SLA compliance rate (%)
- Resolution rate (%)
- Priority breakdown
- Weekly resolved chart (last 12 weeks)

---

#### 3.4.9 Knowledge Base Module

**Directory:** `backend/src/modules/knowledge-base/`

| Verb   | Route                            | Auth              | Description            |
|--------|----------------------------------|-------------------|------------------------|
| POST   | `/knowledge-base/categories`     | JWT + ADMIN/AGENT | Create category        |
| GET    | `/knowledge-base/categories`     | JWT               | List categories        |
| POST   | `/knowledge-base/articles`       | JWT + ADMIN/AGENT | Create article         |
| GET    | `/knowledge-base/articles`       | JWT               | List articles (paginated, filtered) |
| GET    | `/knowledge-base/articles/:id`   | JWT               | Get single article     |
| PATCH  | `/knowledge-base/articles/:id`   | JWT + ADMIN/AGENT | Update article         |
| DELETE | `/knowledge-base/articles/:id`   | JWT + ADMIN       | Delete article         |

Articles have a `slug` field auto-generated from the title and an `isPublished`
boolean. Filtering supports `categoryId`, `search` (title/content), and `publishedOnly`.

---

#### 3.4.10 Search Module

**Directory:** `backend/src/modules/search/`

| Verb | Route              | Auth | Description                    |
|------|--------------------|------|--------------------------------|
| GET  | `/search/tickets`  | JWT  | Full-text search tickets       |

**Dual-mode search:**

1. **Meilisearch** (preferred) -- If the `MEILI_HOST` environment variable is set
   and the server is reachable, searches use the Meilisearch index with
   `organizationId` filter.
2. **Database fallback** -- If Meilisearch is unavailable, falls back to Prisma
   `contains` queries on `title` and `description`.

The search service initializes Meilisearch in the constructor. If the connection
fails, it logs a warning and falls back silently.

---

#### 3.4.11 Attachments Module

**Directory:** `backend/src/modules/attachments/`

| Verb   | Route                  | Auth | Description              |
|--------|------------------------|------|--------------------------|
| POST   | `/attachments/upload`  | JWT  | Upload file (max 10MB)   |
| DELETE | `/attachments/:id`     | JWT  | Delete attachment         |

**Allowed MIME types:** PNG, JPEG, GIF, WebP, SVG, PDF, Word, Excel, plain text,
CSV, ZIP.

Files are stored on disk at `uploads/attachments/` with UUID-based filenames to
prevent path traversal attacks. The upload can be associated with either a `ticketId`
or a `commentId` via query parameters.

---

#### 3.4.12 Categories Module

**Directory:** `backend/src/modules/categories/`

| Verb   | Route                   | Auth         | Description                |
|--------|-------------------------|--------------|----------------------------|
| POST   | `/categories`           | JWT + ADMIN  | Create ticket category     |
| GET    | `/categories`           | JWT          | List all categories        |
| PATCH  | `/categories/reorder`   | JWT + ADMIN  | Reorder categories         |
| PATCH  | `/categories/:id`       | JWT + ADMIN  | Update category            |
| DELETE | `/categories/:id`       | JWT + ADMIN  | Delete category            |

Categories have a `sortOrder` field for drag-and-drop reordering. The `reorder`
endpoint accepts an array of IDs and assigns sequential `sortOrder` values in a
transaction. Category names are unique within an organization.

---

#### 3.4.13 Priorities Module

**Directory:** `backend/src/modules/priorities/`

| Verb   | Route              | Auth         | Description                |
|--------|--------------------|--------------|----------------------------|
| POST   | `/priorities`      | JWT + ADMIN  | Create custom priority     |
| GET    | `/priorities`      | JWT          | List all custom priorities |
| PATCH  | `/priorities/:id`  | JWT + ADMIN  | Update priority            |
| DELETE | `/priorities/:id`  | JWT + ADMIN  | Delete priority            |

Priorities have both a `name` and a numeric `level` (1=lowest, higher=more urgent).
Both are unique within an organization. A `seedDefaults` method creates the
standard four priorities if none exist.

---

#### 3.4.14 Watchers Module

**Directory:** `backend/src/modules/watchers/`

| Verb   | Route                                   | Auth              | Description                 |
|--------|-----------------------------------------|-------------------|-----------------------------|
| POST   | `/tickets/:ticketId/watchers`           | JWT + ADMIN/AGENT | Add a user as watcher       |
| DELETE | `/tickets/:ticketId/watchers/:userId`   | JWT + ADMIN/AGENT | Remove a watcher            |
| GET    | `/tickets/:ticketId/watchers`           | JWT               | List all watchers           |
| POST   | `/tickets/:ticketId/watchers/me`        | JWT               | Watch ticket (self)         |
| DELETE | `/tickets/:ticketId/watchers/me`        | JWT               | Unwatch ticket (self)       |

Watchers receive in-app notifications and emails on status changes and new comments.
The system avoids duplicate notifications by checking `userId !== comment.authorId`
and `userId !== ticket.creatorId`.

---

#### 3.4.15 Satisfaction Module

**Directory:** `backend/src/modules/satisfaction/`

| Verb | Route                              | Auth              | Description                    |
|------|------------------------------------|-------------------|--------------------------------|
| POST | `/satisfaction/tickets/:ticketId`  | JWT + END_USER    | Submit 1-5 star rating         |
| GET  | `/satisfaction/tickets/:ticketId`  | JWT               | Get rating for a ticket        |
| GET  | `/satisfaction/agents/:agentId`    | JWT + ADMIN/AGENT | Agent average CSAT             |
| GET  | `/satisfaction/overview`           | JWT + ADMIN/AGENT | Org-wide CSAT with distribution|

**Rules:**
- Only the ticket **creator** can submit a rating
- The ticket must be in `RESOLVED` or `CLOSED` status
- Ratings are one-per-ticket (conflict error if already rated)
- The overview endpoint returns the distribution (count per star level)

---

#### 3.4.16 Time Tracking Module

**Directory:** `backend/src/modules/time-tracking/`

| Verb   | Route                               | Auth              | Description              |
|--------|-------------------------------------|-------------------|--------------------------|
| POST   | `/tickets/:ticketId/time`           | JWT + ADMIN/AGENT | Log time entry           |
| GET    | `/tickets/:ticketId/time`           | JWT               | List time entries        |
| DELETE | `/tickets/:ticketId/time/:entryId`  | JWT               | Delete time entry        |

Time entries store `minutes` and an optional `description`. When an entry is
created, the ticket's `totalTimeMinutes` is incremented. When deleted, it is
decremented. Only the entry author or an ADMIN can delete an entry.

---

#### 3.4.17 Canned Responses Module

**Directory:** `backend/src/modules/canned-responses/`

| Verb   | Route                     | Auth              | Description              |
|--------|---------------------------|-------------------|--------------------------|
| POST   | `/canned-responses`       | JWT + ADMIN/AGENT | Create canned response   |
| GET    | `/canned-responses`       | JWT               | List available responses |
| PATCH  | `/canned-responses/:id`   | JWT + ADMIN/AGENT | Update response          |
| DELETE | `/canned-responses/:id`   | JWT + ADMIN/AGENT | Delete response          |

Canned responses have:
- **shortcut** -- e.g., `/thanks`, `/refund` -- used for quick insertion
- **isShared** -- If true, visible to all users in the org. If false, only the author.
- **categoryTag** -- Optional grouping tag for filtering

The `findAll` query returns shared responses + the current user's personal responses.

---

### 3.5 Integration Modules

#### 3.5.1 Email Module

**Directory:** `backend/src/modules/email/`

The Email module provides two capabilities:

**A. SMTP Configuration (EmailController):**

| Verb | Route                 | Auth         | Description                   |
|------|-----------------------|--------------|-------------------------------|
| GET  | `/email-config/config`| JWT + ADMIN  | Get config (password masked)  |
| POST | `/email-config/config`| JWT + ADMIN  | Save/update SMTP config       |
| POST | `/email-config/test`  | JWT + ADMIN  | Send test email to self       |

The config is stored per-organization in the `email_configs` table. It includes
SMTP credentials and **six trigger toggles**:

| Toggle              | Default | Triggers on                    |
|---------------------|---------|--------------------------------|
| `onTicketCreated`   | true    | New ticket created             |
| `onTicketAssigned`  | true    | Ticket assigned/reassigned     |
| `onStatusChanged`   | true    | Status transition              |
| `onNewComment`      | true    | Public reply added             |
| `onSlaBreach`       | true    | SLA deadline exceeded          |
| `onTicketResolved`  | true    | Ticket marked as resolved      |

**B. Transactional Emails (EmailService):**

The service creates a nodemailer transporter per request using the org's SMTP config.
It provides six methods:

1. `sendTicketCreatedEmail(ticket, creator)` -- Confirmation to the ticket creator
2. `sendTicketAssignedEmail(ticket, assignee)` -- Notification to the assigned agent
3. `sendTicketStatusChangedEmail(ticket, oldStatus, newStatus)` -- Status change to creator
4. `sendNewCommentEmail(ticket, comment, recipients[])` -- New reply to all stakeholders
5. `sendSlaBreachEmail(ticket, assignee)` -- Urgent SLA alert to the agent
6. `sendTicketResolvedEmail(ticket, creator)` -- Resolution confirmation

All emails use a consistent HTML template with a branded header, body table, and footer.
HTML content is escaped using `escapeHtml()` to prevent XSS in email clients.

All email sends are **fire-and-forget** (`.catch(() => {})`) to avoid blocking
the main request.

---

#### 3.5.2 Channels Module

**Directory:** `backend/src/modules/channels/`

The Channels module is the largest integration module. It handles three inbound
channel types: **IMAP email**, **Twilio (Voice + WhatsApp)**, and **Meta WhatsApp
Cloud API**.

**Module structure:**
- `channels.controller.ts` -- Defines TWO controllers:
  - `ChannelsConfigController` -- Admin config endpoints (JWT-protected)
  - `WebhooksController` -- Webhook endpoints (no auth -- validated by provider)
- `channels.service.ts` -- Core ticket creation from any channel
- `twilio.service.ts` -- Twilio voice/WhatsApp handling
- `meta-whatsapp.service.ts` -- Meta WhatsApp Cloud API handling
- `inbound-email.service.ts` -- IMAP polling via raw sockets

**Admin config endpoints:**

| Verb   | Route                 | Auth         | Description                    |
|--------|-----------------------|--------------|--------------------------------|
| GET    | `/channels/config`    | JWT + ADMIN  | Get channel config (masked)    |
| POST   | `/channels/config`    | JWT + ADMIN  | Save/update all channel settings|
| DELETE | `/channels/config`    | JWT + ADMIN  | Remove channel configuration   |
| POST   | `/channels/test-imap` | JWT + ADMIN  | Test IMAP connection           |
| GET    | `/channels/messages`  | JWT + ADMIN  | View inbound message log       |

**Webhook endpoints (public):**

| Verb | Route                        | Provider   | Description                    |
|------|------------------------------|------------|--------------------------------|
| POST | `/webhooks/twilio/voice`     | Twilio     | Incoming voice call            |
| POST | `/webhooks/twilio/voice/status` | Twilio  | Call status callback           |
| POST | `/webhooks/twilio/whatsapp`  | Twilio     | WhatsApp message via Twilio    |
| GET  | `/webhooks/meta/whatsapp`    | Meta       | Webhook verification (challenge)|
| POST | `/webhooks/meta/whatsapp`    | Meta       | Incoming WhatsApp message      |

**ChannelsService -- Core ticket creation:**

The `createTicketFromChannel()` method is the central entry point for all channels.
It implements:

1. **Deduplication** -- If the same sender sent a message via the same channel within
   `deduplicateMinutes` (default: 30), the message is added as a comment to the
   existing ticket rather than creating a new one. This prevents duplicate tickets
   from rapid-fire messages.

2. **Title/Description generation** -- Each channel type gets a tailored title format:
   - PHONE: "Phone call from +1234567890"
   - WHATSAPP: "WhatsApp: <first 60 chars of message>..."
   - EMAIL_INBOUND: Uses the email subject

3. **Auto-assignment** -- Same logic as the ticket module (MANUAL, ROUND_ROBIN,
   LOAD_BALANCED)

4. **SLA policy** -- Inbound channel tickets default to MEDIUM priority

5. **Inbound message logging** -- Every message is logged in `inbound_messages`
   with the full raw payload for debugging

6. **Ticket reopening** -- If a follow-up message arrives for a RESOLVED/CLOSED
   ticket, the ticket is reopened to OPEN status

**Inbound Email (IMAP Polling):**

The `InboundEmailService` uses a lightweight IMAP client built on raw `net`/`tls`
sockets (no external IMAP dependency). It:

1. Runs as a cron job every minute (`@Cron(CronExpression.EVERY_MINUTE)`)
2. Iterates over all `ChannelConfig` records where `imapEnabled = true`
3. For each, connects to the IMAP server, authenticates, selects INBOX
4. Searches for UNSEEN messages (limited to 10 per poll)
5. Fetches headers (From, Subject, Date, Message-ID) and body text
6. Marks each processed email as `\Seen`
7. Calls `createTicketFromChannel()` for each new email (deduplicates by Message-ID)

**Twilio Service:**

- `handleIncomingCall()` -- Creates a PHONE ticket and returns TwiML XML response.
  If call recording is enabled, the TwiML includes `<Record>` with transcription.
- `handleCallStatus()` -- Processes recording URLs and transcription text, adding
  them as internal comments on the existing ticket.
- `handleWhatsAppMessage()` -- Creates a WHATSAPP ticket from Twilio-format messages.
  Extracts media URLs from `MediaUrl0..N` parameters.
- `validateSignature()` -- Implements Twilio's HMAC-SHA1 signature validation for
  webhook authenticity.

**Meta WhatsApp Service:**

- `handleWebhook()` -- Processes the Meta webhook payload structure
  (`whatsapp_business_account > entry > changes > value > messages`). Routes
  messages to the correct organization by matching `phone_number_id`.
- `sendMessage()` -- Sends messages via the Meta Cloud API (`graph.facebook.com/v18.0`).
  Used for auto-replies.
- `verifyWebhook()` -- Handles the GET webhook verification handshake (hub.mode,
  hub.verify_token, hub.challenge).
- Supports text, image, document, audio, video, and location message types.

---

#### 3.5.3 JIRA Module

**Directory:** `backend/src/modules/jira/`

| Verb   | Route                  | Auth              | Description                    |
|--------|------------------------|-------------------|--------------------------------|
| GET    | `/jira/config`         | JWT + ADMIN       | Get config (API token masked)  |
| POST   | `/jira/config`         | JWT + ADMIN       | Save config (tests connection) |
| DELETE | `/jira/config`         | JWT + ADMIN       | Remove config                  |
| POST   | `/jira/create-issue`   | JWT + ADMIN/AGENT | Create JIRA issue from ticket  |
| GET    | `/jira/sync/:ticketId` | JWT + ADMIN/AGENT | Sync JIRA status back          |

**Connection validation:**

When saving config, the service calls JIRA's `/rest/api/2/myself` endpoint to
verify credentials before persisting.

**Issue creation flow:**

1. Load JIRA config for the organization
2. Load the support ticket with creator info and tags
3. Map support priority to JIRA priority (URGENT->Highest, HIGH->High, etc.)
4. Build a JIRA description with ticket details in JIRA wiki markup
5. Call `POST /rest/api/2/issue` with the payload
6. Store `jiraIssueKey` and `jiraIssueUrl` on the ticket record
7. Log the `JIRA_ISSUE_CREATED` activity

**Status sync:**

Calls `GET /rest/api/2/issue/{key}?fields=status` and updates the ticket's
`jiraStatus` field. This is a pull model -- triggered manually or periodically.

---

### 3.6 Automation

#### 3.6.1 SLA Breach Detection (Cron Job)

**File:** `backend/src/modules/sla/sla.service.ts`

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async checkSlaBreaches() { ... }
```

Every 5 minutes, the service:

1. Queries all tickets where `slaBreached = false`, `dueAt < now`, and status is
   `OPEN` or `PENDING`
2. For each breached ticket:
   - Sets `slaBreached = true`
   - Creates in-app notification for the assignee
   - Sends SLA breach email to the assignee
   - Notifies all org ADMINs (excluding the assignee to avoid duplicates)
   - Logs `SLA_BREACHED` activity

#### 3.6.2 IMAP Email Polling (Cron Job)

**File:** `backend/src/modules/channels/inbound-email.service.ts`

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async pollAllMailboxes() { ... }
```

Every minute, polls all IMAP-enabled organizations for new emails.
A `processing` flag prevents overlapping polls if the previous run is still active.
See Section 3.5.2 for details.

#### 3.6.3 Auto-Assignment Strategies

Implemented in both `TicketsService` and `ChannelsService`:

| Mode           | Algorithm                                              |
|---------------|--------------------------------------------------------|
| `MANUAL`       | No auto-assignment. Ticket is unassigned.              |
| `ROUND_ROBIN`  | Assigns to the next agent after the last-assigned one. |
| `LOAD_BALANCED`| Assigns to the agent with the fewest open/pending tickets. |

The algorithm considers only active agents who have `isAvailableForAssign = true`.

#### 3.6.4 Email Notification Triggers

Transactional emails are triggered at these points:

| Event              | Recipients            | Method in EmailService             |
|--------------------|-----------------------|-----------------------------------|
| Ticket created     | Creator               | `sendTicketCreatedEmail`           |
| Ticket assigned    | Assignee              | `sendTicketAssignedEmail`          |
| Status changed     | Creator               | `sendTicketStatusChangedEmail`     |
| New public comment | Creator+Assignee+Watchers | `sendNewCommentEmail`         |
| SLA breach         | Assignee              | `sendSlaBreachEmail`               |
| Ticket resolved    | Creator               | `sendTicketResolvedEmail`          |

Each trigger checks the corresponding toggle in the org's `EmailConfig` before
sending. All sends are fire-and-forget.

---

## 4. Frontend Deep Dive

### 4.1 Next.js App Router Structure

The frontend uses Next.js 14 with the App Router (`src/app/` directory).

**Layout hierarchy:**

```
app/layout.tsx          # Root layout: <html>, <body>, Inter font, Toaster
|
|-- app/page.tsx        # Landing page / redirect
|
|-- app/login/page.tsx  # Login form (public)
|-- app/signup/page.tsx # Signup form (public)
|
|-- (authenticated pages use AppLayout component)
|   |-- app/dashboard/page.tsx         # Dashboard
|   |-- app/tickets/page.tsx           # Ticket list
|   |-- app/tickets/[id]/page.tsx      # Ticket detail
|   |-- app/analytics/page.tsx         # Analytics
|   |-- app/analytics/agents/[id]/page.tsx  # Agent KPI detail
|   |-- app/settings/page.tsx          # Settings
|   +-- app/knowledge-base/page.tsx    # Knowledge base
```

**Client vs Server Components:**

All page components are client components (`'use client'`). This is because:
1. They all depend on authentication state from `localStorage`
2. They use `useEffect` for data fetching
3. The API requires a bearer token from client-side storage

Server components are not used for data fetching because the backend API requires
authentication that is only available on the client side.

Heavy client components are split out:
- `TicketDetailClient.tsx` -- Full ticket detail with comments, activity log, etc.
- `AgentKpiClient.tsx` -- Agent KPI page with charts

### 4.2 API Client

**File:** `frontend/src/lib/api.ts`

**Axios instance configuration:**

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});
```

**Request interceptor:**

Attaches the `accessToken` from `localStorage` to every request:

```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Response interceptor (auto-refresh):**

On a `401` response, the interceptor attempts to refresh the token:

1. Gets `refreshToken` from localStorage
2. Calls `POST /auth/refresh`
3. Stores the new token pair
4. Retries the original request with the new access token
5. If refresh fails, clears storage and redirects to `/login`

The `_retry` flag prevents infinite refresh loops.

**API endpoint groups:**

The file exports 16 API objects, each grouping related endpoints:

| Object             | Endpoints                                         |
|-------------------|---------------------------------------------------|
| `authApi`          | signup, login, logout, invite                     |
| `ticketsApi`       | list, myTickets, get, create, update, bulkUpdate  |
| `commentsApi`      | create, update, delete                            |
| `usersApi`         | list, me, agents, updateProfile                   |
| `orgApi`           | getCurrent, update, uploadLogo, getTags           |
| `categoriesApi`    | list, create, update, delete, reorder             |
| `prioritiesApi`    | list, create, update, delete                      |
| `cannedResponsesApi`| list, create, update, delete                     |
| `watchersApi`      | list, add, remove, watchSelf, unwatchSelf         |
| `csatApi`          | submit, get, agentStats, overview                 |
| `timeTrackingApi`  | log, list, delete                                 |
| `notificationsApi` | list, unreadCount, markAsRead, markAllAsRead      |
| `analyticsApi`     | dashboard, volume, agentPerformance, agentKpiDetail, byPriority, byStatus |
| `kbApi`            | getCategories, createCategory, getArticles, getArticle, createArticle, updateArticle, deleteArticle |
| `searchApi`        | tickets                                           |
| `slaApi`           | list, update                                      |
| `jiraApi`          | getConfig, saveConfig, deleteConfig, createIssue, syncStatus |
| `emailConfigApi`   | get, save, test                                   |
| `channelsApi`      | getConfig, saveConfig, deleteConfig, testImap, getMessages |

### 4.3 State Management

**File:** `frontend/src/stores/auth.ts`

The application uses a single Zustand store for authentication state:

```typescript
interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  setAuth: (user, organization, accessToken, refreshToken) => void;
  logout: () => void;
  loadFromStorage: () => void;
}
```

**Persistence pattern:**

- `setAuth()` saves user, organization, accessToken, and refreshToken to `localStorage`
- `loadFromStorage()` reads all four values from `localStorage` and sets state
- `logout()` clears all four keys from `localStorage`

**Hydration pattern:**

The `AppLayout` component calls `loadFromStorage()` in a `useEffect` on mount.
Until hydration completes, a loading spinner is shown. If the user is not
authenticated after hydration, they are redirected to `/login`.

```typescript
useEffect(() => {
  loadFromStorage();
  setLoading(false);
}, []);

useEffect(() => {
  if (!loading && !isAuthenticated) router.push('/login');
}, [loading, isAuthenticated]);
```

Other state (tickets, analytics data, etc.) is fetched per-page using `useEffect`
and stored in local component state (`useState`). This keeps the state management
simple -- only auth state needs cross-page persistence.

### 4.4 Key Pages

**Dashboard (`/dashboard`):**

- Shows four stat cards: Total Tickets, Open, Resolved, SLA Breached
- Lists the 5 most recent tickets
- Data fetched from `analyticsApi.dashboard()` and `ticketsApi.list()`

**Ticket List (`/tickets`):**

- Filterable by status, priority, assignee, category, tag, SLA breach
- Text search on title/description
- Paginated with sort options
- Each row links to the ticket detail page
- "Create Ticket" button opens a modal

**Ticket Detail (`/tickets/[id]`):**

- Full ticket info: title, description, status, priority, assignee, category, tags
- Comment thread (public + internal notes for agents)
- Activity log timeline
- Watchers list with add/remove
- Time entries with logging form
- CSAT rating (for resolved tickets)
- JIRA link and status sync button
- Inline editing for status, priority, assignee

**Analytics (`/analytics`):**

- Dashboard stats (same as dashboard)
- Ticket volume chart over time (Recharts line chart)
- Tickets by priority/status (Recharts bar/pie charts)
- Agent performance table with drill-down to agent detail page

**Agent KPI Detail (`/analytics/agents/[id]`):**

- Agent profile card
- KPI summary: total, open, resolved, compliance rate, avg resolution time
- Weekly resolution chart
- Recent tickets table

**Settings (`/settings`):**

- Organization settings (name, logo, auto-assign mode)
- Email configuration (SMTP settings, trigger toggles, test email)
- Channel configuration (IMAP, Twilio, Meta WhatsApp)
- JIRA integration
- User management (invite, deactivate)
- Category management
- Priority management
- SLA policy editing
- Canned response management

**Knowledge Base (`/knowledge-base`):**

- Category browser with article counts
- Article list filtered by category
- Article search
- Create/edit article forms (ADMIN/AGENT)

### 4.5 Styling

**Tailwind CSS Configuration (`tailwind.config.ts`):**

- **Content sources:** `src/pages/`, `src/components/`, `src/app/`
- **Dark mode:** `class` strategy (not implemented in current UI)
- **Custom colors:** `primary` palette (50-900) using blue shades (#3b82f6 base)

**Component patterns:**

- Cards: `bg-white rounded-lg shadow-sm border p-6`
- Buttons: `bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2`
- Inputs: `border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500`
- Status badges: Color-coded with utility functions from `utils.ts`
- Responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for stat cards

**Branding system (`lib/branding.ts`):**

Centralized configuration for app name, tagline, colors, copyright, and logo.
Used by `BrandLogo`, `Footer`, `Sidebar`, and `Header` components.

---

## 5. Desktop App Deep Dive

### 5.1 Architecture

The Electron app wraps the existing backend and frontend as child processes:

```
Electron Main Process (main.js)
  |
  |-- fork() --> NestJS Backend (port 3051)
  |                  |-- SQLite database (userData/data/supportdesk.db)
  |
  |-- fork() --> Next.js Frontend (port 3052)
  |                  |-- Connects to backend at localhost:3051
  |
  +-- BrowserWindow --> loads http://localhost:3052
```

### 5.2 Startup Sequence

1. **Show splash screen** -- `splash.html` with a loading animation
2. **Resolve database path** -- `<userData>/data/supportdesk.db`. If the DB does not
   exist, copy the seed database from the backend
3. **Generate JWT secrets** -- Persisted across restarts using `electron-store`. If
   not available, generates ephemeral secrets
4. **Fork backend process** -- Sets environment variables (PORT=3051, DATABASE_URL,
   JWT secrets) and waits for "Server running" log output
5. **Wait for backend port** -- Polls `http://localhost:3051` every 500ms (max 30s)
6. **Fork frontend process** -- Sets environment (PORT=3052, API URL pointing to
   backend)
7. **Wait for frontend port** -- Same polling pattern
8. **Create main window** -- 1400x900, loads `http://localhost:3052`
9. **Close splash, show main window** -- On `ready-to-show`

### 5.3 SQLite Local Database

The desktop app uses SQLite (same Prisma schema as development). The database file
is stored in Electron's `userData` directory:

- **Windows:** `%APPDATA%/SupportDesk/data/supportdesk.db`
- **macOS:** `~/Library/Application Support/SupportDesk/data/supportdesk.db`
- **Linux:** `~/.config/SupportDesk/data/supportdesk.db`

On first run, the seed database (`dev.db`) is copied to this location.

### 5.4 Desktop Features

- **System tray** -- Minimize to tray instead of closing. Double-click to restore.
- **Single instance lock** -- Only one instance can run at a time.
- **Auto-restart** -- If the backend or frontend crashes, it restarts after 3 seconds.
- **External links** -- Links open in the default browser, not Electron.
- **Application menu** -- File, Edit (clipboard), View (zoom, devtools in dev),
  Help (API docs, GitHub).
- **Preload script** -- Exposes `window.desktopApp` with `isDesktop`, `platform`,
  and `version` to the renderer.

### 5.5 Build and Packaging

**Build script:** `desktop/scripts/prepare-build.js`

1. Runs `prisma generate` + `nest build` in the backend directory
2. Runs `next build` (standalone mode) in the frontend directory
3. Copies `backend/dist`, `backend/node_modules`, and `backend/prisma` to
   `desktop/app-backend/`
4. Copies the Next.js standalone output + static assets to `desktop/app-frontend/`

**Package command:**

```bash
cd desktop
npm run package    # Runs prepare-build.js then electron-builder --win
```

**electron-builder configuration** (in `desktop/package.json`):

- **Windows:** NSIS installer with customizable install directory
- **macOS:** DMG with category `public.app-category.business`
- **Linux:** AppImage and DEB packages
- **Extra resources:** Prisma schema, engine, and client are bundled as external
  resources

---

## 6. Data Flow Diagrams

### 6.1 User Creates Ticket (Web)

```
Browser                     Frontend                    Backend                      Database
  |                           |                           |                            |
  | Fill form, click Submit   |                           |                            |
  |-------------------------->|                           |                            |
  |                           | POST /api/v1/tickets      |                            |
  |                           | { title, description,     |                            |
  |                           |   priority, assigneeId }  |                            |
  |                           |-------------------------->|                            |
  |                           |                           | 1. Get next ticketNumber   |
  |                           |                           |---findFirst(orderBy desc)-->|
  |                           |                           |<--lastTicket.ticketNumber---|
  |                           |                           |                            |
  |                           |                           | 2. Find SLA policy         |
  |                           |                           |---findUnique(priority,org)->|
  |                           |                           |<--slaPolicy----------------|
  |                           |                           |                            |
  |                           |                           | 3. Auto-assign (if needed) |
  |                           |                           |---query agents, pick next-->|
  |                           |                           |<--assigneeId---------------|
  |                           |                           |                            |
  |                           |                           | 4. Create ticket           |
  |                           |                           |---ticket.create()--------->|
  |                           |                           |<--ticket object------------|
  |                           |                           |                            |
  |                           |                           | 5. Sync tags               |
  |                           |                           |---tag.upsert, ticketTag--->|
  |                           |                           |                            |
  |                           |                           | 6. Log activity            |
  |                           |                           |---activityLog.create()---->|
  |                           |                           |                            |
  |                           |                           | 7. Fire-and-forget emails  |
  |                           |                           |---sendTicketCreatedEmail-->| (async)
  |                           |                           |---sendTicketAssignedEmail->| (async)
  |                           |                           |                            |
  |                           |                           | 8. Create notifications    |
  |                           |                           |---notification.create()--->|
  |                           |                           |                            |
  |                           |<----- 201 { ticket } -----|                            |
  |<-- Update ticket list ----|                           |                            |
```

### 6.2 Inbound WhatsApp Message Creates Ticket (Meta)

```
Meta Platform             NestJS Webhooks          MetaWhatsappService       ChannelsService         Database
     |                         |                         |                       |                     |
     | POST /webhooks/meta/    |                         |                       |                     |
     |   whatsapp              |                         |                       |                     |
     | { object, entry[] }     |                         |                       |                     |
     |------------------------>|                         |                       |                     |
     |                         | body => handleWebhook() |                       |                     |
     |                         |------------------------>|                       |                     |
     |                         |                         | Extract phone_number_id                     |
     |                         |                         | findOrgByMetaPhoneId() |                     |
     |                         |                         |---------------------->|--channelConfig.find->|
     |                         |                         |<-----organizationId---|<----- config -------|
     |                         |                         |                       |                     |
     |                         |                         | For each message:     |                     |
     |                         |                         | extractMessageBody()  |                     |
     |                         |                         |                       |                     |
     |                         |                         | createTicketFromChannel()                    |
     |                         |                         |---------------------->|                     |
     |                         |                         |                       | 1. Check dedup      |
     |                         |                         |                       |---inboundMsg.find-->|
     |                         |                         |                       |                     |
     |                         |                         |                       | 2. Create ticket    |
     |                         |                         |                       |   (see 6.1 steps)   |
     |                         |                         |                       |---ticket.create---->|
     |                         |                         |                       |                     |
     |                         |                         |                       | 3. Log inbound msg  |
     |                         |                         |                       |---inboundMsg.create>|
     |                         |                         |                       |                     |
     |                         |                         |<--- ticket object ----|                     |
     |                         |                         |                       |                     |
     |                         |                         | Send auto-reply       |                     |
     |                         |                         |---graph.facebook.com-->                     |
     |                         |                         |   /v18.0/{phoneId}/messages                 |
     |                         |                         |                       |                     |
     |<---- 200 OK ------------|                         |                       |                     |
```

### 6.3 Inbound Email Creates Ticket

```
Cron (every minute)    InboundEmailService      IMAP Server        ChannelsService       Database
     |                       |                       |                   |                   |
     | @Cron(EVERY_MINUTE)   |                       |                   |                   |
     |---pollAllMailboxes()-->|                       |                   |                   |
     |                       | Find all enabled IMAP configs             |                   |
     |                       |------------------------------------------------->findMany()--->|
     |                       |<--------------------------------------------- configs[] ------|
     |                       |                       |                   |                   |
     |                       | For each config:      |                   |                   |
     |                       |--TLS connect---------->|                  |                   |
     |                       |<--* OK IMAP ready------|                  |                   |
     |                       |--LOGIN user pass------>|                  |                   |
     |                       |<--OK Logged in---------|                  |                   |
     |                       |--SELECT INBOX--------->|                  |                   |
     |                       |<--OK [exists N]--------|                  |                   |
     |                       |--SEARCH UNSEEN-------->|                  |                   |
     |                       |<--* SEARCH 1 2 3-------|                  |                   |
     |                       |                       |                   |                   |
     |                       | For each unseen (max 10):                 |                   |
     |                       |--FETCH N BODY[HEADER]+BODY[TEXT]->|       |                   |
     |                       |<-- From, Subject, Date, body -----|       |                   |
     |                       |--STORE N +FLAGS(\Seen)>|                  |                   |
     |                       |                       |                   |                   |
     |                       | Check for duplicate Message-ID            |                   |
     |                       |--------------------------------------------> inboundMsg.find->|
     |                       |                       |                   |                   |
     |                       | createTicketFromChannel()                 |                   |
     |                       |------------------------------>            |                   |
     |                       |                       |       (see 6.1)  |                   |
     |                       |<---- ticket -----------------------|     |                   |
     |                       |                       |                   |                   |
     |                       |--LOGOUT-------------->|                   |                   |
```

### 6.4 Phone Call Creates Ticket (Twilio)

```
Twilio              NestJS Webhooks         TwilioService          ChannelsService       Database
  |                       |                       |                       |                 |
  | POST /webhooks/       |                       |                       |                 |
  |   twilio/voice        |                       |                       |                 |
  | { CallSid, From, To } |                       |                       |                 |
  |---------------------->|                       |                       |                 |
  |                       | handleIncomingCall()   |                       |                 |
  |                       |---------------------> |                       |                 |
  |                       |                       | findOrgByTwilioNumber |                 |
  |                       |                       |--------------------->|--config.find---->|
  |                       |                       |<----organizationId---|<--- config ------|
  |                       |                       |                       |                 |
  |                       |                       | createTicketFromChannel()                |
  |                       |                       |---body="Incoming call from..."--------->|
  |                       |                       |<--- ticket (with ticketNumber) ---------|
  |                       |                       |                       |                 |
  |                       |                       | Build TwiML response  |                 |
  |                       |                       |   <Say> "Your ticket  |                 |
  |                       |                       |    number is N..."    |                 |
  |                       |                       |   <Record> (if enabled)                 |
  |                       |<-- { twiml, ticket } -|                       |                 |
  |<-- text/xml TwiML ----|                       |                       |                 |
  |                       |                       |                       |                 |
  | (later, Twilio sends) |                       |                       |                 |
  | POST /twilio/voice/   |                       |                       |                 |
  |   status              |                       |                       |                 |
  | { CallSid, Recording, |                       |                       |                 |
  |   Transcription }     |                       |                       |                 |
  |--------------------->| handleCallStatus()    |                       |                 |
  |                       |---------------------> |                       |                 |
  |                       |                       | Find ticket by CallSid                  |
  |                       |                       | Add internal comment  |                 |
  |                       |                       |   with recording URL  |                 |
  |                       |                       |   and transcription   |                 |
  |                       |                       |---comment.create()--->|---INSERT-------->|
  |<-- 200 OK ------------|                       |                       |                 |
```

### 6.5 SLA Breach Detection Flow

```
Cron (every 5 min)     SlaService              EmailService           Database
     |                       |                       |                   |
     | @Cron(EVERY_5_MINUTES)|                       |                   |
     |---checkSlaBreaches()-->|                      |                   |
     |                       | Find breached tickets  |                   |
     |                       |   slaBreached=false    |                   |
     |                       |   dueAt < now          |                   |
     |                       |   status IN (OPEN,PENDING)                 |
     |                       |-------------------------------------------->|
     |                       |<--- breachedTickets[] ----------------------|
     |                       |                       |                   |
     |                       | For each ticket:      |                   |
     |                       |                       |                   |
     |                       | 1. Set slaBreached=true                    |
     |                       |--ticket.update()------>|----------------->|
     |                       |                       |                   |
     |                       | 2. Notify assignee (in-app)                |
     |                       |--notification.create-->|----------------->|
     |                       |                       |                   |
     |                       | 3. Send SLA breach email                   |
     |                       |---sendSlaBreachEmail-->|                  |
     |                       |                       |--SMTP send------->|
     |                       |                       |                   |
     |                       | 4. Notify admins (in-app)                  |
     |                       |--user.findMany(ADMIN)->|----------------->|
     |                       |--notification.create x N-->|------------>|
     |                       |                       |                   |
     |                       | 5. Log activity       |                   |
     |                       |--activityLog.create-->|----------------->|
```

### 6.6 Comment Notification Flow

```
Agent posts reply        CommentsService         EmailService           Database
     |                       |                       |                   |
     | POST /tickets/:id/    |                       |                   |
     |   comments            |                       |                   |
     | { body, isInternal }  |                       |                   |
     |--------------------->|                       |                   |
     |                       | 1. Verify ticket exists in org            |
     |                       |--ticket.findFirst()--->|----------------->|
     |                       |                       |                   |
     |                       | 2. Create comment     |                   |
     |                       |--comment.create()---->|----------------->|
     |                       |                       |                   |
     |                       | 3. Track first response (if applicable)   |
     |                       |--ticket.update(firstResponseAt)---------->|
     |                       |                       |                   |
     |                       | 4. Log activity       |                   |
     |                       |--activityLog.create-->|----------------->|
     |                       |                       |                   |
     |                       | 5. If NOT internal:   |                   |
     |                       |   Collect recipients:  |                   |
     |                       |   - Creator (if != author)                |
     |                       |   - Assignee (if != author)               |
     |                       |   - All watchers (if != author)           |
     |                       |--ticketWatcher.findMany-->|------------->|
     |                       |                       |                   |
     |                       |   Send emails         |                   |
     |                       |---sendNewCommentEmail->|                  |
     |                       |                       |--SMTP send x N-->|
     |                       |                       |                   |
     |                       |   Create in-app notifications             |
     |                       |--notification.create x N-->|------------>|
     |                       |                       |                   |
     |<-- 201 { comment } ---|                       |                   |
```

---

## 7. Environment & Configuration

### 7.1 All Environment Variables

| Variable               | Required | Default                 | Description                                |
|------------------------|----------|-------------------------|--------------------------------------------|
| `DATABASE_URL`         | Yes      | `file:./dev.db`         | Database connection string (SQLite or PostgreSQL) |
| `JWT_SECRET`           | Yes      | `default-secret-change-me` | Secret for signing JWT access tokens    |
| `JWT_REFRESH_SECRET`   | Yes      | (none)                  | Secret for validating refresh tokens       |
| `JWT_EXPIRATION`       | No       | `15m`                   | Access token TTL (e.g., `15m`, `1h`)       |
| `JWT_REFRESH_EXPIRATION`| No      | `7d`                    | Refresh token TTL                          |
| `PORT`                 | No       | `3001`                  | Backend HTTP port                          |
| `NODE_ENV`             | No       | (not set)               | `production` hides Swagger docs            |
| `FRONTEND_URL`         | No       | `http://localhost:3000`  | Allowed CORS origin                       |
| `MEILI_HOST`           | No       | `http://localhost:7700`  | Meilisearch server URL                    |
| `MEILI_API_KEY`        | No       | (none)                  | Meilisearch API key                        |
| `SMTP_HOST`            | No       | (none)                  | Global SMTP host (for `.env` fallback)     |
| `SMTP_PORT`            | No       | (none)                  | Global SMTP port                           |
| `SMTP_USER`            | No       | (none)                  | Global SMTP username                       |
| `SMTP_PASS`            | No       | (none)                  | Global SMTP password                       |
| `AWS_S3_BUCKET`        | No       | (none)                  | S3 bucket (reserved for future use)        |
| `AWS_S3_REGION`        | No       | (none)                  | S3 region (reserved for future use)        |
| `AWS_ACCESS_KEY_ID`    | No       | (none)                  | AWS access key (reserved)                  |
| `AWS_SECRET_ACCESS_KEY`| No       | (none)                  | AWS secret key (reserved)                  |
| `NEXT_PUBLIC_API_URL`  | No       | `http://localhost:3001/api/v1` | Frontend API base URL             |

### 7.2 Development vs Production Settings

| Setting                | Development                    | Production                        |
|------------------------|--------------------------------|-----------------------------------|
| Database               | SQLite (`file:./dev.db`)       | PostgreSQL                        |
| JWT Secret             | Static string in `.env`        | Strong random secret              |
| JWT Expiration         | 15 minutes                     | 15 minutes (or shorter)           |
| Swagger Docs           | Enabled at `/api/docs`         | Disabled                          |
| CORS Origin            | `http://localhost:3000`        | Production frontend URL           |
| Helmet CSP             | Disabled                       | Should be enabled                 |
| Rate Limiting          | 100/min                        | Adjust per environment            |
| Meilisearch            | Optional                       | Recommended for scale             |
| Email                  | Per-org config                 | Per-org config + verify SMTP      |

### 7.3 Database Configuration

**SQLite (development/desktop):**

```
DATABASE_URL="file:./dev.db"
```

**PostgreSQL (production):**

```
DATABASE_URL="postgresql://user:password@host:5432/support_tickets?schema=public"
```

To switch databases, change the `datasource` provider in `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // or "sqlite"
  url      = env("DATABASE_URL")
}
```

After switching, run `npx prisma generate` and `npx prisma migrate dev`.

---

## 8. Development Workflow

### 8.1 Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd support-ticket-system

# Backend setup
cd backend
npm install
cp .env.example .env   # Edit .env with your settings
npx prisma generate
npx prisma migrate dev
npx ts-node prisma/seed.ts   # Optional: seed demo data

# Frontend setup
cd ../frontend
npm install

# Desktop setup (optional)
cd ../desktop
npm install
```

### 8.2 Running the Development Servers

**Terminal 1 -- Backend:**

```bash
cd backend
npm run start:dev     # NestJS with hot reload on port 3001
```

**Terminal 2 -- Frontend:**

```bash
cd frontend
npm run dev           # Next.js dev server on port 3000
```

**API Documentation:** `http://localhost:3001/api/docs`

**Desktop (development mode):**

```bash
cd desktop
npm start             # Starts Electron, uses backend/frontend from source
```

### 8.3 Database Migrations

```bash
cd backend

# After editing schema.prisma:
npx prisma migrate dev --name your_migration_name

# Regenerate the Prisma client:
npx prisma generate

# View the database in Prisma Studio:
npx prisma studio

# Reset everything (drops data):
npx prisma migrate reset
```

### 8.4 Adding a New Module

1. Create the directory: `backend/src/modules/your-module/`

2. Create the module file:

```typescript
// your-module.module.ts
import { Module } from '@nestjs/common';
import { YourModuleController } from './your-module.controller';
import { YourModuleService } from './your-module.service';

@Module({
  controllers: [YourModuleController],
  providers: [YourModuleService],
  exports: [YourModuleService],
})
export class YourModuleModule {}
```

3. Create the controller:

```typescript
// your-module.controller.ts
@ApiTags('Your Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('your-module')
export class YourModuleController {
  constructor(private service: YourModuleService) {}

  @Get()
  @ApiOperation({ summary: 'List items' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user);
  }
}
```

4. Create the service (inject `PrismaService` -- it is globally available):

```typescript
// your-module.service.ts
@Injectable()
export class YourModuleService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    return this.prisma.yourModel.findMany({
      where: { organizationId: user.organizationId },
    });
  }
}
```

5. Register in `app.module.ts`:

```typescript
import { YourModuleModule } from './modules/your-module/your-module.module';

@Module({
  imports: [
    // ... existing modules
    YourModuleModule,
  ],
})
```

6. Add the API client methods in `frontend/src/lib/api.ts`.

### 8.5 Adding a New API Endpoint

1. Add the DTO in `dto/` (if body validation needed)
2. Add the route in the controller with appropriate decorators
3. Implement the logic in the service
4. Add the frontend API method
5. Test via Swagger at `/api/docs`

### 8.6 Common Patterns and Conventions

**Tenant scoping:**

Every query must include `organizationId`:

```typescript
where: { organizationId: user.organizationId }
```

**Pagination:**

Extend `PaginationDto` for list endpoints:

```typescript
export class YourFilterDto extends PaginationDto {
  @IsOptional() @IsString() myFilter?: string;
}
```

Return `PaginatedResponse`:

```typescript
return new PaginatedResponse(data, total, query.page, query.limit);
```

**Error handling:**

Use NestJS built-in exceptions:

```typescript
throw new NotFoundException('Resource not found');
throw new ForbiddenException('Insufficient permissions');
throw new ConflictException('Resource already exists');
throw new BadRequestException('Invalid input');
```

**Activity logging:**

Log significant actions:

```typescript
await this.prisma.activityLog.create({
  data: {
    action: 'YOUR_ACTION',
    ticketId: ticket.id,
    userId: user.id,
    details: JSON.stringify({ key: 'value' }),
  },
});
```

**Fire-and-forget emails:**

```typescript
this.emailService.sendSomeEmail(args).catch(() => {});
```

---

## 9. API Reference Quick Table

All routes are prefixed with `/api/v1`.

| # | Verb   | Route                                      | Auth              | Description                             |
|---|--------|--------------------------------------------|--------------------|----------------------------------------|
| 1 | POST   | `/auth/signup`                             | Public             | Register organization + admin           |
| 2 | POST   | `/auth/login`                              | Public             | Authenticate user                       |
| 3 | POST   | `/auth/refresh`                            | Public             | Refresh access token                    |
| 4 | POST   | `/auth/invite`                             | JWT + ADMIN        | Invite user to organization             |
| 5 | POST   | `/auth/logout`                             | Public             | Invalidate refresh token                |
| 6 | GET    | `/users`                                   | JWT + ADMIN/AGENT  | List users (paginated)                  |
| 7 | GET    | `/users/agents`                            | JWT                | List agents for assignment              |
| 8 | GET    | `/users/me`                                | JWT                | Get current user profile                |
| 9 | GET    | `/users/:id`                               | JWT + ADMIN/AGENT  | Get user details                        |
| 10| PATCH  | `/users/me`                                | JWT                | Update own profile                      |
| 11| PATCH  | `/users/:id/toggle-active`                 | JWT + ADMIN        | Activate/deactivate user                |
| 12| GET    | `/organizations/current`                   | JWT                | Get current organization                |
| 13| PATCH  | `/organizations/current`                   | JWT + ADMIN        | Update organization                     |
| 14| POST   | `/organizations/logo`                      | JWT + ADMIN        | Upload organization logo                |
| 15| GET    | `/organizations/tags`                      | JWT                | List organization tags                  |
| 16| POST   | `/tickets`                                 | JWT                | Create ticket                           |
| 17| GET    | `/tickets`                                 | JWT                | List tickets (filtered, paginated)      |
| 18| GET    | `/tickets/my`                              | JWT                | My tickets                              |
| 19| GET    | `/tickets/:id`                             | JWT                | Get ticket detail                       |
| 20| PATCH  | `/tickets/:id`                             | JWT                | Update ticket                           |
| 21| PATCH  | `/tickets/bulk/update`                     | JWT + ADMIN/AGENT  | Bulk update tickets                     |
| 22| POST   | `/tickets/:ticketId/comments`              | JWT                | Add comment                             |
| 23| PATCH  | `/tickets/:ticketId/comments/:commentId`   | JWT                | Edit comment                            |
| 24| DELETE | `/tickets/:ticketId/comments/:commentId`   | JWT                | Delete comment                          |
| 25| GET    | `/notifications`                           | JWT                | List notifications                      |
| 26| GET    | `/notifications/unread-count`              | JWT                | Unread count                            |
| 27| PATCH  | `/notifications/:id/read`                  | JWT                | Mark notification as read               |
| 28| PATCH  | `/notifications/read-all`                  | JWT                | Mark all as read                        |
| 29| GET    | `/sla-policies`                            | JWT                | List SLA policies                       |
| 30| PATCH  | `/sla-policies/:id`                        | JWT + ADMIN        | Update SLA policy                       |
| 31| GET    | `/analytics/dashboard`                     | JWT + ADMIN/AGENT  | Dashboard stats                         |
| 32| GET    | `/analytics/volume`                        | JWT + ADMIN/AGENT  | Ticket volume by day                    |
| 33| GET    | `/analytics/agent-performance`             | JWT + ADMIN/AGENT  | Agent performance metrics               |
| 34| GET    | `/analytics/by-priority`                   | JWT + ADMIN/AGENT  | Tickets by priority                     |
| 35| GET    | `/analytics/by-status`                     | JWT + ADMIN/AGENT  | Tickets by status                       |
| 36| GET    | `/analytics/agent/:agentId`                | JWT + ADMIN/AGENT  | Agent KPI detail                        |
| 37| POST   | `/knowledge-base/categories`               | JWT + ADMIN/AGENT  | Create KB category                      |
| 38| GET    | `/knowledge-base/categories`               | JWT                | List KB categories                      |
| 39| POST   | `/knowledge-base/articles`                 | JWT + ADMIN/AGENT  | Create article                          |
| 40| GET    | `/knowledge-base/articles`                 | JWT                | List articles                           |
| 41| GET    | `/knowledge-base/articles/:id`             | JWT                | Get article                             |
| 42| PATCH  | `/knowledge-base/articles/:id`             | JWT + ADMIN/AGENT  | Update article                          |
| 43| DELETE | `/knowledge-base/articles/:id`             | JWT + ADMIN        | Delete article                          |
| 44| GET    | `/search/tickets`                          | JWT                | Full-text search tickets                |
| 45| POST   | `/attachments/upload`                      | JWT                | Upload file attachment                  |
| 46| DELETE | `/attachments/:id`                         | JWT                | Delete attachment                       |
| 47| POST   | `/categories`                              | JWT + ADMIN        | Create ticket category                  |
| 48| GET    | `/categories`                              | JWT                | List ticket categories                  |
| 49| PATCH  | `/categories/reorder`                      | JWT + ADMIN        | Reorder categories                      |
| 50| PATCH  | `/categories/:id`                          | JWT + ADMIN        | Update category                         |
| 51| DELETE | `/categories/:id`                          | JWT + ADMIN        | Delete category                         |
| 52| POST   | `/priorities`                              | JWT + ADMIN        | Create custom priority                  |
| 53| GET    | `/priorities`                              | JWT                | List priorities                         |
| 54| PATCH  | `/priorities/:id`                          | JWT + ADMIN        | Update priority                         |
| 55| DELETE | `/priorities/:id`                          | JWT + ADMIN        | Delete priority                         |
| 56| POST   | `/tickets/:ticketId/watchers`              | JWT + ADMIN/AGENT  | Add watcher                             |
| 57| DELETE | `/tickets/:ticketId/watchers/:userId`      | JWT + ADMIN/AGENT  | Remove watcher                          |
| 58| GET    | `/tickets/:ticketId/watchers`              | JWT                | List watchers                           |
| 59| POST   | `/tickets/:ticketId/watchers/me`           | JWT                | Watch ticket (self)                     |
| 60| DELETE | `/tickets/:ticketId/watchers/me`           | JWT                | Unwatch ticket (self)                   |
| 61| POST   | `/satisfaction/tickets/:ticketId`          | JWT + END_USER     | Submit CSAT rating                      |
| 62| GET    | `/satisfaction/tickets/:ticketId`          | JWT                | Get ticket rating                       |
| 63| GET    | `/satisfaction/agents/:agentId`            | JWT + ADMIN/AGENT  | Agent CSAT stats                        |
| 64| GET    | `/satisfaction/overview`                   | JWT + ADMIN/AGENT  | Org-wide CSAT overview                  |
| 65| POST   | `/tickets/:ticketId/time`                  | JWT + ADMIN/AGENT  | Log time entry                          |
| 66| GET    | `/tickets/:ticketId/time`                  | JWT                | List time entries                       |
| 67| DELETE | `/tickets/:ticketId/time/:entryId`         | JWT                | Delete time entry                       |
| 68| POST   | `/canned-responses`                        | JWT + ADMIN/AGENT  | Create canned response                  |
| 69| GET    | `/canned-responses`                        | JWT                | List canned responses                   |
| 70| PATCH  | `/canned-responses/:id`                    | JWT + ADMIN/AGENT  | Update canned response                  |
| 71| DELETE | `/canned-responses/:id`                    | JWT + ADMIN/AGENT  | Delete canned response                  |
| 72| GET    | `/email-config/config`                     | JWT + ADMIN        | Get email config                        |
| 73| POST   | `/email-config/config`                     | JWT + ADMIN        | Save email config                       |
| 74| POST   | `/email-config/test`                       | JWT + ADMIN        | Send test email                         |
| 75| GET    | `/jira/config`                             | JWT + ADMIN        | Get JIRA config                         |
| 76| POST   | `/jira/config`                             | JWT + ADMIN        | Save JIRA config                        |
| 77| DELETE | `/jira/config`                             | JWT + ADMIN        | Delete JIRA config                      |
| 78| POST   | `/jira/create-issue`                       | JWT + ADMIN/AGENT  | Create JIRA issue                       |
| 79| GET    | `/jira/sync/:ticketId`                     | JWT + ADMIN/AGENT  | Sync JIRA status                        |
| 80| GET    | `/channels/config`                         | JWT + ADMIN        | Get channel config                      |
| 81| POST   | `/channels/config`                         | JWT + ADMIN        | Save channel config                     |
| 82| DELETE | `/channels/config`                         | JWT + ADMIN        | Delete channel config                   |
| 83| POST   | `/channels/test-imap`                      | JWT + ADMIN        | Test IMAP connection                    |
| 84| GET    | `/channels/messages`                       | JWT + ADMIN        | View inbound messages log               |
| 85| POST   | `/webhooks/twilio/voice`                   | Public (Twilio)    | Incoming voice call                     |
| 86| POST   | `/webhooks/twilio/voice/status`            | Public (Twilio)    | Call status callback                    |
| 87| POST   | `/webhooks/twilio/whatsapp`                | Public (Twilio)    | WhatsApp message (Twilio)               |
| 88| GET    | `/webhooks/meta/whatsapp`                  | Public (Meta)      | Webhook verification                    |
| 89| POST   | `/webhooks/meta/whatsapp`                  | Public (Meta)      | WhatsApp message (Meta)                 |

---

## 10. Glossary

### Domain Terms

| Term                  | Definition                                                      |
|-----------------------|-----------------------------------------------------------------|
| **Organization**      | A tenant in the system. All data is scoped to an organization.  |
| **Ticket**            | A support request created by an end user or from an inbound channel. |
| **Agent**             | A user with role `AGENT` who handles support tickets.           |
| **End User**          | A customer who creates and tracks support tickets.              |
| **SLA (Service Level Agreement)** | A policy defining response and resolution time targets per priority level. |
| **SLA Breach**        | When a ticket exceeds its SLA deadline without being resolved.  |
| **CSAT**              | Customer Satisfaction -- a 1-5 star rating submitted after resolution. |
| **Internal Note**     | A comment marked `isInternal: true`, visible only to agents and admins. |
| **Canned Response**   | A pre-written template reply with an optional shortcut trigger. |
| **Watcher**           | A user who subscribes to notifications for a specific ticket.   |
| **Channel**           | An inbound communication source: web, email, phone, WhatsApp.  |
| **Deduplication**     | Grouping rapid messages from the same sender into one ticket.   |
| **Auto-Assignment**   | Automatic agent assignment using round-robin or load balancing. |
| **Knowledge Base**    | A self-service library of articles organized by category.       |
| **Activity Log**      | An audit trail recording every action on a ticket.              |

### Technical Terms

| Term                  | Definition                                                      |
|-----------------------|-----------------------------------------------------------------|
| **App Router**        | Next.js 14's file-system routing in the `app/` directory.      |
| **Guard**             | A NestJS interceptor that allows/blocks request processing.     |
| **DTO (Data Transfer Object)** | A class defining the shape and validation of request data. |
| **Decorator**         | A TypeScript annotation that adds metadata or behavior.         |
| **Interceptor**       | Middleware that transforms requests/responses in the pipeline.  |
| **Pipe**              | A NestJS component that transforms/validates input data.        |
| **Module**            | A NestJS organizational unit grouping controllers and services. |
| **Zustand**           | A lightweight React state management library.                   |
| **Prisma**            | A TypeScript ORM with auto-generated, type-safe database client.|
| **TwiML**             | Twilio Markup Language -- XML responses for voice/SMS actions.  |
| **Webhook**           | An HTTP callback triggered by an external service (Twilio, Meta).|
| **Token Rotation**    | A security pattern where refresh tokens are single-use.         |
| **Fire-and-Forget**   | Async operations invoked without awaiting their result.         |
| **Standalone Output** | Next.js build mode that bundles a minimal Node.js server.       |
| **NSIS**              | Nullsoft Scriptable Install System -- Windows installer format. |
| **electron-builder**  | A tool for packaging Electron apps into distributable formats.  |
| **Helmet**            | Express middleware that sets HTTP security headers.             |
| **Throttler**         | NestJS module for rate limiting requests per IP.                |

---

*End of code walkthrough. For questions or updates, refer to the source code
in the repository.*
