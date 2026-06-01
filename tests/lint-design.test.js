import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lintDesignMd, parseSections } from '../scripts/lint-design.js';

// A complete, valid non-migration design.md.
const GOOD = `# Redesign the matcher

## Context

The matcher joins on tenant_id and produces duplicates.

## Decisions

We will dedupe at the query layer, not in the consumer.

## Chosen approach

Considered (a) consumer-side dedupe and (b) a window function.
Chose (b) — it is set-based and testable.

## Non-goals

Not touching the ingestion path.
`;

describe('lintDesignMd — section presence (R-XAGENT-06)', () => {
  test('GREEN: Decisions + Chosen approach present with content → no violations', () => {
    assert.deepEqual(lintDesignMd(GOOD), []);
  });

  test('GREEN: non-migration does not require Blast radius', () => {
    assert.deepEqual(lintDesignMd(GOOD, { isMigration: false }), []);
  });

  test('RED: missing Decisions → violation', () => {
    const md = GOOD.replace('## Decisions\n\nWe will dedupe at the query layer, not in the consumer.\n\n', '');
    const v = lintDesignMd(md);
    assert.equal(v.length, 1);
    assert.match(v.join('\n'), /missing required section "Decisions"/);
  });

  test('RED: missing Chosen approach → violation', () => {
    const md = GOOD.replace(/## Chosen approach[\s\S]*?Chose \(b\) — it is set-based and testable\.\n\n/, '');
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Chosen approach"/);
  });

  test('RED: both required sections missing → two violations', () => {
    const v = lintDesignMd('# Title\n\n## Context\n\nsome prose\n');
    assert.equal(v.length, 2);
  });
});

describe('lintDesignMd — migration blast-radius (R-XAGENT-06)', () => {
  const MIG = GOOD + '\n## Blast radius\n\nThe flat→nested move is one-way; mitigated by copy-verify-delete.\n';

  test('GREEN: migration with Blast radius content → no violations', () => {
    assert.deepEqual(lintDesignMd(MIG, { isMigration: true }), []);
  });

  test('RED: migration missing Blast radius → violation', () => {
    const v = lintDesignMd(GOOD, { isMigration: true });
    assert.equal(v.length, 1);
    assert.match(v.join('\n'), /Blast radius.*required for migrations/);
  });

  test('GREEN: same doc without --migration ignores Blast radius requirement', () => {
    assert.deepEqual(lintDesignMd(GOOD, { isMigration: false }), []);
  });
});

describe('lintDesignMd — empty / placeholder bodies are not satisfied', () => {
  test('RED: Decisions header present but body empty (next header immediately) → violation', () => {
    const md = '# T\n\n## Decisions\n\n## Chosen approach\n\nA vs B; A wins.\n';
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Decisions" is present but empty/);
  });

  test('RED: Chosen approach body is only a TODO placeholder → violation', () => {
    const md = '# T\n\n## Decisions\n\nUse X.\n\n## Chosen approach\n\nTODO\n';
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Chosen approach" is present but empty/);
  });

  test('RED: required section body is only a REPLACE_* / angle placeholder → violation', () => {
    const md = '# T\n\n## Decisions\n\nREPLACE_ME\n\n## Chosen approach\n\n<fill this in>\n';
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Decisions" is present but empty/);
    assert.match(v.join('\n'), /"Chosen approach" is present but empty/);
  });

  test('GREEN: a fenced code block counts as real content', () => {
    const md = '# T\n\n## Decisions\n\n```\nchoice = optionB\n```\n\n## Chosen approach\n\nA vs B; B wins.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });
});

describe('lintDesignMd — heading detection edge cases', () => {
  test('a required heading quoted INSIDE a code fence does not satisfy the requirement', () => {
    const md = '# T\n\n## Chosen approach\n\nA vs B; A wins.\n\n```md\n## Decisions\nnot a real section\n```\n';
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Decisions"/);
  });

  test('case-insensitive: ## DECISIONS matches', () => {
    const md = '# T\n\n## DECISIONS\n\nUse X.\n\n## Chosen Approach\n\nA vs B; A wins.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('hyphenated heading: ## Chosen-approach matches', () => {
    const md = '# T\n\n## Decisions\n\nUse X.\n\n## Chosen-approach\n\nA vs B; A wins.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('snake_case heading: ## Chosen_approach / ## Blast_radius match (underscore → space)', () => {
    const md = '# T\n\n## Decisions\n\nUse X.\n\n## Chosen_approach\n\nA vs B; A wins.\n\n## Blast_radius\n\none-way door, contained.\n';
    assert.deepEqual(lintDesignMd(md, { isMigration: true }), []);
  });

  test('italic-emphasis heading: ## _Decisions_ still matches (underscore → space, then trim)', () => {
    const md = '# T\n\n## _Decisions_\n\nUse X.\n\n## Chosen approach\n\nA vs B.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('any heading level matches (### Decisions under ## Context)', () => {
    const md = '# T\n\n## Context\n\nbg\n\n### Decisions\n\nUse X.\n\n### Chosen approach\n\nA vs B.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('H3 subsections are part of the parent section body (not a new top section boundary for content)', () => {
    const md = '# T\n\n## Decisions\n\n### sub\n\nUse X under a subsection.\n\n## Chosen approach\n\nA vs B.\n';
    assert.deepEqual(lintDesignMd(md), []);
  });
});

describe('lintDesignMd — guards', () => {
  test('empty string → violations (not a crash)', () => {
    const v = lintDesignMd('');
    assert.ok(v.length >= 1);
  });

  test('non-string input → single violation', () => {
    assert.deepEqual(lintDesignMd(null), ['design.md is empty or unreadable']);
  });

  test('parseSections is exported and returns normalized titles', () => {
    const secs = parseSections('# A\n\n## Chosen Approach\n\nx\n');
    assert.equal(secs.find((s) => s.level === 2).normTitle, 'chosen approach');
  });
});
