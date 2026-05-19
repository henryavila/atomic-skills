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
  }

  out.emerged = Array.isArray(legacy.emerged) ? legacy.emerged.map(mapEmerged) : [];
  for (const e of out.emerged) {
    e.surfacedAt = normalizeTimestamp(e.surfacedAt, now);
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

  return { migrated: true, frontmatter: out };
}
