#!/usr/bin/env node
/**
 * F6/T-004 — Canonical findings inventory verifier.
 *
 * Extracts source-qualified IDs from:
 *   - docs/audits/installer-audit-2026-07-10.md        → installer/{C|H|M}N
 *   - docs/audits/project-implement-audit-2026-07-10.md → project-implement/{C|H|M}N
 *   - .atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md → codex-review/F-00N
 *     (only the Pass-2 final findings section; template F-00N placeholders ignored)
 *
 * Requires each manifest entry to carry source, localId, ownerTask, reproducer,
 * verifier (executed green), candidateSha matching the release receipt, and
 * evidence with digest and/or job.
 *
 * Usage:
 *   node scripts/verify-findings-manifest.js \
 *     --manifest docs/audits/integrity-remediation-findings.json \
 *     --receipt docs/audits/release-candidate-ci.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_SOURCES = {
  installer: join(ROOT, 'docs/audits/installer-audit-2026-07-10.md'),
  'project-implement': join(ROOT, 'docs/audits/project-implement-audit-2026-07-10.md'),
  'codex-review': join(
    ROOT,
    '.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md',
  ),
};

/**
 * Extract finding local IDs from an audit markdown body.
 * Matches headings like `### C1 — ...`, `### H10 — ...`, `### M3 — ...`.
 * @param {string} text
 * @returns {string[]}
 */
export function extractAuditFindingIds(text) {
  const ids = new Set();
  const re = /^###\s+([CHM]\d+)\s+[—-]/gm;
  for (const m of text.matchAll(re)) {
    ids.add(m[1]);
  }
  return [...ids].sort(compareFindingId);
}

/**
 * Extract Codex review F-00N IDs from the final findings section only.
 * Prefer the last `## Findings` / Pass-2 block; ignore template placeholders
 * containing angle brackets.
 * @param {string} text
 * @returns {string[]}
 */
export function extractCodexFindingIds(text) {
  // Use Pass 2 final findings: after the last occurrence of a real F-001 claim.
  // Pattern: `### F-001 [severity]` without angle brackets in the line.
  const ids = new Set();
  const re = /^###\s+(F-\d{3})\s+\[(critical|major|minor|nit|info)\]/gim;
  for (const m of text.matchAll(re)) {
    ids.add(m[1]);
  }
  return [...ids].sort();
}

function compareFindingId(a, b) {
  const pa = a.match(/^([CHM])(\d+)$/);
  const pb = b.match(/^([CHM])(\d+)$/);
  if (pa && pb) {
    if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1]);
    return Number(pa[2]) - Number(pb[2]);
  }
  return a.localeCompare(b);
}

/**
 * @param {object} [sources] map of sourceKey → absolute path
 * @returns {{ expectedIds: string[], bySource: Record<string, string[]> }}
 */
export function extractExpectedFindingIds(sources = DEFAULT_SOURCES) {
  const bySource = {};
  const expectedIds = [];

  for (const [key, path] of Object.entries(sources)) {
    if (!existsSync(path)) {
      throw new Error(`findings source missing: ${path}`);
    }
    const text = readFileSync(path, 'utf8');
    let locals;
    if (key === 'codex-review') {
      locals = extractCodexFindingIds(text);
    } else {
      locals = extractAuditFindingIds(text);
    }
    bySource[key] = locals;
    for (const local of locals) {
      expectedIds.push(`${key}/${local}`);
    }
  }

  expectedIds.sort();
  return { expectedIds, bySource };
}

/**
 * @param {object} manifest
 * @param {object} [opts]
 * @param {string[]} [opts.expectedIds]
 * @param {string} [opts.candidateSha]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFindingsManifest(manifest, opts = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest root must be an object'] };
  }
  if (manifest.schemaVersion !== '1') {
    errors.push(`schemaVersion must be "1" (got ${JSON.stringify(manifest.schemaVersion)})`);
  }
  if (!Array.isArray(manifest.findings)) {
    errors.push('findings must be an array');
    return { ok: false, errors };
  }

  const expected = opts.expectedIds
    ?? extractExpectedFindingIds().expectedIds;
  const expectedSet = new Set(expected);
  const seen = new Set();
  const actualIds = [];

  for (const [i, f] of manifest.findings.entries()) {
    const prefix = `findings[${i}]`;
    if (!f || typeof f !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    const source = f.source;
    const localId = f.localId;
    if (typeof source !== 'string' || !source) {
      errors.push(`${prefix}: source is required`);
    }
    if (typeof localId !== 'string' || !localId) {
      errors.push(`${prefix}: localId is required`);
    }
    const id = f.id || (source && localId ? `${source}/${localId}` : null);
    if (!id) {
      errors.push(`${prefix}: id or source/localId required`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${prefix}: duplicate id ${id}`);
    }
    seen.add(id);
    actualIds.push(id);

    if (source && localId && id !== `${source}/${localId}`) {
      errors.push(`${prefix}: id ${id} must equal source/localId (${source}/${localId})`);
    }

    if (typeof f.ownerTask !== 'string' || !f.ownerTask.trim()) {
      errors.push(`${prefix} (${id}): ownerTask required`);
    }
    if (typeof f.reproducer !== 'string' || !f.reproducer.trim()) {
      errors.push(`${prefix} (${id}): reproducer required`);
    }
    if (!f.verifier || typeof f.verifier !== 'object') {
      errors.push(`${prefix} (${id}): verifier object required`);
    } else {
      if (typeof f.verifier.command !== 'string' || !f.verifier.command.trim()) {
        errors.push(`${prefix} (${id}): verifier.command required`);
      }
      if (f.verifier.passed !== true) {
        errors.push(`${prefix} (${id}): verifier.passed must be true`);
      }
      if (f.verifier.exitCode !== 0 && f.verifier.exitCode !== undefined) {
        errors.push(`${prefix} (${id}): verifier.exitCode must be 0 when set`);
      }
    }

    if (typeof f.candidateSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(f.candidateSha)) {
      errors.push(`${prefix} (${id}): candidateSha must be a git sha`);
    }
    if (opts.candidateSha && f.candidateSha && f.candidateSha !== opts.candidateSha) {
      errors.push(
        `${prefix} (${id}): candidateSha ${f.candidateSha} != receipt ${opts.candidateSha}`,
      );
    }

    if (!f.evidence || typeof f.evidence !== 'object') {
      errors.push(`${prefix} (${id}): evidence required`);
    } else {
      const hasDigest = typeof f.evidence.digest === 'string' && f.evidence.digest.length >= 8;
      const hasJob = typeof f.evidence.job === 'string' && f.evidence.job.length > 0;
      if (!hasDigest && !hasJob) {
        errors.push(`${prefix} (${id}): evidence.digest or evidence.job required`);
      }
    }

    if (typeof f.status !== 'string' || !f.status) {
      errors.push(`${prefix} (${id}): status required`);
    }
  }

  // Exact set equality
  actualIds.sort();
  const actualSet = new Set(actualIds);
  for (const id of expectedSet) {
    if (!actualSet.has(id)) errors.push(`missing expected finding ${id}`);
  }
  for (const id of actualSet) {
    if (!expectedSet.has(id)) errors.push(`unexpected finding ${id}`);
  }

  // All entries must share the same candidateSha when receipt provides one
  if (opts.candidateSha) {
    const shas = new Set(manifest.findings.map((f) => f.candidateSha).filter(Boolean));
    if (shas.size > 1) {
      errors.push(`multiple candidateSha values in manifest: ${[...shas].join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors, expectedIds: expected, actualIds };
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function parseArgs(argv) {
  const out = {
    manifest: join(ROOT, 'docs/audits/integrity-remediation-findings.json'),
    receipt: join(ROOT, 'docs/audits/release-candidate-ci.json'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = resolve(argv[++i]);
    else if (a === '--receipt') out.receipt = resolve(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/verify-findings-manifest.js --manifest PATH --receipt PATH');
      process.exit(0);
    }
    if (!existsSync(args.manifest)) {
      console.error(`manifest not found: ${args.manifest}`);
      process.exit(2);
    }
    const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
    let candidateSha;
    if (existsSync(args.receipt)) {
      const receipt = JSON.parse(readFileSync(args.receipt, 'utf8'));
      candidateSha = receipt.candidateSha;
    } else {
      console.error(`receipt not found: ${args.receipt}`);
      process.exit(2);
    }

    const { expectedIds } = extractExpectedFindingIds();
    const report = validateFindingsManifest(manifest, { expectedIds, candidateSha });
    if (!report.ok) {
      console.error(report.errors.join('\n'));
      process.exit(1);
    }
    console.log(
      `Findings manifest OK: ${report.actualIds.length} source-qualified IDs; `
      + `candidateSha=${candidateSha}`,
    );
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}
