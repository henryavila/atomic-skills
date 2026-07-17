/**
 * P0-A consumer half — incomplete TX recovery CLI + mutator.
 *
 * pre-U engine (pinned): incomplete marker journals prior effects only;
 * newly applied effects after crash are not on disk journal.
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
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
  assertNoIncompleteTransaction,
  hashContent,
} from '@henryavila/minimalist-installer';

import {
  classifyJournalTrust,
  JOURNAL_TRUST_PRE_U,
  JOURNAL_TRUST_POST_U,
  RECOVERY_LEDGER_FILE,
  formatRecoverySummary,
  repairIncompleteInstall,
  forceIncompleteUninstall,
  incompleteOperatorMessage,
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

  it('classifies engine trust flags as post-U', () => {
    assert.equal(
      classifyJournalTrust({
        effects: [],
        transaction: { state: 'incomplete', journalMode: 'per-effect' },
      }),
      JOURNAL_TRUST_POST_U,
    );
    assert.equal(
      classifyJournalTrust({
        effects: [],
        transaction: { state: 'incomplete', durablePerEffect: true },
      }),
      JOURNAL_TRUST_POST_U,
    );
  });

  it('classifies per-effect flush markers as post-U', () => {
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

  it('keeps residual ledger when reverse partially fails', () => {
    root = mkdtempSync(join(tmpdir(), 'as-force-fail-'));
    writeIncompleteManifest(root, {
      effects: [
        { type: 'totally-unknown-effect-xyz', id: 'x', beforeState: {} },
      ],
    });

    const result = forceIncompleteUninstall(root);
    assert.equal(result.ok, true);
    assert.ok(result.failed.length >= 1);
    const ledger = JSON.parse(
      readFileSync(join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE), 'utf8'),
    );
    assert.ok(ledger.failed.length >= 1);
    // Residual risk still discoverable
    assert.ok(ledger.residualRisk);
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

      const ledgerPath = join(root, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
      assert.equal(existsSync(ledgerPath), true);
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      assert.equal(ledger.residualRisk, 'unjournaled_applies_possible');

      const desc = describeRecovery(root, MANIFEST_DIR);
      assert.notEqual(desc.state, TX_STATE_INCOMPLETE);
    });
  });
});

