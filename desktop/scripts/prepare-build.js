/**
 * Prepare Build Script for Electron Packaging
 *
 * 1. Builds NestJS backend
 * 2. Builds Next.js frontend (standalone mode)
 * 3. Stages app-backend/ with a CLEAN production-only node_modules
 *    (the previous approach of copying the dev node_modules was fragile —
 *     if any dep was missing or the tree was half-pruned, electron-builder
 *     packaged a broken backend and the installer failed at runtime with
 *     "Cannot find module '@nestjs/core'")
 * 4. Copies frontend standalone into desktop/
 * 5. Verifies critical modules are present before handing off to electron-builder
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

const CRITICAL_MODULES = [
  '@nestjs/core',
  '@nestjs/common',
  '@nestjs/platform-express',
  '@prisma/client',
  'reflect-metadata',
  'rxjs',
];

function run(cmd, cwd) {
  console.log(`\n> ${cmd}  (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) { console.warn(`Not found: ${src}`); return; }
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function assertModule(modName) {
  const p = path.join(BACKEND_DEST, 'node_modules', modName, 'package.json');
  if (!fs.existsSync(p)) {
    throw new Error(`FATAL: required module missing after production install: ${modName} (expected at ${p})`);
  }
}

console.log('='.repeat(60));
console.log('  SupportDesk Desktop Build Preparation');
console.log('='.repeat(60));

// ─── Step 1: Build backend ──────────────────────────────────────
console.log('\n[1/5] Building backend...');
run('npx prisma generate', BACKEND_SRC);
run('npx nest build', BACKEND_SRC);

// ─── Step 2: Build frontend ─────────────────────────────────────
console.log('\n[2/5] Building frontend (standalone)...');
const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:3051/api/v1`;
const isWin = process.platform === 'win32';
if (isWin) {
  run(`set ${frontendEnv} && npx next build`, FRONTEND_SRC);
} else {
  run(`${frontendEnv} npx next build`, FRONTEND_SRC);
}

// ─── Step 3: Stage app-backend with clean production deps ───────
console.log('\n[3/5] Staging app-backend with production-only deps...');
if (fs.existsSync(BACKEND_DEST)) fs.rmSync(BACKEND_DEST, { recursive: true });
fs.mkdirSync(BACKEND_DEST, { recursive: true });

copyDir(path.join(BACKEND_SRC, 'dist'), path.join(BACKEND_DEST, 'dist'));
copyDir(path.join(BACKEND_SRC, 'prisma'), path.join(BACKEND_DEST, 'prisma'));
fs.copyFileSync(path.join(BACKEND_SRC, 'package.json'), path.join(BACKEND_DEST, 'package.json'));

const lockSrc = path.join(BACKEND_SRC, 'package-lock.json');
if (fs.existsSync(lockSrc)) {
  fs.copyFileSync(lockSrc, path.join(BACKEND_DEST, 'package-lock.json'));
}

// Strip `prepare` / `postinstall` scripts that require a full dev tree
// so `npm ci --omit=dev` doesn't invoke husky / nest build / etc.
const pkgJsonPath = path.join(BACKEND_DEST, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
if (pkg.scripts) {
  delete pkg.scripts.prepare;
  delete pkg.scripts.postinstall;
  delete pkg.scripts.prepublish;
}
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

// Clean production install — this guarantees @nestjs/core et al. are present
// regardless of how messy the upstream backend/node_modules is.
const installCmd = fs.existsSync(path.join(BACKEND_DEST, 'package-lock.json'))
  ? 'npm ci --omit=dev --ignore-scripts'
  : 'npm install --omit=dev --ignore-scripts';
run(installCmd, BACKEND_DEST);

// Regenerate the Prisma client inside the staged directory so the engine
// binaries and generated client live alongside the backend we'll ship.
run('npx prisma generate', BACKEND_DEST);

// ─── Step 4: Verify critical modules ────────────────────────────
console.log('\n[4/5] Verifying critical modules...');
for (const m of CRITICAL_MODULES) {
  assertModule(m);
  console.log(`   ✓ ${m}`);
}

// ─── Step 5: Copy frontend standalone ───────────────────────────
console.log('\n[5/5] Copying frontend standalone...');
if (fs.existsSync(FRONTEND_DEST)) fs.rmSync(FRONTEND_DEST, { recursive: true });
fs.mkdirSync(FRONTEND_DEST, { recursive: true });

const standalonePath = path.join(FRONTEND_SRC, '.next', 'standalone');
if (fs.existsSync(standalonePath)) {
  copyDir(standalonePath, FRONTEND_DEST);
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
