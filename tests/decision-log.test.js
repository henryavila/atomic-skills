import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DECISION_CATEGORIES,
  REQUIRED_DECISION_FIELDS,
  decisionLogPath,
  validateDecisionEntry,
  appendDecision,
  listDecisions,
} from '../src/decision-log.js';

describe('DECISION_CATEGORIES', () => {
  it('includes minimum categories', () => {
    for (const c of [
      'routing',
      'tradeoff',
      'review-disposition',
      'scope-exit',
      'manual-gate-delegation',
      'env',
    ]) {
      assert.ok(DECISION_CATEGORIES.includes(c), `missing category ${c}`);
    }
  });
});

describe('REQUIRED_DECISION_FIELDS', () => {
  it('lists required entry fields', () => {
    for (const f of [
      'id',
      'category',
      'decision',
      'why',
      'evidencePath',
      'impact',
      'at',
    ]) {
      assert.ok(REQUIRED_DECISION_FIELDS.includes(f), `missing field ${f}`);
    }
  });
});

describe('decisionLogPath', () => {
  it('resolves per-phase durable path under plan tree', () => {
    const p = decisionLogPath({
      statusRoot: '/tmp/status',
      projectId: 'atomic-skills',
      planSlug: 'implement-phase-agents',
      phaseId: 'F1',
    });
    assert.equal(
      p,
      join(
        '/tmp/status',
        'projects',
        'atomic-skills',
        'implement-phase-agents',
        'decisions',
        'F1.jsonl',
      ),
    );
  });

  it('rejects path traversal in phaseId', () => {
    assert.throws(
      () =>
        decisionLogPath({
          statusRoot: '/tmp/status',
          projectId: 'p',
          planSlug: 's',
          phaseId: '../evil',
        }),
      /invalid phaseId/,
    );
  });
});

describe('validateDecisionEntry', () => {
  it('accepts a full entry and fills defaults', () => {
    const e = validateDecisionEntry({
      category: 'routing',
      decision: 're-dispatch fix agent',
      why: 'verifier failed post-merge',
      evidencePath: 'reviews/x.md',
      impact: 'task remains open',
    });
    assert.equal(e.category, 'routing');
    assert.equal(e.decision, 're-dispatch fix agent');
    assert.ok(e.id);
    assert.ok(e.at);
    assert.ok(!Number.isNaN(Date.parse(e.at)));
  });

  it('rejects missing category', () => {
    assert.throws(
      () => validateDecisionEntry({ decision: 'x' }),
      /missing category/,
    );
  });

  it('rejects empty decision', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: '   ',
        }),
      /empty or missing decision/,
    );
  });

  it('rejects decisionReview fields (no PASS stamp via append path)', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: 'close',
          decisionReview: { status: 'PASS' },
        }),
      /decision-review PASS|decisionReview/,
    );
  });
});

describe('appendDecision + listDecisions', () => {
  /** @type {string} */
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'decision-log-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('appends a validated entry and lists it for a phase', () => {
    const statusRoot = join(root, '.atomic-skills');
    const result = appendDecision(
      {
        statusRoot,
        projectId: 'atomic-skills',
        planSlug: 'implement-phase-agents',
        phaseId: 'F1',
      },
      {
        category: 'tradeoff',
        decision: 'use JSONL not markdown table',
        why: 'machine-addressable append',
        evidencePath: 'none',
        impact: 'F3 can hardgate on file existence',
        at: '2026-07-22T12:00:00.000Z',
        id: 'dec-1',
      },
    );
    assert.equal(result.ok, true);
    assert.ok(result.path.endsWith(join('decisions', 'F1.jsonl')));
    assert.ok(existsSync(result.path));

    const lines = readFileSync(result.path, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.id, 'dec-1');
    assert.equal(parsed.category, 'tradeoff');
    assert.ok(!('decisionReview' in parsed));

    const listed = listDecisions({
      statusRoot,
      projectId: 'atomic-skills',
      planSlug: 'implement-phase-agents',
      phaseId: 'F1',
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].decision, 'use JSONL not markdown table');
  });

  it('appends multiple entries and filters by category', () => {
    const logPath = join(root, 'F1.jsonl');
    assert.equal(
      appendDecision(logPath, {
        category: 'routing',
        decision: 're-dispatch',
        why: 'fail',
        evidencePath: 'none',
        impact: 'retry',
        id: 'a',
        at: '2026-07-22T12:00:00.000Z',
      }).ok,
      true,
    );
    assert.equal(
      appendDecision(logPath, {
        category: 'scope-exit',
        decision: 'stop on boundary',
        why: 'path outside outputs',
        evidencePath: 'none',
        impact: 'blocked',
        id: 'b',
        at: '2026-07-22T12:01:00.000Z',
      }).ok,
      true,
    );

    const all = listDecisions(logPath);
    assert.equal(all.length, 2);
    const routing = listDecisions(logPath, { category: 'routing' });
    assert.equal(routing.length, 1);
    assert.equal(routing[0].id, 'a');
  });

  it('reject path: empty decision returns ok false', () => {
    const logPath = join(root, 'reject.jsonl');
    const result = appendDecision(logPath, {
      category: 'env',
      decision: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /empty or missing decision/);
    assert.equal(existsSync(logPath), false);
  });

  it('reject path: missing category returns ok false', () => {
    const logPath = join(root, 'reject2.jsonl');
    const result = appendDecision(logPath, {
      decision: 'something',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /missing category/);
  });

  it('listDecisions returns [] for missing file', () => {
    assert.deepEqual(listDecisions(join(root, 'missing.jsonl')), []);
  });

  it('no API stamps decisionReview status PASS', () => {
    const logPath = join(root, 'no-pass.jsonl');
    const blocked = appendDecision(logPath, {
      category: 'routing',
      decision: 'try to pass gate',
      decisionReview: { status: 'PASS' },
    });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error || '', /decision-review PASS|decisionReview/);

    const blocked2 = appendDecision(logPath, {
      category: 'routing',
      decision: 'try status field',
      decisionReviewStatus: 'PASS',
    });
    assert.equal(blocked2.ok, false);

    // Successful append still has no decisionReview key
    const ok = appendDecision(logPath, {
      category: 'routing',
      decision: 'normal entry',
      why: 'ok',
      evidencePath: 'none',
      impact: 'none',
      id: 'ok-1',
      at: '2026-07-22T12:00:00.000Z',
    });
    assert.equal(ok.ok, true);
    assert.equal('decisionReview' in ok.entry, false);
    assert.equal('decisionReviewStatus' in ok.entry, false);
    const disk = JSON.parse(readFileSync(logPath, 'utf8').trim());
    assert.equal('decisionReview' in disk, false);
  });

  it('works with statusRoot string + locator', () => {
    const statusRoot = join(root, '.atomic-skills');
    const r = appendDecision(statusRoot, {
      category: 'env',
      decision: 'use node --test',
      why: 'repo standard',
      evidencePath: 'none',
      impact: 'repro',
      id: 'env-1',
      at: '2026-07-22T13:00:00.000Z',
    }, {
      projectId: 'p',
      planSlug: 'plan-x',
      phaseId: 'F0',
    });
    assert.equal(r.ok, true);
    const listed = listDecisions(statusRoot, {
      projectId: 'p',
      planSlug: 'plan-x',
      phaseId: 'F0',
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'env-1');
  });

  it('skips corrupt JSONL lines on list', () => {
    const logPath = join(root, 'corrupt.jsonl');
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(
      logPath,
      'not-json\n{"id":"good","category":"routing","decision":"ok","why":"","evidencePath":"none","impact":"","at":"2026-07-22T00:00:00.000Z"}\n',
      'utf8',
    );
    const listed = listDecisions(logPath);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'good');
  });
});
