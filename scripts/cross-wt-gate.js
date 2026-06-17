/**
 * cross-wt-gate.js — pure deterministic floor for cross-worktree collisions.
 *
 * This module never runs git, build, lint, or tests itself. It only decides
 * over already-read project sources plus injected merge and command adapters.
 */

const COMMAND_ORDER = ['build', 'typecheck', 'test', 'lint'];
const MAKE_TARGETS = ['build', 'typecheck', 'test', 'lint'];

function ownObject(value, key) {
  if (value == null || typeof value !== 'object') return null;
  if (!Object.hasOwn(value, key)) return null;
  const candidate = value[key];
  if (candidate == null || typeof candidate !== 'object') return null;
  return candidate;
}

function ownValue(value, key) {
  if (value == null || typeof value !== 'object') return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return value[key];
}

function addSourceOnce(sources, source) {
  if (!sources.includes(source)) sources.push(source);
}

function hasOwnString(value, key) {
  return Object.hasOwn(value, key) && typeof value[key] === 'string';
}

function addCommand(commands, sources, key, command, source) {
  if (Object.hasOwn(commands, key)) return;
  commands[key] = command;
  addSourceOnce(sources, source);
}

function detectPackageJson(commands, detectedSources, packageJson) {
  const scripts = ownObject(packageJson, 'scripts');
  if (!scripts) return;

  if (hasOwnString(scripts, 'build')) {
    addCommand(commands, detectedSources, 'build', 'npm run build', 'package.json');
  }

  for (const key of ['typecheck', 'type-check', 'tsc']) {
    if (!Object.hasOwn(commands, 'typecheck') && hasOwnString(scripts, key)) {
      addCommand(commands, detectedSources, 'typecheck', `npm run ${key}`, 'package.json');
    }
  }

  if (hasOwnString(scripts, 'test')) {
    addCommand(commands, detectedSources, 'test', 'npm test', 'package.json');
  }

  if (hasOwnString(scripts, 'lint')) {
    addCommand(commands, detectedSources, 'lint', 'npm run lint', 'package.json');
  }
}

function detectMakefile(commands, detectedSources, makefile) {
  if (typeof makefile !== 'string') return;

  for (const key of MAKE_TARGETS) {
    if (Object.hasOwn(commands, key)) continue;
    if (new RegExp(`^${key}:`, 'm').test(makefile)) {
      addCommand(commands, detectedSources, key, `make ${key}`, 'Makefile');
    }
  }
}

function detectPyproject(commands, detectedSources, pyproject) {
  if (Object.hasOwn(commands, 'test') || typeof pyproject !== 'string') return;

  // Simple heuristic by contract: recognize pytest configuration sections or
  // pytest named in common dependency text, without parsing TOML.
  if (/\[tool\.pytest(?:[.\]\s]|$)/.test(pyproject) || /pytest/.test(pyproject)) {
    addCommand(commands, detectedSources, 'test', 'pytest', 'pyproject.toml');
  }
}

function commandMapFrom(detectedCommands) {
  if (detectedCommands == null || typeof detectedCommands !== 'object') return {};
  const nested = ownObject(detectedCommands, 'commands');
  if (nested) return nested;
  return detectedCommands;
}

function hasDetectedFlag(detectedCommands) {
  return (
    detectedCommands != null &&
    typeof detectedCommands === 'object' &&
    Object.hasOwn(detectedCommands, 'detected') &&
    detectedCommands.detected === false
  );
}

function orderedCommands(commandMap) {
  return COMMAND_ORDER.filter((key) => hasOwnString(commandMap, key)).map((key) => commandMap[key]);
}

/**
 * Detect generic project build/typecheck/test/lint commands from already-read
 * package.json, Makefile, and pyproject.toml content. Pure: no fs/git/exec.
 *
 * @param {object|null|undefined} sources
 * @returns {{ commands: { build?: string, typecheck?: string, test?: string, lint?: string }, detected: boolean, sources: string[] }}
 */
export function detectProjectCommands(sources = {}) {
  const input = sources == null || typeof sources !== 'object' ? {} : sources;
  const commands = {};
  const detectedSources = [];

  detectPackageJson(commands, detectedSources, ownValue(input, 'packageJson'));
  detectMakefile(commands, detectedSources, ownValue(input, 'makefile'));
  detectPyproject(commands, detectedSources, ownValue(input, 'pyproject'));

  return {
    commands,
    detected: COMMAND_ORDER.some((key) => Object.hasOwn(commands, key)),
    sources: detectedSources,
  };
}

/**
 * Decide the deterministic cross-worktree collision gate over injected merge
 * and command runner adapters. Never throws; indeterminate probes block.
 *
 * @param {object} options
 * @returns {object}
 */
export function crossWtGate({
  liveWorktrees = [],
  mergeProbe,
  runner,
  detectedCommands,
} = {}) {
  const liveWorktreeCount = Array.isArray(liveWorktrees) ? liveWorktrees.length : 0;
  if (liveWorktreeCount < 2) {
    return { outcome: 'no-op', gate: 'pass', reason: 'single-worktree' };
  }

  if (typeof mergeProbe !== 'function') {
    return { outcome: 'error', gate: 'block', reason: 'merge-probe-missing' };
  }

  let mergeResult;
  try {
    mergeResult = mergeProbe();
  } catch {
    return { outcome: 'error', gate: 'block', reason: 'probe-threw' };
  }

  if (mergeResult && mergeResult.conflict === true) {
    return {
      outcome: 'conflict',
      gate: 'fail',
      exitCode: 1,
      reason: 'textual-conflict',
      conflictingPaths: Array.isArray(mergeResult.conflictingPaths) ? mergeResult.conflictingPaths : [],
    };
  }

  const commandMap = commandMapFrom(detectedCommands);
  const commandsToRun = orderedCommands(commandMap);
  if (hasDetectedFlag(detectedCommands) || commandsToRun.length === 0) {
    return { outcome: 'skip', gate: 'warn', warn: true, reason: 'no-project-command' };
  }

  if (typeof runner !== 'function') {
    return { outcome: 'error', gate: 'block', reason: 'runner-missing' };
  }

  const ranCommands = [];
  for (const command of commandsToRun) {
    let result;
    try {
      result = runner(command);
    } catch {
      return { outcome: 'error', gate: 'block', reason: 'runner-threw' };
    }

    ranCommands.push(command);
    if (!result || result.exitCode !== 0) {
      return {
        outcome: 'fail',
        gate: 'fail',
        exitCode: result?.exitCode,
        failedCommand: command,
        reason: 'project-command-failed',
      };
    }
  }

  return { outcome: 'pass', gate: 'pass', exitCode: 0, ranCommands };
}
