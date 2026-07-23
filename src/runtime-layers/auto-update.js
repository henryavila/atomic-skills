import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUTO_UPDATE_HOST_CAPABILITIES } from '../config.js';

/**
 * Auto-update runtime layer — a pure planner (Provider) that re-expresses
 * installAutoUpdateHook over the kernel, reverting through the journal:
 *
 *   1. stageRuntimeArtifacts — copy version-check.sh to
 *      <basePath>/.atomic-skills/hooks/ with mode 0o755 (only when at least
 *      one selected host has session-start-hook capability).
 *   2. Per-IDE SessionStart registration (additive jsonMerge + pre-install
 *      ownership reconcile):
 *      - Claude Code → jsonMerge into <basePath>/.claude/settings.json
 *      - Grok Build → jsonMerge into <basePath>/.grok/hooks/atomic-skills-auto-update.json
 *        (user/global auto-update only — never project Soft/Strict scripts)
 *
 * **Reconcile contract (install, not append-only):**
 * jsonMerge arrays only append. When the desired SessionStart *form* changes
 * (shell-quoted → raw path, old basePath → new, duplicates), prior Atomic
 * Skills–owned entries survive next to the new one (Grok: first fails, second
 * succeeds). Before Driver.install, `reconcileAutoUpdateSessionStartSurfaces`
 * removes every AS-owned version-check hook that is not the exact desired
 * command (or all of them when the host is not in the plan). Third-party
 * hooks are preserved. Drop-revert still covers whole-effect IDE shrink.
 *
 * Host selection is capability-driven (AUTO_UPDATE_HOST_CAPABILITIES +
 * config.ides). Codex-only / layout-only hosts produce zero Claude or Grok
 * mutations. When ides is omitted (legacy unit callers), Claude-only
 * registration is preserved.
 *
 * Sources come from config.skillsDir (the skills/ source tree).
 */

/** Dedicated Grok hook file — owns only Atomic Skills auto-update SessionStart. */
export const GROK_AUTO_UPDATE_HOOK_REL = '.grok/hooks/atomic-skills-auto-update.json';

/** Claude Code settings relative path (SessionStart auto-update surface). */
export const CLAUDE_SETTINGS_REL = '.claude/settings.json';

/** Staged auto-update hook relative path under the install base. */
export const VERSION_CHECK_REL = '.atomic-skills/hooks/version-check.sh';

/** Path fragment that proves a SessionStart command is Atomic Skills auto-update. */
const VERSION_CHECK_OWNERSHIP_RE =
  /(?:^|[/\\])\.atomic-skills[/\\]hooks[/\\]version-check\.sh$/;

/**
 * Strip a single layer of matching shell quotes if present.
 * @param {unknown} command
 * @returns {string|null}
 */
export function unwrapOptionalShellQuotes(command) {
  if (typeof command !== 'string') return null;
  if (
    (command.startsWith("'") && command.endsWith("'") && command.length >= 2)
    || (command.startsWith('"') && command.endsWith('"') && command.length >= 2)
  ) {
    return command.slice(1, -1);
  }
  return command;
}

/**
 * Ownership proof: this SessionStart `command` is Atomic Skills auto-update
 * (points at `.atomic-skills/hooks/version-check.sh`), quoted or not.
 *
 * @param {unknown} command
 * @returns {boolean}
 */
export function isAtomicSkillsVersionCheckCommand(command) {
  const raw = unwrapOptionalShellQuotes(command);
  if (raw == null || raw === '') return false;
  return VERSION_CHECK_OWNERSHIP_RE.test(raw);
}

/**
 * @deprecated use isAtomicSkillsVersionCheckCommand — kept for call-site clarity
 * in tests that assert the shell-quoted Grok bug signature specifically.
 * @param {unknown} command
 * @returns {boolean}
 */
export function isShellQuotedVersionCheckCommand(command) {
  if (typeof command !== 'string') return false;
  if (!/^['"]/.test(command) || !/['"]$/.test(command)) return false;
  return isAtomicSkillsVersionCheckCommand(command);
}

/**
 * Reconcile a SessionStart array against the desired version-check command.
 *
 * - Removes every Atomic Skills version-check hook whose `command` is not
 *   exactly `desiredCommand` (null desired → remove all AS version-check).
 * - Keeps third-party hooks and non-AS entries.
 * - Dedupes exact desired hooks (at most one).
 * - Does **not** insert `desiredCommand` when missing — jsonMerge does that so
 *   the journal owns the insert for uninstall.
 *
 * @param {unknown} sessionStart
 * @param {string|null} desiredCommand raw absolute path, or null to drop all AS
 * @returns {{ starts: unknown[], removed: number }}
 */
export function reconcileSessionStartVersionCheck(sessionStart, desiredCommand) {
  if (!Array.isArray(sessionStart)) return { starts: sessionStart, removed: 0 };

  let removed = 0;
  let keptDesired = false;
  const starts = [];

  for (const entry of sessionStart) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      starts.push(entry);
      continue;
    }
    const hooks = entry.hooks;
    if (!Array.isArray(hooks)) {
      starts.push(entry);
      continue;
    }

    const kept = [];
    for (const h of hooks) {
      if (!h || typeof h !== 'object' || Array.isArray(h)) {
        kept.push(h);
        continue;
      }
      if (!isAtomicSkillsVersionCheckCommand(h.command)) {
        kept.push(h);
        continue;
      }
      // AS-owned version-check: keep only exact desired form, once.
      if (
        desiredCommand != null
        && h.command === desiredCommand
        && !keptDesired
      ) {
        kept.push(h);
        keptDesired = true;
        continue;
      }
      removed += 1;
    }

    if (kept.length === 0) continue;
    if (kept.length === hooks.length && kept.every((h, i) => h === hooks[i])) {
      starts.push(entry);
    } else {
      starts.push({ ...entry, hooks: kept });
    }
  }

  return { starts, removed };
}

/**
 * Disk reconcile for Claude + Grok auto-update SessionStart surfaces.
 * Call before Driver.install so jsonMerge only needs to append the desired
 * entry when absent — never accumulates stale AS-owned forms.
 *
 * @param {string} basePath install root
 * @param {{ claudeCommand?: string|null, grokCommand?: string|null }} [opts]
 *   exact desired command per surface (null/omit → remove all AS version-check)
 * @returns {{ claudeRemoved: number, grokRemoved: number }}
 */
export function reconcileAutoUpdateSessionStartSurfaces(basePath, opts = {}) {
  const claudeCommand = opts.claudeCommand === undefined ? null : opts.claudeCommand;
  const grokCommand = opts.grokCommand === undefined ? null : opts.grokCommand;

  let claudeRemoved = 0;
  let grokRemoved = 0;

  for (const [rel, desired, key] of [
    [CLAUDE_SETTINGS_REL, claudeCommand, 'claude'],
    [GROK_AUTO_UPDATE_HOOK_REL, grokCommand, 'grok'],
  ]) {
    const abs = join(basePath, rel);
    if (!existsSync(abs)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      continue;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    const starts = data.hooks?.SessionStart;
    const { starts: next, removed } = reconcileSessionStartVersionCheck(starts, desired);
    if (removed === 0) continue;
    if (key === 'claude') claudeRemoved = removed;
    else grokRemoved = removed;
    const hooks = { ...(data.hooks || {}), SessionStart: next };
    writeFileSync(abs, `${JSON.stringify({ ...data, hooks }, null, 2)}\n`, 'utf8');
  }

  return { claudeRemoved, grokRemoved };
}

/**
 * Resolve desired version-check commands for the next install plan.
 * Mirrors createAutoUpdateRuntimeProvider.plan host + source gates.
 *
 * @param {string} basePath
 * @param {object} config
 * @param {string} config.skillsDir
 * @param {string[]} [config.ides]
 * @returns {{ claudeCommand: string|null, grokCommand: string|null, destAbs: string }}
 */
export function resolveDesiredAutoUpdateCommands(basePath, config = {}) {
  const destAbs = join(basePath, VERSION_CHECK_REL);
  const sourceScript = join(
    config.skillsDir || '',
    'shared',
    'auto-update-hook',
    'version-check.sh',
  );
  if (!config.skillsDir || !existsSync(sourceScript)) {
    return { claudeCommand: null, grokCommand: null, destAbs };
  }
  const { registerClaude, registerGrok } = resolveAutoUpdateHosts(config);
  return {
    claudeCommand: registerClaude ? destAbs : null,
    grokCommand: registerGrok ? destAbs : null,
    destAbs,
  };
}

/**
 * Scope-aware install command recommended by version-check.sh.
 * @param {'user'|'project'|string} scope
 * @returns {string}
 */
export function buildUpdateCommand(scope) {
  const base = 'npx -y @henryavila/atomic-skills@latest install --yes';
  return scope === 'project' ? `${base} --project` : base;
}

/**
 * @param {object} config
 * @param {string[]} [config.ides]
 * @returns {{ registerClaude: boolean, registerGrok: boolean }}
 */
export function resolveAutoUpdateHosts(config = {}) {
  // Absent ides → legacy Claude-only (unit tests + pre-ides callers).
  if (!Array.isArray(config.ides)) {
    return { registerClaude: true, registerGrok: false };
  }
  const hasClaude =
    config.ides.includes('claude-code')
    && AUTO_UPDATE_HOST_CAPABILITIES['claude-code']?.capability === 'session-start-hook';
  const hasGrok =
    config.ides.includes('grok')
    && AUTO_UPDATE_HOST_CAPABILITIES.grok?.capability === 'session-start-hook';
  return {
    registerClaude: hasClaude,
    registerGrok: hasGrok,
  };
}

/**
 * SessionStart entry shared by Claude settings and the Grok hook file.
 * Claude accepts matcher:'*'; Grok lifecycle events reject matchers — omit
 * matcher when registering on the Grok surface.
 *
 * `command` MUST be a raw absolute path (no shell quotes). Grok resolves
 * non-absolute `command` strings relative to the hook JSON directory and does
 * not strip shell quotes — quoting yields ENOENT like:
 *   ~/.grok/hooks/'/abs/.../version-check.sh'
 *
 * @param {string} destAbs absolute path to version-check.sh
 * @param {{ withMatcher?: boolean }} [opts]
 */
function sessionStartEntry(destAbs, { withMatcher = true } = {}) {
  const entry = {
    hooks: [{ type: 'command', command: destAbs }],
  };
  if (withMatcher) entry.matcher = '*';
  return entry;
}

export function createAutoUpdateRuntimeProvider() {
  return {
    plan(config, { basePath }) {
      const { skillsDir } = config;
      const sourceScript = join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh');
      if (!existsSync(sourceScript)) return [];

      const { registerClaude, registerGrok } = resolveAutoUpdateHosts(config);
      // Zero capable hosts → plan nothing (Codex-only must not leave residue
      // under .atomic-skills/hooks or mutate other hosts' settings).
      if (!registerClaude && !registerGrok) return [];

      const destRel = VERSION_CHECK_REL;
      const destAbs = join(basePath, destRel);

      const effects = [
        {
          type: 'stageRuntimeArtifacts',
          args: { basePath, items: [{ path: destRel, source: sourceScript, mode: 0o755 }] },
        },
      ];

      if (registerClaude) {
        effects.push({
          type: 'jsonMerge',
          args: {
            basePath,
            path: CLAUDE_SETTINGS_REL,
            delta: {
              hooks: {
                SessionStart: [sessionStartEntry(destAbs, { withMatcher: true })],
              },
            },
          },
        });
      }

      if (registerGrok) {
        // Grok discovers ~/.grok/hooks/*.json (and project .grok/hooks/). This
        // file is auto-update ONLY — must not register Soft/Strict project scripts.
        // SessionStart is a lifecycle event: no matcher field.
        effects.push({
          type: 'jsonMerge',
          args: {
            basePath,
            path: GROK_AUTO_UPDATE_HOOK_REL,
            delta: {
              hooks: {
                SessionStart: [sessionStartEntry(destAbs, { withMatcher: false })],
              },
            },
          },
        });
      }

      return effects;
    },
  };
}
