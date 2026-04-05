const { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const { fork, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

// ─── Configuration ──────────────────────────────────────────
const BACKEND_PORT = 3051;
const FRONTEND_PORT = 3052;
const APP_NAME = 'SupportDesk';
const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let isQuitting = false;

// ─── Paths ──────────────────────────────────────────────────
function getBackendMain() {
  if (isDev) return path.join(__dirname, '..', 'backend', 'dist', 'src', 'main.js');
  return path.join(__dirname, 'app-backend', 'dist', 'src', 'main.js');
}

function getFrontendServer() {
  if (isDev) return path.join(__dirname, '..', 'frontend', '.next', 'standalone', 'server.js');
  return path.join(__dirname, 'app-frontend', 'server.js');
}

function getDbPath() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'data', 'supportdesk.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    const seedDb = isDev
      ? path.join(__dirname, '..', 'backend', 'prisma', 'dev.db')
      : path.join(process.resourcesPath, 'prisma', 'dev.db');

    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, dbPath);
      console.log('Initialized database from seed');
    }
  }

  return dbPath;
}

// ─── Splash Screen ──────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400, height: 320,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// ─── Main Window ────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    title: APP_NAME, show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const menuTemplate = [
    { label: APP_NAME, submenu: [
      { label: `About ${APP_NAME}`, role: 'about' },
      { type: 'separator' },
      { label: 'Open Data Folder', click: () => shell.openPath(app.getPath('userData')) },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } },
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
      { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      ...(isDev ? [{ role: 'toggleDevTools' }] : []),
    ]},
    { label: 'Help', submenu: [
      { label: 'API Documentation', click: () => shell.openExternal(`http://localhost:${BACKEND_PORT}/api/docs`) },
      { label: 'GitHub Repository', click: () => shell.openExternal('https://github.com/Sujthr/support-ticket-system') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

// ─── System Tray ────────────────────────────────────────────
function createTray() {
  const trayIcon = nativeImage.createEmpty();
  tray = new Tray(trayIcon);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open SupportDesk', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'API Docs', click: () => shell.openExternal(`http://localhost:${BACKEND_PORT}/api/docs`) },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ─── Start Backend ──────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const mainPath = getBackendMain();
    const dbPath = getDbPath();
    console.log('Starting backend:', mainPath);

    if (!fs.existsSync(mainPath)) {
      reject(new Error(`Backend not found: ${mainPath}`));
      return;
    }

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      DATABASE_URL: `file:${dbPath}`,
      JWT_SECRET: 'desktop-' + require('crypto').randomBytes(16).toString('hex'),
      JWT_REFRESH_SECRET: 'desktop-refresh-' + require('crypto').randomBytes(16).toString('hex'),
      JWT_EXPIRATION: '24h',
      JWT_REFRESH_EXPIRATION: '30d',
      FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
    };

    backendProcess = fork(mainPath, [], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], silent: true });

    backendProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Backend]', msg.trim());
      if (msg.includes('successfully started') || msg.includes('Server running')) resolve();
    });

    backendProcess.stderr?.on('data', (d) => console.error('[Backend]', d.toString().trim()));
    backendProcess.on('exit', (code) => {
      console.log(`Backend exited: ${code}`);
      if (!isQuitting) setTimeout(() => startBackend().catch(console.error), 3000);
    });

    setTimeout(resolve, 15000);
  });
}

// ─── Start Frontend ─────────────────────────────────────────
function startFrontend() {
  return new Promise((resolve, reject) => {
    const serverPath = getFrontendServer();
    console.log('Starting frontend:', serverPath);

    if (!fs.existsSync(serverPath)) {
      // Fallback: if standalone server doesn't exist, point to dev server
      console.warn('Standalone frontend not found, using dev mode');
      resolve();
      return;
    }

    const env = {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      HOSTNAME: 'localhost',
      NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}/api/v1`,
    };

    frontendProcess = fork(serverPath, [], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], silent: true });

    frontendProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Frontend]', msg.trim());
      if (msg.includes('Ready') || msg.includes('started') || msg.includes('localhost')) resolve();
    });

    frontendProcess.stderr?.on('data', (d) => console.error('[Frontend]', d.toString().trim()));
    frontendProcess.on('exit', (code) => {
      console.log(`Frontend exited: ${code}`);
      if (!isQuitting) setTimeout(() => startFrontend().catch(console.error), 3000);
    });

    setTimeout(resolve, 10000);
  });
}

// ─── Wait for port ──────────────────────────────────────────
function waitForPort(port, maxRetries = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, (res) => resolve());
      req.on('error', () => {
        if (attempts >= maxRetries) reject(new Error(`Port ${port} not ready`));
        else setTimeout(check, 500);
      });
      req.end();
    };
    check();
  });
}

// ─── Cleanup ────────────────────────────────────────────────
function stopAll() {
  if (backendProcess) { backendProcess.kill('SIGTERM'); backendProcess = null; }
  if (frontendProcess) { frontendProcess.kill('SIGTERM'); frontendProcess = null; }
}

// ─── App Lifecycle ──────────────────────────────────────────
app.on('ready', async () => {
  createSplashWindow();

  try {
    await startBackend();
    await waitForPort(BACKEND_PORT);
    console.log('Backend ready');

    await startFrontend();
    await waitForPort(FRONTEND_PORT);
    console.log('Frontend ready');
  } catch (err) {
    console.error('Startup failed:', err);
    dialog.showErrorBox('Startup Error', `Failed to start services.\n\n${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
  createTray();
});

app.on('before-quit', () => { isQuitting = true; stopAll(); });
app.on('window-all-closed', () => {});
app.on('activate', () => {
  if (!mainWindow) createMainWindow();
  else mainWindow.show();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });
}
