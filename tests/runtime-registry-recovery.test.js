import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerInstall, unregisterInstall } from '../src/install.js';

test('unregisterInstall removes last install and drops empty registry', () => {
  const prevHome = process.env.HOME;
  const home = mkdtempSync(join(tmpdir(), 'as-reg-'));
  process.env.HOME = home;
  try {
    mkdirSync(join(home, '.atomic-skills'), { recursive: true });
    const base = join(home, 'proj');
    mkdirSync(base, { recursive: true });
    registerInstall(base);
    const reg = join(home, '.atomic-skills', 'installs.json');
    assert.equal(existsSync(reg), true);
    const remaining = unregisterInstall(base);
    assert.equal(remaining, 0);
    assert.equal(existsSync(reg), false);
  } finally {
    process.env.HOME = prevHome;
    rmSync(home, { recursive: true, force: true });
  }
});
