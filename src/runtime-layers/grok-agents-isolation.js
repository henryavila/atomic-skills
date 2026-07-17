import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { SKILL_NAMESPACE } from '../config.js';
import { wantsGrokPluginHost } from './grok-plugin-host.js';
import { readManifest } from '../manifest.js';
import { listKnownInstallBases, normalizeInstallBase } from './grok-refcount.js';

/**
 * Hide non-Grok Atomic Skills trees from Grok's skill scanner.
 *
 * Grok discovers skills from multiple vendor roots (harness compat):
 *   - `.agents/skills/`  (Codex)
 *   - `.cursor/skills/`  (Cursor)
 *   - `.claude/skills/` + `.claude/commands/` (Claude Code)
 *
 * Atomic Skills installs a Grok-native package under
 * `.grok/plugins/atomic-skills/` (plugin delivery). Without isolation,
 * Grok also lists the same skill names from Cursor/Codex/Claude trees
 * (wrong tool names) — slash menu shows both `atomic-skills:project`
 * and `user:project`.
 *
 * Writes (user Grok config, always under $HOME — not project config):
 *   ~/.grok/config.toml
 *   [skills]
 *   ignore = ["~/.agents/skills/atomic-skills", "~/.cursor/skills/atomic-skills", …]
 *
 * Orchestrated outside the journal (same class as host plugin registry):
 * surgical TOML edit + refcount via remaining installs that still list `grok`.
 */

/**
 * All user-scope foreign Atomic Skills roots Grok may scan.
 * Order is stable for deterministic TOML output.
 */
export const GROK_FOREIGN_ATOMIC_SKILLS_IGNORES = Object.freeze([
  `~/.agents/skills/${SKILL_NAMESPACE}`,
  `~/.cursor/skills/${SKILL_NAMESPACE}`,
  `~/.claude/skills/${SKILL_NAMESPACE}`,
  `~/.claude/commands/${SKILL_NAMESPACE}`,
]);

/** Codex path only — kept for callers/tests that pin the original entry. */
export const GROK_AGENTS_ATOMIC_SKILLS_IGNORE = GROK_FOREIGN_ATOMIC_SKILLS_IGNORES[0];

/** Relative to user home. */
export const GROK_USER_CONFIG_REL = '.grok/config.toml';

/**
 * @param {{ home?: string }} [opts]
 * @returns {string}
 */
export function resolveGrokUserConfigPath(opts = {}) {
  const home = opts.home ?? process.env.HOME ?? homedir();
  return join(home, GROK_USER_CONFIG_REL);
}

/**
 * Normalize an ignore path for comparison (trim, expand trailing slash, ~ form).
 * @param {string} p
 * @param {{ home?: string }} [opts]
 * @returns {string}
 */
export function normalizeIgnorePath(p, opts = {}) {
  let s = String(p).trim().replace(/\\/g, '/');
  // Drop trailing slash except root
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  // Treat $HOME/.…/atomic-skills as equivalent to ~/.…/atomic-skills
  const home = (opts.home ?? process.env.HOME ?? homedir()).replace(/\\/g, '/');
  if (home) {
    for (const entry of GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
      const abs = entry.replace(/^~/, home);
      if (s === abs || s.startsWith(`${abs}/`)) {
        return entry;
      }
    }
  }
  return s;
}

/**
 * Pure: ensure `ignore` array in TOML text includes `entry`.
 * @param {string} toml
 * @param {string} entry
 * @returns {{ text: string, changed: boolean, createdSection: boolean }}
 */
export function ensureSkillsIgnoreEntry(toml, entry) {
  const target = normalizeIgnorePath(entry);
  const src = toml || '';

  if (skillsIgnoreContains(src, target)) {
    return { text: src, changed: false, createdSection: false };
  }

  // Case A: [skills] + ignore = [...]
  const ignoreRe = /^(\s*ignore\s*=\s*)\[([^\]]*)\](\s*)$/m;
  if (/^\[skills\]/m.test(src) && ignoreRe.test(src)) {
    const text = src.replace(ignoreRe, (_, prefix, inner, suffix) => {
      const items = parseTomlStringArrayInner(inner);
      if (items.some((i) => normalizeIgnorePath(i) === target)) {
        return `${prefix}[${inner}]${suffix}`;
      }
      const next = [...items, target];
      return `${prefix}${formatTomlStringArray(next)}${suffix}`;
    });
    return { text, changed: text !== src, createdSection: false };
  }

  // Case B: [skills] exists, no ignore line — insert after header
  if (/^\[skills\]/m.test(src)) {
    const text = src.replace(/^(\[skills\][ \t]*\r?\n)/m, `$1ignore = ${formatTomlStringArray([target])}\n`);
    return { text, changed: true, createdSection: false };
  }

  // Case C: no [skills] — append section
  const block = `\n[skills]\nignore = ${formatTomlStringArray([target])}\n`;
  const base = src.endsWith('\n') || src === '' ? src : `${src}\n`;
  return { text: base + block.replace(/^\n/, src === '' ? '' : '\n'), changed: true, createdSection: true };
}

/**
 * Pure: ensure every foreign Atomic Skills ignore entry is present.
 * @param {string} toml
 * @param {readonly string[]} [entries]
 * @returns {{ text: string, changed: boolean }}
 */
export function ensureAllForeignSkillsIgnores(toml, entries = GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
  let text = toml || '';
  let changed = false;
  for (const entry of entries) {
    const r = ensureSkillsIgnoreEntry(text, entry);
    text = r.text;
    if (r.changed) changed = true;
  }
  return { text, changed };
}

/**
 * Pure: remove `entry` from skills.ignore. Does not delete unrelated config.
 * @param {string} toml
 * @param {string} entry
 * @returns {{ text: string, changed: boolean, removedFileWorthEmpty: boolean }}
 */
export function removeSkillsIgnoreEntry(toml, entry) {
  const target = normalizeIgnorePath(entry);
  const src = toml || '';
  if (!src || !skillsIgnoreContains(src, target)) {
    return { text: src, changed: false, removedFileWorthEmpty: false };
  }

  const ignoreRe = /^(\s*ignore\s*=\s*)\[([^\]]*)\](\s*)$/m;
  let text = src.replace(ignoreRe, (full, prefix, inner, suffix) => {
    const items = parseTomlStringArrayInner(inner)
      .filter((i) => normalizeIgnorePath(i) !== target);
    if (items.length === 0) {
      // Drop the whole ignore line
      return '';
    }
    return `${prefix}${formatTomlStringArray(items)}${suffix}`;
  });

  // Collapse blank lines left by removing ignore
  text = text.replace(/\n{3,}/g, '\n\n');

  // If [skills] section is now empty (only header / whitespace until next section), drop it
  text = dropEmptySkillsSection(text);

  const trimmed = text.trim();
  return {
    text: trimmed === '' ? '' : (text.endsWith('\n') ? text : `${text}\n`),
    changed: text !== src,
    removedFileWorthEmpty: trimmed === '',
  };
}

/**
 * Pure: remove every foreign Atomic Skills ignore entry we manage.
 * @param {string} toml
 * @param {readonly string[]} [entries]
 * @returns {{ text: string, changed: boolean, removedFileWorthEmpty: boolean }}
 */
export function removeAllForeignSkillsIgnores(toml, entries = GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
  let text = toml || '';
  let changed = false;
  let removedFileWorthEmpty = false;
  for (const entry of entries) {
    const r = removeSkillsIgnoreEntry(text, entry);
    text = r.text;
    if (r.changed) changed = true;
    removedFileWorthEmpty = r.removedFileWorthEmpty;
  }
  return { text, changed, removedFileWorthEmpty };
}

/**
 * @param {string} toml
 * @param {string} entry
 * @returns {boolean}
 */
export function skillsIgnoreContains(toml, entry) {
  const target = normalizeIgnorePath(entry);
  const m = toml.match(/^\s*ignore\s*=\s*\[([^\]]*)\]/m);
  if (!m) return false;
  return parseTomlStringArrayInner(m[1]).some((i) => normalizeIgnorePath(i) === target);
}

/**
 * @param {string} toml
 * @param {readonly string[]} [entries]
 * @returns {boolean}
 */
export function skillsIgnoreContainsAll(toml, entries = GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
  return entries.every((e) => skillsIgnoreContains(toml, e));
}

/**
 * Apply isolation on install (when grok is selected). Always targets user
 * ~/.grok/config.toml so user-scoped foreign Atomic Skills are hidden from Grok.
 *
 * @param {object} opts
 * @param {string[]} [opts.ides]
 * @param {string} [opts.home]
 * @returns {{ status: 'applied' | 'already' | 'skipped', detail?: string }}
 */
export function applyGrokAgentsIsolation(opts = {}) {
  const { ides, home = process.env.HOME || homedir() } = opts;
  if (ides !== undefined && !wantsGrokPluginHost(ides)) {
    return { status: 'skipped', detail: 'grok not in ides' };
  }

  const configPath = resolveGrokUserConfigPath({ home });
  const before = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const { text, changed } = ensureAllForeignSkillsIgnores(before);
  if (!changed) {
    return { status: 'already', detail: configPath };
  }
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return { status: 'applied', detail: configPath };
}

/**
 * Reverse isolation on uninstall. Only removes the ignore entries when no other
 * install (user or project) still lists `grok` in its manifest ides.
 *
 * @param {object} opts
 * @param {string} opts.basePath - install being uninstalled
 * @param {string[]} [opts.ides] - ides of that install (from manifest)
 * @param {string} [opts.home]
 * @param {() => string[]} [opts.listInstallBases] - inject for tests
 * @returns {{ status: 'removed' | 'kept' | 'absent' | 'skipped', detail?: string }}
 */
export function revertGrokAgentsIsolation(opts) {
  const {
    basePath,
    ides,
    home = process.env.HOME || homedir(),
    listInstallBases = () => listKnownInstallBases(home),
  } = opts;

  if (ides !== undefined && !wantsGrokPluginHost(ides)) {
    return { status: 'skipped', detail: 'grok not in ides' };
  }

  // Keep isolation while any *other* install still wants Grok.
  const self = normalizeInstallBase(basePath);
  const others = listInstallBases().filter((p) => normalizeInstallBase(p) !== self);
  for (const other of others) {
    const m = readManifest(other);
    if (wantsGrokPluginHost(m?.ides)) {
      return { status: 'kept', detail: `still required by ${other}` };
    }
  }

  const configPath = resolveGrokUserConfigPath({ home });
  if (!existsSync(configPath)) {
    return { status: 'absent', detail: configPath };
  }

  const before = readFileSync(configPath, 'utf8');
  const { text, changed, removedFileWorthEmpty } = removeAllForeignSkillsIgnores(before);
  if (!changed) {
    return { status: 'absent', detail: 'ignore entry not present' };
  }

  if (removedFileWorthEmpty) {
    try { unlinkSync(configPath); } catch { /* ignore */ }
    pruneEmptyParentsUpTo(dirname(configPath), join(home, '.grok'));
  } else {
    writeFileSync(configPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  }
  return { status: 'removed', detail: configPath };
}

/**
 * Remove empty dirs from `fromDir` up through `boundary` (inclusive if empty).
 * @param {string} fromDir
 * @param {string} boundary
 */
function pruneEmptyParentsUpTo(fromDir, boundary) {
  let cur = fromDir;
  const stop = dirname(boundary);
  while (cur && cur !== stop) {
    try {
      if (readdirSync(cur).length === 0) {
        rmdirSync(cur);
        if (cur === boundary) break;
        cur = dirname(cur);
      } else break;
    } catch { break; }
  }
}

// ─── internals ─────────────────────────────────────────────────────────────

/**
 * @param {string} inner content between [ and ]
 * @returns {string[]}
 */
function parseTomlStringArrayInner(inner) {
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    out.push((m[1] !== undefined ? m[1] : m[2]).replace(/\\"/g, '"').replace(/\\'/g, "'"));
  }
  return out;
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function formatTomlStringArray(items) {
  return `[${items.map((s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ')}]`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function dropEmptySkillsSection(text) {
  // Match [skills] followed only by whitespace until EOF or next [section]
  return text.replace(
    /^\[skills\][ \t]*\r?\n(?:[ \t]*\r?\n)*(?=^\[|\s*$)/m,
    '',
  );
}
