/**
 * Host pen for implement --automate.
 *
 * Claude Code, Codex, and Grok only. The chat session may write product
 * files only when no pen lock is held. While the lock is held, only listed
 * write tools whose paths sit inside the writer worktree are allowed. Shells
 * and unknown tools are denied (fail-closed). There is no read allowlist.
 */

import { basename, parse as parsePath, relative, resolve, sep } from 'node:path';

/** @typedef {'claude-code' | 'codex' | 'grok'} AutomateHostId */

export const PEN_HOOK_SCRIPT = 'automate-pen.sh';

/**
 * @type {Record<AutomateHostId, { hookFile: string, writeTools: string[], shellTools: string[] }>}
 */
export const AUTOMATE_HOSTS = {
  'claude-code': {
    hookFile: '.claude/settings.local.json',
    writeTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'],
    shellTools: ['Bash'],
  },
  codex: {
    hookFile: '.codex/hooks.json',
    writeTools: ['apply_patch'],
    shellTools: ['shell'],
  },
  grok: {
    hookFile: '.grok/plugins/atomic-skills/hooks/hooks.json',
    writeTools: ['write', 'search_replace'],
    shellTools: ['run_terminal_command'],
  },
};

const HOST_ALIASES = {
  claude: 'claude-code',
  'claude-code': 'claude-code',
  codex: 'codex',
  grok: 'grok',
};

const WRITE_TOOLS = new Set(
  Object.values(AUTOMATE_HOSTS).flatMap((h) => h.writeTools.map((tool) => tool.toLowerCase())),
);
const SHELL_TOOLS = new Set(
  Object.values(AUTOMATE_HOSTS).flatMap((h) => h.shellTools.map((tool) => tool.toLowerCase())),
);

/**
 * Matcher that covers every write and shell tool of the three hosts.
 * @returns {string}
 */
export function penMatcher() {
  const write = Object.values(AUTOMATE_HOSTS).flatMap((h) => h.writeTools);
  const shell = Object.values(AUTOMATE_HOSTS).flatMap((h) => h.shellTools);
  return [...write, ...shell].join('|');
}

/**
 * @param {string | null | undefined} raw
 * @returns {AutomateHostId | null}
 */
export function resolveAutomateHost(raw) {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase();
  return HOST_ALIASES[key] || null;
}

/**
 * @param {AutomateHostId} host
 * @returns {string[]}
 */
export function requiredPenTools(host) {
  const spec = AUTOMATE_HOSTS[host];
  return [...spec.writeTools, ...spec.shellTools];
}

/**
 * @param {unknown} hooksConfig
 * @returns {Array<{ matcher?: string, hooks?: Array<{ command?: string }> }>}
 */
function preToolUseEntries(hooksConfig) {
  if (hooksConfig == null || typeof hooksConfig !== 'object') return [];
  const hooks = /** @type {{ hooks?: { PreToolUse?: unknown } }} */ (hooksConfig).hooks;
  const entries = hooks && hooks.PreToolUse;
  return Array.isArray(entries) ? entries : [];
}

/**
 * @param {string} command
 * @returns {string[]}
 */
function tokenizeCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandHasShellMetacharacters(command) {
  let stripped = command;
  for (let n = 0; n < 8; n++) {
    const next = stripped.replace(/\$\{[^{}]*\}/g, 'VAR');
    if (next === stripped) break;
    stripped = next;
  }
  if (/;|&&|\|\||`|\$\(/.test(stripped)) return true;
  if (/\bbash\b[^\n]*\s-[^\s]*c/.test(stripped)) return true;
  return false;
}

/**
 * Return the script token if `command` is `bash <path-to-automate-pen.sh>`.
 * Rejects `bash -c`, substring spoofs, and compound commands.
 * @param {string | null | undefined} command
 * @returns {string | null}
 */
export function extractPenHookScriptToken(command) {
  if (typeof command !== 'string') return null;
  const trimmed = command.trim();
  if (!trimmed) return null;
  if (commandHasShellMetacharacters(trimmed)) return null;
  const tokens = tokenizeCommand(trimmed);
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i += 1;
  const exe = tokens[i];
  if (exe !== 'bash' && exe !== '/bin/bash' && exe !== '/usr/bin/bash') return null;
  i += 1;
  while (i < tokens.length && tokens[i].startsWith('-') && tokens[i] !== '-') {
    const flags = tokens[i].replace(/^-+/, '');
    if (flags.includes('c')) return null;
    i += 1;
  }
  if (i !== tokens.length - 1) return null;
  const script = tokens[i];
  if (!script) return null;
  if (basename(script.replace(/\\/g, '/')) !== PEN_HOOK_SCRIPT) return null;
  return script;
}

/**
 * Expand a hook-script token against `root` / env and return an absolute path.
 * @param {string | null | undefined} command
 * @param {string} root
 * @param {NodeJS.Dict<string>} [env]
 * @returns {string | null}
 */
export function resolvePenHookScript(command, root, env = process.env) {
  const token = extractPenHookScriptToken(command);
  if (!token || !root) return null;
  const lookup = (name) => {
    if (name === 'PWD') return root;
    const value = env[name];
    return value != null && String(value) !== '' ? String(value) : '';
  };
  let expanded = token;
  for (let n = 0; n < 8; n++) {
    const next = expanded
      .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, def) => {
        const value = lookup(name);
        return value !== '' ? value : (def || '');
      })
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => lookup(name));
    if (next === expanded) break;
    expanded = next;
  }
  const resolved = resolve(root, expanded);
  if (basename(resolved) !== PEN_HOOK_SCRIPT) return null;
  return resolved;
}

/**
 * @param {string | null | undefined} hostRaw
 * @param {unknown} hooksConfig
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assessPenRegistration(hostRaw, hooksConfig) {
  const host = resolveAutomateHost(hostRaw);
  if (!host) {
    return {
      ok: false,
      reason: `host must be claude-code, codex, or grok (got ${hostRaw || 'none'})`,
    };
  }
  const entries = preToolUseEntries(hooksConfig);
  const pen = entries.find((entry) =>
    (entry.hooks || []).some((hook) => extractPenHookScriptToken(hook.command) != null),
  );
  if (!pen) {
    return {
      ok: false,
      reason: `${host} PreToolUse does not call ${PEN_HOOK_SCRIPT}`,
    };
  }
  const parts = String(pen.matcher || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const missing = requiredPenTools(host).filter((tool) => !parts.includes(tool));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `${host} pen matcher missing: ${missing.join(', ')}`,
    };
  }
  return { ok: true };
}

/**
 * @param {string | null | undefined} filePath
 * @param {string | null | undefined} writerWorktree
 * @returns {boolean}
 */
export function pathInsideWorktree(filePath, writerWorktree) {
  if (!filePath || !writerWorktree) return false;
  const root = resolve(String(writerWorktree));
  const fsRoot = parsePath(root).root;
  if (!root || root === fsRoot) return false;
  const target = resolve(root, String(filePath));
  const rel = relative(root, target);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith(`..${sep}`)) return false;
  if (parsePath(rel).root) return false;
  return true;
}

/**
 * File paths named by a Codex apply_patch payload (hunk headers / Update File).
 * @param {string | null | undefined} patch
 * @returns {string[]}
 */
export function parseApplyPatchPaths(patch) {
  if (typeof patch !== 'string' || patch.trim() === '') return [];
  const re = /^\*\*\* (?:Add File|Delete File|Update File|Move to):\s*(.+?)\s*$/gm;
  return [...patch.matchAll(re)].map((match) => match[1].trim()).filter(Boolean);
}

/**
 * A host write counts only when that host invoked the pen and the write
 * left no file. Running the hook script by hand does not set invokedHook.
 * @param {{ invokedHook?: boolean, refused?: boolean, sentinelCreated?: boolean } | null | undefined} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assessHostWrite(input) {
  if (input && input.sentinelCreated) {
    return { ok: false, reason: 'host write created a file' };
  }
  if (!input || input.invokedHook !== true || input.refused !== true) {
    return {
      ok: false,
      reason: 'host write probe did not prove the host refused the write',
    };
  }
  return { ok: true };
}

/**
 * @param {{
 *   lockHeld: boolean,
 *   toolName?: string | null,
 *   filePath?: string | null,
 *   filePaths?: string[] | null,
 *   patch?: string | null,
 *   writerWorktree?: string | null,
 * }} input
 * @returns {string[]}
 */
function collectWritePaths(input) {
  /** @type {string[]} */
  const paths = [];
  if (input.filePath) paths.push(String(input.filePath));
  if (Array.isArray(input.filePaths)) {
    for (const item of input.filePaths) {
      if (item) paths.push(String(item));
    }
  }
  if (input.patch) paths.push(...parseApplyPatchPaths(input.patch));
  return paths.filter((item) => String(item).trim() !== '');
}

/**
 * @param {{
 *   lockHeld: boolean,
 *   toolName?: string | null,
 *   filePath?: string | null,
 *   filePaths?: string[] | null,
 *   patch?: string | null,
 *   writerWorktree?: string | null,
 * }} input
 * @returns {{ deny: boolean, reason?: string }}
 */
export function decidePen(input) {
  if (!input.lockHeld) return { deny: false };
  const tool = input.toolName != null ? String(input.toolName).trim() : '';
  if (!tool) {
    return { deny: true, reason: 'automate pen: unreadable tool while lock is held' };
  }
  const key = tool.toLowerCase();
  if (SHELL_TOOLS.has(key)) {
    return { deny: true, reason: `automate pen: blocked shell ${tool}` };
  }
  if (WRITE_TOOLS.has(key)) {
    const paths = collectWritePaths(input);
    if (paths.length === 0) {
      return { deny: true, reason: `automate pen: blocked ${tool}` };
    }
    const allInside = paths.every((item) => pathInsideWorktree(item, input.writerWorktree));
    if (allInside) return { deny: false };
    return { deny: true, reason: `automate pen: blocked ${tool}` };
  }
  return { deny: true, reason: `automate pen: blocked ${tool}` };
}
