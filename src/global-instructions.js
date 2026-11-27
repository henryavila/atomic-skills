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

export function createGlobalInstructionsProvider() {
  return {
    plan(config, { basePath }) {
      if (config.scope !== 'user') return [];
      const prior = readManifest(basePath)?.effects || [];
      // Existing opt-ins survive unattended updates and IDE selection changes.
      const agents = new Set(config.ides || []);
      for (const agent of Object.keys(GLOBAL_INSTRUCTION_PATHS)) {
        if (prior.some(e => e.type === 'textBlock' && e.id === `global-instructions:${agent}`)) agents.add(agent);
      }
      return [...agents].flatMap(agent => {
        const path = GLOBAL_INSTRUCTION_PATHS[agent];
        const id = `global-instructions:${agent}`;
        const owned = prior.some(e => e.type === 'textBlock' && e.id === id);
        const enabled = config.globalInstructions ?? owned;
        if (!path || (!enabled && !owned) || config.refusedGlobalPaths?.includes(path)) return [];
        let state;
        try {
          const previous = prior.find(e => e.type === 'textBlock' && e.id === id)?.beforeState;
          if (previous) instructionLocation(basePath, previous);
          state = globalInstructionState(basePath, path);
        } catch (err) {
          if (owned) {
            console.log(`  ${msg(config.language).globalInstructionsRefused(path, err.message)}`);
            return [];
          }
          err.globalInstructionPath = path;
          throw err;
        }
        try {
          if (state !== 'absent' && state !== 'present') throw new Error(state);
          if (owned && state === 'absent' && config.globalInstructions === undefined) {
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
      });
    },
  };
}
