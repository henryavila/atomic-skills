#!/usr/bin/env node
/**
 * migrate-state-integrity.js — diagnostic + conservative repair for F4/T-001.
 *
 * Dry-run (default): report repairable vs unmanaged integrity findings.
 * --apply: backfill missing parentPlan/phaseId only when the project+slug join
 * is unique; write a byte-for-byte backup beside each mutated file. Never invent
 * initiatives, never coerce wrong identity values, never clear pending gates.
 *
 * Usage:
 *   node scripts/migrate-state-integrity.js [--root <dir>] [--apply] [--json]
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter, collectTargets, kindFromPath, projectIdFromPath, collectSidecars } from './validate-state.js';
import {
  planIntegrityRepairs,
  formatIntegrityError,
  STATE_INTEGRITY_CODES,
} from '../src/state-invariants.js';

function parseArgs(argv) {
  const opts = {
    root: process.env.ATOMIC_SKILLS_DIR || '.atomic-skills',
    apply: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--root') opts.root = argv[++i];
    else if (a.startsWith('--root=')) opts.root = a.slice('--root='.length);
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

/**
 * Build plan/initiative frontmatter maps + path index for a state root.
 * @param {string} rootAbs
 */
export function loadStateCorpus(rootAbs) {
  const targets = collectTargets([rootAbs]);
  /** @type {Map<string, object>} */
  const planFrontmatters = new Map();
  /** @type {Map<string, object>} */
  const initiativeFrontmatters = new Map();
  /** @type {Map<string, string>} initiative map key → absolute path */
  const initiativePaths = new Map();
  /** @type {Map<string, string>} plan map key → absolute path */
  const planPaths = new Map();

  for (const target of targets) {
    let raw;
    try {
      raw = readFileSync(target, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (!parsed.frontmatter || !parsed.frontmatter.slug) continue;
    const projectId = projectIdFromPath(target);
    const kind = kindFromPath(target);
    const key = `${projectId}/${parsed.frontmatter.slug}`;
    if (kind === 'plan') {
      planFrontmatters.set(key, { ...parsed.frontmatter, __projectId: projectId });
      planPaths.set(key, target);
    }
    if (kind === 'initiative') {
      initiativeFrontmatters.set(key, { ...parsed.frontmatter, __projectId: projectId });
      initiativePaths.set(key, target);
    }
  }

  const sidecars = collectSidecars([rootAbs]);
  return { planFrontmatters, initiativeFrontmatters, initiativePaths, planPaths, sidecars, targets };
}

/**
 * Apply a list of backfill-identity repairs. Pure-ish I/O helper for tests.
 *
 * @param {Array<object>} repairs
 * @param {{ apply?: boolean, backupDir?: string, pathFor?: (r: object) => string|null }} opts
 */
export function applyIntegrityRepairs(repairs, opts = {}) {
  const apply = opts.apply === true;
  const applied = [];
  const failed = [];
  const backupDir = opts.backupDir
    ?? join(process.cwd(), '.atomic-skills', '.integrity-backups', new Date().toISOString().replace(/[:.]/g, '-'));

  for (const repair of repairs) {
    if (repair.kind !== 'backfill-identity') {
      failed.push({ repair, reason: 'unsupported-repair-kind' });
      continue;
    }
    const filePath = typeof opts.pathFor === 'function'
      ? opts.pathFor(repair)
      : (repair.path ?? null);
    if (!hasText(filePath) || !existsSync(filePath)) {
      failed.push({ repair, reason: 'path-missing', path: filePath });
      continue;
    }
    let raw;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch (err) {
      failed.push({ repair, reason: `read-failed: ${err.message}`, path: filePath });
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (parsed.error || !parsed.frontmatter) {
      failed.push({ repair, reason: parsed.error ?? 'parse-failed', path: filePath });
      continue;
    }
    const fm = parsed.frontmatter;
    // Refuse if present values contradict the intended backfill (ambiguous/wrong).
    if (hasText(fm.parentPlan) && fm.parentPlan !== repair.parentPlan) {
      failed.push({ repair, reason: 'parentPlan-conflict', path: filePath });
      continue;
    }
    if (hasText(fm.phaseId) && fm.phaseId !== repair.phaseId) {
      failed.push({ repair, reason: 'phaseId-conflict', path: filePath });
      continue;
    }
    const next = { ...fm };
    let changed = false;
    if (!hasText(next.parentPlan)) {
      next.parentPlan = repair.parentPlan;
      changed = true;
    }
    if (!hasText(next.phaseId)) {
      next.phaseId = repair.phaseId;
      changed = true;
    }
    if (!changed) {
      failed.push({ repair, reason: 'nothing-to-backfill', path: filePath });
      continue;
    }
    if (!apply) {
      applied.push({ repair, path: filePath, dryRun: true });
      continue;
    }
    mkdirSync(backupDir, { recursive: true });
    const backupName = filePath.replace(/[\\/]/g, '__');
    const backupPath = join(backupDir, `${backupName}.bak`);
    copyFileSync(filePath, backupPath);
    const body = parsed.body ?? '';
    const nextRaw = `---\n${stringifyYaml(next).trimEnd()}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
    writeFileSync(filePath, nextRaw, 'utf8');
    applied.push({ repair, path: filePath, backupPath });
  }

  return { applied, failed, backupDir };
}

function hasText(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Scan a state root and optionally apply unambiguous identity backfills.
 *
 * @param {string} root
 * @param {{ apply?: boolean, json?: boolean }} [options]
 */
export function migrateStateIntegrity(root, options = {}) {
  const rootAbs = resolve(root);
  if (!existsSync(rootAbs) || !statSync(rootAbs).isDirectory()) {
    return {
      ok: false,
      apply: options.apply === true,
      error: `root not found or not a directory: ${root}`,
      repairs: [],
      unmanaged: [],
      applied: [],
      failed: [],
    };
  }

  const { planFrontmatters, initiativeFrontmatters, initiativePaths, sidecars } = loadStateCorpus(rootAbs);
  const { repairs: planned, unmanaged } = planIntegrityRepairs(
    planFrontmatters,
    initiativeFrontmatters,
    { sidecars },
  );

  // Attach file paths for backfills.
  const repairs = planned.map((r) => {
    const key = `${r.projectId}/${r.initiativeSlug ?? r.phaseSlug}`;
    const path = initiativePaths.get(key) ?? null;
    return {
      ...r,
      path,
    };
  });

  const apply = options.apply === true;
  const backupDir = join(rootAbs, '.integrity-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  let applied = [];
  let failed = [];

  if (apply) {
    const out = applyIntegrityRepairs(repairs, {
      apply: true,
      backupDir,
      pathFor: (r) => r.path,
    });
    applied = out.applied;
    failed = out.failed;
  }

  const ok = unmanaged.length === 0 && failed.length === 0;
  return {
    ok,
    apply,
    repairs,
    unmanaged,
    applied,
    failed,
    backupDir: apply ? backupDir : null,
    codes: STATE_INTEGRITY_CODES,
  };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  const result = migrateStateIntegrity(opts.root, { apply: opts.apply });
  if (result.error) {
    console.error(`ERROR: ${result.error}`);
    process.exit(2);
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`state integrity migration (${result.apply ? 'APPLY' : 'dry-run'}) root=${resolve(opts.root)}`);
    console.log(`repairable: ${result.repairs.length}`);
    for (const r of result.repairs) {
      console.log(`  + ${r.kind} ${r.path ?? '(no path)'} parentPlan=${r.parentPlan} phaseId=${r.phaseId}`);
    }
    console.log(`unmanaged: ${result.unmanaged.length}`);
    for (const u of result.unmanaged) {
      console.log(`  ! ${formatIntegrityError(u)}`);
    }
    if (result.apply) {
      console.log(`applied: ${result.applied.length}`);
      for (const a of result.applied) {
        console.log(`  ✓ ${a.path} backup=${a.backupPath}`);
      }
      if (result.failed.length) {
        console.log(`failed: ${result.failed.length}`);
        for (const f of result.failed) {
          console.log(`  ✖ ${f.path ?? '?'} ${f.reason}`);
        }
      }
    }
  }

  // Exit 1 when unmanaged findings exist (diagnostic signal) or apply failed.
  // Dry-run with only repairable items exits 0 so CI can preview cleanly when
  // the only issues are auto-fixable.
  if (result.failed.length > 0) process.exit(1);
  if (result.unmanaged.length > 0) process.exit(1);
  process.exit(0);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
