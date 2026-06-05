import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lintSource, lintSpec, parseTaskSections, levelConfusedTaskTitle } from '../scripts/lint-source.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, '../skills/shared/project-assets/minimal-source.template.md');

// A fully-specified, placeholder-free decompose source whose tasks carry the
// per-task SPEC interior (Files / scopeBoundary / acceptance / verifier). Both
// lints must pass on this. Note: `projects/<id>/<slug>/` is a path PATTERN using
// <id>/<slug> as variables — it must NOT be flagged as a fuzzy placeholder.
const CLEAN = `# Self-host migration

This plan migrates the flat .atomic-skills tree to the nested projects layout.

## Inviolable principles

- **P1 Copy-verify-delete** — never destructive-move; tar snapshot before cut-over.

## Glossary

- state root — the .atomic-skills directory holding all tracked state.

## F0 — JS-side path-emit

Goal: emit the nested projects/<id>/<slug>/ layout from decompose.

### T0.1 Add projectId option to materialize

- Files: src/decompose.js, tests/decompose.test.js
- scopeBoundary: do not change decomposePlan parser heuristics.
- acceptance: materialize emits projects/<id>/<slug>/plan.md when projectId set; flat layout unchanged otherwise.
- verifier: kind test, runner "node --test", pattern "nested projects".
- RED→GREEN: write a failing test asserting the nested path, then add the opts.projectId branch.

### T0.2 Walk nested projects in normalize

- Files: src/normalize.js, tests/normalize.test.js
- scopeBoundary: leave the flat dir-walk byte-identical.
- acceptance: normalizeStateDir walks projects/*/*/ for plan.md and phases.
- verifier: kind shell, command "node --test tests/normalize.test.js", expectExitCode 0.
- RED→GREEN: add a fixture under projects/, assert it is found, then extend the walk.
`;

describe('lintSource — No-Placeholders (R-ORCH-12 / R-SP-24)', () => {
  test('GREEN: a fully-specified source has no placeholders', () => {
    assert.deepEqual(lintSource(CLEAN), []);
  });

  test('GREEN: path patterns using <id>/<slug> variables are NOT flagged', () => {
    // The clean source uses projects/<id>/<slug>/ — a documented path variable,
    // not a fuzzy fill-me placeholder.
    const v = lintSource(CLEAN);
    assert.equal(v.join('\n').includes('<id>'), false);
    assert.equal(v.join('\n').includes('<slug>'), false);
  });

  test('RED: an unfilled REPLACE_* template marker is rejected', () => {
    const md = CLEAN.replace('Add projectId option to materialize', 'REPLACE_TASK_TITLE');
    const v = lintSource(md);
    assert.equal(v.length >= 1, true);
    assert.match(v.join('\n'), /REPLACE_TASK_TITLE/);
  });

  test('RED: the unfilled minimal-source.template is rejected with many REPLACE_*', () => {
    const tpl = readFileSync(TEMPLATE_PATH, 'utf8');
    const v = lintSource(tpl);
    assert.equal(v.length >= 5, true, `expected ≥5 violations, got ${v.length}`);
    assert.match(v.join('\n'), /REPLACE_/);
  });

  test('RED: a TODO: sentinel is rejected', () => {
    const md = CLEAN.replace('do not change decomposePlan parser heuristics.', 'TODO: decide scope later');
    const v = lintSource(md);
    assert.match(v.join('\n'), /\bTODO\b/);
  });

  test('RED: TBD / FIXME sentinels are rejected', () => {
    assert.match(lintSource(CLEAN.replace('node --test tests/normalize.test.js', 'FIXME')).join('\n'), /FIXME/);
    assert.match(lintSource(CLEAN.replace('state root — the .atomic-skills directory holding all tracked state.', 'state root — TBD')).join('\n'), /TBD/);
  });

  test('RED: a fuzzy <path> placeholder is rejected', () => {
    const md = CLEAN.replace('src/decompose.js, tests/decompose.test.js', '<path>');
    const v = lintSource(md);
    assert.match(v.join('\n'), /<path>/);
  });

  test('RED: an ellipsis placeholder <...> is rejected', () => {
    const md = CLEAN.replace('do not change decomposePlan parser heuristics.', 'leave <...> alone');
    assert.equal(lintSource(md).length >= 1, true);
  });

  test('RED: a vague cross-task reference ("similar to Task 1") is rejected', () => {
    const md = CLEAN.replace('add the opts.projectId branch.', 'do it similar to Task 1.');
    const v = lintSource(md);
    assert.match(v.join('\n'), /cross-task|similar/i);
  });

  test('GREEN: "TODO app" in prose is NOT a placeholder (no colon/bracket sentinel)', () => {
    const md = CLEAN.replace('Self-host migration', 'Build a TODO app shell');
    // The word TODO here is part of a product name, not a `TODO:` sentinel.
    const v = lintSource(md);
    assert.equal(v.join('\n').includes('TODO'), false);
  });

  test('GREEN: a markdown autolink <https://...> is NOT flagged', () => {
    const md = CLEAN + '\n## F1 — Docs\n\nGoal: see <https://example.com/spec>.\n\n### T1.1 Link the spec\n\n- Files: docs/spec.md\n- scopeBoundary: docs only.\n- acceptance: the link resolves.\n- verifier: kind shell, command "test -f docs/spec.md", expectExitCode 0.\n';
    assert.equal(lintSource(md).join('\n').includes('example.com'), false);
  });

  test('GREEN: blockquote instruction lines are ignored (deleted before decompose)', () => {
    const md = '> The H2 must match `^F<N>\\b` (REPLACE_NOTHING here is in an instruction).\n' + CLEAN;
    // The `>` instruction line carries `<N>` in backticks and is dropped first.
    const v = lintSource(md);
    assert.equal(v.join('\n').includes('<N>'), false);
  });

  test('returns [] for empty / whitespace input rather than throwing', () => {
    assert.deepEqual(lintSource(''), []);
    assert.deepEqual(lintSource('   \n  '), []);
  });

  test('each violation names a 1-based line number', () => {
    const md = CLEAN.replace('Add projectId option to materialize', 'REPLACE_TASK_TITLE');
    const v = lintSource(md);
    assert.match(v.join('\n'), /line \d+/);
  });
});

describe('parseTaskSections — H3 task enumeration (fence-aware)', () => {
  test('finds each ### Tn under a ## F<N> phase with its body lines', () => {
    const sections = parseTaskSections(CLEAN);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].phaseId, 'F0');
    assert.equal(sections[0].taskId, 'T0.1');
    assert.equal(sections[1].taskId, 'T0.2');
    assert.equal(sections[0].bodyLines.some((l) => /Files:/.test(l)), true);
  });

  test('skips task-marker H3s like "### Sub-fases" / "### Tasks"', () => {
    const md = '## F0 — X\n\nGoal: g.\n\n### Tasks\n\n### T0.1 Real task\n\n- Files: a.js\n';
    const sections = parseTaskSections(md);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].taskId, 'T0.1');
  });

  test('does not treat ### headings inside a code fence as tasks', () => {
    const md = '## F0 — X\n\nGoal: g.\n\n\`\`\`\n### Not a task\n\`\`\`\n\n### T0.1 Real\n\n- Files: a.js\n';
    const sections = parseTaskSections(md);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].taskId, 'T0.1');
  });
});

describe('lintSpec — per-task admission gate (R-ORCH-19/23)', () => {
  test('GREEN: fully-specified tasks pass the SPEC gate', () => {
    assert.deepEqual(lintSpec(CLEAN), []);
  });

  test('lintSpec subsumes the No-Placeholders lint', () => {
    const md = CLEAN.replace('src/decompose.js, tests/decompose.test.js', 'REPLACE_TASK_FILES');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /REPLACE_TASK_FILES/);
  });

  test('RED: a task missing its Files block fails admission with a named error', () => {
    const md = CLEAN.replace('- Files: src/decompose.js, tests/decompose.test.js\n', '');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*Files/s);
  });

  test('RED: a Files block with only a fuzzy <path> (no exact path) fails', () => {
    const md = CLEAN.replace('src/decompose.js, tests/decompose.test.js', '<path>');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1/);
    assert.match(v.join('\n'), /path|placeholder/i);
  });

  test('RED: a task missing scopeBoundary fails admission', () => {
    const md = CLEAN.replace('- scopeBoundary: do not change decomposePlan parser heuristics.\n', '');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*scopeBoundary/s);
  });

  test('RED: a task missing acceptance fails admission', () => {
    const md = CLEAN.replace(/- acceptance: materialize emits projects\/<id>\/<slug>\/plan\.md when projectId set; flat layout unchanged otherwise\.\n/, '');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*acceptance/s);
  });

  test('RED: a task with no deterministic verifier (manual only) fails admission', () => {
    const md = CLEAN.replace('- verifier: kind test, runner "node --test", pattern "nested projects".', '- verifier: kind manual, description "eyeball it".');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*verifier/s);
    assert.match(v.join('\n'), /deterministic|shell|test|query/i);
  });

  test('RED: a kind:manual verifier whose description mentions "test" still fails (kind-aware)', () => {
    const md = CLEAN.replace('- verifier: kind test, runner "node --test", pattern "nested projects".', '- verifier: kind manual, description "run the test suite by hand".');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*verifier/s);
  });

  test('GREEN: the bold "- **Files:**" field form is recognized', () => {
    const md = CLEAN.replace('- Files: src/decompose.js, tests/decompose.test.js', '- **Files:** src/decompose.js, tests/decompose.test.js');
    assert.deepEqual(lintSpec(md), []);
  });

  test('RED: a task missing the verifier line entirely fails admission', () => {
    const md = CLEAN.replace('- verifier: kind test, runner "node --test", pattern "nested projects".\n', '');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*verifier/s);
  });

  test('RED: bullet-mode tasks (marker H3 + bullets, no ### Tn) fail the SPEC gate', () => {
    const md = `# P

Narrative.

## F0 — X

Goal: g.

### Sub-fases (menu)

- **T-001 — Do a thing.** the body
- **T-002 — Do another.** more body
`;
    const v = lintSpec(md);
    assert.match(v.join('\n'), /F0.*bullet-mode|per-task ### Tn|### Tn/s);
  });
});

describe('level hygiene — a task title must not masquerade as a phase', () => {
  test('levelConfusedTaskTitle: flags "Phase X —"/"Fase N:" but not prose', () => {
    for (const t of ['Phase A — aiDeck read-in-place', 'Phase D — npm publish', 'Fase 2: fazer algo', 'Phase 10 - rollout']) {
      assert.equal(levelConfusedTaskTitle(t), true, t);
    }
    for (const t of ['Phase out the legacy parser', 'Phase 1 rollout is done', 'aiDeck read-in-place capability', 'Dashboard port — fix table', '', null]) {
      assert.equal(levelConfusedTaskTitle(t), false, String(t));
    }
  });

  test('lintSpec RED: a ### Tn title that masquerades as a phase fails admission', () => {
    const md = CLEAN.replace('### T0.1 Add projectId option to materialize', '### T0.1 Phase A — Add projectId option to materialize');
    const v = lintSpec(md);
    assert.match(v.join('\n'), /T0\.1.*masquerades as a phase/s);
  });

  test('lintSpec GREEN: a normal task title is not flagged for level confusion', () => {
    assert.equal(lintSpec(CLEAN).some((m) => /masquerades as a phase/.test(m)), false);
  });
});
