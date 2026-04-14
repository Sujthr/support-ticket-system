# Free Service Providers for Email, WhatsApp & Phone Integration

This guide covers **free (or free-tier) service providers** you can use to test and operate the support ticket system's multi-channel integrations without spending money.

---

## 1. Email (SMTP) — Outbound Notifications

The system uses SMTP (via Nodemailer) to send ticket notifications. Here are free options:

### Option A: Ethereal Email (Best for Development/Testing)

Ethereal is a fake SMTP service by Nodemailer — emails are captured but never delivered. Perfect for dev/testing.

- **Cost:** Completely free, no signup required
- **Limit:** Unlimited (emails are captured, not delivered)
- **How it works:** Auto-generate disposable SMTP credentials, send emails, view them in the Ethereal web UI

**Setup:**
1. Go to https://ethereal.email and click **"Create Ethereal Account"**
2. You'll get credentials like:
   ```
   Host: smtp.ethereal.email
   Port: 587
   User: abcdef@ethereal.email
   Pass: xyzXYZ123456
   ```
3. In the app → Settings → Email Configuration:
   - SMTP Host: `smtp.ethereal.email`
   - SMTP Port: `587`
   - SMTP User: (your generated user)
   - SMTP Pass: (your generated password)
   - From Email: (your generated email)
   - From Name: `Support Desk`
4. Click **Test Email** to verify
5. View captured emails at https://ethereal.email/messages

> **Tip:** The system also has a built-in Ethereal auto-setup endpoint (see below).

### Option B: Brevo (formerly Sendinblue) — Free Tier

- **Cost:** Free tier available
- **Limit:** 300 emails/day
- **Signup:** https://www.brevo.com

**Setup:**
1. Create a free Brevo account
2. Go to SMTP & API → SMTP Settings
3. Get your credentials:
   ```
   Host: smtp-relay.brevo.com
   Port: 587
   User: (your login email)
   Pass: (your SMTP key)
   ```
4. Configure in app Settings → Email Configuration

### Option C: Gmail SMTP (Personal Use)

- **Cost:** Free with Gmail account
- **Limit:** 500 emails/day
- **Requires:** Gmail account + App Password (2FA must be enabled)

**Setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password for "Mail"
4. Configure:
   ```
   Host: smtp.gmail.com
   Port: 587
   User: your-email@gmail.com
   Pass: (16-char app password)
   ```

### Option D: Mailtrap (Testing)

- **Cost:** Free tier
- **Limit:** 100 emails/month
- **Signup:** https://mailtrap.io

**Setup:**
1. Create free account at mailtrap.io
2. Go to Email Testing → Inboxes → SMTP Settings
3. Copy credentials and configure in app

---

## 2. Inbound Email (IMAP) — Ticket Creation from Email

The system polls IMAP mailboxes every minute to create tickets from incoming emails.

### Option A: Gmail IMAP (Recommended Free Option)

- **Cost:** Free with Gmail account
- **Limit:** Unlimited reads

**Setup:**
1. Enable IMAP in Gmail: Settings → Forwarding and POP/IMAP → Enable IMAP
2. Enable 2FA and generate an App Password (same as SMTP above)
3. Configure in app → Settings → Channels → Inbound Email:
   ```
   IMAP Host: imap.gmail.com
   IMAP Port: 993
   IMAP User: your-email@gmail.com
   IMAP Pass: (16-char app password)
   TLS: Enabled
   ```
4. Click **Test Connection** to verify
5. Send an email to that Gmail address — a ticket should appear within 1 minute

### Option B: Outlook.com / Hotmail IMAP

- **Cost:** Free with Microsoft account
- **Limit:** Unlimited reads

**Setup:**
```
IMAP Host: outlook.office365.com
IMAP Port: 993
IMAP User: your-email@outlook.com
IMAP Pass: your password (or app password if 2FA enabled)
TLS: Enabled
```

### Option C: Zoho Mail

- **Cost:** Free tier (5 users, 5GB)
- **Limit:** Unlimited
- **Signup:** https://www.zoho.com/mail/

```
IMAP Host: imap.zoho.com
IMAP Port: 993
TLS: Enabled
```

---

## 3. WhatsApp Integration — Ticket Creation from WhatsApp

### Option A: Twilio WhatsApp Sandbox (Best for Testing)

Twilio provides a **free WhatsApp sandbox** for testing — no payment required.

- **Cost:** Completely free for sandbox testing
- **Limit:** Sandbox only (test numbers), no production WhatsApp
- **Signup:** https://www.twilio.com/try-twilio

**Step-by-step Setup:**

1. **Create Twilio account** at https://www.twilio.com/try-twilio
   - No credit card required for sandbox
   - You'll get Account SID and Auth Token from the Console Dashboard

2. **Activate WhatsApp Sandbox:**
   - Go to Console → Messaging → Try it Out → Send a WhatsApp Message
   - You'll see a sandbox number like `+1 415 523 8886`
   - Send the join code (e.g., `join <your-code>`) from your WhatsApp to this number

3. **Configure Webhook URL:**
   - In the Twilio Console WhatsApp Sandbox settings, set:
     ```
     WHEN A MESSAGE COMES IN: https://your-domain.com/api/v1/webhooks/twilio/whatsapp
     ```
   - For local development, use **ngrok** to expose your local server:
     ```bash
     ngrok http 3001
     # Use the https URL provided, e.g.:
     # https://abc123.ngrok.io/api/v1/webhooks/twilio/whatsapp
     ```

4. **Configure in app** → Settings → Channels → Twilio:
   - Twilio Enabled: Yes
   - Account SID: (from Console Dashboard)
   - Auth Token: (from Console Dashboard)
   - Phone Number: `+14155238886` (sandbox number)

5. **Test:** Send a WhatsApp message to the sandbox number — a ticket should be created

### Option B: Meta WhatsApp Cloud API (Free Tier)

Meta provides **1,000 free service conversations per month**.

- **Cost:** 1,000 free conversations/month
- **Limit:** Test mode with up to 5 test phone numbers
- **Signup:** https://developers.facebook.com

**Step-by-step Setup:**

1. **Create Meta Developer account** at https://developers.facebook.com
2. **Create a new App:**
   - Type: Business
   - Add WhatsApp product
3. **Get credentials from WhatsApp → API Setup:**
   - Temporary Access Token (valid 24h, regenerate as needed)
   - Phone Number ID
   - WhatsApp Business Account ID
4. **Add test phone numbers:**
   - WhatsApp → API Setup → Add phone number (up to 5 free)
5. **Configure Webhook:**
   - WhatsApp → Configuration → Webhook
   - Callback URL: `https://your-domain.com/api/v1/webhooks/meta/whatsapp`
   - Verify Token: (choose any string, e.g., `my-verify-token-123`)
   - Subscribe to: `messages`
6. **Configure in app** → Settings → Channels → Meta WhatsApp:
   - Meta WhatsApp Enabled: Yes
   - Access Token: (from API Setup)
   - Phone Number ID: (from API Setup)
   - Verify Token: (same string you set in webhook config)
   - Business ID: (from API Setup)

7. **Test:** Send a WhatsApp message from a test number to your WhatsApp Business number

---

## 4. Phone/Voice (Twilio) — Ticket Creation from Phone Calls

### Twilio Free Trial

- **Cost:** Free trial with **$15.50 credit** (no credit card for signup)
- **Limit:** Trial credit covers ~500 minutes of calls
- **Limitation:** Trial accounts can only call/receive from verified numbers

**Step-by-step Setup:**

1. **Create Twilio account** (same as WhatsApp above)
2. **Get a phone number:**
   - Console → Phone Numbers → Buy a Number (uses trial credit, ~$1/month)
   - Choose a local number with Voice capability
3. **Configure Voice Webhook:**
   - Phone Numbers → Manage → Active Numbers → Click your number
   - Voice Configuration:
     ```
     A CALL COMES IN: Webhook
     URL: https://your-domain.com/api/v1/webhooks/twilio/voice
     HTTP POST
     
     CALL STATUS CHANGES:
     URL: https://your-domain.com/api/v1/webhooks/twilio/voice/status
     HTTP POST
     ```
4. **Configure in app** → Settings → Channels → Twilio:
   - Same credentials as WhatsApp
   - Phone Number: your purchased number (e.g., `+12025551234`)
   - Record Calls: Yes/No (optional)

5. **Test:** Call your Twilio number — you'll hear the automated greeting and a ticket will be created

> **For local development:** Use ngrok to expose port 3001:
> ```bash
> ngrok http 3001
> ```
> Then use the ngrok HTTPS URL for webhook configuration.

---

## 5. Local Development: ngrok for Webhooks

All webhook-based integrations (Twilio, Meta WhatsApp) require a publicly accessible URL. For local development, use **ngrok**:

### Setup ngrok (Free Tier)

1. **Sign up** at https://ngrok.com (free plan available)
2. **Install:**
   ```bash
   # Windows (via Chocolatey)
   choco install ngrok
   
   # Or download from https://ngrok.com/download
   ```
3. **Authenticate:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
4. **Start tunnel:**
   ```bash
   ngrok http 3001
   ```
5. **Use the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`) in all webhook configurations

> **Note:** Free ngrok URLs change on restart. Update webhook URLs accordingly, or upgrade to a paid plan for a fixed subdomain.

---

## Summary Table

| Service | Provider | Free Tier | Limit | Best For |
|---------|----------|-----------|-------|----------|
| **SMTP (Outbound Email)** | Ethereal | Yes, no signup | Unlimited (not delivered) | Development |
| | Brevo | Yes | 300/day | Staging/Small prod |
| | Gmail | Yes | 500/day | Small production |
| | Mailtrap | Yes | 100/month | Testing |
| **IMAP (Inbound Email)** | Gmail | Yes | Unlimited | Dev + Production |
| | Outlook.com | Yes | Unlimited | Dev + Production |
| **WhatsApp** | Twilio Sandbox | Yes, no card | Sandbox only | Development |
| | Meta Cloud API | Yes | 1000 conv/month | Dev + Small prod |
| **Phone/Voice** | Twilio Trial | $15.50 credit | ~500 min | Development |
| **Webhook Tunnel** | ngrok | Yes | Dynamic URLs | Local development |
