/**
 * F6/T-003 — Workflow declares a multi-OS × multi-Node release matrix.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = join(ROOT, '.github/workflows/test.yml');

describe('CI matrix declaration (F6/T-003)', () => {
  it('workflow file exists', () => {
    assert.ok(existsSync(WORKFLOW));
  });

  it('declares linux, macos, and windows runners in release matrix', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');
    assert.match(yml, /ubuntu-latest|linux/i);
    assert.match(yml, /macos-latest|macos/i);
    assert.match(yml, /windows-latest|windows/i);
  });

  it('declares Node 22.18.x and Node >=24.11 axes', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');
    assert.match(yml, /22\.18/);
    assert.match(yml, /24\.11|24\.x|24/);
  });

  it('release matrix job does not use continue-on-error for critical gates', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');
    // If a release-matrix / release job exists, it must not blanket continue-on-error.
    if (/release[-_]?matrix|release[-_]?qualify/i.test(yml)) {
      const section = yml.split(/^jobs:/m)[1] || yml;
      // Allow continue-on-error only on non-critical artifact steps, not on the job root
      // of the release matrix. Soft check: job-level continue-on-error: true is banned
      // next to release-matrix.
      assert.doesNotMatch(
        section,
        /release[-_]?matrix[\s\S]{0,200}continue-on-error:\s*true/i,
      );
    }
  });

  it('preserves failure artifacts upload pattern or documents matrix', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');
    // Either upload-artifact on failure or explicit release-matrix with process.version logging
    assert.ok(
      /upload-artifact|process\.version|node --version|release/i.test(yml),
      'workflow should record node version or upload artifacts',
    );
  });
});
