#!/usr/bin/env node
/**
 * consolidate.mjs — executable merge-train driver for the ≥2-worktree
 * consolidation path. Serialized eject-and-continue (NOT octopus, NOT a daemon):
 * merge each READY branch onto a moving integration tip, auto-resolve the
 * mechanical conflict ALLOWLIST (consolidation-resolve.js), and HALT for a human
 * on the first branch carrying a genuine semantic/unknown conflict — leaving its
 * mechanical conflicts already resolved so the human finishes only the semantic
 * ones. Idempotent/resumable: already-merged branches are skipped.
 *
 * I/O orchestrator (git/exec live here); the DECISIONS are the pure classifier.
 *
 * Usage:
 *   node consolidate.mjs --workdir <dir> --base <ref> --branches a,b,c \
 *     [--reverted plan/x,plan/y] [--regen "npm run build:aideck-schema"] [--gate "npm run validate-skills"]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  classifyConflictPath,
  unionLines,
  pickNewerByTimestamp,
  classifyBranchIntegration,
} from './consolidation-resolve.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) a[k.slice(2)] = argv[i + 1], i++;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const WD = args.workdir;
const BASE = args.base;
const BRANCHES = (args.branches || '').split(',').map((s) => s.trim()).filter(Boolean);
const REVERTED = new Set((args.reverted || '').split(',').map((s) => s.trim()).filter(Boolean));
const REGEN = args.regen || '';
const GATE = args.gate || '';
if (!WD || !BASE || !BRANCHES.length) {
  console.error('usage: consolidate.mjs --workdir <dir> --base <ref> --branches a,b,c');
  process.exit(64);
}

function git(a, { allowFail = false } = {}) {
  try {
    return execFileSync('git', ['-C', WD, ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}
function sh(cmd) {
  try {
    const out = execFileSync('bash', ['-lc', `cd ${WD} && ${cmd}`], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const showStage = (n, path) => git(['show', `:${n}:${path}`], { allowFail: true });
const isAncestor = (a, b) => git(['merge-base', '--is-ancestor', a, b], { allowFail: true }) !== null;

function findRevertOfMerge(branch) {
  // The actual revert is a `Revert "<original subject>"` commit — NOT the merge
  // commit of the revert PR. Exclude merges and require the subject to start with
  // `Revert "` so we revert the content-revert, not a merge (which needs -m).
  const slug = branch.replace(/^plan\//, '');
  const log = git(['log', BASE, '--no-merges', '--grep=^Revert "', '--format=%H\t%s'], { allowFail: true }) || '';
  for (const line of log.split('\n').filter(Boolean)) {
    const tab = line.indexOf('\t');
    const sha = line.slice(0, tab);
    const subj = line.slice(tab + 1);
    if (subj.startsWith('Revert "') && subj.includes(slug)) return sha;
  }
  return null;
}

function applyPolicy(path, c) {
  const ours = showStage(2, path);
  const theirs = showStage(3, path);
  const modifyDelete = ours == null || theirs == null;
  switch (c.policy) {
    case 'take-delete':
      git(['rm', '-f', '--', path], { allowFail: true });
      return { ok: true, action: 'rm (take-delete)' };
    case 'union': {
      if (modifyDelete) {
        const surv = ours ?? theirs;
        if (surv == null) { git(['rm', '-f', '--', path], { allowFail: true }); return { ok: true, action: 'rm (both deleted)' }; }
        writeFileSync(join(WD, path), surv); git(['add', '--', path]); return { ok: true, action: 'kept surviving side' };
      }
      writeFileSync(join(WD, path), unionLines(ours, theirs)); git(['add', '--', path]);
      return { ok: true, action: 'union (lossless)' };
    }
    case 'last-writer-wins': {
      if (modifyDelete) { const surv = ours ?? theirs; if (surv == null) { git(['rm', '-f', '--', path], { allowFail: true }); return { ok: true, action: 'rm' }; } writeFileSync(join(WD, path), surv); git(['add', '--', path]); return { ok: true, action: 'kept survivor' }; }
      const pick = pickNewerByTimestamp(ours, theirs);
      if (!pick) return { ok: false }; // FAIL-CLOSED → eject
      writeFileSync(join(WD, path), pick.text); git(['add', '--', path]);
      return { ok: true, action: `last-writer-wins (${pick.side})` };
    }
    case 'take-ours-verify': {
      if (ours == null) { git(['rm', '-f', '--', path], { allowFail: true }); return { ok: true, action: 'rm (ours deleted)', flagVerify: true }; }
      git(['checkout', '--ours', '--', path], { allowFail: true }); git(['add', '--', path]);
      return { ok: true, action: 'take-ours + FLAG-VERIFY', flagVerify: true };
    }
    case 'regenerate': {
      if (modifyDelete) { git(['rm', '-f', '--', path], { allowFail: true }); return { ok: true, action: 'rm (generated, deleted one side)' }; }
      git(['checkout', '--ours', '--', path], { allowFail: true }); git(['add', '--', path]);
      return { ok: true, action: 'take-ours (will regenerate)', regen: true };
    }
    default:
      return { ok: false };
  }
}

const audit = [];
let stopped = null;

// A revert-of-revert is already applied when HEAD history records reverting that sha.
const revertAlreadyUndone = (sha) =>
  (git(['log', 'HEAD', '--grep', `This reverts commit ${sha}`, '--format=%H'], { allowFail: true }) || '').trim() !== '';

for (const branch of BRANCHES) {
  const ahead = Number((git(['rev-list', '--count', `${BASE}..${branch}`], { allowFail: true }) || '0').trim());
  const revertSha = REVERTED.has(branch) || ahead === 0 ? findRevertOfMerge(branch) : null;
  const decision = classifyBranchIntegration({ aheadCount: ahead, revertOfMergeSha: revertSha });

  // revert-of-revert is decided BEFORE the ancestor-skip: a merged-then-reverted
  // branch IS an ancestor of HEAD (its commits are in history) yet its CONTENT is
  // absent — skipping it would silently drop the feature.
  if (decision.action === 'revert-of-revert') {
    if (revertAlreadyUndone(decision.revertSha)) { audit.push({ branch, action: 'skip (revert-of-revert already applied)' }); continue; }
    const r = git(['revert', '--no-edit', decision.revertSha], { allowFail: true });
    if (r == null) { stopped = { branch, reason: `revert-of-revert ${decision.revertSha} conflicted — manual` }; break; }
    audit.push({ branch, action: `revert-of-revert (${decision.revertSha.slice(0, 7)})`, note: 'merged-then-reverted restored' });
    continue;
  }
  if (isAncestor(branch, 'HEAD')) { audit.push({ branch, action: 'skip (already merged)' }); continue; }
  if (decision.action === 'skip-noop') { audit.push({ branch, action: 'skip (ahead=0, no revert)' }); continue; }

  // standard merge
  const merged = git(['merge', '--no-ff', '--no-edit', branch], { allowFail: true });
  const conflicted = (git(['diff', '--name-only', '--diff-filter=U'], { allowFail: true }) || '').split('\n').filter(Boolean);
  if (merged !== null && conflicted.length === 0) { audit.push({ branch, action: 'merge (clean, no conflicts)' }); continue; }

  const resolved = [];
  const ejected = [];
  for (const path of conflicted) {
    const c = classifyConflictPath(path, { generatedPaths: [] });
    if (!c.auto) { ejected.push({ path, class: c.class, reason: c.reason }); continue; }
    const applied = applyPolicy(path, c);
    if (!applied.ok) { ejected.push({ path, class: c.class, reason: 'policy could not apply (fail-closed)' }); continue; }
    resolved.push({ path, class: c.class, action: applied.action });
  }
  audit.push({ branch, action: 'merge + typed-resolution', autoResolved: resolved.length, resolved, ejected });

  if (ejected.length) { stopped = { branch, ejected }; break; }
  git(['commit', '--no-edit', '--no-verify']); // complete the fully-auto merge (skip per-commit doc hooks on intermediate trees)
}

// ── report ──
function line(s) { console.log(s); }
line('\n══════════ CONSOLIDATION AUDIT ══════════');
for (const a of audit) {
  line(`\n▸ ${a.branch} — ${a.action}`);
  if (a.resolved) for (const r of a.resolved) line(`    ✓ ${r.path}  [${r.class}] → ${r.action}`);
  if (a.ejected && a.ejected.length) for (const e of a.ejected) line(`    ⮕ EJECT ${e.path}  [${e.class}] — ${e.reason}`);
}

if (stopped) {
  line(`\n⛔ STOPPED at ${stopped.branch}: ${stopped.ejected ? stopped.ejected.length + ' semantic conflict(s) need a human' : stopped.reason}`);
  if (stopped.ejected) for (const e of stopped.ejected) line(`     - ${e.path}  [${e.class}]`);
  line('   Mechanical conflicts on this branch are already resolved + staged.');
  line('   Resolve the semantic file(s), `git commit --no-edit`, then re-run with the SAME --branches (merged ones are skipped).');
  process.exit(2);
}

// all branches integrated → regenerate artifacts + run the deterministic gate
if (REGEN) { line(`\n↻ regen: ${REGEN}`); const r = sh(REGEN); line(r.ok ? '   regen OK' : '   regen FAILED\n' + r.out.slice(-500)); }
if (GATE) {
  line(`\n⚖ deterministic gate: ${GATE}`);
  const g = sh(GATE);
  line(g.ok ? '   GATE PASS ✅' : '   GATE FAIL ❌\n' + g.out.slice(-800));
  process.exit(g.ok ? 0 : 1);
}
line('\n✅ all branches integrated.');
