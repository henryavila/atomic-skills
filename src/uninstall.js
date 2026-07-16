import { rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import pc from 'picocolors';
import { readManifest, MANIFEST_DIR } from './manifest.js';
import { removeRuntimeArtifacts, unregisterInstall } from './install.js';
import { buildInstaller } from './installer.js';
import { migrateLegacyInstall } from './migrate-legacy-install.js';
import { promptConfirmUninstall, promptUninstallScope } from './ui.js';
import { resolveProjectScopeTarget } from './scope.js';
import {
  unregisterGrokPluginHost,
  wantsGrokPluginHost,
} from './runtime-layers/grok-plugin-host.js';
import { revertGrokAgentsIsolation } from './runtime-layers/grok-agents-isolation.js';

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

  // A pre-kernel (legacy) install has a `files` map but NO `effects` journal, so the
  // Driver's replayReverse would no-op while removeManifest still discards the ledger —
  // orphaning every installed file (F3 review CRITICAL B). Migrate it into journal
  // ownership records FIRST (idempotent: a no-op on an already-journal manifest), so the
  // Driver reverts the proved files and preserves any the user edited since install (P3).
  // Mirrors install.js, which migrates before its own Driver call.
  migrateLegacyInstall(basePath, MANIFEST_DIR);

  // Host plugin registry + agents isolation first (outside journal): drop Grok's
  // native registration and optionally clear [skills].ignore before the
  // filesystem package is removed. Fail-open if `grok` is absent.
  if (wantsGrokPluginHost(manifest.ides)) {
    const host = unregisterGrokPluginHost({ ides: manifest.ides });
    if (host.status === 'unregistered' || host.status === 'absent') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok plugin host: desregistrado.' : 'Grok plugin host: unregistered.')}`);
    } else if (host.status === 'skipped') {
      console.log(`  ${pc.dim(lang === 'pt' ? `Grok plugin host: omitido (${host.detail || 'skip'}).` : `Grok plugin host: skipped (${host.detail || 'skip'}).`)}`);
    } else {
      console.log(`  ${pc.yellow(lang === 'pt' ? `Grok plugin host: falha ao desregistrar (${host.detail || 'erro'}).` : `Grok plugin host: unregister failed (${host.detail || 'error'}).`)}`);
    }

    const iso = revertGrokAgentsIsolation({ basePath, ides: manifest.ides });
    if (iso.status === 'removed') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok: isolamento .agents removido.' : 'Grok: .agents isolation removed.')}`);
    } else if (iso.status === 'kept') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok: isolamento .agents mantido (outra install com grok).' : 'Grok: .agents isolation kept (another grok install remains).')}`);
    }
  }

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
