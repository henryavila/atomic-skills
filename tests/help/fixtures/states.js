// Normalized-state fixtures for compute-help `classify()`.
//
// One fixture per item of the precedence list (design
// `docs/design/project-onboarding/guide-command-plan.md` §"Lista de precedência")
// plus OVERLAP fixtures that prove ORDER: when several conditions hold at once,
// the higher-priority rule must win (F-002). The precedence list, verbatim:
//
//   1. sem `.atomic-skills/`            → setup       · new plan
//   2. plano blocked (dependsOnPlans)   → blocked     · switch <prereq>
//   3. drift detectado                  → reconcile   · reconcile
//   4. task active há >24h              → reconcile   · reconcile
//   5. só restam tasks blocked          → implement   · unblock <id>
//   6. fase descriptor-only             → materialize · materialize <phase>
//   7. fase materializada · tasks open  → implement   · implement
//   8. zero tasks abertas · in-plan     → phase-done  · phase-done
//   9. zero tasks abertas · standalone  → archive     · archive <slug>
//  10. todas as fases done              → finalize    · finalize <slug>

/** A fully-normalized state with every flag off; override only what a case needs. */
export function baseState(over = {}) {
  return {
    hasState: true,
    slug: 'demo-plan',
    planBlocked: false,
    blockedPrereq: null,
    drift: false,
    activeOver24h: false,
    onlyBlockedTasks: false,
    blockedTaskId: null,
    phaseDescriptorOnly: false,
    phaseId: 'F1',
    hasOpenTasks: false,
    standalone: false,
    allPhasesDone: false,
    ...over,
  };
}

// One fixture per precedence item → the expected stage + fallback command.
export const PRECEDENCE = [
  { name: 'setup', state: baseState({ hasState: false }), stage: 'setup', command: 'new plan' },
  { name: 'blocked', state: baseState({ planBlocked: true, blockedPrereq: 'core-api' }), stage: 'blocked', command: 'switch core-api' },
  { name: 'drift', state: baseState({ drift: true }), stage: 'reconcile', command: 'reconcile' },
  { name: 'active-over-24h', state: baseState({ activeOver24h: true }), stage: 'reconcile', command: 'reconcile' },
  { name: 'only-blocked', state: baseState({ onlyBlockedTasks: true, blockedTaskId: 'T-007' }), stage: 'implement', command: 'unblock T-007' },
  { name: 'descriptor-only', state: baseState({ phaseDescriptorOnly: true, phaseId: 'F2' }), stage: 'materialize', command: 'materialize F2' },
  { name: 'implement', state: baseState({ hasOpenTasks: true }), stage: 'implement', command: 'implement' },
  { name: 'phase-done', state: baseState({ hasOpenTasks: false }), stage: 'phase-done', command: 'phase-done' },
  { name: 'archive-standalone', state: baseState({ hasOpenTasks: false, standalone: true, slug: 'oneoff' }), stage: 'archive', command: 'archive oneoff' },
  { name: 'finalize', state: baseState({ hasOpenTasks: false, allPhasesDone: true }), stage: 'finalize', command: 'finalize demo-plan' },
];

// Overlap fixtures — multiple conditions true; the higher-priority rule wins.
export const OVERLAPS = [
  {
    name: 'blocked+pending → switch (not implement)',
    state: baseState({ planBlocked: true, blockedPrereq: 'core-api', hasOpenTasks: true }),
    stage: 'blocked',
    command: 'switch core-api',
  },
  {
    name: 'drift+pending → reconcile (not implement)',
    state: baseState({ drift: true, hasOpenTasks: true }),
    stage: 'reconcile',
    command: 'reconcile',
  },
  {
    name: 'active>24h + descriptor-only → reconcile (not materialize)',
    state: baseState({ activeOver24h: true, phaseDescriptorOnly: true, phaseId: 'F2' }),
    stage: 'reconcile',
    command: 'reconcile',
  },
  {
    name: 'stale archive nextAction + all phases done → finalize predecessor',
    state: baseState({
      allPhasesDone: true,
      lifecycleOrderBlocked: true,
      lifecycleRecommendedCommand: 'finalize demo-plan',
      lifecycleOrderReason: 'archive demo-plan requires finalize/consolidate publication before archive',
    }),
    stage: 'finalize',
    command: 'finalize demo-plan',
  },
];

// A pair proving commandSource: nextAction present (persisted) vs absent (fallback).
export const COMMAND_SOURCE = {
  persistedNextAction: 'Rodar `done T-001` após ver o helper verde.',
  fallbackState: baseState({ hasOpenTasks: true }), // → fallback command "implement"
};
