import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  classifyProviderLimitFailure,
  formatProviderLimitFailureMessage,
} from '../src/provider-limit-failure.js';

const SCRIPT = fileURLToPath(new URL('../scripts/classify-provider-limit.js', import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

describe('classifyProviderLimitFailure — Claude session limit (dogfood)', () => {
  it('detects session limit banner even when exit code is 0', () => {
    const r = classifyProviderLimitFailure({
      provider: 'claude',
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)\n",
      stderr: '',
    });
    assert.ok(r);
    assert.equal(r.kind, 'session-limit');
    assert.equal(r.doNotRetry, true);
    assert.equal(r.retryable, false);
    assert.match(r.resetsAt || '', /5:10pm/);
    assert.match(r.message, /session limit/i);
  });

  it('detects session limit on stderr too', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'Error: session limit resets 9:00am UTC',
    });
    assert.ok(r);
    assert.equal(r.kind, 'session-limit');
  });

  it('does not false-positive a long review that mentions rate limits in findings', () => {
    const body = [
      '---',
      'verdict: needs_changes',
      'pass: blind',
      '---',
      '## Summary',
      'Review of auth rate limit middleware.',
      '## Findings',
      '### F-001 [major]',
      '**Claim:** The rate limit window is wrong',
      '**Impact:** users get 429 early',
      '**Recommendation:** fix the window',
      '**Confidence:** high',
      '**Evidence:**',
      '```',
      'rate limit = 100/min',
      '```',
      ...Array.from({ length: 80 }, (_, i) => `line ${i} of legitimate review body padding`),
    ].join('\n');
    const r = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: body,
      stderr: '',
    });
    assert.equal(r, null);
  });

  it('classifies short rate-limit banners', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: 'Rate limit reached. Try again later.',
      stderr: '',
    });
    assert.ok(r);
    assert.equal(r.kind, 'rate-limit');
    assert.equal(r.doNotRetry, true);
  });

  it('classifies auth failures', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'Not logged in. Please run /login',
    });
    assert.ok(r);
    assert.equal(r.kind, 'auth');
  });

  it('returns null for empty / normal review stub', () => {
    assert.equal(
      classifyProviderLimitFailure({
        exitCode: 0,
        stdout: '---\nverdict: approve\npass: blind\n---\n## Summary\nok\n## Findings\n',
      }),
      null,
    );
    assert.equal(classifyProviderLimitFailure({}), null);
  });
});

describe('formatProviderLimitFailureMessage', () => {
  it('tells external-both to continue other legs', () => {
    const f = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)",
    });
    const msg = formatProviderLimitFailureMessage(f, { mode: 'external-both' });
    assert.match(msg, /continue other legs/i);
  });

  it('lists alternate modes for single-provider abort', () => {
    const f = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)",
    });
    const msg = formatProviderLimitFailureMessage(f, {
      mode: 'claude',
      alternateModes: ['codex'],
    });
    assert.match(msg, /--mode=codex/);
    assert.match(msg, /ABORT/i);
  });
});

describe('classify-provider-limit CLI', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'provider-limit-cli-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints limitFailure:false JSON and exits 0 for a normal review', () => {
    const stdout = join(dir, 'out.md');
    writeFileSync(stdout, '---\nverdict: approve\n---\n## Summary\nok\n');
    const r = runCli(['--provider=claude', '--exit=0', `--stdout=${stdout}`, '--json']);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '{"limitFailure":false}\n');
    assert.equal(r.stderr, '');
  });

  it('prints limit JSON and exits 2 for a session-limit banner', () => {
    const stdout = join(dir, 'out.md');
    writeFileSync(stdout, "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)\n");
    const r = runCli(['--provider=claude', '--exit=0', `--stdout=${stdout}`, '--json']);
    assert.equal(r.status, 2);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.limitFailure, true);
    assert.equal(parsed.kind, 'session-limit');
    assert.match(parsed.formatted, /session limit/i);
    assert.equal(r.stderr, '');
  });

  it('prints the formatted message on stderr without --json', () => {
    const stdout = join(dir, 'out.md');
    writeFileSync(stdout, "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)\n");
    const r = runCli(['--provider=claude', '--exit=0', `--stdout=${stdout}`]);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /session limit/i);
    assert.ok(r.stderr.endsWith('\n'));
  });

  it('exits 1 when the named stdout file is missing', () => {
    const missing = join(dir, 'missing.md');
    const r = runCli([`--stdout=${missing}`]);
    assert.equal(r.status, 1);
    assert.equal(r.stderr, `ERROR: stdout file missing: ${missing}\n`);
  });
});
