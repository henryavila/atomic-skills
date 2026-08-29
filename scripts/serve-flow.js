#!/usr/bin/env node
/**
 * Start or reuse a loopback preview for flow.html.
 *
 *   node scripts/serve-flow.js --up <flow.html>     # print URL, detach
 *   node scripts/serve-flow.js --down <flow.html>   # stop that preview
 *   node scripts/serve-flow.js --fg <flow.html>     # stay in foreground
 *
 * Exit: 0 ok · 2 usage / missing file
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertHtmlExists, serveFlowHtml } from './lib/serve-flow.js';

function stateHome() {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

const SELF = fileURLToPath(import.meta.url);

function lockPath() {
  return join(stateHome(), '.atomic-skills', 'flow-serve.json');
}

function readLock() {
  try {
    return JSON.parse(readFileSync(lockPath(), 'utf8'));
  } catch {
    return { servers: [] };
  }
}

function writeLock(data) {
  const path = lockPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function listServers() {
  const lock = readLock();
  return Array.isArray(lock.servers) ? lock.servers : [];
}

function upsertServer(entry) {
  const servers = listServers().filter((s) => s.htmlPath !== entry.htmlPath);
  servers.push(entry);
  writeLock({ servers });
}

function removeServer(htmlPath) {
  const abs = resolve(htmlPath);
  writeLock({ servers: listServers().filter((s) => s.htmlPath !== abs) });
}

async function findReusable(htmlPath) {
  const abs = resolve(htmlPath);
  for (const s of listServers()) {
    if (s.htmlPath === abs && isAlive(s.pid) && typeof s.url === 'string' && await probe(s.url)) {
      return s;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function down(htmlPath) {
  const abs = resolve(htmlPath);
  const hit = listServers().find((s) => s.htmlPath === abs);
  if (hit?.pid && isAlive(hit.pid)) {
    try { process.kill(hit.pid, 'SIGTERM'); } catch { /* already gone */ }
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && isAlive(hit.pid)) await sleep(40);
    if (isAlive(hit.pid)) {
      try { process.kill(hit.pid, 'SIGKILL'); } catch { /* */ }
    }
  }
  removeServer(abs);
}

function usage(code = 2) {
  console.error(`Usage:
  node scripts/serve-flow.js --up <flow.html>
  node scripts/serve-flow.js --down <flow.html>
  node scripts/serve-flow.js --fg <flow.html> [--port N]`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  /** @type {{ mode: 'up'|'down'|'fg'|null, html?: string, port: number }} */
  const out = { mode: null, port: 0 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') usage(0);
    if (a === '--up') { out.mode = 'up'; continue; }
    if (a === '--down') { out.mode = 'down'; continue; }
    if (a === '--fg') { out.mode = 'fg'; continue; }
    if (a === '--port') {
      out.port = Number(args[++i]);
      continue;
    }
    if (a.startsWith('-')) usage(2);
    out.html = a;
  }
  return out;
}

async function waitForLock(abs, child) {
  let childExit = null;
  if (child && typeof child.once === 'function') {
    child.once('exit', (code) => {
      childExit = code;
    });
    child.once('error', () => {
      childExit = 1;
    });
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (childExit !== null && childExit !== 0) {
      throw new Error(`preview exited ${childExit}`);
    }
    const hit = listServers().find((s) => s.htmlPath === abs);
    if (hit && isAlive(hit.pid) && typeof hit.url === 'string' && await probe(hit.url)) {
      return hit.url;
    }
    await sleep(50);
  }
  throw new Error('timeout starting preview');
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.mode || !opts.html) usage(2);

  if (opts.mode === 'down') {
    await down(opts.html);
    return;
  }

  let abs;
  try {
    abs = assertHtmlExists(opts.html);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  if (opts.mode === 'up') {
    const existing = await findReusable(abs);
    if (existing) {
      process.stdout.write(`${existing.url}\n`);
      return;
    }
    const child = spawn(process.execPath, [SELF, '--fg', abs], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
    child.unref();
    const url = await waitForLock(abs, child);
    process.stdout.write(`${url}\n`);
    process.exit(0);
  }

  const preview = await serveFlowHtml(abs, { port: opts.port });
  upsertServer({
    htmlPath: abs,
    url: preview.url,
    pid: process.pid,
    port: preview.port,
  });
  writeSync(1, `${preview.url}\n`);
  const stop = () => {
    preview.close().finally(() => {
      removeServer(abs);
      process.exit(0);
    });
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (existsSync(SELF)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
