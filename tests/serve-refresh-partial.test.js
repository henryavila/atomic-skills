import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const SERVE_PATH = fileURLToPath(new URL('../src/serve.js', import.meta.url));
const SERVE_URL = pathToFileURL(SERVE_PATH).href;

function runEnsureAideck(refreshSummary) {
  const home = mkdtempSync(join(tmpdir(), 'serve-refresh-home-'));
  const repo = mkdtempSync(join(tmpdir(), 'serve-refresh-repo-'));
  try {
    mkdirSync(join(home, '.atomic-skills'), { recursive: true });
    writeFileSync(
      join(home, '.atomic-skills', 'env'),
      "export AS_DASHBOARD_URL='http://127.0.0.1:7777'\n",
    );
    const refreshModuleSource = `
      export function refreshState() {
        return ${JSON.stringify(refreshSummary)};
      }
    `;
    const refreshModuleUrl = `data:text/javascript,${encodeURIComponent(refreshModuleSource)}`;
    const loaderSource = `
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === '../scripts/refresh-state.js' && context.parentURL === ${JSON.stringify(SERVE_URL)}) {
          return { url: ${JSON.stringify(refreshModuleUrl)}, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      }
    `;
    const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
    const childSource = `
      globalThis.fetch = async (url, init = {}) => {
        const href = String(url);
        if (href.endsWith('/api/health')) {
          return new Response(JSON.stringify({ service: 'aideck' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (href.endsWith('/api/projects/register')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      };
      const { ensureAideck } = await import(${JSON.stringify(SERVE_URL)});
      process.chdir(${JSON.stringify(repo)});
      const url = await ensureAideck({ timeoutMs: 500 });
      if (url !== 'http://127.0.0.1:7777') throw new Error('unexpected url: ' + url);
    `;
    return spawnSync(
      process.execPath,
      ['--no-warnings', '--experimental-loader', loaderUrl, '--input-type=module', '-e', childSource],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        encoding: 'utf8',
        env: { ...process.env, HOME: home },
      },
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
}

describe('serve refresh partial-failure reporting', () => {
  it('reports project-index conflicts when the series succeeds', () => {
    const result = runEnsureAideck({
      indexErrors: ['PROJECT-STATUS.md changed during refresh after 3 attempts'],
      seriesError: null,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /atomic-skills serve: refresh-state partial failure — PROJECT-STATUS\.md changed/,
    );
  });

  it('keeps series errors observable', () => {
    const result = runEnsureAideck({
      indexErrors: [],
      seriesError: 'series generation failed',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /refresh-state partial failure — series generation failed/);
  });

  it('combines simultaneous index and series failures into one diagnostic', () => {
    const result = runEnsureAideck({
      indexErrors: ['project-a conflict', 'project-b conflict'],
      seriesError: 'series generation failed',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /refresh-state partial failure — project-a conflict; project-b conflict; series generation failed/,
    );
    assert.equal(result.stderr.match(/refresh-state partial failure/g)?.length, 1);
  });

  it('keeps a legacy clean summary silent', () => {
    const result = runEnsureAideck({ seriesError: null });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
  });
});
