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
import { promptConfirmUninstall, promptUninstallScope, msg as uiMessages } from './ui.js';
import { resolveProjectScopeTarget } from './scope.js';
import { baseHasGrokResidual } from './runtime-layers/grok-refcount.js';
import {
  forceIncompleteUninstall,
  getIncompleteInfo,
  incompleteOperatorMessage,
  formatRecoverySummary,
  recoveryLedgerPath,
  resolveIncompleteRecoveryScope,
  describeRecovery,
  TX_STATE_INCOMPLETE,
} from './recovery-cli.js';

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
 * `buildInstaller` types `config` for the install path. Uninstall only replays
 * the journal — the Driver's uninstall never reads config — so the
 * install-only keys are inert here.
 * @type {Parameters<typeof buildInstaller>[0]}
 */
const UNINSTALL_REPLAY_CONFIG = {
  language: 'en',
  ides: [],
  skillsDir: '',
  metaDir: '',
  scope: 'user',
};

/**
 * Manifest fields uninstall reads; the rest of the journal is the Driver's.
 * @typedef {object} UninstallManifest
 * @property {string} [language]
 * @property {string[]} [ides]
 * @property {Record<string, unknown>} [files]
 */

/**
 * True when a scope has a recoverable install: a complete/incomplete journal,
 * or a readable manifest at `basePath`.
 * @param {{state?: string}} desc
 * @param {string} basePath
 * @returns {boolean}
 */
function hasInstalledState(desc, basePath) {
  if (desc.state === 'complete' || desc.state === TX_STATE_INCOMPLETE) return true;
  try { return readManifest(basePath) !== null; } catch { return false; }
}

/**
 * Resolve the scope when the caller did not force one, prompting only when
 * both scopes hold an install and the run is interactive.
 * @param {string} projectBase
 * @param {boolean} hasProject
 * @param {boolean} hasUser
 * @param {boolean} yes
 * @returns {Promise<'project'|'user'|null>}
 */
async function pickUninstallScope(projectBase, hasProject, hasUser, yes) {
  if (hasProject && hasUser) {
    // Non-interactive can't disambiguate; default to user (explicit --project overrides).
    if (yes) return 'user';
    // Use project manifest's language for the prompt when readable.
    let lang = 'en';
    try {
      lang = readManifest(projectBase)?.language || 'en';
    } catch { /* corrupt */ }
    return promptUninstallScope(lang);
  }
  if (hasProject) return 'project';
  if (hasUser) return 'user';
  console.log('\n  ⚛ No installation found.\n');
  return null;
}

/**
 * @param {string} basePath
 * @returns {UninstallManifest|null}
 */
function readManifestForUninstall(basePath) {
  try {
    return readManifest(basePath);
  } catch {
    // Corrupt complete/incomplete JSON — surface incomplete gate below, never
    // collapse to silent "No installation found" (C-codex-2).
    return null;
  }
}

/**
 * Fail closed on incomplete (including unreadable/invalid JSON, which
 * describeRecovery classifies as incomplete). Runs BEFORE the no-install early
 * return so corrupt incomplete is never hidden as "No installation found".
 * @param {string} basePath
 */
function assertCompleteTransaction(basePath) {
  const incomplete = getIncompleteInfo(basePath);
  if (!incomplete.incomplete) return;
  console.error(`  ${pc.red('Error:')} Incomplete installer transaction blocks uninstall.\n`);
  console.error(formatRecoverySummary(incomplete.desc, incomplete.trust));
  console.error(`\n${incompleteOperatorMessage(incomplete.trust)}\n`);
  process.exit(1);
}

/**
 * Target base for --force-incomplete: forced project/user, or the scope that
 * holds the incomplete transaction. Exits on a scope or recovery error.
 * @param {string} projectDir
 * @param {'project'|'user'|null} scope
 * @param {ReturnType<typeof resolveProjectScopeTarget>} projectTarget
 * @returns {{scope: 'project'|'user', basePath: string}|null}
 */
function resolveForceIncompleteTarget(projectDir, scope, projectTarget) {
  if (scope === 'project') {
    if (!projectTarget.ok) {
      console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
      process.exit(1);
    }
    return { scope, basePath: projectTarget.path };
  }
  if (scope === 'user') return { scope, basePath: homedir() };

  const resolved = resolveIncompleteRecoveryScope({
    projectDir,
    forceProject: false,
    purpose: 'force-incomplete',
  });
  if (resolved.none) {
    console.log(resolved.message || 'No incomplete transaction found.');
    console.log('');
    return null;
  }
  if (resolved.ambiguous || !resolved.ok) {
    console.error(`  ${pc.red('Error:')}${resolved.ambiguous ? '\n' : ' '}${resolved.message}\n`);
    process.exit(resolved.exitCode || 1);
  }
  return { scope: resolved.scope, basePath: resolved.basePath };
}

/**
 * Reverse an incomplete transaction and print its residual-ledger/status lines.
 * @param {string} projectDir
 * @param {'project'|'user'|null} scope
 * @param {ReturnType<typeof resolveProjectScopeTarget>} projectTarget
 */
function runForceIncomplete(projectDir, scope, projectTarget) {
  console.log(`\n  ⚛ Force-incomplete recovery\n`);
  const target = resolveForceIncompleteTarget(projectDir, scope, projectTarget);
  if (!target) return;
  console.log(`  ${pc.dim(`scope: ${target.scope} (${target.basePath})`)}\n`);

  let result;
  try {
    result = forceIncompleteUninstall(target.basePath);
  } catch (err) {
    console.error(`  ${pc.red('Error:')} ${err.message}`);
    console.error(`\n${incompleteOperatorMessage()}\n`);
    process.exit(1);
  }
  if (result.ledger) {
    console.log(`  ${pc.dim(`Residual ledger: ${recoveryLedgerPath(target.basePath)}`)}`);
  }
  if (result.exitCode && result.exitCode !== 0) {
    console.error(result.message || '');
    console.error(`\n  ⚛ Force-incomplete did not fully recover (exit ${result.exitCode}).\n`);
    process.exit(result.exitCode);
  }
  console.log(result.message || '');
  console.log(`\n  ⚛ Force-incomplete complete (check residual ledger if pre-U).\n`);
}

/**
 * The injected failure the journal-failure seam throws (C-codex-3).
 * @returns {Error & {code: string}}
 */
function injectedJournalFailure() {
  return Object.assign(new Error('injected journal uninstall failure'), {
    code: 'INJECTED_JOURNAL_UNINSTALL_FAIL',
  });
}

/**
 * Print the host-registry half of the Grok release result.
 * @param {{status?: string, detail?: string}} host
 * @param {string} lang
 */
function reportGrokHost(host, lang) {
  const isPt = lang === 'pt';
  if (host.status === 'unregistered') {
    console.log(`  ${pc.dim(isPt ? 'Grok plugin host: desregistrado.' : 'Grok plugin host: unregistered.')}`);
  } else if (host.status === 'kept') {
    console.log(`  ${pc.dim(isPt ? 'Grok plugin host: mantido (outra install com grok).' : 'Grok plugin host: kept (another grok install remains).')}`);
  } else if (host.status === 'failed') {
    const detail = host.detail || (isPt ? 'erro' : 'error');
    console.log(`  ${pc.yellow(isPt ? `Grok plugin host: falha (${detail}).` : `Grok plugin host: failed (${detail}).`)}`);
  } else if (host.status === 'skipped') {
    const detail = host.detail || 'skip';
    console.log(`  ${pc.dim(isPt ? `Grok plugin host: omitido (${detail}).` : `Grok plugin host: skipped (${detail}).`)}`);
  }
}

/**
 * Print the foreign-skills-isolation half of the Grok release result.
 * @param {{status?: string}} iso
 * @param {string} lang
 */
function reportGrokIsolation(iso, lang) {
  const isPt = lang === 'pt';
  if (iso.status === 'removed') {
    console.log(`  ${pc.dim(isPt ? 'Grok: isolamento foreign-skills removido.' : 'Grok: foreign-skills isolation removed.')}`);
  } else if (iso.status === 'kept') {
    console.log(`  ${pc.dim(isPt ? 'Grok: isolamento foreign-skills mantido (outra install com grok).' : 'Grok: foreign-skills isolation kept (another grok install remains).')}`);
  }
}

/**
 * Host plugin registry + foreign-skills isolation (outside the journal).
 * Gate: only when this base has Grok residual ownership signals (ides includes
 * grok OR durable package tree still present after shrink). Non-grok,
 * never-had-grok uninstalls make ZERO host CLI calls (Codex F-003 / local F-1).
 *
 * C-codex-3/4 order: decide the release against the trusted post-removal
 * simulation (host + isolation only; finalizeRegistry: false — do NOT drop the
 * registry yet). The caller unregisters it only after journal success, unless
 * a last-owner host failure retained ownership for retry.
 * @param {string} basePath
 * @param {UninstallManifest} manifest
 * @param {string} lang
 * @param {object|null} grokReleaseOpts
 * @returns {{registryUnregistered: boolean, retainRegistryForHostRetry: boolean}}
 */
function releaseGrokForUninstall(basePath, manifest, lang, grokReleaseOpts) {
  if (!baseHasGrokResidual(basePath, manifest)) {
    return { registryUnregistered: false, retainRegistryForHostRetry: false };
  }
  const released = releaseGrokAndUnregisterRuntime(basePath, {
    ...(grokReleaseOpts && typeof grokReleaseOpts === 'object' ? grokReleaseOpts : {}),
    // Restage only when this install may have owned the host snapshot.
    // Residual-after-shrink (ides without grok but package present) still cleans.
    restageSurvivor: Array.isArray(manifest.ides) && manifest.ides.includes('grok'),
    // Host/isolation first; registry after successful journal uninstall (forced).
    finalizeRegistry: false,
  });
  reportGrokHost(released.host, lang);
  reportGrokIsolation(released.isolation, lang);
  return {
    registryUnregistered: released.registryUnregistered === true,
    retainRegistryForHostRetry: released.retainRegistryForHostRetry === true,
  };
}

/**
 * Revert the install-base journal via the Driver: replayReverse runs each
 * effect's revert in reverse, then removeManifest reclaims the manifest.
 * No bespoke unlink loop and no removeAutoUpdateHook: reversibility is a
 * property of the journal's effects (the surgical settings revert is
 * jsonMerge's, the no-proof-no-delete of skill files is reconcileFileSet's).
 * If this throws, the registry must still list basePath (C-codex-3).
 * @param {string} basePath
 * @param {string} lang
 * @returns {boolean} true when the journal was reverted
 */
function revertInstallJournal(basePath, lang) {
  try {
    buildInstaller(UNINSTALL_REPLAY_CONFIG).uninstall({ projectDir: basePath });
    return true;
  } catch (err) {
    console.error(`  ${uiMessages(lang).uninstallIncomplete(err.message)}`);
    process.exitCode = 1;
    return false;
  }
}

/**
 * Reclaim the shared runtime only when the registry was not already finalized
 * under the Grok lock and a last-owner host failure did not retain ownership.
 * @param {string} basePath
 * @param {{registryUnregistered: boolean, retainRegistryForHostRetry: boolean}} grok
 */
function reclaimSharedRuntime(basePath, grok) {
  if (grok.registryUnregistered || grok.retainRegistryForHostRetry) return;
  unregisterAndMaybeReclaimRuntime(basePath);
}

/**
 * The Driver removed the manifest; for a user-scope uninstall the
 * .atomic-skills/ dir also held the shared runtime (reclaimed just above), so
 * prune it if the reclaim emptied it (removeManifest ran while the runtime was
 * still present).
 * @param {string} basePath
 */
function pruneStateDir(basePath) {
  const stateDir = join(basePath, MANIFEST_DIR);
  try {
    if (existsSync(stateDir) && readdirSync(stateDir).length === 0) rmdirSync(stateDir);
  } catch { /* Best-effort prune after the journal was already removed. */ }
}

/**
 * @typedef {object} UninstallOptions
 * @property {'project'|'user'|null} [scope]
 * @property {boolean} [yes]
 * @property {boolean} [forceIncomplete]
 * @property {boolean} [injectJournalUninstallFail]
 * @property {object|null} [grokReleaseOpts]
 */

/**
 * Apply the command's defaults once, so the orchestration reads as steps.
 * @param {UninstallOptions} [options]
 * @returns {{scope: 'project'|'user'|null, yes: boolean, forceIncomplete: boolean,
 *   injectJournalUninstallFail: boolean, grokReleaseOpts: object|null}}
 */
function readUninstallOptions(options = {}) {
  return {
    scope: options.scope ?? null,
    yes: options.yes ?? false,
    forceIncomplete: options.forceIncomplete ?? false,
    injectJournalUninstallFail: options.injectJournalUninstallFail ?? false,
    grokReleaseOpts: options.grokReleaseOpts ?? null,
  };
}

/**
 * Resolve the base the selected scope names and load what uninstall prints with.
 * @param {'project'|'user'} scope
 * @param {string} projectBase
 * @returns {{basePath: string, manifest: UninstallManifest|null, lang: string,
 *   msg: typeof UNINSTALL_MESSAGES.en}}
 */
function describeUninstallTarget(scope, projectBase) {
  const basePath = scope === 'user' ? homedir() : projectBase;
  const manifest = readManifestForUninstall(basePath);
  const lang = manifest?.language || 'en';
  const msg = UNINSTALL_MESSAGES[lang] || UNINSTALL_MESSAGES.en;
  return { basePath, manifest, lang, msg };
}

/**
 * Interactive confirmation, skipped by `--yes`. Prints the cancellation and
 * returns false when the operator declines.
 * @param {boolean} yes
 * @param {string} lang
 * @param {typeof UNINSTALL_MESSAGES.en} msg
 * @returns {Promise<boolean>}
 */
async function confirmInteractiveUninstall(yes, lang, msg) {
  if (yes) return true;
  const confirmed = await promptConfirmUninstall(lang);
  if (confirmed) return true;
  console.log(`  ${msg.cancelled}\n`);
  return false;
}

/**
 * @param {string} projectDir
 * @param {object} [options]
 * @param {'project'|'user'|null} [options.scope] - force scope (skips picker)
 * @param {boolean} [options.yes] - non-interactive: skip the confirmation prompt
 * @param {boolean} [options.forceIncomplete] - P0-A: reverse journaled effects
 *   despite incomplete TX; write residual recovery ledger
 * @param {boolean} [options.injectJournalUninstallFail] - test seam: throw after
 *   Grok host release and before Driver.uninstall (C-codex-3)
 * @param {object} [options.grokReleaseOpts] - test seam: extra opts for
 *   releaseGrokAndUnregisterRuntime (run/resolveBin/env/home)
 */
export async function uninstall(projectDir, options = {}) {
  const {
    scope: forcedScope,
    yes,
    forceIncomplete,
    injectJournalUninstallFail,
    grokReleaseOpts,
  } = readUninstallOptions(options);
  const projectTarget = resolveProjectScopeTarget(projectDir);
  const projectBase = projectTarget.ok ? projectTarget.path : projectDir;

  // P0-A: force-incomplete routes by incomplete presence across scopes
  // (not by normal manifest precedence — never skip project incomplete).
  if (forceIncomplete) {
    runForceIncomplete(projectDir, forcedScope, projectTarget);
    return;
  }

  // Tolerant presence checks (corrupt incomplete JSON must not throw during scope pick).
  // Always pass MANIFEST_DIR — engine default is `.minimalist-installer`, not
  // `.atomic-skills`. Missing dir makes corrupt incomplete look "absent" and
  // collapses to "No installation found" (C-codex-2).
  const projectDesc = projectTarget.ok
    ? describeRecovery(projectBase, MANIFEST_DIR)
    : { state: 'absent' };
  const userDesc = describeRecovery(homedir(), MANIFEST_DIR);
  const hasProject = hasInstalledState(projectDesc, projectBase);
  const hasUser = hasInstalledState(userDesc, homedir());

  let scope = forcedScope;
  if (!scope) {
    scope = await pickUninstallScope(projectBase, hasProject, hasUser, yes);
    if (!scope) return;
  }

  const { basePath, manifest, lang, msg } = describeUninstallTarget(scope, projectBase);

  console.log(`\n  ⚛ ${msg.removing}\n`);

  assertCompleteTransaction(basePath);

  if (!manifest) {
    console.log(`  ${msg.noInstall}\n`);
    return;
  }

  // IMPORTANT: Keep the confirmation prompt for interactive runs. `--yes`
  // skips it so scripts can uninstall unattended.
  if (!(await confirmInteractiveUninstall(yes, lang, msg))) return;

  const removed = Object.keys(manifest.files || {}).length;

  // A pre-kernel (legacy) install has a `files` map but NO `effects` journal, so the
  // Driver's replayReverse would no-op while removeManifest still discards the ledger —
  // orphaning every installed file (F3 review CRITICAL B). Migrate it into journal
  // ownership records FIRST (idempotent: a no-op on an already-journal manifest), so the
  // Driver reverts the proved files and preserves any the user edited since install (P3).
  // Mirrors install.js, which migrates before its own Driver call.
  migrateLegacyInstall(basePath, MANIFEST_DIR);

  const grok = releaseGrokForUninstall(basePath, manifest, lang, grokReleaseOpts);

  // Test seam: prove registry still owns basePath if journal uninstall fails (C-codex-3).
  if (injectJournalUninstallFail) throw injectedJournalFailure();

  if (!revertInstallJournal(basePath, lang)) return;

  // Global runtime artifacts and the cross-install registry are shared across
  // ALL installs (user + each project), so reclaim them only when the LAST
  // install is gone — orchestrated OUTSIDE the journal (replayReverse cannot
  // express a conditional, refcounted reclaim, F-003).
  reclaimSharedRuntime(basePath, grok);
  pruneStateDir(basePath);

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);

  console.log(`\n  ⚛ ${msg.complete}\n`);
}
