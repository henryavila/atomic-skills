import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  phaseReviewHonesty,
  phaseReviewAllowsClose,
  isDurableAutomateForPhaseReview,
  dualLegReceiptPaths,
  receiptContentAuthenticity,
  phaseReviewAuthenticity,
  PHASE_REVIEW_RECEIPT_MIN_BYTES,
  REVIEW_EXTERNAL_CLIS,
  hostCliName,
  isValidReviewExternalCli,
  resolveReviewExternalCli,
  upsertPlanReviewExternalCli,
  parseExternalReviewReceipt,
  externalReviewReceiptHonesty,
  formatExternalReviewReceipt,
  buildPhaseReviewBrief,
  runExternalReviewCli,
} from '../src/phase-review-gate.js';

/** Dual non-stub body (≥ min bytes, multi-line CLEAN or findings). */
const GOOD_LOCAL = [
  '# Local review',
  '',
  'Verdict: CLEAN',
  '',
  'No findings on the phase range. Cross-check complete.',
  'Scope: src/phase-review-gate.js tests/phase-review-gate.test.js',
].join('\n');

const GOOD_CODEX = [
  '# Codex review',
  '',
  'Findings: none major',
  '',
  'Reviewed dual-leg authenticity floor. Residual notes only.',
  'Files: phase-review-gate authenticity dual-leg non-binary stub floor.',
].join('\n');

assert.ok(Buffer.byteLength(GOOD_LOCAL, 'utf8') >= PHASE_REVIEW_RECEIPT_MIN_BYTES);
assert.ok(Buffer.byteLength(GOOD_CODEX, 'utf8') >= PHASE_REVIEW_RECEIPT_MIN_BYTES);

const bothGate = {
  status: 'passed',
  mode: 'both',
  at: 'a'.repeat(40),
  reviewFile: '.atomic-skills/reviews/f0-both.md',
  localReceiptPath: '.atomic-skills/reviews/f0-local.md',
  codexReceiptPath: '.atomic-skills/reviews/f0-codex.md',
};

const receiptContents = {
  [bothGate.localReceiptPath]: GOOD_LOCAL,
  [bothGate.codexReceiptPath]: GOOD_CODEX,
  [bothGate.reviewFile]: GOOD_LOCAL + '\n\n' + GOOD_CODEX,
};

describe('isDurableAutomateForPhaseReview', () => {
  it('true under stamp', () => {
    assert.equal(isDurableAutomateForPhaseReview({}), false);
    assert.equal(
      isDurableAutomateForPhaseReview({ planExecutionMode: 'automate' }),
      true,
    );
  });
});

describe('dualLegReceiptPaths', () => {
  it('collects local + codex paths', () => {
    const d = dualLegReceiptPaths(bothGate);
    assert.ok(d.paths.length >= 2);
    assert.ok(d.paths.includes(bothGate.localReceiptPath));
    assert.ok(d.paths.includes(bothGate.codexReceiptPath));
  });

  it('collects legs[] paths', () => {
    const d = dualLegReceiptPaths({
      legs: [
        { provider: 'local', receiptPath: 'reviews/a.md' },
        { provider: 'codex', path: 'reviews/b.md' },
      ],
    });
    assert.deepEqual(d.paths, ['reviews/a.md', 'reviews/b.md']);
  });
});

describe('receiptContentAuthenticity', () => {
  it('rejects one-line stub', () => {
    const r = receiptContentAuthenticity('CLEAN\n', { label: 'codex' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line/i);
  });

  it('rejects null-byte / binary', () => {
    const r = receiptContentAuthenticity(Buffer.from([0x00, 0x01, 0x02, 0x03]), {
      label: 'local',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /binary|null-byte|non-binary/i);
  });

  it('rejects short multi-line without floor', () => {
    const r = receiptContentAuthenticity('ok\nyes\n', { label: 'local' });
    assert.equal(r.ok, false);
  });

  it('accepts dual non-stub CLEAN body', () => {
    assert.equal(receiptContentAuthenticity(GOOD_LOCAL, { label: 'local' }).ok, true);
  });

  it('accepts findings-style body', () => {
    assert.equal(receiptContentAuthenticity(GOOD_CODEX, { label: 'codex' }).ok, true);
  });
});

describe('phaseReviewHonesty', () => {
  it('rejects missing gate', () => {
    assert.equal(phaseReviewHonesty(null).ok, false);
  });

  it('accepts both with at + reviewFile + dual-leg paths', () => {
    assert.equal(phaseReviewHonesty(bothGate).ok, true);
  });

  it('rejects mode both with only single reviewFile (no dual-leg)', () => {
    const r = phaseReviewHonesty({
      status: 'passed',
      mode: 'both',
      at: 'a'.repeat(40),
      reviewFile: '.atomic-skills/reviews/f0-both.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /dual-leg|dual receipt/i);
  });

  it('rejects local without overrideReason', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
      }).ok,
      false,
    );
  });

  it('accepts local with overrideReason + at + reviewFile + process stderr', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
        overrideReason: 'operator explicit downgrade for dogfood range',
        externalStderr: 'provider exploded: quota',
      }).ok,
      true,
    );
  });

  it('rejects local with plain reason only (no overrideReason fig leaf)', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
        reason: 'explicit local override for dogfood',
      }).ok,
      false,
    );
  });

  it('rejects skipped without operatorSkip', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'skipped',
        reason: 'time pressure',
      }).ok,
      false,
    );
  });

  it('accepts skipped with operatorSkip + reason', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'skipped',
        operatorSkip: true,
        reason: 'operator accepted skip of phase review',
      }).ok,
      true,
    );
  });

  it('rejects both without reviewFile', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'both',
        at: 'a'.repeat(40),
        localReceiptPath: 'a.md',
        codexReceiptPath: 'b.md',
      }).ok,
      false,
    );
  });
});

describe('phaseReviewAuthenticity + phaseReviewAllowsClose', () => {
  it('rejects one-line stub codex under mode both', () => {
    const r = phaseReviewAuthenticity(bothGate, {
      receiptContents: {
        [bothGate.localReceiptPath]: GOOD_LOCAL,
        [bothGate.codexReceiptPath]: 'CLEAN\n',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line|codex/i);
  });

  it('rejects binary/null-byte receipt content', () => {
    const r = phaseReviewAuthenticity(bothGate, {
      receiptContents: {
        [bothGate.localReceiptPath]: Buffer.from('good\n'.repeat(20) + '\0bad'),
        [bothGate.codexReceiptPath]: GOOD_CODEX,
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /binary|null-byte|non-binary/i);
  });

  it('accepts dual non-stub with min size and CLEAN or findings', () => {
    const r = phaseReviewAuthenticity(bothGate, { receiptContents });
    assert.equal(r.ok, true, r.reason);
  });

  it('inactive non-automate', () => {
    assert.equal(phaseReviewAllowsClose({}).ok, true);
  });

  it('blocks under stamp without gate', () => {
    assert.equal(
      phaseReviewAllowsClose({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('allows under stamp with dual-leg both gate (shape)', () => {
    assert.equal(
      phaseReviewAllowsClose({
        planExecutionMode: 'automate',
        reviewGate: bothGate,
      }).ok,
      true,
    );
  });

  it('rejects stub when checkAuthenticity content injected under mode both', () => {
    const r = phaseReviewAllowsClose({
      planExecutionMode: 'automate',
      reviewGate: bothGate,
      receiptContents: {
        [bothGate.localReceiptPath]: 'CLEAN\n',
        [bothGate.codexReceiptPath]: 'CLEAN\n',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line|authenticity/i);
  });

  it('accepts dual authentic content under automate', () => {
    const r = phaseReviewAllowsClose({
      planExecutionMode: 'automate',
      reviewGate: bothGate,
      receiptContents,
    });
    assert.equal(r.ok, true, r.reason);
  });
});

const PLAN_SCHEMA = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../meta/schemas/plan.schema.json'),
    'utf8',
  ),
);

describe('reviewExternalCli (F4 T-001)', () => {
  it('schema enumerates claude|codex|grok on the plan', () => {
    const field = PLAN_SCHEMA.properties.reviewExternalCli;
    assert.ok(field, 'reviewExternalCli missing from plan.schema.json');
    assert.deepEqual(field.enum, ['claude', 'codex', 'grok']);
    assert.deepEqual([...REVIEW_EXTERNAL_CLIS], ['claude', 'codex', 'grok']);
  });

  it('maps open host to CLI name and refuses the same-family external', () => {
    assert.equal(hostCliName('claude-code'), 'claude');
    assert.equal(hostCliName('codex'), 'codex');
    assert.equal(hostCliName('grok'), 'grok');
    assert.equal(isValidReviewExternalCli('codex', 'grok').ok, true);
    assert.equal(isValidReviewExternalCli('claude', 'grok').ok, true);
    const same = isValidReviewExternalCli('grok', 'grok');
    assert.equal(same.ok, false);
    assert.match(same.reason || '', /open host|same|must not equal/i);
    const claudeSame = isValidReviewExternalCli('claude', 'claude-code');
    assert.equal(claudeSame.ok, false);
  });

  it('stores reviewExternalCli on the plan before the first phase and is not asked again', () => {
    let asks = 0;
    const first = resolveReviewExternalCli({
      openHost: 'codex',
      planText: '---\nslug: demo\n---\n',
      ask: () => {
        asks += 1;
        return 'grok';
      },
    });
    assert.equal(first.ok, true, first.reason);
    assert.equal(first.cli, 'grok');
    assert.equal(first.asked, true);
    assert.equal(asks, 1);
    const stored = upsertPlanReviewExternalCli(first.planText, first.cli);
    assert.match(stored, /reviewExternalCli:\s*grok/);

    const second = resolveReviewExternalCli({
      openHost: 'codex',
      planText: stored,
      ask: () => {
        asks += 1;
        return 'claude';
      },
    });
    assert.equal(second.ok, true, second.reason);
    assert.equal(second.cli, 'grok');
    assert.equal(second.asked, false);
    assert.equal(asks, 1);
  });

  it('does not ask mid-run when the plan already has reviewExternalCli', () => {
    let asks = 0;
    const r = resolveReviewExternalCli({
      openHost: 'claude-code',
      planReviewExternalCli: 'codex',
      ask: () => {
        asks += 1;
        return 'grok';
      },
    });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.cli, 'codex');
    assert.equal(asks, 0);
  });
});

describe('external review receipt (F4 T-001)', () => {
  it('receipt records command, exit, stderr, and verdict', () => {
    const line = formatExternalReviewReceipt({
      cli: 'grok',
      command: 'grok review --mode=code',
      exit: 0,
      stderr: '',
      verdict: 'PASSED',
    });
    const parsed = parseExternalReviewReceipt(line);
    assert.equal(parsed.ok, true, parsed.reason);
    assert.equal(parsed.command, 'grok review --mode=code');
    assert.equal(parsed.exit, 0);
    assert.equal(parsed.stderr, '');
    assert.equal(parsed.verdict, 'PASSED');
  });

  it('a receipt written by the session / - internal: line fails', () => {
    const r = parseExternalReviewReceipt(
      '- internal: zero findings @ abcdef0 (2026-10-02T00:00:00Z)',
    );
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /internal|session/i);
    const honesty = externalReviewReceiptHonesty({
      reviewFile: '.atomic-skills/reviews/f0.md',
      body: '- internal: session wrote this instead of spawning the CLI\n',
    });
    assert.equal(honesty.ok, false);
    assert.match(honesty.reason || '', /internal|session/i);
  });

  it('output without a verdict does not count', () => {
    const r = parseExternalReviewReceipt(
      '- grok: command=grok review | exit=0 | stderr=',
    );
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /verdict/i);
  });

  it('non-zero exit stores real stderr', () => {
    const ran = runExternalReviewCli({
      cli: 'grok',
      argv: ['review', '--mode=code'],
      spawn: () => ({
        status: 2,
        stdout: 'no verdict here',
        stderr: 'provider exploded: quota',
      }),
    });
    assert.equal(ran.exit, 2);
    assert.equal(ran.stderr, 'provider exploded: quota');
    assert.match(ran.receipt, /stderr=provider exploded: quota/);
    const parsed = parseExternalReviewReceipt(ran.receipt);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.exit, 2);
    assert.equal(parsed.stderr, 'provider exploded: quota');
  });

  it('overrideReason without stderr of that external CLI process fails', () => {
    const missing = externalReviewReceiptHonesty({
      overrideReason: 'operator accepted local-only residual',
    });
    assert.equal(missing.ok, false);
    assert.match(missing.reason || '', /stderr/i);

    const empty = externalReviewReceiptHonesty({
      overrideReason: 'operator accepted local-only residual',
      externalStderr: '   ',
    });
    assert.equal(empty.ok, false);
    assert.match(empty.reason || '', /stderr/i);

    const ok = externalReviewReceiptHonesty({
      overrideReason: 'operator accepted local-only residual',
      externalStderr: 'provider exploded: quota',
      command: 'grok review --mode=code',
      exit: 2,
      verdict: 'FAILED',
    });
    assert.equal(ok.ok, true, ok.reason);

    const local = phaseReviewHonesty({
      status: 'passed',
      mode: 'local',
      at: 'a'.repeat(40),
      reviewFile: '.atomic-skills/reviews/f0.md',
      overrideReason: 'operator explicit downgrade',
    });
    assert.equal(local.ok, false);
    assert.match(local.reason || '', /stderr/i);
  });

  it('spawns the CLI, waits, and writes command/exit/stderr/verdict', async () => {
    let spawned = 0;
    const ran = await runExternalReviewCli({
      cli: 'claude',
      argv: ['review', '--print'],
      spawn: (bin, argv) => {
        spawned += 1;
        assert.equal(bin, 'claude');
        assert.deepEqual(argv, ['review', '--print']);
        return { status: 0, stdout: 'Verdict: PASSED\n', stderr: '' };
      },
    });
    assert.equal(spawned, 1);
    assert.equal(ran.exit, 0);
    assert.equal(ran.verdict, 'PASSED');
    const parsed = parseExternalReviewReceipt(ran.receipt);
    assert.equal(parsed.ok, true, parsed.reason);
    assert.equal(parsed.command, 'claude review --print');
  });
});

describe('automate-run review CLI wiring (F4 T-001)', () => {
  it('prepareReviewExternalCli stores env CLI once and runPhaseReviewBoth waits', async () => {
    const { prepareReviewExternalCli, runPhaseReviewBoth } = await import(
      '../scripts/automate-run.js'
    );
    /** @type {string} */
    let written = '---\nslug: demo\n---\n';
    const prepared = prepareReviewExternalCli({
      planPath: 'plan.md',
      host: 'codex',
      env: { AUTOMATE_REVIEW_EXTERNAL_CLI: 'grok' },
      readPlan: () => written,
      writePlan: (_path, text) => {
        written = text;
      },
    });
    assert.equal(prepared.ok, true, prepared.reason);
    assert.equal(prepared.cli, 'grok');
    assert.match(written, /reviewExternalCli:\s*grok/);

    let asks = 0;
    const again = prepareReviewExternalCli({
      planPath: 'plan.md',
      host: 'codex',
      env: {},
      ask: () => {
        asks += 1;
        return 'claude';
      },
      readPlan: () => written,
      writePlan: (_path, text) => {
        written = text;
      },
    });
    assert.equal(again.cli, 'grok');
    assert.equal(asks, 0);

    let spawned = 0;
    const ran = runPhaseReviewBoth({
      cli: 'grok',
      argv: ['review', '--print'],
      flowGraph: { entry: 'S1' },
      architectureSketch: { id: 'nada-fora', mix: 'não mistura' },
      complexTasks: [{ id: 'T-009' }],
      spawn: (bin, argv) => {
        spawned += 1;
        assert.equal(bin, 'grok');
        assert.deepEqual(argv, ['review', '--print']);
        return { status: 0, stdout: 'Verdict: PASSED\n', stderr: '' };
      },
    });
    assert.equal(spawned, 1);
    assert.equal(ran.verdict, 'PASSED');
    assert.match(ran.receipt, /command=grok review --print/);
  });
});

describe('phase review brief (F4 T-001)', () => {
  it('includes the ratified flow graph and the chosen architecture sketch', () => {
    const brief = buildPhaseReviewBrief({
      flowGraph: { entry: 'S1', nodes: { S1: { type: 'activity', next: 'D1' } } },
      architectureSketch: { id: 'nada-fora', mix: 'não mistura', outside: [] },
      complexTasks: [{ id: 'T-009', title: 'complex close' }],
    });
    assert.match(brief, /S1/);
    assert.match(brief, /nada-fora|n[aã]o mistura/);
    assert.match(brief, /T-009/);
  });

  it('complex tasks enter this same review before phase close', () => {
    const brief = buildPhaseReviewBrief({
      flowGraph: { entry: 'S1', nodes: {} },
      architectureSketch: { id: 'chosen' },
      complexTasks: [{ id: 'T-010', weight: 5, title: 'drop table' }],
    });
    assert.match(brief, /T-010/);
    assert.match(brief, /complex/i);
  });
});
