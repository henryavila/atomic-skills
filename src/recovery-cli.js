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
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  copyFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  describeRecovery,
  inspectTransaction,
  readJournaledEffects,
  TX_STATE_ABSENT,
  TX_STATE_COMPLETE,
  TX_STATE_INCOMPLETE,
  removeManifest,
  readEffects,
  atomicWriteJsonNoFollow,
} from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';
import { buildInstaller } from './installer.js';
import { withSharedRuntimeLocks } from './runtime-locks.js';
import { resolveProjectScopeTarget } from './scope.js';

export const JOURNAL_TRUST_PRE_U = 'pre-U';
export const JOURNAL_TRUST_POST_U = 'post-U';
export const RECOVERY_LEDGER_FILE = 'recovery-ledger.json';
export const RECOVERY_QUARANTINE_PREFIX = 'recovery-quarantine-manifest';

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

  // describeRecovery / readJournaledEffects shape: nested manifest + stamps.
  const isDesc = manifestOrDesc.state != null
    && Object.prototype.hasOwnProperty.call(manifestOrDesc, 'manifest');
  const manifest = isDesc
    ? (manifestOrDesc.manifest && typeof manifestOrDesc.manifest === 'object'
      ? manifestOrDesc.manifest
      : null)
    : manifestOrDesc;
  if (!manifest) return JOURNAL_TRUST_PRE_U;

  const tx = manifest.transaction || {};
  const effects = Array.isArray(manifest.effects) ? manifest.effects : [];

  // Capability: engine transaction stamp OR describeRecovery fields.
  // Not free-form journalTrust boolean.
  const capability =
    tx.journalMode === 'per-effect'
    || tx.durablePerEffect === true
    || (isDesc && (
      manifestOrDesc.journalMode === 'per-effect'
      || manifestOrDesc.durablePerEffect === true
    ));

  // appliedCount when present must show at least one applied effect.
  // Engine writes appliedCount: 0 on the incomplete marker before first apply.
  const appliedCount = typeof tx.appliedCount === 'number'
    ? tx.appliedCount
    : (isDesc && typeof manifestOrDesc.appliedCount === 'number'
      ? manifestOrDesc.appliedCount
      : null);
  if (appliedCount !== null && appliedCount <= 0) {
    return JOURNAL_TRUST_PRE_U;
  }

  // Pin 67dddc3+: journalMode per-effect + non-empty effects = applied set.
  if (capability && effects.length > 0) {
    return JOURNAL_TRUST_POST_U;
  }

  // Supplementary: flushedAt/durable on every effect (legacy fixtures).
  // journaledAt alone is weak / not flush proof.
  const allEffectsDurable =
    effects.length > 0
    && effects.every((e) => e && (e.flushedAt || e.durable === true));
  if (allEffectsDurable) {
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

/**
 * @param {string} basePath
 * @returns {string}
 */
export function recoveryLedgerPath(basePath) {
  return join(basePath, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
}

/**
 * Atomic residual ledger write (tmp+rename / no-follow) before clearing incomplete.
 * @param {string} basePath
 * @param {object} ledger
 */
export function writeRecoveryLedger(basePath, ledger) {
  const dir = join(basePath, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Engine atomic write: same-dir temp + fsync + rename, no symlink follow.
  atomicWriteJsonNoFollow(basePath, `${MANIFEST_DIR}/${RECOVERY_LEDGER_FILE}`, ledger);
  return recoveryLedgerPath(basePath);
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

/**
 * Quarantine raw incomplete manifest bytes before any unlink.
 * @param {string} basePath
 * @returns {{ ok: boolean, path?: string, error?: string, bytes?: number }}
 */
export function quarantineIncompleteManifest(basePath) {
  const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { ok: false, error: 'manifest missing' };
  }
  const dir = join(basePath, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rel = `${MANIFEST_DIR}/${RECOVERY_QUARANTINE_PREFIX}-${stamp}.raw`;
  const dest = join(basePath, MANIFEST_DIR, `${RECOVERY_QUARANTINE_PREFIX}-${stamp}.raw`);
  try {
    // Prefer byte-copy of raw file (may be invalid JSON).
    copyFileSync(manifestPath, dest);
    const bytes = readFileSync(dest).length;
    return { ok: true, path: dest, relativePath: rel, bytes };
  } catch (err) {
    // Fallback: try read+write if copy fails.
    try {
      const raw = readFileSync(manifestPath);
      writeFileSync(dest, raw);
      return { ok: true, path: dest, relativePath: rel, bytes: raw.length };
    } catch (err2) {
      return { ok: false, error: err2?.message || err?.message || String(err2) };
    }
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
 * Scan candidate scopes (user + project if resolvable) for incomplete TXs.
 *
 * Routing rules (P0-A):
 * - exactly one incomplete → use it
 * - both incomplete → require --project or error with ambiguity
 * - none incomplete → clear message
 * - explicit --project → always target project (even if complete/absent)
 *
 * @param {object} opts
 * @param {string} [opts.projectDir] - cwd used to resolve project git root
 * @param {boolean} [opts.forceProject] - --project flag
 * @param {'repair'|'force-incomplete'} [opts.purpose]
 * @returns {object}
 */
export function resolveIncompleteRecoveryScope(opts = {}) {
  const { projectDir = process.cwd(), forceProject = false, purpose = 'repair' } = opts;
  const userBase = homedir();
  const projectTarget = resolveProjectScopeTarget(projectDir);
  const projectBase = projectTarget.ok ? projectTarget.path : null;

  // Tolerant inspect (describeRecovery) — never JSON.parse-throw on corrupt manifests.
  const userDesc = describeRecovery(userBase, MANIFEST_DIR);
  const projectDesc = projectBase ? describeRecovery(projectBase, MANIFEST_DIR) : null;

  /** @type {Array<{scope: string, basePath: string, desc: object}>} */
  const incomplete = [];
  if (userDesc.state === TX_STATE_INCOMPLETE) {
    incomplete.push({ scope: 'user', basePath: userBase, desc: userDesc });
  }
  if (projectDesc && projectDesc.state === TX_STATE_INCOMPLETE) {
    incomplete.push({ scope: 'project', basePath: projectBase, desc: projectDesc });
  }

  if (forceProject) {
    if (!projectBase) {
      return {
        ok: false,
        exitCode: 1,
        action: 'scope-error',
        message: projectTarget.reason || 'Project scope is not available.',
        incomplete,
      };
    }
    return {
      ok: true,
      scope: 'project',
      basePath: projectBase,
      explicit: true,
      incomplete,
      userDesc,
      projectDesc,
    };
  }

  if (incomplete.length === 1) {
    return {
      ok: true,
      scope: incomplete[0].scope,
      basePath: incomplete[0].basePath,
      incomplete,
      userDesc,
      projectDesc,
    };
  }

  if (incomplete.length > 1) {
    return {
      ok: false,
      exitCode: 1,
      action: 'ambiguous-incomplete',
      ambiguous: true,
      incomplete,
      userDesc,
      projectDesc,
      message: [
        'Incomplete installer transactions found in both user and project scopes.',
        `  user:    ${userBase}`,
        `  project: ${projectBase}`,
        'Re-run with --project to target the project scope.',
        'To target the user scope, clear the project incomplete first (or run',
        'from a directory outside that project after fixing project).',
        'Do not hand-edit .atomic-skills/manifest.json.',
      ].join('\n'),
    };
  }

  // None incomplete — still allow explicit routing callers to inspect bases.
  const noneMessage = purpose === 'force-incomplete'
    ? 'No incomplete installer transaction found in user or project scope.'
    : 'No incomplete installer transaction found in user or project scope — nothing to repair.';

  return {
    ok: false,
    exitCode: 0,
    action: 'none-incomplete',
    none: true,
    incomplete,
    userDesc,
    projectDesc,
    // Prefer user base for noop messaging when nothing incomplete.
    basePath: userBase,
    scope: 'user',
    message: noneMessage,
  };
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

    // Unreadable / invalid JSON incomplete: refuse silent reverse of empty effects.
    if (!desc.manifest) {
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

    // post-U path (strategy b reverse-only): reverse journaled effects, clear incomplete.
    // Do NOT mark complete on a partial tree — only remove incomplete after reverse.
    // Do NOT auto-reinstall — operator re-runs install with IDE selection.
    maybeInjectFail(opts, 'before-reverse');

    const registry = opts.registry || buildDefaultRegistry();
    const { reversed, failed } = reverseJournaledEffects(basePath, desc.manifest, registry);

    maybeInjectFail(opts, 'after-reverse');

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
    writeRecoveryLedger(basePath, ledger);

    if (!incompleteRetained) {
      // Asserted reverse succeeded: remove incomplete only. Residual ledger remains.
      removeManifest(basePath, MANIFEST_DIR);
      // removeManifest may rmdir when empty — rewrite ledger if wiped.
      if (!existsSync(recoveryLedgerPath(basePath))) {
        writeRecoveryLedger(basePath, ledger);
      }
    }
    // If reverse failed partially: keep incomplete marker (do not write complete).

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
      message: !incompleteRetained
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
          ].join('\n'),
    };
  });
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

    // Unreadable / invalid JSON: quarantine raw bytes before any clear; never
    // treat as empty effects and silently delete the only recovery artifact.
    if (!desc.manifest) {
      const quarantine = quarantineIncompleteManifest(basePath);
      if (!quarantine.ok) {
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

      const residualRisk = 'unreadable_manifest_quarantined';
      const ledger = {
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
      writeRecoveryLedger(basePath, ledger);

      try {
        const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
        if (existsSync(manifestPath)) unlinkSync(manifestPath);
      } catch {
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

    const trust = classifyJournalTrust(desc.manifest);
    const summary = formatRecoverySummary(desc, trust);

    maybeInjectFail(opts, 'before-reverse');

    const registry = opts.registry || buildDefaultRegistry();
    const { reversed, failed } = reverseJournaledEffects(basePath, desc.manifest, registry);

    maybeInjectFail(opts, 'after-reverse');

    // pre-U always risks unjournaled applies; also surface reverse failures.
    let residualRisk;
    if (trust === JOURNAL_TRUST_PRE_U) {
      residualRisk = failed.length > 0
        ? 'partial_reverse_and_unjournaled_applies_possible'
        : 'unjournaled_applies_possible';
    } else {
      residualRisk = failed.length > 0 ? 'partial_reverse' : 'unverified';
    }

    // Clear incomplete:
    // - pre-U force: clear after ledger so reinstall is unblocked (residual documented)
    // - post-U: clear only when reverse had zero failures (else keep incomplete)
    const clearIncomplete = trust === JOURNAL_TRUST_PRE_U || failed.length === 0;
    const incompleteRetained = !clearIncomplete;

    const ledger = {
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
      nextSteps: [
        'Do not hand-edit .atomic-skills/manifest.json.',
        incompleteRetained
          ? 'Incomplete marker retained — install/uninstall still blocked until reverse succeeds.'
          : residualRisk.includes('unjournaled')
            ? 'Inspect install roots for leftover skill/hook files; remove manually if desired, then reinstall.'
            : 'Journaled reverse finished; reinstall if needed.',
        incompleteRetained
          ? 'Retry: npx @henryavila/atomic-skills uninstall --force-incomplete'
          : 'Reinstall: npx @henryavila/atomic-skills install --yes ...',
      ],
    };

    // Always write residual ledger BEFORE clearing incomplete so residual risk
    // remains discoverable even if process dies after this point (atomic write).
    writeRecoveryLedger(basePath, ledger);

    if (clearIncomplete) {
      try {
        // Only remove manifest.json; preserve recovery ledger.
        const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
        if (existsSync(manifestPath)) unlinkSync(manifestPath);
      } catch {
        // If unlink fails, leave incomplete — ledger already written.
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
    }

    // Honest exit: non-zero when reverse failed or incomplete retained.
    const exitCode = failed.length > 0 || incompleteRetained ? 1 : 0;
    let action;
    if (incompleteRetained) action = 'partial-kept-incomplete';
    else if (failed.length > 0) action = 'forced-residual';
    else if (residualRisk.includes('unjournaled')) action = 'forced-residual';
    else action = 'forced-clean';

    const mayReinstall = !incompleteRetained;
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
      message: [
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
