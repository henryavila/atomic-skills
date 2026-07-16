#!/usr/bin/env node
/**
 * F6/T-004 — Compare rendered desired set vs installed journal/disk.
 *
 * Modes:
 *   --check   read-only; exit 1 on stale/missing/modified drift (default)
 *   --repair  rewrite desired content for stale/missing paths only (opt-in);
 *             never clobber paths classified as modified/preserved without
 *             --force-modified (not enabled by default).
 *
 * Usage:
 *   node scripts/verify-installed-runtime.js --check [--base PATH] [--scope project|user]
 *   node scripts/verify-installed-runtime.js --repair --base PATH
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashContent } from '../src/hash.js';
import { readManifest, writeManifest } from '../src/manifest.js';
import { computeSkillsFileSet } from '../src/providers/skills-file-set.js';
import {
  classifyFileState,
  summarizeVerification,
} from '../src/status-verify.js';
import { PUBLIC_IDE_IDS } from '../src/config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

function parseArgs(argv) {
  const out = {
    check: true,
    repair: false,
    base: null,
    scope: null,
    forceModified: false,
    includeUser: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') {
      out.check = true;
      out.repair = false;
    } else if (a === '--repair') {
      out.repair = true;
      out.check = false;
    } else if (a === '--base') out.base = resolve(argv[++i]);
    else if (a === '--scope') out.scope = argv[++i];
    else if (a === '--force-modified') out.forceModified = true;
    else if (a === '--include-user') out.includeUser = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

/**
 * Build desired content map for the manifest's ides/language/scope.
 * @param {object} manifest
 * @param {string} scope
 */
export function buildDesiredSet(manifest, scope) {
  const language = manifest.language || 'en';
  const ides = Array.isArray(manifest.ides) && manifest.ides.length > 0
    ? manifest.ides
    : PUBLIC_IDE_IDS;
  const modules = manifest.modules || {};
  const files = computeSkillsFileSet({
    language,
    ides,
    modules,
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: scope === 'user' ? 'user' : 'project',
  });
  const byPath = new Map();
  for (const f of files) {
    byPath.set(f.path, {
      content: f.content,
      hash: hashContent(f.content),
      source: f.source,
    });
  }
  return byPath;
}

/**
 * @param {string} basePath
 * @param {object} [opts]
 * @returns {{
 *   ok: boolean,
 *   files: Array<object>,
 *   counts: Record<string, number>,
 *   basePath: string,
 *   scope: string,
 * }}
 */
export function verifyInstalledRuntime(basePath, opts = {}) {
  const manifest = readManifest(basePath);
  if (!manifest) {
    return {
      ok: false,
      files: [],
      counts: {},
      basePath,
      scope: opts.scope || 'unknown',
      error: 'no manifest',
    };
  }

  const scope = opts.scope
    || (basePath === homedir() || basePath === resolve(homedir()) ? 'user' : 'project');
  const desired = buildDesiredSet(manifest, scope);
  const filesMap = manifest.files && typeof manifest.files === 'object' ? manifest.files : {};

  const paths = new Set([...Object.keys(filesMap), ...desired.keys()]);
  const files = [];

  for (const rel of [...paths].sort()) {
    const abs = join(basePath, rel);
    const onDisk = existsSync(abs);
    let diskHash = null;
    if (onDisk) {
      try {
        diskHash = hashContent(readFileSync(abs));
      } catch {
        diskHash = null;
      }
    }
    const installedHash = filesMap[rel]?.installed_hash
      ?? filesMap[rel]?.installedHash
      ?? null;
    const desiredEntry = desired.get(rel);
    const desiredHash = desiredEntry?.hash ?? null;

    const state = classifyFileState({
      exists: onDisk && diskHash != null,
      diskHash,
      installedHash,
      desiredHash,
    });

    files.push({
      path: rel,
      state,
      installedHash,
      diskHash,
      desiredHash,
      desiredContent: desiredEntry?.content ?? null,
      source: desiredEntry?.source ?? filesMap[rel]?.source,
    });
  }

  const counts = summarizeVerification({ files });
  const drifted = files.some(
    (f) => f.state === 'stale' || f.state === 'missing' || f.state === 'modified'
      || f.state === 'preserved' || f.state === 'conflict',
  );

  return {
    ok: !drifted,
    files,
    counts,
    basePath,
    scope,
    manifest,
    desiredSize: desired.size,
  };
}

/**
 * Repair stale/missing paths to desired content. Modified paths require force.
 * @param {ReturnType<typeof verifyInstalledRuntime>} report
 * @param {{ forceModified?: boolean }} [opts]
 */
export function repairInstalledRuntime(report, opts = {}) {
  if (!report.manifest) {
    throw new Error('cannot repair without manifest');
  }
  const repaired = [];
  const skipped = [];
  const filesMap = { ...(report.manifest.files || {}) };

  for (const f of report.files) {
    if (f.state === 'unchanged' || f.state === 'updated') continue;
    if (f.state === 'modified' || f.state === 'preserved' || f.state === 'conflict') {
      if (!opts.forceModified) {
        skipped.push({ path: f.path, state: f.state, reason: 'local modification; pass --force-modified' });
        continue;
      }
    }
    if (f.desiredContent == null) {
      // Desired removed — leave disk if modified; delete if stale/missing-from-desired tracked
      if (f.state === 'stale' || f.state === 'missing') {
        skipped.push({ path: f.path, state: f.state, reason: 'no desired content' });
      }
      continue;
    }

    const abs = join(report.basePath, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.desiredContent);
    const hash = hashContent(f.desiredContent);
    filesMap[f.path] = {
      ...(filesMap[f.path] || {}),
      installed_hash: hash,
      source: f.source,
    };
    repaired.push({ path: f.path, state: f.state, hash });
  }

  writeManifest(report.basePath, {
    ...report.manifest,
    files: filesMap,
  });

  return { repaired, skipped };
}

/**
 * Discover install bases for verification.
 *
 * Default (release/CI): only a project-scope manifest under cwd. A developer's
 * long-lived user-scope install under $HOME is often intentionally stale relative
 * to HEAD and must not fail release gates — pass --include-user or --base $HOME
 * to opt in.
 *
 * @param {string} [cwd]
 * @param {{ includeUser?: boolean }} [opts]
 */
export function discoverInstallBases(cwd = process.cwd(), opts = {}) {
  const bases = [];
  const projectManifest = join(cwd, '.atomic-skills', 'manifest.json');
  if (existsSync(projectManifest)) {
    bases.push({ base: cwd, scope: 'project' });
  }
  if (opts.includeUser) {
    const userBase = homedir();
    if (existsSync(join(userBase, '.atomic-skills', 'manifest.json'))) {
      bases.push({ base: userBase, scope: 'user' });
    }
  }
  return bases;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`Usage: node scripts/verify-installed-runtime.js [--check|--repair] [--base PATH] [--scope project|user]`);
      process.exit(0);
    }

    const targets = args.base
      ? [{ base: args.base, scope: args.scope || (args.base === homedir() ? 'user' : 'project') }]
      : discoverInstallBases(process.cwd(), { includeUser: args.includeUser });

    if (targets.length === 0) {
      // No project install in cwd — OK for --check in CI/source checkout.
      // User-scope $HOME is opt-in via --include-user (see discoverInstallBases).
      console.log(
        args.includeUser
          ? 'No installed runtime found under cwd or $HOME — nothing to verify.'
          : 'No project-scope install under cwd — nothing to verify (pass --include-user for $HOME).',
      );
      process.exit(0);
    }

    let failed = false;
    for (const t of targets) {
      const report = verifyInstalledRuntime(t.base, { scope: t.scope });
      if (report.error) {
        console.error(`${t.base}: ${report.error}`);
        failed = true;
        continue;
      }

      const summary = Object.entries(report.counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ');

      if (args.repair) {
        const result = repairInstalledRuntime(report, {
          forceModified: args.forceModified,
        });
        console.log(
          `Repaired ${result.repaired.length} path(s) at ${t.base}`
          + (result.skipped.length ? `; skipped ${result.skipped.length}` : ''),
        );
        for (const s of result.skipped) {
          console.log(`  skip ${s.path} (${s.state}): ${s.reason}`);
        }
        const after = verifyInstalledRuntime(t.base, { scope: t.scope });
        if (!after.ok) {
          console.error(`Still drifted after repair: ${JSON.stringify(after.counts)}`);
          failed = true;
        }
      } else {
        console.log(`[${t.scope}] ${t.base}: ${report.ok ? 'OK' : 'DRIFT'} (${summary})`);
        if (!report.ok) {
          failed = true;
          for (const f of report.files.filter((x) => x.state !== 'unchanged' && x.state !== 'updated')) {
            console.error(`  ${f.state.padEnd(10)} ${f.path}`);
          }
        }
      }
    }

    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}
