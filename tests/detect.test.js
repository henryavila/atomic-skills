import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectLanguage, detectIDEs, detectIDEState, countSkills } from '../src/detect.js';

describe('detectLanguage', () => {
  const originalLang = process.env.LANG;
  const OriginalDateTimeFormat = Intl.DateTimeFormat;

  beforeEach(() => {
    // Pin Intl locale to en-US so tests are deterministic regardless of host locale.
    Intl.DateTimeFormat = function () {
      return { resolvedOptions: () => ({ locale: 'en-US' }) };
    };
  });

  afterEach(() => {
    Intl.DateTimeFormat = OriginalDateTimeFormat;
    if (originalLang !== undefined) {
      process.env.LANG = originalLang;
    } else {
      delete process.env.LANG;
    }
  });

  it('returns pt when LANG starts with pt', () => {
    process.env.LANG = 'pt_BR.UTF-8';
    assert.strictEqual(detectLanguage(), 'pt');
  });

  it('returns en when LANG is en_US', () => {
    process.env.LANG = 'en_US.UTF-8';
    assert.strictEqual(detectLanguage(), 'en');
  });

  it('returns en when LANG is empty', () => {
    process.env.LANG = '';
    assert.strictEqual(detectLanguage(), 'en');
  });

  it('returns en when LANG is unset', () => {
    delete process.env.LANG;
    assert.strictEqual(detectLanguage(), 'en');
  });

  it('returns pt when LANG is unset and Intl locale is pt', () => {
    delete process.env.LANG;
    Intl.DateTimeFormat = function () {
      return { resolvedOptions: () => ({ locale: 'pt-BR' }) };
    };
    assert.strictEqual(detectLanguage(), 'pt');
  });
});

describe('detectIDEs', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-detect-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects claude-code from .claude directory', () => {
    mkdirSync(join(tempDir, '.claude'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('claude-code'));
  });

  it('detects cursor from .cursor directory', () => {
    mkdirSync(join(tempDir, '.cursor'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('cursor'));
  });

  it('detects multiple IDEs', () => {
    mkdirSync(join(tempDir, '.claude'));
    mkdirSync(join(tempDir, '.cursor'));
    mkdirSync(join(tempDir, '.gemini'));
    const result = detectIDEs(tempDir);
    assert.strictEqual(result.length, 3);
    assert.ok(result.includes('claude-code'));
    assert.ok(result.includes('cursor'));
    assert.ok(result.includes('gemini'));
  });

  it('returns empty array when no IDEs detected', () => {
    const result = detectIDEs(tempDir);
    assert.deepStrictEqual(result, []);
  });

  it('detects codex from .agents directory', () => {
    mkdirSync(join(tempDir, '.agents'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('codex'));
  });

  it('detects github-copilot from .github directory', () => {
    mkdirSync(join(tempDir, '.github'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('github-copilot'));
  });

  it('detects grok from .grok directory', () => {
    mkdirSync(join(tempDir, '.grok'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('grok'));
  });

  it('returns supported, detected, and effective IDE state', () => {
    mkdirSync(join(tempDir, '.gemini'));
    mkdirSync(join(tempDir, '.agents'));
    const result = detectIDEState(tempDir);
    assert.ok(result.supported.includes('gemini'));
    assert.ok(result.supported.includes('codex'));
    assert.deepStrictEqual(result.detected, ['gemini', 'codex']);
    assert.deepStrictEqual(result.effective, ['gemini', 'codex']);
  });
});

describe('countSkills', () => {
  const metaDir = join(process.cwd(), 'meta');

  it('counts core skills only', () => {
    const result = countSkills(metaDir);
    assert.strictEqual(result, '15 core');
  });
});
