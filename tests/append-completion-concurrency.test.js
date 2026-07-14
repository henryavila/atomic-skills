import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = pathToFileURL(join(HERE, '..', 'scripts', 'append-completion.js')).href;
const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`child failed: code=${code} signal=${signal}`));
    });
  });
}

async function waitUntil(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for child barrier');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('multiprocess retries serialize one idempotency key into one physical line', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-completion-race-'));
  const ready = join(root, 'ready');
  const start = join(root, 'start');
  mkdirSync(ready);
  try {
    const script = `
      import { existsSync, writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { ensureCompletion } from ${JSON.stringify(MODULE)};
      const [root, ready, start, worker] = process.argv.slice(1);
      writeFileSync(join(ready, worker), 'ready');
      const wait = new Int32Array(new SharedArrayBuffer(4));
      while (!existsSync(start)) Atomics.wait(wait, 0, 0, 5);
      ensureCompletion(root, {
        event: 'task-done', projectId: 'proj', planSlug: 'plan', phaseId: 'F0',
        taskId: 'T-001', idempotencyKey: 'task-done:proj/plan/F0/T-001@close',
        ts: '2026-07-14T20:00:00Z',
      }, { beforeAppend: () => Atomics.wait(wait, 0, 0, 100) });
    `;
    const children = Array.from({ length: 8 }, (_, index) => spawn(
      process.execPath,
      ['--input-type=module', '-e', script, root, ready, start, String(index)],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    ));
    await waitUntil(() => readdirSync(ready).length === children.length);
    writeFileSync(start, 'go');
    await Promise.all(children.map(waitForExit));

    const lines = readFileSync(LOG(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1, 'removing the ledger lock produces duplicate lines');
    assert.equal(JSON.parse(lines[0]).idempotencyKey, 'task-done:proj/plan/F0/T-001@close');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('multiprocess stale-lock reclamation never removes a live replacement owner', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-completion-stale-race-'));
  const ready = join(root, 'ready');
  const start = join(root, 'start');
  const analytics = join(root, '.atomic-skills', 'analytics');
  mkdirSync(ready);
  mkdirSync(analytics, { recursive: true });
  writeFileSync(join(analytics, '.completions.lock'), `${JSON.stringify({
    version: 1,
    pid: 2147483647,
    processIdentity: 'dead:process-start',
    token: 'stale-owner',
  })}\n`);
  try {
    const script = `
      import { existsSync, writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { ensureCompletion } from ${JSON.stringify(MODULE)};
      const [root, ready, start, worker] = process.argv.slice(1);
      writeFileSync(join(ready, worker), 'ready');
      const wait = new Int32Array(new SharedArrayBuffer(4));
      while (!existsSync(start)) Atomics.wait(wait, 0, 0, 5);
      ensureCompletion(root, {
        event: 'task-done', projectId: 'proj', planSlug: 'plan', phaseId: 'F0',
        taskId: 'T-002', idempotencyKey: 'task-done:proj/plan/F0/T-002@close',
        ts: '2026-07-14T20:00:01Z',
      }, { beforeAppend: () => Atomics.wait(wait, 0, 0, 100) });
    `;
    const children = Array.from({ length: 8 }, (_, index) => spawn(
      process.execPath,
      ['--input-type=module', '-e', script, root, ready, start, String(index)],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    ));
    await waitUntil(() => readdirSync(ready).length === children.length);
    writeFileSync(start, 'go');
    await Promise.all(children.map(waitForExit));
    const records = readFileSync(LOG(root), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 1);
    assert.equal(records[0].taskId, 'T-002');
    assert.equal(readdirSync(analytics).includes('.completions.lock'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
