/**
 * F6/T-003 — Local runtime matrix evidence: process.version is real and
 * engines field matches public support.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNodeVersion, nodeSatisfies } from '../scripts/verify-ci-candidate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('CI runtime matrix local evidence (F6/T-003)', () => {
  it('records real process.version (not inferred)', () => {
    assert.match(process.version, /^v\d+\.\d+\.\d+/);
    const parsed = parseNodeVersion(process.version);
    assert.ok(parsed);
    assert.equal(typeof parsed.major, 'number');
  });

  it('package engines declare 22.18.x or >=24.11.0', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.engines?.node);
    assert.match(pkg.engines.node, /22\.18/);
    assert.match(pkg.engines.node, /24\.11/);
  });

  it('current process satisfies at least one public engine axis', () => {
    const ok =
      nodeSatisfies(process.version, '22.18.x')
      || nodeSatisfies(process.version, '>=24.11.0');
    assert.equal(ok, true, `unsupported node ${process.version}`);
  });
});
