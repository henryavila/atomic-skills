import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAMESPACE = 'atomic-skills';

/**
 * Explicit tool-name adapters per PUBLIC_IDE_ID (F2/T-001).
 * No host free-rides Claude names. gemini-commands reuses the gemini profile.
 * Unknown hosts fall back to HOST_TOOL_PROFILE_UNKNOWN (non-Claude).
 */
export const HOST_TOOL_PROFILES = {
  'claude-code': {
    BASH_TOOL: 'Bash',
    READ_TOOL: 'Read tool',
    WRITE_TOOL: 'Write tool',
    REPLACE_TOOL: 'Edit tool',
    GREP_TOOL: 'Grep',
    GLOB_TOOL: 'Glob',
    INVESTIGATOR_TOOL: 'Agent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL: 'AskUserQuestion tool',
  },
  cursor: {
    BASH_TOOL: 'Shell',
    READ_TOOL: 'Read',
    WRITE_TOOL: 'Write',
    REPLACE_TOOL: 'StrReplace',
    GREP_TOOL: 'Grep',
    GLOB_TOOL: 'Glob',
    INVESTIGATOR_TOOL: 'Task',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL:
      'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
  },
  gemini: {
    BASH_TOOL: 'run_shell_command',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'write_file',
    REPLACE_TOOL: 'replace',
    GREP_TOOL: 'grep_search',
    GLOB_TOOL: 'glob',
    INVESTIGATOR_TOOL: 'codebase_investigator',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL:
      'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
  },
  codex: {
    BASH_TOOL: 'shell',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'apply_patch',
    REPLACE_TOOL: 'apply_patch',
    GREP_TOOL: 'grep_files',
    GLOB_TOOL: 'list_dir',
    INVESTIGATOR_TOOL: 'spawn_agent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL:
      'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
  },
  opencode: {
    BASH_TOOL: 'bash',
    READ_TOOL: 'read',
    WRITE_TOOL: 'write',
    REPLACE_TOOL: 'edit',
    GREP_TOOL: 'grep',
    GLOB_TOOL: 'glob',
    INVESTIGATOR_TOOL: 'task',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL:
      'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
  },
  'github-copilot': {
    BASH_TOOL: 'run_in_terminal',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'create_file',
    REPLACE_TOOL: 'replace_string_in_file',
    GREP_TOOL: 'grep_search',
    GLOB_TOOL: 'file_search',
    INVESTIGATOR_TOOL: 'agent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL:
      'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
  },
  grok: {
    BASH_TOOL: 'run_terminal_command',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'write',
    REPLACE_TOOL: 'search_replace',
    GREP_TOOL: 'grep',
    GLOB_TOOL: 'list_dir',
    INVESTIGATOR_TOOL: 'spawn_subagent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL: 'ask_user_question',
  },
};

/** Non-Claude fallback when ideId is unknown — never freerides Claude tokens. */
export const HOST_TOOL_PROFILE_UNKNOWN = {
  BASH_TOOL: 'shell',
  READ_TOOL: 'read_file',
  WRITE_TOOL: 'write_file',
  REPLACE_TOOL: 'edit_file',
  GREP_TOOL: 'search',
  GLOB_TOOL: 'find_files',
  INVESTIGATOR_TOOL: 'delegate',
  ARG_VAR: '$ARGUMENTS',
  ASK_USER_QUESTION_TOOL:
    'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)',
};

/**
 * Resolve the tool-name map for an IDE id (including gemini-commands → gemini).
 * @param {string} ideId
 * @returns {Record<string, string>}
 */
export function getHostToolProfile(ideId) {
  if (ideId === 'gemini-commands') return { ...HOST_TOOL_PROFILES.gemini };
  if (HOST_TOOL_PROFILES[ideId]) return { ...HOST_TOOL_PROFILES[ideId] };
  return { ...HOST_TOOL_PROFILE_UNKNOWN };
}

/**
 * Hosts that own a SessionStart auto-update surface (capability matrix F2/T-002).
 * Derived from meta/host-qualification.json when present; safe defaults otherwise.
 */
export const AUTO_UPDATE_HOST_CAPABILITIES = {
  'claude-code': { capability: 'session-start-hook', surface: '.claude/settings.json' },
  grok: {
    capability: 'session-start-hook',
    surface: '.grok/hooks/atomic-skills-auto-update.json',
  },
};

/**
 * Read support tiers from meta/host-qualification.json (lazy, cached).
 * @returns {Record<string, 'operational'|'layout-only'>}
 */
let _supportTierCache = null;
export function getHostSupportTier() {
  if (_supportTierCache) return { ..._supportTierCache };
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = join(here, '..', 'meta', 'host-qualification.json');
  const tiers = {};
  if (existsSync(manifestPath)) {
    try {
      const doc = JSON.parse(readFileSync(manifestPath, 'utf8'));
      for (const host of doc.hosts || []) {
        if (host?.id && host.supportTier) tiers[host.id] = host.supportTier;
      }
    } catch {
      /* fall through to empty — callers treat missing as unknown */
    }
  }
  _supportTierCache = tiers;
  return { ...tiers };
}

/** @internal test helper */
export function _resetHostSupportTierCache() {
  _supportTierCache = null;
}

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
