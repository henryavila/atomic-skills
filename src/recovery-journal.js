/**
 * Journal trust classification and operator-facing recovery text.
 *
 * Split out of `recovery-cli.js` so the trust heuristic (which journals are
 * safe to reverse) and the messages that explain it can be read together and
 * tested without the mutating recovery paths.
 */
import {
  describeRecovery,
  readJournaledEffects,
  TX_STATE_INCOMPLETE,
} from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';

export const JOURNAL_TRUST_PRE_U = 'pre-U';
export const JOURNAL_TRUST_POST_U = 'post-U';

function isRecoveryDescription(value) {
  return value.state != null
    && Object.prototype.hasOwnProperty.call(value, 'manifest');
}

function manifestFrom(manifestOrDesc, isDesc) {
  if (!isDesc) return manifestOrDesc;
  const { manifest } = manifestOrDesc;
  return manifest && typeof manifest === 'object' ? manifest : null;
}

function hasPerEffectCapability(manifest, description) {
  const tx = manifest.transaction || {};
  if (tx.journalMode === 'per-effect' || tx.durablePerEffect === true) {
    return true;
  }
  return Boolean(description) && (
    description.journalMode === 'per-effect'
    || description.durablePerEffect === true
  );
}

function appliedCountFrom(manifest, description) {
  const tx = manifest.transaction || {};
  if (typeof tx.appliedCount === 'number') return tx.appliedCount;
  if (description && typeof description.appliedCount === 'number') {
    return description.appliedCount;
  }
  return null;
}

function allEffectsDurable(effects) {
  return effects.length > 0
    && effects.every((effect) => effect && (effect.flushedAt || effect.durable === true));
}

/**
 * Classify incomplete journal trust for recovery decisions.
 *
 * Accepts a raw manifest **or** a `describeRecovery` /
 * `readJournaledEffects` result (uses nested `.manifest` + top-level
 * `journalMode` / `durablePerEffect` / `appliedCount` when present).
 *
 * Bare `journalTrust: 'post-U'` and weak markers (`journaledAt` alone)
 * stay pre-U. Real engine incomplete journals (journalMode per-effect +
 * effects with beforeState, no flushedAt) classify as post-U.
 *
 * @param {object|null|undefined} manifestOrDesc
 * @returns {'pre-U'|'post-U'}
 */
export function classifyJournalTrust(manifestOrDesc) {
  if (!manifestOrDesc || typeof manifestOrDesc !== 'object') {
    return JOURNAL_TRUST_PRE_U;
  }

  const isDesc = isRecoveryDescription(manifestOrDesc);
  const manifest = manifestFrom(manifestOrDesc, isDesc);
  if (!manifest) return JOURNAL_TRUST_PRE_U;

  const effects = Array.isArray(manifest.effects) ? manifest.effects : [];
  const description = isDesc ? manifestOrDesc : null;

  // appliedCount when present must show at least one applied effect.
  // Engine writes appliedCount: 0 on the incomplete marker before first apply.
  const appliedCount = appliedCountFrom(manifest, description);
  if (appliedCount !== null && appliedCount <= 0) {
    return JOURNAL_TRUST_PRE_U;
  }

  // Pin 67dddc3+: journalMode per-effect + non-empty effects = applied set.
  if (hasPerEffectCapability(manifest, description) && effects.length > 0) {
    return JOURNAL_TRUST_POST_U;
  }

  // Supplementary: flushedAt/durable on every effect (legacy fixtures).
  // journaledAt alone is weak / not flush proof.
  if (allEffectsDurable(effects)) {
    return JOURNAL_TRUST_POST_U;
  }

  return JOURNAL_TRUST_PRE_U;
}

/**
 * Read journaled effects via engine `readJournaledEffects` and classify trust.
 * Convenience for recovery paths that already want the durablePerEffect stamp.
 *
 * @param {string} basePath
 * @param {string} [manifestDir]
 * @returns {{ trust: 'pre-U'|'post-U', journaled: object, desc: object }}
 */
export function classifyJournalTrustAt(basePath, manifestDir = MANIFEST_DIR) {
  const desc = describeRecovery(basePath, manifestDir);
  const journaled = readJournaledEffects(basePath, manifestDir);
  return {
    trust: classifyJournalTrust(desc),
    journaled,
    desc,
  };
}

function recoveryState(desc) {
  return desc?.state ?? 'unknown';
}

function recoveryEffectCount(desc) {
  return desc?.effectCount ?? (desc?.manifest?.effects?.length ?? 0);
}

function recoveryReason(desc, state) {
  return desc?.reason ?? (state === TX_STATE_INCOMPLETE ? 'transaction.state=incomplete' : 'n/a');
}

function recoveryJournalVersion(desc) {
  return desc?.journalVersion ?? desc?.manifest?.journalVersion ?? 'n/a';
}

function recoveryTrustLine(trust) {
  return trust === JOURNAL_TRUST_POST_U
    ? 'journal trust: post-U (per-effect durable / flushed markers present)'
    : 'journal trust: pre-U (prior-effects-only incomplete marker; disk may diverge)';
}

/**
 * Human-readable recovery summary (effectCount, state, reason, trust).
 * @param {object} desc - describeRecovery() result
 * @param {string} trust
 */
export function formatRecoverySummary(desc, trust) {
  const state = recoveryState(desc);

  return [
    `Installer transaction recovery summary:`,
    `  state: ${state}`,
    `  effectCount: ${recoveryEffectCount(desc)}`,
    `  reason: ${recoveryReason(desc, state)}`,
    `  journalVersion: ${recoveryJournalVersion(desc)}`,
    `  ${recoveryTrustLine(trust)}`,
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
    '    → inspect the incomplete journal and (post-U only) reverse-only clear',
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
