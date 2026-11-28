/**
 * P0-A consumer half — incomplete transaction recovery CLI mutators.
 *
 * `describeRecovery` from @henryavila/minimalist-installer is **read-only**.
 * This module owns the **mutating** recovery transition under the same
 * install/runtime lock family used for install/uninstall.
 *
 * Journal trust heuristic (documented for operators and tests):
 *
 * **post-U** (trusted for reverse-of-applied / reverse-only clear):
 *   - Engine pin (67dddc3+): `transaction.journalMode === 'per-effect'`
 *     (or `durablePerEffect` / `describeRecovery.durablePerEffect`) **and**
 *     non-empty journaled effects. The engine durable-flushes each applied
 *     effect without stamping `flushedAt` on entries — journalMode is the
 *     trust signal. When `appliedCount` is present it must be `> 0`
 *     (appliedCount: 0 is the incomplete marker before the first apply).
 *   - Supplementary: every effect has `flushedAt` / `durable: true` even
 *     without journalMode (legacy consumer fixtures).
 *   - Free-form booleans (`journalTrust: 'post-U'`) and weak markers
 *     (`journaledAt` alone, no journalMode) are **not** sufficient — pre-U.
 *
 * **pre-U** (prior-effects-only incomplete / no engine capability stamp):
 *   - Default when post-U evidence is missing.
 *   - Pre-pin engines wrote `transaction: incomplete` with **prior** effects
 *     only while applying new effects in memory. Crash → disk may diverge.
 *     Silent resume is **refused**; use `uninstall --force-incomplete`.
 *
 * post-U repair strategy (chosen + documented): **(b) reverse-only** — reverse
 * journaled effects and clear incomplete. Does **not** auto-reinstall
 * (IDE selection / full install config may be unavailable). Operator re-runs
 * install separately. Option (a) reverse+reinstall would need durable install
 * config + upstream resume API.
 *
 * Never write `transaction: complete` on a partial tree. Mid-repair interrupt
 * must leave incomplete marker and/or residual recovery ledger.
 *
 * Residual race (documented): recovery uses `~/.atomic-skills/locks` via
 * `withSharedRuntimeLocks`; the Driver install path uses
 * `~/.minimalist-installer/locks` unless a shared lockRoot is wired. Concurrent
 * install vs force/repair is a residual race until lock roots are unified.
 *
 * Journal trust/message helpers live in `recovery-journal.js`; the residual
 * ledger and quarantine artifacts live in `recovery-ledger.js`. Both are
 * re-exported here so the public surface is unchanged.
 */

import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  describeRecovery,
  inspectTransaction,
  TX_STATE_ABSENT,
  TX_STATE_COMPLETE,
  TX_STATE_INCOMPLETE,
  removeManifest,
} from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';
import { buildInstaller } from './installer.js';
import { withSharedRuntimeLocks } from './runtime-locks.js';
import {
  JOURNAL_TRUST_PRE_U,
  JOURNAL_TRUST_POST_U,
  classifyJournalTrust,
  formatRecoverySummary,
  incompleteOperatorMessage,
} from './recovery-journal.js';
import {
  recoveryLedgerPath,
  writeRecoveryLedger,
  quarantineIncompleteManifest,
} from './recovery-ledger.js';
import { reverseJournaledEffects } from './recovery-effects.js';
import { resolveIncompleteRecoveryScope } from './recovery-scope.js';

export * from './recovery-journal.js';
export * from './recovery-ledger.js';
export * from './recovery-effects.js';
export * from './recovery-scope.js';

function maybeInjectFail(opts, stage) {
  if (opts?.injectFailAfter === stage) {
    throw Object.assign(
      new Error(`injected mid-repair failure at stage=${stage}`),
      { code: 'INJECTED_MID_REPAIR' },
    );
  }
}

/**
 * @type {{ language: string, ides: string[], skillsDir: string, metaDir: string, scope: ''|'user'|'project' }}
 */
const REVERSE_ONLY_CONFIG = {
  language: 'en',
  ides: [],
  skillsDir: '',
  metaDir: '',
  scope: '',
};

function buildDefaultRegistry() {
  // Registry only — providers need full config for plan(); we only reverse.
  return buildInstaller(REVERSE_ONLY_CONFIG).registry;
}

function repairNoopResult(desc, trust, message) {
  return {
    action: 'noop',
    exitCode: 0,
    message,
    summary: formatRecoverySummary(desc, trust),
  };
}

function repairUnreadableResult(desc) {
  const trust = JOURNAL_TRUST_PRE_U;
  const summary = formatRecoverySummary(desc, trust);
  return {
    action: 'refuse',
    trust,
    exitCode: 1,
    summary,
    unreadable: true,
    message: [
      summary,
      '',
      'Incomplete manifest is unreadable or invalid JSON — refusing silent resume.',
      'Run: npx @henryavila/atomic-skills uninstall --force-incomplete',
      '  (force path quarantines raw bytes before clearing the marker)',
      'Do not hand-edit .atomic-skills/manifest.json.',
    ].join('\n'),
  };
}

function repairPreUResult(summary) {
  return {
    action: 'refuse',
    trust: JOURNAL_TRUST_PRE_U,
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

function buildRepairLedger({ basePath, desc, trust, reversed, failed }) {
  const residualRisk = failed.length > 0 ? 'partial_reverse' : 'unverified';
  const incompleteRetained = failed.length > 0;
  const ledger = {
    version: 1,
    createdAt: new Date().toISOString(),
    basePath,
    trust,
    recoveryAction: 'install --repair (post-U reverse-only)',
    strategy: 'reverse-only',
    effectCount: desc.effectCount,
    reversedCount: reversed.length,
    reversed,
    failed,
    residualRisk,
    incompleteRetained,
    nextSteps: !incompleteRetained
      ? [
          'Incomplete marker cleared (reverse-only). Re-run install separately:',
          '  npx @henryavila/atomic-skills install --yes ...',
          'Do not hand-edit .atomic-skills/manifest.json.',
        ]
      : [
          'Some journaled effects failed to reverse — incomplete marker retained.',
          'Do not hand-edit .atomic-skills/manifest.json.',
          'Retry: npx @henryavila/atomic-skills uninstall --force-incomplete',
        ],
  };
  return { ledger, residualRisk, incompleteRetained };
}

function clearRepairIncomplete(basePath, ledger) {
  // Asserted reverse succeeded: remove incomplete only. Residual ledger remains.
  removeManifest(basePath, MANIFEST_DIR);
  // removeManifest may rmdir when empty — rewrite ledger if wiped.
  if (!existsSync(recoveryLedgerPath(basePath))) {
    writeRecoveryLedger(basePath, ledger);
  }
}

function repairResultMessage(summary, incompleteRetained) {
  return !incompleteRetained
    ? [
        summary,
        '',
        'post-U repair: reversed journaled effects and cleared incomplete marker.',
        'Strategy: reverse-only (does not auto-reinstall; re-run install separately).',
        'Do not hand-edit manifest JSON.',
      ].join('\n')
    : [
        summary,
        '',
        'post-U repair: partial reverse — incomplete marker retained.',
        'See recovery ledger. Do not hand-edit manifest JSON.',
        incompleteOperatorMessage(JOURNAL_TRUST_POST_U),
      ].join('\n');
}

function repairResult({ trust, summary, ledger, reversed, failed, incompleteRetained }) {
  const exitCode = incompleteRetained || failed.length > 0 ? 1 : 0;
  return {
    action: incompleteRetained ? 'partial' : 'reversed',
    trust,
    exitCode,
    ok: exitCode === 0,
    summary,
    ledger,
    reversed,
    failed,
    incompleteRetained,
    message: repairResultMessage(summary, incompleteRetained),
  };
}

function finishRepair({ basePath, desc, trust, summary, reversed, failed }) {
  const { ledger, incompleteRetained } = buildRepairLedger({
    basePath,
    desc,
    trust,
    reversed,
    failed,
  });
  writeRecoveryLedger(basePath, ledger);

  if (!incompleteRetained) {
    clearRepairIncomplete(basePath, ledger);
  }
  // If reverse failed partially: keep incomplete marker (do not write complete).

  return repairResult({ trust, summary, ledger, reversed, failed, incompleteRetained });
}

function repairIncompleteInstallLocked(basePath, opts) {
  const desc = describeRecovery(basePath, MANIFEST_DIR);

  if (desc.state === TX_STATE_ABSENT) {
    return repairNoopResult(desc, JOURNAL_TRUST_PRE_U, 'No installer transaction found — nothing to repair.');
  }

  if (desc.state === TX_STATE_COMPLETE) {
    return repairNoopResult(desc, JOURNAL_TRUST_POST_U, 'Installer transaction is complete — nothing to repair.');
  }

  // Unreadable / invalid JSON incomplete: refuse silent reverse of empty effects.
  if (!desc.manifest) {
    return repairUnreadableResult(desc);
  }

  const trust = classifyJournalTrust(desc.manifest);
  maybeInjectFail(opts, 'classify');
  const summary = formatRecoverySummary(desc, trust);

  if (trust === JOURNAL_TRUST_PRE_U) {
    return repairPreUResult(summary);
  }

  // post-U path (strategy b reverse-only): reverse journaled effects, clear incomplete.
  // Do NOT mark complete on a partial tree — only remove incomplete after reverse.
  // Do NOT auto-reinstall — operator re-runs install with IDE selection.
  maybeInjectFail(opts, 'before-reverse');

  const registry = opts.registry || buildDefaultRegistry();
  const { reversed, failed } = reverseJournaledEffects(basePath, desc.manifest, registry);

  maybeInjectFail(opts, 'after-reverse');

  return finishRepair({ basePath, desc, trust, summary, reversed, failed });
}

/**
 * install --repair mutator.
 *
 * pre-U: refuse silent resume; instruct force-incomplete.
 * post-U: reverse-only — reverse journaled effects, clear incomplete.
 *         Does not auto-reinstall (strategy b).
 *
 * @param {string} basePath
 * @param {object} [opts]
 * @param {boolean} [opts.reinstall] - ignored (no auto-reinstall; install stays in install.js)
 * @param {string} [opts.injectFailAfter] - test seam: 'classify' | 'before-reverse' | 'after-reverse'
 * @param {object} [opts.registry]
 * @returns {object}
 */
export function repairIncompleteInstall(basePath, opts = {}) {
  return withSharedRuntimeLocks({ basePath }, () => repairIncompleteInstallLocked(basePath, opts));
}

function forceAbsentResult() {
  return {
    ok: true,
    action: 'noop',
    exitCode: 0,
    message: 'No installer transaction found — nothing to force-uninstall.',
    reversedCount: 0,
    failed: [],
  };
}

function forceCompleteResult() {
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

function quarantineFailureResult(desc, quarantine) {
  return {
    ok: false,
    action: 'partial-kept-incomplete',
    exitCode: 1,
    incompleteRetained: true,
    reversedCount: 0,
    failed: [{ type: 'quarantine', error: quarantine.error, code: 'QUARANTINE_FAILED' }],
    message: [
      formatRecoverySummary(desc, JOURNAL_TRUST_PRE_U),
      '',
      'Unreadable incomplete manifest and quarantine failed — incomplete retained.',
      `error: ${quarantine.error}`,
      'Do not hand-edit .atomic-skills/manifest.json.',
    ].join('\n'),
  };
}

function buildUnreadableLedger(basePath, quarantine) {
  const residualRisk = 'unreadable_manifest_quarantined';
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    basePath,
    trust: JOURNAL_TRUST_PRE_U,
    recoveryAction: 'uninstall --force-incomplete',
    effectCount: 0,
    reversedCount: 0,
    reversed: [],
    failed: [],
    residualRisk,
    quarantinePath: quarantine.path,
    quarantineBytes: quarantine.bytes,
    note: `Unreadable/invalid incomplete manifest quarantined to ${quarantine.path}. Not treated as empty effects.`,
    nextSteps: [
      'Do not hand-edit .atomic-skills/manifest.json.',
      `Inspect quarantine artifact: ${quarantine.path}`,
      'Inspect install roots for leftover files; then reinstall if needed.',
      'Reinstall: npx @henryavila/atomic-skills install --yes ...',
    ],
  };
}

function unreadableUnlinkFailureResult(basePath, desc, quarantine, ledger, residualRisk) {
  return {
    ok: false,
    action: 'partial-kept-incomplete',
    trust: JOURNAL_TRUST_PRE_U,
    exitCode: 1,
    incompleteRetained: true,
    residualRisk,
    ledger,
    reversedCount: 0,
    failed: [{ type: 'unlink', error: 'failed to clear incomplete after quarantine', code: 'UNLINK_FAILED' }],
    message: [
      formatRecoverySummary(desc, JOURNAL_TRUST_PRE_U),
      '',
      'Quarantined unreadable manifest but failed to clear incomplete marker.',
      `Recovery ledger: ${recoveryLedgerPath(basePath)}`,
      `Quarantine: ${quarantine.path}`,
      'Do not hand-edit .atomic-skills/manifest.json.',
    ].join('\n'),
  };
}

function unreadableSuccessResult(basePath, desc, quarantine, ledger, residualRisk) {
  return {
    ok: true,
    action: 'forced-residual',
    trust: JOURNAL_TRUST_PRE_U,
    exitCode: 0,
    incompleteRetained: false,
    residualRisk,
    ledger,
    reversed: [],
    failed: [],
    reversedCount: 0,
    summary: formatRecoverySummary(desc, JOURNAL_TRUST_PRE_U),
    message: [
      formatRecoverySummary(desc, JOURNAL_TRUST_PRE_U),
      '',
      'Force-incomplete: unreadable manifest quarantined; incomplete marker cleared.',
      `residualRisk: ${residualRisk}`,
      `Quarantine: ${quarantine.path}`,
      `Recovery ledger: ${recoveryLedgerPath(basePath)}`,
      'Do not hand-edit .atomic-skills/manifest.json.',
      'You may reinstall now after inspecting quarantine/residuals.',
    ].join('\n'),
  };
}

function forceUnreadable(basePath, desc) {
  // Unreadable / invalid JSON: quarantine raw bytes before any clear; never
  // treat as empty effects and silently delete the only recovery artifact.
  const quarantine = quarantineIncompleteManifest(basePath);
  if (!quarantine.ok) {
    return quarantineFailureResult(desc, quarantine);
  }

  const residualRisk = 'unreadable_manifest_quarantined';
  const ledger = buildUnreadableLedger(basePath, quarantine);
  writeRecoveryLedger(basePath, ledger);

  try {
    const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
    if (existsSync(manifestPath)) unlinkSync(manifestPath);
  } catch {
    return unreadableUnlinkFailureResult(basePath, desc, quarantine, ledger, residualRisk);
  }

  return unreadableSuccessResult(basePath, desc, quarantine, ledger, residualRisk);
}

function forceResidualRisk(trust, failed) {
  // pre-U always risks unjournaled applies; also surface reverse failures.
  if (trust === JOURNAL_TRUST_PRE_U) {
    return failed.length > 0
      ? 'partial_reverse_and_unjournaled_applies_possible'
      : 'unjournaled_applies_possible';
  }
  return failed.length > 0 ? 'partial_reverse' : 'unverified';
}

function forceLedgerNextSteps(incompleteRetained, residualRisk) {
  return [
    'Do not hand-edit .atomic-skills/manifest.json.',
    incompleteRetained
      ? 'Incomplete marker retained — install/uninstall still blocked until reverse succeeds.'
      : residualRisk.includes('unjournaled')
        ? 'Inspect install roots for leftover skill/hook files; remove manually if desired, then reinstall.'
        : 'Journaled reverse finished; reinstall if needed.',
    incompleteRetained
      ? 'Retry: npx @henryavila/atomic-skills uninstall --force-incomplete'
      : 'Reinstall: npx @henryavila/atomic-skills install --yes ...',
  ];
}

function buildForceLedger({ basePath, desc, trust, reversed, failed, residualRisk, incompleteRetained }) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    basePath,
    trust,
    recoveryAction: 'uninstall --force-incomplete',
    effectCount: desc.effectCount ?? (desc.manifest.effects?.length ?? 0),
    reversedCount: reversed.length,
    reversed,
    failed,
    residualRisk,
    incompleteRetained,
    note: trust === JOURNAL_TRUST_PRE_U
      ? 'pre-U: journal may not list effects applied after the incomplete marker was written. Unjournaled paths can remain on disk.'
      : 'post-U: journaled effects were the reverse target.',
    nextSteps: forceLedgerNextSteps(incompleteRetained, residualRisk),
  };
}

function clearIncompleteManifest(basePath) {
  try {
    // Only remove manifest.json; preserve recovery ledger.
    const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
    if (existsSync(manifestPath)) unlinkSync(manifestPath);
    return true;
  } catch {
    // If unlink fails, leave incomplete — ledger already written.
    return false;
  }
}

function forceAction(incompleteRetained, failed, residualRisk) {
  if (incompleteRetained) return 'partial-kept-incomplete';
  if (failed.length > 0) return 'forced-residual';
  if (residualRisk.includes('unjournaled')) return 'forced-residual';
  return 'forced-clean';
}

function forceResultMessage({ basePath, summary, reversed, failed, residualRisk, incompleteRetained }) {
  const mayReinstall = !incompleteRetained;
  return [
    summary,
    '',
    `Force-incomplete: reversed ${reversed.length} journaled effect(s); failed ${failed.length}.`,
    `residualRisk: ${residualRisk}`,
    incompleteRetained
      ? 'Incomplete marker RETAINED — recovery not complete.'
      : 'Incomplete marker cleared.',
    `Recovery ledger: ${recoveryLedgerPath(basePath)}`,
    'Do not hand-edit .atomic-skills/manifest.json.',
    mayReinstall
      ? (residualRisk.includes('unjournaled')
        ? 'pre-U residual: unjournaled applies may remain — ledger keeps risk discoverable. You may reinstall after inspection.'
        : 'You may reinstall now.')
      : 'Do not treat this as success — reverse failed and incomplete still blocks install.',
  ].join('\n');
}

function buildForceResult({
  basePath,
  action,
  trust,
  summary,
  ledger,
  reversed,
  failed,
  residualRisk,
  incompleteRetained,
}) {
  // Honest exit: non-zero when reverse failed or incomplete retained.
  const exitCode = failed.length > 0 || incompleteRetained ? 1 : 0;
  return {
    ok: exitCode === 0,
    action,
    trust,
    exitCode,
    summary,
    ledger,
    reversed,
    failed,
    reversedCount: reversed.length,
    residualRisk,
    incompleteRetained,
    message: forceResultMessage({ basePath, summary, reversed, failed, residualRisk, incompleteRetained }),
  };
}

function forceUnlinkFailureResult({ basePath, trust, summary, ledger, reversed, failed, residualRisk }) {
  return {
    ok: false,
    action: 'partial-kept-incomplete',
    trust,
    exitCode: 1,
    summary,
    ledger,
    reversed,
    failed,
    reversedCount: reversed.length,
    residualRisk,
    incompleteRetained: true,
    message: [
      summary,
      '',
      `Force-incomplete: reversed ${reversed.length}; failed ${failed.length}; incomplete retained (unlink failed).`,
      `residualRisk: ${residualRisk}`,
      `Recovery ledger: ${recoveryLedgerPath(basePath)}`,
      'Do not hand-edit .atomic-skills/manifest.json.',
    ].join('\n'),
  };
}

function finishForceIncomplete({ basePath, desc, trust, summary, reversed, failed }) {
  const residualRisk = forceResidualRisk(trust, failed);
  // Clear incomplete:
  // - pre-U force: clear after ledger so reinstall is unblocked (residual documented)
  // - post-U: clear only when reverse had zero failures (else keep incomplete)
  const clearIncomplete = trust === JOURNAL_TRUST_PRE_U || failed.length === 0;
  const incompleteRetained = !clearIncomplete;

  const ledger = buildForceLedger({
    basePath,
    desc,
    trust,
    reversed,
    failed,
    residualRisk,
    incompleteRetained,
  });

  // Always write residual ledger BEFORE clearing incomplete so residual risk
  // remains discoverable even if process dies after this point (atomic write).
  writeRecoveryLedger(basePath, ledger);

  if (clearIncomplete && !clearIncompleteManifest(basePath)) {
    return forceUnlinkFailureResult({ basePath, trust, summary, ledger, reversed, failed, residualRisk });
  }

  return buildForceResult({
    basePath,
    action: forceAction(incompleteRetained, failed, residualRisk),
    trust,
    summary,
    ledger,
    reversed,
    failed,
    residualRisk,
    incompleteRetained,
  });
}

function forceIncompleteUninstallLocked(basePath, opts) {
  const desc = describeRecovery(basePath, MANIFEST_DIR);

  if (desc.state === TX_STATE_ABSENT) {
    return forceAbsentResult();
  }

  if (desc.state === TX_STATE_COMPLETE) {
    return forceCompleteResult();
  }

  if (!desc.manifest) {
    return forceUnreadable(basePath, desc);
  }

  const trust = classifyJournalTrust(desc.manifest);
  const summary = formatRecoverySummary(desc, trust);

  maybeInjectFail(opts, 'before-reverse');

  const registry = opts.registry || buildDefaultRegistry();
  const { reversed, failed } = reverseJournaledEffects(basePath, desc.manifest, registry);

  maybeInjectFail(opts, 'after-reverse');

  return finishForceIncomplete({ basePath, desc, trust, summary, reversed, failed });
}

/**
 * uninstall --force-incomplete mutator.
 *
 * Best-effort reverse of **journaled** effects via registry.revert (no
 * assertNoIncomplete). Writes residual recovery ledger (atomic) before clearing
 * the incomplete marker so pre-U unjournaled residual risk stays discoverable.
 *
 * Exit codes:
 * - 0 only when incomplete cleared AND reverse had zero failures
 * - non-zero when incomplete retained, reverse failures, or quarantine failed
 *
 * @param {string} basePath
 * @param {object} [opts]
 * @param {string} [opts.injectFailAfter]
 * @param {object} [opts.registry]
 * @returns {object}
 */
export function forceIncompleteUninstall(basePath, opts = {}) {
  return withSharedRuntimeLocks({ basePath }, () => forceIncompleteUninstallLocked(basePath, opts));
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
