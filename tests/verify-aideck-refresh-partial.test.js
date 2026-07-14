import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const VERIFY_PATH = fileURLToPath(new URL('../scripts/verify-aideck-consumer.mjs', import.meta.url));
const VERIFY_URL = pathToFileURL(VERIFY_PATH).href;

function runVerifier(refreshSummary) {
  const home = mkdtempSync(join(tmpdir(), 'verify-aideck-refresh-'));
  try {
    const refreshModuleSource = `
      export function refreshState() {
        return ${JSON.stringify(refreshSummary)};
      }
    `;
    const refreshModuleUrl = `data:text/javascript,${encodeURIComponent(refreshModuleSource)}`;
    const loaderSource = `
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === './refresh-state.js' && context.parentURL === ${JSON.stringify(VERIFY_URL)}) {
          return { url: ${JSON.stringify(refreshModuleUrl)}, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      }
    `;
    const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
    return spawnSync(
      process.execPath,
      ['--no-warnings', '--experimental-loader', loaderUrl, VERIFY_PATH, '--smoke'],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        encoding: 'utf8',
        env: { ...process.env, HOME: home },
      },
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe('verify-aideck-consumer refresh result', () => {
  it('reports project-index conflicts as a partial failure instead of a clean refresh pass', () => {
    const result = runVerifier({
      seriesWritten: 13,
      seriesError: null,
      indexErrors: ['PROJECT-STATUS.md changed during refresh after 3 attempts'],
    });
    const output = stripVTControlCharacters(result.stdout);

    assert.equal(result.status, 0, result.stderr);
    assert.match(output, /refresh-state had a partial failure: PROJECT-STATUS\.md changed/);
    assert.doesNotMatch(output, /refreshed 13 aiDeck state files/);
    assert.match(output, /RESULT: PASS with 1 warning/);
  });

  it('keeps series failures on the partial-failure path', () => {
    const result = runVerifier({
      seriesWritten: 0,
      seriesError: 'series generation failed',
      indexErrors: [],
    });
    const output = stripVTControlCharacters(result.stdout);

    assert.equal(result.status, 0, result.stderr);
    assert.match(output, /refresh-state had a partial failure: series generation failed/);
    assert.match(output, /RESULT: PASS with 1 warning/);
  });

  it('combines simultaneous index and series failures into one warning', () => {
    const result = runVerifier({
      seriesWritten: 0,
      seriesError: 'series generation failed',
      indexErrors: ['project-a conflict', 'project-b conflict'],
    });
    const output = stripVTControlCharacters(result.stdout);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      output,
      /refresh-state had a partial failure: project-a conflict; project-b conflict; series generation failed/,
    );
    assert.match(output, /RESULT: PASS with 1 warning/);
  });

  it('keeps a legacy clean summary without indexErrors on the pass path', () => {
    const result = runVerifier({
      seriesWritten: 13,
      seriesError: null,
    });
    const output = stripVTControlCharacters(result.stdout);

    assert.equal(result.status, 0, result.stderr);
    assert.match(output, /refreshed 13 aiDeck state files/);
    assert.match(output, /RESULT: PASS —/);
    assert.doesNotMatch(output, /refresh-state had a partial failure/);
  });
});
