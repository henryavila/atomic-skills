import { defineInstaller } from '@henryavila/minimalist-installer';
import { createSkillsProvider } from './providers/skills-provider.js';
import { createAutoUpdateRuntimeProvider } from './runtime-layers/auto-update.js';
import { createStageRuntimeArtifactsEffect } from './runtime-layers/effects/stage-runtime-artifacts.js';
import { wrapInstallerRegistryForIdeSymlinks } from './ide-symlink-install.js';
import { MANIFEST_DIR } from './manifest.js';

/**
 * Build the install-base installer over the @henryavila/minimalist-installer engine
 * (T-F3-4 flip). The journal lives at <projectDir>/<MANIFEST_DIR>/manifest.json
 * and records the install-base effects:
 *
 *   - reconcileFileSet  — the skills file set (skill bodies + shared assets +
 *                         per-IDE namespace roots), via the SkillsProvider.
 *   - stageRuntimeArtifacts + jsonMerge — the auto-update SessionStart hook
 *                         (executable version-check.sh + the settings.json entry),
 *                         via the auto-update runtime layer.
 *
 * IDE config roots that are symlinks (~/.grok, ~/.cursor, … for any IDE) are
 * read and the files are written at the final directory. Nested and leaf
 * symlinks stay refused.
 *
 * Uninstall replays the journal in reverse (Driver.uninstall) — there is no
 * bespoke unlink loop and no consumer-written revert logic; reversibility is a
 * property of each effect.
 *
 * NOT part of this journal (orchestrated outside it — see install.js): the GLOBAL
 * ~/.atomic-skills/package-root pointer and the cross-install refcount registry.
 * They live at homedir, are shared across every install, and must be reclaimed
 * only when the LAST owner leaves — a conditional reclaim the journal's blind
 * replayReverse cannot express. Last-owner reclaim also deletes leftover aiDeck
 * paths from older installs.
 *
 * @param {object} config
 * @param {string} config.language - communication language code (e.g. 'en')
 * @param {string[]} config.ides - IDE ids to render for
 * @param {string} config.skillsDir - path to the skills/ source tree
 * @param {string} config.metaDir - path to the meta/ dir holding catalog.yaml
 * @param {''|'user'|'project'} config.scope - install scope (drives ASSETS_PATH)
 * @returns {{ install: Function, uninstall: Function, registry: object }}
 */
export function buildInstaller(config) {
  const installer = defineInstaller({
    config: { manifestDir: MANIFEST_DIR, ...config },
    providers: [createSkillsProvider(), createAutoUpdateRuntimeProvider()],
    effects: [createStageRuntimeArtifactsEffect()],
  });
  wrapInstallerRegistryForIdeSymlinks(installer.registry);
  return installer;
}
