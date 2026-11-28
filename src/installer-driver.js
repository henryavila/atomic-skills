// Mirrors minimalist-installer/src/driver.js (MIT) at upstream commit
// e37ae7f3d70c96ab3d920522ba739da5fb324a03.
// tests/installer-driver-sync.test.js guards every deviation from the installed copy.
// The upstream driver hardcodes textBlock preflight before registry.apply.
// Keep its transaction/locking protocol, adding only the registry preparePlan
// hook, retention of refused instruction states, and revert language below. Drop this adapter
// when upstream exposes those hooks.
import {
  readManifest, writeManifest, removeManifest, MANIFEST_DIR,
  readEffects, recordEffect, replayReverse, stableEffectId, JOURNAL_VERSION,
  acquireInstallLocks, assertNoIncompleteTransaction,
} from '@henryavila/minimalist-installer';
// No public prepareTextBlockPlan export exists at this pin (only the effect
// factory is exported). Reuse the private planner's byte/marker validation.
export const { prepareTextBlockPlan } = await import(new URL('./kernel/effects/text-block.js',
  import.meta.resolve('@henryavila/minimalist-installer')).href);

// The Driver is identical for every consumer. It runs the configured providers to
// emit effects, applies each effect, journals its before-state on the manifest,
// and persists the manifest. Uninstall replays the journal in reverse (the
// structural uninstall) and removes the manifest — no consumer writes revert logic.
//
// Matching prior effects: prefer stable `id` (journal v2); fall back to
// (type, occurrence order) for v1 manifests.
/**
 * @typedef {object} DriverRegistry
 * @property {(type: string) => ({ apply: Function, revert: Function, preparePlan?: Function } | undefined)} get
 */

/**
 * @typedef {object} DriverOptions
 * @property {DriverRegistry} [registry]
 * @property {Array<{ plan: Function }>} [providers]
 * @property {string} [manifestDir]
 * @property {string} [lockRoot]
 * @property {Function | object[]} [resourceIdentities]
 */

/**
 * Index prior journal before-states by stable id and by type occurrence.
 * @param {object | null | undefined} prior
 */
function indexPriorEffects(prior) {
  const priorById = new Map();
  const priorByType = new Map();
  if (prior) {
    for (const entry of readEffects(prior)) {
      const { type, beforeState, id } = entry;
      if (id != null) priorById.set(id, beforeState);
      if (!priorByType.has(type)) priorByType.set(type, []);
      priorByType.get(type).push(beforeState);
    }
  }
  return { priorById, priorByType };
}

/** Normalize planned textBlock entries and the prior text states they match. */
function textBlockInputs(planned, prior, priorByType) {
  const text = planned.filter(({ type }) => type === 'textBlock').map((entry) => ({
    ...entry,
    effectId: entry.id ?? stableEffectId('textBlock', entry.args),
    begin: entry.args.markers?.begin ?? `<!-- BEGIN ${entry.args.id} -->`,
    end: entry.args.markers?.end ?? `<!-- END ${entry.args.id} -->`,
  }));
  const plannedTextIds = new Set(text.map(({ effectId }) => effectId));
  const states = priorByType.get('textBlock') ?? [];
  const priorTextIds = new Map(readEffects(prior).filter(({ type }) => type === 'textBlock')
    .map(({ id, beforeState }) => [beforeState, id ?? stableEffectId('textBlock', beforeState)]));
  return { text, plannedTextIds, states, priorTextIds };
}

/** Attach the predecessor state this install replaces to each text entry. */
function claimTextBlockPredecessors(text, states, priorById, plannedTextIds, priorTextIds) {
  const used = new Set();
  const claim = (entry, state) => {
    if (state) {
      if (used.has(state)) throw new Error(`textBlock marker collision at "${entry.args.path}"`);
      used.add(state);
      entry.previous = state;
    }
  };
  // Explicit journal identities reserve predecessors before id fallback.
  for (const entry of text) {
    const state = priorById.get(entry.effectId);
    if (states.includes(state) && state.path === entry.args.path) claim(entry, state);
  }
  for (const entry of text.filter(({ previous }) => !previous)) {
    claim(entry, states.find((state) => !used.has(state)
      && !plannedTextIds.has(priorTextIds.get(state))
      && state.path === entry.args.path && state.id === entry.args.id));
  }
}

/** Refuse two planned blocks that would collide on one file. */
function assertNoTextBlockCollisions(text, states) {
  const overlap = (a, b) => a.begin === b.begin || a.begin === b.end
    || a.end === b.begin || a.end === b.end;
  for (const entry of text) {
    if (text.some((other) => other !== entry && other.args.path === entry.args.path
      && (overlap(entry, other) || entry.args.id === other.args.id || entry.effectId === other.effectId))
      || states.some((state) => entry.previous && state !== entry.previous && state.path === entry.args.path
        && text.some((other) => other.previous === state) && overlap(entry, state))) {
      throw new Error(`textBlock marker collision at "${entry.args.path}"`);
    }
  }
}

/** Run textBlock preflight and keep the provider's original plan order. */
function orderTextBlockPlan(planned, text, states, projectDir, registry) {
  const preparePlan = registry.get('textBlock').preparePlan ?? prepareTextBlockPlan;
  const prepared = preparePlan(text.map(({ args, previous }) => ({ ...args, previous })), states, projectDir);
  const textQueue = [...prepared.entries];
  const orderedPlan = planned.map((entry) => {
    if (entry.type !== 'textBlock') return entry;
    const args = textQueue.shift();
    const original = text.find((item) => item.args.path === args.path && item.args.id === args.id);
    return { type: 'textBlock', args, id: original.effectId };
  });
  return { prepared, orderedPlan };
}

/**
 * Incomplete marker preserves prior effects so a crash before the first
 * mutation still leaves a recoverable journal. Once the first new effect
 * applies, the on-disk journal is rebuilt from applied effects only
 * (durable per-effect flush — F-001). journalMode marks post-U trust.
 */
function createIncompleteManifest(prior) {
  return {
    journalVersion: JOURNAL_VERSION,
    effects: prior ? [...readEffects(prior)] : [],
    transaction: {
      id: `${Date.now()}-${process.pid}`,
      state: 'incomplete',
      journalMode: 'per-effect',
      startedAt: new Date().toISOString(),
      appliedCount: 0,
    },
  };
}

function flushIncompleteManifest(manifest, projectDir, manifestDir) {
  const flushed = {
    ...manifest,
    transaction: {
      ...manifest.transaction,
      state: 'incomplete',
      journalMode: 'per-effect',
      appliedCount: readEffects(manifest).length,
    },
  };
  writeManifest(projectDir, flushed, manifestDir);
  return flushed;
}

function completeManifest(manifest, projectDir, manifestDir) {
  const complete = {
    ...manifest,
    transaction: {
      ...manifest.transaction,
      state: 'complete',
      journalMode: 'per-effect',
      appliedCount: readEffects(manifest).length,
      completedAt: new Date().toISOString(),
    },
  };
  writeManifest(projectDir, complete, manifestDir);
  return complete;
}

/** Resolve one planned effect's id, prior state and apply arguments. */
function planEffectApplication(entry, cursor, priorById, priorByType) {
  const { type, args, id: plannedId } = entry;
  const id = plannedId ?? stableEffectId(type, args);
  const occurrence = cursor.get(type) ?? 0;
  cursor.set(type, occurrence + 1);

  let previous;
  if (type !== 'textBlock') {
    previous = priorById.get(id);
    if (previous === undefined) previous = priorByType.get(type)?.[occurrence];
  }
  const applyArgs = type === 'textBlock' ? args
    : previous === undefined ? args : { ...args, previous };
  return { type, id, applyArgs };
}

function applyJournaledEffect({
  entry, effect, manifest, projectDir, manifestDir, cursor, priorById, priorByType,
}) {
  const { type, id, applyArgs } = planEffectApplication(entry, cursor, priorById, priorByType);
  const beforeState = effect.apply(applyArgs);
  const recorded = recordEffect(manifest, { type, id, beforeState });
  // F-001: after each successful apply, flush incomplete journal so
  // crash/SIGKILL leaves disk ownership matching journaled effects.
  // Rollback-only recovery is rejected — durability is the primary
  // mechanism (optional in-process reverse remains a consumer choice).
  return flushIncompleteManifest(recorded, projectDir, manifestDir);
}

/**
 * @param {DriverOptions} [options]
 */
export const createDriver = ({
  registry,
  providers,
  manifestDir = MANIFEST_DIR,
  lockRoot,
  resourceIdentities,
} = {}) => {
  const planEffects = (config, projectDir) => {
    const planCtx = { basePath: projectDir, manifestDir };
    return providers.flatMap((provider) => provider.plan(config, planCtx));
  };

  const resolveExtraIdentities = (projectDir, config) => {
    if (typeof resourceIdentities === 'function') {
      return resourceIdentities({ projectDir, config, manifestDir }) ?? [];
    }
    return resourceIdentities ?? [];
  };

  return {
    install(config, { projectDir }) {
      assertNoIncompleteTransaction(projectDir, manifestDir);

      const extra = resolveExtraIdentities(projectDir, config);
      const locks = acquireInstallLocks({ projectDir, extra, lockRoot });
      try {
        const prior = readManifest(projectDir, manifestDir);
        const { priorById, priorByType } = indexPriorEffects(prior);
        const planned = planEffects(config, projectDir);
        const { text, plannedTextIds, states, priorTextIds } = textBlockInputs(
          planned, prior, priorByType,
        );
        claimTextBlockPredecessors(text, states, priorById, plannedTextIds, priorTextIds);
        assertNoTextBlockCollisions(text, states);
        const { prepared, orderedPlan } = orderTextBlockPlan(
          planned, text, states, projectDir, registry,
        );

        let manifest = createIncompleteManifest(prior);
        writeManifest(projectDir, manifest, manifestDir);

        // Rebuild journal for this install (in memory until first successful apply).
        manifest = { ...manifest, effects: (prepared.parked ?? []).map((beforeState) => ({
          type: 'textBlock', id: priorTextIds.get(beforeState), beforeState,
        })) };

        for (const state of prepared.removals) {
          registry.get('textBlock').revert({ basePath: projectDir, language: config.language }, state);
        }
        const cursor = new Map();
        for (const entry of orderedPlan) {
          const effect = registry.get(entry.type);
          if (!effect) {
            throw new Error(`Provider emitted an unregistered effect type "${entry.type}"`);
          }
          manifest = applyJournaledEffect({
            entry, effect, manifest, projectDir, manifestDir, cursor, priorById, priorByType,
          });
        }

        return completeManifest(manifest, projectDir, manifestDir);
      } finally {
        locks.release();
      }
    },

    uninstall({ projectDir }) {
      assertNoIncompleteTransaction(projectDir, manifestDir);
      const locks = acquireInstallLocks({
        projectDir,
        extra: resolveExtraIdentities(projectDir, {}),
        lockRoot,
      });
      try {
        const manifest = readManifest(projectDir, manifestDir);
        if (manifest == null) return;

        replayReverse(manifest, { basePath: projectDir, manifestDir, language: manifest.language }, registry);
        removeManifest(projectDir, manifestDir);
      } finally {
        locks.release();
      }
    },
  };
};
