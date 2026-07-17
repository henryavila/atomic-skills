/**
 * P1-C / F-006 — single atomic/no-follow manifest writer.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  symlinkSync, existsSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync as readSync } from 'node:fs';
import {
  readManifest, writeManifest, MANIFEST_DIR, MANIFEST_FILE,
} from '../src/manifest.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('manifest atomic/no-follow writer (P1-C / F-006)', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-manifest-p1c-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('atomic replacement: write lands as valid final JSON (no torn .tmp as final)', () => {
    writeManifest(root, { version: '1.0.0', effects: [] });
    const filePath = join(root, MANIFEST_DIR, MANIFEST_FILE);
    assert.ok(existsSync(filePath));
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, '1.0.0');
    assert.ok(parsed.updated_at);
    // No leftover temp siblings as the "final" path name
    const siblings = readdirSync(join(root, MANIFEST_DIR));
    assert.ok(siblings.includes(MANIFEST_FILE));
    assert.ok(
      siblings.every((n) => n === MANIFEST_FILE || !n.startsWith('.manifest')),
      `unexpected temp residue as sibling: ${siblings.join(',')}`,
    );

    writeManifest(root, { version: '2.0.0', effects: [{ type: 'x' }] });
    const again = readManifest(root);
    assert.equal(again.version, '2.0.0');
    assert.equal(again.effects.length, 1);
  });

  it('no-follow leaf: symlink at the manifest file path → write refuses', () => {
    const dir = join(root, MANIFEST_DIR);
    mkdirSync(dir, { recursive: true });
    const outside = join(root, 'outside-secret.json');
    writeFileSync(outside, '{"pwned":true}\n');
    symlinkSync(outside, join(dir, MANIFEST_FILE));

    assert.throws(
      () => writeManifest(root, { version: 'x', effects: [] }),
      (err) => err?.code === 'UNSAFE_PATH_RACE'
        || /symlink|UNSAFE_PATH|Refusing/i.test(String(err?.message || err)),
    );
    assert.equal(readFileSync(outside, 'utf8'), '{"pwned":true}\n', 'sentinel intact');
  });

  it('no-follow intermediate: symlink in an ancestor under project base → write refuses', () => {
    // project/base/.atomic-skills is reached via a symlinked intermediate component
    // Layout: root/real-dir/  and root/project -> symlink to real-dir
    // Actually: put symlink as intermediate component INSIDE project base.
    // project/.link-target/  and project/.atomic-skills -> symlink to .link-target
    // then write tries to create .atomic-skills/manifest.json following the dir symlink.
    const project = join(root, 'project');
    const realDir = join(project, 'real-manifest-dir');
    mkdirSync(realDir, { recursive: true });
    const outside = join(root, 'escaped.json');
    writeFileSync(outside, 'SAFE\n');
    // Intermediate: .atomic-skills is a symlink to realDir; if write followed and
    // wrote elsewhere we'd break contract — engine must refuse dir symlink walk.
    symlinkSync(realDir, join(project, MANIFEST_DIR));

    // Engine openParentNoFollow opens intermediate with O_NOFOLLOW → ELOOP → refuse.
    assert.throws(
      () => writeManifest(project, { version: 'x', effects: [] }),
      (err) => err?.code === 'UNSAFE_PATH_RACE'
        || /symlink|UNSAFE_PATH|Refusing|Directory component/i.test(String(err?.message || err)),
    );
  });

  it('static guard: no plain writeFileSync to install ledger outside single API', () => {
    // Consumer sources that must not write the ledger with writeFileSync.
    const files = [
      'src/adopt-preexisting-desired.js',
      'src/install.js',
      'src/uninstall.js',
      'src/migrate-legacy-install.js',
      'src/recovery-cli.js',
    ];
    const ledgerWrite = /writeFileSync\s*\([^)]*manifest\.json/i;
    const plainWriteToAtomic = /writeFileSync\s*\(\s*[^)]*MANIFEST_DIR|writeFileSync\s*\(\s*join\([^)]*MANIFEST/;
    for (const rel of files) {
      const src = readSync(join(REPO_ROOT, rel), 'utf8');
      assert.equal(
        ledgerWrite.test(src),
        false,
        `${rel} must not writeFileSync manifest.json directly`,
      );
      // adopt/install should call writeManifest, not invent a parallel writer
      if (rel === 'src/adopt-preexisting-desired.js' || rel === 'src/install.js') {
        assert.equal(
          plainWriteToAtomic.test(src),
          false,
          `${rel} must not writeFileSync via MANIFEST_DIR join`,
        );
      }
    }
    // The thin wrapper itself must not call writeFileSync — it delegates to the engine.
    const manifestSrc = readSync(join(REPO_ROOT, 'src/manifest.js'), 'utf8');
    // Strip block/line comments so doc text mentioning writeFileSync does not trip the guard.
    const codeOnly = manifestSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.equal(
      /\bwriteFileSync\s*\(/.test(codeOnly),
      false,
      'src/manifest.js must not call writeFileSync (engine atomicWriteJsonNoFollow only)',
    );
    assert.ok(
      /engineWriteManifest|writeManifest as engineWriteManifest|atomicWriteJsonNoFollow/.test(manifestSrc),
      'src/manifest.js must wrap engine writeManifest',
    );
  });
});
