#!/usr/bin/env node
/**
 * PreToolUse decision for the --automate pen.
 * Exit 0 allows. Exit 2 denies. Fail-closed while the pen lock is held.
 *
 * Stdin: host hook payload (tool_name / tool_input).
 * Lock: AUTOMATE_PEN_LOCK or <cwd>/.atomic-skills/status/automate/pen.lock
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decidePen } from '../src/automate-host-pen.js';

const raw = await new Promise((resolvePromise) => {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
  process.stdin.on('error', () => resolvePromise(''));
});

const lockPath =
  process.env.AUTOMATE_PEN_LOCK
  || resolve(process.cwd(), '.atomic-skills/status/automate/pen.lock');

if (!existsSync(lockPath)) process.exit(0);

let writerWorktree = null;
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (lock && typeof lock.writerWorktree === 'string' && lock.writerWorktree.trim()) {
    writerWorktree = lock.writerWorktree.trim();
  }
} catch {
  writerWorktree = null;
}

let payload = {};
try {
  payload = raw.trim() ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

const toolName = payload.tool_name || payload.toolName || '';
const toolInput = payload.tool_input || payload.toolInput || {};
const filePath =
  toolInput.file_path
  || toolInput.path
  || toolInput.target_file
  || toolInput.notebook_path
  || '';

const decision = decidePen({
  lockHeld: true,
  toolName,
  filePath,
  writerWorktree,
});

if (decision.deny) {
  process.stderr.write(`${decision.reason}\n`);
  process.exit(2);
}
process.exit(0);
