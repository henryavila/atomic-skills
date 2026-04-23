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
    assert.ok(content.includes('@henryavila/mdprobe'));
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

  it('renders PT skill file with Portuguese headings + same substantive sections', () => {
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
    assert.ok(content.includes('Regra Fundamental'), 'PT file must have Portuguese Iron Law header');
    assert.ok(content.includes('Setup (quando'), 'PT file must have Portuguese setup section');
    assert.ok(content.includes('Modos de mutação'), 'PT file must have Portuguese mutation modes');
    assert.ok(content.includes('Red Flags'), 'PT file must have Red Flags section');
    assert.ok(content.includes('Racionalização'), 'PT file must have Rationalization section');
  });

  it('bootstrap-draft template exists with required markers', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-draft.template.md');
    const content = readFileSync(tplPath, 'utf8');
    for (const marker of [
      'REPLACE_CANONICAL_SLUG', 'REPLACE_PROPOSED_AT', 'REPLACE_PROPOSED_BUCKET',
      'REPLACE_STARTED_DATE', 'REPLACE_LAST_UPDATED', 'REPLACE_BRANCH',
      'REPLACE_PLAN_LINK', 'REPLACE_TITLE', 'REPLACE_NEXT_ACTION',
      'REPLACE_RATIONALE', 'REPLACE_CONFIDENCE', 'REPLACE_SLUG_MATCH_TYPE',
      'REPLACE_CONTEXT_PARAGRAPHS', 'REPLACE_EVIDENCE_BLOCK',
    ]) {
      assert.ok(content.includes(marker), `missing marker: ${marker}`);
    }
    assert.ok(content.includes('status: proposed'));
    assert.ok(content.match(/bootstrap:\s*$/m), 'must have bootstrap: yaml block');
  });

  it('bootstrap-archived template exists with historical-specific fields', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-archived.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('status: proposed-archived'));
    assert.ok(content.includes('REPLACE_HISTORICAL_REASON'));
    assert.ok(!content.includes('next_action'), 'historical drafts must not define next_action');
  });

  it('bootstrap-index template has 3 bucket sections + Already tracked', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-index.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('## ✓ Strong candidates'));
    assert.ok(content.includes('## ? Worth reviewing'));
    assert.ok(content.includes('## ◉ Historical'));
    assert.ok(content.includes('## Already tracked'));
    assert.ok(content.includes('bootstrap --commit'));
    assert.ok(content.includes('Delete the draft file to skip'));
  });

  it('skill documents bootstrap subcommand and options (pt)', () => {
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
    for (const token of ['bootstrap', '--dry-run', '--commit', '--scope']) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
  });

  it('skill documents Phase 1a shell commands for all Layer 1 sources', () => {
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
    for (const cmd of [
      'git for-each-ref',
      'git log --since',
      'gh pr list',
      'docs/superpowers/plans',
      'TODO.md',
      '.ai/memory',
    ]) {
      assert.ok(content.includes(cmd), `missing scan command: ${cmd}`);
    }
  });
});
