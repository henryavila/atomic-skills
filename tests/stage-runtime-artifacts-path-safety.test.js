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
import { createStageRuntimeArtifactsEffect } from '../src/runtime-layers/effects/stage-runtime-artifacts.js';

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
});
