import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS,
  normalizeIDESelection,
} from './config.js';
import { hashContent } from './hash.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { GLOBAL_INSTRUCTION_PATHS, DELEGATE_MARKERS, globalInstructionBody, installedGlobalInstructionPaths, globalInstructionState, globalInstructionsDecision } from './global-instructions.js';
import { buildInstaller } from './installer.js';
import { computeSkillsFileSet } from './providers/skills-file-set.js';
import { migrateLegacyInstall } from './migrate-legacy-install.js';
import { adoptPreexistingDesiredFiles } from './adopt-preexisting-desired.js';
import { parse as parseYaml } from 'yaml';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import { resolveProjectScopeTarget } from './scope.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptInstallScope,
  showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';
import { DEFAULT_MEMORY_PATH } from './providers/skills-file-set.js';
import { syncGrokPluginHostAfterInstall } from './grok-host-sync.js';
// P0-B / F-002 consumer fallback — DELETE import when engine drop-revert is pinned.
import { revertDroppedAutoUpdateEffects } from './runtime-layers/auto-update-drop-revert.js';
import {
  reconcileAutoUpdateSessionStartSurfaces,
  resolveDesiredAutoUpdateCommands,
} from './runtime-layers/auto-update.js';
import { verifyInstall, decisionsByState } from './status-verify.js';
import {
  getIncompleteInfo,
  incompleteOperatorMessage,
  repairIncompleteInstall,
  formatRecoverySummary,
  resolveIncompleteRecoveryScope,
} from './recovery-cli.js';
import { getPackageVersion } from './package-identity.js';
import {
  publishRuntimeAndRegister,
} from './installs-registry.js';
import {
  isAtomicSkillsArtifact,
  isAtomicSkillsNamespaceLeftover,
  findLegacyOrphans,
  removeLegacyOrphans,
} from './legacy-orphans.js';

export { resolveProjectScopeTarget } from './scope.js';
export {
  ownerFingerprint,
  discoverPackageIdentity,
  buildLiveOwnerRecord,
  getPackageVersion,
} from './package-identity.js';
export {
  REGISTRY_SCHEMA_VERSION,
  materializeRegistryOwners,
  readInstallsRegistry,
  restagePackageRootFrom,
  registerInstall,
  unregisterInstall,
  publishRuntimeAndRegister,
  unregisterAndMaybeReclaimRuntime,
  releaseGrokAndUnregisterRuntime,
  installRuntimeArtifacts,
  removeRuntimeArtifacts,
} from './installs-registry.js';
export {
  isAtomicSkillsArtifact,
  isAtomicSkillsNamespaceLeftover,
  findLegacyOrphans,
  removeLegacyOrphans,
} from './legacy-orphans.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

/**
 * Codex F-002: if a previous install customized memory_path away from the
 * canonical `.ai/memory/`, warn once (do not block). Custom path is no longer
 * configurable — rendered skills always use DEFAULT_MEMORY_PATH.
 *
 * @param {object|null} existingManifest
 * @param {string} language
 */
export function warnLegacyCustomMemoryPath(existingManifest, language = 'en') {
  const oldPath = existingManifest?.modules?.memory?.config?.memory_path;
  if (typeof oldPath !== 'string' || oldPath.trim().length === 0) return;
  const normalized = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
  const canonical = DEFAULT_MEMORY_PATH.endsWith('/')
    ? DEFAULT_MEMORY_PATH
    : `${DEFAULT_MEMORY_PATH}/`;
  if (normalized === canonical) return;
  const isPt = language === 'pt';
  const msgText = isPt
    ? `Caminho de memória customizado "${oldPath}" não é mais suportado. Skills usam ${DEFAULT_MEMORY_PATH}. Migre o conteúdo se necessário.`
    : `Custom memory path "${oldPath}" is no longer supported. Skills use ${DEFAULT_MEMORY_PATH}. Migrate content if needed.`;
  console.warn(`  ${pc.yellow('Warning:')} ${msgText}`);
}

/**
 * Core install logic (non-interactive, testable) — flipped onto the
 * @henryavila/minimalist-installer engine (T-F3-4). It delegates every file mutation
 * to the install-base Driver (`buildInstaller`): the SkillsProvider emits the
 * skill file set (reconcileFileSet) and the auto-update runtime layer emits the
 * executable hook (stageRuntimeArtifacts) + the settings.json SessionStart entry
 * (jsonMerge). The Driver writes the JOURNAL manifest and, on a re-install,
 * threads each effect's prior before-state — so reconcileFileSet runs the 3-hash
 * no-clobber update (user-modified files survive, P3) and removes unmodified
 * orphans, with no bespoke conflict/orphan logic here.
 *
 * This function then patches the consumer METADATA (version/language/ides)
 * and a DERIVED legacy `files` map onto the manifest: the journal (`effects`) stays
 * authoritative for uninstall, while the `files` map keeps the status/compat
 * readers working.
 *
 * @param {string} projectDir
 * @param {object} options - { language, ides, skillsDir, metaDir, scope,
 *   forceAdopt?, autoUpdateDropInjectFailAfterN? } (inject is a P0-B test seam only)
 * @param {object} [callbacks] - { onFileWritten }
 * @returns {{
 *   files: Array<{ path: string, hash: string, source: string }>,
 *   decisions: object,
 *   verification: object,
 *   adopt: object,
 * }}
 */
export function installSkills(projectDir, options, callbacks = {}) {
  const { language, ides, skillsDir, metaDir, scope, forceAdopt = false } = options;
  const { onFileWritten } = callbacks;
  const plan = { language, ides, skillsDir, metaDir, scope };

  // P1-A / F-004: adopt only safelist / known-package-hash / force-adopt paths.
  // Foreign content at desired paths becomes unmanaged-desired (excluded from
  // reconcile + never owned). See adopt-preexisting-desired.js.
  const desired = computeSkillsFileSet(plan);
  const priorManifest = readManifest(projectDir);
  const knownCurrentNames = readKnownCurrentSkillNames(metaDir);
  const adoptResult = adoptPreexistingDesiredFiles(projectDir, desired, {
    forceAdopt,
    isArtifact: (abs) => isAtomicSkillsOwnedPath(projectDir, abs, knownCurrentNames),
    knownPackageHashes: collectKnownPackageHashes(priorManifest),
  });
  const excludeDesiredPaths = adoptResult.excludeFromDesired || [];
  reportAdoption(adoptResult);

  // P0-B / F-002 consumer fallback: revert auto-update surfaces the next plan
  // drops before Driver.install rewrites the journal. Crash-resumable and
  // fail-closed on incomplete TX, same recovery contract as Driver.install.
  revertDroppedAutoUpdateEffects(projectDir, plan, {
    injectFailAfterN: options.autoUpdateDropInjectFailAfterN,
  });

  // SessionStart reconcile: remove every AS-owned hook that is not the exact
  // desired command; third-party hooks stay.
  reconcileSessionStartSurface(projectDir, plan);

  const installPlan = { ...plan, excludeDesiredPaths, globalInstructions: options.globalInstructions };
  const optedOutGlobalPaths = applyGlobalInstructionsInstaller(projectDir, installPlan, priorManifest);
  reportGlobalInstructionOutcomes(installPlan, optedOutGlobalPaths);

  // Derive the legacy files list from the journal + the plan: the journal has
  // the authoritative installed hashes, the plan each file's `source` tag.
  const journal = readManifest(projectDir);
  const createdFiles = buildCreatedFiles(projectDir, installPlan, journal);
  patchManifestMetadata(projectDir, journal, installPlan, createdFiles);

  if (onFileWritten) for (const f of createdFiles) onFileWritten(f.path);

  // Hash-classify the post-install filesystem (F2/T-003).
  const verification = verifyInstall(projectDir, readManifest(projectDir));
  return {
    files: createdFiles,
    decisions: decisionsByState(verification),
    verification,
    adopt: adoptionSummary(adoptResult),
  };
}

function collectKnownPackageHashes(priorManifest) {
  const hashes = new Set();
  if (priorManifest?.files && typeof priorManifest.files === 'object') addLegacyFileHashes(hashes, priorManifest.files);
  addReconcileEffectHashes(hashes, priorManifest?.effects || []);
  return hashes;
}

function addLegacyFileHashes(hashes, files) {
  for (const entry of Object.values(files)) {
    if (entry && typeof entry.installed_hash === 'string') hashes.add(entry.installed_hash);
  }
}

function addReconcileEffectHashes(hashes, effects) {
  for (const eff of effects) {
    if (eff?.type !== 'reconcileFileSet') continue;
    for (const row of eff.beforeState || []) {
      if (row && typeof row.installedHash === 'string') hashes.add(row.installedHash);
    }
  }
}

function readKnownCurrentSkillNames(metaDir) {
  try {
    const catalog = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
    return new Set(Object.keys(catalog?.core || {}));
  } catch {
    return new Set();
  }
}

function isAtomicSkillsOwnedPath(projectDir, abs, knownCurrentNames) {
  if (isAtomicSkillsArtifact(abs, knownCurrentNames)) return true;
  return isAtomicSkillsNamespaceLeftover(abs, relative(projectDir, abs), knownCurrentNames);
}

function reportAdoption(adoptResult) {
  if (adoptResult.adopted > 0 || adoptResult.unresolved > 0) {
    console.log(`  ${pc.dim(`adopt: ${adoptResult.adopted} reclaimed, ${adoptResult.unresolved} unmanaged-desired (kept local)`)}`);
    for (const pth of adoptResult.unresolvedPaths || []) console.log(`    ${pc.dim('kept-local')} ${pth}`);
  }
}

function reconcileSessionStartSurface(projectDir, plan) {
  const desired = resolveDesiredAutoUpdateCommands(projectDir, plan);
  reconcileAutoUpdateSessionStartSurfaces(projectDir, {
    claudeCommand: desired.claudeCommand,
    grokCommand: desired.grokCommand,
  });
}

function applyGlobalInstructionsInstaller(projectDir, installPlan, priorManifest) {
  const refusedGlobalPaths = [];
  const optedOutGlobalPaths = new Set();
  for (;;) {
    const installer = buildInstaller({ ...installPlan, refusedGlobalPaths, optedOutGlobalPaths });
    try {
      installer.install({ projectDir });
      return optedOutGlobalPaths;
    } catch (err) {
      handleGlobalInstructionRefusal(err, {
        projectDir, priorManifest, language: installPlan.language, refusedGlobalPaths, optedOutGlobalPaths,
      });
    }
  }
}

function handleGlobalInstructionRefusal(err, {
  projectDir, priorManifest, language, refusedGlobalPaths, optedOutGlobalPaths,
}) {
  const path = err.globalInstructionPath ?? Object.values(GLOBAL_INSTRUCTION_PATHS).find(candidate =>
    candidate && err.message?.includes(`"${candidate}"`));
  if (!path || refusedGlobalPaths.includes(path)) throw err;
  // The engine validates ALL prior text blocks, even omitted effects. Preserve
  // the journal rather than rewriting it to bypass validation.
  if (priorManifest?.effects?.some(e => e.type === 'textBlock' && e.beforeState?.path === path)) {
    let reason = err.message;
    try {
      const state = globalInstructionState(projectDir, path);
      if (state !== 'absent' && state !== 'present') reason = state;
    } catch { /* Keep the original path-safety or I/O reason. */ }
    /** @type {Error & { code?: string }} */
    const blocked = new Error(msg(language).globalInstructionsBlocked(path, reason));
    blocked.code = 'GLOBAL_INSTRUCTIONS_BLOCKED';
    throw blocked;
  }
  // A planning refusal precedes mutations. An apply refusal may leave an
  // incomplete journal; never retry over it or discard ownership records.
  if (readManifest(projectDir)?.transaction?.state === 'incomplete') throw err;
  console.log(`  ${msg(language).globalInstructionsRefused(path, err.message)}`);
  refusedGlobalPaths.push(path);
}

function reportGlobalInstructionOutcomes(installPlan, optedOutGlobalPaths) {
  for (const path of optedOutGlobalPaths) console.log(`  ${msg(installPlan.language).globalInstructionsOptOut(path)}`);
  if (installPlan.scope !== 'user' || installPlan.globalInstructions !== true) return;
  const skipped = installPlan.ides.filter(agent => GLOBAL_INSTRUCTION_PATHS[agent] === null);
  if (skipped.length) console.log(`  ${msg(installPlan.language).globalInstructionsSkipped(skipped.join(', '))}`);
}

function buildCreatedFiles(projectDir, installPlan, journal) {
  const excludeSet = new Set(installPlan.excludeDesiredPaths);
  const hashByPath = new Map();
  const hookFiles = [];
  for (const eff of journal.effects || []) {
    if (eff.type === 'reconcileFileSet') {
      for (const { path, installedHash } of eff.beforeState) hashByPath.set(path, installedHash);
    } else if (eff.type === 'stageRuntimeArtifacts') {
      for (const rel of eff.beforeState?.created || []) {
        const abs = join(projectDir, rel);
        if (existsSync(abs) && statSync(abs).isFile()) {
          hookFiles.push({ path: rel, hash: hashContent(readFileSync(abs, 'utf8')), source: `_hooks/${basename(rel)}` });
        }
      }
    }
  }
  const desiredFiles = /** @type {Array<{ path: string, content: string, source: string }>} */ (
    computeSkillsFileSet(installPlan)
  );
  return [
    ...desiredFiles
      .filter(({ path }) => !excludeSet.has(path))
      .map(({ path, source }) => ({ path, hash: hashByPath.get(path), source })),
    ...hookFiles,
  ];
}

function patchManifestMetadata(projectDir, journal, installPlan, createdFiles) {
  const filesMap = {};
  for (const { path, hash, source } of createdFiles) filesMap[path] = { installed_hash: hash, source };
  const { modules: _legacyModules, ...journalRest } = journal;
  writeManifest(projectDir, {
    ...journalRest,
    version: getPackageVersion(),
    language: installPlan.language,
    ides: installPlan.ides,
    files: filesMap,
  });
}

function adoptionSummary(adoptResult) {
  return {
    adopted: adoptResult.adopted,
    unresolved: adoptResult.unresolved,
    paths: adoptResult.paths,
    unresolvedPaths: adoptResult.unresolvedPaths,
  };
}

export { syncGrokPluginHostAfterInstall };

/** Normalize the public install options into one settings object. */
function parseInstallOptions(options) {
  const {
    yes = false,
    project = false,
    ide: cliIDEs = null,
    lang: cliLang = null,
    allDetected = false,
    repair = false,
    forceAdopt = false,
  } = options;
  return { yes, project, cliIDEs, cliLang, allDetected, repair, forceAdopt };
}

function readManifestOrNull(base) {
  try { return readManifest(base); } catch { return null; }
}

function resolveInstallLanguage(cliLang, manifest, fallback) {
  return cliLang || manifest?.language || fallback;
}

function resolveInitialLanguage(cliLang, userManifest, projectManifest) {
  return cliLang || userManifest?.language || projectManifest?.language || detectLanguage();
}

/** Resolve the base `--repair` works on, or null when there is nothing to repair. */
function resolveRepairTarget({ projectDir, project, projectTarget }) {
  if (project) return { scope: 'project', basePath: projectTarget.path };
  const resolved = resolveIncompleteRecoveryScope({ projectDir, forceProject: false, purpose: 'repair' });
  if (resolved.ambiguous) {
    console.error(`  ${pc.red('Error:')}\n${resolved.message}\n`);
    process.exit(resolved.exitCode || 1);
  }
  if (resolved.none) {
    console.log(resolved.message || 'No incomplete transaction found.');
    console.log('');
    return null;
  }
  if (!resolved.ok) {
    console.error(`  ${pc.red('Error:')} ${resolved.message}\n`);
    process.exit(resolved.exitCode || 1);
  }
  return { scope: resolved.scope, basePath: resolved.basePath };
}

function runRepairMode({ projectDir, project, projectTarget }) {
  console.log('\n  ⚛ Installer recovery (--repair)\n');
  const target = resolveRepairTarget({ projectDir, project, projectTarget });
  if (!target) return;
  const { scope, basePath } = target;
  console.log(`  ${pc.dim(`scope: ${scope} (${basePath})`)}\n`);
  let result;
  try {
    result = repairIncompleteInstall(basePath);
  } catch (err) {
    // Mid-repair interrupt: never claim complete; surface residual.
    console.error(`  ${pc.red('Error:')} ${err.message}`);
    console.error(`\n${incompleteOperatorMessage()}\n`);
    process.exit(1);
  }
  if (result.exitCode && result.exitCode !== 0) {
    console.error(result.message || result.summary || '');
    process.exit(result.exitCode);
  }
  console.log(result.message || result.summary || '');
  if (result.action === 'reversed' && result.exitCode === 0) {
    console.log(`\n  ${pc.dim('Incomplete cleared (reverse-only). Re-run install without --repair to complete.')}\n`);
  }
}

async function resolveInstallScope({ yes, project, initialLanguage, projectTarget, projectManifest, userManifest }) {
  if (yes || project) return project ? 'project' : 'user';
  return promptInstallScope(initialLanguage, {
    projectTarget, initialScope: projectManifest && !userManifest ? 'project' : 'user',
  });
}

function assertNoIncompleteTransaction(basePath) {
  const incomplete = getIncompleteInfo(basePath);
  if (!incomplete.incomplete) return;
  console.error(`\n  ${pc.red('Error:')} Incomplete installer transaction.\n`);
  console.error(formatRecoverySummary(incomplete.desc, incomplete.trust));
  console.error(`\n${incompleteOperatorMessage(incomplete.trust)}\n`);
  process.exit(1);
}

function resolveInstallIdes({ allDetected, cliIDEs, existingManifest, basePath }) {
  if (!allDetected) return cliIDEs || existingManifest?.ides?.slice() || detectIDEs(basePath);
  if (existingManifest?.ides?.length) {
    console.log(`  ${pc.dim('Re-detecting IDEs from filesystem (ignoring manifest selection).')}`);
  }
  return detectIDEs(basePath);
}

function validateCLIIDEs(cliIDEs) {
  if (!cliIDEs) return;
  const validIDs = new Set(Object.keys(IDE_CONFIG));
  const invalid = cliIDEs.filter(id => !validIDs.has(id));
  if (invalid.length === 0) return;
  console.error(`  Error: Unknown IDE(s): ${invalid.join(', ')}. Valid: ${PUBLIC_IDE_IDS.join(', ')}`);
  process.exit(1);
}

function findInstallOrphans(basePath, metaDir) {
  const catalog = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
  const knownCurrentNames = new Set(Object.keys(catalog?.core || {}));
  const orphans = findLegacyOrphans(basePath, knownCurrentNames);
  return {
    safeOrphans: orphans.filter((o) => o.safe),
    unsafeOrphans: orphans.filter((o) => !o.safe),
  };
}

/** Run installSkills plus the out-of-journal host publish shared by both modes. */
function executeInstall(context, language, ides, globalInstructions) {
  const { basePath, skillsDir, metaDir, scope, existingManifest, settings } = context;
  const result = installSkills(basePath, {
    language, ides, skillsDir, metaDir, scope,
    forceAdopt: settings.forceAdopt,
    globalInstructions,
  });
  // Host plugin registry (outside journal): register when grok is wanted,
  // release when the IDE shrink leaves the last grok owner (F-003).
  syncGrokPluginHostAfterInstall(basePath, ides, language, { priorIdes: existingManifest?.ides });
  publishRuntimeAndRegister(basePath);
  return result;
}

/** Non-interactive (`--yes`) install: clean legacy orphans, install, report. */
function runNonInteractiveInstall(context) {
  const { basePath, language, ides, pkgVersion, safeOrphans, unsafeOrphans } = context;
  if (ides.length === 0) {
    console.error(`  ${pc.red('Error:')} No IDEs detected. Use --ide to specify.`);
    process.exit(1);
  }
  if (safeOrphans.length > 0) {
    console.log(`  ${pc.dim(`Cleaning ${safeOrphans.length} legacy orphan file(s) at obsolete install path(s):`)}`);
    for (const o of safeOrphans) console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
    removeLegacyOrphans(basePath, safeOrphans);
  }
  if (unsafeOrphans.length > 0) {
    console.log(`  ${pc.yellow(`Preserved ${unsafeOrphans.length} file(s) at legacy path that don't look like atomic-skills artifacts (no recognized frontmatter \`name:\`):`)}`);
    for (const o of unsafeOrphans) console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
    console.log(`  ${pc.dim('Inspect manually and remove if intended.')}`);
  }
  console.log(`◇ ${msg(language).installingMsg(pkgVersion)}`);
  const result = executeInstall(context, language, ides, context.options.globalInstructions);
  showNonInteractiveResult(result, ides, language);
}

function buildInteractiveConfig(context) {
  const { language, languageDetected, ides, project, scope, basePath, projectTarget, existingManifest, metaDir } = context;
  return {
    lang: language, languageDetected, ides: [...ides], project, scope,
    scopePath: scope === 'project' ? basePath : '~/',
    projectTarget, existingVersion: existingManifest?.version, skillCount: countSkills(metaDir),
  };
}

/** Interactive orphan review; false when the user cancels the whole install. */
async function reviewLegacyOrphansInteractive({ config, basePath, safeOrphans, unsafeOrphans }) {
  const isPt = config.lang === 'pt';
  if (safeOrphans.length > 0) {
    p.log.warn(isPt
      ? `${safeOrphans.length} arquivo(s) órfão(s) atomic-skills encontrado(s) em caminhos antigos:`
      : `Found ${safeOrphans.length} atomic-skills orphan file(s) at obsolete install path(s):`);
    for (const o of safeOrphans) p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}  ${pc.dim(`(${o.reason})`)}`);
    const removeOrphans = await p.confirm({
      message: isPt ? 'Remover esses arquivos?' : 'Remove these files?',
      initialValue: true,
    });
    if (p.isCancel(removeOrphans)) {
      p.outro(msg(config.lang).cancelled);
      return false;
    }
    if (removeOrphans) {
      removeLegacyOrphans(basePath, safeOrphans);
      p.log.success(isPt ? `${safeOrphans.length} arquivo(s) órfão(s) removido(s).` : `Removed ${safeOrphans.length} orphan file(s).`);
    }
  }
  if (unsafeOrphans.length > 0) {
    p.log.warn(isPt
      ? `${unsafeOrphans.length} arquivo(s) preservado(s) em caminhos antigos (sem assinatura atomic-skills no frontmatter):`
      : `Preserved ${unsafeOrphans.length} file(s) at legacy path(s) without atomic-skills frontmatter signature:`);
    for (const o of unsafeOrphans) p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}`);
    p.log.message(isPt
      ? `  ${pc.dim('Inspecione e remova manualmente se for o caso.')}`
      : `  ${pc.dim('Inspect and remove manually if intended.')}`);
  }
  return true;
}

/** Force IDE selection when detection found none; false on cancel. */
async function ensureInteractiveIdes(config) {
  if (config.ides.length === 0) {
    p.log.warn(msg(config.lang).noIDEsDetected);
    config.ides = await promptIDESelection(config.lang, []);
    if (config.ides.length === 0) {
      p.outro(msg(config.lang).cancelled);
      return false;
    }
    config.ides = normalizeIDESelection(config.ides);
  }
  return true;
}

/** Show the config and run the customize/install/quit action loop. */
async function chooseInteractiveAction(config, isUpdate) {
  let action;
  do {
    printConfig(config, 0);
    action = await promptAction(config.lang, { isUpdate, hasConflicts: false });
    if (action === 'customize-lang') {
      config.lang = await promptLanguageSelection(config.lang);
      config.languageDetected = false;
    } else if (action === 'customize-ides') {
      config.ides = await promptIDESelection(config.lang, config.ides);
      config.ides = normalizeIDESelection(config.ides);
    }
  } while (action !== 'install' && action !== 'quit');
  return action;
}

/** Ask the global-instructions question; `cancelled` aborts the install. */
async function resolveInteractiveGlobalInstructions({ config, basePath, scope, requested }) {
  if (scope !== 'user' || requested !== undefined) return { cancelled: false, value: requested };
  const paths = config.ides.map(agent => GLOBAL_INSTRUCTION_PATHS[agent]).filter(Boolean);
  p.log.message(`${DELEGATE_MARKERS.begin}\n${globalInstructionBody(config.lang)}\n${DELEGATE_MARKERS.end}`);
  p.log.message(msg(config.lang).globalInstructionsFiles(paths.map(path => join(basePath, path)).join(', ')));
  const installedPaths = installedGlobalInstructionPaths(basePath);
  const confirmed = await p.confirm({
    message: msg(config.lang).globalInstructionsPrompt,
    initialValue: globalInstructionsDecision(installedPaths).enabled,
  });
  const decision = globalInstructionsDecision(installedPaths, confirmed);
  if (decision.cancelled) {
    p.outro(msg(config.lang).cancelled);
    return { cancelled: true, value: undefined };
  }
  return { cancelled: false, value: decision.enabled };
}

/** Interactive (dashboard) install. */
async function runInteractiveInstall(context) {
  const config = buildInteractiveConfig(context);
  showIntro(config, { isUpdate: context.isUpdate, pkgVersion: context.pkgVersion });
  // Surface legacy-namespace orphans and prompt for cleanup before the action loop.
  const orphansReviewed = await reviewLegacyOrphansInteractive({
    config, basePath: context.basePath, safeOrphans: context.safeOrphans, unsafeOrphans: context.unsafeOrphans,
  });
  if (!orphansReviewed) return;
  if (!await ensureInteractiveIdes(config)) return;
  const action = await chooseInteractiveAction(config, context.isUpdate);
  if (action === 'quit') {
    p.outro(msg(config.lang).cancelled);
    return;
  }
  // Never unlink writtenFiles on SIGINT: onFileWritten only fires after
  // installSkills fully completes; --repair handles an incomplete journal.
  const global = await resolveInteractiveGlobalInstructions({
    config, basePath: context.basePath, scope: context.scope, requested: context.options.globalInstructions,
  });
  if (global.cancelled) return;
  const result = executeInstall(context, config.lang, config.ides, global.value);
  showPostInstall(result, config.ides, config.lang, context.isFirstInstall);
}

export async function install(projectDir, options = {}) {
  const settings = parseInstallOptions(options);
  const userBasePath = homedir();
  const projectTarget = resolveProjectScopeTarget(projectDir);
  if (settings.project && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }

  // C-codex-1: corrupt/incomplete JSON must not throw before --repair routing.
  const userManifest = readManifestOrNull(userBasePath);
  const projectManifest = projectTarget.ok ? readManifestOrNull(projectTarget.path) : null;
  const initialLanguage = resolveInitialLanguage(settings.cliLang, userManifest, projectManifest);
  // P0-A: --repair routes by incomplete presence across both scopes.
  if (settings.repair) {
    runRepairMode({ projectDir, project: settings.project, projectTarget });
    return;
  }

  const scope = await resolveInstallScope({
    ...settings, initialLanguage, projectTarget, projectManifest, userManifest,
  });
  if (scope === 'project' && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }
  const basePath = scope === 'project' ? projectTarget.path : userBasePath;
  assertNoIncompleteTransaction(basePath);

  const existingManifest = readManifestOrNull(basePath);
  const isFirstInstall = !existingManifest;
  const isUpdate = !!existingManifest;
  const pkgVersion = getPackageVersion();
  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');
  // Adopt a pre-kernel legacy install before the Driver runs (T-F3-6).
  migrateLegacyInstall(basePath, MANIFEST_DIR);

  // Build initial config: CLI overrides > manifest > auto-detection > defaults.
  const language = resolveInstallLanguage(settings.cliLang, existingManifest, initialLanguage);
  const languageDetected = !settings.cliLang && !existingManifest?.language;
  const ides = normalizeIDESelection(resolveInstallIdes({
    allDetected: settings.allDetected, cliIDEs: settings.cliIDEs, existingManifest, basePath,
  }));
  validateCLIIDEs(settings.cliIDEs);
  warnLegacyCustomMemoryPath(existingManifest, language);

  // Legacy-namespace cleanup runs in both modes before the main install.
  const { safeOrphans, unsafeOrphans } = findInstallOrphans(basePath, metaDir);
  const context = {
    basePath, projectDir, language, languageDetected, ides, existingManifest, pkgVersion,
    skillsDir, metaDir, scope, settings, options, project: settings.project, projectTarget,
    safeOrphans, unsafeOrphans, isFirstInstall, isUpdate,
  };

  if (settings.yes) {
    runNonInteractiveInstall(context);
    return;
  }
  await runInteractiveInstall(context);
}
