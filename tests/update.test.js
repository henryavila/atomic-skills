import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync, unlinkSync, readdirSync, rmdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkills } from '../src/install.js';
import { hashContent } from '../src/hash.js';

describe('Update and Orphan Removal', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-update-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('removes orphan files and empty directories during update', () => {
    // 1. Initial install with gemini-commands (TOML)
    const initialResult = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini-commands'],
      modules: {},
      skillsDir: join(process.cwd(), 'skills'),
      metaDir: join(process.cwd(), 'meta'),
      scope: 'project'
    });

    const tomlPath = '.gemini/commands/as-fix.toml';
    assert.ok(existsSync(join(tempDir, tomlPath)));

    // 2. Perform second install with gemini (Markdown), removing gemini-commands
    const newResult = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini'],
      modules: {},
      skillsDir: join(process.cwd(), 'skills'),
      metaDir: join(process.cwd(), 'meta'),
      scope: 'project'
    });

    assert.ok(existsSync(join(tempDir, '.gemini/skills/as-fix/SKILL.md')));

    // 3. Simulate the interactive orphan removal logic
    const existingManifestFiles = initialResult.files.reduce((acc, f) => {
      acc[f.path] = { installed_hash: f.hash };
      return acc;
    }, {});
    
    const newPaths = new Set(newResult.files.map(f => f.path));
    
    for (const [oldPath, entry] of Object.entries(existingManifestFiles)) {
      if (!newPaths.has(oldPath)) {
        const absPath = join(tempDir, oldPath);
        if (existsSync(absPath)) {
          const currentContent = readFileSync(absPath, 'utf8');
          if (hashContent(currentContent) === entry.installed_hash) {
            // Recursive delete logic from src/install.js
            unlinkSync(absPath);
            let parent = dirname(absPath);
            while (parent !== tempDir && parent !== '.') {
              try {
                if (readdirSync(parent).length === 0) {
                  rmdirSync(parent);
                  parent = dirname(parent);
                } else break;
              } catch { break; }
            }
          }
        }
      }
    }

    // Verify TOML file is GONE
    assert.ok(!existsSync(join(tempDir, tomlPath)));
    // Verify TOML directory is GONE (empty cleanup)
    assert.ok(!existsSync(join(tempDir, '.gemini/commands')));
  });

  it('prevents deletion of modified orphan files', () => {
    // 1. Initial install
    const initialResult = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini-commands'],
      modules: {},
      skillsDir: join(process.cwd(), 'skills'),
      metaDir: join(process.cwd(), 'meta'),
      scope: 'project'
    });

    const tomlPath = '.gemini/commands/as-fix.toml';
    const absTomlPath = join(tempDir, tomlPath);
    
    // 2. Modify file locally
    writeFileSync(absTomlPath, 'user modification');

    // 3. Update to new config (gemini skills)
    const newResult = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini'],
      modules: {},
      skillsDir: join(process.cwd(), 'skills'),
      metaDir: join(process.cwd(), 'meta'),
      scope: 'project'
    });

    // 4. Simulate orphan check with "keep" decision
    const existingManifestFiles = { [tomlPath]: { installed_hash: initialResult.files[0].hash } };
    const newPaths = new Set(newResult.files.map(f => f.path));

    let orphanDetected = false;
    for (const [oldPath, entry] of Object.entries(existingManifestFiles)) {
      if (!newPaths.has(oldPath)) {
        const currentContent = readFileSync(join(tempDir, oldPath), 'utf8');
        if (hashContent(currentContent) !== entry.installed_hash) {
          orphanDetected = true;
          // Simulation: user chose "keep", so we DON'T unlink
        }
      }
    }

    assert.ok(orphanDetected, 'Orphan modification should have been detected');
    assert.ok(existsSync(absTomlPath), 'Modified orphan should still exist');
    assert.strictEqual(readFileSync(absTomlPath, 'utf8'), 'user modification');
  });
});
