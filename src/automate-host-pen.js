/**
 * Host pen for implement --automate.
 *
 * Claude Code, Codex, and Grok only. The chat session may write product
 * files only when no pen lock is held. While the lock is held, only listed
 * write tools whose paths sit inside the writer worktree are allowed. Shells
 * and unknown tools are denied (fail-closed). There is no read allowlist.
 */

import { existsSync, lstatSync, realpathSync } from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @typedef {'claude-code' | 'codex' | 'grok'} AutomateHostId */

export const PEN_HOOK_SCRIPT = 'automate-pen.sh';

const TRUSTED_PEN_HOOK_SUFFIXES = [
  `/.atomic-skills/status/hooks/${PEN_HOOK_SCRIPT}`,
  `/_assets/hooks/${PEN_HOOK_SCRIPT}`,
  `/skills/shared/project-assets/hooks/${PEN_HOOK_SCRIPT}`,
];

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
 * @param {string} token
 * @returns {boolean}
 */
function hasTrustedPenHookSuffix(token) {
  const norm = String(token).replace(/\\/g, '/');
  return TRUSTED_PEN_HOOK_SUFFIXES.some((suffix) => norm.endsWith(suffix));
}

/**
 * Realpath each existing prefix so a symlink out of the tree is visible.
 * @param {string} absPath
 * @returns {string}
 */
function realpathExistingPrefix(absPath) {
  const parsed = parsePath(absPath);
  const parts = absPath.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean);
  let current = parsed.root;
  let missing = false;
  for (const part of parts) {
    const next = join(current, part);
    if (!missing) {
      try {
        const st = lstatSync(next);
        if (st.isSymbolicLink()) {
          try {
            current = realpathSync(next);
            continue;
          } catch {
            current = next;
            missing = true;
            continue;
          }
        }
        current = next;
        continue;
      } catch {
        missing = true;
      }
    }
    current = join(current, part);
  }
  try {
    return existsSync(current) ? realpathSync(current) : current;
  } catch {
    return current;
  }
}

/**
 * @param {string} resolved
 * @param {string} root
 * @param {NodeJS.Dict<string>} [env]
 * @returns {boolean}
 */
function isTrustedPenHookScript(resolved, root, env = process.env) {
  if (basename(resolved) !== PEN_HOOK_SCRIPT) return false;
  const target = realpathExistingPrefix(resolve(resolved));
  /** @type {string[]} */
  const dirs = [
    join(PACKAGE_ROOT, '_assets/hooks'),
    join(PACKAGE_ROOT, 'skills/shared/project-assets/hooks'),
  ];
  if (root) {
    dirs.push(join(root, '.atomic-skills/status/hooks'));
    dirs.push(join(root, '.grok/plugins/atomic-skills/_assets/hooks'));
  }
  const grok = env && env.GROK_PLUGIN_ROOT;
  if (grok && String(grok).trim()) {
    dirs.push(join(String(grok).trim(), '_assets/hooks'));
  }
  for (const dir of dirs) {
    const allowed = realpathExistingPrefix(resolve(dir, PEN_HOOK_SCRIPT));
    if (target === allowed) return true;
  }
  return false;
}

/**
 * Return the script token if `command` is `bash <path-to-automate-pen.sh>`.
 * Rejects flags (`bash -c`, `bash -n`), env-assignment prefixes (`NAME=value`,
 * `BASH_ENV=…`, `AUTOMATE_PEN_LOCK=…`), substring spoofs, and compound commands.
 * @param {string | null | undefined} command
 * @returns {string | null}
 */
export function extractPenHookScriptToken(command) {
  if (typeof command !== 'string') return null;
  const trimmed = command.trim();
  if (!trimmed) return null;
  if (commandHasShellMetacharacters(trimmed)) return null;
  const tokens = tokenizeCommand(trimmed);
  if (tokens.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) return null;
  const exe = tokens[0];
  if (exe !== 'bash' && exe !== '/bin/bash' && exe !== '/usr/bin/bash') return null;
  if (tokens.length !== 2) return null;
  const script = tokens[1];
  if (!script) return null;
  if (basename(script.replace(/\\/g, '/')) !== PEN_HOOK_SCRIPT) return null;
  if (!hasTrustedPenHookSuffix(script)) return null;
  return script;
}

/**
 * Expand a hook-script token against `root` / env and return an absolute path.
 * Innermost `${VAR:-default}` is expanded first so nested Grok defaults resolve.
 * `$PWD` / `${PWD}` use GROK_WORKSPACE_ROOT / CLAUDE_PROJECT_DIR / `root`,
 * never a disagreeing inherited `env.PWD`.
 * @param {string | null | undefined} command
 * @param {string} root
 * @param {NodeJS.Dict<string>} [env]
 * @returns {string | null}
 */
export function resolvePenHookScript(command, root, env = process.env) {
  const token = extractPenHookScriptToken(command);
  if (!token || !root) return null;
  const executionCwd = (() => {
    const grok = env && env.GROK_WORKSPACE_ROOT;
    const claude = env && env.CLAUDE_PROJECT_DIR;
    if (grok && String(grok).trim()) return String(grok).trim();
    if (claude && String(claude).trim()) return String(claude).trim();
    return root;
  })();
  const lookup = (name) => {
    if (name === 'PWD') return executionCwd;
    const value = env ? env[name] : undefined;
    return value != null && String(value) !== '' ? String(value) : '';
  };
  let expanded = token;
  for (let n = 0; n < 8; n++) {
    const next = expanded
      .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^{}]*))?\}/g, (_, name, def) => {
        const value = lookup(name);
        return value !== '' ? value : (def || '');
      })
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => lookup(name));
    if (next === expanded) break;
    expanded = next;
  }
  if (/\$\{/.test(expanded)) return null;
  const resolved = resolve(root, expanded);
  if (basename(resolved) !== PEN_HOOK_SCRIPT) return null;
  if (!isTrustedPenHookScript(resolved, root, env)) return null;
  return resolved;
}

/**
 * @param {string | null | undefined} hostRaw
 * @param {unknown} hooksConfig
 * @param {string} [root]
 * @param {NodeJS.Dict<string>} [env]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assessPenRegistration(
  hostRaw,
  hooksConfig,
  root = process.cwd(),
  env = process.env,
) {
  const host = resolveAutomateHost(hostRaw);
  if (!host) {
    return {
      ok: false,
      reason: `host must be claude-code, codex, or grok (got ${hostRaw || 'none'})`,
    };
  }
  const entries = preToolUseEntries(hooksConfig);
  /** @type {Array<{ matcher: string, command: string }>} */
  const penEntries = [];
  for (const entry of entries) {
    if (entry == null || typeof entry !== 'object') continue;
    const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    const command = hooks
      .map((hook) => (hook && typeof hook.command === 'string' ? hook.command : ''))
      .find((cmd) => extractPenHookScriptToken(cmd) != null);
    if (!command || !resolvePenHookScript(command, root, env)) continue;
    penEntries.push({ matcher: String(entry.matcher || ''), command });
  }
  if (penEntries.length === 0) {
    return {
      ok: false,
      reason: `${host} PreToolUse does not call ${PEN_HOOK_SCRIPT}`,
    };
  }
  const required = requiredPenTools(host);
  const matcherParts = (matcher) =>
    String(matcher || '')
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
  const named = penEntries.find((entry) => {
    const parts = matcherParts(entry.matcher);
    return required.every((tool) => parts.includes(tool));
  });
  if (!named) {
    const parts = matcherParts(penEntries[0].matcher);
    const missing = required.filter((tool) => !parts.includes(tool));
    return {
      ok: false,
      reason: `${host} pen matcher missing: ${missing.join(', ')}`,
    };
  }
  return { ok: true };
}

/**
 * @returns {string}
 */
function defaultHostCwd() {
  const grok = process.env.GROK_WORKSPACE_ROOT;
  const claude = process.env.CLAUDE_PROJECT_DIR;
  if (grok && String(grok).trim()) return String(grok).trim();
  if (claude && String(claude).trim()) return String(claude).trim();
  return process.cwd();
}

/**
 * Relative tool paths resolve against host cwd (process.cwd / CLAUDE_PROJECT_DIR /
 * GROK_WORKSPACE_ROOT), never against writerWorktree. Existing prefixes are
 * realpath'd so a symlink out of the worktree is denied.
 * @param {string | null | undefined} filePath
 * @param {string | null | undefined} writerWorktree
 * @param {string | null | undefined} [hostCwd]
 * @returns {boolean}
 */
export function pathInsideWorktree(filePath, writerWorktree, hostCwd = defaultHostCwd()) {
  if (!filePath || !writerWorktree) return false;
  const root = resolve(String(writerWorktree));
  const fsRoot = parsePath(root).root;
  if (!root || root === fsRoot) return false;
  const raw = String(filePath);
  const abs = isAbsolute(raw)
    ? resolve(raw)
    : resolve(String(hostCwd || defaultHostCwd()), raw);
  const realRoot = realpathExistingPrefix(root);
  if (!realRoot || realRoot === parsePath(realRoot).root) return false;
  const realTarget = realpathExistingPrefix(abs);
  const rel = relative(realRoot, realTarget);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith(`..${sep}`)) return false;
  if (parsePath(rel).root) return false;
  return true;
}

const APPLY_PATCH_PATH_KINDS = new Set([
  'add file',
  'delete file',
  'update file',
  'move to',
  'update',
  'rename file',
]);
const APPLY_PATCH_BARE_KINDS = new Set([
  'begin patch',
  'end patch',
  'end of file',
]);

/**
 * File paths named by a Codex apply_patch payload (hunk headers / Update File).
 * Unknown `***` headers fail closed (return []).
 * @param {string | null | undefined} patch
 * @returns {string[]}
 */
export function parseApplyPatchPaths(patch) {
  if (typeof patch !== 'string' || patch.trim() === '') return [];
  /** @type {string[]} */
  const paths = [];
  for (const line of patch.split(/\r?\n/)) {
    if (!line.startsWith('***')) continue;
    const match = line.match(/^\*\*\*\s+(.+?)(?:\s*:\s*(.*?))?\s*$/);
    if (!match) return [];
    const kind = match[1].trim().toLowerCase();
    const rest = (match[2] || '').trim();
    if (APPLY_PATCH_BARE_KINDS.has(kind) && rest === '') continue;
    if (!APPLY_PATCH_PATH_KINDS.has(kind)) return [];
    if (!rest) return [];
    if (kind === 'rename file') {
      const parts = rest
        .split(/\s*(?:->|→| to )\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) return [];
      paths.push(...parts);
      continue;
    }
    paths.push(rest);
  }
  return paths;
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
 *   hostCwd?: string | null,
 * }} input
 * @returns {string[]}
 */
function collectWritePaths(input) {
  const tool = input.toolName != null ? String(input.toolName).trim().toLowerCase() : '';
  const patch = typeof input.patch === 'string' ? input.patch : '';
  if (tool === 'apply_patch') {
    return parseApplyPatchPaths(patch);
  }
  /** @type {string[]} */
  const paths = [];
  if (input.filePath) paths.push(String(input.filePath));
  if (Array.isArray(input.filePaths)) {
    for (const item of input.filePaths) {
      if (item) paths.push(String(item));
    }
  }
  if (patch) paths.push(...parseApplyPatchPaths(patch));
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
 *   hostCwd?: string | null,
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
    const allInside = paths.every((item) =>
      pathInsideWorktree(item, input.writerWorktree, input.hostCwd),
    );
    if (allInside) return { deny: false };
    return { deny: true, reason: `automate pen: blocked ${tool}` };
  }
  return { deny: true, reason: `automate pen: blocked ${tool}` };
}
