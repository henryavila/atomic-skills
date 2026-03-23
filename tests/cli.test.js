import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');

describe('CLI --scope validation', () => {
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

  it('shows help with --scope in usage', () => {
    const output = execFileSync('node', [CLI], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--scope'));
  });
});
