import { readFileSync } from 'node:fs';
import { existsNoFollow, readFileNoFollow } from '@henryavila/minimalist-installer';
import { readManifest } from './manifest.js';

// File-based user instructions: https://code.claude.com/docs/en/memory,
// https://developers.openai.com/codex/guides/agents-md,
// https://opencode.ai/docs/rules/, https://antigravity.google/docs/rules-workflows.
// No confirmed file-based global instructions for the remaining agents.
export const GLOBAL_INSTRUCTION_PATHS = Object.freeze({
  'claude-code': '.claude/CLAUDE.md',
  codex: '.codex/AGENTS.md',
  opencode: '.config/opencode/AGENTS.md',
  antigravity: '.gemini/GEMINI.md',
  cursor: null,
  'github-copilot': null,
  grok: null,
});

export const DELEGATE_MARKERS = {
  begin: '<!-- BEGIN atomic-skills:delegate -->',
  end: '<!-- END atomic-skills:delegate -->',
};

export function globalInstructionBody(language, read = readFileSync) {
  return read(new URL(`./global-instructions/${language === 'pt' ? 'pt' : 'en'}.md`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').trimEnd();
}

// Use the engine's no-follow boundary even for observations: no instruction
// reader should follow a symlink that the writer would refuse.
export function globalInstructionState(basePath, path) {
  const bytes = existsNoFollow(basePath, path) ? readFileNoFollow(basePath, path, null) : null;
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
    try { return globalInstructionState(basePath, path) === 'present' ? [path] : []; }
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
        try {
          const state = globalInstructionState(basePath, path);
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
