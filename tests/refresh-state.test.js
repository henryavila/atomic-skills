import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { refreshState } from '../scripts/refresh-state.js';
import { validateAideckState } from '../scripts/validate-aideck-state.js';

const NOW = Date.parse('2026-01-06T00:00:00Z');
const REFRESH_STATE_URL = new URL('../scripts/refresh-state.js', import.meta.url).href;

function runRefreshWithFsShim(dir, shimSource, { platform } = {}) {
  const fsModuleSource = [
    "import * as fs from 'node:fs';",
    "export * from 'node:fs';",
    shimSource,
  ].join('\n');
  const fsModuleUrl = `data:text/javascript,${encodeURIComponent(fsModuleSource)}`;
  const loaderSource = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'node:fs' && context.parentURL === ${JSON.stringify(REFRESH_STATE_URL)}) {
        return { url: ${JSON.stringify(fsModuleUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `;
  const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
  const childSource = `
    import { refreshState } from ${JSON.stringify(REFRESH_STATE_URL)};
    ${platform ? `Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });` : ''}
    const summary = refreshState(${JSON.stringify(dir)}, { nowMs: ${NOW}, branch: null });
    console.log(JSON.stringify(summary));
  `;
  return spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-loader', loaderUrl, '--input-type=module', '-e', childSource],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

function replaceInitiativeField(dir, field, value) {
  const path = join(
    dir,
    '.atomic-skills',
    'projects',
    'projA',
    'plan-a',
    'phases',
    'f1.md',
  );
  const raw = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    raw.replace(new RegExp(`^${field}:.*$`, 'm'), () => `${field}: ${JSON.stringify(value)}`),
  );
}

function writeSeedState(dir, { completions = true } = {}) {
  const planDir = join(dir, '.atomic-skills', 'projects', 'projA', 'plan-a');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  mkdirSync(join(dir, '.atomic-skills', 'analytics'), { recursive: true });

  writeFileSync(
    join(planDir, 'plan.md'),
    '---\nslug: plan-a\ntitle: Plan A\nstatus: active\nstarted: "2026-01-01T00:00:00Z"\ndeadline: "2026-01-11T00:00:00Z"\nlastUpdated: "2026-01-05T00:00:00Z"\ncurrentPhase: F1\nphases:\n  - id: F1\n    title: Phase 1\n    status: active\n---\n',
  );
  writeFileSync(
    join(planDir, 'phases', 'f1.md'),
    '---\nslug: f1\ntitle: Phase 1 work\nstatus: active\nphaseId: F1\nparentPlan: plan-a\nlastUpdated: "2026-01-05T12:00:00Z"\ntasks:\n  - id: T-1\n    title: First\n    status: done\n    weight: 2\n  - id: T-2\n    title: Second\n    status: pending\n    weight: 3\nexitGates: []\n---\n',
  );
  writeFileSync(
    join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md'),
    [
      '---',
      'lastUpdated: 2026-01-01T00:00:00Z',
      'schemaVersion: "0.1"',
      'activePlans: 1',
      'activeInitiatives: 1',
      'archivedCount: 0',
      '---',
      '',
      '# Project Status Index',
      '',
      '### plan-a phases',
      '',
      '| Initiative | Phase | Status | Tasks | Gates |',
      '|------------|-------|--------|-------|-------|',
      '| f1 | F1 | pending | 0/2 | 0/0 |',
      '| unrelated-row | F9 | paused | 7/9 | 1/3 |',
      '',
      'Unrelated prose must survive byte-for-byte.',
      '',
    ].join('\n'),
  );

  if (completions) {
    writeFileSync(
      join(dir, '.atomic-skills', 'analytics', 'completions.jsonl'),
      [
        JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T10:00:00Z', event: 'task-done', weight: 2, weightBasis: 'proxy' }),
        JSON.stringify({ projectId: 'projA', planSlug: 'plan-a', phaseId: 'F1', taskId: 'T-1', ts: '2026-01-03T11:00:00Z', event: 'task-done', weight: 1, weightBasis: 'count' }),
      ].join('\n') + '\n',
    );
  }
}

describe('refreshState consumer series integration', () => {
  it('regenerates burnup/spi while preserving the existing refresh passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-'));
    try {
      writeSeedState(dir);

      const burnupPath = join(dir, '.atomic-skills', '.aideck', 'state', 'burnup.json');
      const spiPath = join(dir, '.atomic-skills', '.aideck', 'state', 'spi.json');
      assert.equal(existsSync(burnupPath), false);

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(existsSync(burnupPath), true);
      assert.equal(existsSync(spiPath), true);
      const burnup = JSON.parse(readFileSync(burnupPath, 'utf8'));
      const spi = JSON.parse(readFileSync(spiPath, 'utf8'));
      assert.ok(Array.isArray(burnup));
      assert.ok(burnup.length > 0);
      assert.ok(Array.isArray(spi));
      assert.ok(spi.length > 0);

      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
      assert.equal(Object.hasOwn(summary, 'rollupsChanged'), true);
      assert.equal(Object.hasOwn(summary, 'focusChanged'), true);
      assert.equal(Object.hasOwn(summary, 'digestWritten'), true);
      assert.equal(summary.seriesWritten, 13); // base state series (plans, phases, initiatives, tasks, gates, phaseGates, stack, parked, emerged, projects, planEdges — totals.json retired) + burnup.json + spi.json

      const phases = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'phases.json'), 'utf8'));
      assert.equal(phases.find((phase) => phase.id === 'F1')?.tasksText, '1/2');

      const validation = validateAideckState(dir, { nowMs: NOW });
      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns a summary and keeps core outputs when there are zero completion events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-empty-'));
    try {
      writeSeedState(dir, { completions: false });

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(typeof summary, 'object');
      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
      const burnup = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'burnup.json'), 'utf8'));
      const spi = JSON.parse(readFileSync(join(dir, '.atomic-skills', '.aideck', 'state', 'spi.json'), 'utf8'));
      assert.ok(Array.isArray(burnup));
      assert.ok(Array.isArray(spi));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes existing PROJECT-STATUS initiative rows idempotently without touching unrelated content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const shadowInitiativePath = join(
        dir,
        '.atomic-skills',
        'projects',
        'projA',
        'plan-a',
        'phases',
        'completed-plan.md',
      );
      writeFileSync(
        shadowInitiativePath,
        '---\nslug: completed-plan\ntitle: Completed plan phase\nstatus: done\nphaseId: F0\nparentPlan: plan-a\nlastUpdated: "2026-01-04T12:00:00Z"\ntasks:\n  - id: T-1\n    title: Closed\n    status: done\nexitGates:\n  - id: G-1\n    description: Closed gate\n    status: met\n---\n',
      );
      const seededIndex = readFileSync(indexPath, 'utf8').replace(
        'Unrelated prose must survive byte-for-byte.\n',
        [
          'Unrelated prose must survive byte-for-byte.',
          '',
          '## Done Plans (not archived)',
          '',
          '| Slug | Status | Current Phase | Branch | Started | Phases |',
          '|------|--------|---------------|--------|---------|--------|',
          '| completed-plan | done | F0 | plan/completed-plan | 2025-12-01 | 1/1 |',
          '',
        ].join('\n'),
      );
      writeFileSync(indexPath, seededIndex);

      const first = refreshState(dir, { nowMs: NOW, branch: null });
      const once = readFileSync(indexPath, 'utf8');

      assert.match(once, /^lastUpdated: 2026-01-05T12:00:00Z$/m);
      assert.match(once, /^\| f1 \| F1 \| active \| 1\/2 \| 0\/0 \|$/m);
      assert.match(once, /^\| unrelated-row \| F9 \| paused \| 7\/9 \| 1\/3 \|$/m);
      assert.match(
        once,
        /^\| completed-plan \| done \| F0 \| plan\/completed-plan \| 2025-12-01 \| 1\/1 \|$/m,
      );
      assert.match(once, /Unrelated prose must survive byte-for-byte\./);
      assert.equal(first.indexesChanged, 1);

      const second = refreshState(dir, { nowMs: NOW, branch: null });
      const twice = readFileSync(indexPath, 'utf8');
      assert.equal(twice, once);
      assert.equal(second.indexesChanged, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surfaces malformed phase frontmatter through the project-index partial-failure channel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-malformed-phase-'));
    try {
      writeSeedState(dir);
      const phasePath = join(
        dir,
        '.atomic-skills',
        'projects',
        'projA',
        'plan-a',
        'phases',
        'f1.md',
      );
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      writeFileSync(phasePath, '---\nslug: [unterminated\n---\n');

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(summary.indexesChanged, 0);
      assert.equal(summary.indexErrors.length, 1);
      assert.match(summary.indexErrors[0], /f1\.md.*YAML parse error/i);
      assert.match(readFileSync(indexPath, 'utf8'), /^\| f1 \| F1 \| pending \| 0\/2 \| 0\/0 \|$/m);
      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves the existing index row when required projection fields are invalid', () => {
    const cases = [
      { field: 'phaseId', value: '""', expected: /phaseId.*non-empty string/i },
      { field: 'status', value: 'unknown', expected: /initiative status.*valid/i },
      { field: 'tasks', value: '{}', expected: /tasks.*array/i },
      { field: 'exitGates', value: '{}', expected: /exitGates.*array/i },
      { field: 'tasks', value: '[{status: unknown}]', expected: /task status.*valid/i },
      { field: 'exitGates', value: '[{status: unknown}]', expected: /exit gate status.*valid/i },
    ];

    for (const testCase of cases) {
      const dir = mkdtempSync(join(tmpdir(), `refresh-state-index-invalid-${testCase.field}-`));
      try {
        writeSeedState(dir);
        const phasePath = join(
          dir,
          '.atomic-skills',
          'projects',
          'projA',
          'plan-a',
          'phases',
          'f1.md',
        );
        const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
        const phase = [
          '---',
          'slug: f1',
          `status: ${testCase.field === 'status' ? testCase.value : 'active'}`,
          `phaseId: ${testCase.field === 'phaseId' ? testCase.value : 'F1'}`,
          'lastUpdated: "2026-01-05T12:00:00Z"',
          `tasks: ${testCase.field === 'tasks' ? testCase.value : '[]'}`,
          `exitGates: ${testCase.field === 'exitGates' ? testCase.value : '[]'}`,
          '---',
          '',
        ].join('\n');
        writeFileSync(phasePath, phase);

        const summary = refreshState(dir, { nowMs: NOW, branch: null });

        assert.equal(summary.indexesChanged, 0, testCase.field);
        assert.equal(summary.indexErrors.length, 1, testCase.field);
        assert.match(summary.indexErrors[0], testCase.expected, testCase.field);
        assert.match(
          readFileSync(indexPath, 'utf8'),
          /^\| f1 \| F1 \| pending \| 0\/2 \| 0\/0 \|$/m,
          testCase.field,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('retries from the latest index snapshot instead of losing a concurrent update after read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-conflict-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const concurrentRow = '| concurrent-transition | F9 | active | 0/1 | 0/0 |';
      const child = runRefreshWithFsShim(dir, `
        let indexReads = 0;
        export function readFileSync(path, ...args) {
          const result = fs.readFileSync(path, ...args);
          if (String(path).endsWith('PROJECT-STATUS.md')) {
            indexReads += 1;
            if (indexReads === 1) {
              const raw = typeof result === 'string' ? result : result.toString('utf8');
              const concurrent = raw.replace(
                '| unrelated-row | F9 | paused | 7/9 | 1/3 |',
                ${JSON.stringify(`${concurrentRow}\n| unrelated-row | F9 | paused | 7/9 | 1/3 |`)},
              );
              fs.writeFileSync(path, concurrent, 'utf8');
            }
          }
          return result;
        }
      `);

      assert.equal(child.status, 0, child.stderr);
      const refreshed = readFileSync(indexPath, 'utf8');
      assert.match(refreshed, /^\| f1 \| F1 \| active \| 1\/2 \| 0\/0 \|$/m);
      assert.match(refreshed, new RegExp(`^${concurrentRow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rebuilds initiative projections after an index conflict instead of publishing stale task state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-projection-conflict-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const initiativePath = join(
        dir,
        '.atomic-skills',
        'projects',
        'projA',
        'plan-a',
        'phases',
        'f1.md',
      );
      const child = runRefreshWithFsShim(dir, `
        let indexReads = 0;
        export function readFileSync(path, ...args) {
          const result = fs.readFileSync(path, ...args);
          if (String(path).endsWith('PROJECT-STATUS.md')) {
            indexReads += 1;
            if (indexReads === 1) {
              fs.writeFileSync(path, String(result) + '\\n<!-- concurrent-index-update -->\\n', 'utf8');
              const initiative = fs.readFileSync(${JSON.stringify(initiativePath)}, 'utf8');
              fs.writeFileSync(
                ${JSON.stringify(initiativePath)},
                initiative
                  .replace(/^lastUpdated:.*$/m, 'lastUpdated: "2026-01-06T12:00:00Z"')
                  .replace('status: active', 'status: done')
                  .replace('status: pending', 'status: done'),
                'utf8',
              );
            }
          }
          return result;
        }
      `);

      assert.equal(child.status, 0, child.stderr);
      const refreshed = readFileSync(indexPath, 'utf8');
      assert.match(refreshed, /^lastUpdated: 2026-01-06T12:00:00Z$/m);
      assert.match(refreshed, /^\| f1 \| F1 \| done \| 2\/2 \| 0\/0 \|$/m);
      assert.match(refreshed, /<!-- concurrent-index-update -->/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports bounded repeated index conflicts but still emits focus and consumer state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-conflict-limit-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const child = runRefreshWithFsShim(dir, `
        let version = 0;
        export function readFileSync(path, ...args) {
          const result = fs.readFileSync(path, ...args);
          if (String(path).endsWith('PROJECT-STATUS.md')) {
            version += 1;
            const raw = typeof result === 'string' ? result : result.toString('utf8');
            fs.writeFileSync(path, raw + '\\n<!-- concurrent-version-' + version + ' -->\\n', 'utf8');
          }
          return result;
        }
      `);

      assert.equal(child.status, 0, child.stderr);
      assert.match(child.stderr, /PROJECT-STATUS\.md changed during refresh after 3 attempts/);
      const summary = JSON.parse(child.stdout.trim());
      assert.deepEqual(summary.indexErrors, [
        'PROJECT-STATUS.md changed during refresh after 3 attempts',
      ]);
      assert.equal(summary.indexesChanged, 0);
      assert.equal(summary.seriesWritten, 13);
      assert.equal(existsSync(join(dir, '.atomic-skills', 'focus.json')), true);
      const latest = readFileSync(indexPath, 'utf8');
      assert.match(latest, /<!-- concurrent-version-/);
      assert.equal(latest.match(/<!-- concurrent-version-/g)?.length, 6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves a symlinked project index and publishes through to its target', {
    skip: process.platform === 'win32',
  }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-symlink-'));
    try {
      writeSeedState(dir);
      const projectDir = join(dir, '.atomic-skills', 'projects', 'projA');
      const indexPath = join(projectDir, 'PROJECT-STATUS.md');
      const targetPath = join(projectDir, 'CANONICAL-PROJECT-STATUS.md');
      writeFileSync(targetPath, readFileSync(indexPath, 'utf8'));
      rmSync(indexPath);
      symlinkSync(targetPath, indexPath);

      const summary = refreshState(dir, { nowMs: NOW, branch: null });

      assert.equal(summary.indexesChanged, 1);
      assert.equal(lstatSync(indexPath).isSymbolicLink(), true);
      assert.match(readFileSync(targetPath, 'utf8'), /^\| f1 \| F1 \| active \| 1\/2 \| 0\/0 \|$/m);
      assert.equal(readFileSync(indexPath, 'utf8'), readFileSync(targetPath, 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a project-index symlink that escapes to an external directory before reading or writing it', {
    skip: process.platform === 'win32',
  }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-escape-'));
    const outside = mkdtempSync(join(tmpdir(), 'refresh-state-index-outside-'));
    try {
      writeSeedState(dir);
      const projectDir = join(dir, '.atomic-skills', 'projects', 'projA');
      const indexPath = join(projectDir, 'PROJECT-STATUS.md');
      const targetPath = join(outside, 'user-file.md');
      const original = readFileSync(indexPath, 'utf8');
      writeFileSync(targetPath, original);
      rmSync(indexPath);
      symlinkSync(targetPath, indexPath);

      assert.throws(
        () => refreshState(dir, { nowMs: NOW, branch: null }),
        /PROJECT-STATUS\.md symlink resolves outside its managed project directory/,
      );
      assert.equal(readFileSync(targetPath, 'utf8'), original);
      assert.equal(lstatSync(indexPath).isSymbolicLink(), true);
      assert.deepEqual(readdirSync(outside), ['user-file.md']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects a project-index symlink into a sibling project before corrupting that index', {
    skip: process.platform === 'win32',
  }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-sibling-escape-'));
    try {
      writeSeedState(dir);
      const projectsDir = join(dir, '.atomic-skills', 'projects');
      const projectDir = join(projectsDir, 'projA');
      const indexPath = join(projectDir, 'PROJECT-STATUS.md');
      const siblingDir = join(projectsDir, 'projB');
      const siblingIndexPath = join(siblingDir, 'PROJECT-STATUS.md');
      const original = readFileSync(indexPath, 'utf8');
      mkdirSync(siblingDir, { recursive: true });
      writeFileSync(siblingIndexPath, original);
      rmSync(indexPath);
      symlinkSync(siblingIndexPath, indexPath);

      assert.throws(
        () => refreshState(dir, { nowMs: NOW, branch: null }),
        /PROJECT-STATUS\.md symlink resolves outside its managed project directory/,
      );
      assert.equal(readFileSync(siblingIndexPath, 'utf8'), original);
      assert.equal(lstatSync(indexPath).isSymbolicLink(), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips the unsupported parent-directory fsync on win32 after publishing the index', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-win32-'));
    try {
      writeSeedState(dir);
      const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
      const child = runRefreshWithFsShim(dir, `
        export function openSync(path, ...args) {
          if (String(path).endsWith('projA') && args[0] === 'r') {
            throw new Error('directory descriptors are unsupported on win32');
          }
          return fs.openSync(path, ...args);
        }
      `, { platform: 'win32' });

      assert.equal(child.status, 0, child.stderr);
      assert.match(readFileSync(indexPath, 'utf8'), /^\| f1 \| F1 \| active \| 1\/2 \| 0\/0 \|$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the original index intact on temp-write and pre-commit rename failures', () => {
    for (const scenario of [
      {
        label: 'temporary write',
        error: /injected temporary write failure/,
        shim: `
          const temporaryFds = new Set();
          export function openSync(path, ...args) {
            const fd = fs.openSync(path, ...args);
            if (String(path).includes('.refresh-') && String(path).endsWith('.tmp')) temporaryFds.add(fd);
            return fd;
          }
          export function closeSync(fd) {
            temporaryFds.delete(fd);
            return fs.closeSync(fd);
          }
          export function writeFileSync(path, data, ...args) {
            if (temporaryFds.has(path)) {
              fs.writeFileSync(path, String(data).slice(0, 16), ...args);
              throw new Error('injected temporary write failure');
            }
            return fs.writeFileSync(path, data, ...args);
          }
        `,
      },
      {
        label: 'rename',
        error: /injected rename failure/,
        shim: `
          export function renameSync(from, to) {
            if (String(to).endsWith('PROJECT-STATUS.md')) throw new Error('injected rename failure');
            return fs.renameSync(from, to);
          }
        `,
      },
    ]) {
      const dir = mkdtempSync(join(tmpdir(), `refresh-state-index-${scenario.label}-failure-`));
      try {
        writeSeedState(dir);
        const projectDir = join(dir, '.atomic-skills', 'projects', 'projA');
        const indexPath = join(projectDir, 'PROJECT-STATUS.md');
        const original = readFileSync(indexPath, 'utf8');
        const child = runRefreshWithFsShim(dir, scenario.shim);

        assert.notEqual(child.status, 0, scenario.label);
        assert.match(child.stderr, scenario.error, scenario.label);
        assert.equal(readFileSync(indexPath, 'utf8'), original, scenario.label);
        assert.deepEqual(
          readdirSync(projectDir).filter((name) => name.includes('.refresh-')),
          [],
          scenario.label,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('writes JavaScript replacement tokens as literal Markdown cell content', () => {
    for (const phaseId of ['$&', '$`', "$'"]) {
      const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-replacement-'));
      try {
        writeSeedState(dir);
        replaceInitiativeField(dir, 'phaseId', phaseId);
        const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');

        const first = refreshState(dir, { nowMs: NOW, branch: null });
        const once = readFileSync(indexPath, 'utf8');
        assert.ok(once.includes(`| f1 | ${phaseId} | active | 1/2 | 0/0 |`), phaseId);
        assert.equal(once.match(/^\| unrelated-row \|/gm)?.length, 1, phaseId);
        assert.equal(first.indexesChanged, 1, phaseId);

        const second = refreshState(dir, { nowMs: NOW, branch: null });
        assert.equal(readFileSync(indexPath, 'utf8'), once, phaseId);
        assert.equal(second.indexesChanged, 0, phaseId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('rejects Markdown delimiters in projected cells before mutating the index', () => {
    for (const [field, value] of [
      ['slug', 'f|extra'],
      ['status', 'active|extra'],
      ['phaseId', 'F|EXTRA'],
      ['phaseId', 'F\nINJECTED'],
      ['phaseId', 'F\rINJECTED'],
    ]) {
      const dir = mkdtempSync(join(tmpdir(), 'refresh-state-index-cell-'));
      try {
        writeSeedState(dir);
        replaceInitiativeField(dir, field, value);
        const indexPath = join(dir, '.atomic-skills', 'projects', 'projA', 'PROJECT-STATUS.md');
        const original = readFileSync(indexPath, 'utf8');

        assert.throws(
          () => refreshState(dir, { nowMs: NOW, branch: null }),
          new RegExp(`unsafe Markdown cell ${field}`),
        );
        assert.equal(readFileSync(indexPath, 'utf8'), original);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});
