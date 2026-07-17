#!/usr/bin/env node
/**
 * Cross-platform test launcher for npm test.
 *
 * Why not a quoted shell glob?
 * - On Windows, npm passes the quoted glob literally and Node finds 0 files.
 * - Bare directory args (node --test tests) are unreliable across Node 22/24.
 *
 * This script walks tests/ + test/ and passes absolute paths to node --test.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function collectTestFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectTestFiles(abs, acc);
    } else if (name.endsWith('.test.js')) {
      acc.push(abs);
    }
  }
  return acc;
}

const files = [
  ...collectTestFiles(join(ROOT, 'tests')),
  ...collectTestFiles(join(ROOT, 'test')),
].sort();

if (files.length === 0) {
  console.error('run-tests: no *.test.js files found under tests/ or test/');
  process.exit(2);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
