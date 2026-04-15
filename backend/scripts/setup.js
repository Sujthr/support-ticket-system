#!/usr/bin/env node
/**
 * One-shot fresh-clone setup: copy .env.example → .env if missing,
 * run migrations, seed demo data, ensure upload directories exist.
 *
 *     npm run setup
 *
 * Idempotent — safe to re-run.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const ENV_FILE = path.join(BACKEND, '.env');
const ENV_EXAMPLE = path.join(BACKEND, '.env.example');
const UPLOADS = path.join(BACKEND, 'uploads');

function log(msg) { console.log(`[setup] ${msg}`); }
function run(cmd) { execSync(cmd, { cwd: BACKEND, stdio: 'inherit' }); }

// 1. .env
if (!fs.existsSync(ENV_FILE)) {
  if (fs.existsSync(ENV_EXAMPLE)) {
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    log('created .env from .env.example');
    log('WARNING: default JWT secrets are placeholders — replace before production');
  } else {
    log('no .env.example found; skipping .env creation');
  }
} else {
  log('.env already exists');
}

// 2. Upload dirs
for (const dir of ['attachments', 'logos']) {
  const full = path.join(UPLOADS, dir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
    log(`created ${full}`);
  }
}

// 3. Prisma: generate, migrate, seed
log('generating prisma client...');
run('npx prisma generate');

log('running migrations (db push, dev-safe)...');
try {
  run('npx prisma migrate deploy');
} catch {
  log('migrate deploy failed; falling back to db push');
  run('npx prisma db push --accept-data-loss');
}

log('seeding demo data...');
try {
  run('npx prisma db seed');
} catch (err) {
  log('seed failed (may already be seeded): ' + err.message);
}

log('done. Start backend with: npm run start:dev');
