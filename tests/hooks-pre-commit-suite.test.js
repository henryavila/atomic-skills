/**
 * PAY-1 item 3 — wire the shell hook suite into the full test run.
 *
 * `scripts/run-tests.mjs` runs every `*.test.js` under `tests/` and `test/`,
 * so a test file that executes the shell suite is the fit here: no discovery
 * rule change, and the hook suite output is visible in the Node report.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SUITE = join('tests', 'hooks', 'pre-commit.test.sh');

describe('shell hook suite', () => {
  it('tests/hooks/pre-commit.test.sh exits 0', () => {
    const result = spawnSync('bash', [SUITE], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 600000,
    });

    assert.equal(result.error, undefined);
    assert.equal(
      result.status,
      0,
      `hook suite failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  });
});
