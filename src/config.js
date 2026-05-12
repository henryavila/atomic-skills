import { posix } from 'node:path';

export const SKILL_NAMESPACE = 'atomic-skills';

export const IDE_CONFIG = {
  'claude-code': {
    name: 'Claude Code',
    dir: '.claude/commands',
    format: 'command',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, `${skillName}.md`),
    supportsUserScope: true,
  },
  'cursor': {
    name: 'Cursor',
    dir: '.cursor/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'gemini': {
    name: 'Gemini CLI (Skills)',
    dir: '.gemini/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'gemini-commands': {
    name: 'Gemini CLI (Commands)',
    dir: '.gemini/commands',
    format: 'toml',
    filePattern: (skillName) => `${SKILL_NAMESPACE}-${skillName}.toml`,
    supportsUserScope: true,
  },
  'codex': {
    name: 'Codex',
    dir: '.agents/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'opencode': {
    name: 'OpenCode',
    dir: '.opencode/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    dir: '.github/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(SKILL_NAMESPACE, skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
};

export const PUBLIC_IDE_IDS = Object.keys(IDE_CONFIG).filter((id) => id !== 'gemini-commands');

export function normalizeIDESelection(ides) {
  const unique = [];
  for (const id of ides) {
    if (!unique.includes(id)) unique.push(id);
  }

  if (unique.includes('gemini') && unique.includes('codex')) {
    const result = [...unique];
    result[result.indexOf('gemini')] = 'gemini-commands';
    return result;
  }

  return unique;
}

export function getSkillPath(ideId, skillName) {
  const ide = IDE_CONFIG[ideId];
  return posix.join(ide.dir, ide.filePattern(skillName));
}

export function getSkillFormat(ideId) {
  return IDE_CONFIG[ideId].format;
}

export function getNamespaceRootPath(ideId) {
  const ide = IDE_CONFIG[ideId];
  if (ide.format !== 'markdown') return null;
  return posix.join(ide.dir, SKILL_NAMESPACE, 'SKILL.md');
}
