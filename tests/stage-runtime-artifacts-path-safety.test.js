/**
 * P1-D / F-007 — stageRuntimeArtifacts no-follow path safety.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, symlinkSync,
  chmodSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createStageRuntimeArtifactsEffect } from '../src/runtime-layers/effects/stage-runtime-artifacts.js';

/**
 * Engine double that delegates to the real no-follow helpers but reports the
 * first `existsNoFollow` call to `globalThis.__pay16bStageProbe`. The probe
 * runs after the real answer, so it models a filesystem that changes between
 * the ownership check and the mutation that follows it.
 */
const injectedEngineSource = (realUrl) => [
  `import * as real from ${JSON.stringify(realUrl)};`,
  `export * from ${JSON.stringify(realUrl)};`,
  'export const existsNoFollow = (basePath, relPath) => {',
  '  const present = real.existsNoFollow(basePath, relPath);',
  '  const probe = globalThis.__pay16bStageProbe;',
  '  if (probe) {',
  '    globalThis.__pay16bStageProbe = undefined;',
  '    probe(basePath, relPath);',
  '  }',
  '  return present;',
  '};',
  '',
].join('\n');

/** Import the effect with `@henryavila/minimalist-installer` replaced by the double. */
async function loadStageEffectWithInjectedEngine(root) {
  const enginePath = join(root, 'injected-engine.mjs');
  writeFileSync(enginePath, injectedEngineSource(import.meta.resolve('@henryavila/minimalist-installer')));
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@henryavila/minimalist-installer') {
        return { url: pathToFileURL(enginePath).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    const effectUrl = new URL('../src/runtime-layers/effects/stage-runtime-artifacts.js', import.meta.url);
    effectUrl.searchParams.set('injected-engine', String(Date.now()));
    return await import(effectUrl.href);
  } finally {
    hooks.deregister();
  }
}

describe('stageRuntimeArtifacts path-safety (P1-D / F-007)', () => {
  let root;
  const effect = createStageRuntimeArtifactsEffect();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-stage-ps-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses leaf symlink at hook destination (sentinel intact)', () => {
    const project = join(root, 'project');
    const outside = join(root, 'outside');
    mkdirSync(join(project, '.atomic-skills', 'hooks'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    const sentinel = join(outside, 'secret.sh');
    writeFileSync(sentinel, 'SAFE\n');
    symlinkSync(sentinel, join(project, '.atomic-skills', 'hooks', 'version-check.sh'));

    const src = join(root, 'src-version-check.sh');
    writeFileSync(src, '#!/bin/sh\necho PWNED\n');
    chmodSync(src, 0o755);

    assert.throws(
      () => effect.apply({
        basePath: project,
        items: [{
          path: '.atomic-skills/hooks/version-check.sh',
          source: src,
          mode: 0o755,
        }],
      }),
      (err) => err?.code === 'UNSAFE_PATH_RACE'
        || /symlink|UNSAFE_PATH|Refusing/i.test(String(err?.message || err)),
    );
    assert.equal(readFileSync(sentinel, 'utf8'), 'SAFE\n');
  });

  it('stages a regular file with mode and reverts it', () => {
    const project = join(root, 'project');
    mkdirSync(project, { recursive: true });
    const src = join(root, 'hook.sh');
    writeFileSync(src, '#!/bin/sh\necho ok\n');

    const before = effect.apply({
      basePath: project,
      items: [{
        path: '.atomic-skills/hooks/version-check.sh',
        source: src,
        mode: 0o755,
      }],
    });
    assert.deepEqual(before.created, ['.atomic-skills/hooks/version-check.sh']);
    const dest = join(project, '.atomic-skills/hooks/version-check.sh');
    assert.ok(existsSync(dest));
    assert.ok(readFileSync(dest, 'utf8').includes('echo ok'));

    effect.revert({ basePath: project }, before);
    assert.equal(existsSync(dest), false);
  });

  it('writes string content items without following intermediate symlink dirs', () => {
    const project = join(root, 'project');
    const real = join(project, 'real-hooks');
    mkdirSync(real, { recursive: true });
    // Intermediate: .atomic-skills is a symlink — should refuse
    mkdirSync(join(project), { recursive: true });
    // Only create parent that is a symlink for intermediate component
    const asDir = join(project, 'as-real');
    mkdirSync(asDir, { recursive: true });
    symlinkSync(asDir, join(project, '.atomic-skills'));

    assert.throws(
      () => effect.apply({
        basePath: project,
        items: [{
          path: '.atomic-skills/hooks/version-check.sh',
          content: '#!/bin/sh\n',
          mode: 0o755,
        }],
      }),
      (err) => err?.code === 'UNSAFE_PATH_RACE'
        || /symlink|UNSAFE_PATH|Directory component/i.test(String(err?.message || err)),
    );
  });

  it('keeps a foreign tree destination created after the ownership check', async () => {
    const project = join(root, 'project');
    const sourceTree = join(root, 'source-tree');
    const dest = join(project, '.atomic-skills/dashboard');
    mkdirSync(sourceTree, { recursive: true });
    writeFileSync(join(sourceTree, 'index.html'), '<!doctype html><title>staged</title>\n');
    mkdirSync(project, { recursive: true });

    const injected = await loadStageEffectWithInjectedEngine(root);
    // Absent when ownership is decided; written by someone else before apply.
    globalThis.__pay16bStageProbe = () => {
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, 'foreign.txt'), 'user file\n');
    };
    try {
      injected.createStageRuntimeArtifactsEffect().apply({
        basePath: project,
        items: [{ path: '.atomic-skills/dashboard', sourceTree }],
      });
    } finally {
      delete globalThis.__pay16bStageProbe;
    }

    assert.equal(existsSync(join(dest, 'foreign.txt')), true,
      'a destination that appeared after the ownership check is not ours to delete');
    assert.equal(readFileSync(join(dest, 'foreign.txt'), 'utf8'), 'user file\n');
    assert.equal(readFileSync(join(dest, 'index.html'), 'utf8'), '<!doctype html><title>staged</title>\n');
  });
});
