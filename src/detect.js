import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from './yaml.js';

const IDE_DETECT_DIRS = {
  'claude-code': '.claude',
  'cursor': '.cursor',
  'gemini': '.gemini',
  'codex': '.agents',
  'opencode': '.opencode',
  'github-copilot': '.github',
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

export function countSkills(metaDir, modules) {
  const meta = parseYaml(readFileSync(join(metaDir, 'skills.yaml'), 'utf8'));
  const coreCount = Object.keys(meta.core || {}).length;
  let moduleCount = 0;
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (modConfig.installed && meta.modules?.[modName]) {
      moduleCount += Object.keys(meta.modules[modName]).length;
    }
  }
  return moduleCount > 0 ? `${coreCount} core + ${moduleCount} module` : `${coreCount} core`;
}
