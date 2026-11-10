/**
 * An IDE config directory directly under the install base may be a symlink
 * (any IDE). Install reads the link and writes at the final directory.
 * Nested symlinks under that target stay refused.
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installSkills } from '../src/install.js';
import { buildInstaller } from '../src/installer.js';
import { readManifest } from '../src/manifest.js';
import { autoUpdateDropPendingPath } from '../src/runtime-layers/auto-update-drop-revert.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');
const GROK_SKILL_REL = 'plugins/atomic-skills/skills/fix/SKILL.md';
const GROK_HOOK_REL = 'hooks/atomic-skills-auto-update.json';
const CURSOR_SKILL_REL = 'skills/atomic-skills/fix/SKILL.md';
const CLAUDE_SKILL_REL = '.claude/commands/atomic-skills/fix.md';

function installOpts(base, ides) {
  return {
    language: 'en',
    ides,
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'project',
  };
}

describe('IDE root symlink install', () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('writes grok and cursor files at the symlink target and claude in place', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-'));
    const base = join(root, 'home');
    const grokTarget = join(root, 'grok-final');
    const cursorTarget = join(root, 'cursor-final');
    mkdirSync(base, { recursive: true });
    mkdirSync(grokTarget, { recursive: true });
    mkdirSync(cursorTarget, { recursive: true });
    symlinkSync(grokTarget, join(base, '.grok'));
    symlinkSync(cursorTarget, join(base, '.cursor'));

    const result = installSkills(base, installOpts(base, ['claude-code', 'cursor', 'grok']));
    assert.equal(result.verification?.upToDate, true);

    const grokSkill = join(grokTarget, GROK_SKILL_REL);
    const cursorSkill = join(cursorTarget, CURSOR_SKILL_REL);
    const claudeSkill = join(base, CLAUDE_SKILL_REL);
    const grokHook = join(grokTarget, GROK_HOOK_REL);

    assert.equal(lstatSync(join(base, '.grok')).isSymbolicLink(), true);
    assert.equal(lstatSync(join(base, '.cursor')).isSymbolicLink(), true);
    assert.ok(existsSync(grokSkill));
    assert.ok(readFileSync(grokSkill, 'utf8').includes('Root cause'));
    assert.ok(existsSync(cursorSkill));
    assert.ok(existsSync(claudeSkill));
    assert.equal(lstatSync(join(base, '.claude')).isSymbolicLink(), false);
    assert.ok(existsSync(grokHook));
    assert.match(readFileSync(grokHook, 'utf8'), /version-check\.sh/);

    const manifest = readManifest(base);
    assert.equal(manifest.transaction.state, 'complete');
    const owned = manifest.effects
      .find((effect) => effect.type === 'reconcileFileSet')
      .beforeState
      .map((row) => row.path);
    assert.ok(owned.includes('.grok/plugins/atomic-skills/skills/fix/SKILL.md'));
    assert.ok(owned.includes('.cursor/skills/atomic-skills/fix/SKILL.md'));
    const grokRow = manifest.effects
      .find((effect) => effect.type === 'reconcileFileSet')
      .beforeState
      .find((row) => row.path === '.grok/plugins/atomic-skills/skills/fix/SKILL.md');
    assert.equal(grokRow.resolvedBase, realpathSync(grokTarget));

    installSkills(base, installOpts(base, ['claude-code', 'cursor', 'grok']));
    assert.equal(readManifest(base).transaction.state, 'complete');

    buildInstaller({}).uninstall({ projectDir: base });
    assert.equal(existsSync(grokSkill), false);
    assert.equal(existsSync(cursorSkill), false);
    assert.equal(existsSync(claudeSkill), false);
    assert.equal(existsSync(grokHook), false);
    assert.equal(lstatSync(join(base, '.grok')).isSymbolicLink(), true);
    assert.equal(existsSync(grokTarget), true);
  });

  it('refuses a symlink nested under the resolved IDE directory', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-nested-'));
    const base = join(root, 'home');
    const grokTarget = join(root, 'grok-final');
    const outside = join(root, 'outside');
    mkdirSync(base, { recursive: true });
    mkdirSync(grokTarget, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(grokTarget, join(base, '.grok'));
    symlinkSync(outside, join(grokTarget, 'plugins'));
    writeFileSync(join(outside, 'sentinel.txt'), 'SAFE\n');

    assert.throws(
      () => installSkills(base, installOpts(base, ['grok'])),
      (err) => err?.code === 'UNSAFE_PATH_RACE'
        || /symlink|UNSAFE_PATH/i.test(String(err?.message || err)),
    );
    assert.equal(readFileSync(join(outside, 'sentinel.txt'), 'utf8'), 'SAFE\n');
    assert.equal(existsSync(join(outside, 'atomic-skills')), false);
  });

  it('installs claude when an unrelated IDE root symlink is dangling', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-dangling-'));
    const base = join(root, 'home');
    mkdirSync(base, { recursive: true });
    symlinkSync(join(root, 'cursor-missing'), join(base, '.cursor'));

    const result = installSkills(base, installOpts(base, ['claude-code']));
    assert.equal(result.verification?.upToDate, true);
    assert.equal(readManifest(base).transaction.state, 'complete');
    const claudeSkill = join(base, CLAUDE_SKILL_REL);
    assert.ok(existsSync(claudeSkill));
    assert.equal(lstatSync(join(base, '.cursor')).isSymbolicLink(), true);

    buildInstaller({}).uninstall({ projectDir: base });
    assert.equal(existsSync(claudeSkill), false);
    assert.equal(lstatSync(join(base, '.cursor')).isSymbolicLink(), true);
  });

  it('shrinks grok off a symlinked IDE root and leaves no drop ledger', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-shrink-'));
    const base = join(root, 'home');
    const grokTarget = join(root, 'grok-final');
    mkdirSync(base, { recursive: true });
    mkdirSync(grokTarget, { recursive: true });
    symlinkSync(grokTarget, join(base, '.grok'));

    installSkills(base, installOpts(base, ['grok']));
    const grokHook = join(grokTarget, GROK_HOOK_REL);
    const grokSkill = join(grokTarget, GROK_SKILL_REL);
    assert.ok(existsSync(grokHook));
    assert.ok(existsSync(grokSkill));

    const shrunk = installSkills(base, installOpts(base, ['cursor']));
    assert.equal(shrunk.verification?.upToDate, true);
    assert.equal(readManifest(base).transaction.state, 'complete');
    assert.equal(existsSync(grokHook), false);
    assert.equal(existsSync(grokSkill), false);
    assert.equal(existsSync(autoUpdateDropPendingPath(base)), false);
    assert.ok(existsSync(join(base, '.cursor', CURSOR_SKILL_REL)));
    assert.equal(lstatSync(join(base, '.grok')).isSymbolicLink(), true);
    assert.equal(existsSync(grokTarget), true);
  });

  it('uninstall after the symlink is retargeted deletes the journaled tree only', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-retarget-'));
    const base = join(root, 'home');
    const installedAt = join(root, 'grok-installed');
    const retarget = join(root, 'grok-retarget');
    mkdirSync(base, { recursive: true });
    mkdirSync(installedAt, { recursive: true });
    mkdirSync(retarget, { recursive: true });
    const link = join(base, '.grok');
    symlinkSync(installedAt, link);

    installSkills(base, installOpts(base, ['grok']));
    const installedSkill = join(installedAt, GROK_SKILL_REL);
    const installedHook = join(installedAt, GROK_HOOK_REL);
    const skillBytes = readFileSync(installedSkill);
    const hookBytes = readFileSync(installedHook);

    unlinkSync(link);
    symlinkSync(retarget, link);
    const plantedSkill = join(retarget, GROK_SKILL_REL);
    const plantedHook = join(retarget, GROK_HOOK_REL);
    mkdirSync(dirname(plantedSkill), { recursive: true });
    mkdirSync(dirname(plantedHook), { recursive: true });
    writeFileSync(plantedSkill, skillBytes);
    writeFileSync(plantedHook, hookBytes);

    buildInstaller({}).uninstall({ projectDir: base });

    assert.equal(existsSync(installedSkill), false);
    assert.equal(existsSync(installedHook), false);
    assert.equal(readFileSync(plantedSkill).equals(skillBytes), true);
    assert.equal(readFileSync(plantedHook).equals(hookBytes), true);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(existsSync(installedAt), true);
    assert.equal(existsSync(retarget), true);
  });

  it('removes the old target when the symlink is gone and the IDE is installed again', () => {
    root = mkdtempSync(join(tmpdir(), 'as-ide-link-removed-'));
    const base = join(root, 'home');
    const grokTarget = join(root, 'grok-final');
    mkdirSync(base, { recursive: true });
    mkdirSync(grokTarget, { recursive: true });
    const link = join(base, '.grok');
    symlinkSync(grokTarget, link);

    installSkills(base, installOpts(base, ['grok']));
    const oldSkill = join(grokTarget, GROK_SKILL_REL);
    const oldHook = join(grokTarget, GROK_HOOK_REL);
    assert.ok(existsSync(oldSkill));
    assert.ok(existsSync(oldHook));

    unlinkSync(link);
    const again = installSkills(base, installOpts(base, ['grok']));
    assert.equal(again.verification?.upToDate, true);
    assert.equal(readManifest(base).transaction.state, 'complete');
    assert.equal(existsSync(oldSkill), false);
    assert.equal(existsSync(oldHook), false);
    assert.equal(lstatSync(link).isSymbolicLink(), false);

    const newSkill = join(base, '.grok', GROK_SKILL_REL);
    const newHook = join(base, '.grok', GROK_HOOK_REL);
    assert.ok(existsSync(newSkill));
    assert.ok(existsSync(newHook));

    buildInstaller({}).uninstall({ projectDir: base });
    assert.equal(existsSync(newSkill), false);
    assert.equal(existsSync(newHook), false);
    assert.equal(existsSync(oldSkill), false);
    assert.equal(existsSync(oldHook), false);
  });
});
