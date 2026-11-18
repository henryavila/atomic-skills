/**
 * Tests for find-weak-design (soft-language, non-goals echo, short interview, weak digest).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  weakDesignIssues,
  weakDigestIssues,
  findWeakDesign,
  SOFT_LANGUAGE_RE,
  MIN_INTERVIEW_LENGTH,
} from '../scripts/find-weak-design.js';

const SCRIPT = fileURLToPath(new URL('../scripts/find-weak-design.js', import.meta.url));

const STRONG_INTERVIEW = `
| Campo | Conteúdo |
|-------|----------|
| **Problema** | Brainstorm fraco e monólito de create-plan aumentam ignore rate |
| **In-scope** | Interview, research digest, debate always, stage router |
| **Out-of-scope** | BMAD technique CSV e research web |
| **Done-when** | design lint-clean + critic Approved + user approval |
`.trim();

const STRONG_DESIGN = `# Design: sample

## Context

This multi-phase plan hardens brainstorm fidelity with receipts and stage files
so agents cannot skip Interview, research, or debate on the hot path.

## Interview

${STRONG_INTERVIEW}

## Non-goals

- Port BMAD technique CSV or 100+ idea quotas
- Force debate on adopt / ad-hoc / single-task lanes
- Rewrite Stage 8 review-plan content

## Decisions

1. Interview first before research and debate.
2. Always run debate --gate for multi-phase DESIGN.
3. Fidelity via stage files plus exit codes, not more Red Flags.

## Chosen approach

Full process package: interview, research digest, debate, lints, receipts,
creation stage assert, and thin create-plan router.
`;

const STRONG_DIGEST = `# Research digest — sample

## Findings
- **skills/core/brainstorm.md**: B1 still documents skip ladder risk; needs always-debate.
- **scripts/lint-design.js**: only Decisions + Chosen approach historically required.
- **skills/shared/project-assets/project-create-plan.md**: monólito ~550 lines increases ignore.

## Open risks
- Agents may skip process without exit-code enforcers.
`;

function runCli(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd,
  });
}

describe('weakDesignIssues', () => {
  it('returns empty for a strong design', () => {
    assert.deepEqual(weakDesignIssues(STRONG_DESIGN), []);
  });

  it('flags soft-language in decisions', () => {
    const md = STRONG_DESIGN.replace(
      'Interview first before research and debate.',
      'We should probably interview first before research and debate.',
    );
    assert.match('should probably', SOFT_LANGUAGE_RE);
    const issues = weakDesignIssues(md);
    assert.ok(issues.some((i) => i.reason === 'soft-language'));
  });

  it('flags non-goals echo of context', () => {
    const md = `# Design

## Context

Hardens brainstorm with receipts and stage files for multi-phase plans.

## Interview

${STRONG_INTERVIEW}

## Non-goals

Hardens brainstorm with receipts and stage files for multi-phase plans.

## Decisions

1. Always debate for multi-phase DESIGN work in this repository.

## Chosen approach

C — full process package with stage router and exit codes.
`;
    const issues = weakDesignIssues(md);
    assert.ok(
      issues.some((i) => i.field === 'non-goals' && i.reason === 'echo-of-context'),
      JSON.stringify(issues),
    );
  });

  it('flags short interview', () => {
    const md = `# Design

## Context

Hardens brainstorm with receipts and stage files for multi-phase plans today.

## Interview

ok yes

## Non-goals

- No BMAD technique CSV port in this plan

## Decisions

1. Always debate for multi-phase DESIGN work in this repository path.

## Chosen approach

C — full process package with stage router and exit codes for fidelity.
`;
    const issues = weakDesignIssues(md);
    assert.ok(issues.some((i) => i.field === 'interview' && /too-short/.test(i.reason)));
    assert.ok(STRONG_INTERVIEW.length >= MIN_INTERVIEW_LENGTH);
  });
});

describe('weakDigestIssues', () => {
  it('accepts strong digest', () => {
    assert.deepEqual(weakDigestIssues(STRONG_DIGEST), []);
  });

  it('fails empty digest', () => {
    const issues = weakDigestIssues('   ');
    assert.ok(issues.some((i) => i.reason === 'empty'));
  });

  it('fails zero paths', () => {
    const issues = weakDigestIssues(`# Digest
- Something vague without a concrete file path at all.
- Another bullet that is long enough but still pathless text.
- Third bullet also pathless which should trip the zero-paths bar.
`);
    assert.ok(issues.some((i) => i.reason === 'zero-paths'), JSON.stringify(issues));
  });

  it('fails few bullets', () => {
    const issues = weakDigestIssues(
      `# Digest\n- **skills/core/brainstorm.md**: only one useful bullet present.\n`,
    );
    assert.ok(issues.some((i) => /few-bullets/.test(i.reason)), JSON.stringify(issues));
  });
});

describe('findWeakDesign + CLI', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fwd-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('aggregates design + digest issues', () => {
    const issues = findWeakDesign(STRONG_DESIGN, 'looked around');
    assert.ok(issues.some((i) => i.field === 'research-digest'));
  });

  it('CLI exits 0 for strong design + digest', () => {
    const d = join(root, 'design.md');
    const r = join(root, 'research-digest.md');
    writeFileSync(d, STRONG_DESIGN);
    writeFileSync(r, STRONG_DIGEST);
    const res = runCli([d, r], root);
    assert.equal(res.status, 0, res.stderr);
  });

  it('CLI exits 1 for soft-language', () => {
    const d = join(root, 'design.md');
    writeFileSync(
      d,
      STRONG_DESIGN.replace(
        'Always run debate --gate for multi-phase DESIGN.',
        'We should typically run debate --gate for multi-phase DESIGN.',
      ),
    );
    const res = runCli([d], root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /soft-language|HARD-BLOCK/);
  });

  it('CLI --lane adopt exits 0 (R-ORCH-03 exempt)', () => {
    const res = runCli(['--lane', 'adopt', join(root, 'missing.md')], root);
    assert.equal(res.status, 0);
  });
});
