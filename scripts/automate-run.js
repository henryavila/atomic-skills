#!/usr/bin/env node
/**
 * implement --automate start gate.
 *
 * Refuses unless the current host is Claude Code, Codex, or Grok and that
 * host's PreToolUse pen is registered. Architecture and UI detectors are
 * required and are not in this tree yet, so a normal run still refuses.
 * Does not spawn a writer.
 *
 *   node scripts/automate-run.js --host <claude-code|codex|grok> --plan <plan.md> [--root <dir>]
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTOMATE_HOSTS,
  PEN_HOOK_SCRIPT,
  assessHostWrite,
  assessPenRegistration,
  resolveAutomateHost,
} from '../src/automate-host-pen.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ host?: string, plan?: string, root?: string }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--host') out.host = argv[++i];
    else if (token === '--plan') out.plan = argv[++i];
    else if (token === '--root') out.root = argv[++i];
    else if (token.startsWith('--host=')) out.host = token.slice('--host='.length);
    else if (token.startsWith('--plan=')) out.plan = token.slice('--plan='.length);
    else if (token.startsWith('--root=')) out.root = token.slice('--root='.length);
  }
  return out;
}

/**
 * @param {string} script
 * @param {string[]} args
 * @returns {{ ok: boolean, detail: string }}
 */
function runDetector(script, args) {
  const res = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    encoding: 'utf8',
  });
  const detail = `${res.stdout || ''}${res.stderr || ''}`.trim();
  return { ok: res.status === 0, detail };
}

/**
 * Create an isolated probe lock, require exit 2, remove it, require exit 0.
 * Does not create pen.lock. Always removes the probe lock before returning.
 * @param {string} root
 * @returns {string[]}
 */
export function runSyntheticProbe(root) {
  const probe = join(root, '.atomic-skills/status/automate/probe.lock');
  const pen = join(root, '.atomic-skills/status/automate/pen.lock');
  const home = mkdtempSync(join(tmpdir(), 'pen-home-'));
  const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
  const payload = JSON.stringify({
    tool_name: 'apply_patch',
    tool_input: { file_path: join(root, 'sentinel.js') },
  });
  /** @type {string[]} */
  const blockers = [];
  mkdirSync(join(home, '.atomic-skills'), { recursive: true });
  writeFileSync(join(home, '.atomic-skills/package-root'), `${ROOT}\n`);
  mkdirSync(dirname(probe), { recursive: true });
  const baseEnv = {
    ...process.env,
    HOME: home,
    CLAUDE_PROJECT_DIR: root,
    GROK_WORKSPACE_ROOT: root,
  };
  delete baseEnv.AUTOMATE_PEN_LOCK;
  delete baseEnv.AUTOMATE_PROBE_LOCK;
  try {
    writeFileSync(probe, '{"kind":"probe"}\n');
    const denied = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: { ...baseEnv, AUTOMATE_PROBE_LOCK: probe },
    });
    if (denied.status !== 2) {
      blockers.push(
        `probe lock did not make ${PEN_HOOK_SCRIPT} exit 2 (status ${denied.status})`,
      );
    }
    rmSync(probe, { force: true });
    const allowed = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: baseEnv,
    });
    if (allowed.status !== 0) {
      blockers.push(
        `${PEN_HOOK_SCRIPT} did not exit 0 without a lock (status ${allowed.status})`,
      );
    }
    if (existsSync(join(root, 'sentinel.js'))) {
      blockers.push('probe lock left a sentinel file');
    }
  } finally {
    rmSync(probe, { force: true });
    rmSync(home, { recursive: true, force: true });
  }
  if (existsSync(pen)) blockers.push('startup probe created pen.lock');
  if (existsSync(probe)) blockers.push('startup probe left probe.lock');
  return blockers;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = resolveAutomateHost(args.host);
  /** @type {string[]} */
  const blockers = [];

  if (!host) {
    blockers.push('host must be claude-code, codex, or grok');
  }
  if (!args.plan) {
    blockers.push('pass --plan <plan.md>');
  }

  const root = resolve(args.root || process.cwd());
  if (host) {
    const hookFile = join(root, AUTOMATE_HOSTS[host].hookFile);
    if (!existsSync(hookFile)) {
      blockers.push(
        `${host} PreToolUse does not call ${PEN_HOOK_SCRIPT} (${AUTOMATE_HOSTS[host].hookFile} missing)`,
      );
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(readFileSync(hookFile, 'utf8'));
      } catch {
        parsed = null;
      }
      const pen = assessPenRegistration(host, parsed);
      if (!pen.ok) blockers.push(pen.reason);
    }
  }

  try {
    blockers.push(...runSyntheticProbe(root));
  } catch (err) {
    blockers.push(`probe lock failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const hostWrite = assessHostWrite({
    invokedHook: false,
    refused: false,
    sentinelCreated: false,
  });
  if (!hostWrite.ok) blockers.push(hostWrite.reason);

  if (args.plan) {
    const plan = resolve(args.plan);
    for (const script of [
      ['find-missing-flow.js', '--strict', plan],
      ['find-unreviewed-plans.js', plan],
      ['find-plans-missing-ground-truth.js', plan],
    ]) {
      const [name, ...rest] = script;
      const result = runDetector(name, rest);
      if (!result.ok) blockers.push(result.detail || `${name} failed`);
    }
  }

  for (const missing of ['find-missing-architecture.js', 'find-missing-ui.js']) {
    if (!existsSync(join(ROOT, 'scripts', missing))) {
      blockers.push(`missing detector scripts/${missing}`);
    }
  }

  if (blockers.length > 0) {
    process.stderr.write('implement --automate refused:\n');
    for (const line of blockers) {
      process.stderr.write(`- ${line.split('\n')[0]}\n`);
    }
    process.exit(1);
  }

  process.stderr.write('implement --automate: gates passed; writer spawn is not in this build\n');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
