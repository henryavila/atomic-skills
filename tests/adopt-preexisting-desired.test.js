import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { adoptPreexistingDesiredFiles } from '../src/adopt-preexisting-desired.js';
import { readManifest, writeManifest } from '../src/manifest.js';
import { hashContent } from '../src/hash.js';

describe('adoptPreexistingDesiredFiles (P1-A / F-004)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'as-adopt-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('adopts safelist artifact into reconcileFileSet beforeState', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(dir, '.claude/commands/atomic-skills'), { recursive: true });
    const body = '---\nname: project\ndescription: x\n---\n\nbody\n';
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
    ], {
      isArtifact: () => true,
    });

    assert.equal(result.adopted, 1);
    assert.deepEqual(result.paths, [rel]);
    assert.equal(result.unresolved, 0);

    const m = readManifest(dir);
    const rf = m.effects.find((e) => e.type === 'reconcileFileSet');
    assert.ok(rf);
    const entry = rf.beforeState.find((e) => e.path === rel);
    assert.ok(entry);
    assert.equal(entry.installedHash, hashContent(body));
    assert.ok(rf.beforeState.some((e) => e.path === '.grok/only.md'), 'keeps prior ownership');
  });

  it('marks foreign content as unmanaged-desired (exclude, not adopt)', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(dir, '.claude/commands/atomic-skills'), { recursive: true });
    const body = '# my custom skill — not atomic-skills\n';
    writeFileSync(join(dir, rel), body);

    const result = adoptPreexistingDesiredFiles(dir, [
      { path: rel, content: 'package desired body\n' },
    ], {
      isArtifact: () => false,
    });

    assert.equal(result.adopted, 0);
    assert.equal(result.unresolved, 1);
    assert.deepEqual(result.unresolvedPaths, [rel]);
    assert.deepEqual(result.excludeFromDesired, [rel]);
    // No journal write when nothing adopted
    assert.equal(readManifest(dir), null);
  });

  it('forceAdopt reclaims foreign content', () => {
    const rel = 'skill.md';
    writeFileSync(join(dir, rel), 'foreign\n');
    const result = adoptPreexistingDesiredFiles(dir, [
      { path: rel, content: 'package\n' },
    ], {
      forceAdopt: true,
      isArtifact: () => false,
    });
    assert.equal(result.adopted, 1);
    assert.equal(result.unresolved, 0);
    const m = readManifest(dir);
    assert.ok(m.effects.some((e) => e.type === 'reconcileFileSet'));
  });

  it('adopts when content hash is a known package hash', () => {
    const rel = 'a.md';
    const body = 'old package body\n';
    writeFileSync(join(dir, rel), body);
    const h = hashContent(body);
    const result = adoptPreexistingDesiredFiles(dir, [
      { path: rel, content: 'new package body\n' },
    ], {
      isArtifact: () => false,
      knownPackageHashes: new Set([h]),
    });
    assert.equal(result.adopted, 1);
    assert.equal(result.unresolved, 0);
  });

  it('skips already-desired content without adopting', () => {
    const rel = 'a.md';
    const body = 'same\n';
    writeFileSync(join(dir, rel), body);
    const result = adoptPreexistingDesiredFiles(dir, [
      { path: rel, content: body },
    ], {
      isArtifact: () => true,
    });
    assert.equal(result.adopted, 0);
    assert.equal(result.unresolved, 0);
    assert.equal(readManifest(dir), null);
  });

  it('is a no-op when paths are already owned', () => {
    const rel = 'a.md';
    writeFileSync(join(dir, rel), 'x\n');
    const h = hashContent('x\n');
    writeManifest(dir, {
      effects: [{ type: 'reconcileFileSet', beforeState: [{ path: rel, installedHash: h }] }],
    });
    const r = adoptPreexistingDesiredFiles(dir, [{ path: rel, content: 'y' }], {
      isArtifact: () => true,
    });
    assert.equal(r.adopted, 0);
  });

  it('creates a journal when none exists but safelist leftovers need reclaim', () => {
    const rel = 'skill.md';
    writeFileSync(join(dir, rel), 'leftover\n');
    const r = adoptPreexistingDesiredFiles(dir, [{ path: rel, content: 'new' }], {
      isArtifact: () => true,
    });
    assert.equal(r.adopted, 1);
    const m = readManifest(dir);
    assert.ok(m.effects.some((e) => e.type === 'reconcileFileSet'));
  });
});
