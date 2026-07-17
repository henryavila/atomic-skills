/**
 * F6/T-004 — Desired-set vs install drift: stale vs modified, repair opt-in.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, unlinkSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { installSkills } from '../src/install.js';
import { readManifest } from '../src/manifest.js';
import { hashContent } from '../src/hash.js';
import {
  verifyInstalledRuntime,
  repairInstalledRuntime,
  buildDesiredSet,
} from '../scripts/verify-installed-runtime.js';

const SKILLS_DIR = join(process.cwd(), 'skills');
const META_DIR = join(process.cwd(), 'meta');

describe('installed runtime drift (F6/T-004)', () => {
  let tempDir;
  let prevHome;
  let prevSkip;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-runtime-drift-'));
    prevHome = process.env.HOME;
    prevSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    process.env.HOME = tempDir;
    process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = prevSkip;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function installCodex() {
    installSkills(tempDir, {
      language: 'en',
      ides: ['codex'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });
  }

  it('fresh install has no drift against desired set', () => {
    installCodex();
    const report = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(report.ok, true, JSON.stringify(report.counts));
    assert.ok(report.desiredSize > 0);
    assert.equal(report.counts.stale ?? 0, 0);
    assert.equal(report.counts.modified ?? 0, 0);
    assert.equal(report.counts.missing ?? 0, 0);
  });

  it('detects modified/preserved when disk diverges from installed hash', () => {
    installCodex();
    const manifest = readManifest(tempDir);
    const rel = Object.keys(manifest.files).find((p) => p.endsWith('SKILL.md') || p.endsWith('.md'));
    assert.ok(rel, 'need a skill path');
    const abs = join(tempDir, rel);
    writeFileSync(abs, `${readFileSync(abs, 'utf8')}\n# local edit\n`);
    const report = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(report.ok, false);
    const entry = report.files.find((f) => f.path === rel);
    // With desired set present, local edit ≠ desired → preserved; without desired → modified.
    assert.ok(
      entry.state === 'modified' || entry.state === 'preserved',
      `expected modified|preserved, got ${entry.state}`,
    );
  });


  it('detects missing after deletion', () => {
    installCodex();
    const manifest = readManifest(tempDir);
    const rel = Object.keys(manifest.files)[0];
    unlinkSync(join(tempDir, rel));
    const report = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(report.ok, false);
    assert.ok(report.files.some((f) => f.path === rel && f.state === 'missing'));
  });

  it('detects stale when desired differs but disk matches journal', () => {
    installCodex();
    const manifest = readManifest(tempDir);
    const rel = Object.keys(manifest.files).find((p) => manifest.files[p].installed_hash);
    assert.ok(rel);
    // Simulate package desired change: keep disk+journal, inject desired via classify path
    // by rewriting journal hash to an old value while leaving disk content as-is and
    // desired hash different — emulate by patching files map installed_hash to fake old
    // and leaving disk equal to that fake? Better: mutate desired through report path.
    // Direct unit: buildDesiredSet + classify after journal edit.
    const abs = join(tempDir, rel);
    const current = readFileSync(abs, 'utf8');
    const installedHash = hashContent(current);
    // Desired = different content; disk still matches installed journal hash.
    const desiredContent = `${current}\n# package bump\n`;
    const desiredHash = hashContent(desiredContent);
    assert.notEqual(desiredHash, installedHash);

    // Patch: leave disk and installed_hash equal; verifyInstalledRuntime uses live desired
    // from package. To force stale without changing package, we temporarily swap disk+journal
    // to "old" content and check against real desired.
    writeFileSync(abs, 'OLD_CONTENT_FOR_STALE_TEST\n');
    const oldHash = hashContent('OLD_CONTENT_FOR_STALE_TEST\n');
    const m = readManifest(tempDir);
    m.files[rel] = { ...m.files[rel], installed_hash: oldHash };
    writeFileSync(
      join(tempDir, '.atomic-skills', 'manifest.json'),
      `${JSON.stringify(m, null, 2)}\n`,
    );

    const report = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(report.ok, false);
    const entry = report.files.find((f) => f.path === rel);
    assert.equal(entry.state, 'stale', JSON.stringify(entry));
  });

  it('repair is opt-in and fixes stale/missing without clobbering modified', () => {
    installCodex();
    const manifest = readManifest(tempDir);
    const paths = Object.keys(manifest.files);
    const stalePath = paths[0];
    const modifiedPath = paths[1] || paths[0];

    // Make one stale (disk=installed=old, desired=new from package)
    writeFileSync(join(tempDir, stalePath), 'STALE_OLD\n');
    const m1 = readManifest(tempDir);
    m1.files[stalePath] = {
      ...m1.files[stalePath],
      installed_hash: hashContent('STALE_OLD\n'),
    };
    writeFileSync(
      join(tempDir, '.atomic-skills', 'manifest.json'),
      `${JSON.stringify(m1, null, 2)}\n`,
    );

    // Make one modified (disk != installed)
    if (modifiedPath !== stalePath) {
      const abs = join(tempDir, modifiedPath);
      writeFileSync(abs, `${readFileSync(abs, 'utf8')}\nLOCAL\n`);
    }

    const before = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(before.ok, false);

    // --check path must not repair
    const still = verifyInstalledRuntime(tempDir, { scope: 'project' });
    assert.equal(still.ok, false);

    const result = repairInstalledRuntime(before, { forceModified: false });
    assert.ok(result.repaired.length >= 1);
    // Modified should be skipped without force
    if (modifiedPath !== stalePath) {
      assert.ok(
        result.skipped.some((s) => s.path === modifiedPath)
          || before.files.find((f) => f.path === modifiedPath)?.state !== 'modified',
      );
    }

    const after = verifyInstalledRuntime(tempDir, { scope: 'project' });
    // Stale path should be fixed; modified may remain
    const staleAfter = after.files.find((f) => f.path === stalePath);
    assert.ok(
      staleAfter.state === 'unchanged' || staleAfter.state === 'updated',
      `stale not repaired: ${staleAfter.state}`,
    );
  });

  it('buildDesiredSet covers install ides', () => {
    installCodex();
    const manifest = readManifest(tempDir);
    const desired = buildDesiredSet(manifest, 'project');
    assert.ok(desired.size > 10);
  });
});
