#!/usr/bin/env node
/**
 * PreToolUse decision for the --automate pen.
 * Exit 0 allows. Exit 2 denies. Fail-closed while the pen lock is held.
 *
 * Stdin: host hook payload (tool_name / tool_input).
 * Lock: on-disk pen.lock wins over AUTOMATE_PEN_LOCK. Else AUTOMATE_PEN_LOCK
 * if that file exists, else AUTOMATE_PROBE_LOCK / probe.lock. A missing
 * AUTOMATE_PEN_LOCK override does not allow writes while a real pen.lock exists.
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

/**
 * @param {Array<string | null>} candidates
 * @returns {string | null}
 */
function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

const cwd = process.cwd();
const hostCwd =
  (process.env.GROK_WORKSPACE_ROOT && process.env.GROK_WORKSPACE_ROOT.trim())
  || (process.env.CLAUDE_PROJECT_DIR && process.env.CLAUDE_PROJECT_DIR.trim())
  || cwd;
const override = process.env.AUTOMATE_PEN_LOCK
  ? resolve(process.env.AUTOMATE_PEN_LOCK)
  : null;
const probeOverride = process.env.AUTOMATE_PROBE_LOCK
  ? resolve(process.env.AUTOMATE_PROBE_LOCK)
  : null;
const operational = firstExisting([
  resolve(hostCwd, '.atomic-skills/status/automate/pen.lock'),
  resolve(cwd, '.atomic-skills/status/automate/pen.lock'),
]);
const lockPath = operational || firstExisting([
  override,
  probeOverride,
  resolve(hostCwd, '.atomic-skills/status/automate/probe.lock'),
  resolve(cwd, '.atomic-skills/status/automate/probe.lock'),
]);

if (!lockPath) process.exit(0);

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
  (toolInput && typeof toolInput === 'object'
    ? toolInput.file_path || toolInput.path || toolInput.target_file || toolInput.notebook_path
    : '')
  || '';
const patch =
  typeof toolInput === 'string'
    ? toolInput
    : (toolInput && typeof toolInput === 'object'
      ? toolInput.patch || toolInput.input || toolInput.diff
      : '')
      || payload.patch
      || '';

const decision = decidePen({
  lockHeld: true,
  toolName,
  filePath,
  patch,
  writerWorktree,
  hostCwd,
});

if (decision.deny) {
  process.stderr.write(`${decision.reason}\n`);
  process.exit(2);
}
process.exit(0);
