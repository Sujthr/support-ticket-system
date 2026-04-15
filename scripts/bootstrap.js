#!/usr/bin/env node
/**
 * Root bootstrap — one command after `git clone`:
 *
 *     node scripts/bootstrap.js
 *
 * Installs all three workspaces (backend, frontend, desktop), then runs the
 * backend setup routine (env, prisma generate, migrate, seed, upload dirs).
 *
 * Prints a FATAL message and exits non-zero on any step that fails.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STEPS = [
  { name: 'backend',  dir: path.join(ROOT, 'backend'),  cmd: 'npm install' },
  { name: 'frontend', dir: path.join(ROOT, 'frontend'), cmd: 'npm install' },
  { name: 'desktop',  dir: path.join(ROOT, 'desktop'),  cmd: 'npm install' },
  { name: 'backend-setup', dir: path.join(ROOT, 'backend'), cmd: 'npm run setup' },
];

function log(level, msg) { console.log(`[bootstrap] [${level}] ${msg}`); }

// Node version check
const required = 18;
const actual = parseInt(process.versions.node.split('.')[0], 10);
if (actual < required) {
  log('FATAL', `Node ${required}+ required; found ${process.versions.node}`);
  process.exit(1);
}
log('LOW', `node ${process.versions.node} OK`);

for (const step of STEPS) {
  if (!fs.existsSync(step.dir)) {
    log('HIGH', `skip ${step.name}: directory missing (${step.dir})`);
    continue;
  }
  log('MEDIUM', `${step.name}: ${step.cmd}`);
  try {
    execSync(step.cmd, { cwd: step.dir, stdio: 'inherit' });
  } catch (err) {
    log('FATAL', `${step.name} failed: ${err.message}`);
    process.exit(1);
  }
}

log('LOW', 'bootstrap complete — start backend: cd backend && npm run start:dev');
log('LOW', 'start frontend: cd frontend && npm run dev');
