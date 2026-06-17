/**
 * cross-wt-gate.test.js — deterministic cross-worktree collision gate.
 *
 * The gate is pure over injected merge and runner adapters. These tests never
 * run git, build, lint, or test commands from the host project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crossWtGate, detectProjectCommands } from '../scripts/cross-wt-gate.js';

test('detectProjectCommands maps package.json scripts to npm commands', () => {
  assert.deepEqual(
    detectProjectCommands({
      packageJson: {
        scripts: {
          build: 'vite build',
          typecheck: 'tsc --noEmit',
          test: 'node --test',
          lint: 'eslint .',
        },
      },
    }),
    {
      commands: {
        build: 'npm run build',
        typecheck: 'npm run typecheck',
        test: 'npm test',
        lint: 'npm run lint',
      },
      detected: true,
      sources: ['package.json'],
    },
  );
});

test('detectProjectCommands detects type-check as a typecheck alias', () => {
  assert.deepEqual(
    detectProjectCommands({
      packageJson: {
        scripts: {
          'type-check': 'tsc --noEmit',
        },
      },
    }),
    {
      commands: {
        typecheck: 'npm run type-check',
      },
      detected: true,
      sources: ['package.json'],
    },
  );
});

test('detectProjectCommands maps Makefile test target to make test', () => {
  assert.deepEqual(
    detectProjectCommands({
      makefile: 'build:\n\ttrue\n\ntest:\n\ttrue\n',
    }),
    {
      commands: {
        build: 'make build',
        test: 'make test',
      },
      detected: true,
      sources: ['Makefile'],
    },
  );
});

test('detectProjectCommands maps pyproject pytest section to pytest', () => {
  assert.deepEqual(
    detectProjectCommands({
      pyproject: '[tool.pytest.ini_options]\naddopts = "-q"\n',
    }),
    {
      commands: {
        test: 'pytest',
      },
      detected: true,
      sources: ['pyproject.toml'],
    },
  );
});

test('detectProjectCommands treats empty or null sources as undetected', () => {
  assert.deepEqual(detectProjectCommands(), {
    commands: {},
    detected: false,
    sources: [],
  });

  assert.deepEqual(detectProjectCommands(null), {
    commands: {},
    detected: false,
    sources: [],
  });
});

test('detectProjectCommands ignores inherited script keys', () => {
  Object.prototype.build = 'do not honor inherited build';
  try {
    assert.deepEqual(
      detectProjectCommands({
        packageJson: {
          scripts: {},
        },
      }),
      {
        commands: {},
        detected: false,
        sources: [],
      },
    );
  } finally {
    delete Object.prototype.build;
  }
});

test('crossWtGate no-ops for fewer than two live worktrees without consulting adapters', () => {
  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a'],
      mergeProbe: () => assert.fail('mergeProbe should not be called for a solo worktree'),
      runner: () => assert.fail('runner should not be called for a solo worktree'),
      detectedCommands: { commands: { test: 'npm test' }, detected: true },
    }),
    {
      outcome: 'no-op',
      gate: 'pass',
      reason: 'single-worktree',
    },
  );
});

test('crossWtGate treats textual conflict as the first gate and never runs commands', () => {
  let runnerCalled = false;

  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      mergeProbe: () => ({ conflict: true, conflictingPaths: ['src/a.js'] }),
      runner: () => {
        runnerCalled = true;
        return { exitCode: 0 };
      },
      detectedCommands: { commands: {}, detected: false },
    }),
    {
      outcome: 'conflict',
      gate: 'fail',
      exitCode: 1,
      reason: 'textual-conflict',
      conflictingPaths: ['src/a.js'],
    },
  );
  assert.equal(runnerCalled, false);
});

test('crossWtGate conflict wins even when a project command is detected', () => {
  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      mergeProbe: () => ({ conflict: true }),
      runner: () => assert.fail('runner should not be called after a conflict'),
      detectedCommands: { commands: { test: 'npm test' }, detected: true },
    }),
    {
      outcome: 'conflict',
      gate: 'fail',
      exitCode: 1,
      reason: 'textual-conflict',
      conflictingPaths: [],
    },
  );
});

test('crossWtGate registers no detectable commands as a warning skip, not a pass', () => {
  const result = crossWtGate({
    liveWorktrees: ['plan/a', 'plan/b'],
    mergeProbe: () => ({ conflict: false }),
    runner: () => assert.fail('runner should not be called without commands'),
    detectedCommands: { commands: {}, detected: false },
  });

  assert.deepEqual(result, {
    outcome: 'skip',
    gate: 'warn',
    warn: true,
    reason: 'no-project-command',
  });
  assert.notEqual(result.gate, 'pass');
});

test('crossWtGate passes when all detected commands exit zero in stable order', () => {
  const ranCommands = [];

  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      mergeProbe: () => ({ conflict: false }),
      runner: (command) => {
        ranCommands.push(command);
        return { exitCode: 0 };
      },
      detectedCommands: {
        commands: {
          lint: 'npm run lint',
          test: 'npm test',
          build: 'npm run build',
          typecheck: 'npm run typecheck',
        },
        detected: true,
      },
    }),
    {
      outcome: 'pass',
      gate: 'pass',
      exitCode: 0,
      ranCommands: ['npm run build', 'npm run typecheck', 'npm test', 'npm run lint'],
    },
  );
  assert.deepEqual(ranCommands, ['npm run build', 'npm run typecheck', 'npm test', 'npm run lint']);
});

test('crossWtGate stops on the first failing command and does not run later commands', () => {
  const ranCommands = [];

  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      mergeProbe: () => ({ conflict: false }),
      runner: (command) => {
        ranCommands.push(command);
        if (command === 'npm run typecheck') return { exitCode: 2 };
        return { exitCode: 0 };
      },
      detectedCommands: {
        commands: {
          build: 'npm run build',
          typecheck: 'npm run typecheck',
          test: 'npm test',
        },
        detected: true,
      },
    }),
    {
      outcome: 'fail',
      gate: 'fail',
      exitCode: 2,
      failedCommand: 'npm run typecheck',
      reason: 'project-command-failed',
    },
  );
  assert.deepEqual(ranCommands, ['npm run build', 'npm run typecheck']);
});

test('crossWtGate blocks when mergeProbe throws without escaping', () => {
  assert.doesNotThrow(() => {
    assert.deepEqual(
      crossWtGate({
        liveWorktrees: ['plan/a', 'plan/b'],
        mergeProbe: () => {
          throw new Error('merge failed unexpectedly');
        },
        runner: () => assert.fail('runner should not be called after mergeProbe throws'),
        detectedCommands: { commands: { test: 'npm test' }, detected: true },
      }),
      {
        outcome: 'error',
        gate: 'block',
        reason: 'probe-threw',
      },
    );
  });
});

test('crossWtGate blocks when runner throws without escaping', () => {
  assert.doesNotThrow(() => {
    assert.deepEqual(
      crossWtGate({
        liveWorktrees: ['plan/a', 'plan/b'],
        mergeProbe: () => ({ conflict: false }),
        runner: () => {
          throw new Error('command failed unexpectedly');
        },
        detectedCommands: { commands: { test: 'npm test' }, detected: true },
      }),
      {
        outcome: 'error',
        gate: 'block',
        reason: 'runner-threw',
      },
    );
  });
});

test('crossWtGate blocks when mergeProbe is missing', () => {
  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      runner: () => ({ exitCode: 0 }),
      detectedCommands: { commands: { test: 'npm test' }, detected: true },
    }),
    {
      outcome: 'error',
      gate: 'block',
      reason: 'merge-probe-missing',
    },
  );
});

test('crossWtGate blocks when runner is missing and commands must run', () => {
  assert.deepEqual(
    crossWtGate({
      liveWorktrees: ['plan/a', 'plan/b'],
      mergeProbe: () => ({ conflict: false }),
      detectedCommands: { commands: { test: 'npm test' }, detected: true },
    }),
    {
      outcome: 'error',
      gate: 'block',
      reason: 'runner-missing',
    },
  );
});
