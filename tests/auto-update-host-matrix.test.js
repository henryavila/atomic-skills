/**
 * F2/T-002 — auto-update is conditional on host capability and install scope.
 * Codex-only must not mutate Claude settings; project-scope alerts include
 * `--project`; user-scope does not.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineInstaller } from '@henryavila/minimalist-installer';
import { createStageRuntimeArtifactsEffect } from '../src/runtime-layers/effects/stage-runtime-artifacts.js';
import {
  createAutoUpdateRuntimeProvider,
  resolveAutoUpdateHosts,
  GROK_AUTO_UPDATE_HOOK_REL,
  buildUpdateCommand,
} from '../src/runtime-layers/auto-update.js';
import { AUTO_UPDATE_HOST_CAPABILITIES } from '../src/config.js';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'as-autoupdate-matrix-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeSkillsDir(root) {
  const skillsDir = join(root, 'skills');
  mkdirSync(join(skillsDir, 'shared', 'auto-update-hook'), { recursive: true });
  writeFileSync(
    join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh'),
    '#!/usr/bin/env bash\necho hi\n',
  );
  return skillsDir;
}

describe('auto-update host capability matrix (F2/T-002)', () => {
  it('declares session-start capability only for Claude and Grok', () => {
    assert.equal(AUTO_UPDATE_HOST_CAPABILITIES['claude-code']?.capability, 'session-start-hook');
    assert.equal(AUTO_UPDATE_HOST_CAPABILITIES.grok?.capability, 'session-start-hook');
    assert.equal(AUTO_UPDATE_HOST_CAPABILITIES.codex?.capability ?? 'none', 'none');
    assert.equal(AUTO_UPDATE_HOST_CAPABILITIES.cursor?.capability ?? 'none', 'none');
  });

  it('resolveAutoUpdateHosts: codex-only registers neither Claude nor Grok', () => {
    assert.deepEqual(resolveAutoUpdateHosts({ ides: ['codex'] }), {
      registerClaude: false,
      registerGrok: false,
    });
  });

  it('resolveAutoUpdateHosts: cursor+opencode+github-copilot → no hook surfaces', () => {
    assert.deepEqual(
      resolveAutoUpdateHosts({ ides: ['cursor', 'opencode', 'github-copilot'] }),
      { registerClaude: false, registerGrok: false },
    );
  });

  it('codex-only install stages no Claude settings and no Grok hook file', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      const installer = defineInstaller({
        effects: [createStageRuntimeArtifactsEffect()],
        providers: [createAutoUpdateRuntimeProvider()],
        config: { manifestDir: '.atomic-skills', skillsDir, ides: ['codex'] },
      });
      installer.install({ projectDir });

      assert.equal(
        existsSync(join(projectDir, '.claude', 'settings.json')),
        false,
        'Codex-only must not create .claude/settings.json',
      );
      assert.equal(
        existsSync(join(projectDir, GROK_AUTO_UPDATE_HOOK_REL)),
        false,
        'Codex-only must not create Grok auto-update hook',
      );
      // Hook script may still stage when no host registers — prefer not staging
      // when zero capable hosts, so uninstall leaves no residue.
      assert.equal(
        existsSync(join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh')),
        false,
        'zero capable hosts → do not stage version-check.sh',
      );
    });
  });

  it('claude-only registers Claude SessionStart; grok-only registers Grok surface', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const claudeDir = join(root, 'claude-install');
      mkdirSync(claudeDir, { recursive: true });
      defineInstaller({
        effects: [createStageRuntimeArtifactsEffect()],
        providers: [createAutoUpdateRuntimeProvider()],
        config: { manifestDir: '.atomic-skills', skillsDir, ides: ['claude-code'] },
      }).install({ projectDir: claudeDir });
      assert.ok(existsSync(join(claudeDir, '.claude', 'settings.json')));
      assert.equal(existsSync(join(claudeDir, GROK_AUTO_UPDATE_HOOK_REL)), false);

      const grokDir = join(root, 'grok-install');
      mkdirSync(grokDir, { recursive: true });
      defineInstaller({
        effects: [createStageRuntimeArtifactsEffect()],
        providers: [createAutoUpdateRuntimeProvider()],
        config: { manifestDir: '.atomic-skills', skillsDir, ides: ['grok'] },
      }).install({ projectDir: grokDir });
      assert.ok(existsSync(join(grokDir, GROK_AUTO_UPDATE_HOOK_REL)));
      assert.equal(existsSync(join(grokDir, '.claude', 'settings.json')), false);
    });
  });

  it('buildUpdateCommand is scope-aware', () => {
    assert.equal(
      buildUpdateCommand('user'),
      'npx -y @henryavila/atomic-skills@latest install --yes',
    );
    assert.equal(
      buildUpdateCommand('project'),
      'npx -y @henryavila/atomic-skills@latest install --yes --project',
    );
  });

  it('version-check.sh embeds scope-aware update commands', () => {
    const script = readFileSync(
      join(process.cwd(), 'skills', 'shared', 'auto-update-hook', 'version-check.sh'),
      'utf8',
    );
    assert.ok(
      script.includes('--project'),
      'project-scope update path must mention --project',
    );
    assert.ok(
      /SCOPE=.*project|SCOPE == ["']project["']|\[\[.*"\$SCOPE".*project/s.test(script)
        || script.includes('SCOPE="project"')
        || script.includes("if [[ \"$SCOPE\" == \"project\" ]]")
        || script.includes('if [ "$SCOPE" = "project" ]'),
      'script must branch on SCOPE for the recommended command',
    );
    // User-scope recommendation must not force --project
    assert.ok(
      /install --yes(?! --project)/.test(script)
        || script.includes('install --yes`')
        || script.includes("install --yes'"),
      'user-scope path must offer install --yes without --project',
    );
  });
});
