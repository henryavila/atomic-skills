# Integrity Remediation

## Context

The July 2026 audits demonstrated that the current release can lose user data,
misclassify project completion, accept contradictory project state, and emit
Gemini artifacts that the target CLI cannot consume. The remediation therefore
has one ordering rule: preserve data first, restore lifecycle truth second,
restore host contracts third, and repair portability/status drift last.

verified_by: `docs/audits/installer-audit-2026-07-10.md`,
`docs/audits/project-implement-audit-2026-07-10.md`, and the fresh reproductions
recorded in the 2026-07-10 audit session.

The design was ratified by the user after a gate-mode panel with independent
architecture, quality, and contrarian perspectives. The panel agreed that
generic filesystem and journal guarantees belong upstream while product-specific
runtime coordination remains in `atomic-skills`.

verified_by: explicit user approval in the 2026-07-10 planning session.

## Evidence from the current implementation

The file reconciler validates only lexical containment and writes greenfield
targets without checking for pre-existing unowned content:

```js
const resolveWithinBase = (basePath, path) => {
  const base = resolve(basePath);
  const absPath = join(basePath, path);
  const resolved = resolve(absPath);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error(`Refusing to operate outside basePath: "${path}"`);
  }
  return absPath;
};

const prevHash = prevHashByPath.get(path);
if (prevHash !== undefined && existsSync(absPath)) {
  // conflict handling exists only when a previous installed hash exists
}
writeFileSync(absPath, content, 'utf8');
```

verified_by: `node_modules/@henryavila/minimalist-installer/src/kernel/reconciler.js:18-25,73-92`.

The driver matches prior effects by type and occurrence order, discards prior
effects missing from the new plan, and writes one final manifest after effects
have already mutated the filesystem:

```js
// Prior entries are matched to new ones by (type, occurrence order)
const occurrence = cursor.get(type) ?? 0;
const previous = priorByType.get(type)?.[occurrence];
const beforeState = effect.apply(applyArgs);
manifest = recordEffect(manifest, { type, beforeState });
writeManifest(projectDir, manifest, manifestDir);
```

verified_by: `node_modules/@henryavila/minimalist-installer/src/driver.js:27-58`.

Manifest and registry persistence are direct read-modify-write operations with
no lock or atomic rename:

```js
const raw = readFileSync(filePath, 'utf8');
return JSON.parse(raw);
writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const v = JSON.parse(readFileSync(p, 'utf8'));
if (!list.includes(basePath)) list.push(basePath);
writeFileSync(p, JSON.stringify(list, null, 2) + '\n');
```

verified_by: `node_modules/@henryavila/minimalist-installer/src/manifest.js:19-32`
and `src/install.js:149-155`.

The runtime effect records ownership as paths only and unconditionally replaces
or removes a priorly-owned target:

```js
const priorlyOwned = new Set(previous?.created ?? []);
const ownsTarget = !existedBefore || priorlyOwned.has(item.path) || matchesDesiredFile;
writeFileSync(absPath, item.content);
if (ownsTarget) created.push(item.path);

for (const relPath of [...created].reverse()) {
  unlinkSync(absPath);
}
```

verified_by: `src/runtime-layers/effects/stage-runtime-artifacts.js:41-92`.

The phase transition collapses every zero-eligible state into plan completion,
while cross-validation skips a missing initiative:

```js
export function proposeAdvance(plan, completedPhaseId) {
  const eligible = nextEligiblePhases(plan, completedPhaseId);
  if (eligible.length === 0) return { kind: 'plan-done', eligible: [] };
}

const init = (projectId ? initBySlug.get(`${projectId}/${phase.slug}`) : null)
  ?? initBySlug.get(phase.slug);
if (!init) continue;
```

verified_by: `src/transition.js:127-129` and `scripts/validate-state.js:581-583`.

Gemini native skills are nested below the CLI discovery depth, the dual-host
selection rewrites Gemini to the commands profile, and TOML is assembled by raw
string interpolation:

```js
filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md')

if (unique.includes('gemini') && unique.includes('codex')) {
  result[result.indexOf('gemini')] = 'gemini-commands';
}

return `description = "${escaped}"\nprompt = """\n${body}\n"""\n`;
```

verified_by: `src/config.js:20-31,80-90`, `src/render.js:112-115`, and fresh
Gemini CLI 0.50.0 discovery/TOML parse runs from the 2026-07-10 audit session.

Windows path classification splits resolved paths on a POSIX-only separator,
and the dashboard skill derives a project id from the worktree basename instead
of the canonical project folder.

verified_by: `scripts/validate-state.js:122-154`, `src/normalize.js:205-214`,
`skills/shared/project-assets/project-view.md:69-71`, and `src/serve.js:246-257`.

## Decisions

1. Generic filesystem safety, ownership, journaling, locking, and recovery will
   be fixed in `@henryavila/minimalist-installer`. `atomic-skills` will retain
   product-specific registry, runtime-layer, legacy-cleanup, and host policies.
   verified_by: user-ratified panel synthesis, 2026-07-10.

2. A versioned journal v2 will replace ordinal identity with stable effect IDs
   and record the lexical path, verified real path, previous hash, installed
   hash, ownership disposition, transaction ID, and transaction state.
   verified_by: user-ratified panel synthesis, 2026-07-10.

3. The first recovery release will fail closed on incomplete transactions and
   expose a deterministic inspect/rollback path. Automatic recovery will become
   eligible only after fault-injection tests prove byte-preserving idempotence
   at every persistence boundary.
   verified_by: preserved Flynn dissent accepted in the user-ratified synthesis.

4. Journal v1 migration will preserve ambiguous artifacts as `unmanaged`.
   Neither update nor uninstall will overwrite or delete content without
   ownership proof.
   verified_by: user-ratified panel synthesis, 2026-07-10.

5. `validate-state` will become the single structural authority for project
   identity, unique IDs, DAG validity, status invariants, gate terminality, and
   review provenance. Lifecycle commands will consume that authority instead of
   maintaining permissive parallel interpretations.
   verified_by: user-ratified panel synthesis, 2026-07-10.

6. `phase-done` will have a pure preflight and a final commit guard. The commit
   guard will re-read state and reject stale or contradictory transitions before
   any terminal status or archive move is written.
   verified_by: user-ratified panel synthesis, 2026-07-10.

7. Gemini native skills will be the canonical Gemini contract. Commands will be
   optional adapters generated from the same intermediate representation and
   enabled only after TOML parsing, argument substitution, discovery, and
   invocation pass against the supported CLI.
   verified_by: user-ratified panel synthesis, 2026-07-10.

8. Delivery will use four ordered waves: installer data safety, lifecycle truth,
   Gemini host correctness, then Windows/dashboard portability. Every wave will
   add a red reproduction before changing behavior and a release-blocking
   contract test after the fix.
   verified_by: user-ratified panel synthesis, 2026-07-10.

## Chosen approach

Three approaches were weighed:

- A permanent `atomic-skills` fork of the installer would isolate delivery but
  duplicate a generic safety contract and create long-term divergence.
  verified_by: Aria and Flynn panel positions.
- A full write-ahead-log and automatic recovery engine in the first release
  would maximize recovery ambition but expand the initial trusted computing
  surface before the safety invariants are proven.
  verified_by: Flynn's preserved contrarian objection.
- The selected approach is an upstream, versioned safety core delivered in
  reversible slices: real-path confinement and conflict refusal; atomic
  persistence and locks; stable effect identity and conservative migration;
  deterministic incomplete-transaction handling; then proven automatic
  recovery. Consumer policy changes land alongside the upstream version that
  provides each required primitive.
  verified_by: user-ratified orchestrator synthesis, 2026-07-10.

Lifecycle and distribution follow the same pattern: establish one mechanical
authority, convert current bugs into adversarial contract fixtures, change the
implementation, and exercise the public CLI behavior in isolated environments.

verified_by: Tariq's quality position and the user-ratified synthesis.

## Blast radius

Journal identity and ownership semantics are one-way-door changes because an
incorrect migration can delete or strand user content. Containment consists of
versioned manifests, preserved v1 data until a successful v2 commit, conservative
`unmanaged` classification, per-root locks, and byte-for-byte recovery fixtures.

verified_by: current journal implementation at
`node_modules/@henryavila/minimalist-installer/src/driver.js:27-58` and the
user-ratified migration decision.

Stricter lifecycle validation can reject state files previously accepted by the
validator. Containment consists of a diagnostic migration command, explicit
error codes, fixtures for every legacy shape, and no silent coercion of
contradictory terminal state.

verified_by: permissive skip at `scripts/validate-state.js:581-583` and explicit
legacy-tolerance tests at `tests/validate-state.test.js:582-592,1105-1107`.

Flattening Gemini native installation changes generated paths. Containment
consists of install/uninstall parity fixtures for both old and new locations,
legacy pruning inside the journal, and live CLI discovery before the new layout
is advertised.

verified_by: current layout at `src/config.js:20-31` and install/uninstall parity
requirement in `tests/install-uninstall-roundtrip.test.js`.

## Non-goals

- This effort will not create a permanent installer fork unless upstream
  publication is unavailable after the upstream patch is complete.
  verified_by: user-ratified contingency.
- This effort will not introduce a general database, distributed transaction
  protocol, or background recovery daemon.
  verified_by: preserved contrarian boundary.
- This effort will not infer ownership for legacy artifacts from path alone.
  verified_by: user-ratified migration decision.
- This effort will not add unrelated product features or redesign the aiDeck UI.
  verified_by: scope of the 2026-07-10 audits.
- This effort will not claim host support from generated-file snapshots alone;
  supported hosts require observable CLI contract tests.
  verified_by: user-ratified quality gate.

## Open questions

- The publication mechanism and release window for the upstream installer need
  confirmation when its patch is ready. Until then, the plan will use a pinned
  workspace dependency for integration tests.
  unverified: upstream registry publication timing is external state.
- The exact journal v2 on-disk field names will be frozen only after the fault
  matrix proves the minimum recovery data.
  unverified: the implementation spike has not yet measured the minimal record.
- The oldest lifecycle schema version that can be migrated without manual input
  will be established from the complete fixture corpus.
  unverified: legacy corpus classification has not yet run.

## Rejected alternatives

### Permanent consumer fork

Rejected because generic safety behavior would diverge between consumers and
future upstream releases. A temporary fork remains a time-boxed publication
contingency, not the target architecture.

verified_by: Aria and Flynn panel positions plus user ratification.

### Big-bang transactional rewrite

Rejected because it combines path safety, journal migration, registry recovery,
and automatic healing before the individual properties have independent red/green
fixtures. The selected slices preserve a fail-closed boundary after each merge.

verified_by: Flynn dissent and Tariq's property-gate requirement.

### Commands-first Gemini support

Rejected because it makes the more fragile serialization surface canonical and
retains duplicated semantics. Native skills remain canonical; commands return
only as verified adapters.

verified_by: Aria and Flynn panel positions and current failures at
`src/render.js:112-115`.

### Compatibility through silent tolerance

Rejected because current false-green validator behavior can mark contradictory
state valid. Legacy compatibility will be explicit diagnosis and migration.

verified_by: `scripts/validate-state.js:581-583` and
`tests/validate-state.test.js:582-592`.

## Self-review against code-quality gates

- G1 read-before-claim: applied — 10 claims about existing code carry pasted
  excerpts and exact file/line references.
- G2 soft-language: applied — scanned for the ban list; 0 occurrences remain.
- G6 reference-or-strike: applied — every decision and implementation claim
  carries `verified_by:` or `unverified:`; three open questions remain explicitly
  unverified.
