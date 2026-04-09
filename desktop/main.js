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
    console.log('Database path:', dbPath);

    if (!fs.existsSync(mainPath)) {
      const errMsg = `Backend not found: ${mainPath}`;
      console.error(errMsg);
      reject(new Error(errMsg));
      return;
    }

    // Persist JWT secrets across restarts using electron-store
    let store;
    try {
      const Store = require('electron-store');
      store = new Store();
      if (!store.get('jwtSecret')) {
        store.set('jwtSecret', 'desktop-' + require('crypto').randomBytes(32).toString('hex'));
        store.set('jwtRefreshSecret', 'desktop-refresh-' + require('crypto').randomBytes(32).toString('hex'));
      }
    } catch (e) {
      console.warn('electron-store not available, generating ephemeral secrets');
    }

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      DATABASE_URL: `file:${dbPath}`,
      JWT_SECRET: store?.get('jwtSecret') || 'desktop-' + require('crypto').randomBytes(16).toString('hex'),
      JWT_REFRESH_SECRET: store?.get('jwtRefreshSecret') || 'desktop-refresh-' + require('crypto').randomBytes(16).toString('hex'),
      JWT_EXPIRATION: '24h',
      JWT_REFRESH_EXPIRATION: '30d',
      FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
    };

    let resolved = false;
    let backendErrors = [];

    backendProcess = fork(mainPath, [], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], silent: true });

    backendProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Backend]', msg.trim());
      if (!resolved && (msg.includes('successfully started') || msg.includes('Server running'))) {
        resolved = true;
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (d) => {
      const msg = d.toString().trim();
      console.error('[Backend ERR]', msg);
      backendErrors.push(msg);
    });

    backendProcess.on('exit', (code) => {
      console.log(`Backend exited with code: ${code}`);
      if (!resolved) {
        resolved = true;
        const errorDetail = backendErrors.length > 0
          ? `\n\nBackend errors:\n${backendErrors.slice(-5).join('\n')}`
          : '';
        reject(new Error(`Backend process exited with code ${code} before becoming ready.${errorDetail}`));
        return;
      }
      if (!isQuitting) {
        console.log('Backend crashed, restarting in 3 seconds...');
        setTimeout(() => startBackend().catch(console.error), 3000);
      }
    });

    // Increased timeout from 15s to 30s for slower machines
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('Backend start timed out after 30s, proceeding anyway...');
        resolve();
      }
    }, 30000);
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
function waitForPort(port, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (attempts % 10 === 0) console.log(`Waiting for port ${port}... attempt ${attempts}/${maxRetries}`);
      const req = http.get(`http://localhost:${port}`, (res) => {
        console.log(`Port ${port} is ready (attempt ${attempts})`);
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxRetries) {
          reject(new Error(
            `Port ${port} not ready after ${maxRetries} attempts (${maxRetries / 2}s).\n\n` +
            `Possible causes:\n` +
            `- Another application is using port ${port}\n` +
            `- Antivirus is blocking the connection\n` +
            `- The service failed to start (check logs in: ${app.getPath('userData')})`
          ));
        } else {
          setTimeout(check, 500);
        }
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
    console.log('=== Starting SupportDesk ===');
    console.log('App path:', app.getAppPath());
    console.log('User data:', app.getPath('userData'));
    console.log('Is packaged:', app.isPackaged);

    await startBackend();
    await waitForPort(BACKEND_PORT);
    console.log('Backend ready on port', BACKEND_PORT);

    await startFrontend();
    await waitForPort(FRONTEND_PORT);
    console.log('Frontend ready on port', FRONTEND_PORT);
  } catch (err) {
    console.error('Startup failed:', err);
    dialog.showErrorBox(
      'SupportDesk - Startup Error',
      `Failed to start services.\n\n${err.message}\n\n` +
      `Troubleshooting:\n` +
      `1. Check if ports ${BACKEND_PORT}/${FRONTEND_PORT} are free\n` +
      `2. Try restarting the application\n` +
      `3. Check Windows Defender/antivirus settings\n` +
      `4. Data folder: ${app.getPath('userData')}`
    );
    stopAll();
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
