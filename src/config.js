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
  'grok': {
    name: 'Grok Build',
    // Plugin package root owns skills/; no nested SKILL_NAMESPACE segment.
    dir: '.grok/plugins/atomic-skills/skills',
    format: 'markdown',
    filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
    supportsUserScope: true,
    delivery: 'plugin',
  },
};

export const PUBLIC_IDE_IDS = Object.keys(IDE_CONFIG).filter((id) => id !== 'gemini-commands');

/**
 * Paths where the atomic-skills namespace USED to live in older versions
 * before IDE_CONFIG was refactored. Each entry is relative to basePath
 * (`~/` for user scope, `./` for project scope); the SKILL_NAMESPACE suffix
 * is appended at scan time. The orphan detector visits these on every
 * install and removes any leftover namespace dir + descendants.
 *
 * Why: the manifest-based orphan removal in installSkills() only tracks
 * files at CURRENT IDE_CONFIG paths. When an IDE's path is migrated
 * (e.g. .claude/skills/ → .claude/commands/), files installed before
 * the migration become invisible to the manifest and never get cleaned.
 *
 * Add an entry whenever IDE_CONFIG[id].dir changes for an existing IDE.
 */
export const LEGACY_NAMESPACE_PATHS = [
  {
    dir: '.claude/skills',
    reason: 'pre-1.x Claude Code skills directory (migrated to .claude/commands/)',
  },
];

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

/**
 * Project-root-relative directory where the shared `_assets/` (lazy-detail
 * instruction files + templates) install for a given IDE.
 *
 * It is a deliberate SIBLING of the command/skill tree — one level ABOVE
 * `ide.dir` (e.g. `.claude/atomic-skills/_assets`, not
 * `.claude/commands/atomic-skills/_assets`). Reason: every IDE recursively scans
 * its command/skill dir (`.claude/commands/`, `.cursor/skills/`, …) and registers
 * EVERY `.md` it finds — so assets parked inside that tree leak into the slash
 * palette as bogus `_assets:*` commands. Hoisting them out of the scanned tree
 * keeps them inert (readable only by explicit path via {{ASSETS_PATH}}).
 *
 * Skills reference this via the {{ASSETS_PATH}} template variable; render.js
 * prefixes `~/` for user scope so it resolves cross-repo.
 */
export function getAssetsDir(ideId) {
  const ide = IDE_CONFIG[ideId];
  // Plugin delivery: assets are a sibling of skills/ inside the plugin package
  // (e.g. .grok/plugins/atomic-skills/_assets). Do not apply the generic
  // "parent of ide.dir + atomic-skills/_assets" formula — that would nest
  // assets outside the plugin package.
  if (ide.delivery === 'plugin') {
    return `${posix.dirname(ide.dir)}/_assets`;
  }
  const parent = posix.dirname(ide.dir);
  return ide.format === 'toml'
    ? `${parent}/${SKILL_NAMESPACE}-_assets`   // toml IDEs use the flat name pattern
    : `${parent}/${SKILL_NAMESPACE}/_assets`;  // markdown/command IDEs use the directory pattern
}

export function getSkillFormat(ideId) {
  return IDE_CONFIG[ideId].format;
}

export function getNamespaceRootPath(ideId) {
  const ide = IDE_CONFIG[ideId];
  if (ide.format !== 'markdown') return null;
  // Plugin package IS the namespace (plugin.json); no nested atomic-skills/SKILL.md.
  if (ide.delivery === 'plugin') return null;
  return posix.join(ide.dir, SKILL_NAMESPACE, 'SKILL.md');
}
