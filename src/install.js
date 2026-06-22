import { readFileSync, writeFileSync, copyFileSync, cpSync, mkdirSync, existsSync, unlinkSync, rmSync, rmdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS,
  SKILL_NAMESPACE, normalizeIDESelection,
  LEGACY_NAMESPACE_PATHS,
} from './config.js';
import { hashContent } from './hash.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { buildInstaller } from './installer.js';
import { computeSkillsFileSet } from './providers/skills-file-set.js';
import { migrateLegacyInstall } from './migrate-legacy-install.js';
import { parse as parseYaml } from 'yaml';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import { resolveProjectScopeTarget } from './scope.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptModuleConfig, promptInstallScope,
  showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';

export { resolveProjectScopeTarget } from './scope.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

/**
 * Resolves the installed @henryavila/aideck package directory, or null when it
 * is not installed (e.g. before the npm publish lands, or in a stripped
 * checkout). Pure; never throws.
 *
 * Uses a node_modules filesystem walk rather than require.resolve: the
 * published package is ESM-only and its `exports` map exposes neither
 * `./package.json` nor `./dist/cli.js` (and offers no `require` condition), so
 * CJS resolution throws ERR_PACKAGE_PATH_NOT_EXPORTED. Reading the dir off disk
 * sidesteps `exports` entirely.
 *
 * @returns {string|null}
 */
export function resolveAideckPackageDir() {
  let dir = PACKAGE_ROOT;
  for (;;) {
    const cand = join(dir, 'node_modules', '@henryavila', 'aideck');
    if (existsSync(join(cand, 'package.json'))) return cand;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Stages the global runtime artifacts under ~/.atomic-skills/.
 *
 * The aiDeck bin + dashboard client come from the published @henryavila/aideck
 * dependency (T-004 / doc 13 Phase D — the vendored single-file bundle was
 * dropped once aiDeck shipped to npm). We write a one-line launcher SHIM at
 * bin/aideck.mjs that re-execs the resolved dist/cli.js (an absolute import, so
 * node resolves the package's hoisted deps regardless of cwd), and copy the
 * package's dist/client to dashboard/. Both are skipped gracefully when the
 * dependency is not yet installed — the skill's status flow falls back to a
 * terminal view. The consumer template + provisioner are always staged from
 * this package's own assets/ + src/.
 *
 * @param {object} [opts]
 * @param {string|null} [opts.aideckDir] - override the resolved aiDeck package
 *   dir (testing seam); defaults to resolveAideckPackageDir().
 */
export function installRuntimeArtifacts({ aideckDir = resolveAideckPackageDir() } = {}) {
  if (aideckDir) {
    const cli = join(aideckDir, 'dist', 'cli.js');
    if (existsSync(cli)) {
      const binDir = join(homedir(), '.atomic-skills', 'bin');
      mkdirSync(binDir, { recursive: true });
      // The published cli.js only runs its CLI when
      // `import.meta.url === pathToFileURL(process.argv[1]).href` (cli.ts:392),
      // so the shim rewrites argv[1] to the resolved cli before importing it —
      // a bare `import` would load the module without firing the CLI.
      const cliLit = JSON.stringify(cli);
      const shim =
        '// atomic-skills launcher for the published @henryavila/aideck CLI.\n' +
        '// Rewrites argv[1] so the CLI entrypoint guard fires under\n' +
        '// `node aideck.mjs <args>`. Regenerated on every install.\n' +
        `process.argv[1] = ${cliLit}\n` +
        `await import(${cliLit})\n`;
      writeFileSync(join(binDir, 'aideck.mjs'), shim);
    }

    const clientSrc = join(aideckDir, 'dist', 'client');
    const dashboardDest = join(homedir(), '.atomic-skills', 'dashboard');
    if (existsSync(join(clientSrc, 'index.html'))) {
      if (existsSync(dashboardDest)) rmSync(dashboardDest, { recursive: true, force: true });
      cpSync(clientSrc, dashboardDest, { recursive: true });
    }
  }

  // aiDeck v2 consumer is provisioned PER-PROJECT (consumer id + title = the
  // consuming repo, NOT a fixed atomic-skills/Project Status) lazily by the
  // project skill's `status` flow — see src/provision-consumer.js + project-view.md.
  // aiDeck keys each consumer by its manifest.id, so running the skill in repo
  // `foo` yields ~/.aideck/consumers/foo/ titled "Foo".
  //
  // Install does NOT drop a fixed ~/.aideck/consumers/atomic-skills/ anymore (that
  // hardcoded identity was the bug). It only stages the TEMPLATE + the provisioner
  // in a stable runtime location so the lazy flow can resolve them from any repo
  // (the package's own assets/ + src/ also satisfy the global-npm resolver path).
  const consumerSrc = join(PACKAGE_ROOT, 'assets', 'aideck-consumer');
  if (existsSync(join(consumerSrc, 'manifest.yaml'))) {
    const tmplDest = join(homedir(), '.atomic-skills', 'aideck-consumer');
    if (existsSync(tmplDest)) rmSync(tmplDest, { recursive: true, force: true });
    cpSync(consumerSrc, tmplDest, { recursive: true });
  }
  const provSrc = join(PACKAGE_ROOT, 'src', 'provision-consumer.js');
  if (existsSync(provSrc)) {
    const srcDest = join(homedir(), '.atomic-skills', 'src');
    mkdirSync(srcDest, { recursive: true });
    copyFileSync(provSrc, join(srcDest, 'provision-consumer.js'));
  }

  // Record THIS package's root (the dir holding scripts/ AND its node_modules)
  // so the project hooks can resolve the runtime detectors from where they
  // actually run, WITH dependencies intact — instead of copying scripts/ here
  // dep-less (which would crash with ERR_MODULE_NOT_FOUND on `yaml`/`ajv`) or
  // silently never running for an `npx`/local install where neither the
  // consuming repo nor global-npm resolves them (F-002).
  if (existsSync(join(PACKAGE_ROOT, 'scripts', 'detect-completion.js'))) {
    const root = join(homedir(), '.atomic-skills');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'package-root'), PACKAGE_ROOT + '\n');
  }
}

/** Absolute path of the cross-install runtime registry (refcount file). */
function installsRegistryPath() {
  return join(homedir(), '.atomic-skills', 'installs.json');
}

/**
 * Record an install base path in the shared runtime registry (idempotent). The
 * global runtime artifacts under ~/.atomic-skills/ are shared across every
 * install (user + each project), so they must only be reclaimed once the LAST
 * install is gone — this registry is the refcount that makes that decision
 * honest (F-003). `basePath` is homedir() for a user install, the repo root for
 * a project install.
 */
export function registerInstall(basePath) {
  const p = installsRegistryPath();
  let list = [];
  try { const v = JSON.parse(readFileSync(p, 'utf8')); if (Array.isArray(v)) list = v; } catch {}
  if (!list.includes(basePath)) list.push(basePath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(list, null, 2) + '\n');
}

/**
 * Remove an install base path from the registry. Returns the number of installs
 * still registered AFTER removal. When it drops to 0 the registry file itself is
 * deleted (so $HOME returns to baseline). The caller reclaims the shared runtime
 * artifacts only when this returns 0 (F-003).
 */
export function unregisterInstall(basePath) {
  const p = installsRegistryPath();
  let list = [];
  try { const v = JSON.parse(readFileSync(p, 'utf8')); if (Array.isArray(v)) list = v; } catch {}
  const next = list.filter((b) => b !== basePath);
  if (next.length === 0) {
    try { unlinkSync(p); } catch {}
    return 0;
  }
  try { writeFileSync(p, JSON.stringify(next, null, 2) + '\n'); } catch {}
  return next.length;
}

/**
 * Reverse of installRuntimeArtifacts(): remove the global runtime artifacts
 * staged under ~/.atomic-skills/ (bin/aideck.mjs, dashboard/, aideck-consumer/,
 * src/provision-consumer.js). These are NOT manifest-tracked because they live
 * at a fixed user path regardless of install scope.
 *
 * Caller is responsible for scope-gating: these artifacts are shared across all
 * installs, so only a USER-scope uninstall should call this (a project uninstall
 * must leave them so other repos / the user install keep working).
 *
 * Never touches ~/.aideck/ — that holds the user's own provisioned consumer data
 * (plans, initiatives), which is data, not an install artifact.
 */
export function removeRuntimeArtifacts() {
  const root = join(homedir(), '.atomic-skills');

  for (const file of [
    join(root, 'bin', 'aideck.mjs'),
    join(root, 'src', 'provision-consumer.js'),
    join(root, 'package-root'),
  ]) {
    if (!existsSync(file)) continue;
    try { unlinkSync(file); } catch {}
    const parent = dirname(file);
    try { if (readdirSync(parent).length === 0) rmdirSync(parent); } catch {}
  }

  for (const dir of [join(root, 'dashboard'), join(root, 'aideck-consumer')]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Names that have historically been atomic-skills artifacts and are safe to
 * delete from legacy paths. F-002 (codex review 2026-05-24): without this
 * safelist, `--yes` cleanup would silently delete ANY file at a legacy
 * namespace path, including user-owned custom skills the user happened to
 * place under our namespace. Frontmatter-based safelist preserves those.
 *
 * Add removed skill names here when consolidating (so post-removal cleanups
 * still recognize the artifact as ours). Pre-1.x `as-` prefix is included.
 */
const HISTORICAL_ATOMIC_SKILLS_NAMES = new Set([
  // Removed in v2.0.0 consolidation
  'review-plan-internal', 'review-plan-vs-artifacts',
  'review-plan-with-codex', 'review-code-with-codex',
  // Removed in v2.0.0 consolidation (project-status + project-plan → project)
  'project-status', 'project-plan',
  // Pre-1.x prefix (original `as-` form, deprecated)
  'as-fix', 'as-hunt', 'as-prompt', 'as-save-and-push', 'as-init-memory',
  // Namespace root SKILL.md
  SKILL_NAMESPACE,
]);

/**
 * F-002 (review): inspect frontmatter for an atomic-skills signature.
 * Returns true if the file's first frontmatter block has a `name:` field
 * that matches a known atomic-skills name (current catalog or historical).
 * Files without atomic-skills shape are preserved during legacy cleanup.
 */
export function isAtomicSkillsArtifact(filePath, knownCurrentNames) {
  let head;
  try {
    head = readFileSync(filePath, 'utf8').slice(0, 4096);
  } catch {
    // Unreadable file → conservative: preserve.
    return false;
  }
  if (!head.startsWith('---\n')) return false;
  const end = head.indexOf('\n---\n', 4);
  if (end < 0) return false;
  const fm = head.slice(4, end);
  const m = fm.match(/^name:\s*['"]?([a-z][a-z0-9-]*)['"]?\s*$/m);
  if (!m) return false;
  const name = m[1];
  return knownCurrentNames.has(name) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(name);
}

/**
 * Scan obsolete install paths (see LEGACY_NAMESPACE_PATHS) for any file
 * still living under the atomic-skills namespace. These are invisible to
 * the manifest-based orphan detector because they predate the current
 * IDE_CONFIG. Returns [{path, legacyRoot, reason, safe}].
 *
 * `safe: true` means the file's frontmatter identifies it as a known
 * atomic-skills artifact (current or historical). `safe: false` means
 * the file is at the legacy path but does not look like an atomic-skills
 * artifact — likely user-owned, preserve it.
 */
export function findLegacyOrphans(basePath, knownCurrentNames = new Set()) {
  const found = [];
  for (const { dir, reason } of LEGACY_NAMESPACE_PATHS) {
    const nsRoot = join(basePath, dir, SKILL_NAMESPACE);
    if (!existsSync(nsRoot)) continue;
    const walk = (cur) => {
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        const full = join(cur, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) {
          const safe = isAtomicSkillsArtifact(full, knownCurrentNames);
          found.push({ path: full, legacyRoot: nsRoot, reason, safe });
        }
      }
    };
    walk(nsRoot);
  }
  return found;
}

/**
 * Delete each legacy-orphan file, then walk back up removing empty parents
 * until (and including) the namespace root. Never touches dirs above the
 * namespace root (e.g. .claude/skills/ itself may be co-owned with other
 * tools and is left in place).
 */
export function removeLegacyOrphans(basePath, orphans) {
  const nsRootsSeen = new Set();
  for (const { path: full, legacyRoot } of orphans) {
    try {
      unlinkSync(full);
    } catch (err) {
      // E1 (review 2026-05-24): surface deletion failures so the user knows
      // the cleanup was partial. Skip the parent walkback on failure too.
      console.warn(`[atomic-skills] could not remove legacy orphan ${full}: ${err.message}`);
      continue;
    }
    nsRootsSeen.add(legacyRoot);
    let parent = dirname(full);
    // L1 (review 2026-05-24): path-aware boundary check. A bare `startsWith`
    // would match `<legacyRoot>-sibling/...` directories with a common prefix.
    // Walk up only inside the namespace root (and stop AT the root).
    const legacyRootWithSep = legacyRoot + PATH_SEP;
    while (parent !== legacyRoot && parent.startsWith(legacyRootWithSep)) {
      try {
        if (readdirSync(parent).length === 0) {
          rmdirSync(parent);
          parent = dirname(parent);
        } else break;
      } catch { break; }
    }
  }
  // Try to remove each namespace root if it's now empty (siblings may have
  // been emptied by this call); the parent legacy dir is intentionally left.
  for (const nsRoot of nsRootsSeen) {
    try {
      if (readdirSync(nsRoot).length === 0) rmdirSync(nsRoot);
    } catch {}
  }
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
 * This function then patches the consumer METADATA (version/language/ides/modules)
 * and a DERIVED legacy `files` map onto the manifest: the journal (`effects`) stays
 * authoritative for uninstall, while the `files` map keeps the status/compat
 * readers working.
 *
 * @param {string} projectDir
 * @param {object} options - { language, ides, modules, skillsDir, metaDir, scope }
 * @param {object} [callbacks] - { onFileWritten }
 * @returns {{ files: Array<{ path: string, hash: string }> }}
 */
export function installSkills(projectDir, options, callbacks = {}) {
  const { language, ides, modules, skillsDir, metaDir, scope } = options;
  const { onFileWritten } = callbacks;

  const installer = buildInstaller({ language, ides, modules, skillsDir, metaDir, scope });
  installer.install({ projectDir });

  // Derive the return value + legacy compat files-map from the journal + the
  // file-set plan. The journal carries the authoritative installed hashes (on an
  // update, reconcileFileSet keeps a user-modified file under its ORIGINAL hash);
  // the file-set plan carries each file's `source` tag (core/x, _assets/...,
  // _namespace) for the post-install summary. The auto-update layer's
  // stageRuntimeArtifacts carries the executable hook (settings.json is a
  // jsonMerge, not a tracked "file" — mirroring the legacy createdFiles, which
  // excluded settings.json but included the hook).
  const journal = readManifest(projectDir);
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

  const createdFiles = [
    ...computeSkillsFileSet({ language, ides, modules, skillsDir, metaDir, scope })
      .map(({ path, source }) => ({ path, hash: hashByPath.get(path), source })),
    ...hookFiles,
  ];

  const filesMap = {};
  for (const { path, hash, source } of createdFiles) filesMap[path] = { installed_hash: hash, source };

  // Patch consumer metadata + the derived files map onto the journal manifest.
  writeManifest(projectDir, {
    ...journal,
    version: getPackageVersion(),
    language,
    ides,
    modules,
    files: filesMap,
  });

  if (onFileWritten) for (const f of createdFiles) onFileWritten(f.path);
  return { files: createdFiles };
}

export function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

export async function install(projectDir, options = {}) {
  const {
    yes = false,
    project = false,
    ide: cliIDEs = null,
    lang: cliLang = null,
    allDetected = false,
  } = options;

  const userBasePath = homedir();
  const projectTarget = resolveProjectScopeTarget(projectDir);

  if (project && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }

  const userManifest = readManifest(userBasePath);
  const projectManifest = projectTarget.ok ? readManifest(projectTarget.path) : null;
  const initialLanguage = cliLang || userManifest?.language || projectManifest?.language || detectLanguage();

  let scope = project ? 'project' : 'user';
  if (!yes && !project) {
    scope = await promptInstallScope(initialLanguage, {
      projectTarget,
      initialScope: projectManifest && !userManifest ? 'project' : 'user',
    });
  }

  if (scope === 'project' && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }

  const basePath = scope === 'project' ? projectTarget.path : userBasePath;
  const existingManifest = readManifest(basePath);
  const isFirstInstall = !existingManifest;
  const isUpdate = !!existingManifest;
  const pkgVersion = getPackageVersion();
  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  // Adopt a pre-kernel (legacy `{files:{}}`, no `effects`) install into journal
  // ownership records BEFORE the Driver runs (T-F3-6). Without this the Driver
  // would read no prior before-state and treat the update as a greenfield install,
  // clobbering files the user modified since the legacy install. No-op when there
  // is no install or the manifest is already a journal.
  migrateLegacyInstall(basePath, MANIFEST_DIR);

  // Build initial config: CLI overrides > manifest > auto-detection > defaults
  let language = cliLang || existingManifest?.language || initialLanguage;
  const languageDetected = !cliLang && !existingManifest?.language;

  let ides;
  if (allDetected) {
    if (existingManifest?.ides?.length) {
      console.log(`  ${pc.dim('Re-detecting IDEs from filesystem (ignoring manifest selection).')}`);
    }
    ides = detectIDEs(basePath);
  } else {
    ides = cliIDEs || existingManifest?.ides?.slice() || detectIDEs(basePath);
  }

  // Validate CLI-provided IDE IDs
  if (cliIDEs) {
    const validIDs = new Set(Object.keys(IDE_CONFIG));
    const invalid = cliIDEs.filter(id => !validIDs.has(id));
    if (invalid.length > 0) {
      const validList = PUBLIC_IDE_IDS.join(', ');
      console.error(`  Error: Unknown IDE(s): ${invalid.join(', ')}. Valid: ${validList}`);
      process.exit(1);
    }
  }

  ides = normalizeIDESelection(ides);

  let modules = existingManifest?.modules ? JSON.parse(JSON.stringify(existingManifest.modules)) : {};
  if (isFirstInstall && !Object.values(modules).some(m => m.installed)) {
    const moduleYaml = parseYaml(readFileSync(join(skillsDir, 'modules', 'memory', 'module.yaml'), 'utf8'));
    modules = { memory: { installed: true, config: { memory_path: moduleYaml.variables.memory_path.default } } };
  }

  // ─── Legacy-namespace cleanup (runs in both modes, before main install) ───
  // Removes files at obsolete install paths (see LEGACY_NAMESPACE_PATHS)
  // that the manifest can't track because they predate the current
  // IDE_CONFIG. F-002 (codex review): files at the legacy path that do NOT
  // look like atomic-skills artifacts are preserved (could be user-owned
  // content placed under our namespace). Only files matching the
  // frontmatter safelist are auto-removed.
  const catalogForCleanup = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
  const knownCurrentNames = new Set(
    [...Object.keys(catalogForCleanup?.core || {}),
     ...Object.values(catalogForCleanup?.modules || {})
       .filter((m) => m && typeof m === 'object')
       .flatMap((m) => Object.keys(m))]
  );
  const legacyOrphans = findLegacyOrphans(basePath, knownCurrentNames);
  const safeOrphans = legacyOrphans.filter((o) => o.safe);
  const unsafeOrphans = legacyOrphans.filter((o) => !o.safe);

  // ─── Non-interactive mode (--yes) ───
  if (yes) {
    if (ides.length === 0) {
      console.error(`  ${pc.red('Error:')} No IDEs detected. Use --ide to specify.`);
      process.exit(1);
    }

    if (safeOrphans.length > 0) {
      console.log(`  ${pc.dim(`Cleaning ${safeOrphans.length} legacy orphan file(s) at obsolete install path(s):`)}`);
      for (const o of safeOrphans) {
        console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
      }
      removeLegacyOrphans(basePath, safeOrphans);
    }
    if (unsafeOrphans.length > 0) {
      console.log(`  ${pc.yellow(`Preserved ${unsafeOrphans.length} file(s) at legacy path that don't look like atomic-skills artifacts (no recognized frontmatter \`name:\`):`)}`);
      for (const o of unsafeOrphans) {
        console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
      }
      console.log(`  ${pc.dim('Inspect manually and remove if intended.')}`);
    }

    console.log(`◇ ${msg(language).installingMsg(pkgVersion)}`);

    // The Driver's reconcileFileSet runs the 3-hash no-clobber update (files the
    // user modified survive) and removes unmodified orphans — what the bespoke
    // keepFiles/savedContent/orphan logic used to do, now a property of the effect.
    const result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope });

    installRuntimeArtifacts();
    registerInstall(basePath);
    showNonInteractiveResult(result, ides, language);
    return;
  }

  // ─── Interactive mode (dashboard) ───
  const config = {
    lang: language,
    languageDetected,
    ides: [...ides],
    modules,
    project,
    scope,
    scopePath: scope === 'project' ? basePath : '~/',
    projectTarget,
    existingVersion: existingManifest?.version,
    skillCount: countSkills(metaDir, modules),
  };

  const moduleYaml = parseYaml(readFileSync(join(skillsDir, 'modules', 'memory', 'module.yaml'), 'utf8'));

  showIntro(config, { isUpdate, pkgVersion });

  // Surface legacy-namespace orphans (obsolete install paths) and prompt
  // for cleanup before the regular action loop. F-002 (codex review):
  // safe vs unsafe split by frontmatter signature — only safe ones offered
  // for delete; unsafe ones logged for user inspection.
  if (safeOrphans.length > 0) {
    const isPt = config.lang === 'pt';
    p.log.warn(
      isPt
        ? `${safeOrphans.length} arquivo(s) órfão(s) atomic-skills encontrado(s) em caminhos antigos:`
        : `Found ${safeOrphans.length} atomic-skills orphan file(s) at obsolete install path(s):`
    );
    for (const o of safeOrphans) {
      p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}  ${pc.dim(`(${o.reason})`)}`);
    }
    const removeOrphans = await p.confirm({
      message: isPt ? 'Remover esses arquivos?' : 'Remove these files?',
      initialValue: true,
    });
    if (p.isCancel(removeOrphans)) {
      p.outro(msg(config.lang).cancelled);
      return;
    }
    if (removeOrphans) {
      removeLegacyOrphans(basePath, safeOrphans);
      p.log.success(
        isPt ? `${safeOrphans.length} arquivo(s) órfão(s) removido(s).`
             : `Removed ${safeOrphans.length} orphan file(s).`
      );
    }
  }
  if (unsafeOrphans.length > 0) {
    const isPt = config.lang === 'pt';
    p.log.warn(
      isPt
        ? `${unsafeOrphans.length} arquivo(s) preservado(s) em caminhos antigos (sem assinatura atomic-skills no frontmatter):`
        : `Preserved ${unsafeOrphans.length} file(s) at legacy path(s) without atomic-skills frontmatter signature:`
    );
    for (const o of unsafeOrphans) {
      p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}`);
    }
    p.log.message(
      isPt
        ? `  ${pc.dim('Inspecione e remova manualmente se for o caso.')}`
        : `  ${pc.dim('Inspect and remove manually if intended.')}`
    );
  }

  // If no IDEs detected, force selection
  if (config.ides.length === 0) {
    p.log.warn(msg(config.lang).noIDEsDetected);
    config.ides = await promptIDESelection(config.lang, []);
    if (config.ides.length === 0) {
      p.outro(msg(config.lang).cancelled);
      return;
    }
    config.ides = normalizeIDESelection(config.ides);
  }

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
    } else if (action === 'customize-modules') {
      config.modules = await promptModuleConfig(config.lang, config.modules, moduleYaml);
      config.skillCount = countSkills(metaDir, config.modules);
    }
  } while (action !== 'install' && action !== 'quit');

  if (action === 'quit') {
    p.outro(msg(config.lang).cancelled);
    return;
  }

  // No bespoke conflict/orphan handling: the Driver's reconcileFileSet keeps the
  // user's modified files (no-clobber, P3) and removes only unmodified orphans.

  // SIGINT handler
  const writtenFiles = [];
  const cleanup = () => {
    for (const f of writtenFiles) {
      try { unlinkSync(join(basePath, f)); } catch {}
    }
    console.log(config.lang === 'pt'
      ? '\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n'
      : '\n  ⚛ Installation cancelled. No files kept.\n');
    process.exitCode = 1;
    process.kill(process.pid, 'SIGINT');
  };
  process.on('SIGINT', cleanup);

  let result;
  try {
    result = installSkills(basePath, {
      language: config.lang,
      ides: config.ides,
      modules: config.modules,
      skillsDir,
      metaDir,
      scope,
    }, {
      onFileWritten: (path) => writtenFiles.push(path),
    });
  } finally {
    process.removeListener('SIGINT', cleanup);
  }

  // Install aideck bundle + dashboard to ~/.atomic-skills/
  installRuntimeArtifacts();
  registerInstall(basePath);

  showPostInstall(result, config.ides, config.lang, isFirstInstall);
}
