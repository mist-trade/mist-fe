#!/usr/bin/env node

/**
 * Sync test data from backend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  backendPath: process.env.BACKEND_PATH || path.resolve(__dirname, '../../mist'),
  targetDir: path.resolve(__dirname, '../test-data/results/json'),
  typeTargetDir: path.resolve(__dirname, '../test-data/results/types'),
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function checkBackend() {
  log(colors.blue, '🔍 Checking backend repository...');

  if (!fs.existsSync(CONFIG.backendPath)) {
    log(colors.red, '❌ Backend repository not found:', CONFIG.backendPath);
    process.exit(1);
  }

  const backendResultsDir = path.join(CONFIG.backendPath, 'test-data/test-results/raw');
  if (!fs.existsSync(backendResultsDir)) {
    log(colors.yellow, '⚠️  Backend test results not found');
    log(colors.yellow, '💡 Hint: Run pnpm run test in backend first');
    return false;
  }

  log(colors.green, '✅ Backend repository found');
  return true;
}

function syncJsonFiles() {
  log(colors.blue, '📦 Syncing JSON files...');

  const backendResultsDir = path.join(CONFIG.backendPath, 'test-data/test-results/raw');

  if (!fs.existsSync(CONFIG.targetDir)) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
  }

  let syncedCount = 0;

  const files = fs.readdirSync(backendResultsDir).filter(f => f.endsWith('.json'));

  files.forEach(file => {
    const sourcePath = path.join(backendResultsDir, file);
    const targetPath = path.join(CONFIG.targetDir, file);

    fs.copyFileSync(sourcePath, targetPath);
    log(colors.green, `  ✓ ${file}`);
    syncedCount++;
  });

  log(colors.green, `✅ Synced ${syncedCount} files`);
}

function syncTypeDefinitions() {
  log(colors.blue, '📝 Syncing type definitions...');

  const backendTypesDir = path.join(CONFIG.backendPath, 'test-data/test-results/types');

  if (!fs.existsSync(CONFIG.typeTargetDir)) {
    fs.mkdirSync(CONFIG.typeTargetDir, { recursive: true });
  }

  if (!fs.existsSync(backendTypesDir)) {
    log(colors.yellow, '⚠️  Backend types not found, skipping');
    return;
  }

  let syncedCount = 0;

  const files = fs.readdirSync(backendTypesDir).filter(f => f.endsWith('.ts'));

  files.forEach(file => {
    const sourcePath = path.join(backendTypesDir, file);
    const targetPath = path.join(CONFIG.typeTargetDir, file);

    fs.copyFileSync(sourcePath, targetPath);
    syncedCount++;
  });

  log(colors.green, `✅ Synced ${syncedCount} type files`);
}

function updateIndexFile() {
  log(colors.blue, '📝 Updating index file...');

  const files = fs.readdirSync(CONFIG.typeTargetDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts');

  const exports = files.map(file => {
    const basename = path.basename(file, '.ts');
    return `export * from './${basename}';`;
  }).join('\n');

  const content = `/**
 * Test Results Type Definitions
 *
 * @last-updated ${new Date().toISOString()}
 */

${exports}
`;

  fs.writeFileSync(path.join(CONFIG.typeTargetDir, 'index.ts'), content);
  log(colors.green, '✅ Index file updated');
}

function main() {
  console.log(colors.blue, '🎯 Syncing test data from backend...\n');

  try {
    const backendExists = checkBackend();
    if (backendExists) {
      syncJsonFiles();
      syncTypeDefinitions();
      updateIndexFile();

      const jsonCount = fs.readdirSync(CONFIG.targetDir).length;
      log(colors.green, `\n🎉 Sync complete! ${jsonCount} result files`);
    }
  } catch (error) {
    log(colors.red, '\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
