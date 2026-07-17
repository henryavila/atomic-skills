import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PUBLIC_IDE_IDS, normalizeIDESelection } from './config.js';

export const IDE_DETECT_DIRS = {
  'claude-code': '.claude',
  'cursor': '.cursor',
  'gemini': '.gemini',
  'codex': '.agents',
  'opencode': '.opencode',
  'github-copilot': '.github',
  'grok': '.grok',
};

export function detectLanguage() {
  const langEnv = process.env.LANG || '';
  if (langEnv.startsWith('pt')) return 'pt';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale && locale.startsWith('pt')) return 'pt';
  } catch {}
  return 'en';
}

export function detectIDEs(basePath) {
  const detected = [];
  for (const [ideId, dir] of Object.entries(IDE_DETECT_DIRS)) {
    if (existsSync(join(basePath, dir))) {
      detected.push(ideId);
    }
  }
  return detected;
}

export function detectIDEState(basePath) {
  const detected = detectIDEs(basePath);
  return {
    supported: PUBLIC_IDE_IDS,
    detected,
    effective: normalizeIDESelection(detected),
  };
}

export function countSkills(metaDir) {
  const meta = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
  const coreCount = Object.keys(meta.core || {}).length;
  return `${coreCount} core`;
}
