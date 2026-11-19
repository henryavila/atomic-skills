import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

export function globalInstructionBody(language) {
  return readFileSync(new URL(`./global-instructions/${language === 'pt' ? 'pt' : 'en'}.md`, import.meta.url), 'utf8').trimEnd();
}

export function installedGlobalInstructionPaths(basePath) {
  return Object.values(GLOBAL_INSTRUCTION_PATHS).filter(path => {
    if (!path || !existsSync(join(basePath, path))) return false;
    const lines = readFileSync(join(basePath, path), 'utf8').split(/\r?\n/);
    return lines.includes(DELEGATE_MARKERS.begin) && lines.includes(DELEGATE_MARKERS.end);
  });
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
        const enabled = config.globalInstructions ?? prior.some(e => e.type === 'textBlock' && e.id === id);
        if (!path || !enabled || config.refusedGlobalPaths?.includes(path)) return [];
        return [{ type: 'textBlock', id, args: {
          basePath, path, id, markers: DELEGATE_MARKERS,
          content: globalInstructionBody(config.language),
        } }];
      });
    },
  };
}
