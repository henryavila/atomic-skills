/**
 * Host pen for implement --automate.
 *
 * Claude Code, Codex, and Grok only. The chat session may write product
 * files only when no pen lock is held. While the lock is held, write tools
 * and shells are denied unless a write path sits inside the writer worktree.
 */

/** @typedef {'claude-code' | 'codex' | 'grok'} AutomateHostId */

export const PEN_HOOK_SCRIPT = 'automate-pen.sh';

/**
 * @type {Record<AutomateHostId, { hookFile: string, writeTools: string[], shellTools: string[] }>}
 */
export const AUTOMATE_HOSTS = {
  'claude-code': {
    hookFile: '.claude/settings.local.json',
    writeTools: ['Write', 'Edit', 'MultiEdit'],
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
  Object.values(AUTOMATE_HOSTS).flatMap((h) => h.writeTools),
);
const SHELL_TOOLS = new Set(
  Object.values(AUTOMATE_HOSTS).flatMap((h) => h.shellTools),
);

/**
 * Matcher that covers every write and shell tool of the three hosts.
 * @returns {string}
 */
export function penMatcher() {
  return [...WRITE_TOOLS, ...SHELL_TOOLS].join('|');
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
    (entry.hooks || []).some((hook) =>
      String(hook.command || '').includes(PEN_HOOK_SCRIPT),
    ),
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
  const root = writerWorktree.replace(/\/+$/, '');
  const target = filePath.replace(/\/+$/, '');
  return target === root || target.startsWith(`${root}/`);
}

/**
 * @param {{
 *   lockHeld: boolean,
 *   toolName?: string | null,
 *   filePath?: string | null,
 *   writerWorktree?: string | null,
 * }} input
 * @returns {{ deny: boolean, reason?: string }}
 */
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

export function decidePen(input) {
  if (!input.lockHeld) return { deny: false };
  const tool = input.toolName != null ? String(input.toolName).trim() : '';
  if (!tool) {
    return { deny: true, reason: 'automate pen: unreadable tool while lock is held' };
  }
  if (SHELL_TOOLS.has(tool)) {
    return { deny: true, reason: `automate pen: blocked shell ${tool}` };
  }
  if (WRITE_TOOLS.has(tool)) {
    if (pathInsideWorktree(input.filePath, input.writerWorktree)) {
      return { deny: false };
    }
    return { deny: true, reason: `automate pen: blocked ${tool}` };
  }
  return { deny: false };
}
