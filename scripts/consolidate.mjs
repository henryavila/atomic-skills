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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  classifyConflictPath,
  unionLines,
  pickNewerByTimestamp,
  jsonCarriesTimestamp,
  classifyBranchIntegration,
} from './consolidation-resolve.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const name = k.slice(2);
    if (name === 'resume') {
      a[name] = true;
      continue;
    }
    a[name] = argv[i + 1];
    i++;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const WD = args.workdir;
let BASE = args.base;
let BRANCHES = (args.branches || '').split(',').map((s) => s.trim()).filter(Boolean);
const REVERTED = new Set((args.reverted || '').split(',').map((s) => s.trim()).filter(Boolean));
let REGEN = args.regen || '';
let GATE = args.gate || '';
const RESUME = args.resume === true;
const parseList = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);
// Repo-config for the two classes with no generic signal (default empty → generic).
let GENERATED_GLOBS = parseList(args['generated-globs']);
let NARRATIVE_GLOBS = parseList(args['narrative-globs']);
let RUNTIME_GLOBS = parseList(args['runtime-globs']);
if (!WD) {
  console.error('usage: consolidate.mjs --workdir <dir> --base <ref> --branches a,b,c [--resume]');
  process.exit(64);
}
try {
  if (!statSync(WD).isDirectory()) throw new Error('not a directory');
} catch {
  console.error(`ERROR: --workdir is not a readable directory: ${WD}`);
  process.exit(64);
}

const RUN_FILE = args['run-file'] || join(WD, '.atomic-skills', 'status', 'consolidate-run.json');

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  return `cons-${nowIso().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${process.pid}`;
}

function parseRunFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`ERROR: cannot read consolidate run file ${path}: ${error.message}`);
    process.exit(64);
  }
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function reconcileResumeValue(argValue, recordValue, label) {
  const normalizedRecord = recordValue || '';
  if (argValue && argValue !== normalizedRecord) {
    console.error(`ERROR: --resume ${label} mismatch: got ${argValue}, run file has ${normalizedRecord}`);
    process.exit(64);
  }
  return argValue || normalizedRecord;
}

function reconcileResumeList(argProvided, argValues, recordValues, label) {
  const normalizedRecord = Array.isArray(recordValues) ? recordValues : [];
  if (argProvided && !arraysEqual(argValues, normalizedRecord)) {
    console.error(`ERROR: --resume ${label} mismatch: got ${argValues.join(',')}, run file has ${normalizedRecord.join(',')}`);
    process.exit(64);
  }
  return argProvided ? argValues : normalizedRecord;
}

let runRecord = null;
if (RESUME) {
  if (!existsSync(RUN_FILE)) {
    console.error(`ERROR: --resume requested but no consolidate run file exists: ${RUN_FILE}`);
    process.exit(64);
  }
  runRecord = parseRunFile(RUN_FILE);
  if (runRecord.status === 'passed') {
    console.log(`consolidate: run ${runRecord.runId} already passed`);
    process.exit(0);
  }
  if (BASE && BASE !== runRecord.base) {
    console.error(`ERROR: --resume base mismatch: got ${BASE}, run file has ${runRecord.base}`);
    process.exit(64);
  }
  if (BRANCHES.length && !arraysEqual(BRANCHES, runRecord.branches)) {
    console.error(`ERROR: --resume branches mismatch: got ${BRANCHES.join(',')}, run file has ${(runRecord.branches || []).join(',')}`);
    process.exit(64);
  }
  BASE = runRecord.base;
  BRANCHES = Array.isArray(runRecord.branches) ? runRecord.branches : [];
  REGEN = reconcileResumeValue(args.regen, runRecord.regen, 'regen');
  GATE = reconcileResumeValue(args.gate, runRecord.gate, 'gate');
  GENERATED_GLOBS = reconcileResumeList(Object.hasOwn(args, 'generated-globs'), GENERATED_GLOBS, runRecord.generatedGlobs, 'generated-globs');
  NARRATIVE_GLOBS = reconcileResumeList(Object.hasOwn(args, 'narrative-globs'), NARRATIVE_GLOBS, runRecord.narrativeGlobs, 'narrative-globs');
  RUNTIME_GLOBS = reconcileResumeList(Object.hasOwn(args, 'runtime-globs'), RUNTIME_GLOBS, runRecord.runtimeGlobs, 'runtime-globs');
}

if (!BASE || !BRANCHES.length) {
  console.error('usage: consolidate.mjs --workdir <dir> --base <ref> --branches a,b,c [--resume]');
  process.exit(64);
}

function initRunRecord() {
  if (runRecord) {
    return {
      ...runRecord,
      status: 'running',
      resumedAt: nowIso(),
      updatedAt: nowIso(),
      stop: null,
    };
  }
  const now = nowIso();
  return {
    schemaVersion: '0.1',
    kind: 'consolidate-run',
    runId: newRunId(),
    status: 'running',
    workdir: WD,
    base: BASE,
    branches: BRANCHES,
    regen: REGEN || null,
    gate: GATE || null,
    generatedGlobs: GENERATED_GLOBS,
    narrativeGlobs: NARRATIVE_GLOBS,
    runtimeGlobs: RUNTIME_GLOBS,
    startedAt: now,
    updatedAt: now,
    currentBranch: null,
    candidates: BRANCHES.map((branch) => ({ branch, status: 'pending' })),
    audit: [],
    stop: null,
  };
}

function writeRunRecord() {
  runRecord.updatedAt = nowIso();
  mkdirSync(pathDirname(RUN_FILE), { recursive: true });
  writeFileSync(RUN_FILE, `${JSON.stringify(runRecord, null, 2)}\n`);
}

function recordCandidate(branch, status, patch = {}) {
  const candidates = Array.isArray(runRecord.candidates) ? runRecord.candidates : [];
  let candidate = candidates.find((entry) => entry.branch === branch);
  if (!candidate) {
    candidate = { branch, status: 'pending' };
    candidates.push(candidate);
    runRecord.candidates = candidates;
  }
  Object.assign(candidate, { status, updatedAt: nowIso() }, patch);
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
    const out = execFileSync('bash', ['-lc', cmd], { cwd: WD, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}
function mustResolveRef(ref, label) {
  try {
    git(['rev-parse', '--verify', '--end-of-options', ref]);
  } catch {
    console.error(`ERROR: cannot resolve ${label} '${ref}' in ${WD}`);
    process.exit(2);
  }
}
const showStage = (n, path) => git(['show', `:${n}:${path}`], { allowFail: true });
const isAncestor = (a, b) => git(['merge-base', '--is-ancestor', a, b], { allowFail: true }) !== null;

mustResolveRef(BASE, 'base');
for (const branch of BRANCHES) mustResolveRef(branch, 'branch');
runRecord = initRunRecord();
writeRunRecord();

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

const audit = Array.isArray(runRecord.audit) ? [...runRecord.audit] : [];
let stopped = null;

function pushAudit(entry) {
  audit.push(entry);
  runRecord.audit = audit;
  writeRunRecord();
}

// A revert-of-revert is already applied when HEAD history records reverting that sha.
const revertAlreadyUndone = (sha) =>
  (git(['log', 'HEAD', '--grep', `This reverts commit ${sha}`, '--format=%H'], { allowFail: true }) || '').trim() !== '';

for (const branch of BRANCHES) {
  runRecord.currentBranch = branch;
  recordCandidate(branch, 'running');
  writeRunRecord();

  const ahead = Number((git(['rev-list', '--count', `${BASE}..${branch}`], { allowFail: true }) || '0').trim());
  const revertSha = REVERTED.has(branch) || ahead === 0 ? findRevertOfMerge(branch) : null;
  const decision = classifyBranchIntegration({ aheadCount: ahead, revertOfMergeSha: revertSha });

  // revert-of-revert is decided BEFORE the ancestor-skip: a merged-then-reverted
  // branch IS an ancestor of HEAD (its commits are in history) yet its CONTENT is
  // absent — skipping it would silently drop the feature.
  if (decision.action === 'revert-of-revert') {
    if (revertAlreadyUndone(decision.revertSha)) {
      const action = 'skip (revert-of-revert already applied)';
      recordCandidate(branch, 'skipped', { action });
      pushAudit({ branch, action });
      continue;
    }
    const r = git(['revert', '--no-edit', decision.revertSha], { allowFail: true });
    if (r == null) {
      stopped = { branch, reason: `revert-of-revert ${decision.revertSha} conflicted — manual` };
      recordCandidate(branch, 'ejected', { reason: stopped.reason });
      writeRunRecord();
      break;
    }
    const action = `revert-of-revert (${decision.revertSha.slice(0, 7)})`;
    recordCandidate(branch, 'merged', { action, revertSha: decision.revertSha });
    pushAudit({ branch, action, note: 'merged-then-reverted restored' });
    continue;
  }
  if (isAncestor(branch, 'HEAD')) {
    const action = 'skip (already merged)';
    recordCandidate(branch, 'skipped', { action });
    pushAudit({ branch, action });
    continue;
  }
  if (decision.action === 'skip-noop') {
    const action = 'skip (ahead=0, no revert)';
    recordCandidate(branch, 'skipped', { action });
    pushAudit({ branch, action });
    continue;
  }

  // standard merge
  const merged = git(['merge', '--no-ff', '--no-edit', branch], { allowFail: true });
  const conflicted = (git(['diff', '--name-only', '--diff-filter=U'], { allowFail: true }) || '').split('\n').filter(Boolean);
  if (merged !== null && conflicted.length === 0) {
    const action = 'merge (clean, no conflicts)';
    recordCandidate(branch, 'merged', { action });
    pushAudit({ branch, action });
    continue;
  }

  const resolved = [];
  const ejected = [];
  for (const path of conflicted) {
    // Compute the SIGNALS the classifier decides over (orchestrator does the I/O).
    const ours = showStage(2, path);
    const theirs = showStage(3, path);
    const headText = (ours ?? theirs ?? '').slice(0, 600);
    const mergeUnion = /merge:\s*union/.test(git(['check-attr', 'merge', '--', path], { allowFail: true }) || '');
    const gitIgnored = git(['check-ignore', '-q', '--', path], { allowFail: true }) !== null;
    const jsonTimestamped = ours != null && theirs != null && jsonCarriesTimestamp(ours, theirs);
    const c = classifyConflictPath(path, {
      headText, mergeUnion, gitIgnored, jsonTimestamped,
      generatedGlobs: GENERATED_GLOBS, narrativeGlobs: NARRATIVE_GLOBS, runtimeGlobs: RUNTIME_GLOBS,
    });
    if (!c.auto) { ejected.push({ path, class: c.class, reason: c.reason }); continue; }
    const applied = applyPolicy(path, c);
    if (!applied.ok) { ejected.push({ path, class: c.class, reason: 'policy could not apply (fail-closed)' }); continue; }
    resolved.push({ path, class: c.class, action: applied.action });
  }
  recordCandidate(branch, ejected.length ? 'ejected' : 'merged', {
    action: 'merge + typed-resolution',
    autoResolved: resolved.length,
    resolved,
    ejected,
  });
  pushAudit({ branch, action: 'merge + typed-resolution', autoResolved: resolved.length, resolved, ejected });

  if (ejected.length) {
    stopped = { branch, ejected };
    runRecord.status = 'blocked';
    runRecord.stop = stopped;
    writeRunRecord();
    break;
  }
  git(['commit', '--no-edit', '--no-verify']); // complete the fully-auto merge (skip per-commit doc hooks on intermediate trees)
  writeRunRecord();
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
  runRecord.status = 'blocked';
  runRecord.stop = stopped;
  runRecord.currentBranch = stopped.branch;
  writeRunRecord();
  line(`\n⛔ STOPPED at ${stopped.branch}: ${stopped.ejected ? stopped.ejected.length + ' semantic conflict(s) need a human' : stopped.reason}`);
  if (stopped.ejected) for (const e of stopped.ejected) line(`     - ${e.path}  [${e.class}]`);
  line('   Mechanical conflicts on this branch are already resolved + staged.');
  line('   Resolve the semantic file(s), `git commit --no-edit`, then re-run with the SAME --branches (merged ones are skipped).');
  process.exit(2);
}

// all branches integrated → regenerate artifacts + run the deterministic gate
if (REGEN) {
  line(`\n↻ regen: ${REGEN}`);
  const r = sh(REGEN);
  line(r.ok ? '   regen OK' : '   regen FAILED\n' + r.out.slice(-500));
  runRecord.regenResult = r.ok ? { ok: true } : { ok: false, outputTail: r.out.slice(-500) };
  writeRunRecord();
}
if (GATE) {
  line(`\n⚖ deterministic gate: ${GATE}`);
  const g = sh(GATE);
  line(g.ok ? '   GATE PASS ✅' : '   GATE FAIL ❌\n' + g.out.slice(-800));
  runRecord.status = g.ok ? 'passed' : 'failed';
  runRecord.currentBranch = null;
  if (!g.ok) runRecord.failure = { stage: 'gate', outputTail: g.out.slice(-800) };
  writeRunRecord();
  process.exit(g.ok ? 0 : 1);
}
runRecord.status = 'passed';
runRecord.currentBranch = null;
runRecord.stop = null;
writeRunRecord();
line('\n✅ all branches integrated.');
