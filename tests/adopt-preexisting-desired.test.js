import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { adoptPreexistingDesiredFiles } from '../src/adopt-preexisting-desired.js';
import { readManifest, writeManifest } from '../src/manifest.js';
import { hashContent } from '../src/hash.js';

describe('adoptPreexistingDesiredFiles', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'as-adopt-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('adopts unowned desired paths into reconcileFileSet beforeState', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(dir, '.claude/commands/atomic-skills'), { recursive: true });
    const body = '---\ndescription: x\n---\n\nbody\n';
    writeFileSync(join(dir, rel), body);

    writeManifest(dir, {
      journalVersion: 2,
      effects: [{
        type: 'reconcileFileSet',
        beforeState: [{ path: '.grok/only.md', installedHash: 'aaa' }],
      }],
    });

    const result = adoptPreexistingDesiredFiles(dir, [
      { path: rel, content: 'new' },
      { path: '.claude/commands/atomic-skills/missing.md', content: 'nope' },
    ]);

    assert.equal(result.adopted, 1);
    assert.deepEqual(result.paths, [rel]);

    const m = readManifest(dir);
    const rf = m.effects.find((e) => e.type === 'reconcileFileSet');
    assert.ok(rf);
    const entry = rf.beforeState.find((e) => e.path === rel);
    assert.ok(entry);
    assert.equal(entry.installedHash, hashContent(body));
    assert.ok(rf.beforeState.some((e) => e.path === '.grok/only.md'), 'keeps prior ownership');
  });

  it('is a no-op when paths are already owned', () => {
    const rel = 'a.md';
    writeFileSync(join(dir, rel), 'x\n');
    const h = hashContent('x\n');
    writeManifest(dir, {
      effects: [{ type: 'reconcileFileSet', beforeState: [{ path: rel, installedHash: h }] }],
    });
    const r = adoptPreexistingDesiredFiles(dir, [{ path: rel, content: 'y' }]);
    assert.equal(r.adopted, 0);
  });

  it('creates a journal when none exists but disk has desired leftovers', () => {
    const rel = 'skill.md';
    writeFileSync(join(dir, rel), 'leftover\n');
    const r = adoptPreexistingDesiredFiles(dir, [{ path: rel, content: 'new' }]);
    assert.equal(r.adopted, 1);
    const m = readManifest(dir);
    assert.ok(m.effects.some((e) => e.type === 'reconcileFileSet'));
  });
});
