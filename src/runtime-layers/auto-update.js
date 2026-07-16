import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Auto-update runtime layer — a pure planner (Provider) that re-expresses
 * installAutoUpdateHook (src/install.js:584-645) over the kernel, reverting
 * through the journal (removeAutoUpdateHook equivalent):
 *
 *   1. stageRuntimeArtifacts — copy version-check.sh to
 *      <basePath>/.atomic-skills/hooks/ with mode 0o755 (the hook must be
 *      executable; reconcileFileSet would write it 0o644).
 *   2. Per-IDE SessionStart registration (additive, surgically reversed):
 *      - Claude Code → jsonMerge into <basePath>/.claude/settings.json
 *      - Grok Build → jsonMerge into <basePath>/.grok/hooks/atomic-skills-auto-update.json
 *        (user/global auto-update only — never project Soft/Strict scripts)
 *
 * Host selection follows config.ides when present. When ides is omitted
 * (legacy unit callers), Claude-only registration is preserved. When both
 * claude-code and grok are selected, BOTH surfaces receive the SessionStart
 * entry without either clobbering the other.
 *
 * Sources come from config.skillsDir (the skills/ source tree).
 */

/** Dedicated Grok hook file — owns only Atomic Skills auto-update SessionStart. */
export const GROK_AUTO_UPDATE_HOOK_REL = '.grok/hooks/atomic-skills-auto-update.json';

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
  return {
    registerClaude: config.ides.includes('claude-code'),
    registerGrok: config.ides.includes('grok'),
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

      const destRel = '.atomic-skills/hooks/version-check.sh';
      const destAbs = join(basePath, destRel);
      const { registerClaude, registerGrok } = resolveAutoUpdateHosts(config);

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
