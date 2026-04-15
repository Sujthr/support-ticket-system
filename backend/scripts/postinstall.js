#!/usr/bin/env node
/**
 * Idempotent postinstall: generate the Prisma client so fresh clones
 * can compile without a separate manual step. Deliberately non-fatal —
 * if the user has a partial install or is in CI with skipped deps, we
 * warn but do not break `npm install`.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Skip inside electron-builder's staged install (prepare-build.js already
// runs `prisma generate` in that directory with --ignore-scripts set).
if (process.env.ELECTRON_BUILDER_STAGED === '1') {
  console.log('[postinstall] skipped (staged build)');
  process.exit(0);
}

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.log('[postinstall] no prisma schema, skipping');
  process.exit(0);
}

try {
  execSync('npx prisma generate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  console.log('[postinstall] prisma client generated');
} catch (err) {
  console.warn('[postinstall] prisma generate failed (non-fatal):', err.message);
  console.warn('[postinstall] run `npx prisma generate` manually before starting the backend');
}
