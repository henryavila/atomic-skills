# Review — integrity-remediation (Codex CROSS-MODEL)

**Date:** 2026-07-16T18:44:07Z
**Mode:** codex (sealed two-pass envelope)
**Provider:** codex
**Reviewer model:** gpt-5-codex
**Codex CLI:** codex-cli 0.144.4
**Branch:** plan/integrity-remediation
**Range:** origin/develop...HEAD (`731832e`)
**Scope:** product paths — src/, scripts/, skills/, meta/, package.json, .github/workflows/, docs/audits/
**Patch-id:** 3dbe7c1ca11e30041d322ab23a4c8ce3f520f2ab
**Verdict (Pass 1 blind):** reject — 0B/3C/11M/1m
**Verdict (Pass 2 informed):** reject — 0B/3C/10M/2m

## Framing Δ

- Dropped from blind: 1 major (findings-manifest declarative contract)
- Maintained: 14 (3 critical unchanged; 1 major→minor for reviewGate absence)
- Emerged: 1 major (F4-G3 successorBarrier.skip bypass)

## Receipt

- Pass 1 output: `/tmp/grok-goal-4a02531e9a98/implementer/codex-review/pass1-output.md`
- Pass 2 output: `/tmp/grok-goal-4a02531e9a98/implementer/codex-review/pass2-output.md`
- Briefings: sealed (anti-framing, no intent narrative)

---

## Pass 2 final findings (authoritative)

---
verdict: reject
counts: {blocker: 0, critical: 3, major: 10, minor: 2, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary

The factual constraints invalidate the objection to declarative findings-manifest evidence and permit partial multi-OS receipts, but they do not address three critical defects: shell-command injection, marker-directed arbitrary filesystem mutation, and deletion of concurrent live locks.

Ten major correctness and concurrency issues remain across runtime ownership, completion logging, materialization, release qualification, and state validation. The non-deferrable F4-G3 constraint also reveals a direct `skip: true` bypass in the single materialization authority. The branch should not merge until the critical and major findings are resolved.

## Findings

### F-001 [critical] security — src/project-target-resolver.js:155

**Evidence:** `branch`, `path`, and `baseRef` are inserted into a shell command string at lines 161–163 without quoting or validation.

**Claim:** Repository-controlled values can introduce shell metacharacters or option injection into the worktree command.

**Impact:** Executing the returned action can run arbitrary commands, violating the explicit argv-separation requirement.

**Recommendation:** Return `{executable: "git", argv: [...]}` and execute without a shell. Validate refs with `git check-ref-format`, reject option-like values, and constrain worktree paths.

**Confidence:** high

---

### F-002 [critical] security — scripts/materialize-state.js:196

**Evidence:** `absFrom()` accepts absolute and escaping paths. `cleanupTx()` unlinks marker-selected files at lines 215–222, while recovery uses marker-selected live and staging paths at lines 236–241 and can rename them over destinations.

**Claim:** A crafted materialization marker controls files deleted, restored, or overwritten during recovery.

**Impact:** Routine recovery can delete or overwrite arbitrary user-writable files outside the transaction root.

**Recommendation:** Fully schema-validate markers and require all paths to be canonical, relative, no-follow descendants of the expected transaction directory. Reject absolute paths, traversal, and symlinked components.

**Confidence:** high

---

### F-003 [critical] race-condition — src/runtime-locks.js:152

**Evidence:** After releasing its own locks, `pruneEmptyLockRoot()` iterates over the lock directory and unlinks every entry at lines 175–180.

**Claim:** One process can delete lock files currently owned by another process.

**Impact:** Additional processes can enter registry/runtime critical sections concurrently, causing lost ownership updates or partially published runtime state.

**Recommendation:** Release only locks whose identity and owner token match the current holder. Never sweep arbitrary lock files; remove the directory only with a safe empty-directory operation.

**Confidence:** high

---

### F-004 [major] race-condition — src/install.js:597

**Evidence:** `installRuntimeArtifacts()` and `registerInstall()` are separate operations at lines 602–603. Conversely, uninstall releases the registry lock before `removeRuntimeArtifacts()` at `src/uninstall.js:160–161`.

**Claim:** No lock spans runtime publication plus ownership registration, or ownership removal plus conditional reclamation.

**Impact:** Concurrent install/uninstall operations can remove newly published runtime files or retain a registered installation with incomplete shared artifacts.

**Recommendation:** Hold the same registry/runtime locks across each complete publication or reclamation transaction, and publish directories through atomic replacement.

**Confidence:** high

---

### F-005 [major] data-integrity — src/install.js:156

**Evidence:** Registration and unregistration catch every registry read/parse error as an empty array at lines 159–160 and 175–177. Unregistration then deletes the registry when the resulting list is empty.

**Claim:** Corrupt, unreadable, and supported versioned `{owners: [...]}` registries are treated as having no owners.

**Impact:** Uninstall can delete the registry and shared runtime still needed by other installations.

**Recommendation:** Reuse the strict registry parser, fail closed on corruption or unknown versions, preserve owner metadata, and replace the registry atomically.

**Confidence:** high

---

### F-006 [major] correctness — scripts/done-transaction.js:119

**Evidence:** `verifierOk()` accepts stored `evidence.passed` even when `verifierPassed` is explicitly false. Fingerprint mismatch is checked only for an already-done task at lines 235–243.

**Claim:** Fresh closure can reuse stale evidence from another commit and override a current failing verifier result.

**Impact:** A changed or currently failing task can be closed as done. A direct pure-function check with stale evidence, a different fingerprint, and `verifierPassed: false` returns `allowed: true`.

**Recommendation:** Explicit current failure must override stored evidence. For fresh nonlegacy closures, require current verifier output anchored to HEAD; when `verifiedCommit` is present, require it to match the current fingerprint.

**Confidence:** high

---

### F-007 [major] race-condition — scripts/append-completion.js:317

**Evidence:** Lines 325–336 perform an unlocked read/check followed by append. The read path also silently skips malformed lines and converts read failures into an empty log at lines 237–256.

**Claim:** Concurrent closers can both observe no matching event and append duplicate identities.

**Impact:** The exactly-once completion contract and recovery decisions become unreliable; downstream deduplication does not repair the authoritative append log.

**Recommendation:** Serialize scan-and-append under a canonical lock or use atomic identity-keyed event files. Fail closed on malformed or unreadable completion logs.

**Confidence:** high

---

### F-008 [major] release-gate — scripts/verify-ci-candidate.js:106

**Evidence:** OS coverage is calculated as one union at lines 140–151 and Node coverage as another at lines 154–169. Job status and SHA are optional at lines 126 and 135.

**Claim:** A `status: "full"` receipt does not need successful, candidate-bound evidence for every OS×Node tuple.

**Impact:** Linux/22, macOS/24, and Windows/24 passes validation despite missing three required tuples. This is separate from the permitted `status: partial` plus `--allow-partial` path.

**Recommendation:** For full receipts, require the complete Cartesian product, with each tuple represented by a successful, non-skipped job containing a matching candidate SHA and real `process.version`.

**Confidence:** high

---

### F-009 [major] race-condition — scripts/materialize-state.js:502

**Evidence:** Every transaction for a plan uses the same staging, backup, and marker filenames at lines 502–505 and writes them non-exclusively before publishing the marker at line 547.

**Claim:** Concurrent materializations can overwrite one another’s staged bytes, backups, or recovery marker.

**Impact:** One transaction can rename or clean another transaction’s files, producing a mismatched descriptor/initiative pair or unrecoverable state.

**Recommendation:** Acquire a canonical per-plan lock, use transaction-specific exclusive files, and recheck live before-hashes immediately before publication.

**Confidence:** high

---

### F-010 [major] data-integrity — scripts/validate-state.js:918

**Evidence:** Lines 927–931 insert plans and initiatives into maps keyed only by `projectId/slug`; later files silently replace earlier entries.

**Claim:** Duplicate authoritative files disappear before structural and cross-file validation.

**Impact:** One duplicate can carry invalid identity, tasks, gates, or terminal state while validation examines only the last file encountered.

**Recommendation:** Detect duplicate keys during collection and report every conflicting source path, or retain arrays until authority uniqueness is validated.

**Confidence:** high

---

### F-011 [major] security — scripts/verify-installed-runtime.js:186

**Evidence:** Repair joins the manifest path to `basePath`, creates parents, and calls `writeFileSync()` at lines 210–212 without containment or symlink checks.

**Claim:** Forced repair follows symlinked manifest destinations.

**Impact:** An untrusted project can redirect package repair content onto an unowned file outside the installation root, violating P1.

**Recommendation:** Normalize and enforce containment, reject traversal, `lstat` every component, reject symlinks and nonregular files, and use no-follow replacement operations.

**Confidence:** high

---

### F-012 [major] correctness — scripts/materialize-state.js:133

**Evidence:** `validateStagedPair()` checks only parseable frontmatter, a nonempty `phases` array, and matching `phaseId` membership.

**Claim:** The single descriptor→initiative publication authority does not apply the authoritative schemas or full project/plan/phase identity invariants.

**Impact:** It can publish schema-invalid or misjoined state that subsequent authoritative validation rejects.

**Recommendation:** Run the same Ajv schemas and relevant `validate-state`/state-invariant checks against the staged pair before creating staging files or a marker.

**Confidence:** high

---

### F-013 [minor] correctness — scripts/validate-state.js:576

**Evidence:** A done phase with no `reviewGate` is unconditionally accepted at line 584.

**Claim:** Structural validation cannot distinguish a legitimately grandfathered legacy phase from a newly or manually closed phase whose review metadata was removed.

**Impact:** Out-of-band state edits can validate as done without review evidence. The phase-done commit guard protects the normal transition path, reducing the blind-pass severity.

**Recommendation:** Grandfather legacy omission through an explicit schema version or migration marker; require `reviewGate` for newly written done phases.

**Confidence:** high

---

### F-014 [minor] release-gate — scripts/verify-ci-candidate.js:188

**Evidence:** `checkNoProductDiff()` checks only committed `candidateSha..HEAD` paths at lines 202–215.

**Claim:** Staged, unstaged, and untracked product changes are excluded from the freeze check.

**Impact:** Local qualification can test dirty product bytes absent from the candidate commit while reporting no post-freeze product changes.

**Recommendation:** Also inspect staged and unstaged diffs plus untracked paths from `git status --porcelain`, applying the same exact allowlist.

**Confidence:** high

---

### F-015 [major] lifecycle-bypass — scripts/materialize-state.js:360

**Evidence:** Passing `successorBarrier: {skip: true}` returns immediately at lines 370–372. `materializePair()` exposes this option and calls the function before publication.

**Claim:** The single materialization authority provides a caller-controlled bypass for the explicitly non-deferrable F4-G3 successor barrier.

**Impact:** A caller can publish a phase depending on F4 without F4 being done, F4-G3 being met, or the required reconciliation receipt existing.

**Recommendation:** Remove the production bypass. If tests need isolation, inject a private test-only barrier dependency or exercise fixtures that satisfy the barrier.

**Confidence:** high

## Questions (non-findings)

- scripts/verify-findings-manifest.js:204 — Is `status: "open"` intentionally release-eligible because the manifest is inventory rather than a closure gate?

## Out of scope

- Publishing an npm release or production git tags.
- Creating a permanent fork of `minimalist-installer`.
- Redesigning the aiDeck UI.
- Requiring multi-OS green results without available runners.

## Pass 2 reconciliation

### Dropped from blind pass

- F-009-blind [major] release-gate — DROPPED: the stated manifest contract is declarative and requires the exact source-qualified set plus `verifier.passed: true`, both of which are enforced; authenticated CI binding and closed-only dispositions were not factual requirements.

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [critical] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same
- F-006-blind → F-006-final [major] — same
- F-007-blind → F-007-final [major] — same
- F-008-blind → F-008-final [major] — same; refined to full receipts because partial receipts are explicitly allowed
- F-010-blind → F-009-final [major] — same
- F-011-blind → F-010-final [major] — same
- F-012-blind → F-011-final [major] — same
- F-013-blind → F-012-final [major] — same
- F-014-blind → F-013-final [minor] — severity changed: was major, now minor because phase-done’s commit guard protects the authorized transition; the remaining issue is structural validation of out-of-band state
- F-015-blind → F-014-final [minor] — same

### Emerged

- F-015-final [major] lifecycle-bypass — emerged: the revealed requirement that F4-G3 is non-deferrable conflicts with the caller-controlled `successorBarrier.skip` path in the single materialization authority.
---

## Pass 1 blind (archive)

---
verdict: reject
counts: {blocker: 0, critical: 3, major: 11, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary

The changes introduce arbitrary command execution through unquoted worktree commands, arbitrary filesystem deletion during materialization recovery, and a lock-cleanup race that destroys another process’s live lock. Shared runtime registration, recovery, completion logging, and materialization also contain non-atomic operations that can corrupt state under concurrency or failure.

Release gates can accept incomplete Cartesian coverage, stale task-verifier evidence, unresolved findings, omitted review gates, and dirty product trees. State validation silently overwrites duplicate authorities, while runtime repair follows symlinks outside the install root.

## Findings

### F-001 [critical] security — src/project-target-resolver.js:155-163

**Evidence:**
```js
const br = text(branch) || planBranchName(s);
const wtPath = text(path) || `.worktrees/${s}`;
const base = text(baseRef) || 'HEAD';

if (branchExists) {
  // Reuse existing branch — never pass -b (Git fails: branch already exists)
  return `git worktree add ${wtPath} ${br}`;
}
return `git worktree add -b ${br} ${wtPath} ${base}`;
```

**Claim:** Repository-controlled branch, path, and base-ref values are interpolated into an executable shell command without validation or quoting.

**Impact:** A value such as `branch: "x; malicious-command"` executes arbitrary commands when the returned create-worktree action is run by the skill.

**Recommendation:** Return an executable plus argv array and invoke it without a shell; validate branches with `git check-ref-format`, reject option-like arguments, and constrain worktree paths to the intended root.

**Confidence:** high

---

### F-002 [critical] security — scripts/materialize-state.js:196-220

**Evidence:**
```js
function absFrom(baseDir, maybeRel) {
  if (!maybeRel) return null;
  return isAbsolute(maybeRel) ? maybeRel : join(baseDir, maybeRel);
}

function cleanupTx(markerPath, marker) {
  const baseDir = dirname(resolve(markerPath));
  const staging = marker.staging || {};
  for (const key of ['plan', 'initiative', 'planBefore', 'initiativeBefore']) {
    const p = absFrom(baseDir, staging[key]);
    if (p) safeUnlink(p);
  }
  safeUnlink(markerPath);
}
```

**Claim:** Recovery trusts absolute and `../` paths from a repository marker and unconditionally deletes the referenced staging files.

**Impact:** A crafted `plan.md.materialize-tx.json` can cause routine materialization or `--recover` to delete arbitrary files writable by the user; restore branches can similarly overwrite marker-selected paths.

**Recommendation:** Schema-validate the complete marker and require every live, staging, and backup path to resolve beneath the expected plan transaction root without traversing symlinks; reject all absolute and escaping paths.

**Confidence:** high

---

### F-003 [critical] race-condition — src/runtime-locks.js:152-180

**Evidence:**
```js
try {
  return fn();
} finally {
  locks.release();
  pruneEmptyLockRoot(lockRoot);
}

// ...

for (const name of readdirSync(lockRoot)) {
  try {
    unlinkSync(join(lockRoot, name));
  } catch {
    // still held or not a file — leave it
  }
}
```

**Claim:** After releasing its own locks, a process deletes every lock file, including locks acquired concurrently by other processes.

**Impact:** A third process can acquire the deleted identity and enter a registry or runtime critical section concurrently, causing lost ownership updates and partially written shared runtime state.

**Recommendation:** Remove the blanket sweep; release only lock files whose identity and ownership match the current holder, and remove the lock directory only after an atomic empty-directory check.

**Confidence:** high

---

### F-004 [major] race-condition — src/install.js:597-603

**Evidence:**
```js
const result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope });

// Host plugin registry (outside journal): native Grok plugin, outside Codex.
syncGrokPluginHostAfterInstall(basePath, ides, language);

installRuntimeArtifacts();
registerInstall(basePath);
```

**Claim:** Shared runtime publication and ownership registration are separate operations with no lock spanning both.

**Impact:** An uninstall can observe zero owners after a concurrent install publishes runtime files but before it registers, remove those files, and leave the install reporting success with a missing launcher, dashboard, or provisioner.

**Recommendation:** Hold one shared registry/runtime lock across artifact staging and registration, and across unregister plus conditional reclamation; publish artifacts from a temporary directory by atomic rename.

**Confidence:** high

---

### F-005 [major] data-integrity — src/install.js:173-184

**Evidence:**
```js
export function unregisterInstall(basePath) {
  return withSharedRuntimeLocks({ basePath }, () => {
    const p = installsRegistryPath();
    let list = [];
    try { const v = JSON.parse(readFileSync(p, 'utf8')); if (Array.isArray(v)) list = v; } catch {}
    const next = list.filter((b) => b !== basePath);
    if (next.length === 0) {
      try { unlinkSync(p); } catch {}
      return 0;
    }
    try { writeFileSync(p, JSON.stringify(next, null, 2) + '\n'); } catch {}
    return next.length;
  });
}
```

**Claim:** Malformed JSON, I/O errors, and the supported versioned `{owners: [...]}` registry format are all interpreted as an empty owner list.

**Impact:** Uninstall deletes the registry, returns zero, and removes shared runtime artifacts still required by other installations.

**Recommendation:** Use the strict shared registry parser for both observation and mutation, fail closed on corrupt or unknown formats, preserve versioned owner metadata, and replace the file atomically.

**Confidence:** high

---

### F-006 [major] correctness — scripts/done-transaction.js:119-127

**Evidence:**
```js
function verifierOk(input) {
  if (input.verifierPassed === true || input.manualAck === true) return true;
  const evidence = evidenceOf(input);
  if (evidence.passed === true) return true;
  // No verifier (or manual-only) may close via explicit manualAck / passed evidence.
  if (!hasVerifier(input) && (input.allowManual === true || evidence.verifierKind === 'manual')) {
    return evidence.passed === true || input.manualAck === true;
  }
  return false;
}
```

**Claim:** A fresh close accepts stored `evidence.passed` even when the supplied current verifier result is false and its `verifiedCommit` does not match current HEAD.

**Impact:** A task can be marked done after its code changes or its verifier begins failing, using stale evidence from an earlier commit.

**Recommendation:** For fresh closes, require an explicit current pass and require its verified commit to match the current fingerprint; treat an explicit false result as overriding stored evidence.

**Confidence:** high

---

### F-007 [major] race-condition — scripts/append-completion.js:325-336

**Evidence:**
```js
const record = normalize(effectiveEntry); // validate BEFORE touching the filesystem
const key = completionEventKey(record);
const existing = key != null ? findCompletionByKey(root, key) : undefined;
if (existing !== undefined) {
  return Object.defineProperties({ ...existing }, {
    appended: { value: false, enumerable: false },
    idempotent: { value: true, enumerable: false },
  });
}
const dir = join(resolve(root), ...ANALYTICS_DIR);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
appendFileSync(join(dir, LOG_FILE), `${JSON.stringify(record)}\n`);
```

**Claim:** Completion idempotency is implemented as an unlocked check-then-append sequence.

**Impact:** Concurrent task closes can both observe no event and append duplicate logical events, corrupting analytics and recovery decisions despite the exactly-once contract.

**Recommendation:** Serialize scan-and-append under a shared lock or store events using atomic identity-keyed files; make corrupt existing lines a hard error rather than treating them as absent.

**Confidence:** high

---

### F-008 [major] release-gate — scripts/verify-ci-candidate.js:140-169

**Evidence:**
```js
const osCovered = new Set(jobs.map((j) => normalizeOs(j.os)).filter(Boolean));

// ...

const recordedVersions = [
  ...jobs.map((j) => j.nodeVersion).filter(Boolean),
  ...(Array.isArray(receipt.nodeCoverage)
    ? receipt.nodeCoverage.map((n) => n.version || n).filter(Boolean)
    : []),
];

// ...

const hit = recordedVersions.some((v) => nodeSatisfies(v, req));
```

**Claim:** The verifier checks OS and Node coverage as independent unions rather than requiring every OS×Node tuple.

**Impact:** Linux/22, macOS/24, and Windows/24 is accepted as full coverage despite three missing matrix jobs; jobs may also omit success status or candidate SHA.

**Recommendation:** Build the required Cartesian product and require one successful, non-skipped job with a real matching candidate SHA and process version for every tuple.

**Confidence:** high

---

### F-009 [major] release-gate — scripts/verify-findings-manifest.js:171-205

**Evidence:**
```js
if (f.verifier.passed !== true) {
  errors.push(`${prefix} (${id}): verifier.passed must be true`);
}

// ...

const hasDigest = typeof f.evidence.digest === 'string' && f.evidence.digest.length >= 8;
const hasJob = typeof f.evidence.job === 'string' && f.evidence.job.length > 0;

// ...

if (typeof f.status !== 'string' || !f.status) {
  errors.push(`${prefix} (${id}): status required`);
}
```

**Claim:** The release gate trusts self-declared booleans and arbitrary evidence strings while accepting any non-empty status, including `open`.

**Impact:** An unresolved finding with command `false`, `passed: true`, and an imaginary job or digest passes the verifier and can be represented as release-qualified.

**Recommendation:** Reject open findings, validate disposition-specific evidence, and bind job IDs and digests to the candidate’s authenticated CI receipt or captured verifier output.

**Confidence:** high

---

### F-010 [major] race-condition — scripts/materialize-state.js:502-547

**Evidence:**
```js
const stagePlanAbs = `${planAbs}${STAGE_SUFFIX}`;
const stageInitAbs = `${initAbs}${STAGE_SUFFIX}`;
const beforePlanAbs = planBeforeHash !== null ? `${planAbs}${BEFORE_SUFFIX}` : null;
const beforeInitAbs = initBeforeHash !== null ? `${initAbs}${BEFORE_SUFFIX}` : null;

// 5. Write staging (after content) + before backups on same filesystem.
writeFileDurable(stagePlanAbs, planContent);
writeFileDurable(stageInitAbs, initiativeContent);

// ...

writeFileDurable(markerAbs, `${JSON.stringify(marker, null, 2)}\n`);
```

**Claim:** Concurrent transactions for the same plan use identical staging, backup, and marker paths without a lock or exclusive creation.

**Impact:** Transactions can overwrite each other’s prepared bytes and marker, rename the other transaction’s staging file, or delete its recovery data, leaving a mismatched plan/initiative pair.

**Recommendation:** Acquire a canonical per-plan lock, create marker and staging files exclusively with transaction-specific names, and compare live before-hashes immediately before publication.

**Confidence:** high

---

### F-011 [major] data-integrity — scripts/validate-state.js:918-932

**Evidence:**
```js
const planFrontmatters = new Map();
const initiativeFrontmatters = new Map();

// ...

if (kind === 'plan') {
  planFrontmatters.set(`${projectId}/${parsed.frontmatter.slug}`, { ...parsed.frontmatter, __projectId: projectId });
}
if (kind === 'initiative') {
  initiativeFrontmatters.set(`${projectId}/${parsed.frontmatter.slug}`, { ...parsed.frontmatter, __projectId: projectId });
}
```

**Claim:** Two files declaring the same project and slug overwrite each other in the validation maps before uniqueness and cross-file checks run.

**Impact:** Multiple authoritative plan or initiative files can pass validation while only the last file participates in identity, gate, and terminal-state checks.

**Recommendation:** Detect an existing key before insertion and report both source paths as a hard duplicate-authority error, or retain arrays of entries through cross-validation.

**Confidence:** high

---

### F-012 [major] security — scripts/verify-installed-runtime.js:194-212

**Evidence:**
```js
if (f.state === 'modified' || f.state === 'preserved' || f.state === 'conflict') {
  if (!opts.forceModified) {
    skipped.push({ path: f.path, state: f.state, reason: 'local modification; pass --force-modified' });
    continue;
  }
}

// ...

const abs = join(report.basePath, f.path);
mkdirSync(dirname(abs), { recursive: true });
writeFileSync(abs, f.desiredContent);
```

**Claim:** Runtime repair writes through symlinked manifest destinations without containment or no-follow checks.

**Impact:** In an untrusted project, `--repair --force-modified` can overwrite a symlink target outside the installation root using package-controlled desired content.

**Recommendation:** Validate normalized containment, `lstat` every path component, reject symlinks and non-regular destinations, and use no-follow exclusive file operations where supported.

**Confidence:** high

---

### F-013 [major] correctness — scripts/materialize-state.js:138-160

**Evidence:**
```js
if (!Array.isArray(planFm.phases) || planFm.phases.length === 0) {
  throw new Error('invalid staged plan: missing phases[]');
}
const phaseId = initFm.phaseId ?? null;
if (!phaseId || typeof phaseId !== 'string' || phaseId.trim() === '') {
  throw new Error('invalid staged initiative: missing phaseId');
}
const match = planFm.phases.find((p) => p && p.id === phaseId);
if (!match) {
  throw new Error(`invalid staged pair: plan has no phase ${phaseId}`);
}
return { planFm, initFm };
```

**Claim:** The materialization authority validates only parseability, a nonempty phase array, and phase ID membership rather than the plan and initiative schemas or full identity join.

**Impact:** It can atomically publish schema-invalid state or an initiative with the wrong `parentPlan`, slug, project identity, tasks, gates, or status.

**Recommendation:** Run the same Ajv schemas and cross-state invariants used by `validate-state` against the staged pair before writing any staging or marker files.

**Confidence:** high

---

### F-014 [major] release-gate — scripts/validate-state.js:576-584

**Evidence:**
```js
for (const phase of phases) {
  if (phase?.status !== 'done') continue;
  const rg = phase.reviewGate;
  if (rg == null || typeof rg !== 'object') continue; // absent ⇒ tolerated (legacy / GATE-R2-consistent)
```

**Claim:** Deleting or omitting `reviewGate` entirely bypasses all review validation for a done phase.

**Impact:** Newly closed phases can pass machine validation without a passed review or an explicit recorded skip, and there is no persisted distinction between legacy and new phases.

**Recommendation:** Require `reviewGate` for current-schema done phases and grandfather legacy files through an explicit schema version or migration cutoff rather than field absence.

**Confidence:** high

---

### F-015 [minor] release-gate — scripts/verify-ci-candidate.js:202-211

**Evidence:**
```js
const diff = spawnSync(
  'git',
  ['diff', '--name-only', `${candidateSha}..HEAD`],
  { cwd, encoding: 'utf8' },
);

// ...

const changed = diff.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
```

**Claim:** The freeze check examines only committed candidate-to-HEAD changes and ignores staged, unstaged, and untracked product files.

**Impact:** Local qualification can report no product diff while the tested working tree contains uncommitted product changes not represented by the candidate SHA.

**Recommendation:** Also reject non-allowlisted output from staged and unstaged `git diff` checks and `git status --porcelain`, including untracked files.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- npm publication and production tag creation.
- Permanent upstream architecture for `minimalist-installer`.
- aiDeck UI redesign.
- Pure `.atomic-skills/projects` operational tracking state.
