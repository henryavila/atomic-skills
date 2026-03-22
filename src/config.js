import { posix } from 'node:path';

export const IDE_CONFIG = {
  'claude-code': {
    name: 'Claude Code',
    dir: '.claude/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  },
  'cursor': {
    name: 'Cursor',
    dir: '.cursor/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  },
  'gemini': {
    name: 'Gemini CLI',
    dir: '.gemini/commands',
    format: 'toml',
    filePattern: (skillName) => `${skillName}.toml`,
  },
  'codex': {
    name: 'Codex',
    dir: '.agents/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  },
  'opencode': {
    name: 'OpenCode',
    dir: '.opencode/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    dir: '.github/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  },
};

export function getSkillPath(ideId, skillName) {
  const ide = IDE_CONFIG[ideId];
  return posix.join(ide.dir, ide.filePattern(skillName));
}

export function getSkillFormat(ideId) {
  return IDE_CONFIG[ideId].format;
}
