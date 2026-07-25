/**
 * T-015 — Fixture tests for descriptor-only stop and decision-review block.
 *
 * Pure helpers only: canSpawnPhaseWriter / canSpawnHostThinPhaseWriter,
 * canRunPhaseDone, decisionReviewAllowsPhaseDone, phaseEvaluationAllowsClose.
 * No live subagent spawn. No network.
 *
 * Dogfood two-stop encoding (machine-visible half):
 * - Stop 1 (package ratify): there is no durable `phaseStartPackageRatified`
 *   field. Pre-package state is modeled as descriptor-only / missing initiative
 *   — spawn helpers refuse until initiative exists (post ratify + materialize).
 * - Stop 2 (decision-review PASS): canRunPhaseDone requires decisionReview
 *   { status: passed, verifiedAt } under executionMode automate.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canSpawnPhaseWriter,
  canSpawnHostThinPhaseWriter,
  canRunPhaseDone,
} from '../src/automate-orchestrator-gates.js';
import { decisionReviewAllowsPhaseDone } from '../src/decision-review-gate.js';
import { phaseEvaluationAllowsClose } from '../src/phase-evaluation-gate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'implement-phase-agents');

/**
 * @param {string} name
 */
function loadFixture(name) {
  const path = join(FIXTURE_DIR, name);
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('implement-phase-agents fixtures catalog', () => {
  it('ships required fixture JSON files', () => {
    const names = readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.json'));
    for (const required of [
      'descriptor-only-unratified.json',
      'materialized-spawn-ok.json',
      'decision-review-pending.json',
      'phase-done-allowed.json',
    ]) {
      assert.ok(names.includes(required), `missing fixture ${required}`);
    }
  });
});

describe('descriptor-only / unratified package → spawn blocked', () => {
  const fx = loadFixture('descriptor-only-unratified.json');

  it('documents pre-package state as descriptor-only (no phaseStartPackageRatified field)', () => {
    assert.match(
      String(fx.description),
      /no phaseStartPackageRatified|descriptor-only/i,
    );
    assert.equal(fx.spawnInput.initiativePresent, false);
    assert.equal(fx.plan.executionMode, 'automate');
  });

  it('canSpawnPhaseWriter blocks until materialize (post validate-only ratify)', () => {
    const r = canSpawnPhaseWriter(fx.spawnInput);
    assert.equal(r.ok, fx.expect.canSpawnPhaseWriterOk);
    assert.match(String(r.reason), new RegExp(fx.expect.reasonPattern, 'i'));
  });

  it('canSpawnHostThinPhaseWriter blocks on descriptor-only', () => {
    const r = canSpawnHostThinPhaseWriter(fx.spawnInput);
    assert.equal(r.ok, fx.expect.canSpawnHostThinPhaseWriterOk);
    assert.match(String(r.reason), new RegExp(fx.expect.reasonPattern, 'i'));
  });
});

describe('materialized post-ratify → spawn allowed', () => {
  const fx = loadFixture('materialized-spawn-ok.json');

  it('canSpawnPhaseWriter ok when lease clean + initiative present', () => {
    const r = canSpawnPhaseWriter(fx.spawnInput);
    assert.equal(r.ok, fx.expect.canSpawnPhaseWriterOk);
  });

  it('canSpawnHostThinPhaseWriter ok when materialized', () => {
    const r = canSpawnHostThinPhaseWriter(fx.spawnInput);
    assert.equal(r.ok, fx.expect.canSpawnHostThinPhaseWriterOk);
  });
});

describe('automate + decisionReview pending → phase-done blocked', () => {
  const fx = loadFixture('decision-review-pending.json');
  const input = fx.phaseDoneInput;

  it('phaseEvaluationAllowsClose still true (eval already passed)', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: input.planExecutionMode,
      evaluationGate: input.evaluationGate,
    });
    assert.equal(r.ok, fx.expect.phaseEvaluationAllowsOk);
  });

  it('decisionReviewAllowsPhaseDone false when pending', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: input.planExecutionMode,
      decisionReview: input.decisionReview,
    });
    assert.equal(r.ok, fx.expect.decisionReviewAllowsOk);
    assert.match(String(r.reason), new RegExp(fx.expect.reasonPattern, 'i'));
  });

  it('canRunPhaseDone false under automate with decisionReview pending', () => {
    const r = canRunPhaseDone(input);
    assert.equal(r.ok, fx.expect.canRunPhaseDoneOk);
    assert.match(String(r.reason), new RegExp(fx.expect.reasonPattern, 'i'));
  });
});

describe('decisionReview passed + evaluationGate passed → phase-done allowed', () => {
  const fx = loadFixture('phase-done-allowed.json');
  const input = fx.phaseDoneInput;

  it('phaseEvaluationAllowsClose true', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: input.planExecutionMode,
      evaluationGate: input.evaluationGate,
    });
    assert.equal(r.ok, fx.expect.phaseEvaluationAllowsOk);
  });

  it('decisionReviewAllowsPhaseDone true', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: input.planExecutionMode,
      decisionReview: input.decisionReview,
    });
    assert.equal(r.ok, fx.expect.decisionReviewAllowsOk);
  });

  it('canRunPhaseDone true when both gates satisfied', () => {
    const r = canRunPhaseDone(input);
    assert.equal(r.ok, fx.expect.canRunPhaseDoneOk, r.reason || 'expected ok');
  });
});

describe('dogfood two-stop machine surface (fixture narrative)', () => {
  it('stop1 = spawn blocked without initiative; stop2 = phase-done blocked without decisionReview PASS', () => {
    const stop1 = loadFixture('descriptor-only-unratified.json');
    const stop2 = loadFixture('decision-review-pending.json');
    const allowed = loadFixture('phase-done-allowed.json');

    assert.equal(canSpawnHostThinPhaseWriter(stop1.spawnInput).ok, false);
    assert.equal(canRunPhaseDone(stop2.phaseDoneInput).ok, false);
    assert.equal(canRunPhaseDone(allowed.phaseDoneInput).ok, true);
  });
});
