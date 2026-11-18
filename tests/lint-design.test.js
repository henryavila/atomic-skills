import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lintDesignMd, parseSections } from '../scripts/lint-design.js';

// A complete, valid non-migration design.md (all always-required sections).
const GOOD = `# Redesign the matcher

## Context

The matcher joins on tenant_id and produces duplicates.

## Interview

Problem: duplicate rows per tenant. In-scope: query layer. Out-of-scope: ingestion.
Done-when: design lint-clean. Stakes: one-way process door for multi-phase DESIGN.

## Decisions

We will dedupe at the query layer, not in the consumer.

## Chosen approach

Considered (a) consumer-side dedupe and (b) a window function.
Chose (b) — it is set-based and testable.

## Non-goals

Not touching the ingestion path.
`;

/** Strip one always-required section (heading + body until next ##/end). */
function withoutSection(md, headingLabel) {
  const re = new RegExp(
    `## ${headingLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\n[\\s\\S]*?(?=\\n## |$)`,
    'i',
  );
  return md.replace(re, '');
}

describe('lintDesignMd — section presence (R-XAGENT-06)', () => {
  test('GREEN: Context + Non-goals + Interview + Decisions + Chosen approach present with content → no violations', () => {
    assert.deepEqual(lintDesignMd(GOOD), []);
  });

  test('GREEN: non-migration does not require Blast radius', () => {
    assert.deepEqual(lintDesignMd(GOOD, { isMigration: false }), []);
  });

  test('RED: missing Decisions → violation', () => {
    const md = withoutSection(GOOD, 'Decisions');
    const v = lintDesignMd(md);
    assert.ok(v.some((m) => /missing required section "Decisions"/.test(m)));
  });

  test('RED: missing Chosen approach → violation', () => {
    const md = withoutSection(GOOD, 'Chosen approach');
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Chosen approach"/);
  });

  test('RED: missing Context → violation', () => {
    const md = withoutSection(GOOD, 'Context');
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Context"/);
  });

  test('RED: missing Non-goals → violation', () => {
    const md = withoutSection(GOOD, 'Non-goals');
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Non-goals"/);
  });

  test('RED: missing Interview → violation', () => {
    const md = withoutSection(GOOD, 'Interview');
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Interview"/);
  });

  test('RED: only title + Context prose → five always-required violations', () => {
    const v = lintDesignMd('# Title\n\n## Context\n\nsome prose\n');
    // Context present; missing Non-goals, Interview, Decisions, Chosen approach
    assert.equal(v.length, 4);
    assert.match(v.join('\n'), /Non-goals/);
    assert.match(v.join('\n'), /Interview/);
    assert.match(v.join('\n'), /Decisions/);
    assert.match(v.join('\n'), /Chosen approach/);
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
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

## Chosen approach

A vs B; A wins.

## Non-goals

not X
`;
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Decisions" is present but empty/);
  });

  test('RED: Chosen approach body is only a TODO placeholder → violation', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

Use X.

## Chosen approach

TODO

## Non-goals

not X
`;
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Chosen approach" is present but empty/);
  });

  test('RED: required section body is only a REPLACE_* / angle placeholder → violation', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

REPLACE_ME

## Chosen approach

<fill this in>

## Non-goals

not X
`;
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Decisions" is present but empty/);
    assert.match(v.join('\n'), /"Chosen approach" is present but empty/);
  });

  test('RED: empty Context / Non-goals / Interview bodies fail', () => {
    const md = `# T

## Context

TODO

## Interview

TBD

## Decisions

Use X.

## Chosen approach

A vs B; B wins.

## Non-goals

REPLACE_ME
`;
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /"Context" is present but empty/);
    assert.match(v.join('\n'), /"Interview" is present but empty/);
    assert.match(v.join('\n'), /"Non-goals" is present but empty/);
  });

  test('GREEN: a fenced code block counts as real content', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

\`\`\`
choice = optionB
\`\`\`

## Chosen approach

A vs B; B wins.

## Non-goals

not X
`;
    assert.deepEqual(lintDesignMd(md), []);
  });
});

describe('lintDesignMd — heading detection edge cases', () => {
  test('a required heading quoted INSIDE a code fence does not satisfy the requirement', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Chosen approach

A vs B; A wins.

## Non-goals

not X

\`\`\`md
## Decisions
not a real section
\`\`\`
`;
    const v = lintDesignMd(md);
    assert.match(v.join('\n'), /missing required section "Decisions"/);
  });

  test('case-insensitive: ## DECISIONS / ## CONTEXT / ## INTERVIEW match', () => {
    const md = `# T

## CONTEXT

bg

## INTERVIEW

spine

## DECISIONS

Use X.

## Chosen Approach

A vs B; A wins.

## NON-GOALS

not X
`;
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('hyphenated heading: ## Chosen-approach / ## Non-goals match', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

Use X.

## Chosen-approach

A vs B; A wins.

## Non-goals

not X
`;
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('snake_case heading: ## Chosen_approach / ## Blast_radius / ## Non_goals match', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

Use X.

## Chosen_approach

A vs B; A wins.

## Non_goals

not X

## Blast_radius

one-way door, contained.
`;
    assert.deepEqual(lintDesignMd(md, { isMigration: true }), []);
  });

  test('italic-emphasis heading: ## _Decisions_ still matches (underscore → space, then trim)', () => {
    const md = `# T

## Context

bg

## Interview

spine

## _Decisions_

Use X.

## Chosen approach

A vs B.

## Non-goals

not X
`;
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('any heading level matches (### Decisions under ## Context)', () => {
    // Context is H2 with body "bg"; Decisions/Chosen approach/etc. are H3 under it —
    // each still matches by title regardless of level.
    const md = `# T

## Context

bg

### Interview

spine

### Decisions

Use X.

### Chosen approach

A vs B.

### Non-goals

not X
`;
    assert.deepEqual(lintDesignMd(md), []);
  });

  test('H3 subsections are part of the parent section body (not a new top section boundary for content)', () => {
    const md = `# T

## Context

bg

## Interview

spine

## Decisions

### sub

Use X under a subsection.

## Chosen approach

A vs B.

## Non-goals

not X
`;
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
