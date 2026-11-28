import { readFileSync } from 'node:fs';
import { existsNoFollow, readFileNoFollow } from '@henryavila/minimalist-installer';
import { resolveInstructionPath, instructionLocation } from './ide-symlink-install.js';
import { GLOBAL_INSTRUCTION_PATHS } from './global-instruction-paths.js';
import { msg } from './ui.js';
import { readManifest } from './manifest.js';

// Re-exported for install.js and status.js, whose import sites predate the table
// moving to its own module.
export { GLOBAL_INSTRUCTION_PATHS };

export const DELEGATE_MARKERS = {
  begin: '<!-- BEGIN atomic-skills:delegate -->',
  end: '<!-- END atomic-skills:delegate -->',
};

export function globalInstructionBody(language, read = readFileSync) {
  return read(new URL(`./global-instructions/${language === 'pt' ? 'pt' : 'en'}.md`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').trimEnd();
}

// Resolve opted-in instruction links exactly as the registry wrapper does,
// then observe the destination through the engine's no-follow boundary.
export function globalInstructionState(basePath, path) {
  const loc = resolveInstructionPath(basePath, path);
  const bytes = existsNoFollow(loc.basePath, loc.path) ? readFileNoFollow(loc.basePath, loc.path, null) : null;
  const lines = bytes?.toString('utf8').split(/\r?\n/) ?? [];
  const begins = lines.flatMap((line, i) => line === DELEGATE_MARKERS.begin ? [i] : []);
  const ends = lines.flatMap((line, i) => line === DELEGATE_MARKERS.end ? [i] : []);
  if (!begins.length && !ends.length) return 'absent';
  if (begins.length === 1 && ends.length === 1 && begins[0] < ends[0]) return 'present';
  return !begins.length ? 'missing BEGIN marker' : !ends.length ? 'missing END marker' : 'duplicate or reversed markers';
}

export function installedGlobalInstructionPaths(basePath) {
  const prior = readManifest(basePath)?.effects ?? [];
  return Object.entries(GLOBAL_INSTRUCTION_PATHS).flatMap(([agent, path]) => {
    if (!path || !prior.some(e => e.type === 'textBlock' && e.id === `global-instructions:${agent}`
      && e.beforeState?.path === path)) return [];
    try {
      instructionLocation(basePath, prior.find(e => e.type === 'textBlock' && e.beforeState?.path === path).beforeState);
      return globalInstructionState(basePath, path) === 'present' ? [path] : [];
    }
    catch { return []; }
  });
}

// A Symbol is the prompt library's cancellation value. Omitted answers use the
// same ownership-based default displayed by the prompt.
export function globalInstructionsDecision(installedPaths, answer) {
  if (typeof answer === 'symbol') return { cancelled: true };
  return { cancelled: false, enabled: answer ?? installedPaths.length > 0 };
}

/**
 * @param {object} effect
 * @param {string} id
 * @returns {boolean}
 */
function isOwnedInstructionEffect(effect, id) {
  return effect?.type === 'textBlock' && effect.id === id;
}

/**
 * Selected IDEs plus every agent whose block the journal still owns, so an
 * existing opt-in survives unattended updates and IDE selection changes.
 *
 * @param {object} config
 * @param {object[]} prior
 * @returns {Set<string>}
 */
function collectInstructionAgents(config, prior) {
  const agents = new Set(config.ides || []);
  for (const agent of Object.keys(GLOBAL_INSTRUCTION_PATHS)) {
    if (prior.some((effect) => isOwnedInstructionEffect(effect, `global-instructions:${agent}`))) {
      agents.add(agent);
    }
  }
  return agents;
}

/**
 * Inspect the live destination through the no-follow boundary. A refusal on an
 * owned agent is logged and parked; on a foreign one it aborts the plan.
 *
 * @param {object} fields
 * @param {string} fields.basePath
 * @param {string} fields.path
 * @param {object[]} fields.prior
 * @param {string} fields.id
 * @param {boolean} fields.owned
 * @param {object} fields.config
 * @returns {{ state: string } | { refused: true }}
 */
function readInstructionState(fields) {
  const { basePath, path, prior, id, owned, config } = fields;
  try {
    const previous = prior.find((effect) => isOwnedInstructionEffect(effect, id))?.beforeState;
    if (previous) instructionLocation(basePath, previous);
    return { state: globalInstructionState(basePath, path) };
  } catch (err) {
    if (owned) {
      console.log(`  ${msg(config.language).globalInstructionsRefused(path, err.message)}`);
      return { refused: true };
    }
    err.globalInstructionPath = path;
    throw err;
  }
}

/**
 * @param {string} state
 * @param {string} path
 */
function assertUsableInstructionState(state, path) {
  if (state !== 'absent' && state !== 'present') {
    /** @type {Error & { globalInstructionPath?: string }} */
    const err = new Error(state);
    err.globalInstructionPath = path;
    throw err;
  }
}

/**
 * Plan one agent's text block, or return [] when it must be left alone.
 *
 * @param {object} fields
 * @param {string} fields.agent
 * @param {object} fields.config
 * @param {string} fields.basePath
 * @param {object[]} fields.prior
 * @returns {object[]}
 */
function planAgentInstruction(fields) {
  const { agent, config, basePath, prior } = fields;
  const path = GLOBAL_INSTRUCTION_PATHS[agent];
  const id = `global-instructions:${agent}`;
  const owned = prior.some((effect) => isOwnedInstructionEffect(effect, id));
  const enabled = config.globalInstructions ?? owned;
  if (!path || (!enabled && !owned) || config.refusedGlobalPaths?.includes(path)) return [];

  const read = readInstructionState({ basePath, path, prior, id, owned, config });
  if ('refused' in read) return [];

  try {
    assertUsableInstructionState(read.state, path);
    if (owned && read.state === 'absent' && config.globalInstructions === undefined) {
      config.optedOutGlobalPaths?.add(path);
      return [];
    }
  } catch (err) {
    err.globalInstructionPath = path;
    throw err;
  }

  if (!enabled) return [];
  return [{ type: 'textBlock', id, args: {
    basePath, path, id, markers: DELEGATE_MARKERS,
    content: globalInstructionBody(config.language),
  } }];
}

export function createGlobalInstructionsProvider() {
  return {
    plan(config, { basePath }) {
      if (config.scope !== 'user') return [];
      const prior = readManifest(basePath)?.effects || [];
      return [...collectInstructionAgents(config, prior)]
        .flatMap((agent) => planAgentInstruction({ agent, config, basePath, prior }));
    },
  };
}
