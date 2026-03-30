import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from '../src/config.js';

describe('IDE config', () => {
  it('defines all 7 IDEs', () => {
    const ids = Object.keys(IDE_CONFIG);
    assert.deepStrictEqual(ids.sort(), [
      'claude-code', 'codex', 'cursor', 'gemini', 'gemini-commands', 'github-copilot', 'opencode'
    ]);
  });

  it('returns correct skill path for claude-code markdown IDE', () => {
    const path = getSkillPath('claude-code', 'as-fix');
    assert.strictEqual(path, '.claude/skills/as-fix/SKILL.md');
  });

  it('returns correct skill path for gemini skills IDE', () => {
    const path = getSkillPath('gemini', 'as-fix');
    assert.strictEqual(path, '.gemini/skills/as-fix/SKILL.md');
  });

  it('returns correct skill path for gemini toml commands', () => {
    const path = getSkillPath('gemini-commands', 'as-fix');
    assert.strictEqual(path, '.gemini/commands/as-fix.toml');
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
});
