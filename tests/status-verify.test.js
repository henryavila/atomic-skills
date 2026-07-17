/**
 * F2/T-003 — status classifies every manifest path by hash fingerprint.
 * stale / modified / preserved / missing must never report as up-to-date.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkills } from '../src/install.js';
import { readManifest } from '../src/manifest.js';
import { hashContent } from '../src/hash.js';
import {
  classifyFileState,
  verifyInstall,
  summarizeVerification,
} from '../src/status-verify.js';

const SKILLS_DIR = join(process.cwd(), 'skills');
const META_DIR = join(process.cwd(), 'meta');

describe('classifyFileState (F2/T-003)', () => {
  it('classifies missing when path does not exist', () => {
    assert.equal(
      classifyFileState({ exists: false, diskHash: null, installedHash: 'abc', desiredHash: 'abc' }),
      'missing',
    );
  });

  it('classifies unchanged when disk == installed == desired', () => {
    assert.equal(
      classifyFileState({ exists: true, diskHash: 'h1', installedHash: 'h1', desiredHash: 'h1' }),
      'unchanged',
    );
  });

  it('classifies stale when disk matches installed but desired differs', () => {
    assert.equal(
      classifyFileState({ exists: true, diskHash: 'old', installedHash: 'old', desiredHash: 'new' }),
      'stale',
    );
  });

  it('classifies modified when disk differs from installed (no desired)', () => {
    assert.equal(
      classifyFileState({ exists: true, diskHash: 'user', installedHash: 'inst', desiredHash: null }),
      'modified',
    );
  });

  it('classifies preserved when disk != installed and disk != desired (user edit kept)', () => {
    assert.equal(
      classifyFileState({ exists: true, diskHash: 'user', installedHash: 'inst', desiredHash: 'new' }),
      'preserved',
    );
  });

  it('classifies conflict as alias path for preserved with desired present', () => {
    // preserved is the reconciler disposition; conflict is the observable UX label
    assert.equal(
      classifyFileState({
        exists: true,
        diskHash: 'user',
        installedHash: 'inst',
        desiredHash: 'new',
        asConflict: true,
      }),
      'conflict',
    );
  });

  it('classifies updated when disk matches desired and installed differs', () => {
    assert.equal(
      classifyFileState({ exists: true, diskHash: 'new', installedHash: 'old', desiredHash: 'new' }),
      'updated',
    );
  });
});

describe('verifyInstall (F2/T-003)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-status-verify-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('fresh install is fully unchanged and not stale', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const report = verifyInstall(tempDir, manifest);
    assert.ok(report.files.length > 0);
    const byState = summarizeVerification(report);
    assert.equal(byState.missing, 0);
    assert.equal(byState.modified, 0);
    assert.equal(byState.preserved, 0);
    assert.equal(byState.stale, 0);
    assert.ok(byState.unchanged > 0);
    assert.equal(report.upToDate, true);
  });

  it('detects missing after deletion', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const target = join(tempDir, '.claude/commands/atomic-skills/fix.md');
    unlinkSync(target);
    const report = verifyInstall(tempDir, readManifest(tempDir));
    assert.ok(report.files.some((f) => f.state === 'missing' && f.path.includes('fix.md')));
    assert.equal(report.upToDate, false);
  });

  it('detects modified when disk hash diverges from installed_hash', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const rel = '.claude/commands/atomic-skills/fix.md';
    const abs = join(tempDir, rel);
    writeFileSync(abs, readFileSync(abs, 'utf8') + '\n# local edit\n');
    const report = verifyInstall(tempDir, readManifest(tempDir));
    const entry = report.files.find((f) => f.path === rel);
    assert.ok(entry);
    assert.equal(entry.state, 'modified');
    assert.equal(report.upToDate, false);
  });

  it('detects stale when desired content differs but disk still matches journal', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const rel = Object.keys(manifest.files).find((p) => p.endsWith('fix.md'));
    assert.ok(rel);
    const installedHash = manifest.files[rel].installed_hash;
    const desiredByPath = {
      [rel]: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };
    // All other paths: use installed hash as desired so only help is stale
    for (const [p, meta] of Object.entries(manifest.files)) {
      if (p !== rel) desiredByPath[p] = meta.installed_hash;
    }
    const report = verifyInstall(tempDir, manifest, { desiredByPath });
    const entry = report.files.find((f) => f.path === rel);
    assert.equal(entry.state, 'stale');
    assert.equal(entry.installedHash, installedHash);
    assert.equal(report.upToDate, false);
  });

  it('classifies preserved user asset as conflict when desired differs', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const assetRel = Object.keys(manifest.files).find((p) => p.includes('_assets/'));
    assert.ok(assetRel, 'need an installed asset path');
    const abs = join(tempDir, assetRel);
    writeFileSync(abs, '# user preserved asset\n');
    const desiredByPath = {};
    for (const [p, meta] of Object.entries(manifest.files)) {
      desiredByPath[p] = p === assetRel
        ? hashContent('# package desired asset\n')
        : meta.installed_hash;
    }
    const report = verifyInstall(tempDir, manifest, {
      desiredByPath,
      preservedAsConflict: true,
    });
    const entry = report.files.find((f) => f.path === assetRel);
    assert.equal(entry.state, 'conflict');
    assert.equal(report.upToDate, false);
    assert.ok(summarizeVerification(report).conflict >= 1);
  });

  it('does not mark up-to-date from semver alone when files are modified', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const pkgVersion = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ).version;
    assert.equal(manifest.version, pkgVersion);
    const anyFile = Object.keys(manifest.files)[0];
    writeFileSync(join(tempDir, anyFile), 'tampered\n');
    const report = verifyInstall(tempDir, manifest, { packageVersion: pkgVersion });
    assert.equal(report.versionMatch, true);
    assert.equal(report.upToDate, false, 'hash drift must defeat semver up-to-date');
  });

  it('covers assets outside ide.dir (sibling _assets paths)', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const assets = Object.keys(manifest.files).filter((p) => p.includes('atomic-skills/_assets/'));
    assert.ok(assets.length > 0, 'manifest must track shared assets');
    const report = verifyInstall(tempDir, manifest);
    for (const rel of assets) {
      const entry = report.files.find((f) => f.path === rel);
      assert.ok(entry, `asset ${rel} must be verified`);
      assert.ok(['unchanged', 'stale', 'modified', 'preserved', 'missing', 'updated', 'conflict'].includes(entry.state));
    }
  });
});

describe('status() integration with verify (F2/T-003)', () => {
  let tempDir;
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-status-cli-'));
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('status returns verification and never claims up-to-date when modified', async () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const manifest = readManifest(tempDir);
    const any = Object.keys(manifest.files)[0];
    writeFileSync(join(tempDir, any), 'x\n');
    const { status } = await import('../src/status.js');
    const result = status(tempDir, { forceProject: true, verify: true });
    assert.ok(result.verification);
    assert.equal(result.verification.upToDate, false);
    assert.ok(result.verification.files.some((f) => f.state === 'modified'));
  });
});
