/**
 * state-invariants.js — pure authority for project↔plan↔phase identity join,
 * terminal status, and unique IDs (integrity-remediation F4/T-001).
 *
 * Lifecycle validators and migration diagnose through these helpers instead of
 * maintaining permissive parallel interpretations. No I/O.
 *
 * Join rule: projectId + plan slug + phase (slug/id), never bare phase slug alone.
 * Lazy exception: descriptor-only pending + subPhaseCount 0 + source sidecar may
 * omit an initiative file.
 */

/** @typedef {{ code: string, message: string, planSlug?: string, phaseId?: string, initiativeSlug?: string, projectId?: string, [k: string]: unknown }} IntegrityError */

export const STATE_INTEGRITY_CODES = Object.freeze({
  MISSING_INITIATIVE: 'missing-initiative',
  IDENTITY_MISMATCH: 'identity-mismatch',
  SLUG_COLLISION: 'slug-collision',
  DUPLICATE_PHASE_ID: 'duplicate-phase-id',
  DUPLICATE_PHASE_SLUG: 'duplicate-phase-slug',
  DUPLICATE_TASK_ID: 'duplicate-task-id',
  DUPLICATE_GATE_ID: 'duplicate-gate-id',
  TERMINAL_PENDING_GATE: 'terminal-pending-gate',
  MISSING_SIDECAR: 'missing-sidecar',
});

const REQUIRES_INITIATIVE = new Set(['active', 'paused', 'done', 'archived']);
const TERMINAL_PHASE = new Set(['done', 'archived']);

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const hasText = (v) => typeof v === 'string' && v.length > 0;

export function projectScopeId(fm) {
  return (typeof fm?.__projectId === 'string' && fm.__projectId.length > 0)
    ? fm.__projectId
    : '__legacy';
}

/**
 * Sidecar key used by collectStateIntegrityErrors options.sidecars.
 * @param {string} projectId
 * @param {string} planSlug
 * @param {string} phaseSlug
 */
export function sidecarKey(projectId, planSlug, phaseSlug) {
  return `${projectId}/${planSlug}/${phaseSlug}`;
}

/**
 * Valid lazy descriptor-only phase: pending, unknown task count (0), sidecar present.
 * @param {object} phase
 * @param {{ hasSidecar?: boolean }} [opts]
 */
export function isValidLazyDescriptor(phase, opts = {}) {
  if (!isObject(phase)) return false;
  if (phase.status !== 'pending') return false;
  if (phase.subPhaseCount !== 0) return false;
  return opts.hasSidecar === true;
}

/**
 * Format a structured integrity error for CLI / crossValidate string lists.
 * @param {{ code: string, message: string }} err
 */
export function formatIntegrityError(err) {
  const code = err?.code ?? 'integrity-error';
  const message = err?.message ?? String(err);
  return `[${code}] ${message}`;
}

function initiativeProjectId(init, mapKey) {
  if (typeof init?.__projectId === 'string' && init.__projectId.length > 0) {
    return init.__projectId;
  }
  if (hasText(mapKey) && mapKey.includes('/')) {
    return mapKey.slice(0, mapKey.indexOf('/'));
  }
  return '__legacy';
}

/**
 * List initiative entries that could match a phase slug, with project scope.
 * @returns {Array<{ key: string, initiative: object, projectId: string }>}
 */
function candidatesForPhaseSlug(phaseSlug, initiativeFrontmatters) {
  if (!hasText(phaseSlug) || !(initiativeFrontmatters instanceof Map)) return [];
  const out = [];
  for (const [key, initiative] of initiativeFrontmatters) {
    if (!isObject(initiative)) continue;
    const slug = hasText(initiative.slug) ? initiative.slug : (
      hasText(key) && key.includes('/') ? key.slice(key.indexOf('/') + 1) : key
    );
    if (slug !== phaseSlug) continue;
    out.push({
      key,
      initiative,
      projectId: initiativeProjectId(initiative, key),
    });
  }
  return out;
}

/**
 * Resolve the initiative for a plan phase via projectId+plan+phase identity.
 *
 * @returns {{
 *   kind: 'matched'|'missing'|'identity-mismatch'|'slug-collision',
 *   initiative?: object,
 *   code?: string,
 *   message?: string,
 *   mismatches?: string[],
 * }}
 */
export function resolvePhaseInitiative(plan, phase, initiativeFrontmatters) {
  if (!isObject(plan) || !isObject(phase) || !hasText(phase.slug)) {
    return { kind: 'missing', code: STATE_INTEGRITY_CODES.MISSING_INITIATIVE, message: 'phase has no slug' };
  }
  const projectId = projectScopeId(plan);
  const phaseSlug = phase.slug;
  const candidates = candidatesForPhaseSlug(phaseSlug, initiativeFrontmatters);

  const sameProject = candidates.filter((c) => c.projectId === projectId);
  const foreign = candidates.filter((c) => c.projectId !== projectId);

  // Prefer exact map key projectId/phaseSlug when present.
  const exactKey = `${projectId}/${phaseSlug}`;
  const exact = sameProject.find((c) => c.key === exactKey) ?? sameProject[0];

  if (!exact) {
    if (foreign.length > 0) {
      return {
        kind: 'slug-collision',
        code: STATE_INTEGRITY_CODES.SLUG_COLLISION,
        message: `phase slug '${phaseSlug}' matches initiative(s) only under other projectId(s): ${foreign.map((f) => f.projectId).join(', ')} — join requires projectId+plan+phase, not bare slug`,
      };
    }
    return {
      kind: 'missing',
      code: STATE_INTEGRITY_CODES.MISSING_INITIATIVE,
      message: `no initiative for phase ${phase.id ?? '?'} (slug '${phaseSlug}') under project '${projectId}'`,
    };
  }

  if (sameProject.length > 1) {
    // Multiple same-project entries for one slug (duplicate map keys shouldn't happen;
    // different keys with same slug object are a collision).
    const keys = sameProject.map((c) => c.key);
    if (new Set(keys).size > 1) {
      return {
        kind: 'slug-collision',
        code: STATE_INTEGRITY_CODES.SLUG_COLLISION,
        message: `phase slug '${phaseSlug}' is ambiguous under project '${projectId}' (keys: ${keys.join(', ')})`,
      };
    }
  }

  const init = exact.initiative;
  const mismatches = [];
  if (hasText(init.parentPlan) && hasText(plan.slug) && init.parentPlan !== plan.slug) {
    mismatches.push(`parentPlan='${init.parentPlan}' (expected '${plan.slug}')`);
  }
  if (hasText(init.phaseId) && hasText(phase.id) && init.phaseId !== phase.id) {
    mismatches.push(`phaseId='${init.phaseId}' (expected '${phase.id}')`);
  }
  if (hasText(init.slug) && init.slug !== phaseSlug) {
    mismatches.push(`slug='${init.slug}' (expected '${phaseSlug}')`);
  }

  if (mismatches.length > 0) {
    return {
      kind: 'identity-mismatch',
      code: STATE_INTEGRITY_CODES.IDENTITY_MISMATCH,
      initiative: init,
      mismatches,
      message: `initiative '${init.slug ?? phaseSlug}' identity mismatch for plan '${plan.slug}' phase ${phase.id ?? '?'}: ${mismatches.join('; ')}`,
    };
  }

  return { kind: 'matched', initiative: init };
}

function findDuplicateIds(items, idOf) {
  const seen = new Map();
  const dups = new Set();
  for (const item of items) {
    const id = idOf(item);
    if (!hasText(id)) continue;
    if (seen.has(id)) dups.add(id);
    else seen.set(id, true);
  }
  return [...dups];
}

/**
 * Unique-ID checks for one plan and/or one initiative.
 * @param {{ plan?: object, initiative?: object }} args
 * @returns {IntegrityError[]}
 */
export function checkUniqueIds({ plan, initiative } = {}) {
  /** @type {IntegrityError[]} */
  const errors = [];
  if (isObject(plan)) {
    const phases = Array.isArray(plan.phases) ? plan.phases : [];
    for (const id of findDuplicateIds(phases, (p) => p?.id)) {
      errors.push({
        code: STATE_INTEGRITY_CODES.DUPLICATE_PHASE_ID,
        message: `plan '${plan.slug ?? '?'}' has duplicate phase id '${id}'`,
        planSlug: plan.slug,
        phaseId: id,
        projectId: projectScopeId(plan),
      });
    }
    for (const slug of findDuplicateIds(phases, (p) => p?.slug)) {
      errors.push({
        code: STATE_INTEGRITY_CODES.DUPLICATE_PHASE_SLUG,
        message: `plan '${plan.slug ?? '?'}' has duplicate phase slug '${slug}'`,
        planSlug: plan.slug,
        initiativeSlug: slug,
        projectId: projectScopeId(plan),
      });
    }
    for (const phase of phases) {
      const criteria = Array.isArray(phase?.exitGate?.criteria) ? phase.exitGate.criteria : [];
      for (const gid of findDuplicateIds(criteria, (c) => c?.id)) {
        errors.push({
          code: STATE_INTEGRITY_CODES.DUPLICATE_GATE_ID,
          message: `plan '${plan.slug ?? '?'}' phase ${phase?.id ?? '?'} has duplicate gate id '${gid}'`,
          planSlug: plan.slug,
          phaseId: phase?.id,
          projectId: projectScopeId(plan),
        });
      }
    }
  }
  if (isObject(initiative)) {
    const tasks = Array.isArray(initiative.tasks) ? initiative.tasks : [];
    for (const tid of findDuplicateIds(tasks, (t) => t?.id)) {
      errors.push({
        code: STATE_INTEGRITY_CODES.DUPLICATE_TASK_ID,
        message: `initiative '${initiative.slug ?? '?'}' has duplicate task id '${tid}'`,
        initiativeSlug: initiative.slug,
        phaseId: initiative.phaseId,
        projectId: projectScopeId(initiative),
      });
    }
    const gates = Array.isArray(initiative.exitGates) ? initiative.exitGates : [];
    for (const gid of findDuplicateIds(gates, (g) => g?.id)) {
      errors.push({
        code: STATE_INTEGRITY_CODES.DUPLICATE_GATE_ID,
        message: `initiative '${initiative.slug ?? '?'}' has duplicate gate id '${gid}'`,
        initiativeSlug: initiative.slug,
        phaseId: initiative.phaseId,
        projectId: projectScopeId(initiative),
      });
    }
  }
  return errors;
}

/**
 * Terminal phase must not carry pending exit-gate criteria (plan surface).
 * When initiative is provided, its exitGates are co-checked.
 * @param {object} phase
 * @param {object} [initiative]
 * @returns {IntegrityError[]}
 */
export function checkTerminalGates(phase, initiative) {
  /** @type {IntegrityError[]} */
  const errors = [];
  if (!isObject(phase) || !TERMINAL_PHASE.has(phase.status)) return errors;

  const pendingPlan = (Array.isArray(phase.exitGate?.criteria) ? phase.exitGate.criteria : [])
    .filter((c) => c?.status === 'pending');
  if (pendingPlan.length > 0) {
    errors.push({
      code: STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE,
      message: `phase ${phase.id ?? '?'} is '${phase.status}' but has pending gate(s): ${pendingPlan.map((c) => c.id ?? '?').join(', ')}`,
      phaseId: phase.id,
      initiativeSlug: phase.slug,
    });
  }

  if (isObject(initiative)) {
    const pendingInit = (Array.isArray(initiative.exitGates) ? initiative.exitGates : [])
      .filter((g) => g?.status === 'pending');
    if (pendingInit.length > 0) {
      errors.push({
        code: STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE,
        message: `phase ${phase.id ?? '?'} is '${phase.status}' but initiative '${initiative.slug ?? '?'}' has pending exitGate(s): ${pendingInit.map((g) => g.id ?? '?').join(', ')}`,
        phaseId: phase.id,
        initiativeSlug: initiative.slug,
      });
    }
  }
  return errors;
}

/**
 * Collect all identity / uniqueness / terminality integrity errors.
 *
 * @param {Map<string, object>} planFrontmatters
 * @param {Map<string, object>} initiativeFrontmatters
 * @param {{ sidecars?: Set<string> }} [options]
 *   sidecars keys from sidecarKey(projectId, planSlug, phaseSlug)
 * @returns {IntegrityError[]}
 */
export function collectStateIntegrityErrors(planFrontmatters, initiativeFrontmatters, options = {}) {
  /** @type {IntegrityError[]} */
  const errors = [];
  if (!(planFrontmatters instanceof Map)) return errors;
  const sidecars = options.sidecars instanceof Set ? options.sidecars : new Set();
  const inits = initiativeFrontmatters instanceof Map ? initiativeFrontmatters : new Map();

  // Uniqueness across every initiative (once).
  const seenInitKeys = new Set();
  for (const [key, init] of inits) {
    if (seenInitKeys.has(key)) continue;
    seenInitKeys.add(key);
    errors.push(...checkUniqueIds({ initiative: init }).map((e) => ({
      ...e,
      projectId: e.projectId ?? initiativeProjectId(init, key),
    })));
  }

  for (const [, plan] of planFrontmatters) {
    if (!isObject(plan)) continue;
    const projectId = projectScopeId(plan);
    errors.push(...checkUniqueIds({ plan }).map((e) => ({ ...e, projectId: e.projectId ?? projectId })));

    const phases = Array.isArray(plan.phases) ? plan.phases : [];
    for (const phase of phases) {
      if (!isObject(phase)) continue;
      const sk = hasText(plan.slug) && hasText(phase.slug)
        ? sidecarKey(projectId, plan.slug, phase.slug)
        : null;
      const hasSidecar = sk != null && sidecars.has(sk);

      // Terminal pending gates (plan surface) even before join.
      errors.push(...checkTerminalGates(phase).map((e) => ({
        ...e,
        planSlug: plan.slug,
        projectId,
      })));

      const needsInit = REQUIRES_INITIATIVE.has(phase.status);
      const lazyOk = isValidLazyDescriptor(phase, { hasSidecar });

      if (!needsInit && phase.status === 'pending') {
        if (lazyOk) continue; // descriptor-only valid
        // pending but not a valid lazy descriptor: if initiative exists, join it;
        // if not, report missing initiative or missing sidecar.
        const resolvedPending = resolvePhaseInitiative(plan, phase, inits);
        if (resolvedPending.kind === 'matched') {
          // still validate identity uniqueness already done; optional join fields OK
          continue;
        }
        if (phase.subPhaseCount === 0 && !hasSidecar) {
          errors.push({
            code: STATE_INTEGRITY_CODES.MISSING_SIDECAR,
            message: `phase ${phase.id ?? '?'} is descriptor-shaped (pending, subPhaseCount 0) but has no lazy sidecar under project '${projectId}' plan '${plan.slug}'`,
            planSlug: plan.slug,
            phaseId: phase.id,
            initiativeSlug: phase.slug,
            projectId,
          });
          continue;
        }
        if (resolvedPending.kind === 'slug-collision' || resolvedPending.kind === 'identity-mismatch') {
          errors.push({
            code: resolvedPending.code,
            message: resolvedPending.message,
            planSlug: plan.slug,
            phaseId: phase.id,
            initiativeSlug: phase.slug,
            projectId,
            mismatches: resolvedPending.mismatches,
          });
          continue;
        }
        errors.push({
          code: STATE_INTEGRITY_CODES.MISSING_INITIATIVE,
          message: `phase ${phase.id ?? '?'} status 'pending' is not a valid lazy descriptor (need subPhaseCount 0 + sidecar) and has no matching initiative`,
          planSlug: plan.slug,
          phaseId: phase.id,
          initiativeSlug: phase.slug,
          projectId,
        });
        continue;
      }

      if (!needsInit) continue;

      const resolved = resolvePhaseInitiative(plan, phase, inits);
      if (resolved.kind === 'missing') {
        errors.push({
          code: STATE_INTEGRITY_CODES.MISSING_INITIATIVE,
          message: `phase ${phase.id ?? '?'} status '${phase.status}' requires a matching initiative (projectId+plan+phase); ${resolved.message}`,
          planSlug: plan.slug,
          phaseId: phase.id,
          initiativeSlug: phase.slug,
          projectId,
        });
        continue;
      }
      if (resolved.kind === 'slug-collision' || resolved.kind === 'identity-mismatch') {
        errors.push({
          code: resolved.code,
          message: resolved.message,
          planSlug: plan.slug,
          phaseId: phase.id,
          initiativeSlug: phase.slug,
          projectId,
          mismatches: resolved.mismatches,
        });
        continue;
      }

      // Matched: co-check initiative terminal gates (plan already checked above;
      // re-run with initiative for exitGates surface without duplicating plan criteria).
      if (TERMINAL_PHASE.has(phase.status) && isObject(resolved.initiative)) {
        const pendingInit = (Array.isArray(resolved.initiative.exitGates) ? resolved.initiative.exitGates : [])
          .filter((g) => g?.status === 'pending');
        if (pendingInit.length > 0) {
          errors.push({
            code: STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE,
            message: `phase ${phase.id ?? '?'} is '${phase.status}' but initiative '${resolved.initiative.slug ?? '?'}' has pending exitGate(s): ${pendingInit.map((g) => g.id ?? '?').join(', ')}`,
            planSlug: plan.slug,
            phaseId: phase.id,
            initiativeSlug: resolved.initiative.slug,
            projectId,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Classify a single integrity finding for conservative migration.
 * Only missing identity field backfill is repairable; contradictions stay unmanaged.
 *
 * @param {object} finding
 * @returns {{ disposition: 'repairable'|'unmanaged', repair?: object, reason?: string }}
 */
export function classifyIntegrityRepair(finding) {
  if (!isObject(finding)) {
    return { disposition: 'unmanaged', reason: 'non-object finding' };
  }
  // Explicit repairable shape from planIntegrityRepairs / callers.
  if (finding.kind === 'missing-identity-fields'
    || (finding.code === STATE_INTEGRITY_CODES.IDENTITY_MISMATCH && finding.kind === 'missing-identity-fields')) {
    const expected = finding.expected;
    if (isObject(expected) && hasText(expected.parentPlan) && hasText(expected.phaseId)
      && isObject(finding.initiative)) {
      return {
        disposition: 'repairable',
        repair: {
          kind: 'backfill-identity',
          parentPlan: expected.parentPlan,
          phaseId: expected.phaseId,
          phaseSlug: finding.phaseSlug ?? finding.initiative.slug,
          projectId: finding.projectId,
          planSlug: finding.planSlug,
        },
      };
    }
  }

  // Wrong identity, missing initiative, collisions, duplicates, terminal pending → unmanaged.
  return {
    disposition: 'unmanaged',
    reason: finding.code ?? 'unsupported',
  };
}

/**
 * Scan plans/inits and emit repairable backfills + unmanaged findings.
 * Missing parentPlan and/or phaseId on a uniquely joined initiative is repairable.
 * Wrong values are unmanaged (no coercion).
 *
 * @param {Map<string, object>} planFrontmatters
 * @param {Map<string, object>} initiativeFrontmatters
 * @param {{ sidecars?: Set<string> }} [options]
 * @returns {{ repairs: object[], unmanaged: IntegrityError[] }}
 */
export function planIntegrityRepairs(planFrontmatters, initiativeFrontmatters, options = {}) {
  const repairs = [];
  const unmanaged = [];
  const integrityErrors = collectStateIntegrityErrors(planFrontmatters, initiativeFrontmatters, options);

  // First pass: detect missing-field backfills that collectStateIntegrityErrors
  // does NOT flag as identity-mismatch (absent fields are not mismatches).
  if (planFrontmatters instanceof Map && initiativeFrontmatters instanceof Map) {
    for (const [, plan] of planFrontmatters) {
      if (!isObject(plan) || !hasText(plan.slug)) continue;
      const projectId = projectScopeId(plan);
      for (const phase of Array.isArray(plan.phases) ? plan.phases : []) {
        if (!isObject(phase) || !hasText(phase.slug)) continue;
        if (!REQUIRES_INITIATIVE.has(phase.status) && phase.status !== 'pending') continue;

        const resolved = resolvePhaseInitiative(plan, phase, initiativeFrontmatters);
        if (resolved.kind === 'matched') {
          const init = resolved.initiative;
          const missingParent = !hasText(init.parentPlan);
          const missingPhaseId = !hasText(init.phaseId);
          if (missingParent || missingPhaseId) {
            repairs.push({
              kind: 'backfill-identity',
              projectId,
              planSlug: plan.slug,
              phaseId: phase.id,
              phaseSlug: phase.slug,
              parentPlan: plan.slug,
              initiativeSlug: init.slug ?? phase.slug,
              // path filled by I/O layer when known
              missing: {
                parentPlan: missingParent,
                phaseId: missingPhaseId,
              },
            });
          }
          continue;
        }
        if (resolved.kind === 'identity-mismatch') {
          // Only treat as repairable when BOTH fields are absent-or-matching is
          // impossible here — mismatch means wrong present values → unmanaged.
          unmanaged.push({
            code: STATE_INTEGRITY_CODES.IDENTITY_MISMATCH,
            message: resolved.message,
            planSlug: plan.slug,
            phaseId: phase.id,
            initiativeSlug: phase.slug,
            projectId,
          });
          continue;
        }
        // missing / slug-collision handled via integrityErrors below
      }
    }
  }

  for (const err of integrityErrors) {
    // Skip identity-mismatch already recorded; skip codes that are pure diagnostics
    // already covered. Always surface non-repairable integrity codes as unmanaged.
    if (err.code === STATE_INTEGRITY_CODES.IDENTITY_MISMATCH) {
      if (!unmanaged.some((u) => u.message === err.message && u.phaseId === err.phaseId)) {
        unmanaged.push(err);
      }
      continue;
    }
    // Duplicates / terminal / missing init / collision / missing sidecar — unmanaged.
    unmanaged.push(err);
  }

  return { repairs, unmanaged };
}
