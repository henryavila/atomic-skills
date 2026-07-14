import {
  classifyPhaseDoneCommit,
  classifyPhaseDonePreflight,
} from './lifecycle-order-guard.js';

/**
 * Two-stage phase close coordinator. Evidence production is allowed only after
 * the pure preflight; all durable close effects remain behind a fresh commit
 * guard. Effects are injected so callers can bind the same ordering to files,
 * analytics and successor materialization without duplicating policy.
 */
export async function executePhaseDoneTransaction(input = {}, effects = {}) {
  const preflight = classifyPhaseDonePreflight(input);
  if (!preflight.allowed) {
    return { ok: false, stage: 'preflight', decision: preflight };
  }

  const produced = typeof effects.produceEvidence === 'function'
    ? await effects.produceEvidence(input)
    : {};
  const commitInput = { ...input, ...(produced ?? {}) };
  const commitGuard = classifyPhaseDoneCommit(commitInput);
  if (!commitGuard.allowed) {
    return { ok: false, stage: 'commit-guard', decision: commitGuard };
  }

  const value = typeof effects.commit === 'function'
    ? await effects.commit(commitInput)
    : undefined;
  if (typeof effects.emit === 'function') await effects.emit(commitInput, value);
  if (typeof effects.materializeSuccessor === 'function') {
    await effects.materializeSuccessor(commitInput, value);
  }
  return { ok: true, stage: 'committed', decision: commitGuard, value };
}
