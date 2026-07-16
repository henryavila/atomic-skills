/**
 * done-transaction.js — pure transaction decision for task `done` (F4/T-005).
 *
 * Mirrors phase-done's `decidePhaseDoneTerminal`: callers pass already-parsed
 * slices and receive allow/block + the intended writes/events/commits without
 * performing I/O. Idempotent retry of the same close identity produces zero
 * additional terminal writes or completion events.
 *
 * Close identity = projectId + planSlug + phaseId + taskId + fingerprint (HEAD
 * at close, recorded on evidence as closeFingerprint / verifiedCommit).
 *
 * Ordering contract (durable state before event; handoff inside the checkpoint):
 *   1. recovery marker (if any)
 *   2. durable terminal fields: status, closedAt, evidence, nextAction, handoff
 *   3. appendCompletion (idempotent by completionEventKey)
 *   4. single close checkpoint commit
 *   5. clear recovery marker
 *
 * Never append the event before durable state. Never create a second close
 * commit solely to repair handoff — handoff is part of the first checkpoint.
 */

import { completionEventKey } from './append-completion.js';

function object(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function allow(extra = {}) {
  return {
    allowed: true,
    blocked: false,
    code: null,
    reason: null,
    exception: null,
    recommendedCommand: null,
    ...extra,
  };
}

function block(code, reason, recommendedCommand, extra = {}) {
  return {
    allowed: false,
    blocked: true,
    terminal: false,
    idempotent: false,
    resume: false,
    code,
    reason,
    exception: null,
    recommendedCommand,
    writes: [],
    events: [],
    commits: [],
    order: [],
    ...extra,
  };
}

/**
 * Build the logical completion-event identity for a done close.
 * @param {object} input
 * @returns {string|null}
 */
export function doneEventKey(input = {}) {
  const safe = object(input);
  const task = object(safe.task);
  const taskId = text(safe.taskId) || text(task.id);
  return completionEventKey({
    event: 'task-done',
    projectId: text(safe.projectId) || text(task.projectId),
    planSlug: text(safe.planSlug) || text(task.planSlug) || text(safe.parentPlan),
    phaseId: text(safe.phaseId) || text(task.phaseId),
    taskId,
  });
}

function taskSlice(input) {
  return object(input.task);
}

function evidenceOf(input) {
  const task = taskSlice(input);
  return object(input.evidence ?? task.evidence);
}

function closeFingerprintOf(input) {
  const evidence = evidenceOf(input);
  const task = taskSlice(input);
  return text(
    input.closeFingerprint
    ?? evidence.closeFingerprint
    ?? evidence.verifiedCommit
    ?? task.closeFingerprint,
  );
}

function currentFingerprintOf(input) {
  return text(input.fingerprint ?? input.headSha ?? input.currentFingerprint);
}

function hasVerifier(input) {
  const task = taskSlice(input);
  const v = input.verifier ?? task.verifier;
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}

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

function eventPresent(input, key) {
  if (input.eventPresent === true) return true;
  if (input.eventPresent === false) return false;
  if (!key) return false;
  const priorKeys = array(input.priorEventKeys).map(String);
  if (priorKeys.includes(key)) return true;
  const priorEvents = array(input.priorEvents);
  for (const ev of priorEvents) {
    if (completionEventKey(ev) === key) return true;
  }
  return false;
}

function handoffPresent(input) {
  if (input.handoffPresent === true) return true;
  if (input.handoffPresent === false) return false;
  const handoff = input.handoff ?? input.sessionHandoff;
  if (typeof handoff === 'string') return handoff.trim() !== '' && !/TODO|placeholder/i.test(handoff);
  if (handoff && typeof handoff === 'object') {
    return Boolean(text(handoff.nextAction) || text(handoff.narrative));
  }
  return text(input.nextAction) !== '';
}

function terminalWrites(taskId, { includeHandoff = true } = {}) {
  const writes = [
    'task:status:done',
    'task:closedAt',
    'task:evidence',
    'initiative:nextAction',
    'initiative:lastUpdated',
  ];
  if (includeHandoff) writes.splice(4, 0, 'initiative:handoff');
  return writes;
}

function emptyEffect(base) {
  return {
    ...base,
    terminal: false,
    writes: [],
    events: [],
    commits: [],
    order: [],
  };
}

/**
 * Pure transaction decision for task `done`.
 *
 * @param {object} [input]
 * @param {string} [input.taskId]
 * @param {object} [input.task] { id, status, evidence?, verifier? }
 * @param {string} [input.projectId]
 * @param {string} [input.planSlug]
 * @param {string} [input.phaseId]
 * @param {string} [input.fingerprint] current HEAD fingerprint
 * @param {string} [input.closeFingerprint] fingerprint recorded with the close
 * @param {boolean} [input.verifierPassed]
 * @param {boolean} [input.manualAck]
 * @param {boolean} [input.eventPresent]
 * @param {string[]} [input.priorEventKeys]
 * @param {object[]} [input.priorEvents]
 * @param {boolean} [input.handoffPresent]
 * @param {object|null} [input.recoveryMarker] incomplete close marker, if any
 * @returns {{
 *   allowed:boolean, blocked:boolean, terminal:boolean, idempotent:boolean, resume:boolean,
 *   code:string|null, reason:string|null, exception:string|null, recommendedCommand:string|null,
 *   writes:string[], events:string[], commits:string[], order:string[],
 *   eventKey:string|null, fingerprint:string|null,
 * }}
 */
export function decideDoneTerminal(input = {}) {
  const safe = object(input);
  const task = taskSlice(safe);
  const taskId = text(safe.taskId) || text(task.id);
  const projectId = text(safe.projectId) || text(task.projectId);
  const planSlug = text(safe.planSlug) || text(task.planSlug) || text(safe.parentPlan);
  const phaseId = text(safe.phaseId) || text(task.phaseId);
  const status = text(task.status);
  const fingerprint = currentFingerprintOf(safe);
  const closeFp = closeFingerprintOf(safe);
  const key = doneEventKey({ ...safe, taskId, projectId, planSlug, phaseId });
  const hasEvent = eventPresent(safe, key);
  const stateDone = status === 'done';
  const hasEvidence = Object.keys(evidenceOf(safe)).length > 0
    || safe.evidencePresent === true;

  if (!taskId) {
    return block(
      'done-missing-task',
      'done requires a non-empty taskId',
      'Pass the task id (`done <task-id>`) and rerun.',
      { eventKey: null, fingerprint: fingerprint || null, idempotent: false, resume: false },
    );
  }
  if (!projectId || !planSlug || !phaseId) {
    return block(
      'done-missing-identity',
      'done requires projectId + planSlug + phaseId for a stable completion identity',
      'Load the phase initiative identity, then rerun `done`.',
      { eventKey: key, fingerprint: fingerprint || null, idempotent: false, resume: false },
    );
  }

  // Stale fingerprint on an already-closed task: do not re-mutate or re-emit.
  if (stateDone && closeFp && fingerprint && fingerprint !== closeFp) {
    return block(
      'done-fingerprint-mismatch',
      `done retry fingerprint mismatch: closed at ${closeFp}, HEAD is ${fingerprint}`,
      'Do not re-close; open a new task or re-verify against the recorded close fingerprint.',
      { eventKey: key, fingerprint, idempotent: false, resume: false },
    );
  }

  // Recovery marker with partial progress takes precedence over inferred resume.
  const marker = object(safe.recoveryMarker);
  if (Object.keys(marker).length > 0) {
    const doneSteps = new Set(array(marker.completedSteps ?? marker.stepsCompleted).map(String));
    const writes = [];
    if (!doneSteps.has('status') && !stateDone) {
      writes.push('task:status:done', 'task:closedAt', 'task:evidence', 'initiative:nextAction', 'initiative:lastUpdated');
    }
    if (!doneSteps.has('handoff') && !handoffPresent(safe)) writes.push('initiative:handoff');
    const events = (!doneSteps.has('event') && !hasEvent) ? [`task-done:${taskId}`] : [];
    const commits = doneSteps.has('checkpoint')
      ? []
      : [`chore(project): checkpoint <plan> <phase> ${taskId}`];
    if (writes.length === 0 && events.length === 0 && commits.length === 0) {
      return emptyEffect(allow({
        terminal: false,
        idempotent: true,
        resume: true,
        code: 'done-idempotent',
        reason: 'recovery marker shows close already complete; clear marker only',
        eventKey: key,
        fingerprint: fingerprint || closeFp || null,
        order: ['marker:clear'],
      }));
    }
    return allow({
      terminal: true,
      idempotent: false,
      resume: true,
      code: 'done-resume-marker',
      reason: 'incomplete done recovery marker; resume remaining steps only',
      recommendedCommand: null,
      writes,
      events,
      commits,
      order: ['marker:resume', 'state:remaining', 'event:if-needed', 'checkpoint:if-needed', 'marker:clear'],
      eventKey: key,
      fingerprint: fingerprint || null,
    });
  }

  // Full success retry — same close identity, durable state + event already present.
  if (stateDone && hasEvidence && hasEvent && (!fingerprint || !closeFp || fingerprint === closeFp)) {
    return emptyEffect(allow({
      terminal: false,
      idempotent: true,
      resume: false,
      code: 'done-idempotent',
      reason: 'task already closed with matching completion event; zero additional writes/events',
      eventKey: key,
      fingerprint: fingerprint || closeFp || null,
    }));
  }

  // Resume: durable state present, event missing (crash after save / before append).
  // No rewrite of terminal fields; no second close commit.
  if (stateDone && hasEvidence && !hasEvent) {
    const writes = handoffPresent(safe) ? [] : ['initiative:handoff'];
    return allow({
      terminal: true,
      idempotent: false,
      resume: true,
      code: 'done-resume-event',
      reason: 'task already durable-done; resume emits the missing completion event only',
      recommendedCommand: null,
      writes,
      events: [`task-done:${taskId}`],
      commits: [],
      order: writes.length
        ? ['state:handoff', 'event:appendCompletion', 'marker:clear']
        : ['event:appendCompletion', 'marker:clear'],
      eventKey: key,
      fingerprint: fingerprint || closeFp || null,
    });
  }

  // Resume: event present (or marker says event done) but state not fully durable.
  // Complete terminal fields + handoff + single checkpoint; do NOT re-emit.
  if (!stateDone && hasEvent) {
    return allow({
      terminal: true,
      idempotent: false,
      resume: true,
      code: 'done-resume-state',
      reason: 'completion event exists without durable done state; resume writes state only',
      recommendedCommand: null,
      writes: terminalWrites(taskId, { includeHandoff: true }),
      events: [],
      commits: [`chore(project): checkpoint <plan> <phase> ${taskId}`],
      order: ['marker:write', 'state:terminal+handoff', 'checkpoint', 'marker:clear'],
      eventKey: key,
      fingerprint: fingerprint || null,
    });
  }

  // Fresh close: verifier (or manual ack) must pass first.
  if (!verifierOk(safe)) {
    return block(
      'done-verifier-open',
      'done cannot close while the task verifier has not passed',
      `Run the task verifier for ${taskId} until evidence.passed is true, then rerun \`done ${taskId}\`.`,
      { eventKey: key, fingerprint: fingerprint || null, idempotent: false, resume: false },
    );
  }

  // Already marked done without evidence/event and no marker — treat as fresh terminal
  // write set (will set evidence + event) rather than silent no-op.
  return allow({
    terminal: true,
    idempotent: false,
    resume: false,
    code: null,
    reason: null,
    recommendedCommand: null,
    writes: terminalWrites(taskId, { includeHandoff: true }),
    events: [`task-done:${taskId}`],
    commits: [`chore(project): checkpoint <plan> <phase> ${taskId}`],
    order: [
      'marker:write',
      'state:terminal+handoff',
      'event:appendCompletion',
      'checkpoint',
      'marker:clear',
    ],
    eventKey: key,
    fingerprint: fingerprint || null,
  });
}

/**
 * Convenience: whether a second decideDoneTerminal call with the same fingerprint
 * would produce zero terminal side effects (fully idempotent).
 */
export function isDoneIdempotent(input = {}) {
  const decision = decideDoneTerminal(input);
  return decision.idempotent === true
    && decision.writes.length === 0
    && decision.events.length === 0
    && (decision.commits.length === 0 || decision.code === 'done-idempotent');
}
