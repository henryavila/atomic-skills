import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS, getSkillPath, getSkillFormat, getAssetsDir,
  SKILL_NAMESPACE, getNamespaceRootPath, normalizeIDESelection,
} from '../src/config.js';

describe('IDE config', () => {
  it('defines all 8 IDEs', () => {
    const ids = Object.keys(IDE_CONFIG);
    assert.deepStrictEqual(ids.sort(), [
      'claude-code', 'codex', 'cursor', 'gemini', 'gemini-commands', 'github-copilot', 'grok', 'opencode'
    ]);
  });

  it('exports only public IDE ids', () => {
    assert.deepStrictEqual(PUBLIC_IDE_IDS, [
      'claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot', 'grok',
    ]);
  });

  it('normalizes gemini+codex to gemini-commands+codex', () => {
    assert.deepStrictEqual(
      normalizeIDESelection(['claude-code', 'gemini', 'codex']),
      ['claude-code', 'gemini-commands', 'codex']
    );
  });

  it('deduplicates selected IDE ids while preserving order', () => {
    assert.deepStrictEqual(
      normalizeIDESelection(['codex', 'codex', 'claude-code']),
      ['codex', 'claude-code']
    );
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

  it('exposes grok as plugin delivery without .grok/skills path', () => {
    const grok = IDE_CONFIG.grok;
    assert.ok(grok, 'IDE_CONFIG must include grok');
    assert.strictEqual(grok.name, 'Grok Build');
    assert.strictEqual(grok.dir, '.grok/plugins/atomic-skills/skills');
    assert.strictEqual(grok.format, 'markdown');
    assert.strictEqual(grok.delivery, 'plugin');
    assert.strictEqual(grok.supportsUserScope, true);
    assert.strictEqual(
      getSkillPath('grok', 'fix'),
      '.grok/plugins/atomic-skills/skills/fix/SKILL.md',
    );
    assert.ok(
      !getSkillPath('grok', 'fix').includes('.grok/skills/'),
      'grok skill path must not use .grok/skills/',
    );
    assert.strictEqual(
      getAssetsDir('grok'),
      '.grok/plugins/atomic-skills/_assets',
    );
    // Plugin package IS the namespace — no nested atomic-skills/SKILL.md root.
    assert.strictEqual(getNamespaceRootPath('grok'), null);
  });
});
