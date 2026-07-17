/**
 * P0-A consumer half — incomplete transaction recovery CLI mutators.
 *
 * `describeRecovery` from @henryavila/minimalist-installer is **read-only**.
 * This module owns the **mutating** recovery transition under the same
 * install/runtime lock family used for install/uninstall.
 *
 * Journal trust heuristic (documented for operators and tests):
 *
 * **post-U** (trusted for reverse-of-applied / reverse+reinstall):
 *   - Engine flag on transaction: `journalMode === 'per-effect'`,
 *     `durablePerEffect === true`, or `journalTrust === 'post-U'`, OR
 *   - Every journaled effect carries a durable flush marker
 *     (`flushedAt`, `durable: true`, or `journaledAt`) — implies the engine
 *     flushed each applied effect to disk before the crash.
 *
 * **pre-U** (current pin / prior-effects-only incomplete marker):
 *   - Default when none of the post-U signals are present.
 *   - Driver writes `transaction: incomplete` with **prior** effects, applies
 *     new effects in memory only, and completes at end. Crash → disk journal
 *     may diverge from applied files. Silent resume is **refused**; use
 *     `uninstall --force-incomplete` + residual recovery ledger.
 *
 * post-U repair strategy (chosen + documented): **(b) reverse all journaled
 * effects, clear incomplete, then re-run full install** — Driver has no public
 * resume-from-N API yet. Option (a) would require upstream pin support.
 *
 * Never write `transaction: complete` on a partial tree. Mid-repair interrupt
 * must leave incomplete marker and/or residual recovery ledger.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describeRecovery,
  inspectTransaction,
  TX_STATE_ABSENT,
  TX_STATE_COMPLETE,
  TX_STATE_INCOMPLETE,
  removeManifest,
  readEffects,
} from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';
import { buildInstaller } from './installer.js';
import { withSharedRuntimeLocks } from './runtime-locks.js';

export const JOURNAL_TRUST_PRE_U = 'pre-U';
export const JOURNAL_TRUST_POST_U = 'post-U';
export const RECOVERY_LEDGER_FILE = 'recovery-ledger.json';

/**
 * Classify incomplete journal trust for recovery decisions.
 * @param {object|null|undefined} manifest
 * @returns {'pre-U'|'post-U'}
 */
export function classifyJournalTrust(manifest) {
  if (!manifest || typeof manifest !== 'object') return JOURNAL_TRUST_PRE_U;
  const tx = manifest.transaction || {};

  if (
    tx.journalMode === 'per-effect'
    || tx.durablePerEffect === true
    || tx.journalTrust === 'post-U'
  ) {
    return JOURNAL_TRUST_POST_U;
  }

  const effects = Array.isArray(manifest.effects) ? manifest.effects : [];
  if (
    effects.length > 0
    && effects.every((e) => e && (e.flushedAt || e.durable === true || e.journaledAt))
  ) {
    return JOURNAL_TRUST_POST_U;
  }

  // pre-U: prior-effects-only incomplete marker; disk may diverge from journal.
  return JOURNAL_TRUST_PRE_U;
}

/**
 * Human-readable recovery summary (effectCount, state, reason, trust).
 * @param {object} desc - describeRecovery() result
 * @param {string} trust
 */
export function formatRecoverySummary(desc, trust) {
  const state = desc?.state ?? 'unknown';
  const effectCount = desc?.effectCount ?? (desc?.manifest?.effects?.length ?? 0);
  const reason = desc?.reason ?? (state === TX_STATE_INCOMPLETE ? 'transaction.state=incomplete' : 'n/a');
  const jv = desc?.journalVersion ?? desc?.manifest?.journalVersion ?? 'n/a';
  const trustLine = trust === JOURNAL_TRUST_POST_U
    ? 'journal trust: post-U (per-effect durable / flushed markers present)'
    : 'journal trust: pre-U (prior-effects-only incomplete marker; disk may diverge)';

  return [
    `Installer transaction recovery summary:`,
    `  state: ${state}`,
    `  effectCount: ${effectCount}`,
    `  reason: ${reason}`,
    `  journalVersion: ${jv}`,
    `  ${trustLine}`,
  ].join('\n');
}

/**
 * Operator message for incomplete TX — commands only, never hand-edit JSON.
 * @param {string} [trust]
 */
export function incompleteOperatorMessage(trust = JOURNAL_TRUST_PRE_U) {
  const lines = [
    'An incomplete installer transaction is blocking install/uninstall.',
    'Do not hand-edit .atomic-skills/manifest.json.',
    '',
    'Recovery commands:',
    '  npx @henryavila/atomic-skills install --repair',
    '    → inspect the incomplete journal and (post-U only) reverse+reinstall',
    '  npx @henryavila/atomic-skills uninstall --force-incomplete',
    '    → best-effort reverse of journaled effects + residual recovery ledger',
  ];
  if (trust === JOURNAL_TRUST_PRE_U) {
    lines.push(
      '',
      'This journal is pre-U (prior-effects-only): install --repair will refuse',
      'silent resume. Run uninstall --force-incomplete first, then reinstall.',
    );
  }
  return lines.join('\n');
}

/**
 * @param {string} basePath
 * @returns {string}
 */
export function recoveryLedgerPath(basePath) {
  return join(basePath, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
}

/**
 * @param {string} basePath
 * @param {object} ledger
 */
export function writeRecoveryLedger(basePath, ledger) {
  const dir = join(basePath, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = recoveryLedgerPath(basePath);
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * @param {string} basePath
 * @returns {object|null}
 */
export function readRecoveryLedger(basePath) {
  const path = recoveryLedgerPath(basePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function maybeInjectFail(opts, stage) {
  if (opts?.injectFailAfter === stage) {
    const err = new Error(`injected mid-repair failure at stage=${stage}`);
    err.code = 'INJECTED_MID_REPAIR';
    throw err;
  }
}

/**
 * Best-effort reverse of journaled effects without assertNoIncompleteTransaction.
 * Soft-fails per effect so partial cleanup still progresses.
 *
 * @param {string} basePath
 * @param {object} manifest
 * @param {object} registry - effect registry from buildInstaller().registry
 * @returns {{ reversed: object[], failed: object[] }}
 */
export function reverseJournaledEffects(basePath, manifest, registry) {
  const reversed = [];
  const failed = [];
  const effects = [...readEffects(manifest)].reverse();
  const ctx = { basePath, manifestDir: MANIFEST_DIR };

  for (const entry of effects) {
    const type = entry?.type;
    try {
      const effectType = registry.get(type);
      if (!effectType) {
        failed.push({
          type,
          id: entry?.id,
          error: `unknown effect type "${type}"`,
          code: 'UNKNOWN_EFFECT',
        });
        continue;
      }
      effectType.revert(ctx, entry.beforeState);
      reversed.push({ type, id: entry?.id });
    } catch (err) {
      failed.push({
        type,
        id: entry?.id,
        error: err?.message || String(err),
        code: err?.code,
      });
    }
  }

  return { reversed, failed };
}

function buildDefaultRegistry() {
  // Registry only — providers need full config for plan(); we only reverse.
  return buildInstaller({}).registry;
}

/**
 * install --repair mutator.
 *
 * pre-U: refuse silent resume; instruct force-incomplete.
 * post-U: reverse journaled → clear incomplete → caller may re-run install
 *         (strategy b; full reinstall left to install() after clear when
 *         reinstall: true).
 *
 * @param {string} basePath
 * @param {object} [opts]
 * @param {boolean} [opts.reinstall] - after post-U reverse+clear, not performed here
 *   (install orchestration stays in install.js); this mutator only reaches a
 *   clean/installable baseline (no incomplete marker).
 * @param {string} [opts.injectFailAfter] - test seam: 'classify' | 'before-reverse' | 'after-reverse'
 * @param {object} [opts.registry]
 * @returns {object}
 */
export function repairIncompleteInstall(basePath, opts = {}) {
  return withSharedRuntimeLocks({ basePath }, () => {
    const desc = describeRecovery(basePath, MANIFEST_DIR);

    if (desc.state === TX_STATE_ABSENT) {
      return {
        action: 'noop',
        exitCode: 0,
        message: 'No installer transaction found — nothing to repair.',
        summary: formatRecoverySummary(desc, JOURNAL_TRUST_PRE_U),
      };
    }

    if (desc.state === TX_STATE_COMPLETE) {
      return {
        action: 'noop',
        exitCode: 0,
        message: 'Installer transaction is complete — nothing to repair.',
        summary: formatRecoverySummary(desc, JOURNAL_TRUST_POST_U),
      };
    }

    const trust = classifyJournalTrust(desc.manifest);
    maybeInjectFail(opts, 'classify');
    const summary = formatRecoverySummary(desc, trust);

    if (trust === JOURNAL_TRUST_PRE_U) {
      return {
        action: 'refuse',
        trust,
        exitCode: 1,
        summary,
        message: [
          summary,
          '',
          incompleteOperatorMessage(JOURNAL_TRUST_PRE_U),
          '',
          'Refusing silent resume on a pre-U incomplete journal (disk may diverge).',
          'Run: npx @henryavila/atomic-skills uninstall --force-incomplete',
          'Then reinstall with: npx @henryavila/atomic-skills install --yes ...',
        ].join('\n'),
      };
    }

    // post-U path (strategy b): reverse all journaled effects, then clear incomplete.
    // Do NOT mark complete on a partial tree — only remove incomplete after reverse.
    maybeInjectFail(opts, 'before-reverse');

    const registry = opts.registry || buildDefaultRegistry();
    const { reversed, failed } = reverseJournaledEffects(basePath, desc.manifest, registry);

    maybeInjectFail(opts, 'after-reverse');

    const residualRisk = failed.length > 0 ? 'partial_reverse' : 'none';
    const ledger = {
      version: 1,
      createdAt: new Date().toISOString(),
      basePath,
      trust,
      recoveryAction: 'install --repair (post-U reverse+clear)',
      strategy: 'reverse-then-reinstall',
      effectCount: desc.effectCount,
      reversedCount: reversed.length,
      reversed,
      failed,
      residualRisk,
      nextSteps: residualRisk === 'none'
        ? [
            'Incomplete marker cleared. Re-run install:',
            '  npx @henryavila/atomic-skills install --yes ...',
            'Do not hand-edit .atomic-skills/manifest.json.',
          ]
        : [
            'Some journaled effects failed to reverse — inspect residualRisk/failed.',
            'Do not hand-edit .atomic-skills/manifest.json.',
            'Retry: npx @henryavila/atomic-skills uninstall --force-incomplete',
          ],
    };
    writeRecoveryLedger(basePath, ledger);

    if (failed.length === 0) {
      // Asserted clean enough to drop incomplete: remove manifest only.
      // Residual ledger remains for audit trail.
      removeManifest(basePath, MANIFEST_DIR);
      // removeManifest may rmdir when empty — rewrite ledger if wiped.
      if (!existsSync(recoveryLedgerPath(basePath))) {
        writeRecoveryLedger(basePath, ledger);
      }
    }
    // If reverse failed partially: keep incomplete marker (do not write complete).

    return {
      action: failed.length === 0 ? 'reversed' : 'partial',
      trust,
      exitCode: failed.length === 0 ? 0 : 1,
      summary,
      ledger,
      reversed,
      failed,
      message: failed.length === 0
        ? [
            summary,
            '',
            'post-U repair: reversed journaled effects and cleared incomplete marker.',
            'Strategy: reverse-then-reinstall (Driver has no resume-from-N API).',
            'Re-run install to complete. Do not hand-edit manifest JSON.',
          ].join('\n')
        : [
            summary,
            '',
            'post-U repair: partial reverse — incomplete marker retained.',
            'See recovery ledger. Do not hand-edit manifest JSON.',
            incompleteOperatorMessage(JOURNAL_TRUST_POST_U),
          ].join('\n'),
    };
  });
}

/**
 * uninstall --force-incomplete mutator.
 *
 * Best-effort reverse of **journaled** effects via registry.revert (no
 * assertNoIncomplete). Writes residual recovery ledger before clearing the
 * incomplete marker so pre-U unjournaled residual risk stays discoverable.
 *
 * @param {string} basePath
 * @param {object} [opts]
 * @param {string} [opts.injectFailAfter]
 * @param {object} [opts.registry]
 * @returns {object}
 */
export function forceIncompleteUninstall(basePath, opts = {}) {
  return withSharedRuntimeLocks({ basePath }, () => {
    const desc = describeRecovery(basePath, MANIFEST_DIR);

    if (desc.state === TX_STATE_ABSENT) {
      return {
        ok: true,
        action: 'noop',
        exitCode: 0,
        message: 'No installer transaction found — nothing to force-uninstall.',
        reversedCount: 0,
        failed: [],
      };
    }

    if (desc.state === TX_STATE_COMPLETE) {
      // force-incomplete is for incomplete only; complete installs use normal uninstall.
      return {
        ok: false,
        action: 'refuse-complete',
        exitCode: 1,
        message: [
          'Transaction is complete — use normal uninstall (without --force-incomplete).',
          '  npx @henryavila/atomic-skills uninstall --yes',
        ].join('\n'),
        reversedCount: 0,
        failed: [],
      };
    }

    const trust = classifyJournalTrust(desc.manifest);
    const summary = formatRecoverySummary(desc, trust);

    maybeInjectFail(opts, 'before-reverse');

    const registry = opts.registry || buildDefaultRegistry();
    const manifest = desc.manifest || { effects: [] };
    const { reversed, failed } = reverseJournaledEffects(basePath, manifest, registry);

    maybeInjectFail(opts, 'after-reverse');

    const residualRisk = trust === JOURNAL_TRUST_PRE_U
      ? 'unjournaled_applies_possible'
      : (failed.length > 0 ? 'partial_reverse' : 'none');

    const ledger = {
      version: 1,
      createdAt: new Date().toISOString(),
      basePath,
      trust,
      recoveryAction: 'uninstall --force-incomplete',
      effectCount: desc.effectCount ?? (manifest.effects?.length ?? 0),
      reversedCount: reversed.length,
      reversed,
      failed,
      residualRisk,
      note: trust === JOURNAL_TRUST_PRE_U
        ? 'pre-U: journal may not list effects applied after the incomplete marker was written. Unjournaled paths can remain on disk.'
        : 'post-U: journaled effects were the reverse target.',
      nextSteps: [
        'Do not hand-edit .atomic-skills/manifest.json.',
        residualRisk === 'unjournaled_applies_possible'
          ? 'Inspect install roots for leftover skill/hook files; remove manually if desired, then reinstall.'
          : 'Tree should be clear of journaled effects; reinstall if needed.',
        'Reinstall: npx @henryavila/atomic-skills install --yes ...',
      ],
    };

    // Always write residual ledger BEFORE clearing incomplete so residual risk
    // remains discoverable even if process dies after this point.
    writeRecoveryLedger(basePath, ledger);

    // Clear incomplete marker after ledger is durable. Prefer removeManifest
    // (does not delete recovery-ledger.json). On partial reverse failure we
    // still clear incomplete for pre-U force path once ledger captures risk —
    // operator can reinstall; keeping incomplete forever blocks recovery.
    // For partial reverse of post-U with failures: keep incomplete.
    const clearIncomplete = trust === JOURNAL_TRUST_PRE_U || failed.length === 0;
    if (clearIncomplete) {
      try {
        // Only remove manifest.json; preserve recovery ledger.
        const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
        if (existsSync(manifestPath)) unlinkSync(manifestPath);
      } catch {
        // If unlink fails, leave incomplete — ledger already written.
      }
    }

    return {
      ok: true,
      action: 'forced',
      trust,
      exitCode: 0,
      summary,
      ledger,
      reversed,
      failed,
      reversedCount: reversed.length,
      residualRisk,
      message: [
        summary,
        '',
        `Force-incomplete: reversed ${reversed.length} journaled effect(s); failed ${failed.length}.`,
        `residualRisk: ${residualRisk}`,
        `Recovery ledger: ${recoveryLedgerPath(basePath)}`,
        'Do not hand-edit .atomic-skills/manifest.json.',
        residualRisk === 'unjournaled_applies_possible'
          ? 'pre-U residual: unjournaled applies may remain — ledger keeps risk discoverable.'
          : 'You may reinstall now.',
      ].join('\n'),
    };
  });
}

/**
 * Resolve whether basePath has an incomplete transaction (for install gate).
 * @param {string} basePath
 */
export function getIncompleteInfo(basePath) {
  const desc = describeRecovery(basePath, MANIFEST_DIR);
  if (desc.state !== TX_STATE_INCOMPLETE) {
    return { incomplete: false, desc, trust: null };
  }
  return {
    incomplete: true,
    desc,
    trust: classifyJournalTrust(desc.manifest),
  };
}

export {
  describeRecovery,
  inspectTransaction,
  TX_STATE_ABSENT,
  TX_STATE_COMPLETE,
  TX_STATE_INCOMPLETE,
};
