import { rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import pc from 'picocolors';
import { readManifest, MANIFEST_DIR } from './manifest.js';
import {
  unregisterAndMaybeReclaimRuntime,
  releaseGrokAndUnregisterRuntime,
} from './install.js';
import { buildInstaller } from './installer.js';
import { migrateLegacyInstall } from './migrate-legacy-install.js';
import { promptConfirmUninstall, promptUninstallScope } from './ui.js';
import { resolveProjectScopeTarget } from './scope.js';
import { baseHasGrokResidual } from './runtime-layers/grok-refcount.js';

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

  // Host plugin registry + foreign-skills isolation (outside journal).
  // Gate: only when this base has Grok residual ownership signals (ides includes
  // grok OR durable package tree still present after shrink). Non-grok,
  // never-had-grok uninstalls make ZERO host CLI calls (Codex F-003 / local F-1).
  // When residual: release + registry unregister under one shared runtime lock
  // (Codex F-001) so last-owner is decided against the post-removal owner set.
  const departingHadGrok = baseHasGrokResidual(basePath, manifest);
  let registryUnregisteredWithGrok = false;

  if (departingHadGrok) {
    const released = releaseGrokAndUnregisterRuntime(basePath, {
      // Restage only when this install may have owned the host snapshot.
      // Residual-after-shrink (ides without grok but package present) still cleans.
      restageSurvivor: Array.isArray(manifest.ides) && manifest.ides.includes('grok'),
    });
    registryUnregisteredWithGrok = true;
    const { host, isolation: iso } = released;
    if (host.status === 'unregistered') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok plugin host: desregistrado.' : 'Grok plugin host: unregistered.')}`);
    } else if (host.status === 'kept') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok plugin host: mantido (outra install com grok).' : 'Grok plugin host: kept (another grok install remains).')}`);
    } else if (host.status === 'failed') {
      console.log(`  ${pc.yellow(lang === 'pt' ? `Grok plugin host: falha (${host.detail || 'erro'}).` : `Grok plugin host: failed (${host.detail || 'error'}).`)}`);
    } else if (host.status === 'skipped') {
      console.log(`  ${pc.dim(lang === 'pt' ? `Grok plugin host: omitido (${host.detail || 'skip'}).` : `Grok plugin host: skipped (${host.detail || 'skip'}).`)}`);
    }

    if (iso.status === 'removed') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok: isolamento foreign-skills removido.' : 'Grok: foreign-skills isolation removed.')}`);
    } else if (iso.status === 'kept') {
      console.log(`  ${pc.dim(lang === 'pt' ? 'Grok: isolamento foreign-skills mantido (outra install com grok).' : 'Grok: foreign-skills isolation kept (another grok install remains).')}`);
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
  // When Grok residual path already unregistered under the shared lock, skip.
  if (!registryUnregisteredWithGrok) {
    unregisterAndMaybeReclaimRuntime(basePath);
  }

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
