/**
 * F5 T-001 — page reader for JSONL said/saw.
 * Chat "ok" is not presented evidence. Missing said or saw is not presented.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isPresentedDecision,
  presentedDecisions,
  readPresentedDecisions,
  validateDecisionEntry,
} from '../src/decision-log.js';

function entry(overrides = {}) {
  return {
    id: 'dec-1',
    category: 'routing',
    decision: 'open the final page',
    why: 'operator must see stamps',
    evidencePath: 'none',
    impact: 'presented on the final page',
    at: '2026-10-02T12:00:00.000Z',
    said: 'the audit is closed',
    saw: 'deliveryAuditGate status passed',
    ...overrides,
  };
}

describe('isPresentedDecision', () => {
  it('each JSONL decision with said and saw is presented', () => {
    const e = validateDecisionEntry(entry());
    assert.equal(e.said, 'the audit is closed');
    assert.equal(e.saw, 'deliveryAuditGate status passed');
    assert.equal(isPresentedDecision(e), true);
  });

  it('an entry missing said does not count as presented', () => {
    const { said: _omit, ...rest } = entry();
    assert.equal(isPresentedDecision(rest), false);
    assert.equal(isPresentedDecision(entry({ said: '' })), false);
    assert.equal(isPresentedDecision(entry({ said: '   ' })), false);
  });

  it('an entry missing saw does not count as presented', () => {
    const { saw: _omit, ...rest } = entry();
    assert.equal(isPresentedDecision(rest), false);
    assert.equal(isPresentedDecision(entry({ saw: '' })), false);
    assert.equal(isPresentedDecision(entry({ saw: '   ' })), false);
  });

  it('does not treat chat ok as presented evidence', () => {
    for (const token of ['ok', 'OK', ' chat ok ', 'okay', 'yes']) {
      assert.equal(
        isPresentedDecision(entry({ said: token, saw: 'the page loaded' })),
        false,
        `said=${JSON.stringify(token)} must not present`,
      );
      assert.equal(
        isPresentedDecision(entry({ said: 'the audit is closed', saw: token })),
        false,
        `saw=${JSON.stringify(token)} must not present`,
      );
    }
    assert.equal(
      isPresentedDecision(entry({ decision: 'ok', said: 'ok', saw: 'ok' })),
      false,
    );
  });
});

describe('presentedDecisions / readPresentedDecisions', () => {
  it('the page reader covers complete, missing, and chat-ok cases', () => {
    const complete = entry({ id: 'keep' });
    const missingSaid = entry({ id: 'no-said', said: undefined });
    delete missingSaid.said;
    const missingSaw = entry({ id: 'no-saw' });
    delete missingSaw.saw;
    const chatOk = entry({ id: 'chat', said: 'ok', saw: 'ok' });

    const presented = presentedDecisions([
      complete,
      missingSaid,
      missingSaw,
      chatOk,
      null,
      'ok',
    ]);
    assert.equal(presented.length, 1);
    assert.equal(presented[0].id, 'keep');
    assert.equal(presented[0].said, complete.said);
    assert.equal(presented[0].saw, complete.saw);
  });

  it('reads JSONL and drops lines that are not presented', () => {
    const jsonl = [
      JSON.stringify(entry({ id: 'a', said: 'we chose HTTP', saw: 'serve-flow --up' })),
      JSON.stringify(entry({ id: 'b', said: '', saw: 'still missing said' })),
      '{"id":"c","category":"routing","decision":"x","why":"y","impact":"z"}',
      JSON.stringify(entry({ id: 'd', said: 'ok', saw: 'chat' })),
      'not-json',
      '',
    ].join('\n');
    const presented = readPresentedDecisions(jsonl);
    assert.equal(presented.length, 1);
    assert.equal(presented[0].id, 'a');
    assert.equal(presented[0].said, 'we chose HTTP');
    assert.equal(presented[0].saw, 'serve-flow --up');
  });
});
