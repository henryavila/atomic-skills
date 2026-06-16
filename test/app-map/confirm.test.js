import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diverge } from '../../src/app-map/diverge.js';
import { confirmDivergences } from '../../src/app-map/confirm.js';

const NOW = '2026-06-16T00:00:00.000Z';

const field = (value, path, line = 1) => ({ value, source: { path, line } });
const docCandidate = (name, { audience, accessTier, path }) => ({
  page: field(name, path),
  audience: audience === undefined ? null : field(audience, path, 2),
  accessTier: accessTier === undefined ? null : field(accessTier, path, 3),
  evidence: { path, line: 1, text: name },
});
const codePage = (id, { path, audience, accessTier }) => ({
  id,
  label: id,
  codeEvidence: { path, kind: 'page-dir' },
  regime: 'brownfield',
  ...(audience ? { audience: field(audience, path) } : {}),
  ...(accessTier ? { accessTier: field(accessTier, path) } : {}),
});

// Same juxtaposition as the diverge tests: a high-risk accessTier conflict
// (settings), a low-risk audience conflict (dashboard), an artefact-only page
// (landing), a possible-alias pair (reports/report), and a clean agreed page
// (profile) that must stay OUT of the delta.
function buildDelta() {
  return diverge({
    docCandidates: [
      docCandidate('Dashboard', { audience: 'registered', path: 'docs/a.md' }),
      docCandidate('Dashboard', { audience: 'visitor', path: 'docs/b.md' }),
      docCandidate('Settings', { accessTier: 'auth:admin', path: 'docs/c.md' }),
      docCandidate('Landing', { audience: 'visitor', path: 'docs/d.md' }),
      docCandidate('Reports', { audience: 'registered', path: 'docs/e.md' }),
      docCandidate('Profile', { audience: 'registered', path: 'docs/f.md' }),
    ],
    codePages: [
      codePage('dashboard', { path: 'src/pages/Dashboard.tsx' }),
      codePage('settings', { path: 'src/pages/Settings.tsx', accessTier: 'public' }),
      codePage('report', { path: 'src/pages/Report.tsx' }),
      codePage('admin', { path: 'src/pages/Admin.tsx' }),
      codePage('profile', { path: 'src/pages/Profile.tsx', audience: 'registered' }),
    ],
  });
}

// Scripted operator. Records every question and answers by item key.
function makeOperator(script) {
  const calls = [];
  const ask = (question) => {
    calls.push(question);
    if (question.type === 'item') return script[question.key];
    return {
      resolutions: question.items.map((item) => ({ key: item.key, ...script[item.key] })),
    };
  };
  return { ask, calls };
}

const FULL_RESOLVE = {
  'settings:accessTier': { choice: 'auth:admin' },
  'reports:existence': { choice: 'distinct' },
  'report:existence': { choice: 'distinct' },
  'dashboard:audience': { choice: 'registered', blind: false },
  'landing:existence': { choice: 'accept', blind: true },
  'admin:existence': { choice: 'accept', blind: false },
};

const pageById = (result, id) => result.pages.find((p) => p.id === id);

// Acceptance #1 — presents ONLY the delta; budget scaled by risk: access/authz
// asked individually, low-impact batched.
test('asks only about the delta; high-risk individually, low-risk in one batch', () => {
  const { ask, calls } = makeOperator(FULL_RESOLVE);
  confirmDivergences(buildDelta(), { ask, now: NOW });

  // Never asks about an auto-accepted page.
  const askedPages = new Set();
  for (const call of calls) {
    if (call.type === 'item') askedPages.add(call.item.pageId);
    else for (const item of call.items) askedPages.add(item.pageId);
  }
  assert.equal(askedPages.has('profile'), false, 'agreed page must never be asked');

  // High-risk (accessTier conflict + possible-alias) → individual item prompts.
  const itemKeys = calls.filter((c) => c.type === 'item').map((c) => c.key).sort();
  assert.deepEqual(itemKeys, ['report:existence', 'reports:existence', 'settings:accessTier']);

  // Low-risk (audience conflict + artefact-only) → a single batched prompt.
  const batchCalls = calls.filter((c) => c.type === 'batch');
  assert.equal(batchCalls.length, 1);
  assert.deepEqual(
    batchCalls[0].items.map((i) => i.key).sort(),
    ['admin:existence', 'dashboard:audience', 'landing:existence'],
  );
});

// Acceptance #2 — arbitration records resolvedBy, resolvedAt and choice.
test('arbitration records resolvedBy, resolvedAt and choice', () => {
  const { ask } = makeOperator(FULL_RESOLVE);
  const result = confirmDivergences(buildDelta(), { ask, now: NOW, resolvedBy: 'henry' });

  const resolution = pageById(result, 'settings').fields.accessTier.resolution;
  assert.deepEqual(resolution, { resolvedBy: 'henry', resolvedAt: NOW, choice: 'auth:admin' });
  // The arbitrated value is now fixed to the operator's choice.
  assert.equal(pageById(result, 'settings').fields.accessTier.value, 'auth:admin');
});

// Acceptance #3 — output invariant: no page ends unconfirmed-and-unasked; a
// pending state persists ONLY when the operator explicitly deferred.
test('no page ends unconfirmed-and-unasked; pending only on explicit defer', () => {
  // Full resolve → nothing left pending.
  const full = confirmDivergences(buildDelta(), { ask: makeOperator(FULL_RESOLVE).ask, now: NOW });
  assert.deepEqual(full.deferred, []);

  // Explicit defer of landing → exactly that one persists as pending, flagged.
  const deferScript = { ...FULL_RESOLVE, 'landing:existence': { choice: 'defer' } };
  const deferred = confirmDivergences(buildDelta(), { ask: makeOperator(deferScript).ask, now: NOW });
  assert.deepEqual(deferred.deferred, ['landing:existence']);
  assert.equal(pageById(deferred, 'landing').existenceResolution.status, 'pending');

  // Every delta item was addressed — none silently left unconfirmed-and-unasked.
  const addressed = new Set([...deferred.resolvedKeys, ...deferred.deferred]);
  for (const item of deferred.delta) {
    assert.ok(addressed.has(item.key ?? `${item.pageId}:${item.field ?? 'existence'}`));
  }
});

// Acceptance #4 — blind-confirmation rate instrumented as a governance metric.
test('instruments the blind-confirmation rate', () => {
  const result = confirmDivergences(buildDelta(), { ask: makeOperator(FULL_RESOLVE).ask, now: NOW });

  // 6 delta items confirmed, 1 of them blind (the batch-accepted landing).
  assert.equal(result.metrics.totalConfirmations, 6);
  assert.equal(result.metrics.blindConfirmations, 1);
  assert.equal(result.metrics.blindConfirmationRate, 1 / 6);
});
