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
});
