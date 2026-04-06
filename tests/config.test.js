import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { IDE_CONFIG, getSkillPath, getSkillFormat, SKILL_NAMESPACE, getNamespaceRootPath } from '../src/config.js';

describe('IDE config', () => {
  it('defines all 7 IDEs', () => {
    const ids = Object.keys(IDE_CONFIG);
    assert.deepStrictEqual(ids.sort(), [
      'claude-code', 'codex', 'cursor', 'gemini', 'gemini-commands', 'github-copilot', 'opencode'
    ]);
  });

  it('returns correct skill path for claude-code command IDE', () => {
    const path = getSkillPath('claude-code', 'fix');
    assert.strictEqual(path, '.claude/commands/atomic-skills/fix.md');
  });

  it('returns correct skill path for gemini skills IDE', () => {
    const path = getSkillPath('gemini', 'fix');
    assert.strictEqual(path, '.gemini/skills/atomic-skills/fix/SKILL.md');
  });

  it('returns correct skill path for gemini toml commands', () => {
    const path = getSkillPath('gemini-commands', 'fix');
    assert.strictEqual(path, '.gemini/commands/atomic-skills-fix.toml');
  });

  it('exports SKILL_NAMESPACE constant', () => {
    assert.strictEqual(SKILL_NAMESPACE, 'atomic-skills');
  });

  it('returns command format for claude-code', () => {
    assert.strictEqual(getSkillFormat('claude-code'), 'command');
  });

  it('returns markdown format for gemini skills', () => {
    assert.strictEqual(getSkillFormat('gemini'), 'markdown');
  });

  it('returns toml format for gemini commands', () => {
    assert.strictEqual(getSkillFormat('gemini-commands'), 'toml');
  });

  it('all IDEs declare supportsUserScope as boolean', () => {
    for (const [id, cfg] of Object.entries(IDE_CONFIG)) {
      assert.strictEqual(typeof cfg.supportsUserScope, 'boolean',
        `${id} missing supportsUserScope`);
    }
  });

  it('can filter IDEs by supportsUserScope', () => {
    const userIDEs = Object.entries(IDE_CONFIG)
      .filter(([_, cfg]) => cfg.supportsUserScope);
    // All IDEs currently support user scope
    assert.strictEqual(userIDEs.length, Object.keys(IDE_CONFIG).length);
  });

  it('returns namespace root path for markdown IDEs', () => {
    assert.strictEqual(getNamespaceRootPath('cursor'), '.cursor/skills/atomic-skills/SKILL.md');
    assert.strictEqual(getNamespaceRootPath('gemini'), '.gemini/skills/atomic-skills/SKILL.md');
  });

  it('returns null for non-markdown IDEs', () => {
    assert.strictEqual(getNamespaceRootPath('claude-code'), null);
    assert.strictEqual(getNamespaceRootPath('gemini-commands'), null);
  });
});
