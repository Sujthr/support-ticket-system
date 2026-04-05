# JIRA Integration Guide

Complete step-by-step guide to set up and use the JIRA integration in the Support Ticket System.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Step 1: Generate a JIRA API Token](#step-1-generate-a-jira-api-token)
- [Step 2: Find Your JIRA Project Key](#step-2-find-your-jira-project-key)
- [Step 3: Configure JIRA in SupportDesk](#step-3-configure-jira-in-supportdesk)
- [Step 4: Create a JIRA Ticket from a Support Ticket](#step-4-create-a-jira-ticket-from-a-support-ticket)
- [Step 5: Track JIRA Status](#step-5-track-jira-status)
- [What Gets Created in JIRA](#what-gets-created-in-jira)
- [Priority Mapping](#priority-mapping)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Advanced: Webhook for Auto-Sync](#advanced-webhook-for-auto-sync)

---

## Overview

The JIRA integration enables support agents to escalate customer support tickets to the engineering team by creating JIRA issues directly from the support tool. This bridges the gap between customer support and development workflows.

**Key capabilities:**
- One-click JIRA issue creation from any support ticket
- Auto-populates issue with ticket details, reporter info, and priority
- Bidirectional status tracking (sync JIRA status back to support ticket)
- Linked issue displayed on the support ticket sidebar
- Activity log records all JIRA actions

---

## How It Works

```
┌────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Support Agent  │     │  SupportDesk API  │     │  JIRA Cloud    │
│  clicks "Create │────▶│  POST /jira/      │────▶│  POST /rest/   │
│  JIRA Ticket"   │     │  create-issue     │     │  api/2/issue   │
└────────────────┘     └──────────┬───────┘     └───────┬────────┘
                                  │                      │
                                  │  ◀─── Returns ───────┘
                                  │  issue key (DEV-42)
                                  │
                          ┌───────▼────────┐
                          │ Updates ticket  │
                          │ with JIRA link  │
                          └────────────────┘
```

---

## Prerequisites

Before setting up the integration, you need:

1. **A JIRA Cloud account** (Atlassian Cloud at `https://yourcompany.atlassian.net`)
2. **Admin or Agent role** in SupportDesk
3. **A JIRA project** where issues will be created
4. **An Atlassian API token** (not your password)

> **Note:** This integration works with **JIRA Cloud** (Atlassian Cloud). JIRA Server/Data Center uses a different API authentication method.

---

## Step 1: Generate a JIRA API Token

API tokens are required because Atlassian Cloud does not accept passwords for API access.

### 1.1 Go to Atlassian Account Settings

Open your browser and navigate to:
```
https://id.atlassian.com/manage-profile/security/api-tokens
```

Or: **Atlassian Account** → **Security** → **API Tokens**

### 1.2 Create New Token

1. Click **"Create API token"**
2. Enter a label: `SupportDesk Integration`
3. Click **"Create"**
4. **Copy the token immediately** — you won't be able to see it again

### 1.3 Save the Token Securely

Store the token in a password manager. You'll need it in Step 3.

> **Security Note:** This token has the same access as your JIRA account. Use a dedicated service account if possible.

---

## Step 2: Find Your JIRA Project Key

The project key is the prefix used in issue numbers (e.g., `DEV` in `DEV-42`).

### Option A: From JIRA Dashboard

1. Open JIRA: `https://yourcompany.atlassian.net`
2. Click on **Projects** in the top navigation
3. Find your project — the **Key** column shows the project key

### Option B: From a JIRA Issue

Look at any issue URL:
```
https://yourcompany.atlassian.net/browse/DEV-42
                                          ^^^
                                     This is the project key
```

### Option C: From JIRA Project Settings

1. Open the project
2. Go to **Project Settings** (bottom-left)
3. The key is shown in the **Details** section

**Common project keys:**
- `DEV` - Development
- `ENG` - Engineering
- `BUG` - Bug Tracking
- `PROJ` - Generic Project

---

## Step 3: Configure JIRA in SupportDesk

### 3.1 Navigate to Settings

1. Log in to SupportDesk as an **Admin**
2. Click **Settings** in the sidebar
3. Click the **JIRA Integration** tab

### 3.2 Fill in the Configuration

| Field | Example | Description |
|-------|---------|-------------|
| **JIRA Base URL** | `https://acmecorp.atlassian.net` | Your Atlassian Cloud URL (no trailing slash) |
| **JIRA Email** | `john@acmecorp.com` | The email associated with your Atlassian account |
| **API Token** | `ABcd1234...` | The token from Step 1 |
| **Project Key** | `DEV` | From Step 2 |
| **Issue Type** | `Task` | Default type for created issues (Task, Bug, Story, or Epic) |

### 3.3 Click "Connect JIRA"

The system will:
1. Test the connection by calling `GET /rest/api/2/myself` with your credentials
2. If successful: save the configuration and show a green **"Connected"** badge
3. If failed: show an error message (check troubleshooting below)

### 3.4 Verify Connection

After connecting, you should see:
- A green **"Connected"** badge next to the JIRA heading
- The form pre-filled with your saved config
- The API token field masked (shows `••••••••` + last 4 chars)

---

## Step 4: Create a JIRA Ticket from a Support Ticket

### 4.1 Open a Support Ticket

1. Go to **Tickets** and click on any ticket
2. Look at the **right sidebar** for the **JIRA** card

### 4.2 Click "Create JIRA Ticket"

1. Click the blue **"Create JIRA Ticket"** button
2. Wait 2-3 seconds while the API call is made
3. On success:
   - A toast notification confirms: "JIRA issue DEV-42 created!"
   - The JIRA card now shows the linked issue key as a clickable link
   - The activity log records the action

### 4.3 View in JIRA

Click the issue key link (e.g., **DEV-42**) to open the issue directly in JIRA.

---

## Step 5: Track JIRA Status

### Manual Sync

1. Open a ticket that has a linked JIRA issue
2. In the JIRA sidebar card, click **"Sync Status"**
3. The current JIRA status (e.g., "In Progress", "In Review", "Done") is fetched and displayed

### Status Display

The JIRA card on the ticket shows:
- **Issue Key** - Clickable link to JIRA (e.g., DEV-42)
- **Status** - Current JIRA workflow status (e.g., "To Do", "In Progress", "Done")

---

## What Gets Created in JIRA

When you click "Create JIRA Ticket", the following JIRA issue is created:

### Issue Fields

| JIRA Field | Value |
|-----------|-------|
| **Project** | Your configured project key |
| **Summary** | `[Support #123] Original ticket title` |
| **Description** | See below |
| **Issue Type** | Your configured type (default: Task) |
| **Priority** | Mapped from support priority (see table below) |
| **Labels** | `support-ticket` |

### Description Format

```
*Support Ticket #123*

*Reporter:* John Customer (john@customer.com)
*Priority:* HIGH
*Tags:* bug, billing

*Description:*
The full ticket description text appears here exactly as
the customer wrote it, preserving all formatting.

_Created from SupportDesk ticket system_
```

---

## Priority Mapping

Support ticket priorities are automatically mapped to JIRA priorities:

| Support Priority | JIRA Priority |
|-----------------|---------------|
| **URGENT** | Highest |
| **HIGH** | High |
| **MEDIUM** | Medium |
| **LOW** | Low |

You can override the priority when using the API directly:

```bash
curl -X POST http://localhost:3001/api/v1/jira/create-issue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "ticket-uuid-here",
    "priority": "Highest",
    "issueType": "Bug"
  }'
```

---

## Troubleshooting

### "Could not connect to JIRA. Check your credentials."

**Cause:** The API connection test failed.

**Solutions:**
1. Verify the Base URL is correct (include `https://`, no trailing `/`)
   - Correct: `https://acmecorp.atlassian.net`
   - Wrong: `acmecorp.atlassian.net` or `https://acmecorp.atlassian.net/`
2. Ensure the email matches your Atlassian account exactly
3. Generate a fresh API token (old ones may be revoked)
4. Check that your Atlassian account has access to the JIRA project

### "Ticket already linked to JIRA issue DEV-42"

Each support ticket can only be linked to one JIRA issue. If you need to create another, you must do it directly in JIRA.

### "Failed to create JIRA issue: 400"

**Common causes:**
1. **Invalid project key** - Check that the project exists and you have create permission
2. **Invalid issue type** - The issue type must exist in the project's scheme (Task, Bug, Story, Epic)
3. **Required fields** - Your JIRA project may have required custom fields that aren't being set

**Debug:** Check the backend logs for the full JIRA API error response:
```bash
pm2 logs support-ticket-api --lines 50
```

### "JIRA integration is not configured"

No JIRA config exists for your organization. Go to Settings > JIRA Integration to set it up.

### Sync Status returns nothing

The JIRA issue may have been deleted, or the API token may have expired. Try:
1. Open the JIRA issue URL directly to verify it exists
2. Re-save the JIRA configuration with a fresh API token

### CORS or Network Errors

The JIRA API calls are made **server-side** (from your NestJS backend), not from the browser. So CORS is not an issue. Check:
- Backend server can reach the internet
- No firewall blocking outbound HTTPS to `atlassian.net`

---

## API Reference

### Save JIRA Configuration

```http
POST /api/v1/jira/config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "baseUrl": "https://acmecorp.atlassian.net",
  "email": "john@acmecorp.com",
  "apiToken": "ABcd1234efgh5678",
  "projectKey": "DEV",
  "issueType": "Task"
}
```

**Response:**
```json
{
  "id": "uuid",
  "baseUrl": "https://acmecorp.atlassian.net",
  "email": "john@acmecorp.com",
  "projectKey": "DEV",
  "issueType": "Task",
  "isActive": true,
  "organizationId": "org-uuid"
}
```

### Create JIRA Issue

```http
POST /api/v1/jira/create-issue
Authorization: Bearer <agent-or-admin-token>
Content-Type: application/json

{
  "ticketId": "support-ticket-uuid",
  "summary": "Optional custom summary",
  "description": "Optional custom description",
  "priority": "High",
  "issueType": "Bug"
}
```

**Response:**
```json
{
  "jiraIssueKey": "DEV-42",
  "jiraIssueUrl": "https://acmecorp.atlassian.net/browse/DEV-42",
  "message": "JIRA issue DEV-42 created successfully"
}
```

### Sync JIRA Status

```http
GET /api/v1/jira/sync/{ticketId}
Authorization: Bearer <agent-or-admin-token>
```

**Response:**
```json
{
  "jiraIssueKey": "DEV-42",
  "jiraStatus": "In Progress"
}
```

### Get JIRA Configuration

```http
GET /api/v1/jira/config
Authorization: Bearer <admin-token>
```

### Delete JIRA Configuration

```http
DELETE /api/v1/jira/config
Authorization: Bearer <admin-token>
```

---

## Advanced: Webhook for Auto-Sync

Instead of manually syncing JIRA status, you can set up a JIRA webhook to automatically push status changes.

### 1. Create a public endpoint

Add a webhook controller to the backend (no auth required since JIRA calls it):

```typescript
// In jira.controller.ts - add a public webhook endpoint
@Post('webhook')
@ApiOperation({ summary: 'JIRA webhook receiver (no auth)' })
async handleWebhook(@Body() body: any) {
  // body.issue.key = "DEV-42"
  // body.issue.fields.status.name = "Done"
  // Find ticket by jiraIssueKey and update jiraStatus
}
```

### 2. Register in JIRA

1. Go to **JIRA Settings** → **System** → **Webhooks**
2. Click **"Create a WebHook"**
3. URL: `https://api.yourdomain.com/api/v1/jira/webhook`
4. Events: Select **"Issue: updated"**
5. Filter: `project = DEV`
6. Save

Now when an engineer updates the JIRA issue status, the support ticket is automatically updated.

---

## Security Considerations

1. **API Token Storage** - Tokens are stored in the database. In production, consider using AWS Secrets Manager
2. **Token Permissions** - The API token has the same access as the JIRA account. Use a dedicated service account with minimal permissions
3. **Webhook Verification** - If using webhooks, add a shared secret and verify the `X-Atlassian-Webhook-Identifier` header
4. **Network Security** - JIRA API calls are made from your backend server. Ensure outbound HTTPS is allowed
5. **Audit Trail** - All JIRA actions are logged in the activity log with user and timestamp
