import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest, writeManifest, MANIFEST_DIR, MANIFEST_FILE } from '../src/manifest.js';

describe('manifest', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no manifest exists', () => {
    const result = readManifest(tempDir);
    assert.strictEqual(result, null);
  });

  it('writes and reads manifest', () => {
    const data = {
      version: '1.0.0',
      language: 'pt',
      ides: ['claude-code'],
      files: {},
    };
    writeManifest(tempDir, data);
    const result = readManifest(tempDir);
    assert.deepStrictEqual(result.version, '1.0.0');
    assert.deepStrictEqual(result.language, 'pt');
  });

  it('creates .atomic-skills/ directory', () => {
    writeManifest(tempDir, { version: '1.0.0' });
    assert.ok(existsSync(join(tempDir, MANIFEST_DIR)));
  });

  it('writes valid JSON', () => {
    writeManifest(tempDir, { version: '1.0.0' });
    const raw = readFileSync(join(tempDir, MANIFEST_DIR, MANIFEST_FILE), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  });
});
