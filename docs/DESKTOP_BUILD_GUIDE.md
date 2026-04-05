# Desktop Application Build Guide

Build SupportDesk as a standalone Windows desktop application with an `.exe` installer.

---

## Overview

The desktop build bundles:
- **Electron** shell (Chromium-based window)
- **NestJS backend** (runs as embedded process)
- **Next.js frontend** (static HTML export)
- **SQLite database** (stored in user's AppData)

The result is a single installer that requires no internet, no Node.js, no database server.

---

## Prerequisites

- Node.js 18+ installed
- npm 9+
- Windows 10/11 (for building Windows installer)

---

## Quick Build

```bash
# 1. Install all dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd desktop && npm install && cd ..

# 2. Build backend
cd backend
npx prisma generate
npm run build
cd ..

# 3. Build frontend (static export)
cd frontend
npx cross-env NEXT_BUILD_MODE=export NEXT_PUBLIC_API_URL=http://localhost:3051/api/v1 next build
cd ..

# 4. Prepare and package
cd desktop
node scripts/prepare-build.js
npm run dist:win
```

The installer will be at: `desktop/dist/SupportDesk-Setup-1.0.0.exe`

---

## How It Works

### Architecture

```
┌──────────────────────────────────────┐
│          Electron Shell              │
│  ┌────────────────────────────────┐  │
│  │    BrowserWindow (Chromium)    │  │
│  │    ┌────────────────────────┐  │  │
│  │    │  Next.js Static HTML   │  │  │
│  │    │  (frontend/out/)       │  │  │
│  │    └──────────┬─────────────┘  │  │
│  └───────────────┼────────────────┘  │
│                  │ HTTP (port 3051)   │
│  ┌───────────────▼────────────────┐  │
│  │    NestJS Backend (forked)     │  │
│  │    ┌──────────────────────┐    │  │
│  │    │   SQLite Database    │    │  │
│  │    │   (in AppData)       │    │  │
│  │    └──────────────────────┘    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Startup Sequence

1. Electron starts → shows splash screen
2. Backend process is forked (NestJS on port 3051)
3. Electron waits for backend health check
4. Main window loads static HTML frontend
5. Splash screen closes, main window shows
6. System tray icon created

### Data Storage

- Database: `%APPDATA%/SupportDesk/data/supportdesk.db`
- On first run, a seed database is copied with demo data
- Database persists across app updates

---

## File Structure

```
desktop/
├── main.js              # Electron main process
├── preload.js           # Secure bridge to renderer
├── splash.html          # Loading screen
├── package.json         # Electron + builder config
├── assets/
│   └── icon.svg         # App icon (convert to .ico for build)
├── scripts/
│   └── prepare-build.js # Build preparation script
├── app-backend/         # (generated) Backend dist + deps
├── app-frontend/        # (generated) Frontend static HTML
└── dist/                # (generated) Installer output
```

---

## Creating the App Icon

The app icon needs to be in `.ico` format for Windows. Convert `assets/icon.svg`:

### Option A: Online converter
1. Go to https://convertio.co/svg-ico/
2. Upload `desktop/assets/icon.svg`
3. Download as `icon.ico`
4. Place in `desktop/assets/icon.ico`

### Option B: Using ImageMagick
```bash
magick convert assets/icon.svg -resize 256x256 assets/icon.ico
```

### Option C: Using the SVG directly
electron-builder will attempt to use SVG and auto-convert, but `.ico` is more reliable.

---

## Configuration

### Changing the Backend Port

In `desktop/main.js`, line 7:
```javascript
const BACKEND_PORT = 3051;  // Change this
```

Also update the frontend build command to match:
```bash
NEXT_PUBLIC_API_URL=http://localhost:YOUR_PORT/api/v1
```

### Changing the App Name

In `desktop/package.json`:
```json
{
  "name": "your-app-name",
  "build": {
    "productName": "Your App Name",
    "appId": "com.yourcompany.app"
  }
}
```

### Changing the Splash Screen

Edit `desktop/splash.html` — it's a simple HTML file with inline CSS.

---

## Installer Options

### NSIS (Windows)
The default Windows installer uses NSIS. Configuration in `desktop/package.json`:

```json
"nsis": {
  "oneClick": false,              // Show install wizard
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "SupportDesk"
}
```

### One-Click Installer
For a simpler one-click install:
```json
"nsis": {
  "oneClick": true
}
```

---

## Dual Deployment

The same codebase supports both deployment modes:

| Feature | Desktop (Electron) | Cloud (AWS) |
|---------|-------------------|-------------|
| Database | SQLite (embedded) | PostgreSQL (RDS) |
| Frontend | Static HTML files | Vercel / S3+CloudFront |
| Backend | Forked Node process | EC2 / ECS |
| Port | 3051 (internal) | 3001 (behind Nginx) |
| Auth | Same JWT system | Same JWT system |
| Updates | Manual reinstall | CI/CD pipeline |

### Switching Between Modes

The only differences:
- `DATABASE_URL`: `file:./path.db` (desktop) vs `postgresql://...` (cloud)
- `NEXT_BUILD_MODE`: `export` (desktop) vs normal build (cloud)
- Frontend API URL: `http://localhost:3051` (desktop) vs `https://api.domain.com` (cloud)

---

## Troubleshooting

### "Backend failed to start"
- Check if port 3051 is already in use: `netstat -an | findstr 3051`
- Check logs: Help menu → Open Data Folder → look for crash logs

### "Database not found"
- First run should auto-create from seed
- Manual fix: copy `backend/prisma/dev.db` to `%APPDATA%/SupportDesk/data/supportdesk.db`

### Build fails with "icon.ico not found"
- Convert `assets/icon.svg` to `assets/icon.ico` (see "Creating the App Icon" above)
- Or remove the `icon` field from the NSIS config to use default icon

### App starts but shows blank page
- The frontend wasn't exported. Run:
  ```bash
  cd frontend
  npx cross-env NEXT_BUILD_MODE=export NEXT_PUBLIC_API_URL=http://localhost:3051/api/v1 next build
  ```
- Check `frontend/out/index.html` exists

### Large installer size
The full installer is ~150-200MB due to bundled Node.js + Chromium. To reduce:
- Use `npm prune --production` in backend before copying
- Use electron-builder's `asar` compression (enabled by default)
