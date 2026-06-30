import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stringify as stringifyYaml } from 'yaml';
import { findMissingBusinessIntent, configuredLanguage } from '../../scripts/find-missing-business-intent.js';

// The script under test, resolved from this file (tests/phase-materialization/).
const SCRIPT = join(new URL('.', import.meta.url).pathname, '..', '..', 'scripts', 'find-missing-business-intent.js');

function writeFm(path, obj) {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

// Canonical COMPLETE spine (5 required-when-present fields). derived[] omitted.
function spine() {
  return {
    value: 'why this phase exists for the business',
    workflow: 'how the work flows end-to-end',
    rules: 'the load-bearing invariants',
    outOfScope: 'what is explicitly excluded',
    doneWhen: 'the exit definition',
  };
}

// Build a nested fixture: projects/<proj>/<plan>/{plan.md, phases/<file>.md}.
// `phases` is the descriptor list; `initiatives` is {filename: frontmatter}.
function nestedFixture(proj, plan, phases, initiatives = {}) {
  const root = mkdtempSync(join(tmpdir(), 'as-bi-'));
  const dir = join(root, '.atomic-skills', 'projects', proj, plan);
  mkdirSync(join(dir, 'phases'), { recursive: true });
  writeFm(join(dir, 'plan.md'), { slug: plan, status: 'active', currentPhase: 'F0', phases });
  for (const [file, fm] of Object.entries(initiatives)) {
    writeFm(join(dir, 'phases', file), fm);
  }
  return root;
}

function gaps(report) {
  // Flatten to `${field}(${where})` per phase, for crisp assertions.
  return report.flatMap((r) => r.missing.map((m) => `${m.phaseId}:${m.field}(${m.where})`));
}

test('materialized phase with a complete spine is NOT reported (exit 0 surface)', () => {
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: spine() }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    assert.deepEqual(findMissingBusinessIntent(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('materialized phase missing outOfScope in the DESCRIPTOR reports outOfScope(descriptor)', () => {
  const { outOfScope, ...withoutOut } = spine();
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: withoutOut }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    assert.deepEqual(gaps(findMissingBusinessIntent(root)), ['F0:outOfScope(descriptor)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('materialized phase missing value in the INITIATIVE reports value(initiative)', () => {
  const { value, ...withoutValue } = spine();
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: spine() }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: withoutValue },
  });
  try {
    assert.deepEqual(gaps(findMissingBusinessIntent(root)), ['F0:value(initiative)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a materialized phase missing MULTIPLE fields reports only the FIRST (value)', () => {
  // Only workflow/rules present → value/outOfScope/doneWhen missing; value is first.
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: { workflow: 'w', rules: 'r' } }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    assert.deepEqual(gaps(findMissingBusinessIntent(root)), ['F0:value(descriptor)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('descriptor-only phase (no initiative file) is IGNORED even with no businessIntent', () => {
  // F0 complete + materialized; F1 has NO businessIntent AND no initiative file.
  const root = nestedFixture('proj', 'alpha', [
    { id: 'F0', businessIntent: spine() },
    { id: 'F1' /* descriptor-only, no spine */ },
  ], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    assert.deepEqual(findMissingBusinessIntent(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a `[NEEDS CLARIFICATION]` marker counts as missing', () => {
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: { ...spine(), rules: '[NEEDS CLARIFICATION]' } }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    assert.deepEqual(gaps(findMissingBusinessIntent(root)), ['F0:rules(descriptor)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('derived[] is NEVER gated (present or absent makes no difference)', () => {
  const withDerived = { ...spine(), derived: [{ question: 'open q?', answer: 'tentative a' }] };
  const root = nestedFixture('proj', 'alpha', [{ id: 'F0', businessIntent: withDerived }], {
    'f0.md': { slug: 'a-f0', phaseId: 'F0', status: 'active', businessIntent: withDerived },
  });
  try {
    assert.deepEqual(findMissingBusinessIntent(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('flat legacy layout gates materialized phases by phaseId, skips descriptor-only', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-bi-flat-'));
  try {
    const flat = join(root, '.atomic-skills');
    mkdirSync(join(flat, 'plans'), { recursive: true });
    mkdirSync(join(flat, 'initiatives'), { recursive: true });
    // F0 materialized (matched initiative) missing doneWhen in descriptor;
    // F1 descriptor-only (no matching initiative) — ignored even with no spine.
    const { doneWhen, ...withoutDone } = spine();
    writeFm(join(flat, 'plans', 'gamma.md'), {
      slug: 'gamma', status: 'active', currentPhase: 'F0',
      phases: [{ id: 'F0', businessIntent: withoutDone }, { id: 'F1' }],
    });
    writeFm(join(flat, 'initiatives', 'gamma-f0.md'), { slug: 'gamma-f0', phaseId: 'F0', status: 'active', businessIntent: spine() });

    const report = findMissingBusinessIntent(root);
    const flatEntries = report.filter((r) => r.projectId === '(flat)');
    assert.equal(flatEntries.length, 1, 'only the materialized F0 gap, F1 skipped');
    assert.deepEqual(gaps(flatEntries), ['F0:doneWhen(descriptor)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('configuredLanguage is exported (parity) and defaults to a string', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-bi-lang-'));
  try {
    assert.equal(typeof configuredLanguage(root), 'string');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI exits 0 on a clean tree and 1 (with the gap) on an incomplete one', () => {
  // Clean tree → exit 0.
  const clean = nestedFixture('proj', 'ok', [{ id: 'F0', businessIntent: spine() }], {
    'f0.md': { slug: 'o-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  // Dirty tree → F0 descriptor missing outOfScope.
  const { outOfScope, ...withoutOut } = spine();
  const dirty = nestedFixture('proj', 'bad', [{ id: 'F0', businessIntent: withoutOut }], {
    'f0.md': { slug: 'b-f0', phaseId: 'F0', status: 'active', businessIntent: spine() },
  });
  try {
    // exit 0 → no throw, prints the all-clear.
    const ok = execFileSync('node', [SCRIPT, clean], { encoding: 'utf8' });
    assert.match(ok, /complete businessIntent spine/);

    // exit 1 → throws; assert status + the gap token surfaced.
    assert.throws(
      () => execFileSync('node', [SCRIPT, dirty], { encoding: 'utf8' }),
      (err) => err.status === 1 && /outOfScope\(descriptor\)/.test(err.stdout),
      'CLI must exit 1 and surface outOfScope(descriptor)',
    );
  } finally {
    rmSync(clean, { recursive: true, force: true });
    rmSync(dirty, { recursive: true, force: true });
  }
});
