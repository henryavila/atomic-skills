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
 *   2. jsonMerge — add the SessionStart command entry to
 *      <basePath>/.claude/settings.json. The merge is additive and the journal's
 *      revert subtracts exactly that delta, so a pre-existing third-party hook
 *      survives uninstall (P3). Our hook lives in its own SessionStart entry
 *      rather than merged into a shared matcher (jsonMerge appends array items by
 *      deep-equality), which makes the surgical removal provably exact.
 *
 * Sources come from config.skillsDir (the skills/ source tree).
 */
export function createAutoUpdateRuntimeProvider() {
  return {
    plan(config, { basePath }) {
      const { skillsDir } = config;
      const sourceScript = join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh');
      if (!existsSync(sourceScript)) return [];

      const destRel = '.atomic-skills/hooks/version-check.sh';
      const destAbs = join(basePath, destRel);

      return [
        {
          type: 'stageRuntimeArtifacts',
          args: { basePath, items: [{ path: destRel, source: sourceScript, mode: 0o755 }] },
        },
        {
          type: 'jsonMerge',
          args: {
            basePath,
            path: '.claude/settings.json',
            delta: {
              hooks: {
                SessionStart: [
                  { matcher: '*', hooks: [{ type: 'command', command: destAbs }] },
                ],
              },
            },
          },
        },
      ];
    },
  };
}
