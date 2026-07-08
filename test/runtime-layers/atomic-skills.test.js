import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineInstaller } from '@henryavila/minimalist-installer';
import { createStageRuntimeArtifactsEffect } from '../../src/runtime-layers/effects/stage-runtime-artifacts.js';
import { createAideckRuntimeProvider } from '../../src/runtime-layers/aideck.js';
import { createAutoUpdateRuntimeProvider } from '../../src/runtime-layers/auto-update.js';

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
    assert.ok(allHooks.some((h) => h.command === hookPath), 'our hook command added (absolute path)');

    installer.uninstall({ projectDir });

    assert.ok(!existsSync(hookPath), 'hook removed on uninstall');
    assert.equal(readFileSync(settingsPath, 'utf8'), baselineStr, 'settings.json restored to baseline (surgical)');
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
