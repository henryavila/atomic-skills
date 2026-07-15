import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DURABLE_URL = pathToFileURL(join(ROOT, 'src', 'durable-file.js')).href;
const CONFINED_URL = pathToFileURL(join(ROOT, 'src', 'confined-path.js')).href;
const COMPLETION_URL = pathToFileURL(join(ROOT, 'scripts', 'append-completion.js')).href;
const MIGRATION_URL = pathToFileURL(join(ROOT, 'scripts', 'migrate-state-integrity.js')).href;

function runWindowsDurabilityScenario(root) {
  const fsModuleSource = [
    "import * as fs from 'node:fs';",
    "export * from 'node:fs';",
    `export function openSync(path, ...args) {
      if (args[0] === 'r' && fs.statSync(path).isDirectory()) {
        throw new Error('directory descriptors are unsupported on win32');
      }
      return fs.openSync(path, ...args);
    }`,
  ].join('\n');
  const fsModuleUrl = `data:text/javascript,${encodeURIComponent(fsModuleSource)}`;
  const parents = [DURABLE_URL, COMPLETION_URL, MIGRATION_URL];
  const loaderSource = `
    const parents = new Set(${JSON.stringify(parents)});
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'node:fs' && parents.has(context.parentURL)) {
        return { url: ${JSON.stringify(fsModuleUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `;
  const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
  const childSource = `
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const { mkdirSync, writeFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { durableReplace, durableUnlink } = await import(${JSON.stringify(DURABLE_URL)});
    const { appendCompletion } = await import(${JSON.stringify(COMPLETION_URL)});
    const { applyMigrationAtomically } = await import(${JSON.stringify(MIGRATION_URL)});
    const root = process.argv[1];

    const marker = join(root, 'durable', 'marker.json');
    durableReplace(marker, '{"ok":true}\\n');
    durableUnlink(marker);

    appendCompletion(root, {
      event: 'task-done', projectId: 'proj', planSlug: 'plan', phaseId: 'F0',
      taskId: 'T-001', ts: '2026-07-15T00:00:00Z',
    });

    const migrationDir = join(root, 'migration');
    mkdirSync(migrationDir, { recursive: true });
    const source = join(migrationDir, 'phase.md');
    writeFileSync(source, 'before\\n');
    applyMigrationAtomically([{ filePath: source, content: 'after\\n' }], {
      transactionRoot: migrationDir,
    });
    console.log(JSON.stringify({ markerExists: existsSync(marker), source }));
  `;
  return spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-loader', loaderUrl, '--input-type=module', '-e', childSource, root],
    { cwd: ROOT, encoding: 'utf8' },
  );
}

function runConfinedDirectoryDurabilityScenario(root) {
  const signal = join(root, 'directory-fsyncs.jsonl');
  const fsModuleSource = [
    "import * as fs from 'node:fs';",
    "export * from 'node:fs';",
    `export function openSync(path, ...args) {
      const fd = fs.openSync(path, ...args);
      if (args[0] === 'r' && fs.statSync(path).isDirectory()) {
        fs.appendFileSync(${JSON.stringify(signal)}, JSON.stringify(path) + '\\n');
      }
      return fd;
    }`,
  ].join('\n');
  const fsModuleUrl = `data:text/javascript,${encodeURIComponent(fsModuleSource)}`;
  const loaderSource = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'node:fs' && context.parentURL === ${JSON.stringify(DURABLE_URL)}) {
        return { url: ${JSON.stringify(fsModuleUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `;
  const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
  const childSource = `
    const { confinedRepositoryFile } = await import(${JSON.stringify(CONFINED_URL)});
    const root = process.argv[1];
    confinedRepositoryFile(
      root,
      ['.atomic-skills', 'status', 'done-transactions'],
      'marker.json',
      { createParents: true },
    );
  `;
  return {
    signal,
    child: spawnSync(
      process.execPath,
      ['--no-warnings', '--experimental-loader', loaderUrl, '--input-type=module', '-e', childSource, root],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  };
}

test('marker, completion and migration durability skip unsupported directory fsync on win32', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'as-durability-win32-')));
  try {
    const child = runWindowsDurabilityScenario(root);
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.markerExists, false);
    assert.equal(readFileSync(result.source, 'utf8'), 'after\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('new confined marker directories durably link every component into its parent', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'as-durability-confined-')));
  try {
    const { child, signal } = runConfinedDirectoryDurabilityScenario(root);
    assert.equal(child.status, 0, child.stderr);
    const fsynced = readFileSync(signal, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(fsynced, [
      root,
      join(root, '.atomic-skills'),
      join(root, '.atomic-skills', 'status'),
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
