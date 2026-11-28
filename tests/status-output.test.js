/**
 * Pins the full `status()` output — text and order — for one healthy install
 * and one broken install, so the size refactor cannot change what users see.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync, readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashContent } from '../src/hash.js';
import { writeManifest, readManifest } from '../src/manifest.js';

const DEMO_REL = '.claude/commands/atomic-skills/demo.md';
const OTHER_REL = '.claude/commands/atomic-skills/other.md';
const DEMO_CONTENT = 'demo content\n';
const OTHER_CONTENT = 'other content\n';
const PKG_VERSION = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
).version;

function writeFixture(projectDir) {
  mkdirSync(join(projectDir, '.claude/commands/atomic-skills'), { recursive: true });
  writeFileSync(join(projectDir, DEMO_REL), DEMO_CONTENT);
  writeFileSync(join(projectDir, OTHER_REL), OTHER_CONTENT);
  writeManifest(projectDir, {
    version: PKG_VERSION,
    language: 'en',
    ides: ['claude-code'],
    files: {
      [DEMO_REL]: { installed_hash: hashContent(DEMO_CONTENT) },
      [OTHER_REL]: { installed_hash: hashContent(OTHER_CONTENT) },
    },
  });
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

async function captureStatus(projectDir) {
  const { status } = await import('../src/status.js');
  const original = process.stdout.write;
  let output = '';
  process.stdout.write = (chunk) => {
    output += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  };
  try {
    status(projectDir, { forceProject: true });
  } finally {
    process.stdout.write = original;
  }
  return stripAnsi(output);
}

describe('status() pinned output', () => {
  let home;
  let project;
  let previousHome;

  beforeEach(() => {
    previousHome = process.env.HOME;
    home = mkdtempSync(join(tmpdir(), 'as-status-out-home-'));
    project = mkdtempSync(join(tmpdir(), 'as-status-out-project-'));
    process.env.HOME = home;
    writeFixture(project);
  });

  afterEach(() => {
    process.env.HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  });

  it('prints the same full text for a healthy install', async () => {
    const updated = new Date(readManifest(project).updated_at).toLocaleString();
    const output = await captureStatus(project);
    assert.equal(output, [
      '┌  ⚛ Atomic Skills — Status',
      '│',
      `│  Version:  v${PKG_VERSION} (up to date)`,
      '│  Scope:    project',
      '│  Language: en',
      `│  Updated:  ${updated}`,
      '│',
      '│  Verify: 2 unchanged',
      '│',
      '│  ✓ Claude Code — 2 files',
      '│',
      '▲  Runtime owners: none registered',
      '│',
      '└  Done.',
      '',
      '',
    ].join('\n'));
  });

  it('prints the same full text for a broken install', async () => {
    const updated = new Date(readManifest(project).updated_at).toLocaleString();
    unlinkSync(join(project, OTHER_REL));
    writeFileSync(join(project, DEMO_REL), 'demo content changed\n');
    const output = await captureStatus(project);
    assert.equal(output, [
      '┌  ⚛ Atomic Skills — Status',
      '│',
      `│  Version:  v${PKG_VERSION} (hash drift — not up to date)`,
      '│  Scope:    project',
      '│  Language: en',
      `│  Updated:  ${updated}`,
      '│',
      '▲  Verify: 1 missing, 1 modified',
      '│',
      `▲    modified: ${DEMO_REL}`,
      '│',
      `▲    missing: ${OTHER_REL}`,
      '│',
      '▲  ⚠ Claude Code — 0/2 clean',
      '│',
      `▲    missing: ${OTHER_REL}`,
      '│',
      `▲    modified: ${DEMO_REL}`,
      '│',
      '▲  Runtime owners: none registered',
      '│',
      '└  Done.',
      '',
      '',
    ].join('\n'));
  });
});
