import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diverge } from '../../src/app-map/diverge.js';

// Field shape mirrors T-001 candidates: { value, source: { path, line } }.
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

function buildInputs() {
  return {
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
  };
}

const pageById = (result, id) => result.pages.find((p) => p.id === id);

// Acceptance #1 — join by EXACT normalized key; a near-miss becomes
// possible-alias presented to the operator, NEVER auto-united.
test('joins on exact normalized key; near-miss is possible-alias, never auto-united', () => {
  const result = diverge(buildInputs());

  // Exact match: doc "Dashboard" ⟷ code "dashboard" → one confirmed page.
  assert.equal(pageById(result, 'dashboard').existence, 'confirmed');

  // Near-miss: doc "Reports" vs code "report" must NOT collapse into one page.
  const reports = pageById(result, 'reports');
  const report = pageById(result, 'report');
  assert.equal(reports.existence, 'possible-alias');
  assert.equal(report.existence, 'possible-alias');
  assert.ok(reports.possibleAliasOf.includes('report'));
  assert.ok(report.possibleAliasOf.includes('reports'));
  // Crucially they remain TWO entries — no silent merge.
  assert.notEqual(reports, report);
});

// Acceptance #2 — existence spans confirmed, artefact-only, code-only,
// possible-alias.
test('produces every existence class', () => {
  const result = diverge(buildInputs());
  const existences = new Set(result.pages.map((p) => p.existence));

  for (const cls of ['confirmed', 'artefact-only', 'code-only', 'possible-alias']) {
    assert.ok(existences.has(cls), `expected an existence='${cls}' page`);
  }
  assert.equal(pageById(result, 'landing').existence, 'artefact-only');
  assert.equal(pageById(result, 'admin').existence, 'code-only');
});

// Acceptance #3 — a field divergence becomes a pending delta carrying BOTH
// provenances; agreement is auto-accepted with NO delta.
test('field divergence → delta with both provenances; agreement → auto-accepted, no delta', () => {
  const result = diverge(buildInputs());

  // Profile: doc + code BOTH say "registered" → agreed, auto-accepted.
  const profile = pageById(result, 'profile');
  assert.equal(profile.fields.audience.status, 'agreed');
  assert.equal(profile.fields.audience.value, 'registered');
  assert.equal(
    result.delta.some((d) => d.pageId === 'profile'),
    false,
    'an agreed, confirmed page must not enter the delta',
  );

  // Dashboard: two doc sources disagree on audience → conflict in the delta.
  const dashConflict = result.delta.find((d) => d.pageId === 'dashboard' && d.field === 'audience');
  assert.ok(dashConflict, 'audience divergence must surface in the delta');
  const provenancePaths = dashConflict.candidates.map((c) => c.source.path).sort();
  assert.deepEqual(provenancePaths, ['docs/a.md', 'docs/b.md']);
});

// Acceptance #4 — poisoned source (doc admin-only, code public): a divergence is
// produced and the wrong line is NEVER emitted as fact (resolved value stays
// null until the operator arbitrates).
test('poisoned doc/code disagreement never emits either side as fact', () => {
  const result = diverge(buildInputs());
  const settings = pageById(result, 'settings');

  assert.equal(settings.fields.accessTier.status, 'conflict');
  assert.equal(settings.fields.accessTier.value, null, 'no side is chosen — value is unresolved');

  const values = settings.fields.accessTier.sources.map((s) => s.value).sort();
  assert.deepEqual(values, ['auth:admin', 'public']);
  assert.ok(result.delta.some((d) => d.pageId === 'settings' && d.field === 'accessTier'));
});

// Acceptance #5 — multi-source contradiction leaves ALL candidates in the delta
// with no precedence picking a winner.
test('contradicting sources all land in the delta — no precedence wins', () => {
  const result = diverge(buildInputs());
  const dash = pageById(result, 'dashboard');

  assert.equal(dash.fields.audience.status, 'conflict');
  assert.equal(dash.fields.audience.value, null);
  const audiences = dash.fields.audience.sources.map((s) => s.value).sort();
  assert.deepEqual(audiences, ['registered', 'visitor'], 'both audiences survive — none dropped');
});
