import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INVOCATION = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt',
);
const PREFLIGHT = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt',
);
const REQUIRED = join(
  ROOT,
  'tests/fixtures/cross-model-bridge/claude-invocation-required-flags.txt',
);

describe('claude provider invocation shape', () => {
  it('ships a non-empty invocation-canonical leaf', () => {
    assert.ok(existsSync(INVOCATION), `missing ${INVOCATION}`);
    const body = readFileSync(INVOCATION, 'utf8');
    assert.ok(body.trim().length > 0, 'invocation-canonical must be non-empty');
  });

  it('documents portable timeout, safe-mode, and sealed headless flags', () => {
    const body = readFileSync(INVOCATION, 'utf8');
    const required = readFileSync(REQUIRED, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    for (const token of required) {
      assert.ok(
        body.includes(token),
        `invocation-canonical must contain ${JSON.stringify(token)}`,
      );
    }
    assert.match(body, /safe-mode/);
    assert.match(body, /run_with_timeout/);
    assert.match(body, /dontAsk/);
    assert.match(body, /bypassPermissions|dangerously-skip-permissions/);
    assert.match(body, /no live model catalog|no live catalog/i);
  });

  it('preflight documents which claude and auth failure messages', () => {
    assert.ok(existsSync(PREFLIGHT), `missing ${PREFLIGHT}`);
    const body = readFileSync(PREFLIGHT, 'utf8');
    assert.match(body, /which claude/);
    assert.match(body, /claude --version/);
    assert.match(body, /claude auth login|ANTHROPIC_API_KEY/);
  });
});
