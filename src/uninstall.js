import { unlinkSync, rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { removeRuntimeArtifacts, removeAutoUpdateHook } from './install.js';
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

  let removed = 0;
  for (const relPath of Object.keys(manifest.files)) {
    const absPath = join(basePath, relPath);
    if (existsSync(absPath)) {
      unlinkSync(absPath);
      removed++;
      pruneEmptyParents(absPath, basePath);
    }
  }

  // Remove the SessionStart hook entry the installer merged into settings.json
  // (its script was just removed above as a manifest-tracked file, so this
  // clears the now-dead reference). Surgical: preserves all other hooks.
  removeAutoUpdateHook({ basePath, scope, settingsCreated: manifest.settingsCreated === true });

  // Global runtime artifacts (~/.atomic-skills/{bin,dashboard,...}) are shared
  // across all installs, so only a user-scope uninstall reclaims them; a
  // project uninstall leaves them for other repos / the user install.
  if (scope === 'user') removeRuntimeArtifacts();

  // Remove manifest (last, so the .atomic-skills/ dir can be pruned once the
  // runtime artifacts that also lived there are gone).
  const manifestPath = join(basePath, MANIFEST_DIR, MANIFEST_FILE);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  const manifestDir = join(basePath, MANIFEST_DIR);
  try {
    if (existsSync(manifestDir) && readdirSync(manifestDir).length === 0) {
      rmdirSync(manifestDir);
    }
  } catch {}

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);

  console.log(`\n  ⚛ ${msg.complete}\n`);
}
