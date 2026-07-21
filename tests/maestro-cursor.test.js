/**
 * maestro-cursor — pure step cursor + thin status file (F3 / R2).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MAESTRO_CURSOR_DIR,
  MAESTRO_STEPS,
  AWAITING_OPERATOR_ADVANCE,
  MAX_REDISPATCH,
  sanitizePlanSlug,
  cursorPath,
  isKnownStep,
  isLegalTransition,
  validateCursorShape,
  buildInitialCursor,
  parseCursor,
  serializeCursor,
  advanceCursor,
  cursorAllowsGate,
  readCursorResult,
  writeCursorFile,
  ensureCursor,
} from '../src/maestro-cursor.js';

describe('sanitizePlanSlug / cursorPath', () => {
  it('cursorPath joins statusRoot/automate/<planSlug>.json', () => {
    const p = cursorPath('/repo/.atomic-skills/status', 'automate-skill-discipline');
    assert.equal(
      p,
      join(
        '/repo/.atomic-skills/status',
        MAESTRO_CURSOR_DIR,
        'automate-skill-discipline.json',
      ),
    );
    assert.match(p, /\/automate\//);
    assert.ok(p.endsWith('automate-skill-discipline.json'));
  });

  it('rejects empty statusRoot or planSlug', () => {
    assert.throws(() => cursorPath('', 'plan'), /statusRoot/);
    assert.throws(() => cursorPath('/status', ''), /planSlug/);
  });

  it('rejects path-traversal planSlug', () => {
    assert.throws(() => sanitizePlanSlug('../evil'), /invalid/);
    assert.throws(() => sanitizePlanSlug('a/b'), /invalid/);
    assert.throws(() => cursorPath('/status', '..'), /invalid/);
  });
});

describe('buildInitialCursor / validateCursorShape / parse', () => {
  it('buildInitialCursor sets step A, phaseId, redispatchCount 0, updatedAt', () => {
    const c = buildInitialCursor({
      phaseId: 'F3',
      updatedAt: '2026-07-21T00:00:00.000Z',
    });
    assert.equal(c.step, 'A');
    assert.equal(c.phaseId, 'F3');
    assert.equal(c.redispatchCount, 0);
    assert.equal(c.updatedAt, '2026-07-21T00:00:00.000Z');
    assert.equal(c.claimReportPath, undefined);
    assert.equal(c.leasePath, undefined);
  });

  it('buildInitialCursor accepts step B and optional paths', () => {
    const c = buildInitialCursor({
      phaseId: 'F0',
      step: 'B',
      claimReportPath: '.atomic-skills/status/claims/x.json',
      leasePath: '.atomic-skills/status/writer-leases/x.json',
    });
    assert.equal(c.step, 'B');
    assert.equal(c.claimReportPath, '.atomic-skills/status/claims/x.json');
    assert.equal(c.leasePath, '.atomic-skills/status/writer-leases/x.json');
  });

  it('validateCursorShape accepts full shape', () => {
    const r = validateCursorShape({
      step: 'E',
      phaseId: 'F1',
      redispatchCount: 1,
      claimReportPath: '/tmp/claim.json',
      leasePath: '/tmp/lease.json',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });

  it('validateCursorShape rejects missing fields and unknown step', () => {
    assert.equal(validateCursorShape(null).ok, false);
    assert.equal(validateCursorShape({}).ok, false);
    const bad = validateCursorShape({
      step: 'Z',
      phaseId: 'F0',
      redispatchCount: 0,
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => /unknown step/i.test(e)));
  });

  it('parseCursor / serializeCursor round-trip', () => {
    const c = buildInitialCursor({ phaseId: 'F3', step: 'C' });
    const text = serializeCursor(c);
    const back = parseCursor(text);
    assert.equal(back.step, 'C');
    assert.equal(back.phaseId, 'F3');
    assert.equal(parseCursor(''), null);
    assert.equal(parseCursor('not-json'), null);
  });

  it('isKnownStep covers A–I and awaiting-operator-advance', () => {
    for (const s of MAESTRO_STEPS) assert.equal(isKnownStep(s), true, s);
    assert.equal(isKnownStep(AWAITING_OPERATOR_ADVANCE), true);
    assert.equal(isKnownStep('Z'), false);
  });
});

describe('legal transition table', () => {
  it('allows sequential A→B→…→G and G→awaiting-operator-advance', () => {
    const spine = ['A', 'B', 'C', 'D', 'D.5', 'E', 'F', 'G'];
    for (let i = 0; i < spine.length - 1; i++) {
      assert.equal(
        isLegalTransition(spine[i], spine[i + 1]),
        true,
        `${spine[i]}→${spine[i + 1]}`,
      );
    }
    assert.equal(isLegalTransition('G', AWAITING_OPERATOR_ADVANCE), true);
    assert.equal(isLegalTransition(AWAITING_OPERATOR_ADVANCE, 'H'), true);
    assert.equal(isLegalTransition('H', 'A'), true);
    assert.equal(isLegalTransition('H', 'I'), true);
    assert.equal(isLegalTransition('G', 'I'), true);
  });

  it('rejects jump C to G', () => {
    assert.equal(isLegalTransition('C', 'G'), false);
    assert.equal(isLegalTransition('C', 'E'), false);
    assert.equal(isLegalTransition('A', 'I'), false);
    assert.equal(isLegalTransition('B', 'G'), false);
  });

  it('allows redispatch E|F→C under max count', () => {
    assert.equal(isLegalTransition('E', 'C', { redispatchCount: 0 }), true);
    assert.equal(isLegalTransition('F', 'C', { redispatchCount: 1 }), true);
    assert.equal(
      isLegalTransition('E', 'C', { redispatchCount: MAX_REDISPATCH }),
      false,
    );
  });
});

describe('advanceCursor', () => {
  const base = {
    step: 'B',
    phaseId: 'F3',
    redispatchCount: 0,
    updatedAt: '2026-07-21T00:00:00.000Z',
  };

  it('advances B→C and stamps updatedAt', () => {
    const r = advanceCursor(base, 'C', { updatedAt: '2026-07-21T01:00:00.000Z' });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.cursor.step, 'C');
    assert.equal(r.cursor.phaseId, 'F3');
    assert.equal(r.cursor.updatedAt, '2026-07-21T01:00:00.000Z');
  });

  it('rejects jump C to G', () => {
    const r = advanceCursor({ ...base, step: 'C' }, 'G');
    assert.equal(r.ok, false);
    assert.match(r.reason, /illegal transition C → G/);
  });

  it('rejects done-like jump when step is B (B→E / B→G)', () => {
    const toE = advanceCursor(base, 'E');
    assert.equal(toE.ok, false);
    assert.match(toE.reason, /illegal transition B → E/);
    const toG = advanceCursor(base, 'G');
    assert.equal(toG.ok, false);
  });

  it('advances G → awaiting-operator-advance (pause state)', () => {
    const r = advanceCursor(
      { ...base, step: 'G' },
      AWAITING_OPERATOR_ADVANCE,
      { updatedAt: '2026-07-21T02:00:00.000Z' },
    );
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.cursor.step, AWAITING_OPERATOR_ADVANCE);
  });

  it('redispatch E→C increments redispatchCount and rejects over max', () => {
    const r1 = advanceCursor({ ...base, step: 'E', redispatchCount: 0 }, 'C');
    assert.equal(r1.ok, true, r1.reason);
    assert.equal(r1.cursor.step, 'C');
    assert.equal(r1.cursor.redispatchCount, 1);

    const r2 = advanceCursor({ ...base, step: 'E', redispatchCount: MAX_REDISPATCH }, 'C');
    assert.equal(r2.ok, false);
    assert.match(r2.reason, /redispatchCount|illegal/i);
  });

  it('preserves optional claimReportPath and leasePath', () => {
    const r = advanceCursor(
      {
        ...base,
        step: 'D',
        claimReportPath: '/claims/c.json',
        leasePath: '/leases/l.json',
      },
      'D.5',
    );
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.cursor.claimReportPath, '/claims/c.json');
    assert.equal(r.cursor.leasePath, '/leases/l.json');
  });
});

describe('cursorAllowsGate', () => {
  function cur(step) {
    return {
      step,
      phaseId: 'F3',
      redispatchCount: 0,
      updatedAt: '2026-07-21T00:00:00.000Z',
    };
  }

  it('spawn only when step C', () => {
    assert.equal(cursorAllowsGate(cur('C'), 'spawn').ok, true);
    assert.equal(cursorAllowsGate(cur('B'), 'spawn').ok, false);
    assert.equal(cursorAllowsGate(cur('E'), 'spawn').ok, false);
    assert.match(cursorAllowsGate(cur('B'), 'spawn').reason, /step B|forbids/i);
  });

  it('done only when step E (rejects when step is B)', () => {
    assert.equal(cursorAllowsGate(cur('E'), 'done').ok, true);
    const blocked = cursorAllowsGate(cur('B'), 'done');
    assert.equal(blocked.ok, false);
    assert.match(blocked.reason, /step B|forbids/i);
  });

  it('phase-done only when step G', () => {
    assert.equal(cursorAllowsGate(cur('G'), 'phase-done').ok, true);
    assert.equal(cursorAllowsGate(cur('C'), 'phase-done').ok, false);
  });

  it('claims allows D, D.5, E', () => {
    assert.equal(cursorAllowsGate(cur('D'), 'claims').ok, true);
    assert.equal(cursorAllowsGate(cur('D.5'), 'claims').ok, true);
    assert.equal(cursorAllowsGate(cur('E'), 'claims').ok, true);
    assert.equal(cursorAllowsGate(cur('C'), 'claims').ok, false);
  });

  it('finalize only when step I', () => {
    assert.equal(cursorAllowsGate(cur('I'), 'finalize').ok, true);
    assert.equal(cursorAllowsGate(cur('G'), 'finalize').ok, false);
  });

  it('awaiting-operator-advance blocks spawn/done/phase-done', () => {
    const pause = cur(AWAITING_OPERATOR_ADVANCE);
    for (const g of ['spawn', 'done', 'phase-done', 'finalize']) {
      const r = cursorAllowsGate(pause, g);
      assert.equal(r.ok, false, g);
      assert.match(r.reason, /awaiting-operator-advance/);
    }
  });

  it('missing cursor blocks', () => {
    assert.equal(cursorAllowsGate(null, 'spawn').ok, false);
  });
});

describe('FS: read / write / ensure (missing initializes at A or B)', () => {
  /** @type {string} */
  let root;
  /** @type {string} */
  let statusRoot;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'maestro-cursor-'));
    statusRoot = join(root, 'status');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('readCursorResult missing when file absent', () => {
    const r = readCursorResult(statusRoot, 'demo-plan');
    assert.equal(r.status, 'missing');
  });

  it('writeCursorFile + readCursorResult round-trip', () => {
    const c = buildInitialCursor({
      phaseId: 'F3',
      step: 'C',
      claimReportPath: 'claim-report.f3.json',
      leasePath: 'leases/demo.json',
      updatedAt: '2026-07-21T03:00:00.000Z',
    });
    const path = writeCursorFile(statusRoot, 'demo-plan', c);
    assert.ok(existsSync(path));
    assert.match(path, /automate\/demo-plan\.json$/);
    const r = readCursorResult(statusRoot, 'demo-plan');
    assert.equal(r.status, 'ok');
    assert.equal(r.cursor.step, 'C');
    assert.equal(r.cursor.claimReportPath, 'claim-report.f3.json');
    assert.equal(r.cursor.leasePath, 'leases/demo.json');
  });

  it('ensureCursor missing initializes at A without throw', () => {
    const r = ensureCursor(statusRoot, 'fresh-plan', { phaseId: 'F0' });
    assert.equal(r.status, 'ok');
    assert.equal(r.initialized, true);
    assert.equal(r.cursor.step, 'A');
    assert.equal(r.cursor.phaseId, 'F0');
    assert.equal(r.cursor.redispatchCount, 0);
    assert.ok(existsSync(cursorPath(statusRoot, 'fresh-plan')));
  });

  it('ensureCursor can initialize at B without throw', () => {
    const r = ensureCursor(statusRoot, 'at-b', {
      phaseId: 'F1',
      step: 'B',
      updatedAt: '2026-07-21T04:00:00.000Z',
    });
    assert.equal(r.status, 'ok');
    assert.equal(r.initialized, true);
    assert.equal(r.cursor.step, 'B');
  });

  it('ensureCursor does not overwrite existing ok cursor', () => {
    writeCursorFile(
      statusRoot,
      'keep',
      buildInitialCursor({ phaseId: 'F2', step: 'E' }),
    );
    const r = ensureCursor(statusRoot, 'keep', { phaseId: 'F9', step: 'A' });
    assert.equal(r.status, 'ok');
    assert.equal(r.initialized, false);
    assert.equal(r.cursor.step, 'E');
    assert.equal(r.cursor.phaseId, 'F2');
  });

  it('readCursorResult malformed on garbage JSON', () => {
    mkdirSync(join(statusRoot, MAESTRO_CURSOR_DIR), { recursive: true });
    writeFileSync(
      join(statusRoot, MAESTRO_CURSOR_DIR, 'bad.json'),
      '{not json',
      'utf8',
    );
    const r = readCursorResult(statusRoot, 'bad');
    assert.equal(r.status, 'malformed');
  });

  it('ensureCursor does not clobber malformed', () => {
    mkdirSync(join(statusRoot, MAESTRO_CURSOR_DIR), { recursive: true });
    const path = join(statusRoot, MAESTRO_CURSOR_DIR, 'mal.json');
    writeFileSync(path, '{"step":"C"}', 'utf8'); // missing phaseId etc.
    const r = ensureCursor(statusRoot, 'mal', { phaseId: 'F0' });
    assert.equal(r.status, 'malformed');
    assert.equal(r.initialized, false);
    // file still the partial write
    assert.match(readFileSync(path, 'utf8'), /"step":"C"/);
  });
});
