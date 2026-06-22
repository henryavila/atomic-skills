import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineInstaller, createFileSetProvider } from '@henryavila/minimalist-installer';

// T-F3-1 smoke: prove atomic-skills can consume @henryavila/minimalist-installer
// through the file: link end-to-end (not just that imports resolve). The full
// SkillsProvider rewire is the later F3 slices; this only verifies the seam.
describe('minimalist-installer link smoke (T-F3-1)', () => {
  let dir;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('consumes the package: install + uninstall round-trips through the linked dependency', () => {
    dir = mkdtempSync(join(tmpdir(), 'as-ti-link-'));

    const installer = defineInstaller({
      providers: [createFileSetProvider()],
      config: {
        manifestDir: '.atomic-skills',
        files: [{ path: 'skills/x.md', content: 'X' }],
      },
    });

    installer.install({ projectDir: dir });
    assert.equal(readFileSync(join(dir, 'skills/x.md'), 'utf8'), 'X');

    installer.uninstall({ projectDir: dir });
    assert.deepEqual(readdirSync(dir), [], 'round-trip to empty through the linked package');
  });
});
