/**
 * P0-B / F-002 consumer fallback — REVERT DROPPED AUTO-UPDATE EFFECTS ON IDE SHRINK.
 *
 * *** DELETE THIS MODULE when engine drop-effect revert lands in the
 * `@henryavila/minimalist-installer` pin (same pin-bump PR). Hard rule from
 * docs/plans/installer-hardening-p0-p1.md: engine owns drop-revert; this
 * workaround must not double-apply after the pin. ***
 *
 * Problem: Driver final journal = current plan only. When auto-update plans
 * zero effects (no capable hosts — Codex/Cursor-only), prior
 * `stageRuntimeArtifacts` + `jsonMerge` entries are dropped from the plan
 * without `revert` → orphan version-check.sh and SessionStart residue.
 *
 * Scope: auto-update surfaces ONLY (version-check script, Claude SessionStart
 * merge, Grok auto-update hook file). Not a general "any dropped effect" engine.
 *
 * Crash-resumable: writes `.atomic-skills/auto-update-drop-pending.json` before
 * the first reverse; marks each item after successful reverse; deletes the
 * ledger when empty. Mid-drop kill → next install resumes remaining items.
 *
 * Safety (P0-B Codex majors):
 *   1. **Incomplete TX fail-closed** — before any drop-revert disk mutation,
 *      `assertNoIncompleteTransaction` (same contract as Driver.install). If
 *      incomplete → throw INCOMPLETE_TRANSACTION; do not mutate settings/hooks.
 *      Caller surfaces repair flags (`install --repair` /
 *      `uninstall --force-incomplete`).
 *   2. **Install-root lock** — mutations run under `acquireInstallLocks` so
 *      concurrent installers serialize on the same projectDir.
 *
 * Residual race (documented): lock is held only for this helper; Driver.install
 * re-acquires after we release. There is a TOCTOU window between release and
 * the next acquire. Continuous hold across drop-revert + install needs engine
 * integration (drop-revert inside the Driver transaction path).
 */

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createJsonMergeEffect,
  stableEffectId,
  readEffects,
  assertNoIncompleteTransaction,
  acquireInstallLocks,
} from '@henryavila/minimalist-installer';
import { createStageRuntimeArtifactsEffect } from './effects/stage-runtime-artifacts.js';
import {
  createAutoUpdateRuntimeProvider,
  GROK_AUTO_UPDATE_HOOK_REL,
} from './auto-update.js';
import { MANIFEST_DIR, MANIFEST_FILE } from '../manifest.js';

/** Pending ledger filename under MANIFEST_DIR. */
export const AUTO_UPDATE_DROP_PENDING_FILE = 'auto-update-drop-pending.json';

/** Canonical relative paths for auto-update surfaces. */
export const VERSION_CHECK_REL = '.atomic-skills/hooks/version-check.sh';
export const CLAUDE_SETTINGS_REL = '.claude/settings.json';

const STAGE_ID = `stageRuntimeArtifacts:${VERSION_CHECK_REL}`;
const CLAUDE_JSON_ID = `jsonMerge:${CLAUDE_SETTINGS_REL}`;
const GROK_JSON_ID = `jsonMerge:${GROK_AUTO_UPDATE_HOOK_REL}`;

const AUTO_UPDATE_IDS = new Set([STAGE_ID, CLAUDE_JSON_ID, GROK_JSON_ID]);

const stageEffect = createStageRuntimeArtifactsEffect();
const jsonMergeEffect = createJsonMergeEffect();

const EFFECT_BY_TYPE = {
  stageRuntimeArtifacts: stageEffect,
  jsonMerge: jsonMergeEffect,
};

/**
 * @param {string} projectDir
 * @returns {string}
 */
export function autoUpdateDropPendingPath(projectDir) {
  return join(projectDir, MANIFEST_DIR, AUTO_UPDATE_DROP_PENDING_FILE);
}

/**
 * Infer stable id for a journaled auto-update effect when `id` is missing (v1).
 * @param {{ type?: string, beforeState?: object }} entry
 * @returns {string|null}
 */
export function inferAutoUpdateEffectId(entry) {
  if (!entry || typeof entry !== 'object') return null;

  if (entry.type === 'stageRuntimeArtifacts') {
    const created = entry.beforeState?.created ?? [];
    if (
      created.includes(VERSION_CHECK_REL)
      || created.some((p) => typeof p === 'string' && p.endsWith('version-check.sh'))
    ) {
      return STAGE_ID;
    }
  }

  if (entry.type === 'jsonMerge') {
    const path = entry.beforeState?.path;
    if (path === GROK_AUTO_UPDATE_HOOK_REL) return GROK_JSON_ID;
    if (path === CLAUDE_SETTINGS_REL) {
      // Surgical: only claim when inserts reference version-check.
      const blob = JSON.stringify(entry.beforeState?.inserts ?? []);
      if (blob.includes('version-check')) return CLAUDE_JSON_ID;
    }
  }

  return null;
}

/**
 * @param {{ type?: string, id?: string, beforeState?: object }} entry
 * @returns {string|null}
 */
export function resolveAutoUpdateEffectId(entry) {
  if (entry?.id && AUTO_UPDATE_IDS.has(entry.id)) return entry.id;
  return inferAutoUpdateEffectId(entry);
}

/**
 * @param {{ type?: string, id?: string, beforeState?: object }} entry
 * @returns {boolean}
 */
export function isAutoUpdateJournalEffect(entry) {
  return resolveAutoUpdateEffectId(entry) != null;
}

/**
 * Stable ids of auto-update effects the next plan will emit.
 * @param {object} config
 * @param {string} projectDir
 * @returns {Set<string>}
 */
export function plannedAutoUpdateEffectIds(config, projectDir) {
  const provider = createAutoUpdateRuntimeProvider();
  const planned = provider.plan(config ?? {}, { basePath: projectDir });
  return new Set(
    planned.map((e) => e.id ?? stableEffectId(e.type, e.args)),
  );
}

/**
 * Prior journal auto-update effects not in the next plan, reverse-apply order.
 * @param {object|null} priorManifest
 * @param {Set<string>} plannedIds
 * @returns {Array<{ id: string, type: string, beforeState: object }>}
 */
export function findDroppedAutoUpdateEffects(priorManifest, plannedIds) {
  const effects = readEffects(priorManifest).filter(isAutoUpdateJournalEffect);
  const dropped = [];
  for (const entry of effects) {
    const id = resolveAutoUpdateEffectId(entry);
    if (id != null && !plannedIds.has(id)) {
      dropped.push({
        id,
        type: entry.type,
        beforeState: entry.beforeState,
      });
    }
  }
  // Reverse application order (last applied first) — same as replayReverse.
  return dropped.reverse();
}

/**
 * @param {string} path
 * @param {object} data
 */
function atomicWriteJson(path, data) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

/**
 * @param {string} projectDir
 * @returns {object|null}
 */
function readPendingLedger(projectDir) {
  const path = autoUpdateDropPendingPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} projectDir
 * @param {object} ledger
 */
function writePendingLedger(projectDir, ledger) {
  atomicWriteJson(autoUpdateDropPendingPath(projectDir), ledger);
}

/**
 * @param {string} projectDir
 */
function clearPendingLedger(projectDir) {
  const path = autoUpdateDropPendingPath(projectDir);
  if (existsSync(path)) unlinkSync(path);
}

/**
 * @param {string} projectDir
 * @param {{ type: string, beforeState: object }} item
 */
function revertOne(projectDir, item) {
  const effect = EFFECT_BY_TYPE[item.type];
  if (!effect) {
    throw new Error(`auto-update drop-revert: unknown effect type "${item.type}"`);
  }
  effect.revert({ basePath: projectDir, manifestDir: MANIFEST_DIR }, item.beforeState);
}

/**
 * Crash-resumable revert of auto-update effects dropped by the next plan.
 * Call immediately before Driver.install when a prior journal may exist.
 *
 * Fail-closed on incomplete transaction (must not mutate settings/hooks while
 * recovery is required). Mutations run under engine install-root lock; see
 * module residual-race note for lock scope vs Driver.install.
 *
 * @param {string} projectDir
 * @param {object} config - installer config (`ides`, `skillsDir`, …)
 * @param {object} [opts]
 * @param {number} [opts.injectFailAfterN] - test seam: throw after N successful reverses
 * @returns {{ dropped: number, resumed: boolean }}
 */
export function revertDroppedAutoUpdateEffects(projectDir, config, opts = {}) {
  let ledger = readPendingLedger(projectDir);
  let resumed = false;
  /** @type {object|null} */
  let newLedger = null;

  if (ledger?.items?.length) {
    resumed = true;
  } else {
    const manifestPath = join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
      return { dropped: 0, resumed: false };
    }

    let prior;
    try {
      prior = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      return { dropped: 0, resumed: false };
    }

    const plannedIds = plannedAutoUpdateEffectIds(config, projectDir);
    const dropped = findDroppedAutoUpdateEffects(prior, plannedIds);
    if (dropped.length === 0) {
      return { dropped: 0, resumed: false };
    }

    // Record drop intent AFTER incomplete-guard + lock (no disk write yet).
    newLedger = {
      version: 1,
      kind: 'auto-update-drop',
      startedAt: new Date().toISOString(),
      items: dropped.map((d) => ({
        id: d.id,
        type: d.type,
        beforeState: d.beforeState,
        status: 'pending',
      })),
    };
  }

  // Serialize with other installers; re-check incomplete under the lock so a
  // concurrent repair cannot race the guard. Residual: we release before
  // Driver.install re-acquires (documented above).
  const locks = acquireInstallLocks({ projectDir });
  try {
    assertNoIncompleteTransaction(projectDir, MANIFEST_DIR);

    if (newLedger) {
      ledger = newLedger;
      writePendingLedger(projectDir, ledger);
    }

    let successCount = 0;
    const items = ledger.items.map((item) => ({ ...item }));

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.status === 'reverted') continue;

      revertOne(projectDir, item);
      successCount += 1;
      items[i] = { ...item, status: 'reverted' };

      writePendingLedger(projectDir, {
        ...ledger,
        items,
        lastRevertedAt: new Date().toISOString(),
        lastRevertedId: item.id,
      });

      if (opts.injectFailAfterN != null && successCount >= opts.injectFailAfterN) {
        const err = new Error(
          `auto-update drop-revert injectFailAfterN=${opts.injectFailAfterN}`,
        );
        err.code = 'AUTO_UPDATE_DROP_INJECTED_FAIL';
        throw err;
      }
    }

    clearPendingLedger(projectDir);
    return {
      dropped: items.length,
      resumed,
    };
  } finally {
    locks.release();
  }
}
