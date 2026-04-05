/**
 * Prepare Build Script for Electron Packaging
 *
 * 1. Builds NestJS backend
 * 2. Builds Next.js frontend (standalone mode)
 * 3. Copies into desktop/ for electron-builder
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DESKTOP = path.join(__dirname, '..');
const BACKEND_SRC = path.join(ROOT, 'backend');
const FRONTEND_SRC = path.join(ROOT, 'frontend');
const BACKEND_DEST = path.join(DESKTOP, 'app-backend');
const FRONTEND_DEST = path.join(DESKTOP, 'app-frontend');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) { console.warn(`Not found: ${src}`); return; }
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log('='.repeat(60));
console.log('  SupportDesk Desktop Build Preparation');
console.log('='.repeat(60));

// Step 1: Build Backend
console.log('\n[1/4] Building backend...');
run('npx prisma generate', BACKEND_SRC);
run('npx nest build', BACKEND_SRC);

// Step 2: Build Frontend (standalone)
console.log('\n[2/4] Building frontend (standalone)...');
const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:3051/api/v1`;
const isWin = process.platform === 'win32';
if (isWin) {
  run(`set ${frontendEnv} && npx next build`, FRONTEND_SRC);
} else {
  run(`${frontendEnv} npx next build`, FRONTEND_SRC);
}

// Step 3: Copy backend
console.log('\n[3/4] Copying backend...');
if (fs.existsSync(BACKEND_DEST)) fs.rmSync(BACKEND_DEST, { recursive: true });
fs.mkdirSync(BACKEND_DEST, { recursive: true });

copyDir(path.join(BACKEND_SRC, 'dist'), path.join(BACKEND_DEST, 'dist'));
copyDir(path.join(BACKEND_SRC, 'node_modules'), path.join(BACKEND_DEST, 'node_modules'));
copyDir(path.join(BACKEND_SRC, 'prisma'), path.join(BACKEND_DEST, 'prisma'));
fs.copyFileSync(path.join(BACKEND_SRC, 'package.json'), path.join(BACKEND_DEST, 'package.json'));

// Step 4: Copy frontend standalone
console.log('\n[4/4] Copying frontend standalone...');
if (fs.existsSync(FRONTEND_DEST)) fs.rmSync(FRONTEND_DEST, { recursive: true });
fs.mkdirSync(FRONTEND_DEST, { recursive: true });

const standalonePath = path.join(FRONTEND_SRC, '.next', 'standalone');
if (fs.existsSync(standalonePath)) {
  // Copy standalone server
  copyDir(standalonePath, FRONTEND_DEST);
  // Copy static assets
  copyDir(path.join(FRONTEND_SRC, '.next', 'static'), path.join(FRONTEND_DEST, '.next', 'static'));
  copyDir(path.join(FRONTEND_SRC, 'public'), path.join(FRONTEND_DEST, 'public'));
} else {
  console.error('ERROR: Standalone build not found. Ensure next.config.js has output: "standalone"');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('  Build preparation complete!');
console.log('  Run: npm run dist:win');
console.log('='.repeat(60));
