import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const META_DIR = join(__dirname, '..', 'meta');

describe('project-status skill', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-ps-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('renders skill file for claude-code without template leaks', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(!content.includes('{{BASH_TOOL}}'), '{{BASH_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ARG_VAR}}'), '{{ARG_VAR}} must be rendered');
    assert.ok(content.includes('Iron Law') || content.includes('Regra Fundamental'));
  });

  it('skill references view modes default/--list/--stack/--archived', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('--list'));
    assert.ok(content.includes('--stack'));
    assert.ok(content.includes('--archived'));
  });

  it('skill documents all mutation commands', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    for (const cmd of ['new', 'push', 'pop', 'park', 'emerge', 'promote', 'done', 'archive', 'switch']) {
      assert.ok(
        new RegExp(`\\b${cmd}\\b`).test(content),
        `missing command: ${cmd}`
      );
    }
  });

  it('skill documents disambiguation, --browser, --report', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.toLowerCase().includes('disambig'));
    assert.ok(content.includes('--browser'));
    assert.ok(content.includes('--report'));
    // --browser opens the aiDeck dashboard (the browser surface migrated from
    // mdprobe to aiDeck; mdprobe still lives in project-plan/parallel-dispatch).
    assert.ok(content.includes('aiDeck'));
  });

  it('renders skill for gemini with proper tool name substitution', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['gemini'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.gemini/skills/atomic-skills/project-status/SKILL.md'),
      'utf8'
    );
    assert.ok(content.includes('run_shell_command'), 'Gemini should get run_shell_command');
    assert.ok(!content.includes('{{BASH_TOOL}}'));
  });

  it('install with language=pt injects PT communication directive at top of body', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(!content.includes('{{BASH_TOOL}}'), '{{BASH_TOOL}} must be rendered');
    // Communication-language directive injected by render.js for language=pt.
    assert.ok(
      content.includes('Communicate with the user in Portuguese'),
      'must inject PT communication directive at top of body'
    );
    // Same EN canonical body sections must still be present (skill source is always EN).
    assert.ok(content.includes('Iron Law'), 'must have EN Iron Law section');
    assert.ok(content.includes('Setup'), 'must have setup section');
    assert.ok(content.includes('Mutation modes'), 'must have mutation modes section');
    assert.ok(content.includes('Red Flags'), 'must have Red Flags section');
  });

  it('install with language=en injects EN communication directive at top of body', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(
      content.includes('Communicate with the user in English'),
      'must inject EN communication directive at top of body'
    );
  });

  it('bootstrap-draft template exists with required markers', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-draft.template.md');
    const content = readFileSync(tplPath, 'utf8');
    for (const marker of [
      'REPLACE_CANONICAL_SLUG', 'REPLACE_PROPOSED_AT', 'REPLACE_PROPOSED_BUCKET',
      'REPLACE_STARTED_ISO_TIMESTAMP', 'REPLACE_LAST_UPDATED', 'REPLACE_BRANCH',
      'REPLACE_PLAN_LINK', 'REPLACE_TITLE', 'REPLACE_NEXT_ACTION', 'REPLACE_GOAL',
      'REPLACE_RATIONALE', 'REPLACE_CONFIDENCE', 'REPLACE_SLUG_MATCH_TYPE',
      'REPLACE_CONTEXT_PARAGRAPHS', 'REPLACE_EVIDENCE_BLOCK',
    ]) {
      assert.ok(content.includes(marker), `missing marker: ${marker}`);
    }
    assert.ok(content.includes('status: proposed'));
    assert.ok(content.match(/bootstrap:\s*$/m), 'must have bootstrap: yaml block');
    // New 3-level schema markers (camelCase, schemaVersion 0.1).
    assert.ok(content.includes("schemaVersion: '0.1'"));
    assert.ok(content.includes('slug:'));
    assert.ok(content.includes('lastUpdated:'));
    assert.ok(content.includes('nextAction:'));
    assert.ok(!content.includes('initiative_id:'), 'legacy snake_case field must be gone');
    assert.ok(!content.includes('scope_paths:'), 'legacy snake_case field must be gone');
  });

  it('bootstrap-archived template exists with historical-specific fields', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-archived.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('status: proposed-archived'));
    assert.ok(content.includes('REPLACE_HISTORICAL_REASON'));
    // Historical drafts set nextAction explicitly null; they must NOT use the legacy snake_case form.
    assert.ok(!content.includes('next_action'), 'historical drafts must not define next_action (legacy snake_case)');
    assert.ok(content.includes('nextAction: null'), 'historical drafts pin nextAction to null');
  });

  it('bootstrap-index template has 3 bucket sections + Already tracked', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-index.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('## ✓ Strong candidates'));
    assert.ok(content.includes('## ? Worth reviewing'));
    assert.ok(content.includes('## ◉ Historical'));
    assert.ok(content.includes('## Already tracked'));
    assert.ok(content.includes('discover --commit'));
    assert.ok(content.includes('Delete the draft file to skip'));
  });

  for (const lang of ['en']) {
    it(`project-plan skill documents discover subcommand and options (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
        'utf8'
      );
      for (const token of ['discover', '--dry-run', '--commit', '--scope']) {
        assert.ok(content.includes(token), `[${lang}] missing token: ${token}`);
      }
    });
  }

  for (const lang of ['en']) {
    it(`project-plan skill documents Phase 1a shell commands for all Layer 1 sources (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
        'utf8'
      );
      const phaseLabel = 'Phase';
      assert.ok(content.includes(`${phaseLabel} 1a`), `[${lang}] missing ${phaseLabel} 1a`);
      for (const cmd of [
        'git for-each-ref',
        'git log --since',
        'gh pr list',
        'docs/superpowers/plans',
        'TODO.md',
        '.ai/memory',
      ]) {
        assert.ok(content.includes(cmd), `[${lang}] missing scan command: ${cmd}`);
      }
    });
  }

  for (const lang of ['en']) {
    it(`project-plan skill documents Phase 1b LLM extraction for narrative sources (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
        'utf8'
      );
      const phaseLabel = 'Phase';
      assert.ok(content.includes(`${phaseLabel} 1b`), `[${lang}] missing ${phaseLabel} 1b`);
      assert.ok(content.includes('topic_hint'), `[${lang}] missing topic_hint`);
      assert.ok(content.includes('evidence_quote'), `[${lang}] missing evidence_quote`);
      assert.ok(content.includes('candidate_completion'), `[${lang}] missing candidate_completion`);
    });
  }

  for (const lang of ['en']) {
    it(`project-plan skill documents Phase 2 clustering, Phase 3 synthesis, Phase 4 commit (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
        'utf8'
      );
      const phaseLabel = 'Phase';
      for (const token of [
        `${phaseLabel} 2`, 'clusterByExactSlug', 'mergeFuzzySingletons', 'pickCanonicalSlug',
        `${phaseLabel} 3`, 'classifyBucket', 'calculateConfidence',
        `${phaseLabel} 4`, 'draftToInitiative', 'bootstrap-drafts',
        'INDEX.md', 'mdprobe',
      ]) {
        assert.ok(content.includes(token), `[${lang}] missing token: ${token}`);
      }
    });
  }

  for (const lang of ['en']) {
    it(`setup flow offers bootstrap and updates gitignore (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
        'utf8'
      );
      // The setup section 7 (gitignore) must include bootstrap-drafts/
      assert.ok(
        content.match(/bootstrap-drafts/),
        `[${lang}] setup must mention bootstrap-drafts in .gitignore section`
      );
    });
  }

  // ─── 3-level model (B.T-005, then split between status + plan) ──────────
  it('skill bodies document 3-level commands across the project-status/project-plan split', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const statusContent = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    const planContent = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
      'utf8'
    );
    // Status owns daily mutations + transitions
    for (const cmd of ['phase-done', 'phase-reopen', 'detect-scope']) {
      assert.ok(
        statusContent.includes('### `' + cmd),
        `project-status body must document: ${cmd}`
      );
    }
    // Plan owns creation + migration + structural
    for (const cmd of ['discover', 'adopt', 'new', 'migrate']) {
      assert.ok(
        planContent.includes('## `' + cmd),
        `project-plan body must document: ${cmd}`
      );
    }
  });

  it('skill body documents --plan and --phase view modes', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('### `--plan'), 'must document --plan view mode');
    assert.ok(content.includes('### `--phase'), 'must document --phase view mode');
  });

  it('skill body documents the pre-mutation migration check + 5 disambiguation options', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('Pre-mutation migration check'), 'must document pre-mutation check');
    assert.ok(content.includes('migrateLegacyInitiative'), 'must reference the migration function');
    // 5-option disambiguation flow (vs the old 4).
    for (const opt of ['(a)', '(b)', '(c)', '(d)', '(e)']) {
      assert.ok(content.includes(opt), `disambiguation flow must include option ${opt}`);
    }
    assert.ok(content.includes('New phase initiative'), 'must offer phase-initiative option');
    assert.ok(content.includes('standalone'), 'must offer standalone option');
  });

  it('skill body documents schema reference (Plan / Initiative / Task fields)', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('Schema reference'), 'must have Schema reference section');
    // Spot-check core required fields per shape.
    for (const field of [
      'currentPhase', 'parallelismAllowed', 'phases[]',          // Plan
      'parentPlan', 'phaseId', 'exitGates[]', 'scope',           // Initiative
      'StackFrame', 'CrossTaskRef', 'ExitCriterion',             // Nested
      'shell', 'query', 'test', 'manual',                        // Verifier kinds
    ]) {
      assert.ok(content.includes(field), `Schema reference must mention: ${field}`);
    }
  });

  it('skill body uses camelCase fields, no legacy snake_case in canonical state contexts', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    // Legacy snake_case fields must NOT appear as canonical references.
    // (`scope_paths`, `initiative_id`, `last_updated`, `next_action`, `opened_at`,
    //  `surfaced_at`, `from_frame` were the v1 field names — all renamed for 0.1.)
    for (const legacy of [
      'initiative_id', 'scope_paths', 'opened_at',
      'surfaced_at', 'from_frame',
    ]) {
      assert.ok(
        !content.includes(legacy),
        `skill body must not reference legacy field: ${legacy}`
      );
    }
    // `next_action` survives in the bootstrap-archived test assertion context,
    // but the skill body itself should be camelCase only.
    // `last_updated` appears in shell command snippets that use `date -u` output;
    // those are commands, not field names — they're fine. But the field references
    // must be `lastUpdated`.
    assert.ok(content.includes('lastUpdated'), 'must use camelCase `lastUpdated` field');
    assert.ok(content.includes('nextAction'), 'must use camelCase `nextAction` field');
    assert.ok(content.includes('openedAt'), 'must use camelCase `openedAt` field');
    assert.ok(content.includes('surfacedAt'), 'must use camelCase `surfacedAt` field');
    assert.ok(content.includes('fromFrame'), 'must use camelCase `fromFrame` field');
  });

  it('skill body documents Verifier execution patterns workflow (B.T-006)', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('Verifier execution patterns'), 'must have a Verifier execution patterns section');
    assert.ok(content.includes('verify_exit_gate'), 'must name the verify_exit_gate workflow');
    // All 4 verifier kinds get their own treatment.
    for (const kind of ['shell', 'manual', 'query', 'test']) {
      assert.ok(
        content.includes('#### `kind: ' + kind + '`'),
        `must document workflow for verifier kind: ${kind}`
      );
    }
    // Evidence shape documented.
    assert.ok(content.includes('evidence:'), 'must document the evidence YAML block');
    assert.ok(content.includes('verifierKind'), 'evidence block must include verifierKind');
    assert.ok(content.includes('verifiedAt'), 'evidence block must include verifiedAt');
    assert.ok(content.includes('outputSummary'), 'evidence block must include outputSummary');
    // Pre-task verifier workflow exists.
    assert.ok(content.includes('Per-task verifiers'), 'must document tasks[].verifier handling');
  });

  it('skill body documents Plan-aware archive propagation and 2-level switch', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.match(/Plan archival/i), 'archive must document plan propagation');
    assert.ok(content.match(/Plan switch/i), 'switch must document plan-level switching');
    assert.ok(content.match(/propagate/i), 'archive must mention propagation to child initiatives');
  });
});
