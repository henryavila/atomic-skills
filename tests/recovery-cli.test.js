/**
 * P0-A consumer half — incomplete TX recovery CLI + mutator.
 *
 * post-U engine pin (67dddc3+): incomplete journals stamp
 * transaction.journalMode === 'per-effect' + appliedCount; effects list is
 * the durable applied set (no per-effect flushedAt required).
 * pre-U: incomplete without journalMode — prior-effects-only, refuse silent resume.
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  describeRecovery,
  TX_STATE_INCOMPLETE,
  TX_STATE_COMPLETE,
  assertNoIncompleteTransaction,
  hashContent,
} from '@henryavila/minimalist-installer';

import {
  classifyJournalTrust,
  JOURNAL_TRUST_PRE_U,
  JOURNAL_TRUST_POST_U,
  RECOVERY_LEDGER_FILE,
  RECOVERY_QUARANTINE_PREFIX,
  formatRecoverySummary,
  repairIncompleteInstall,
  forceIncompleteUninstall,
  incompleteOperatorMessage,
  resolveIncompleteRecoveryScope,
  writeRecoveryLedger,
  recoveryLedgerPath,
} from '../src/recovery-cli.js';
import { MANIFEST_DIR } from '../src/manifest.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');
const ROOT = join(__dirname, '..');

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  const originalSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
  process.env.HOME = fakeHome;
  process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
  return Promise.resolve(fn()).finally(() => {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
    if (originalSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = originalSkip;
  });
}

function writeIncompleteManifest(basePath, {
  effects = [],
  transactionExtra = {},
  effectExtras = null,
} = {}) {
  const dir = join(basePath, MANIFEST_DIR);
  mkdirSync(dir, { recursive: true });
  const effectsOut = effectExtras
    ? effects.map((e, i) => ({ ...e, ...(effectExtras[i] || {}) }))
    : effects;
  const manifest = {
    journalVersion: 2,
    version: '2.0.0',
    language: 'en',
    ides: ['codex'],
    effects: effectsOut,
    transaction: {
      id: 'tx-test-1',
      state: 'incomplete',
      startedAt: '2026-07-17T00:00:00.000Z',
      ...transactionExtra,
    },
  };
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

describe('classifyJournalTrust', () => {
  it('defaults incomplete journals without durable markers to pre-U', () => {
    assert.equal(
      classifyJournalTrust({
        effects: [{ type: 'reconcileFileSet', beforeState: [] }],
        transaction: { state: 'incomplete' },
      }),
      JOURNAL_TRUST_PRE_U,
    );
  });

  it('does not trust bare flags without journalMode/applied evidence', () => {
    // Empty effects + journalMode alone → pre-U (forged flags must not clear clean).
    assert.equal(
      classifyJournalTrust({
        effects: [],
        transaction: { state: 'incomplete', journalMode: 'per-effect' },
      }),
      JOURNAL_TRUST_PRE_U,
    );
    assert.equal(
      classifyJournalTrust({
        effects: [],
        transaction: { state: 'incomplete', durablePerEffect: true },
      }),
      JOURNAL_TRUST_PRE_U,
    );
    // Free-form journalTrust alone (no journalMode) → pre-U.
    assert.equal(
      classifyJournalTrust({
        effects: [{ type: 'reconcileFileSet', beforeState: [] }],
        transaction: { state: 'incomplete', journalTrust: 'post-U' },
      }),
      JOURNAL_TRUST_PRE_U,
    );
    // journaledAt alone (no journalMode) is a weak marker → pre-U.
    assert.equal(
      classifyJournalTrust({
        effects: [
          { type: 'reconcileFileSet', beforeState: [], journaledAt: '2026-07-17T00:00:01.000Z' },
        ],
        transaction: { state: 'incomplete' },
      }),
      JOURNAL_TRUST_PRE_U,
    );
    // appliedCount: 0 with journalMode (marker before first apply) → pre-U.
    assert.equal(
      classifyJournalTrust({
        effects: [{ type: 'reconcileFileSet', beforeState: [] }],
        transaction: {
          state: 'incomplete',
          journalMode: 'per-effect',
          appliedCount: 0,
        },
      }),
      JOURNAL_TRUST_PRE_U,
    );
  });

  it('classifies engine pin journalMode per-effect + effects as post-U', () => {
    // Real incomplete journal from pinned engine (67dddc3): journalMode +
    // effects with beforeState, no flushedAt/durable on entries.
    assert.equal(
      classifyJournalTrust({
        effects: [
          { type: 'reconcileFileSet', id: 'reconcileFileSet', beforeState: [] },
        ],
        transaction: {
          state: 'incomplete',
          journalMode: 'per-effect',
          appliedCount: 1,
        },
      }),
      JOURNAL_TRUST_POST_U,
    );
    // journalMode alone + non-empty effects (no appliedCount) → post-U.
    assert.equal(
      classifyJournalTrust({
        effects: [
          { type: 'jsonMerge', beforeState: { path: '.claude/settings.json' } },
        ],
        transaction: { state: 'incomplete', journalMode: 'per-effect' },
      }),
      JOURNAL_TRUST_POST_U,
    );
    // durablePerEffect stamp + effects → post-U.
    assert.equal(
      classifyJournalTrust({
        effects: [{ type: 'reconcileFileSet', beforeState: [] }],
        transaction: { state: 'incomplete', durablePerEffect: true },
      }),
      JOURNAL_TRUST_POST_U,
    );
  });

  it('classifies per-effect flush markers as post-U (supplementary)', () => {
    assert.equal(
      classifyJournalTrust({
        effects: [
          { type: 'reconcileFileSet', beforeState: [], flushedAt: '2026-07-17T00:00:01.000Z' },
          { type: 'jsonMerge', beforeState: {}, durable: true },
        ],
        transaction: { state: 'incomplete' },
      }),
      JOURNAL_TRUST_POST_U,
    );
    // Capability + flush markers still post-U.
    assert.equal(
      classifyJournalTrust({
        effects: [
          { type: 'reconcileFileSet', beforeState: [], flushedAt: '2026-07-17T00:00:01.000Z' },
        ],
        transaction: { state: 'incomplete', journalMode: 'per-effect' },
      }),
      JOURNAL_TRUST_POST_U,
    );
  });

  it('accepts describeRecovery-shaped input (journalMode/durablePerEffect)', () => {
    assert.equal(
      classifyJournalTrust({
        state: 'incomplete',
        reason: 'transaction.state=incomplete',
        journalMode: 'per-effect',
        durablePerEffect: true,
        appliedCount: 1,
        effectCount: 1,
        manifest: {
          effects: [{ type: 'reconcileFileSet', beforeState: [] }],
          transaction: {
            state: 'incomplete',
            journalMode: 'per-effect',
            appliedCount: 1,
          },
        },
      }),
      JOURNAL_TRUST_POST_U,
    );
  });
});

describe('formatRecoverySummary / operator messaging', () => {
  it('includes effectCount, state, reason and never suggests hand-editing JSON', () => {
    const summary = formatRecoverySummary({
      state: TX_STATE_INCOMPLETE,
      effectCount: 2,
      reason: 'transaction.state=incomplete',
      journalVersion: 2,
    }, JOURNAL_TRUST_PRE_U);
    assert.match(summary, /incomplete/i);
    assert.match(summary, /effectCount:\s*2/);
    assert.match(summary, /pre-U|prior-effects/i);
    // Must not recommend hand-editing JSON as the fix (negations like
    // "Do not hand-edit" are fine / required).
    assert.doesNotMatch(summary, /(?:please |you (?:can|should|must) )?edit(?:ing)? (?:the )?.*json.*(?:by hand|manually)/i);
    assert.doesNotMatch(
      incompleteOperatorMessage(JOURNAL_TRUST_PRE_U),
      /(?:please |you (?:can|should|must) )?edit(?:ing)? (?:the )?.*json.*(?:by hand|manually)/i,
    );
    assert.match(incompleteOperatorMessage(JOURNAL_TRUST_PRE_U), /force-incomplete/);
    assert.match(incompleteOperatorMessage(JOURNAL_TRUST_PRE_U), /--repair/);
    assert.match(incompleteOperatorMessage(JOURNAL_TRUST_PRE_U), /[Dd]o not hand-edit/);
  });
});

describe('repairIncompleteInstall (pre-U refuse)', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('prints summary and refuses silent resume for pre-U incomplete journal', () => {
    root = mkdtempSync(join(tmpdir(), 'as-repair-preu-'));
    // Fabricate incomplete + some effects (prior-only journal shape).
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'reconcileFileSet',
          id: 'reconcileFileSet',
          beforeState: [{ path: 'skills/a.md', installedHash: 'abc' }],
        },
      ],
    });
    // Also leave a "partial apply" file that is NOT journaled (pre-U residual).
    mkdirSync(join(root, 'skills'), { recursive: true });
    writeFileSync(join(root, 'skills', 'orphan-partial.md'), 'partial', 'utf8');

    const result = repairIncompleteInstall(root);

    assert.equal(result.action, 'refuse');
    assert.equal(result.trust, JOURNAL_TRUST_PRE_U);
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /effectCount:\s*1/);
    assert.match(result.summary, /incomplete/i);
    assert.match(result.message, /force-incomplete/);
    assert.match(result.message, /[Dd]o not hand-edit/);

    // Must not mark complete or wipe journal on refuse.
    const desc = describeRecovery(root, MANIFEST_DIR);
    assert.equal(desc.state, TX_STATE_INCOMPLETE);
    assert.equal(desc.effectCount, 1);
    assert.equal(existsSync(join(root, 'skills', 'orphan-partial.md')), true);
  });

  it('no-ops when transaction is complete', () => {
    root = mkdtempSync(join(tmpdir(), 'as-repair-complete-'));
    const dir = join(root, MANIFEST_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({
        journalVersion: 2,
        effects: [],
        transaction: { state: 'complete' },
      }),
      'utf8',
    );
    const result = repairIncompleteInstall(root);
    assert.equal(result.action, 'noop');
  });
});

describe('forceIncompleteUninstall', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('reverses journaled reconcileFileSet and writes residual ledger (pre-U)', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-inc-'));
    const skillPath = join(root, 'skills', 'owned.md');
    mkdirSync(join(root, 'skills'), { recursive: true });
    writeFileSync(skillPath, 'owned-content', 'utf8');
    // Unjournaled residual (pre-U crash after apply not flushed).
    writeFileSync(join(root, 'skills', 'unjournaled.md'), 'ghost', 'utf8');

    const ownedHash = hashContent('owned-content');
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'reconcileFileSet',
          id: 'reconcileFileSet',
          beforeState: [{ path: 'skills/owned.md', installedHash: ownedHash }],
        },
      ],
    });

    const result = forceIncompleteUninstall(root);

    assert.equal(result.ok, true);
    assert.equal(result.trust, JOURNAL_TRUST_PRE_U);
    assert.equal(result.reversedCount, 1);
    assert.equal(existsSync(skillPath), false, 'journaled path should be reverted');
    // Residual unjournaled file may remain — ledger must keep risk discoverable.
    assert.equal(existsSync(join(root, 'skills', 'unjournaled.md')), true);

    const ledgerPath = join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
    assert.equal(existsSync(ledgerPath), true, 'residual recovery ledger required');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    assert.equal(ledger.trust, JOURNAL_TRUST_PRE_U);
    assert.equal(ledger.residualRisk, 'unjournaled_applies_possible');
    assert.ok(Array.isArray(ledger.nextSteps));
    assert.ok(ledger.nextSteps.some((s) => /install/i.test(s)));
    assert.ok(ledger.nextSteps.some((s) => /[Dd]o not hand-edit/.test(s)));

    // Incomplete marker cleared only after ledger is written (discoverable residual).
    const desc = describeRecovery(root, MANIFEST_DIR);
    assert.notEqual(desc.state, TX_STATE_INCOMPLETE);
  });

  it('returns non-zero exit when reverse partially fails (retained or residual)', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-fail-'));
    writeIncompleteManifest(root, {
      effects: [
        { type: 'totally-unknown-effect-xyz', id: 'x', beforeState: {} },
      ],
    });

    const result = forceIncompleteUninstall(root);
    // pre-U clears incomplete after ledger, but reverse failures → non-zero.
    assert.equal(result.ok, false);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.failed.length >= 1);
    assert.ok(
      result.action === 'forced-residual' || result.action === 'partial-kept-incomplete',
    );
    const ledger = JSON.parse(
      readFileSync(join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE), 'utf8'),
    );
    assert.ok(ledger.failed.length >= 1);
    // Residual risk still discoverable
    assert.ok(ledger.residualRisk);
  });

  it('post-U partial reverse retains incomplete and exits non-zero', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-postu-partial-'));
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'totally-unknown-effect-xyz',
          id: 'x',
          beforeState: {},
          flushedAt: '2026-07-17T00:00:01.000Z',
        },
      ],
      transactionExtra: { journalMode: 'per-effect' },
    });

    const result = forceIncompleteUninstall(root);
    assert.equal(result.ok, false);
    assert.equal(result.exitCode, 1);
    assert.equal(result.action, 'partial-kept-incomplete');
    assert.equal(result.incompleteRetained, true);
    assert.match(result.message, /RETAINED|not complete|still blocks/i);

    const desc = describeRecovery(root, MANIFEST_DIR);
    assert.equal(desc.state, TX_STATE_INCOMPLETE);
  });

  it('quarantines unreadable incomplete manifest before clear', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-unreadable-'));
    const dir = join(root, MANIFEST_DIR);
    mkdirSync(dir, { recursive: true });
    const raw = '{not-valid-json!!!';
    writeFileSync(join(dir, 'manifest.json'), raw, 'utf8');

    const result = forceIncompleteUninstall(root);
    assert.equal(result.incompleteRetained, false);
    assert.ok(
      result.residualRisk === 'unreadable_manifest_quarantined'
      || result.ledger?.residualRisk === 'unreadable_manifest_quarantined',
    );

    // Raw bytes preserved in quarantine artifact.
    const entries = readdirSync(dir);
    const quarantine = entries.find((n) => n.startsWith(RECOVERY_QUARANTINE_PREFIX));
    assert.ok(quarantine, 'quarantine artifact required');
    assert.equal(readFileSync(join(dir, quarantine), 'utf8'), raw);

    // Ledger present (atomic write) after force.
    assert.equal(existsSync(join(dir, RECOVERY_LEDGER_FILE)), true);

    // Incomplete marker cleared after quarantine.
    const desc = describeRecovery(root, MANIFEST_DIR);
    assert.notEqual(desc.state, TX_STATE_INCOMPLETE);
  });

  it('writes residual ledger atomically (present after force)', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-ledger-atomic-'));
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'reconcileFileSet',
          id: 'reconcileFileSet',
          beforeState: [],
        },
      ],
    });
    const result = forceIncompleteUninstall(root);
    assert.equal(result.exitCode, 0);
    const path = recoveryLedgerPath(root);
    assert.equal(existsSync(path), true);
    // Valid JSON (not truncated).
    const ledger = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(ledger.recoveryAction, 'uninstall --force-incomplete');
    assert.ok(ledger.createdAt);

    // Direct atomic write helper also produces valid JSON.
    writeRecoveryLedger(root, { version: 1, probe: true });
    assert.deepEqual(
      JSON.parse(readFileSync(path, 'utf8')),
      { version: 1, probe: true },
    );
  });
});

describe('mid-repair interrupt leaves no false complete', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('injected fail during force-incomplete does not write transaction complete', () => {
    root = mkdtempSync(join(tmpdir(), 'as-mid-repair-'));
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'reconcileFileSet',
          id: 'reconcileFileSet',
          beforeState: [],
        },
      ],
      transactionExtra: {
        // Mark post-U so repair path attempts reverse (not refuse).
        journalMode: 'per-effect',
      },
      effectExtras: [{ flushedAt: '2026-07-17T00:00:01.000Z' }],
    });

    assert.throws(
      () => repairIncompleteInstall(root, { injectFailAfter: 'classify' }),
      /injected mid-repair failure/i,
    );

    const raw = readFileSync(join(root, MANIFEST_DIR, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    assert.notEqual(manifest.transaction?.state, 'complete');
    assert.equal(manifest.transaction?.state, 'incomplete');
  });

  it('injected fail during force reverse leaves incomplete or residual ledger, not complete', () => {
    root = mkdtempSync(join(tmpdir(), 'as-mid-force-'));
    writeIncompleteManifest(root, {
      effects: [
        {
          type: 'reconcileFileSet',
          id: 'reconcileFileSet',
          beforeState: [],
        },
      ],
    });

    assert.throws(
      () => forceIncompleteUninstall(root, { injectFailAfter: 'before-reverse' }),
      /injected mid-repair failure/i,
    );

    if (existsSync(join(root, MANIFEST_DIR, 'manifest.json'))) {
      const manifest = JSON.parse(
        readFileSync(join(root, MANIFEST_DIR, 'manifest.json'), 'utf8'),
      );
      assert.notEqual(manifest.transaction?.state, 'complete');
    } else {
      // Manifest removed only with residual ledger as discoverability
      assert.equal(
        existsSync(join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE)),
        true,
      );
    }
  });
});

describe('normal install blocked by assertNoIncomplete + repair messaging', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('assertNoIncomplete still blocks when incomplete present', () => {
    root = mkdtempSync(join(tmpdir(), 'as-block-'));
    writeIncompleteManifest(root, { effects: [] });
    assert.throws(
      () => assertNoIncompleteTransaction(root, MANIFEST_DIR),
      (err) => err?.code === 'INCOMPLETE_TRANSACTION',
    );
  });

  it('CLI install --repair on pre-U incomplete refuses and points to force-incomplete', () => {
    root = mkdtempSync(join(tmpdir(), 'as-cli-repair-'));
    return withHome(root, () => {
      writeIncompleteManifest(root, {
        effects: [
          {
            type: 'reconcileFileSet',
            id: 'reconcileFileSet',
            beforeState: [],
          },
        ],
      });

      let err;
      try {
        execFileSync('node', [CLI, 'install', '--repair', '--yes'], {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, HOME: root, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
          cwd: ROOT,
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'install --repair must exit non-zero for pre-U refuse');
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      assert.match(out, /incomplete/i);
      assert.match(out, /effectCount/i);
      assert.match(out, /force-incomplete/);
      assert.match(out, /[Dd]o not hand-edit/);

      // Still incomplete on disk
      const desc = describeRecovery(root, MANIFEST_DIR);
      assert.equal(desc.state, TX_STATE_INCOMPLETE);
    });
  });

  it('CLI normal install when incomplete points to repair flags', () => {
    root = mkdtempSync(join(tmpdir(), 'as-cli-block-'));
    return withHome(root, () => {
      mkdirSync(join(root, '.agents'), { recursive: true });
      writeIncompleteManifest(root, {
        effects: [{ type: 'reconcileFileSet', id: 'reconcileFileSet', beforeState: [] }],
      });

      let err;
      try {
        execFileSync('node', [CLI, 'install', '--yes', '--ide', 'codex', '--lang', 'en'], {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, HOME: root, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
          cwd: ROOT,
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'normal install must fail closed on incomplete');
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      assert.match(out, /incomplete/i);
      assert.match(out, /--repair|force-incomplete/i);
      assert.match(out, /[Dd]o not hand-edit/);
    });
  });

  it('CLI uninstall --force-incomplete writes residual ledger and clears incomplete', () => {
    root = mkdtempSync(join(tmpdir(), 'as-cli-force-'));
    return withHome(root, () => {
      writeIncompleteManifest(root, {
        effects: [
          {
            type: 'reconcileFileSet',
            id: 'reconcileFileSet',
            beforeState: [],
          },
        ],
      });

      const out = execFileSync('node', [CLI, 'uninstall', '--force-incomplete', '--yes'], {
        encoding: 'utf8',
        timeout: 15_000,
        env: { ...process.env, HOME: root, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
        cwd: ROOT,
      });
      assert.match(out, /force-incomplete|residual|recovery/i);
      assert.match(out, /[Dd]o not hand-edit/);
      assert.match(out, /complete/i);

      const ledgerPath = join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
      assert.equal(existsSync(ledgerPath), true);
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      assert.equal(ledger.residualRisk, 'unjournaled_applies_possible');

      const desc = describeRecovery(root, MANIFEST_DIR);
      assert.notEqual(desc.state, TX_STATE_INCOMPLETE);
    });
  });

  it('CLI force-incomplete exits non-zero and does not print complete on reverse failure', () => {
    root = mkdtempSync(join(tmpdir(), 'as-cli-force-fail-'));
    return withHome(root, () => {
      writeIncompleteManifest(root, {
        effects: [
          { type: 'totally-unknown-effect-xyz', id: 'x', beforeState: {} },
        ],
      });

      let err;
      try {
        execFileSync('node', [CLI, 'uninstall', '--force-incomplete', '--yes'], {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, HOME: root, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
          cwd: ROOT,
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'must exit non-zero when reverse fails');
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      assert.match(out, /did not fully recover|failed/i);
      // Must not claim success complete after failure path.
      assert.doesNotMatch(out, /Force-incomplete complete/);
    });
  });
});

describe('resolveIncompleteRecoveryScope (dual-scope routing)', () => {
  let fakeHome;
  let projectRoot;
  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    if (fakeHome) rmSync(fakeHome, { recursive: true, force: true });
    projectRoot = undefined;
    fakeHome = undefined;
  });

  function initGitRepo(dir) {
    mkdirSync(dir, { recursive: true });
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir, stdio: 'ignore' });
    writeFileSync(join(dir, 'README.md'), 'x\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
  }

  it('selects project incomplete when user is complete', () => {
    fakeHome = mkdtempSync(join(tmpdir(), 'as-scope-home-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'as-scope-proj-'));
    initGitRepo(projectRoot);

    return withHome(fakeHome, () => {
      // User: complete install
      const userDir = join(fakeHome, MANIFEST_DIR);
      mkdirSync(userDir, { recursive: true });
      writeFileSync(
        join(userDir, 'manifest.json'),
        JSON.stringify({
          journalVersion: 2,
          effects: [],
          transaction: { state: 'complete' },
        }),
        'utf8',
      );
      // Project: incomplete
      writeIncompleteManifest(projectRoot, {
        effects: [{ type: 'reconcileFileSet', id: 'reconcileFileSet', beforeState: [] }],
      });

      const resolved = resolveIncompleteRecoveryScope({
        projectDir: projectRoot,
        forceProject: false,
        purpose: 'repair',
      });
      assert.equal(resolved.ok, true);
      assert.equal(resolved.scope, 'project');
      // Git resolve uses realpath (macOS /var → /private/var).
      assert.equal(resolved.basePath, realpathSync(projectRoot));
      assert.equal(resolved.incomplete.length, 1);
    });
  });

  it('errors with ambiguity when both user and project are incomplete', () => {
    fakeHome = mkdtempSync(join(tmpdir(), 'as-scope-home2-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'as-scope-proj2-'));
    initGitRepo(projectRoot);

    return withHome(fakeHome, () => {
      writeIncompleteManifest(fakeHome, {
        effects: [{ type: 'reconcileFileSet', id: 'u', beforeState: [] }],
      });
      writeIncompleteManifest(projectRoot, {
        effects: [{ type: 'reconcileFileSet', id: 'p', beforeState: [] }],
      });

      const resolved = resolveIncompleteRecoveryScope({
        projectDir: projectRoot,
        forceProject: false,
        purpose: 'force-incomplete',
      });
      assert.equal(resolved.ok, false);
      assert.equal(resolved.ambiguous, true);
      assert.equal(resolved.exitCode, 1);
      assert.match(resolved.message, /both user and project/i);
      assert.match(resolved.message, /--project/);
    });
  });

  it('CLI install --repair targets project incomplete when user is complete', () => {
    fakeHome = mkdtempSync(join(tmpdir(), 'as-cli-scope-home-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'as-cli-scope-proj-'));
    initGitRepo(projectRoot);

    return withHome(fakeHome, () => {
      const userDir = join(fakeHome, MANIFEST_DIR);
      mkdirSync(userDir, { recursive: true });
      writeFileSync(
        join(userDir, 'manifest.json'),
        JSON.stringify({
          journalVersion: 2,
          effects: [],
          transaction: { state: 'complete' },
        }),
        'utf8',
      );
      writeIncompleteManifest(projectRoot, {
        effects: [{ type: 'reconcileFileSet', id: 'reconcileFileSet', beforeState: [] }],
      });

      // pre-U refuse on project (not user complete no-op)
      let err;
      try {
        execFileSync('node', [CLI, 'install', '--repair', '--yes'], {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, HOME: fakeHome, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
          cwd: projectRoot,
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'must refuse pre-U incomplete on project (non-zero)');
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      assert.match(out, /scope:\s*project/i);
      assert.match(out, /force-incomplete|pre-U|refuse/i);

      // Project still incomplete; user still complete.
      assert.equal(describeRecovery(projectRoot, MANIFEST_DIR).state, TX_STATE_INCOMPLETE);
      assert.equal(describeRecovery(fakeHome, MANIFEST_DIR).state, TX_STATE_COMPLETE);
    });
  });

  it('CLI install --repair errors on dual incomplete without --project', () => {
    fakeHome = mkdtempSync(join(tmpdir(), 'as-cli-ambig-home-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'as-cli-ambig-proj-'));
    initGitRepo(projectRoot);

    return withHome(fakeHome, () => {
      writeIncompleteManifest(fakeHome, {
        effects: [{ type: 'reconcileFileSet', id: 'u', beforeState: [] }],
      });
      writeIncompleteManifest(projectRoot, {
        effects: [{ type: 'reconcileFileSet', id: 'p', beforeState: [] }],
      });

      let err;
      try {
        execFileSync('node', [CLI, 'install', '--repair', '--yes'], {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, HOME: fakeHome, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
          cwd: projectRoot,
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'dual incomplete must be ambiguous');
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      assert.match(out, /both user and project|ambiguous|--project/i);
    });
  });
});

