import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');

describe('CLI flag parsing', () => {
  it('rejects invalid --scope value', () => {
    assert.throws(() => {
      execFileSync('node', [CLI, 'install', '--scope', 'invalid'], {
        encoding: 'utf8',
        timeout: 5000,
      });
    }, (err) => {
      assert.ok(err.stderr.includes('--scope must be'));
      return true;
    });
  });

  it('shows help when no command given', () => {
    const output = execFileSync('node', [CLI], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--yes'));
    assert.ok(output.includes('--project'));
    assert.ok(output.includes('--ide'));
    assert.ok(output.includes('--all-detected'));
    assert.ok(output.includes('--lang'));
    assert.ok(output.includes('detect'));
    assert.ok(output.includes('status'));
  });

  it('shows help with -h flag', () => {
    const output = execFileSync('node', [CLI, '-h'], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('Atomic Skills'));
  });

  it('shows help with install -h (flag takes priority over command)', () => {
    const output = execFileSync('node', [CLI, 'install', '-h'], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--yes'));
  });

  it('runs status command without error when not installed', () => {
    const output = execFileSync('node', [CLI, 'status'], {
      encoding: 'utf8',
      timeout: 5000,
      cwd: '/tmp',
    });
    assert.ok(output.length > 0);
  });

  it('detect --json reports supported, detected, and effective IDEs', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-cli-detect-'));
    try {
      mkdirSync(join(home, '.gemini'));
      mkdirSync(join(home, '.agents'));
      const output = execFileSync('node', [CLI, 'detect', '--json'], {
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, HOME: home },
      });
      const parsed = JSON.parse(output);
      assert.ok(parsed.supported.includes('gemini'));
      assert.deepStrictEqual(parsed.detected, ['gemini', 'codex']);
      assert.deepStrictEqual(parsed.effective, ['gemini-commands', 'codex']);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('install --all-detected installs for every detected IDE', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-cli-all-detected-'));
    try {
      mkdirSync(join(home, '.claude'));
      mkdirSync(join(home, '.agents'));
      execFileSync('node', [CLI, 'install', '--yes', '--all-detected', '--lang', 'pt'], {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, HOME: home },
      });
      assert.ok(existsSync(join(home, '.claude/commands/atomic-skills/fix.md')));
      assert.ok(existsSync(join(home, '.agents/skills/atomic-skills/fix/SKILL.md')));

      const manifest = JSON.parse(readFileSync(join(home, '.atomic-skills/manifest.json'), 'utf8'));
      assert.deepStrictEqual(manifest.ides, ['claude-code', 'codex']);
      assert.strictEqual(manifest.language, 'pt');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('install --ide detected is an alias for all detected IDEs', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-cli-ide-detected-'));
    try {
      mkdirSync(join(home, '.agents'));
      execFileSync('node', [CLI, 'install', '--yes', '--ide', 'detected', '--lang', 'en'], {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, HOME: home },
      });
      assert.ok(existsSync(join(home, '.agents/skills/atomic-skills/fix/SKILL.md')));

      const manifest = JSON.parse(readFileSync(join(home, '.atomic-skills/manifest.json'), 'utf8'));
      assert.deepStrictEqual(manifest.ides, ['codex']);
      assert.strictEqual(manifest.language, 'en');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('rejects --ide together with --all-detected', () => {
    assert.throws(() => {
      execFileSync('node', [CLI, 'install', '--yes', '--ide', 'codex', '--all-detected'], {
        encoding: 'utf8',
        timeout: 5000,
      });
    }, (err) => {
      assert.ok(err.stderr.includes('either --ide or --all-detected'));
      return true;
    });
  });
});
