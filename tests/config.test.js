import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS, TESTED_IDE_IDS, getIdeSupportLabel,
  getSkillPath, getSkillFormat, getAssetsDir,
  SKILL_NAMESPACE, getNamespaceRootPath, normalizeIDESelection,
} from '../src/config.js';

describe('IDE config', () => {
  it('defines all 7 IDEs', () => {
    const ids = Object.keys(IDE_CONFIG);
    assert.deepStrictEqual(ids.sort(), [
      'antigravity', 'claude-code', 'codex', 'cursor', 'github-copilot', 'grok', 'opencode'
    ]);
  });

  it('exports only public IDE ids', () => {
    assert.deepStrictEqual(PUBLIC_IDE_IDS, [
      'claude-code', 'cursor', 'antigravity', 'codex', 'opencode', 'github-copilot', 'grok',
    ]);
  });

  it('marks Claude/Cursor/Codex/Grok/Antigravity as product-tested hosts', () => {
    assert.deepStrictEqual([...TESTED_IDE_IDS].sort(), [
      'antigravity', 'claude-code', 'codex', 'cursor', 'grok',
    ]);
    for (const id of TESTED_IDE_IDS) {
      assert.equal(getIdeSupportLabel(id), 'Tested', id);
      assert.ok(Object.hasOwn(IDE_CONFIG, id), id);
    }
    for (const id of Object.keys(IDE_CONFIG)) {
      if (TESTED_IDE_IDS.includes(id)) continue;
      assert.equal(getIdeSupportLabel(id), 'Theoretical', id);
    }
  });

  it('keeps antigravity when codex is also selected', () => {
    assert.deepStrictEqual(
      normalizeIDESelection(['claude-code', 'antigravity', 'codex']),
      ['claude-code', 'antigravity', 'codex']
    );
  });

  it('deduplicates selected IDE ids while preserving order', () => {
    assert.deepStrictEqual(
      normalizeIDESelection(['codex', 'codex', 'claude-code']),
      ['codex', 'claude-code']
    );
  });

  it('normalizes agy and gemini to antigravity and drops unknown IDEs', () => {
    assert.deepStrictEqual(
      normalizeIDESelection(['gemini', 'agy', 'unknown-ide', 'claude-code']),
      ['antigravity', 'claude-code']
    );
  });

  it('returns correct skill path for claude-code command IDE', () => {
    const path = getSkillPath('claude-code', 'fix');
    assert.strictEqual(path, '.claude/commands/atomic-skills/fix.md');
  });

  it('returns correct skill path for antigravity skills IDE', () => {
    const path = getSkillPath('antigravity', 'fix');
    assert.strictEqual(path, '.agent/skills/atomic-skills-fix/SKILL.md');
  });

  it('exports SKILL_NAMESPACE constant', () => {
    assert.strictEqual(SKILL_NAMESPACE, 'atomic-skills');
  });

  it('returns command format for claude-code', () => {
    assert.strictEqual(getSkillFormat('claude-code'), 'command');
  });

  it('returns markdown format for antigravity skills', () => {
    assert.strictEqual(getSkillFormat('antigravity'), 'markdown');
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

  it('returns namespace root path for nested-namespace markdown IDEs', () => {
    assert.strictEqual(getNamespaceRootPath('cursor'), '.cursor/skills/atomic-skills/SKILL.md');
    assert.strictEqual(getNamespaceRootPath('antigravity'), null);
  });

  it('returns null for non-markdown IDEs', () => {
    assert.strictEqual(getNamespaceRootPath('claude-code'), null);
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
