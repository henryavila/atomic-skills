import { rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR } from './manifest.js';
import { removeRuntimeArtifacts, unregisterInstall } from './install.js';
import { buildInstaller } from './installer.js';
import { promptConfirmUninstall, promptUninstallScope } from './ui.js';
import { resolveProjectScopeTarget } from './scope.js';

/**
 * Walk up from a just-removed file, deleting empty parent dirs until a
 * non-empty dir or `basePath` is reached. Bounded strictly inside basePath
 * (the path-aware check avoids matching a sibling dir with a common prefix).
 *
 * Exported for unit testing: the multi-level walk and the basePath boundary
 * are the subtle parts the design called out as must-test.
 */
export function pruneEmptyParents(fromPath, basePath) {
  let parent = dirname(fromPath);
  const boundary = basePath + PATH_SEP;
  while (parent !== basePath && parent.startsWith(boundary)) {
    try {
      if (readdirSync(parent).length === 0) {
        rmdirSync(parent);
        parent = dirname(parent);
      } else break;
    } catch { break; }
  }
}

const UNINSTALL_MESSAGES = {
  pt: {
    removing: 'Removendo Atomic Skills...',
    noInstall: 'Nenhuma instalação encontrada.',
    cancelled: 'Cancelado.',
    filesRemoved: (n) => `${n} arquivos removidos.`,
    manifestRemoved: `${MANIFEST_DIR}/manifest.json removido.`,
    complete: 'Desinstalação completa.',
  },
  en: {
    removing: 'Removing Atomic Skills...',
    noInstall: 'No installation found.',
    cancelled: 'Cancelled.',
    filesRemoved: (n) => `${n} files removed.`,
    manifestRemoved: `${MANIFEST_DIR}/manifest.json removed.`,
    complete: 'Uninstall complete.',
  },
};

/**
 * @param {string} projectDir
 * @param {object} [options]
 * @param {'project'|'user'|null} [options.scope] - force scope (skips picker)
 * @param {boolean} [options.yes] - non-interactive: skip the confirmation prompt
 */
export async function uninstall(projectDir, options = {}) {
  let { scope = null, yes = false } = options;
  const projectTarget = resolveProjectScopeTarget(projectDir);
  const projectBase = projectTarget.ok ? projectTarget.path : projectDir;
  const hasProject = readManifest(projectBase) !== null;
  const hasUser = readManifest(homedir()) !== null;

  if (!scope) {
    if (hasProject && hasUser) {
      if (yes) {
        // Non-interactive can't disambiguate; mirror install's default scope.
        scope = 'user';
      } else {
        // Use project manifest's language for the prompt
        const projectManifest = readManifest(projectBase);
        const lang0 = projectManifest?.language || 'en';
        scope = await promptUninstallScope(lang0);
      }
    } else if (hasProject) {
      scope = 'project';
    } else if (hasUser) {
      scope = 'user';
    } else {
      console.log('\n  ⚛ No installation found.\n');
      return;
    }
  }

  const basePath = scope === 'user' ? homedir() : projectBase;
  const manifest = readManifest(basePath);
  const lang = manifest?.language || 'en';
  const msg = UNINSTALL_MESSAGES[lang] || UNINSTALL_MESSAGES.en;

  console.log(`\n  ⚛ ${msg.removing}\n`);

  if (!manifest) {
    console.log(`  ${msg.noInstall}\n`);
    return;
  }

  // IMPORTANT: Keep the confirmation prompt for interactive runs. `--yes`
  // skips it so scripts can uninstall unattended.
  if (!yes) {
    const confirmed = await promptConfirmUninstall(lang);
    if (!confirmed) {
      console.log(`  ${msg.cancelled}\n`);
      return;
    }
  }

  const removed = Object.keys(manifest.files || {}).length;

  // Revert the install-base journal — the skill file set (reconcileFileSet), the
  // auto-update hook (stageRuntimeArtifacts) and the settings.json SessionStart
  // entry (jsonMerge) — via the Driver: replayReverse runs each effect's revert in
  // reverse, then removeManifest reclaims the manifest. No bespoke unlink loop and
  // no removeAutoUpdateHook: reversibility is a property of the journal's effects
  // (the surgical settings revert is jsonMerge's, the no-proof-no-delete of skill
  // files is reconcileFileSet's — a third-party SessionStart hook + a user-modified
  // skill survive exactly as before).
  buildInstaller({}).uninstall({ projectDir: basePath });

  // Global runtime artifacts (~/.atomic-skills/{bin,dashboard,...}) and the
  // cross-install registry are shared across ALL installs (user + each project),
  // so reclaim them only when the LAST install is gone — orchestrated OUTSIDE the
  // journal (replayReverse cannot express a conditional, refcounted reclaim, F-003).
  // Removing them on any single uninstall would strand every other install that
  // still depends on the shared dashboard/provisioner runtime.
  const remainingInstalls = unregisterInstall(basePath);
  if (remainingInstalls === 0) removeRuntimeArtifacts();

  // The Driver removed the manifest; for a user-scope uninstall the .atomic-skills/
  // dir also held the shared runtime (reclaimed just above), so prune it if the
  // reclaim emptied it (removeManifest ran while the runtime was still present).
  const stateDir = join(basePath, MANIFEST_DIR);
  try {
    if (existsSync(stateDir) && readdirSync(stateDir).length === 0) rmdirSync(stateDir);
  } catch {}

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);

  console.log(`\n  ⚛ ${msg.complete}\n`);
}
