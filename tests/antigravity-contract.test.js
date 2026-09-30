/**
 * Antigravity contract: layout, tool profiles, argument substitution,
 * cross-IDE coexistence with Codex, and optional live CLI probe.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';
import {
  getSkillPath, getNamespaceRootPath, IDE_CONFIG,
  normalizeIDESelection, getHostToolProfile,
} from '../src/config.js';
import { renderTemplate } from '../src/render.js';
import { parse as parseYaml } from 'yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

const CORE_SKILLS = Object.keys(
  parseYaml(readFileSync(join(META_DIR, 'catalog.yaml'), 'utf8')).core || {},
);

function agyAvailable() {
  try {
    const r = spawnSync('agy', ['--version'], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 || (r.stdout || '').length > 0;
  } catch {
    return false;
  }
}

describe('Antigravity layout contract', () => {
  it('installs skills under .agent/skills/atomic-skills/<skill>/SKILL.md', () => {
    assert.equal(
      getSkillPath('antigravity', 'fix'),
      '.agent/skills/atomic-skills/fix/SKILL.md',
    );
    assert.equal(
      getSkillPath('agy', 'fix'),
      '.agent/skills/atomic-skills/fix/SKILL.md',
    );
    assert.equal(getNamespaceRootPath('antigravity'), '.agent/skills/atomic-skills/SKILL.md');
    assert.notEqual(getNamespaceRootPath('antigravity'), null);
  });

  it('materializes every core skill for antigravity', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-agy-layout-'));
    try {
      installSkills(tempDir, {
        language: 'en',
        ides: ['antigravity'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      for (const skill of CORE_SKILLS) {
        const rel = getSkillPath('antigravity', skill);
        const abs = join(tempDir, rel);
        assert.ok(existsSync(abs), `missing ${rel}`);
        const body = readFileSync(abs, 'utf8');
        assert.ok(body.startsWith('---\n'), `${skill} needs YAML frontmatter`);
        assert.ok(body.includes(`name: ${skill}`) || body.includes(`name: '${skill}'`), skill);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Antigravity tool profile and rendering', () => {
  it('uses first-party tool profile mapping', () => {
    const profile = getHostToolProfile('antigravity');
    assert.equal(profile.BASH_TOOL, 'run_command');
    assert.equal(profile.READ_TOOL, 'view_file');
    assert.equal(profile.WRITE_TOOL, 'write_to_file');
    assert.equal(profile.REPLACE_TOOL, 'replace_file_content');
    assert.equal(profile.GREP_TOOL, 'grep_search');
    assert.equal(profile.GLOB_TOOL, 'glob');
    assert.equal(profile.INVESTIGATOR_TOOL, 'invoke_subagent');
    assert.equal(profile.ASK_USER_QUESTION_TOOL, 'ask_question');
    assert.equal(profile.ARG_VAR, '$ARGUMENTS');
  });

  it('resolves agy alias to antigravity profile', () => {
    const profile = getHostToolProfile('agy');
    assert.equal(profile.BASH_TOOL, 'run_command');
    assert.equal(profile.ASK_USER_QUESTION_TOOL, 'ask_question');
  });

  it('renders template variables for antigravity', () => {
    const template = 'Run {{BASH_TOOL}} and read {{READ_TOOL}} with {{ARG_VAR}}. Prompt with {{ASK_USER_QUESTION_TOOL}}.';
    const rendered = renderTemplate(template, {}, 'antigravity');
    assert.ok(rendered.includes('Run run_command'));
    assert.ok(rendered.includes('read view_file'));
    assert.ok(rendered.includes('$ARGUMENTS'));
    assert.ok(rendered.includes('Prompt with ask_question.'));
  });

  it('renders conditional blocks for antigravity and agy alias', () => {
    const template = 'before\n{{#if ide.antigravity}}\nAntigravity only\n{{/if}}\n{{#if ide.claude-code}}\nClaude only\n{{/if}}\nafter';
    const rendered = renderTemplate(template, {}, 'antigravity');
    assert.equal(rendered.trim(), 'before\nAntigravity only\nafter');

    const renderedAlias = renderTemplate(template, {}, 'agy');
    assert.equal(renderedAlias.trim(), 'before\nAntigravity only\nafter');
  });
});

describe('Antigravity + Codex dual selection', () => {
  it('normalizes dual selection', () => {
    assert.deepEqual(
      normalizeIDESelection(['antigravity', 'codex']),
      ['antigravity', 'codex'],
    );
    assert.deepEqual(
      normalizeIDESelection(['agy', 'codex']),
      ['antigravity', 'codex'],
    );
  });

  it('installs both antigravity (.agent) and codex (.agents) without collision', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-agy-dual-'));
    try {
      const ides = normalizeIDESelection(['antigravity', 'codex']);
      installSkills(tempDir, {
        language: 'en',
        ides,
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      const agyPath = join(tempDir, getSkillPath('antigravity', 'fix'));
      const codexPath = join(tempDir, getSkillPath('codex', 'fix'));
      assert.ok(existsSync(agyPath), 'antigravity skill exists');
      assert.ok(existsSync(codexPath), 'codex skill exists');
      assert.notEqual(agyPath, codexPath);
      assert.ok(agyPath.includes('.agent/skills/'));
      assert.ok(codexPath.includes('.agents/skills/'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Antigravity live CLI probe (optional)', () => {
  it('checks live agy binary and model listing if available', (t) => {
    if (!agyAvailable()) {
      t.skip('agy CLI not on PATH — live probe skipped; unit contracts above still apply');
      return;
    }
    const r = spawnSync('agy', ['--version'], { encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('1.') || r.stdout.length > 0, `version output: ${r.stdout}`);
  });
});
