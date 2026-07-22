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

/** Minimal valid entry body (required why/impact non-empty). */
function baseEntry(overrides = {}) {
  return {
    category: 'routing',
    decision: 're-dispatch fix agent',
    why: 'verifier failed post-merge',
    impact: 'task remains open',
    ...overrides,
  };
}

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

  it('rejects projectId traversal', () => {
    assert.throws(
      () =>
        decisionLogPath({
          statusRoot: '/tmp/status',
          projectId: '../evil',
          planSlug: 's',
          phaseId: 'F1',
        }),
      /invalid projectId/,
    );
  });

  it('rejects planSlug traversal', () => {
    assert.throws(
      () =>
        decisionLogPath({
          statusRoot: '/tmp/status',
          projectId: 'p',
          planSlug: 'foo/bar',
          phaseId: 'F1',
        }),
      /invalid planSlug/,
    );
  });

  it('rejects non-allowlist characters in segments', () => {
    assert.throws(
      () =>
        decisionLogPath({
          statusRoot: '/tmp/status',
          projectId: 'p',
          planSlug: 'plan slug',
          phaseId: 'F1',
        }),
      /invalid planSlug/,
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
    assert.equal(e.why, 'verifier failed post-merge');
    assert.equal(e.impact, 'task remains open');
    assert.equal(e.evidencePath, 'reviews/x.md');
    assert.ok(e.id);
    assert.ok(e.at);
    assert.ok(!Number.isNaN(Date.parse(e.at)));
  });

  it('defaults evidencePath to none only when omitted', () => {
    const e = validateDecisionEntry(baseEntry());
    assert.equal(e.evidencePath, 'none');
  });

  it('rejects null evidencePath when property is present', () => {
    assert.throws(
      () => validateDecisionEntry(baseEntry({ evidencePath: null })),
      /evidencePath empty/,
    );
  });

  it('rejects empty provided evidencePath', () => {
    assert.throws(
      () => validateDecisionEntry(baseEntry({ evidencePath: '   ' })),
      /evidencePath empty/,
    );
  });

  it('rejects missing category', () => {
    assert.throws(
      () => validateDecisionEntry({ decision: 'x', why: 'y', impact: 'z' }),
      /missing category/,
    );
  });

  it('rejects empty decision', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: '   ',
          why: 'reason',
          impact: 'impact',
        }),
      /empty or missing decision/,
    );
  });

  it('rejects empty or missing why', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: 'x',
          why: '  ',
          impact: 'impact',
        }),
      /empty or missing why/,
    );
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: 'x',
          impact: 'impact',
        }),
      /empty or missing why/,
    );
  });

  it('rejects empty or missing impact', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: 'x',
          why: 'reason',
          impact: '',
        }),
      /empty or missing impact/,
    );
  });

  it('rejects invalid provided at (no silent replace)', () => {
    assert.throws(
      () =>
        validateDecisionEntry(
          baseEntry({ at: 'not-a-timestamp' }),
        ),
      /at must be a valid ISO timestamp/,
    );
  });

  it('rejects null at when property is present', () => {
    assert.throws(
      () => validateDecisionEntry(baseEntry({ at: null })),
      /at must be a valid ISO timestamp/,
    );
  });

  it('rejects Date.parse false-positive at values like "0"', () => {
    assert.throws(
      () => validateDecisionEntry(baseEntry({ at: '0' })),
      /at must be a valid ISO timestamp/,
    );
  });

  it('accepts ISO date-only and datetime at values', () => {
    const dateOnly = validateDecisionEntry(
      baseEntry({ at: '2026-07-22' }),
    );
    assert.equal(dateOnly.at, '2026-07-22');
    const withT = validateDecisionEntry(
      baseEntry({ at: '2026-07-22T12:00:00.000Z' }),
    );
    assert.equal(withT.at, '2026-07-22T12:00:00.000Z');
  });

  it('defaults at only when property is absent', () => {
    const e = validateDecisionEntry(baseEntry());
    assert.ok(e.at);
    assert.ok(!Number.isNaN(Date.parse(e.at)));
    assert.match(e.at, /T|^\d{4}-\d{2}-\d{2}/);
  });

  it('rejects decisionReview fields (no PASS stamp via append path)', () => {
    assert.throws(
      () =>
        validateDecisionEntry({
          category: 'routing',
          decision: 'close',
          why: 'x',
          impact: 'y',
          decisionReview: { status: 'PASS' },
        }),
      /decision-review PASS|decisionReview/,
    );
  });

  it('rejects high-signal secret shapes in decision text', () => {
    assert.throws(
      () =>
        validateDecisionEntry(
          baseEntry({
            decision: 'store sk-abcdefghijklmnopqrstuvwxyz0123',
          }),
        ),
      /secret shape/,
    );
  });

  it('rejects 64-hex secret shapes in why', () => {
    const hex64 = 'a'.repeat(64);
    assert.throws(
      () => validateDecisionEntry(baseEntry({ why: `token ${hex64}` })),
      /secret shape/,
    );
  });

  it('rejects Bearer token shapes in notes', () => {
    assert.throws(
      () =>
        validateDecisionEntry(
          baseEntry({
            notes: 'Authorization: Bearer abcdefghijklmnop1234',
          }),
        ),
      /secret shape/,
    );
  });
});

describe('appendDecision + listDecisions', () => {
  /** @type {string} */
  let root;
  /** @type {string} */
  let statusRoot;

  /**
   * @param {string} [phaseId]
   */
  function locator(phaseId = 'F1') {
    return {
      statusRoot,
      projectId: 'atomic-skills',
      planSlug: 'implement-phase-agents',
      phaseId,
    };
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'decision-log-'));
    statusRoot = join(root, '.atomic-skills');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('appends a validated entry and lists it for a phase', () => {
    const result = appendDecision(locator(), {
      category: 'tradeoff',
      decision: 'use JSONL not markdown table',
      why: 'machine-addressable append',
      evidencePath: 'none',
      impact: 'F3 can hardgate on file existence',
      at: '2026-07-22T12:00:00.000Z',
      id: 'dec-1',
    });
    assert.equal(result.ok, true);
    assert.ok(result.path.endsWith(join('decisions', 'F1.jsonl')));
    assert.ok(existsSync(result.path));

    const lines = readFileSync(result.path, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.id, 'dec-1');
    assert.equal(parsed.category, 'tradeoff');
    assert.ok(!('decisionReview' in parsed));

    const listed = listDecisions(locator());
    assert.equal(listed.length, 1);
    assert.equal(listed[0].decision, 'use JSONL not markdown table');
  });

  it('appends multiple entries and filters by category', () => {
    assert.equal(
      appendDecision(locator(), {
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
      appendDecision(locator(), {
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

    const all = listDecisions(locator());
    assert.equal(all.length, 2);
    const routing = listDecisions(locator(), { category: 'routing' });
    assert.equal(routing.length, 1);
    assert.equal(routing[0].id, 'a');
  });

  it('reject path: empty decision returns ok false', () => {
    const result = appendDecision(locator('reject'), {
      category: 'env',
      decision: '',
      why: 'x',
      impact: 'y',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /empty or missing decision/);
  });

  it('reject path: missing why returns ok false', () => {
    const result = appendDecision(locator('reject-why'), {
      category: 'env',
      decision: 'use node',
      impact: 'repro',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /empty or missing why/);
  });

  it('reject path: missing category returns ok false', () => {
    const result = appendDecision(locator('reject2'), {
      decision: 'something',
      why: 'x',
      impact: 'y',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /missing category/);
  });

  it('reject path: secret shape returns ok false', () => {
    const result = appendDecision(locator('reject-secret'), {
      category: 'env',
      decision: 'config',
      why: 'api_key=supersecretvalue123456',
      impact: 'none',
    });
    assert.equal(result.ok, false);
    assert.match(result.error || '', /secret shape/);
  });

  it('reject path: object.path outside decisions tree', () => {
    const outside = join(root, 'evil.jsonl');
    const result = appendDecision(
      {
        statusRoot,
        projectId: 'atomic-skills',
        planSlug: 'implement-phase-agents',
        phaseId: 'F1',
        path: outside,
      },
      baseEntry({ id: 'evil-1', at: '2026-07-22T12:00:00.000Z' }),
    );
    assert.equal(result.ok, false);
    assert.match(result.error || '', /path override rejected|arbitrary path rejected/);
    assert.equal(existsSync(outside), false);
  });

  it('reject path: absolute path without segments', () => {
    const outside = join(root, 'abs-evil.jsonl');
    const result = appendDecision(outside, baseEntry({
      id: 'abs-1',
      at: '2026-07-22T12:00:00.000Z',
    }));
    assert.equal(result.ok, false);
    assert.match(result.error || '', /arbitrary path rejected/);
    assert.equal(existsSync(outside), false);
  });

  it('reject path: projectId traversal via locator', () => {
    const result = appendDecision(
      {
        statusRoot,
        projectId: '../evil',
        planSlug: 'plan',
        phaseId: 'F1',
      },
      baseEntry({ id: 'trav-1', at: '2026-07-22T12:00:00.000Z' }),
    );
    assert.equal(result.ok, false);
    assert.match(result.error || '', /invalid projectId/);
  });

  it('listDecisions returns [] for missing file', () => {
    assert.deepEqual(listDecisions(locator('missing')), []);
  });

  it('first-append EEXIST race falls through to append', () => {
    // Peer already created the log: exclusive openSync('wx') throws EEXIST;
    // ensureLogFile must fall through so appendFileSync still succeeds.
    const logPath = decisionLogPath(locator('race'));
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, '', { mode: 0o600 });

    const result = appendDecision(locator('race'), {
      category: 'routing',
      decision: 'race-safe append',
      why: 'EEXIST on exclusive create must not fail first writer peer',
      evidencePath: 'none',
      impact: 'concurrent first append succeeds',
      id: 'race-1',
      at: '2026-07-22T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    assert.equal(result.path, logPath);
    const listed = listDecisions(locator('race'));
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'race-1');
  });

  it('no API stamps decisionReview status PASS', () => {
    const blocked = appendDecision(locator('no-pass'), {
      category: 'routing',
      decision: 'try to pass gate',
      why: 'x',
      impact: 'y',
      decisionReview: { status: 'PASS' },
    });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error || '', /decision-review PASS|decisionReview/);

    const blocked2 = appendDecision(locator('no-pass'), {
      category: 'routing',
      decision: 'try status field',
      why: 'x',
      impact: 'y',
      decisionReviewStatus: 'PASS',
    });
    assert.equal(blocked2.ok, false);

    // Successful append still has no decisionReview key
    const ok = appendDecision(locator('no-pass'), {
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
    const disk = JSON.parse(readFileSync(ok.path, 'utf8').trim());
    assert.equal('decisionReview' in disk, false);
  });

  it('works with statusRoot string + locator', () => {
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
    const logPath = decisionLogPath({
      statusRoot,
      projectId: 'p',
      planSlug: 'plan',
      phaseId: 'corrupt',
    });
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(
      logPath,
      'not-json\n{"id":"good","category":"routing","decision":"ok","why":"reason","evidencePath":"none","impact":"none","at":"2026-07-22T00:00:00.000Z"}\n',
      'utf8',
    );
    const listed = listDecisions({
      statusRoot,
      projectId: 'p',
      planSlug: 'plan',
      phaseId: 'corrupt',
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'good');
  });
});
