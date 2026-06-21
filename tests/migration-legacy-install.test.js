import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  defineInstaller, createFileSetProvider, readManifest,
} from '@henryavila/tooling-installer';
import {
  migrateLegacyManifest, migrateLegacyInstall,
} from '../src/migrate-legacy-install.js';

// T-F3-6 — migrate pre-kernel (legacy manifest) installs into journal ownership
// records so the new journal-based uninstall can reverse them. A legacy manifest
// is `{ files: { <relPath>: { installed_hash, source } }, ... }` with NO `effects`
// key, so the package Driver's replayReverse (which reads `effects`) would no-op
// on it — the codex F-002 critical bug this task closes. Migration adopts each
// hash-verifiable file entry into a single `reconcileFileSet` effect whose
// beforeState is the proof of ownership; entries WITHOUT a verifiable before-state
// are marked `unmanaged` and never enter any effect (P3 — no proof-less deletion).

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const MANIFEST_DIR = '.atomic-skills';

function writeFile(base, rel, content) {
  const abs = join(base, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

describe('migrate legacy install → journal (T-F3-6)', () => {
  it('migrateLegacyManifest adopts hashed files and marks hashless entries unmanaged (idempotent)', () => {
    const legacy = {
      version: '0.9.0',
      language: 'pt',
      ides: ['claude-code'],
      files: {
        'a.md': { installed_hash: sha('A'), source: 'skills' },
        'b.md': { installed_hash: sha('B'), source: 'skills' },
        'c.md': { source: 'legacy-no-hash' }, // unverifiable — no installed_hash
      },
      settingsCreated: true,
    };

    const migrated = migrateLegacyManifest(legacy);

    assert.equal(migrated.legacyMigrated, true);
    // hashless entry is marked unmanaged, never adopted into an effect
    assert.deepEqual(migrated.unmanaged, ['c.md']);
    // one reconcileFileSet effect carries the verifiable before-state as ownership
    assert.equal(migrated.effects.length, 1);
    assert.equal(migrated.effects[0].type, 'reconcileFileSet');
    assert.deepEqual(migrated.effects[0].beforeState, [
      { path: 'a.md', installedHash: sha('A') },
      { path: 'b.md', installedHash: sha('B') },
    ]);
    // non-file metadata is preserved; the legacy files map is superseded by effects
    assert.equal(migrated.language, 'pt');
    assert.equal(migrated.settingsCreated, true);
    assert.equal(migrated.files, undefined);
    // idempotent: re-migrating an already-journal manifest is a no-op
    assert.deepEqual(migrateLegacyManifest(migrated), migrated);
  });

  it('pre-kernel install → migrate → update → uninstall reverts only proved files, preserves the rest', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'as-migrate-legacy-'));
    try {
      // --- pre-kernel install: files on disk + a LEGACY manifest (files map) ---
      writeFile(projectDir, 'skills/a.md', 'A original');  // unmodified → revertible
      writeFile(projectDir, 'skills/b.md', 'B original');  // will be user-edited
      writeFile(projectDir, 'skills/c.md', 'C content');   // legacy entry w/o hash → unmanaged
      writeFile(projectDir, 'mine.md', 'user file');       // never tracked → control

      const legacyManifest = {
        version: '0.9.0',
        language: 'pt',
        files: {
          'skills/a.md': { installed_hash: sha('A original'), source: 'skills' },
          'skills/b.md': { installed_hash: sha('B original'), source: 'skills' },
          'skills/c.md': { source: 'legacy-no-hash' }, // unverifiable
        },
        settingsCreated: false,
      };
      writeFile(
        projectDir, join(MANIFEST_DIR, 'manifest.json'),
        JSON.stringify(legacyManifest, null, 2) + '\n',
      );

      // user edits b.md AFTER the original install — must survive uninstall (P3)
      writeFile(projectDir, 'skills/b.md', 'B EDITED by user');

      // --- migrate: legacy manifest → journal ownership records ---
      migrateLegacyInstall(projectDir, MANIFEST_DIR);
      const migrated = readManifest(projectDir, MANIFEST_DIR);
      assert.equal(migrated.legacyMigrated, true);
      assert.deepEqual(migrated.unmanaged, ['skills/c.md']);
      assert.equal(migrated.effects[0].type, 'reconcileFileSet');

      // --- update: re-install via the package Driver over the migrated journal ---
      const installer = defineInstaller({
        config: {
          manifestDir: MANIFEST_DIR,
          files: [
            { path: 'skills/a.md', content: 'A original' },
            { path: 'skills/b.md', content: 'B original' },
          ],
        },
        providers: [createFileSetProvider()],
      });
      installer.install({ projectDir });

      // update must NOT clobber the user's edit (no-clobber 3-hash via threaded before-state)
      assert.equal(readFileSync(join(projectDir, 'skills/b.md'), 'utf8'), 'B EDITED by user');

      // --- uninstall: replay the journal in reverse ---
      installer.uninstall({ projectDir });

      // proved + unmodified → removed
      assert.equal(existsSync(join(projectDir, 'skills/a.md')), false);
      // user-modified proved file → preserved (no proof-less deletion of user content)
      assert.equal(existsSync(join(projectDir, 'skills/b.md')), true);
      assert.equal(readFileSync(join(projectDir, 'skills/b.md'), 'utf8'), 'B EDITED by user');
      // unmanaged (no verifiable before-state) → never touched
      assert.equal(existsSync(join(projectDir, 'skills/c.md')), true);
      // untracked user file → never touched
      assert.equal(existsSync(join(projectDir, 'mine.md')), true);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
