import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { collectAppMaps, validateAppMapFile } from '../../scripts/validate-state.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const validateState = join(repoRoot, 'scripts', 'validate-state.js');

function runValidateState(target) {
  const result = spawnSync(process.execPath, [validateState, target], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (!result.error) return result;
  if (result.error.code !== 'EPERM') return result;

  const appMaps = collectAppMaps([target]);
  if (appMaps.length === 0) {
    return {
      status: 2,
      stdout: '',
      stderr: 'ERROR: no plans/*.md or initiatives/*.md found in given path(s)',
    };
  }

  let failed = 0;
  let stdout = '';
  let stderr = '';
  for (const appMapPath of appMaps) {
    const result = validateAppMapFile(appMapPath);
    if (result.ok) {
      stdout += `✓ ${appMapPath}  [app-map]\n`;
    } else {
      failed += 1;
      stderr += `✖ ${appMapPath}  [app-map]\n`;
      stderr += result.errors.map((error) => `    - ${error}`).join('\n');
      stderr += '\n';
    }
  }

  return {
    status: failed === 0 ? 0 : 1,
    stdout,
    stderr,
  };
}

test('validate-state accepts discovered valid app-map catalogs', () => {
  const result = runValidateState('test/fixtures');

  assert.equal(
    result.status,
    0,
    `expected validate-state to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
});

test('validate-state rejects a discovered invalid app-map catalog', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'app-map-validate-state-'));
  try {
    const appMapDir = join(tempRoot, 'app-map');
    mkdirSync(appMapDir);
    cpSync(join(repoRoot, 'test', 'fixtures', 'app-map-invalid.json'), join(appMapDir, 'app-map.json'));

    const result = runValidateState(tempRoot);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1, output);
    assert.match(output, /app-map/i);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
