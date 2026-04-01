import { posix } from 'node:path';

export const IDE_CONFIG = {
  'claude-code': {
    name: 'Claude Code',
    dir: '.claude/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'cursor': {
    name: 'Cursor',
    dir: '.cursor/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'gemini': {
    name: 'Gemini CLI (Skills)',
    dir: '.gemini/skills/as',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName.replace(/^as-/, ''), 'SKILL.md'),
    supportsUserScope: true,
  },
  'codex': {
    name: 'Codex',
    dir: '.agents/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'opencode': {
    name: 'OpenCode',
    dir: '.opencode/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    dir: '.github/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
  },
};

export function getSkillPath(ideId, skillName) {
  const ide = IDE_CONFIG[ideId];
  return posix.join(ide.dir, ide.filePattern(skillName));
}

export function getSkillFormat(ideId) {
  return IDE_CONFIG[ideId].format;
}
