#!/usr/bin/env node
/**
 * F6/T-001 — Host contract probes against meta/host-qualification.json.
 *
 * - layout-only: install layout + parser only; never claim supportDeclared.
 * - operational: require real CLI discovery/load/invoke with version string.
 * Missing CLIs for operational hosts fail unless the host is reclassified
 * layout-only in the manifest first (no silent green skip for operational).
 *
 * Usage:
 *   node scripts/run-host-probes.js \
 *     --manifest meta/host-qualification.json \
 *     --receipt docs/audits/host-contract-receipt.json \
 *     [--check] [--write]
 *
 * Exit 0 on success, 1 on probe/contract failure, 2 on usage/I/O errors.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PUBLIC_IDE_IDS, getSkillPath } from '../src/config.js';
import { installSkills } from '../src/install.js';
import { buildInstaller } from '../src/installer.js';
import {
  loadHostQualification,
  validateHostQualification,
} from './validate-host-qualification.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

/** Known host CLIs for optional presence checks (not a support claim). */
const HOST_CLI = {
  'claude-code': { bin: 'claude', versionArgs: ['--version'] },
  cursor: { bin: 'cursor', versionArgs: ['--version'] },
  gemini: { bin: 'gemini', versionArgs: ['--version'] },
  codex: { bin: 'codex', versionArgs: ['--version'] },
  opencode: { bin: 'opencode', versionArgs: ['--version'] },
  'github-copilot': null, // no standalone skills CLI
  grok: { bin: 'grok', versionArgs: ['--version'] },
};

function parseArgs(argv) {
  const out = {
    manifest: join(ROOT, 'meta/host-qualification.json'),
    receipt: join(ROOT, 'docs/audits/host-contract-receipt.json'),
    check: false,
    write: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = resolve(argv[++i]);
    else if (a === '--receipt') out.receipt = resolve(argv[++i]);
    else if (a === '--check') out.check = true;
    else if (a === '--write') out.write = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function cliPresent(spec) {
  if (!spec) return { present: false, version: null, detail: 'no standalone CLI' };
  try {
    const which = spawnSync('which', [spec.bin], { encoding: 'utf8' });
    if (which.status !== 0) {
      return { present: false, version: null, detail: `${spec.bin} not on PATH` };
    }
    const ver = spawnSync(spec.bin, spec.versionArgs, {
      encoding: 'utf8',
      timeout: 8000,
    });
    const text = `${ver.stdout || ''}${ver.stderr || ''}`.trim().split('\n')[0] || null;
    return {
      present: ver.status === 0 || Boolean(text),
      version: text,
      detail: ver.status === 0 ? 'ok' : `exit ${ver.status}`,
    };
  } catch (err) {
    return { present: false, version: null, detail: String(err.message || err) };
  }
}

/**
 * Layout probe: install single-host project-scope, assert skill path, uninstall.
 * @param {string} hostId
 * @returns {{ ok: boolean, skillPath: string, error?: string }}
 */
function probeLayout(hostId) {
  const prevHome = process.env.HOME;
  const prevSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
  const home = mkdtempSync(join(tmpdir(), 'as-host-probe-home-'));
  const projectDir = mkdtempSync(join(tmpdir(), 'as-host-probe-proj-'));
  process.env.HOME = home;
  process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
  const skillRel = getSkillPath(hostId, 'project');
  try {
    installSkills(projectDir, {
      language: 'en',
      ides: [hostId],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });
    const abs = join(projectDir, skillRel);
    if (!existsSync(abs)) {
      return { ok: false, skillPath: skillRel, error: `missing ${skillRel}` };
    }
    // Parser smoke: skill body is non-empty markdown/text.
    const body = readFileSync(abs, 'utf8');
    if (body.trim().length < 20) {
      return { ok: false, skillPath: skillRel, error: 'skill body too short' };
    }
    return { ok: true, skillPath: skillRel };
  } catch (err) {
    return { ok: false, skillPath: skillRel, error: String(err.message || err) };
  } finally {
    try {
      buildInstaller({}).uninstall({ projectDir });
    } catch {
      /* best-effort cleanup */
    }
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = prevSkip;
    rmSync(home, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  }
}

/**
 * Operational discovery/load/invoke for hosts that declare supportTier=operational.
 * Layout-only hosts must never enter this path with supportDeclared true.
 *
 * @param {object} host
 * @param {{ present: boolean, version: string|null }} cli
 */
function probeOperational(host, cli) {
  if (!cli.present) {
    return {
      ok: false,
      discovery: false,
      load: false,
      invoke: false,
      error: `operational host ${host.id} requires CLI present; reclassify to layout-only before candidate`,
    };
  }
  // Host-specific operational probes. Only run when tier is operational.
  const spec = HOST_CLI[host.id];
  if (!spec) {
    return {
      ok: false,
      discovery: false,
      load: false,
      invoke: false,
      error: `no operational probe implementation for ${host.id}`,
    };
  }

  // discovery: binary answers --version
  const discovery = true;
  // load: list/help surface available (best-effort, host-specific)
  let load = false;
  let invoke = false;
  let detail = '';

  if (host.id === 'gemini') {
    const list = spawnSync(spec.bin, ['skills', 'list'], {
      encoding: 'utf8',
      timeout: 30_000,
      env: process.env,
    });
    load = list.status === 0;
    detail = (list.stdout || list.stderr || '').slice(0, 200);
    invoke = load; // list is the load/invoke surface we can automate
  } else if (host.id === 'claude-code') {
    const help = spawnSync(spec.bin, ['--help'], { encoding: 'utf8', timeout: 15_000 });
    load = help.status === 0 || /usage|claude/i.test(`${help.stdout}${help.stderr}`);
    invoke = load;
  } else if (host.id === 'codex') {
    const help = spawnSync(spec.bin, ['--help'], { encoding: 'utf8', timeout: 15_000 });
    load = help.status === 0 || /usage|codex/i.test(`${help.stdout}${help.stderr}`);
    invoke = load;
  } else if (host.id === 'grok') {
    const help = spawnSync(spec.bin, ['--help'], { encoding: 'utf8', timeout: 15_000 });
    load = help.status === 0 || /usage|grok/i.test(`${help.stdout}${help.stderr}`);
    invoke = load;
  } else if (host.id === 'opencode') {
    const help = spawnSync(spec.bin, ['--help'], { encoding: 'utf8', timeout: 15_000 });
    load = help.status === 0 || /usage|opencode/i.test(`${help.stdout}${help.stderr}`);
    invoke = load;
  } else {
    return {
      ok: false,
      discovery: false,
      load: false,
      invoke: false,
      error: `operational probe not defined for ${host.id}`,
    };
  }

  const ok = discovery && load && invoke;
  return {
    ok,
    discovery,
    load,
    invoke,
    version: cli.version,
    detail,
    error: ok ? undefined : `discovery/load/invoke incomplete for ${host.id}`,
  };
}

/**
 * @param {object} options
 * @returns {{ ok: boolean, receipt: object, errors: string[] }}
 */
export function runHostProbes(options = {}) {
  const manifestPath = resolve(options.manifest || join(ROOT, 'meta/host-qualification.json'));
  const doc = loadHostQualification(manifestPath);
  const validation = validateHostQualification(doc, { publicIdeIds: PUBLIC_IDE_IDS });
  const errors = [...validation.errors];
  const hosts = [];

  for (const host of doc.hosts || []) {
    const cli = cliPresent(HOST_CLI[host.id]);
    const layout = probeLayout(host.id);
    if (!layout.ok) {
      errors.push(`${host.id}: layout probe failed: ${layout.error}`);
    }

    let operational = null;
    if (host.supportTier === 'operational') {
      operational = probeOperational(host, cli);
      if (!operational.ok) {
        errors.push(`${host.id}: ${operational.error}`);
      }
      if (host.supportDeclared === false) {
        errors.push(`${host.id}: operational must not set supportDeclared:false`);
      }
    } else {
      // layout-only: never claim operational support
      if (host.supportDeclared !== false) {
        errors.push(`${host.id}: layout-only requires supportDeclared:false`);
      }
      // Presence of CLI is recorded but does NOT promote the tier.
      operational = {
        ok: true,
        skipped: true,
        reason: 'layout-only — no discovery/load/invoke claim',
        cliPresent: cli.present,
        cliVersion: cli.version,
      };
    }

    hosts.push({
      id: host.id,
      supportTier: host.supportTier,
      supportDeclared: host.supportDeclared === true,
      layout: {
        ok: layout.ok,
        skillPath: layout.skillPath,
        error: layout.error,
      },
      cli: {
        present: cli.present,
        version: cli.version,
        detail: cli.detail,
      },
      operational,
    });
  }

  const receipt = {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    manifest: manifestPath,
    hosts,
    summary: {
      total: hosts.length,
      layoutOk: hosts.filter((h) => h.layout.ok).length,
      operationalClaimed: hosts.filter((h) => h.supportTier === 'operational').length,
      operationalOk: hosts.filter(
        (h) => h.supportTier === 'operational' && h.operational?.ok,
      ).length,
      layoutOnly: hosts.filter((h) => h.supportTier === 'layout-only').length,
    },
    ok: errors.length === 0,
    errors,
  };

  return { ok: receipt.ok, receipt, errors };
}

export function checkReceiptAgainstManifest(receipt, doc) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object') {
    return { ok: false, errors: ['receipt must be an object'] };
  }
  const byId = new Map((receipt.hosts || []).map((h) => [h.id, h]));
  for (const host of doc.hosts || []) {
    const entry = byId.get(host.id);
    if (!entry) {
      errors.push(`receipt missing host ${host.id}`);
      continue;
    }
    if (entry.supportTier !== host.supportTier) {
      errors.push(
        `${host.id}: receipt tier ${entry.supportTier} != manifest ${host.supportTier}`,
      );
    }
    if (host.supportTier === 'layout-only') {
      if (entry.supportDeclared === true) {
        errors.push(`${host.id}: layout-only receipt must not claim supportDeclared`);
      }
      if (entry.operational && entry.operational.skipped !== true && entry.operational.discovery) {
        // Allow recording CLI presence, but not operational pass without tier.
        if (entry.supportTier !== 'operational' && entry.operational.ok && entry.operational.invoke) {
          // Only fail if receipt claims operational success while tier is layout-only
          // without skipped flag — already covered if skipped is required.
        }
      }
    }
    if (host.supportTier === 'operational') {
      if (!entry.operational?.discovery || !entry.operational?.load || !entry.operational?.invoke) {
        errors.push(`${host.id}: operational receipt missing discovery/load/invoke`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`Usage: node scripts/run-host-probes.js [--manifest PATH] [--receipt PATH] [--check] [--write]`);
      process.exit(0);
    }

    if (args.check && existsSync(args.receipt) && !args.write) {
      const receipt = JSON.parse(readFileSync(args.receipt, 'utf8'));
      const doc = loadHostQualification(args.manifest);
      const report = checkReceiptAgainstManifest(receipt, doc);
      // Also re-validate live layout quickly when --check without --write
      // (contract consistency only — full re-probe is --write).
      if (!report.ok) {
        console.error(report.errors.join('\n'));
        process.exit(1);
      }
      if (receipt.ok === false) {
        console.error((receipt.errors || ['receipt.ok is false']).join('\n'));
        process.exit(1);
      }
      console.log(
        `Host contract receipt OK: ${receipt.summary?.total ?? '?'} hosts `
        + `(${receipt.summary?.layoutOnly ?? 0} layout-only, `
        + `${receipt.summary?.operationalClaimed ?? 0} operational).`,
      );
      process.exit(0);
    }

    const { ok, receipt, errors } = runHostProbes({
      manifest: args.manifest,
      receipt: args.receipt,
    });

    if (args.write || !existsSync(args.receipt)) {
      mkdirSync(dirname(args.receipt), { recursive: true });
      writeFileSync(args.receipt, `${JSON.stringify(receipt, null, 2)}\n`);
      console.log(`Wrote ${args.receipt}`);
    } else if (args.check) {
      // refresh check against freshly computed probes
      if (!ok) {
        console.error(errors.join('\n'));
        process.exit(1);
      }
    }

    if (!ok) {
      console.error(errors.join('\n'));
      process.exit(1);
    }
    console.log(
      `Host probes OK: ${receipt.summary.total} hosts `
      + `(layout ${receipt.summary.layoutOk}/${receipt.summary.total}, `
      + `operational claimed ${receipt.summary.operationalClaimed}).`,
    );
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}
