import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

import { defineInstaller } from '@henryavila/minimalist-installer';
import { createStageRuntimeArtifactsEffect } from '../../src/runtime-layers/effects/stage-runtime-artifacts.js';
import { createAideckRuntimeProvider } from '../../src/runtime-layers/aideck.js';
import {
  createAutoUpdateRuntimeProvider,
  GROK_AUTO_UPDATE_HOOK_REL,
  CLAUDE_SETTINGS_REL,
  resolveAutoUpdateHosts,
  isAtomicSkillsVersionCheckCommand,
  isShellQuotedVersionCheckCommand,
  reconcileSessionStartVersionCheck,
  reconcileAutoUpdateSessionStartSurfaces,
  resolveDesiredAutoUpdateCommands,
} from '../../src/runtime-layers/auto-update.js';

/**
 * Grok/Claude SessionStart `command` contract for the auto-update hook:
 * - raw absolute path (no shell quotes)
 * - must be absolute so Grok does NOT resolve relative to the hook JSON dir
 *   (quoted paths become `$HOOK_DIR/'/abs/path/version-check.sh'` → ENOENT).
 *
 * Regression: shellQuote around destAbs broke Grok SessionStart (0ms command not found).
 */
function assertHostSafeHookCommand(command, hookAbs, hookJsonPath) {
  assert.equal(typeof command, 'string', 'hook command must be a string');
  assert.equal(
    command,
    hookAbs,
    `SessionStart command must be the raw absolute path to version-check.sh\n`
      + `  expected: ${hookAbs}\n`
      + `  actual:   ${command}`,
  );
  assert.ok(
    isAbsolute(command),
    `SessionStart command must be absolute (Grok joins non-absolute paths to the hook JSON dir). got: ${command}`,
  );
  assert.ok(
    !/^['"]/.test(command) && !/['"]$/.test(command),
    `SessionStart command must not be shell-quoted — hosts resolve the string as a path, not via shell. got: ${command}`,
  );

  // Simulate Grok's resolve: absolute → as-is; else join(dirname(hookJson), command).
  const resolved = isAbsolute(command)
    ? command
    : join(dirname(hookJsonPath), command);
  assert.ok(
    existsSync(resolved),
    `resolved hook path must exist on disk (Grok SessionStart)\n`
      + `  command:  ${command}\n`
      + `  resolved: ${resolved}\n`
      + `  (bug signature: .../hooks/'/abs/.../version-check.sh')`,
  );
}

/** Positive match: only the raw absolute path (no quoted form). */
function isVersionCheckCommand(command, absPath) {
  return typeof command === 'string' && command === absPath;
}

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-layers-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A binary sentinel (PNG magic + a high byte) — proves the staging is binary-safe
// (utf8 round-trip would corrupt byte 0xFF).
const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x10, 0x80]);

function makeFixtures(root) {
  const aideckDir = join(root, 'aideck-pkg');
  mkdirSync(join(aideckDir, 'dist', 'client'), { recursive: true });
  writeFileSync(join(aideckDir, 'dist', 'cli.js'), '// fake aideck cli\n');
  writeFileSync(join(aideckDir, 'dist', 'client', 'index.html'), '<!doctype html><title>aiDeck</title>\n');
  writeFileSync(join(aideckDir, 'dist', 'client', 'logo.png'), BINARY);

  const packageRoot = join(root, 'pkg-root');
  mkdirSync(join(packageRoot, 'assets', 'aideck-consumer'), { recursive: true });
  writeFileSync(join(packageRoot, 'assets', 'aideck-consumer', 'manifest.yaml'), 'id: x\n');
  mkdirSync(join(packageRoot, 'src'), { recursive: true });
  writeFileSync(join(packageRoot, 'src', 'provision-consumer.js'), '// provisioner\n');
  mkdirSync(join(packageRoot, 'scripts'), { recursive: true });
  writeFileSync(join(packageRoot, 'scripts', 'detect-completion.js'), '// detector\n');

  const skillsDir = join(root, 'skills');
  mkdirSync(join(skillsDir, 'shared', 'auto-update-hook'), { recursive: true });
  writeFileSync(join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh'), '#!/usr/bin/env bash\necho hi\n');

  return { aideckDir, packageRoot, skillsDir };
}

test('aiDeck runtime layer — stages artifacts (binary-safe) and reverts to baseline via the journal', () => {
  withTmp((root) => {
    const { aideckDir, packageRoot } = makeFixtures(root);
    const projectDir = join(root, 'install');
    mkdirSync(projectDir, { recursive: true });

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAideckRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', aideckDir, packageRoot },
    });

    installer.install({ projectDir });

    const state = join(projectDir, '.atomic-skills');
    assert.ok(existsSync(join(state, 'bin', 'aideck.mjs')), 'bin shim staged');
    assert.ok(existsSync(join(state, 'dashboard', 'index.html')), 'dashboard staged');
    assert.deepEqual(readFileSync(join(state, 'dashboard', 'logo.png')), BINARY, 'binary asset survives staging');
    assert.ok(existsSync(join(state, 'aideck-consumer', 'manifest.yaml')), 'consumer template staged');
    assert.ok(existsSync(join(state, 'src', 'provision-consumer.js')), 'provisioner staged');
    assert.equal(readFileSync(join(state, 'package-root'), 'utf8'), packageRoot + '\n', 'package-root marker staged');

    installer.uninstall({ projectDir });

    for (const p of ['bin/aideck.mjs', 'dashboard', 'aideck-consumer', 'src/provision-consumer.js', 'package-root']) {
      assert.ok(!existsSync(join(state, p)), `removed ${p} on uninstall`);
    }
  });
});

test('stageRuntimeArtifacts sourceTree refuses to replace a pre-existing non-owned directory', () => {
  withTmp((root) => {
    const sourceTree = join(root, 'source-tree');
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'dashboard');
    mkdirSync(sourceTree, { recursive: true });
    writeFileSync(join(sourceTree, 'index.html'), '<!doctype html><title>new</title>\n');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'user-note.txt'), 'user-owned\n');

    const effect = createStageRuntimeArtifactsEffect();

    assert.throws(
      () => effect.apply({
        basePath,
        items: [{ path: '.atomic-skills/dashboard', sourceTree }],
      }),
      /conflict/i,
    );
    assert.equal(readFileSync(join(target, 'user-note.txt'), 'utf8'), 'user-owned\n');
    assert.ok(!existsSync(join(target, 'index.html')), 'conflicting sourceTree was not copied over the user directory');
  });
});

test('stageRuntimeArtifacts source refuses to replace a pre-existing non-owned file', () => {
  withTmp((root) => {
    const source = join(root, 'source-file');
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'bin', 'aideck.mjs');
    writeFileSync(source, 'new binary shim\n');
    mkdirSync(join(basePath, '.atomic-skills', 'bin'), { recursive: true });
    writeFileSync(target, 'user-owned shim\n');

    const effect = createStageRuntimeArtifactsEffect();

    assert.throws(
      () => effect.apply({
        basePath,
        items: [{ path: '.atomic-skills/bin/aideck.mjs', source }],
      }),
      /conflict/i,
    );
    assert.equal(readFileSync(target, 'utf8'), 'user-owned shim\n');
  });
});

test('stageRuntimeArtifacts source adopts a pre-existing byte-identical file from an empty prior journal', () => {
  withTmp((root) => {
    const source = join(root, 'source-file');
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'hooks', 'version-check.sh');
    writeFileSync(source, '#!/usr/bin/env bash\necho hi\n');
    mkdirSync(join(basePath, '.atomic-skills', 'hooks'), { recursive: true });
    writeFileSync(target, '#!/usr/bin/env bash\necho hi\n');

    const effect = createStageRuntimeArtifactsEffect();
    const beforeState = effect.apply({
      basePath,
      previous: { created: [] },
      items: [{ path: '.atomic-skills/hooks/version-check.sh', source, mode: 0o755 }],
    });

    assert.deepEqual(beforeState.created, ['.atomic-skills/hooks/version-check.sh']);
    assert.equal(readFileSync(target, 'utf8'), '#!/usr/bin/env bash\necho hi\n');
    assert.equal(statSync(target).mode & 0o777, 0o755, 'adopted hook is restaged executable');
  });
});

test('stageRuntimeArtifacts content refuses to replace a pre-existing non-owned file', () => {
  withTmp((root) => {
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'package-root');
    mkdirSync(join(basePath, '.atomic-skills'), { recursive: true });
    writeFileSync(target, 'user-owned package root\n');

    const effect = createStageRuntimeArtifactsEffect();

    assert.throws(
      () => effect.apply({
        basePath,
        items: [{ path: '.atomic-skills/package-root', content: 'new package root\n' }],
      }),
      /conflict/i,
    );
    assert.equal(readFileSync(target, 'utf8'), 'user-owned package root\n');
  });
});

test('stageRuntimeArtifacts content adopts a pre-existing byte-identical file', () => {
  withTmp((root) => {
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'package-root');
    mkdirSync(join(basePath, '.atomic-skills'), { recursive: true });
    writeFileSync(target, 'package root\n');

    const effect = createStageRuntimeArtifactsEffect();
    const beforeState = effect.apply({
      basePath,
      items: [{ path: '.atomic-skills/package-root', content: 'package root\n' }],
    });

    assert.deepEqual(beforeState.created, ['.atomic-skills/package-root']);
    assert.equal(readFileSync(target, 'utf8'), 'package root\n');
  });
});

test('stageRuntimeArtifacts sourceTree replaces a priorly owned directory on update', () => {
  withTmp((root) => {
    const sourceTree = join(root, 'source-tree');
    const basePath = join(root, 'install');
    const target = join(basePath, '.atomic-skills', 'dashboard');
    mkdirSync(sourceTree, { recursive: true });
    writeFileSync(join(sourceTree, 'index.html'), '<!doctype html><title>updated</title>\n');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'old.html'), '<!doctype html><title>old</title>\n');

    const effect = createStageRuntimeArtifactsEffect();
    const beforeState = effect.apply({
      basePath,
      previous: { created: ['.atomic-skills/dashboard'] },
      items: [{ path: '.atomic-skills/dashboard', sourceTree }],
    });

    assert.deepEqual(beforeState.created, ['.atomic-skills/dashboard']);
    assert.equal(readFileSync(join(target, 'index.html'), 'utf8'), '<!doctype html><title>updated</title>\n');
    assert.ok(!existsSync(join(target, 'old.html')), 'owned update should replace stale tree contents');
  });
});

test('resolveAutoUpdateHosts — legacy omit, claude-only, grok-only, both', () => {
  assert.deepEqual(resolveAutoUpdateHosts({}), { registerClaude: true, registerGrok: false });
  assert.deepEqual(resolveAutoUpdateHosts({ ides: ['claude-code'] }), {
    registerClaude: true,
    registerGrok: false,
  });
  assert.deepEqual(resolveAutoUpdateHosts({ ides: ['grok'] }), {
    registerClaude: false,
    registerGrok: true,
  });
  assert.deepEqual(resolveAutoUpdateHosts({ ides: ['claude-code', 'grok'] }), {
    registerClaude: true,
    registerGrok: true,
  });
  assert.deepEqual(resolveAutoUpdateHosts({ ides: ['codex'] }), {
    registerClaude: false,
    registerGrok: false,
  });
});

test('auto-update runtime layer — jsonMerge SessionStart + executable hook, surgical revert', () => {
  withTmp((root) => {
    const { skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');
    mkdirSync(join(projectDir, '.claude'), { recursive: true });

    // Pre-existing third-party hook + unrelated setting must survive the round-trip.
    const thirdParty = { type: 'command', command: '/usr/local/bin/other-hook.sh' };
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    const baseline = { theme: 'dark', hooks: { SessionStart: [{ matcher: '*', hooks: [thirdParty] }] } };
    writeFileSync(settingsPath, JSON.stringify(baseline, null, 2) + '\n');
    const baselineStr = readFileSync(settingsPath, 'utf8');

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', skillsDir },
    });

    installer.install({ projectDir });

    const hookPath = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    assert.ok(existsSync(hookPath), 'version-check.sh staged');
    assert.equal(statSync(hookPath).mode & 0o777, 0o755, 'hook is executable (0o755)');

    const merged = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.equal(merged.theme, 'dark', 'unrelated setting preserved');
    const allHooks = merged.hooks.SessionStart.flatMap((e) => e.hooks);
    assert.ok(allHooks.some((h) => h.command === thirdParty.command), 'third-party hook preserved');
    const ours = allHooks.find((h) => isVersionCheckCommand(h.command, hookPath)
      || (typeof h.command === 'string' && h.command.includes('version-check.sh')));
    assert.ok(ours, 'our version-check SessionStart entry was added');
    assertHostSafeHookCommand(ours.command, hookPath, settingsPath);

    installer.uninstall({ projectDir });

    assert.ok(!existsSync(hookPath), 'hook removed on uninstall');
    assert.equal(readFileSync(settingsPath, 'utf8'), baselineStr, 'settings.json restored to baseline (surgical)');
  });
});

test('isAtomicSkillsVersionCheckCommand owns quoted, raw, and rejects foreign', () => {
  const abs = '/tmp/.atomic-skills/hooks/version-check.sh';
  assert.equal(isAtomicSkillsVersionCheckCommand(abs), true);
  assert.equal(isAtomicSkillsVersionCheckCommand(`'${abs}'`), true);
  assert.equal(isAtomicSkillsVersionCheckCommand(`"${abs}"`), true);
  assert.equal(isAtomicSkillsVersionCheckCommand('/other/version-check.sh'), false);
  assert.equal(isAtomicSkillsVersionCheckCommand('node ~/other/hook.mjs'), false);
  assert.equal(isAtomicSkillsVersionCheckCommand(null), false);
  // shell-quoted signature (Grok bug)
  assert.equal(isShellQuotedVersionCheckCommand(`'${abs}'`), true);
  assert.equal(isShellQuotedVersionCheckCommand(abs), false);
});

test('reconcileSessionStartVersionCheck drops non-desired AS forms, keeps third-party', () => {
  const abs = '/Users/henry/.atomic-skills/hooks/version-check.sh';
  const stalePath = '/old/home/.atomic-skills/hooks/version-check.sh';
  const thirdParty = { type: 'command', command: 'node ~/other/hook.mjs' };
  const input = [
    { hooks: [{ type: 'command', command: `'${abs}'` }] }, // shell-quoted — not desired
    { hooks: [{ type: 'command', command: abs }] }, // exact desired
    { hooks: [{ type: 'command', command: abs }] }, // duplicate desired
    { hooks: [{ type: 'command', command: stalePath }] }, // wrong basePath
    { matcher: '*', hooks: [thirdParty] },
    { hooks: [{ type: 'command', command: `'${abs}'` }, thirdParty] },
  ];
  const { starts, removed } = reconcileSessionStartVersionCheck(input, abs);
  assert.equal(removed, 4); // quoted, duplicate desired, stale path, quoted+tp
  assert.equal(starts.length, 3);
  assert.deepEqual(starts[0], { hooks: [{ type: 'command', command: abs }] });
  assert.deepEqual(starts[1], { matcher: '*', hooks: [thirdParty] });
  assert.deepEqual(starts[2], { hooks: [thirdParty] });
});

test('reconcileSessionStartVersionCheck with null desired removes all AS version-check', () => {
  const abs = '/x/.atomic-skills/hooks/version-check.sh';
  const thirdParty = { type: 'command', command: 'echo hi' };
  const { starts, removed } = reconcileSessionStartVersionCheck(
    [
      { hooks: [{ type: 'command', command: abs }] },
      { hooks: [thirdParty] },
    ],
    null,
  );
  assert.equal(removed, 1);
  assert.deepEqual(starts, [{ hooks: [thirdParty] }]);
});

test('reconcileAutoUpdateSessionStartSurfaces cleans Grok+Claude residue on disk', () => {
  // Regression: reinstall after form change left quoted + unquoted + stale
  // basePath next to desired; Grok ran all (first fails 0ms).
  withTmp((root) => {
    const projectDir = join(root, 'home');
    const abs = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    const stale = '/legacy/.atomic-skills/hooks/version-check.sh';
    const grokPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
    const claudePath = join(projectDir, CLAUDE_SETTINGS_REL);
    mkdirSync(dirname(abs), { recursive: true });
    mkdirSync(dirname(grokPath), { recursive: true });
    mkdirSync(dirname(claudePath), { recursive: true });
    writeFileSync(abs, '#!/bin/sh\n');
    writeFileSync(grokPath, JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: `'${abs}'` }] },
          { hooks: [{ type: 'command', command: abs }] },
          { hooks: [{ type: 'command', command: stale }] },
        ],
      },
    }, null, 2));
    writeFileSync(claudePath, JSON.stringify({
      theme: 'dark',
      hooks: {
        SessionStart: [
          { matcher: '*', hooks: [{ type: 'command', command: abs }] },
          { matcher: '*', hooks: [{ type: 'command', command: 'node other.mjs' }] },
          { matcher: '*', hooks: [{ type: 'command', command: `'${abs}'` }] },
        ],
      },
    }, null, 2));

    const result = reconcileAutoUpdateSessionStartSurfaces(projectDir, {
      claudeCommand: abs,
      grokCommand: abs,
    });
    assert.equal(result.grokRemoved, 2);
    assert.equal(result.claudeRemoved, 1);

    const grok = JSON.parse(readFileSync(grokPath, 'utf8'));
    const grokCmds = grok.hooks.SessionStart.flatMap((e) => e.hooks).map((h) => h.command);
    assert.deepEqual(grokCmds, [abs]);
    assertHostSafeHookCommand(grokCmds[0], abs, grokPath);

    const claude = JSON.parse(readFileSync(claudePath, 'utf8'));
    assert.equal(claude.theme, 'dark', 'unrelated keys preserved');
    const claudeCmds = claude.hooks.SessionStart.flatMap((e) => e.hooks).map((h) => h.command);
    assert.deepEqual(claudeCmds, [abs, 'node other.mjs']);
  });
});

test('install reinstall path: residue + jsonMerge leaves single host-safe SessionStart', () => {
  // Full provider path: pre-seed quoted residue, reconcile to desired, then
  // install — must not accumulate a second entry.
  withTmp((root) => {
    const { skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');
    const abs = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    const grokPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
    // Pre-seed only SessionStart residue (not the staged script — that would
    // trip stageRuntimeArtifacts non-owned conflict on first install).
    mkdirSync(dirname(grokPath), { recursive: true });
    writeFileSync(grokPath, JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: `'${abs}'` }] },
          { hooks: [{ type: 'command', command: abs }] },
        ],
      },
    }, null, 2));

    const desired = resolveDesiredAutoUpdateCommands(projectDir, {
      skillsDir,
      ides: ['grok', 'claude-code'],
    });
    assert.equal(desired.grokCommand, abs);
    reconcileAutoUpdateSessionStartSurfaces(projectDir, {
      claudeCommand: desired.claudeCommand,
      grokCommand: desired.grokCommand,
    });

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', skillsDir, ides: ['grok', 'claude-code'] },
    });
    installer.install({ projectDir });

    const grokCmds = JSON.parse(readFileSync(grokPath, 'utf8'))
      .hooks.SessionStart.flatMap((e) => e.hooks)
      .map((h) => h.command);
    assert.equal(grokCmds.length, 1, 'exactly one Grok SessionStart after reconcile+install');
    assertHostSafeHookCommand(grokCmds[0], abs, grokPath);
  });
});

test('auto-update SessionStart command is raw absolute path (Grok path-resolve contract)', () => {
  // Grok does NOT shell-exec SessionStart commands. A shell-quoted path like
  // '/abs/version-check.sh' is treated as non-absolute and resolved relative
  // to the hook JSON dir → command not found:
  //   /Users/.../.grok/hooks/'/Users/.../version-check.sh'
  withTmp((root) => {
    const { skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', skillsDir, ides: ['grok', 'claude-code'] },
    });

    installer.install({ projectDir });

    const hookPath = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
    const settingsPath = join(projectDir, '.claude', 'settings.json');

    assert.ok(existsSync(hookPath), 'version-check.sh staged');
    assert.ok(existsSync(grokHookPath), 'Grok auto-update hook file staged');
    assert.ok(existsSync(settingsPath), 'Claude settings staged');

    const grokCmds = JSON.parse(readFileSync(grokHookPath, 'utf8'))
      .hooks.SessionStart.flatMap((e) => e.hooks)
      .map((h) => h.command);
    assert.equal(grokCmds.length, 1, 'exactly one Grok SessionStart version-check entry');
    assertHostSafeHookCommand(grokCmds[0], hookPath, grokHookPath);

    const claudeCmds = JSON.parse(readFileSync(settingsPath, 'utf8'))
      .hooks.SessionStart.flatMap((e) => e.hooks)
      .map((h) => h.command)
      .filter((c) => typeof c === 'string' && c.includes('version-check.sh'));
    assert.equal(claudeCmds.length, 1, 'exactly one Claude SessionStart version-check entry');
    assertHostSafeHookCommand(claudeCmds[0], hookPath, settingsPath);
  });
});

test('auto-update runtime layer — grok-only stages Grok hook file, not Claude settings', () => {
  withTmp((root) => {
    const { skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', skillsDir, ides: ['grok'] },
    });

    installer.install({ projectDir });

    const hookPath = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
    const claudeSettings = join(projectDir, '.claude', 'settings.json');

    assert.ok(existsSync(hookPath), 'version-check.sh staged');
    assert.ok(existsSync(grokHookPath), 'Grok auto-update hook file staged');
    assert.ok(!existsSync(claudeSettings), 'grok-only must not create Claude settings.json');

    const grokHook = JSON.parse(readFileSync(grokHookPath, 'utf8'));
    const starts = grokHook.hooks.SessionStart;
    assert.ok(Array.isArray(starts) && starts.length >= 1, 'SessionStart registered');
    assert.equal(starts[0].matcher, undefined, 'Grok SessionStart must omit matcher');
    const cmds = starts.flatMap((e) => e.hooks).map((h) => h.command);
    assert.equal(cmds.length, 1);
    assertHostSafeHookCommand(cmds[0], hookPath, grokHookPath);
    // Auto-update only — no Soft/Strict project scripts.
    assert.equal(grokHook.hooks.PreToolUse, undefined, 'must not register PreToolUse');
    assert.equal(grokHook.hooks.Stop, undefined, 'must not register Stop');

    installer.uninstall({ projectDir });
    assert.ok(!existsSync(hookPath), 'hook script removed');
    assert.ok(!existsSync(grokHookPath), 'Grok hook file removed on uninstall');
  });
});

test('auto-update runtime layer — claude+grok registers both surfaces', () => {
  withTmp((root) => {
    const { skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', skillsDir, ides: ['claude-code', 'grok'] },
    });

    installer.install({ projectDir });

    const hookPath = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    const settingsPath = join(projectDir, '.claude', 'settings.json');
    const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);

    assert.ok(existsSync(hookPath));
    assert.ok(existsSync(settingsPath), 'Claude settings created when claude-code selected');
    assert.ok(existsSync(grokHookPath), 'Grok hook file created when grok selected');

    const claudeHooks = JSON.parse(readFileSync(settingsPath, 'utf8'))
      .hooks.SessionStart.flatMap((e) => e.hooks);
    assert.ok(claudeHooks.some((h) => isVersionCheckCommand(h.command, hookPath)));
    for (const h of claudeHooks.filter((hh) => String(hh.command).includes('version-check'))) {
      assertHostSafeHookCommand(h.command, hookPath, settingsPath);
    }

    const grokHooks = JSON.parse(readFileSync(grokHookPath, 'utf8'))
      .hooks.SessionStart.flatMap((e) => e.hooks);
    assert.ok(grokHooks.some((h) => isVersionCheckCommand(h.command, hookPath)));
    for (const h of grokHooks) {
      assertHostSafeHookCommand(h.command, hookPath, grokHookPath);
    }

    installer.uninstall({ projectDir });
    assert.ok(!existsSync(hookPath));
    assert.ok(!existsSync(settingsPath));
    assert.ok(!existsSync(grokHookPath));
  });
});

test('runtime layers compose — both providers + custom effect in one defineInstaller round-trip', () => {
  withTmp((root) => {
    const { aideckDir, packageRoot, skillsDir } = makeFixtures(root);
    const projectDir = join(root, 'install');
    mkdirSync(join(projectDir, '.claude'), { recursive: true });
    const settingsPath = join(projectDir, '.claude', 'settings.json');

    const installer = defineInstaller({
      effects: [createStageRuntimeArtifactsEffect()],
      providers: [createAideckRuntimeProvider(), createAutoUpdateRuntimeProvider()],
      config: { manifestDir: '.atomic-skills', aideckDir, packageRoot, skillsDir },
    });

    installer.install({ projectDir });
    const state = join(projectDir, '.atomic-skills');
    assert.ok(existsSync(join(state, 'bin', 'aideck.mjs')), 'aiDeck staged');
    assert.ok(existsSync(join(state, 'hooks', 'version-check.sh')), 'hook staged');
    assert.ok(existsSync(settingsPath), 'settings.json created');

    installer.uninstall({ projectDir });
    assert.ok(!existsSync(join(state, 'bin', 'aideck.mjs')), 'aiDeck removed');
    assert.ok(!existsSync(join(state, 'hooks', 'version-check.sh')), 'hook removed');
    // installer created settings.json from scratch; jsonMerge revert empties + removes it.
    assert.ok(!existsSync(settingsPath), 'installer-created settings.json removed on uninstall');
  });
});
