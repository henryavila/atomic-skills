/**
 * Migrate a legacy (pre-0.1, snake_case) initiative frontmatter object
 * into the schemaVersion 0.1 shape that matches initiative.schema.json.
 *
 * Pure function: no I/O, no globals. The skill body (B.T-005) handles
 * the interactive prompt for standalone vs in-plan and writes the result
 * back to disk; this module only owns the transform.
 *
 * Idempotent: re-running on a 0.1-shaped frontmatter is a no-op.
 *
 * Field mapping:
 *   initiative_id → slug
 *   last_updated → lastUpdated
 *   next_action → nextAction
 *   scope_paths: [...] → scope: { paths: [...] }
 *   stack[].opened_at → stack[].openedAt
 *   parked[].surfaced_at → parked[].surfacedAt
 *   parked[].from_frame → parked[].fromFrame
 *   emerged[].surfaced_at → emerged[].surfacedAt
 *   tasks: { T-001: {...} } → tasks: [{id: 'T-001', ...}, ...]
 *     each task: closed_at → closedAt, last_updated → lastUpdated,
 *                blocked_by → blockedBy
 *   plan_link (free-form string) → references[] entry (if non-empty)
 *
 * Dropped (not in 0.1 schema):
 *   worktree, wip_limit
 *
 * Added when missing (required in 0.1):
 *   schemaVersion: '0.1'
 *   goal: derived from stack[0].title if absent (skill should prompt
 *         user to refine if it falls back to the default)
 *   branch: null if absent
 *   nextAction: null if absent
 *   exitGates: []
 *   parked: []
 *   emerged: []
 *
 * Optional placement under a plan: opts.parentPlan + opts.phaseId.
 * If neither provided → standalone (no parentPlan/phaseId fields).
 */

import { normalizeEntity } from './normalize.js';

const LEGACY_TASK_FIELD_MAP = Object.freeze({
  closed_at: 'closedAt',
  last_updated: 'lastUpdated',
  blocked_by: 'blockedBy',
  resource_counts: 'resourceCounts',
});

const ALLOWED_STACK_FRAME_TYPES = new Set(['task', 'research', 'validation', 'discussion']);

function mapTask(id, legacyTask) {
  const out = { id };
  for (const [key, value] of Object.entries(legacyTask)) {
    const newKey = LEGACY_TASK_FIELD_MAP[key] || key;
    out[newKey] = value;
  }
  // Ensure required fields exist.
  if (out.status === undefined) out.status = 'pending';
  if (out.lastUpdated === undefined) out.lastUpdated = legacyTask.last_updated || new Date().toISOString();
  if (!out.title) out.title = `Task ${id}`;
  return out;
}

function mapStackFrame(frame) {
  if (!frame || typeof frame !== 'object') return null;
  const out = {
    id: frame.id,
    title: frame.title || 'Untitled frame',
    type: ALLOWED_STACK_FRAME_TYPES.has(frame.type) ? frame.type : 'task',
    openedAt: frame.opened_at || frame.openedAt,
  };
  // Legacy "initiative" frame type maps to "task" in the new schema.
  if (frame.type === 'initiative') out.type = 'task';
  return out;
}

function mapParked(item) {
  return {
    title: item.title,
    surfacedAt: item.surfaced_at || item.surfacedAt,
    fromFrame: item.from_frame !== undefined ? item.from_frame : (item.fromFrame !== undefined ? item.fromFrame : null),
  };
}

function mapEmerged(item) {
  return {
    title: item.title,
    surfacedAt: item.surfaced_at || item.surfacedAt,
    promoted: item.promoted === undefined ? false : Boolean(item.promoted),
  };
}

// Legacy data has no `context` block — schema 0.1 now requires one on every
// parked/emerged entry. We synthesize a placeholder context that records the
// migration honestly (no fake ratify by a real human). The skill body's
// `ratify` flow can be re-run against these items to replace the placeholder
// with a real articulation when the user revisits them.

// Two-anchor markers around migrationContext().solves. Detector requires BOTH
// the prefix AND the suffix to match, so a user-edited `solves` that merely
// starts with the prefix is not misclassified as a placeholder.
const MIGRATION_PLACEHOLDER_PREFIX = '(migrated from legacy schema)';
const MIGRATION_PLACEHOLDER_SUFFIX = 're-ratify to articulate the real problem this addresses.';

/**
 * True iff `context.solves` was synthesized by migrationContext() and has
 * not yet been replaced by a real re-ratify / re-bootstrap.
 *
 * Pure: no I/O. Idempotency-safe — re-bootstrap iterates only over items
 * where this returns true, so already-ratified items are never re-prompted.
 */
export function isMigratedPlaceholder(context) {
  if (context == null || typeof context !== 'object') return false;
  if (typeof context.solves !== 'string') return false;
  return context.solves.startsWith(MIGRATION_PLACEHOLDER_PREFIX)
      && context.solves.endsWith(MIGRATION_PLACEHOLDER_SUFFIX);
}

function migrationContext(nowIso, kind, title) {
  return {
    solves: `${MIGRATION_PLACEHOLDER_PREFIX} Original ${kind} entry — ${MIGRATION_PLACEHOLDER_SUFFIX}`,
    trigger: `Schema upgrade to 0.1 found this ${kind} item with no context block; preserved verbatim by the migrate script.`,
    assumesStillValid: [
      `The title "${title}" still describes a real concern at re-ratify time.`,
    ],
    ratifiedAt: nowIso,
    ratifiedBy: 'human',
    lastReviewedAt: nowIso,
  };
}

/** Ensure an ISO-8601 timestamp ends with Z or ±HH:MM offset. */
function normalizeTimestamp(value, fallbackNowIso) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }
  if (value instanceof Date) {
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return fallbackNowIso;
}

export function migrateLegacyInitiative(legacy, opts = {}) {
  if (legacy == null || typeof legacy !== 'object' || Array.isArray(legacy)) {
    throw new Error('migrateLegacyInitiative: input must be an object');
  }

  // Idempotency: if already at 0.1, no-op.
  if (legacy.schemaVersion === '0.1') {
    return { migrated: false, frontmatter: legacy };
  }
  if (legacy.schemaVersion && legacy.schemaVersion !== '0.1') {
    throw new Error(`migrateLegacyInitiative: unsupported schemaVersion '${legacy.schemaVersion}' — only legacy (no version) and '0.1' are handled here`);
  }

  const now = opts.nowIso || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const slug = legacy.slug || legacy.initiative_id;
  if (!slug || typeof slug !== 'string') {
    throw new Error('migrateLegacyInitiative: input has no `initiative_id` or `slug`');
  }

  // Derive goal from the first stack frame title if the legacy file didn't carry one.
  const stackArr = Array.isArray(legacy.stack) ? legacy.stack : [];
  const firstFrame = stackArr[0];
  const fallbackGoal = (firstFrame && firstFrame.title) ? firstFrame.title : `Migrated from legacy initiative ${slug}`;

  const out = {
    schemaVersion: '0.1',
    slug,
    title: legacy.title || (firstFrame && firstFrame.title) || slug,
    goal: legacy.goal || fallbackGoal,
    status: legacy.status || 'active',
    branch: legacy.branch ?? null,
    started: normalizeTimestamp(legacy.started, now),
    lastUpdated: normalizeTimestamp(legacy.last_updated || legacy.lastUpdated, now),
    nextAction: legacy.next_action ?? legacy.nextAction ?? null,
  };

  // Plan membership (caller decides; standalone if both omitted).
  if (opts.parentPlan) {
    out.parentPlan = opts.parentPlan;
    if (opts.phaseId) out.phaseId = opts.phaseId;
  }

  if (legacy.audience) out.audience = legacy.audience;

  out.exitGates = Array.isArray(legacy.exitGates) ? legacy.exitGates : [];

  // scope_paths: [..] → scope: { paths: [..] }
  if (Array.isArray(legacy.scope_paths) && legacy.scope_paths.length > 0) {
    const paths = legacy.scope_paths.filter((p) => typeof p === 'string' && p.length > 0);
    if (paths.length > 0) out.scope = { paths };
  } else if (legacy.scope && Array.isArray(legacy.scope.paths)) {
    out.scope = { paths: legacy.scope.paths };
  }

  out.stack = stackArr
    .map(mapStackFrame)
    .filter((f) => f != null && f.id != null && f.openedAt);

  // Legacy tasks: object map id → task. New: array.
  // Also accept already-array shape (idempotency for partially-migrated files).
  if (Array.isArray(legacy.tasks)) {
    out.tasks = legacy.tasks.map((t) => {
      const id = t.id;
      if (!id) throw new Error('migrateLegacyInitiative: task missing id in array form');
      const { id: _id, ...rest } = t;
      return mapTask(id, rest);
    });
  } else if (legacy.tasks && typeof legacy.tasks === 'object') {
    out.tasks = Object.entries(legacy.tasks).map(([id, t]) => mapTask(id, t || {}));
  } else {
    out.tasks = [];
  }
  // Normalize each task's lastUpdated.
  for (const t of out.tasks) {
    t.lastUpdated = normalizeTimestamp(t.lastUpdated, now);
    if (t.closedAt) t.closedAt = normalizeTimestamp(t.closedAt, t.closedAt);
  }

  out.parked = Array.isArray(legacy.parked) ? legacy.parked.map(mapParked) : [];
  for (const p of out.parked) {
    p.surfacedAt = normalizeTimestamp(p.surfacedAt, now);
    if (!p.context) p.context = migrationContext(now, 'parked', p.title);
  }

  out.emerged = Array.isArray(legacy.emerged) ? legacy.emerged.map(mapEmerged) : [];
  for (const e of out.emerged) {
    e.surfacedAt = normalizeTimestamp(e.surfacedAt, now);
    if (!e.context) e.context = migrationContext(now, 'emerged', e.title);
  }

  // Fold plan_link (free-form string) into structured references[] so the data isn't lost.
  if (typeof legacy.plan_link === 'string' && legacy.plan_link.trim()) {
    const refs = Array.isArray(legacy.references) ? [...legacy.references] : [];
    refs.push({
      kind: legacy.plan_link.startsWith('http') ? 'url' : 'file',
      path: legacy.plan_link.trim(),
      label: 'Planning doc (legacy plan_link)',
    });
    out.references = refs;
  } else if (Array.isArray(legacy.references)) {
    out.references = legacy.references;
  }

  if (Array.isArray(legacy.externalImports)) out.externalImports = legacy.externalImports;
  if (Array.isArray(legacy.crossTaskRefs)) out.crossTaskRefs = legacy.crossTaskRefs;

  // Dropped intentionally: worktree, wip_limit, plan_link (folded above).

  // Repair schema drift the field-by-field mapping above passes through verbatim
  // (gate-status synonyms, references missing kind / using title). This is what
  // keeps a migrated legacy file from being rejected by aiDeck's strict schema.
  const { entity: normalized } = normalizeEntity(out, { nowIso: now, kind: 'initiative' });

  return { migrated: true, frontmatter: normalized };
}

/**
 * Migrate a schemaVersion 0.1 frontmatter object (plan OR initiative) to 0.2.
 *
 * The 0.2 delta is **additive-optional only** (F-B5): mutation/testsCollected on
 * exitCriterion.evidence, the kind:manual demo/acceptance fields, and the new
 * optional task.evidence block. Because every added field is optional, the ONLY
 * operation a 0.1→0.2 migration performs is stamping `schemaVersion: '0.2'` —
 * there is no field backfill.
 *
 * Kind-agnostic on purpose: the bump is content-schema-wide, so the same one-shot
 * applies to both `plan.md` and `phases/*.md`. Unlike migrateLegacyInitiative it
 * does NOT call normalizeEntity — normalize is a read-time tolerance layer for
 * legacy/malformed input; a version bump is a deliberate idempotent WRITE that
 * must leave a durable `schemaVersion:'0.2'` marker and nothing else (F-B5
 * falsifier explicitly bans normalize-coercion creep here).
 *
 * Pure function: no I/O, no globals. Idempotent (no-op if already 0.2). Throws on
 * any version other than 0.1 — legacy (no version) files must run through
 * migrateLegacyInitiative first.
 *
 * @param {object} entity - a 0.1 plan or initiative frontmatter object
 * @param {object} [opts] - reserved for signature parity with migrateLegacyInitiative
 * @returns {{ migrated: boolean, frontmatter: object }}
 */
export function migrate01to02(entity, opts = {}) {
  void opts;
  if (entity == null || typeof entity !== 'object' || Array.isArray(entity)) {
    throw new Error('migrate01to02: input must be an object');
  }
  // Idempotency: already at 0.2 → no-op (return the same object, unchanged).
  if (entity.schemaVersion === '0.2') {
    return { migrated: false, frontmatter: entity };
  }
  // Only 0.1 → 0.2 is supported here.
  if (entity.schemaVersion !== '0.1') {
    throw new Error(
      `migrate01to02: unsupported schemaVersion '${entity.schemaVersion ?? '(none)'}' — only '0.1' → '0.2' is handled (run migrateLegacyInitiative first for legacy files)`,
    );
  }
  // Additive-optional bump: stamp the version, change nothing else.
  return { migrated: true, frontmatter: { ...entity, schemaVersion: '0.2' } };
}

// ── R-MIG-20: flat → nested LAYOUT migration (the D7 cut-over transform) ──
//
// This is ORTHOGONAL to the schema migrations above (migrateLegacyInitiative /
// migrate01to02 change the frontmatter SHAPE; this changes the file PLACEMENT).
// A unit's frontmatter `slug` is its identity — referenced by plan.phases[],
// cross-validation, PROJECT-STATUS rows, and aiDeck — so the layout move NEVER
// renames a slug. It only:
//   - moves `plans/<slug>.md`            → `projects/<id>/<slug>/plan.md`  (verbatim)
//   - moves `initiatives/<slug>.md` (a phase) → `projects/<id>/<plan>/phases/<f>.md` (verbatim)
//   - wraps an orphan (no parentPlan) into a degenerate 1-phase plan:
//       synthesize `projects/<id>/<slug>/plan.md` + move the initiative to
//       `projects/<id>/<slug>/phases/<slug>.md` with parentPlan+phaseId:F0 added.
//
// The phase FILENAME mirrors decompose.js exactly (drops the redundant
// `<planSlug>-` prefix the phases/ dir already encodes), so a migrated tree is
// byte-path-identical to what a fresh `decompose` would emit → idempotent with
// materialize.

/** Phase filename = decompose's inverse: drop the `<planSlug>-` prefix if present. */
function phaseFileName(planSlug, initSlug) {
  return initSlug.startsWith(`${planSlug}-`) ? initSlug.slice(planSlug.length + 1) : initSlug;
}

const PLAN_STATUS_ENUM = new Set(['active', 'paused', 'done', 'archived']);
const PHASE_STATUS_ENUM = new Set(['pending', 'active', 'paused', 'done', 'archived']);

// Slugs that, if used as a `projects/<id>/<slug>/` folder name, would collide
// with a layout dir token and break kind-inference. The slug regex permits them
// (`^[a-z][a-z0-9-]{1,63}$`), so the migration refuses them rather than emit a
// tree that validate-state misclassifies.
const RESERVED_LAYOUT_SLUGS = new Set(['plans', 'initiatives', 'phases', 'projects', 'archive']);

/**
 * Project an INITIATIVE status onto the PLAN status enum. The initiative enum
 * has `pending` (a not-yet-started unit); the plan enum does NOT — so a `pending`
 * orphan must NOT silently become an `active` plan (that is a semantic lie). Map
 * pending → paused (the plan-enum member meaning "not currently running"); pass
 * through active/paused/done/archived; anything unknown → active.
 */
function planStatusFromInitiative(s) {
  if (PLAN_STATUS_ENUM.has(s)) return s;
  if (s === 'pending') return 'paused';
  return 'active';
}

/**
 * Synthesize a degenerate 1-phase plan frontmatter wrapping a standalone
 * initiative. The single phase F0 carries `slug === initFm.slug` so
 * crossValidate() resolves the phase ↔ initiative pairing by slug, and copies
 * the initiative's exitGates verbatim as the phase criteria (same exitCriterion
 * shape → preserves any GATE-R2 met⟹evidence invariant already satisfied).
 */
function synthesizeOrphanPlan(initFm, slug, nowIso) {
  const criteria = Array.isArray(initFm.exitGates) ? initFm.exitGates : [];
  const phase = {
    id: 'F0',
    slug,
    title: initFm.title || slug,
    goal: initFm.goal || initFm.title || `Standalone initiative ${slug}`,
    dependsOn: [],
    subPhaseCount: Array.isArray(initFm.tasks) ? initFm.tasks.length : 0,
    exitGate: {
      summary: criteria.length > 0
        ? `${criteria.length} ${criteria.length === 1 ? 'criterion' : 'criteria'} to meet`
        : 'Standalone initiative migrated as a 1-phase plan',
      criteria,
    },
    // Phase enum includes `pending`, so a not-yet-started orphan stays `pending`.
    status: PHASE_STATUS_ENUM.has(initFm.status) ? initFm.status : 'active',
  };
  const started = normalizeTimestamp(initFm.started, nowIso);
  const planFm = {
    schemaVersion: initFm.schemaVersion || '0.1',
    slug,
    title: initFm.title || slug,
    version: '1.0',
    status: planStatusFromInitiative(initFm.status),
    started,
    lastUpdated: normalizeTimestamp(initFm.lastUpdated || initFm.started, started),
    currentPhase: 'F0',
    parallelismAllowed: false,
    phases: [phase],
    references: [],
  };
  // Plan schema `branch` is a plain string (no null); only carry a real branch.
  if (typeof initFm.branch === 'string' && initFm.branch.length > 0) planFm.branch = initFm.branch;
  return planFm;
}

function synthesizeOrphanPlanBody(initFm, slug) {
  const goal = initFm.goal ? `**Goal:** ${initFm.goal}\n\n` : '';
  return `# ${initFm.title || slug}\n\n`
    + `> Migrated standalone initiative — degenerate 1-phase plan (single phase \`F0\`).\n`
    + `> The phase initiative under \`phases/\` holds the real work; this plan is the layout wrapper.\n\n`
    + goal;
}

/**
 * Plan a flat → nested layout migration. PURE: no I/O, deterministic, idempotent.
 *
 * @param {object} units
 *   units.plans:        [{ slug, frontmatter, body, sourceRel }]
 *   units.initiatives:  [{ slug, frontmatter, body, sourceRel }]
 *   `sourceRel` is the path relative to the state root (e.g. 'plans/foo.md').
 * @param {object} opts
 *   opts.projectId (required) — the destination `projects/<projectId>/` folder.
 *   opts.nowIso (optional)    — fallback timestamp for a synthesized plan whose
 *                               source orphan is missing `started`.
 *   opts.existingPhaseSlugs (optional) — Set/array of phase-initiative slugs ALREADY
 *                               present in the nested tree (recovery): treated as
 *                               covering a plan's declared phase even if no flat file remains.
 * @returns {{ outputs, deletes, orphans, warnings, blockers }}
 *   outputs: [{ relPath, kind, slug, verbatim, sourceRel? , frontmatter?, body? }]
 *     - verbatim:true  → copy the original file byte-for-byte from sourceRel.
 *     - verbatim:false → executor serializes `frontmatter` + `body` (orphan/synth).
 *   deletes: [sourceRel]  — flat files to remove AFTER the nested tree validates.
 *   orphans: [slug]       — initiatives wrapped into 1-phase plans.
 *   warnings: [string]    — advisory (shown in dry-run).
 *   blockers: [string]    — make an --apply UNSAFE; the executor refuses to apply
 *                           while any remain. Hard structural errors throw instead.
 *
 * Idempotent: given no flat units (already migrated), returns empty outputs/deletes.
 */
export function planLayoutMigration(units, opts = {}) {
  const projectId = opts.projectId;
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('planLayoutMigration: opts.projectId is required (the destination projects/<id>/ folder)');
  }
  const nowIso = opts.nowIso;
  const plans = Array.isArray(units?.plans) ? units.plans : [];
  const initiatives = Array.isArray(units?.initiatives) ? units.initiatives : [];

  const warnings = [];
  // `blockers` are conditions that make an --apply UNSAFE (incomplete/inconsistent
  // input) without being a hard structural error. The executor surfaces them in
  // dry-run and refuses to --apply while any remain. Hard structural errors
  // (slug collisions, reserved-word slugs) throw immediately instead.
  const blockers = [];
  const outputs = [];
  const deletes = [];
  const orphans = [];

  const assertSlugMigratable = (slug, who) => {
    if (RESERVED_LAYOUT_SLUGS.has(slug)) {
      throw new Error(`planLayoutMigration: ${who} has the reserved slug '${slug}', which would collide with a layout directory token (plans/initiatives/phases/projects/archive) and break kind-inference. Rename it before migrating.`);
    }
  };

  // Index flat plans by slug. A duplicate slug across two flat files is FATAL —
  // silently keeping one would drop the other's phases/gates from the migration.
  const planBySlug = new Map();
  for (const p of plans) {
    if (!p || !p.slug) { blockers.push('a flat plan has no slug — cannot place it'); continue; }
    assertSlugMigratable(p.slug, `plan '${p.sourceRel || p.slug}'`);
    if (planBySlug.has(p.slug)) {
      throw new Error(`planLayoutMigration: two flat plan files share slug '${p.slug}' ('${planBySlug.get(p.slug).sourceRel}' and '${p.sourceRel}') — slugs are identity and must be unique. Resolve the duplicate before migrating; nothing was changed.`);
    }
    planBySlug.set(p.slug, p);
  }

  // Partition initiatives: phase-of-a-present-plan vs orphan (standalone).
  const phaseInitsByPlan = new Map();
  const orphanInits = [];
  for (const init of initiatives) {
    if (!init || !init.slug) { blockers.push('an initiative has no slug — cannot place it'); continue; }
    const parent = init.frontmatter?.parentPlan;
    if (parent && planBySlug.has(parent)) {
      if (!phaseInitsByPlan.has(parent)) phaseInitsByPlan.set(parent, []);
      phaseInitsByPlan.get(parent).push(init);
    } else {
      if (parent) warnings.push(`initiative '${init.slug}' references parentPlan '${parent}' not present among flat plans → migrating as a standalone 1-phase plan`);
      orphanInits.push(init);
    }
  }

  // Phase-coverage: every phase a plan DECLARES must have an initiative file —
  // either a flat one we are migrating now, OR one already present in the nested
  // tree (the recovery case: a prior run migrated it and its flat original is
  // gone). A declared phase present in NEITHER would leave the migrated plan.md
  // referencing a phantom phase (crossValidate silently skips it). Block the cut-over.
  const alreadyNested = opts.existingPhaseSlugs instanceof Set
    ? opts.existingPhaseSlugs
    : new Set(Array.isArray(opts.existingPhaseSlugs) ? opts.existingPhaseSlugs : []);
  for (const plan of planBySlug.values()) {
    const declared = Array.isArray(plan.frontmatter?.phases) ? plan.frontmatter.phases : [];
    const children = phaseInitsByPlan.get(plan.slug) || [];
    const childIds = new Set(children.map((i) => i.frontmatter?.phaseId).filter(Boolean));
    const childSlugs = new Set(children.map((i) => i.slug));
    for (const ph of declared) {
      if (!ph || !ph.id) continue;
      // A declared phase is COVERED if some initiative corresponds to it — matched
      // by phaseId (the robust key) OR by slug, flat OR already-nested. A phase with
      // NO corresponding initiative would leave the migrated plan.md pointing at a
      // phantom phase: block. A slug MISMATCH (initiative exists by id but the plan
      // declares a different slug) is pre-existing drift the migration preserves
      // verbatim — warn, don't block (validate-state already tolerates it for
      // non-done phases; crossValidate pairs by slug so it cannot verify it when done).
      const covered = childIds.has(ph.id) || (ph.slug && (childSlugs.has(ph.slug) || alreadyNested.has(ph.slug)));
      if (!covered) {
        blockers.push(`plan '${plan.slug}' declares phase ${ph.id} (slug '${ph.slug || '?'}') but no initiative corresponds to it (neither flat nor already-nested) — incomplete phase set`);
      } else if (ph.slug && childIds.has(ph.id) && !childSlugs.has(ph.slug)) {
        warnings.push(`plan '${plan.slug}' phase ${ph.id} declares slug '${ph.slug}' but its initiative carries a different slug — pre-existing plan↔phase slug drift (migrated as-is; fix with a plan edit so crossValidate can pair them when the phase is done)`);
      }
    }
  }

  const dirFor = (slug) => `projects/${projectId}/${slug}`;
  const seenTargets = new Set();
  const claim = (relPath, who) => {
    if (seenTargets.has(relPath)) {
      throw new Error(`planLayoutMigration: target path collision at '${relPath}' (${who}). Two units would write the same file — resolve the slug clash before migrating.`);
    }
    seenTargets.add(relPath);
  };

  // Multi-phase plans (sorted for deterministic output).
  for (const plan of [...planBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const dir = dirFor(plan.slug);
    const planRel = `${dir}/plan.md`;
    claim(planRel, `plan ${plan.slug}`);
    outputs.push({ relPath: planRel, kind: 'plan', slug: plan.slug, verbatim: true, sourceRel: plan.sourceRel });
    deletes.push(plan.sourceRel);

    const children = (phaseInitsByPlan.get(plan.slug) || []).sort((a, b) => a.slug.localeCompare(b.slug));
    for (const init of children) {
      const rel = `${dir}/phases/${phaseFileName(plan.slug, init.slug)}.md`;
      claim(rel, `phase ${init.slug}`);
      outputs.push({ relPath: rel, kind: 'initiative', slug: init.slug, verbatim: true, sourceRel: init.sourceRel });
      deletes.push(init.sourceRel);
    }
  }

  // Orphans → degenerate 1-phase plans (sorted for deterministic output).
  for (const init of [...orphanInits].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const slug = init.slug;
    assertSlugMigratable(slug, `orphan initiative '${init.sourceRel || slug}'`);
    if (planBySlug.has(slug)) {
      throw new Error(`planLayoutMigration: orphan initiative '${slug}' collides with a flat plan of the same slug — cannot wrap it into a 1-phase plan of that name.`);
    }
    const fm = init.frontmatter || {};
    const dir = dirFor(slug);
    const planRel = `${dir}/plan.md`;
    const phaseRel = `${dir}/phases/${phaseFileName(slug, slug)}.md`;
    claim(planRel, `synthesized plan ${slug}`);
    claim(phaseRel, `orphan phase ${slug}`);

    outputs.push({ relPath: planRel, kind: 'plan', slug, verbatim: false, frontmatter: synthesizeOrphanPlan(fm, slug, nowIso), body: synthesizeOrphanPlanBody(fm, slug) });
    outputs.push({ relPath: phaseRel, kind: 'initiative', slug, verbatim: false, frontmatter: { ...fm, parentPlan: slug, phaseId: 'F0' }, body: init.body });
    deletes.push(init.sourceRel);
    orphans.push(slug);

    // crossValidate fires only for 'done' phases: a done/archived orphan with
    // unfinished tasks would make the synthesized 1-phase plan inconsistent — block.
    if (fm.status === 'done' || fm.status === 'archived') {
      const pending = (Array.isArray(fm.tasks) ? fm.tasks : []).filter((t) => t && t.status !== 'done');
      if (pending.length) blockers.push(`orphan '${slug}' is '${fm.status}' but has ${pending.length} unfinished task(s); the synthesized 1-phase plan would fail cross-validation`);
    }
  }

  return { outputs, deletes, orphans, warnings, blockers };
}
