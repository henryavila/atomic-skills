import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INVOCATION = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt',
);
const PREFLIGHT = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/grok/preflight-checks.txt',
);
const REQUIRED = join(
  ROOT,
  'tests/fixtures/cross-model-bridge/grok-invocation-required-flags.txt',
);

describe('grok provider invocation shape', () => {
  it('ships a non-empty invocation-canonical leaf', () => {
    assert.ok(existsSync(INVOCATION), `missing ${INVOCATION}`);
    const body = readFileSync(INVOCATION, 'utf8');
    assert.ok(body.trim().length > 0, 'invocation-canonical must be non-empty');
  });

  it('documents portable timeout, sandbox, and grok headless flags', () => {
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
    assert.match(body, /sandbox\s+read-only|--sandbox read-only/);
    assert.match(body, /run_with_timeout/);
    assert.match(body, /--prompt-file/);
  });

  it('preflight documents which grok and auth failure messages', () => {
    assert.ok(existsSync(PREFLIGHT), `missing ${PREFLIGHT}`);
    const body = readFileSync(PREFLIGHT, 'utf8');
    assert.match(body, /which grok/);
    assert.match(body, /grok --version/);
    assert.match(body, /Not signed in|XAI_API_KEY|grok login/);
  });
});
