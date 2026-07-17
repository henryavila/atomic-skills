import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AUTO_UPDATE_HOST_CAPABILITIES } from '../config.js';

/**
 * Auto-update runtime layer — a pure planner (Provider) that re-expresses
 * installAutoUpdateHook over the kernel, reverting through the journal:
 *
 *   1. stageRuntimeArtifacts — copy version-check.sh to
 *      <basePath>/.atomic-skills/hooks/ with mode 0o755 (only when at least
 *      one selected host has session-start-hook capability).
 *   2. Per-IDE SessionStart registration (additive, surgically reversed):
 *      - Claude Code → jsonMerge into <basePath>/.claude/settings.json
 *      - Grok Build → jsonMerge into <basePath>/.grok/hooks/atomic-skills-auto-update.json
 *        (user/global auto-update only — never project Soft/Strict scripts)
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
 * POSIX-safe single-quote wrap for embedding a path in a shell command field.
 * Prevents injection when install roots contain spaces, `$()`, or `;`.
 * @param {string} value
 * @returns {string}
 */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * SessionStart entry shared by Claude settings and the Grok hook file.
 * Claude accepts matcher:'*'; Grok lifecycle events reject matchers — omit
 * matcher when registering on the Grok surface.
 *
 * `command` is always a shell-quoted absolute path (hosts execute via shell).
 *
 * @param {string} destAbs absolute path to version-check.sh
 * @param {{ withMatcher?: boolean }} [opts]
 */
function sessionStartEntry(destAbs, { withMatcher = true } = {}) {
  const entry = {
    hooks: [{ type: 'command', command: shellQuote(destAbs) }],
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

      const destRel = '.atomic-skills/hooks/version-check.sh';
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
            path: '.claude/settings.json',
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
