import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInstaller } from '../src/installer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

// T-F3-4 Stage 1 — the install-base installer wires the SkillsProvider +
// auto-update layer over the package Driver, writes a JOURNAL manifest, and
// round-trips the project dir to empty via the journal (no bespoke unlink).
test('buildInstaller stages the skills file set + auto-update hook over the Driver and reverts to baseline', () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'as-installer-'));
  try {
    const installer = buildInstaller({
      language: 'en',
      ides: ['claude-code'],
      modules: { memory: { installed: true, config: {} } },
      skillsDir: join(PACKAGE_ROOT, 'skills'),
      metaDir: join(PACKAGE_ROOT, 'meta'),
      scope: 'project',
    });

    installer.install({ projectDir });

    // The manifest is a JOURNAL (effects[]), not the legacy {files:{}} map.
    const manifest = JSON.parse(
      readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
    );
    assert.ok(Array.isArray(manifest.effects), 'manifest is a journal (effects[])');
    assert.ok(
      manifest.effects.some((e) => e.type === 'reconcileFileSet'),
      'reconcileFileSet effect recorded',
    );
    // Skill files landed under .claude (claude-code = command format).
    assert.ok(existsSync(join(projectDir, '.claude')), 'skills staged under .claude');
    // Auto-update hook staged + executable.
    const hook = join(projectDir, '.atomic-skills', 'hooks', 'version-check.sh');
    assert.ok(existsSync(hook), 'auto-update hook staged');

    installer.uninstall({ projectDir });

    // Round-trip: the project dir returns to empty (every effect reverted).
    assert.deepEqual(
      readdirSync(projectDir), [],
      'project dir empty after uninstall (journal reverted everything)',
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
