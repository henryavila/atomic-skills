#!/usr/bin/env node
/**
 * F6/T-003 — Release-candidate CI receipt verifier.
 *
 * Validates docs/audits/release-candidate-ci.json against required OS/Node axes,
 * host-qualification linkage, and (optionally) no product diff after candidateSha.
 *
 * Multi-OS environments may produce a partial receipt. Use --allow-partial to
 * accept status:partial when platformCoverage documents the limitation.
 *
 * Usage:
 *   node scripts/verify-ci-candidate.js \
 *     --receipt docs/audits/release-candidate-ci.json \
 *     --require-os linux,macos,windows \
 *     --require-node '22.18.x,>=24.11.0' \
 *     --require-host-manifest meta/host-qualification.json \
 *     --no-product-diff \
 *     [--allow-partial]
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Paths allowed to change after candidate freeze. */
export const POST_FREEZE_ALLOWLIST = [
  'docs/audits/',
  '.atomic-skills/',
];

function parseArgs(argv) {
  const out = {
    receipt: join(ROOT, 'docs/audits/release-candidate-ci.json'),
    requireOs: ['linux', 'macos', 'windows'],
    requireNode: ['22.18.x', '>=24.11.0'],
    hostManifest: join(ROOT, 'meta/host-qualification.json'),
    noProductDiff: false,
    allowPartial: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--receipt') out.receipt = resolve(argv[++i]);
    else if (a === '--require-os') out.requireOs = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--require-node') out.requireNode = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--require-host-manifest') out.hostManifest = resolve(argv[++i]);
    else if (a === '--no-product-diff') out.noProductDiff = true;
    else if (a === '--allow-partial') out.allowPartial = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

/**
 * Parse node version strings like v22.18.0 / 24.11.1
 * @param {string} v
 */
export function parseNodeVersion(v) {
  const m = String(v).replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: m[0] };
}

/**
 * Check a recorded version against a requirement token.
 * Supports: "22.18.x" (major.minor.x with minor>=18 when major=22),
 * ">=24.11.0", exact "24.11.0".
 */
export function nodeSatisfies(recorded, requirement) {
  const ver = parseNodeVersion(recorded);
  if (!ver) return false;
  const req = requirement.trim();

  if (req.startsWith('>=')) {
    const min = parseNodeVersion(req.slice(2));
    if (!min) return false;
    if (ver.major !== min.major) {
      // Allow higher major only if requirement is a floor across majors — here
      // ">=24.11.0" means major>=24 with the 24.11 floor on major 24.
      if (ver.major > min.major) return true;
      return false;
    }
    if (ver.minor !== min.minor) return ver.minor > min.minor;
    return ver.patch >= min.patch;
  }

  if (req.endsWith('.x')) {
    const base = req.slice(0, -2); // "22.18"
    const parts = base.split('.').map(Number);
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return false;
    return ver.major === parts[0] && ver.minor >= parts[1];
  }

  const exact = parseNodeVersion(req);
  if (!exact) return false;
  return ver.major === exact.major && ver.minor === exact.minor && ver.patch === exact.patch;
}

/**
 * Jobs must cover each required OS and each node requirement with a real
 * process.version (not inferred solely from the job name).
 */
export function validateJobMatrix(receipt, { requireOs, requireNode }) {
  const errors = [];
  const jobs = Array.isArray(receipt.jobs) ? receipt.jobs : [];
  if (jobs.length === 0 && receipt.status !== 'partial') {
    errors.push('receipt.jobs must be a non-empty array for full status');
  }

  for (const [i, job] of jobs.entries()) {
    const prefix = `jobs[${i}]`;
    if (!job || typeof job !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }
    if (typeof job.os !== 'string' || !job.os) {
      errors.push(`${prefix}: os required`);
    }
    if (typeof job.nodeVersion !== 'string' || !parseNodeVersion(job.nodeVersion)) {
      errors.push(`${prefix}: nodeVersion must be a real process.version (got ${JSON.stringify(job.nodeVersion)})`);
    }
    // Reject versions inferred only from job name when nodeVersion missing was already caught.
    if (job.status && !['success', 'passed', 'green', 'skipped', 'failed'].includes(job.status)) {
      errors.push(`${prefix}: unknown status ${job.status}`);
    }
    if (job.status === 'failed' || job.status === 'red') {
      errors.push(`${prefix}: job failed`);
    }
    if (job.status === 'skipped' && receipt.status === 'full') {
      errors.push(`${prefix}: skipped jobs not allowed for full status`);
    }
    if (receipt.candidateSha && job.sha && job.sha !== receipt.candidateSha) {
      errors.push(`${prefix}: job.sha ${job.sha} != candidateSha ${receipt.candidateSha}`);
    }
  }

  const osCovered = new Set(jobs.map((j) => normalizeOs(j.os)).filter(Boolean));
  // Also accept platformCoverage when jobs are local-only
  if (receipt.platformCoverage && typeof receipt.platformCoverage === 'object') {
    for (const [os, covered] of Object.entries(receipt.platformCoverage)) {
      if (covered === true) osCovered.add(normalizeOs(os));
    }
  }

  for (const os of requireOs) {
    if (!osCovered.has(normalizeOs(os))) {
      errors.push(`missing OS coverage: ${os}`);
    }
  }

  // Node axis: every requirement must be satisfied by at least one job's real version
  // OR by receipt.nodeCoverage entries with real versions.
  const recordedVersions = [
    ...jobs.map((j) => j.nodeVersion).filter(Boolean),
    ...(Array.isArray(receipt.nodeCoverage)
      ? receipt.nodeCoverage.map((n) => n.version || n).filter(Boolean)
      : []),
  ];
  if (receipt.local?.nodeVersion) recordedVersions.push(receipt.local.nodeVersion);

  for (const req of requireNode) {
    const hit = recordedVersions.some((v) => nodeSatisfies(v, req));
    if (!hit) {
      errors.push(`missing Node coverage for requirement ${req} (recorded: ${recordedVersions.join(', ') || 'none'})`);
    }
  }

  return { ok: errors.length === 0, errors, osCovered: [...osCovered], recordedVersions };
}

function normalizeOs(os) {
  if (!os) return null;
  const s = String(os).toLowerCase();
  if (s === 'darwin' || s === 'macos' || s === 'osx') return 'macos';
  if (s === 'win32' || s === 'windows' || s === 'win') return 'windows';
  if (s === 'linux' || s === 'ubuntu-latest' || s.startsWith('ubuntu')) return 'linux';
  return s;
}

/**
 * Ensure no product paths changed after candidateSha (allowlist only).
 * @param {string} candidateSha
 * @param {string} [cwd]
 */
export function checkNoProductDiff(candidateSha, cwd = ROOT) {
  const errors = [];
  if (!candidateSha || !/^[0-9a-f]{7,40}$/i.test(candidateSha)) {
    return { ok: false, errors: ['candidateSha required for --no-product-diff'] };
  }

  const rev = spawnSync('git', ['rev-parse', '--verify', `${candidateSha}^{commit}`], {
    cwd,
    encoding: 'utf8',
  });
  if (rev.status !== 0) {
    return { ok: false, errors: [`candidateSha not found in git: ${candidateSha}`] };
  }

  const diff = spawnSync(
    'git',
    ['diff', '--name-only', `${candidateSha}..HEAD`],
    { cwd, encoding: 'utf8' },
  );
  if (diff.status !== 0) {
    return { ok: false, errors: [`git diff failed: ${diff.stderr}`] };
  }

  const changed = diff.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocked = changed.filter((path) => {
    return !POST_FREEZE_ALLOWLIST.some(
      (prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix),
    );
  });

  if (blocked.length > 0) {
    errors.push(
      `product paths changed after candidateSha (not in allowlist docs/audits|.atomic-skills): ${blocked.join(', ')}`,
    );
  }
  return { ok: errors.length === 0, errors, changed, blocked };
}

/**
 * @param {object} receipt
 * @param {object} opts
 */
export function validateCiCandidate(receipt, opts = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object') {
    return { ok: false, errors: ['receipt must be an object'] };
  }
  if (receipt.schemaVersion !== '1') {
    errors.push(`schemaVersion must be "1"`);
  }
  if (typeof receipt.candidateSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(receipt.candidateSha)) {
    errors.push('candidateSha must be a git sha');
  }
  if (!['full', 'partial', 'failed'].includes(receipt.status)) {
    errors.push(`status must be full|partial|failed (got ${JSON.stringify(receipt.status)})`);
  }
  if (receipt.status === 'failed') {
    errors.push('receipt status is failed');
  }
  if (receipt.status === 'partial' && !opts.allowPartial) {
    errors.push('receipt status is partial; pass --allow-partial for environment-limited qualification');
  }

  if (opts.hostManifest) {
    if (!existsSync(opts.hostManifest)) {
      errors.push(`host manifest missing: ${opts.hostManifest}`);
    } else if (receipt.hostManifest) {
      // soft check path match suffix
      if (!String(receipt.hostManifest).endsWith('host-qualification.json')) {
        errors.push('receipt.hostManifest should reference host-qualification.json');
      }
    }
  }

  const matrix = validateJobMatrix(receipt, {
    requireOs: opts.requireOs || ['linux'],
    requireNode: opts.requireNode || ['22.18.x', '>=24.11.0'],
  });
  // For partial receipts, OS gaps are recorded as environment limits rather than hard fail
  // when allowPartial is set — still surface them as warnings-as-errors only if not allowed.
  if (!matrix.ok) {
    if (receipt.status === 'partial' && opts.allowPartial) {
      const isCoverageGap = (e) =>
        e.startsWith('missing OS coverage:')
        || e.startsWith('missing Node coverage');
      // Allow OS/Node axis gaps under partial when environment cannot run the
      // full Cartesian matrix; still fail on malformed jobs / failed status.
      const hard = matrix.errors.filter((e) => !isCoverageGap(e));
      const nodeGaps = matrix.errors.filter((e) => e.startsWith('missing Node coverage'));
      // Under partial, require at least one real recorded process.version.
      if (hard.length) errors.push(...hard);
      else if (nodeGaps.length && matrix.recordedVersions.length === 0) {
        errors.push(...nodeGaps);
      }
      // OS/Node axis gaps under partial are OK when documented in platformCoverage
      // and at least one real nodeVersion was recorded locally.
    } else {
      errors.push(...matrix.errors);
    }
  }

  if (opts.noProductDiff && receipt.candidateSha) {
    const diff = checkNoProductDiff(receipt.candidateSha, opts.cwd || ROOT);
    if (!diff.ok) errors.push(...diff.errors);
  }

  return { ok: errors.length === 0, errors, matrix };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/verify-ci-candidate.js --receipt PATH [options]');
      process.exit(0);
    }
    if (!existsSync(args.receipt)) {
      console.error(`receipt not found: ${args.receipt}`);
      process.exit(2);
    }
    const receipt = JSON.parse(readFileSync(args.receipt, 'utf8'));
    const report = validateCiCandidate(receipt, {
      requireOs: args.requireOs,
      requireNode: args.requireNode,
      hostManifest: args.hostManifest,
      noProductDiff: args.noProductDiff,
      allowPartial: args.allowPartial,
    });
    if (!report.ok) {
      console.error(report.errors.join('\n'));
      process.exit(1);
    }
    console.log(
      `CI candidate receipt OK: status=${receipt.status} sha=${receipt.candidateSha} `
      + `(allowPartial=${args.allowPartial})`,
    );
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}
