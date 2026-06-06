import { readFileSync, writeFileSync, copyFileSync, cpSync, mkdirSync, existsSync, unlinkSync, rmSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS, getSkillPath, getSkillFormat,
  SKILL_NAMESPACE, getNamespaceRootPath, normalizeIDESelection,
  LEGACY_NAMESPACE_PATHS,
} from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { parse as parseYaml } from 'yaml';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import { resolveProjectScopeTarget } from './scope.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptModuleConfig, promptInstallScope, promptConflict,
  promptOrphanConflict, showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';

export { resolveProjectScopeTarget } from './scope.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

function installRuntimeArtifacts() {
  const aideckBundle = join(PACKAGE_ROOT, 'dist', 'aideck.mjs');
  if (existsSync(aideckBundle)) {
    const binDir = join(homedir(), '.atomic-skills', 'bin');
    mkdirSync(binDir, { recursive: true });
    copyFileSync(aideckBundle, join(binDir, 'aideck.mjs'));
  }

  const dashboardSrc = join(PACKAGE_ROOT, 'dist', 'dashboard');
  const dashboardDest = join(homedir(), '.atomic-skills', 'dashboard');
  if (existsSync(join(dashboardSrc, 'index.html'))) {
    if (existsSync(dashboardDest)) rmSync(dashboardDest, { recursive: true, force: true });
    cpSync(dashboardSrc, dashboardDest, { recursive: true });
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

  for (const file of [join(root, 'bin', 'aideck.mjs'), join(root, 'src', 'provision-consumer.js')]) {
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
 * Reverse of installAutoUpdateHook()'s settings.json merge: remove ONLY the
 * SessionStart command entry pointing at our version-check.sh, preserving every
 * other hook and setting. Prunes matcher entries / SessionStart / hooks that
 * become empty as a result. Never deletes settings.json itself.
 *
 * No-op when settings.json is missing, unparseable, or the entry is absent.
 *
 * `basePath` is the install base (homedir for user scope, repo root for project
 * scope); both the settings path and the hook script path derive from it, which
 * is why a single basePath suffices for either scope.
 */
export function removeAutoUpdateHook({ basePath, settingsCreated = false }) {
  const destScript = join(basePath, '.atomic-skills', 'hooks', 'version-check.sh');
  const settingsPath = join(basePath, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    return; // Don't clobber an unparseable user file.
  }

  const sessionStart = settings?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) return;

  let changed = false;
  for (const entry of sessionStart) {
    if (!entry || !Array.isArray(entry.hooks)) continue;
    const before = entry.hooks.length;
    entry.hooks = entry.hooks.filter(
      (h) => !(h && h.type === 'command' && h.command === destScript)
    );
    if (entry.hooks.length !== before) changed = true;
  }
  if (!changed) return;

  // Prune matcher entries that no longer hold any hooks, then prune the
  // SessionStart array and the hooks root if they end up empty.
  settings.hooks.SessionStart = sessionStart.filter(
    (e) => e && Array.isArray(e.hooks) && e.hooks.length > 0
  );
  if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;

  // Delete the file only if the installer created it AND removing our hook
  // emptied it. Otherwise preserve the user's file (which may legitimately be {}).
  if (Object.keys(settings).length === 0 && settingsCreated) {
    unlinkSync(settingsPath);
    const claudeDir = dirname(settingsPath);
    try { if (readdirSync(claudeDir).length === 0) rmdirSync(claudeDir); } catch {}
  } else {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }
}

function generateNamespaceRoot() {
  const desc = "Stop rewriting prompts. Install optimized developer skills in any AI IDE.";
  const escaped = desc.replace(/'/g, "''");
  return `---\nname: ${SKILL_NAMESPACE}\ndescription: '${escaped}'\nuser-invocable: false\n---\n\nNamespace package for Atomic Skills.\n`;
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
 * Core install logic (non-interactive, testable).
 * @param {string} projectDir
 * @param {object} options - { language, ides, modules, skillsDir, metaDir }
 * @param {object} [callbacks] - { onFileWritten }
 */
export function installSkills(projectDir, options, callbacks = {}) {
  const { language, ides, modules, skillsDir, metaDir, scope } = options;
  const { onFileWritten } = callbacks;

  // Load skill metadata
  const metaRaw = readFileSync(join(metaDir, 'catalog.yaml'), 'utf8');
  const meta = parseYaml(metaRaw);

  // Build variables and module flags
  const vars = {};
  const moduleFlags = {};
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (modConfig.installed) {
      moduleFlags[modName] = true;
      for (const [varName, varValue] of Object.entries(modConfig.config || {})) {
        vars[varName] = varValue;
      }
    }
  }

  const createdFiles = [];
  const manifestMeta = {};

  // Skill bodies receive the communication-language directive (renderTemplate prepends it
  // when COMMUNICATION_LANGUAGE is set). Shared assets (templates, snippets, config inputs)
  // must NOT receive that directive — they are inputs to skills, not skill bodies.
  // Keep `vars` clean for shared-asset rendering; build a per-call `skillVars` for skill bodies.
  const skillVars = { ...vars, COMMUNICATION_LANGUAGE: language };

  // Helper to process a skill
  function processSkill(skillId, skillMeta, langDir, sourceType) {
    const sourceFile = join(skillsDir, langDir, `${skillId}.md`);
    if (!existsSync(sourceFile)) return;

    const rawContent = readFileSync(sourceFile, 'utf8');

    for (const ideId of ides) {
      const body = renderTemplate(rawContent, skillVars, moduleFlags, ideId);
      const format = getSkillFormat(ideId);
      const renderOpts = skillMeta.argument_hint ? { argumentHint: skillMeta.argument_hint } : {};
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, renderOpts);
      const relPath = getSkillPath(ideId, skillMeta.name);
      const absPath = join(projectDir, relPath);

      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, content, 'utf8');
      if (onFileWritten) onFileWritten(relPath);

      createdFiles.push({
        path: relPath,
        hash: hashContent(content),
        source: sourceType,
      });
    }
  }

  // Process core skills
  for (const [skillId, skillMeta] of Object.entries(meta.core || {})) {
    processSkill(skillId, skillMeta, 'core', `core/${skillId}`);
  }

  // Process module skills
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (!modConfig.installed) continue;
    const modMeta = meta.modules?.[modName];
    if (!modMeta) continue;

    for (const [skillId, skillMeta] of Object.entries(modMeta)) {
      processSkill(skillId, skillMeta, `modules/${modName}`, `modules/${modName}/${skillId}`);
    }
  }

  // Process shared assets (templates etc shared across skills).
  // An asset directory `<name>-assets/` is installed when `<name>` is a registered
  // module OR a registered core skill. Without the core-skill branch, assets like
  // `project-assets/` (referenced by the `project` skill body) would
  // never be copied into the IDE asset path.
  const sharedDir = join(skillsDir, 'shared');
  if (existsSync(sharedDir)) {
    const sharedEntries = readdirSync(sharedDir, { withFileTypes: true });
    for (const entry of sharedEntries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.endsWith('-assets')) continue;
      const ownerName = entry.name.slice(0, -'-assets'.length);
      const isModule = meta.modules && meta.modules[ownerName];
      const isCoreSkill = meta.core && meta.core[ownerName];
      if (!isModule && !isCoreSkill) continue;

      const assetsSourceDir = join(sharedDir, entry.name);
      const assetFiles = readdirSync(assetsSourceDir, { withFileTypes: true });

      for (const ideId of ides) {
        const ide = IDE_CONFIG[ideId];
        const destBase = ide.format === 'toml'
          ? join(projectDir, ide.dir, `${SKILL_NAMESPACE}-_assets`)
          : join(projectDir, ide.dir, SKILL_NAMESPACE, '_assets');

        mkdirSync(destBase, { recursive: true });

        // Helper: render + write one asset file, tracking it in the manifest.
        const writeAsset = (srcPath, destPath, srcLabel) => {
          const raw = readFileSync(srcPath, 'utf8');
          const rendered = renderTemplate(raw, vars, moduleFlags, ideId);
          writeFileSync(destPath, rendered, 'utf8');
          const relPath = relative(projectDir, destPath);
          if (onFileWritten) onFileWritten(relPath);
          createdFiles.push({ path: relPath, hash: hashContent(rendered), source: srcLabel });
        };

        for (const f of assetFiles) {
          if (f.isDirectory()) {
            // Recurse ONE level into subdirs (e.g. `hooks/`). The loop was
            // previously files-only, which silently dropped enforcement hook
            // scripts from `_assets/` even though setup flows reference
            // `{{ASSETS_PATH}}/hooks/...`. Each nested file is rendered + tracked
            // so the manifest (and uninstall) stays coherent.
            const subSrc = join(assetsSourceDir, f.name);
            const subDest = join(destBase, f.name);
            mkdirSync(subDest, { recursive: true });
            for (const sf of readdirSync(subSrc, { withFileTypes: true })) {
              if (!sf.isFile()) continue;
              writeAsset(join(subSrc, sf.name), join(subDest, sf.name), `_assets/${entry.name}/${f.name}/${sf.name}`);
            }
            continue;
          }
          if (!f.isFile()) continue;
          writeAsset(join(assetsSourceDir, f.name), join(destBase, f.name), `_assets/${entry.name}/${f.name}`);
        }
      }
    }
  }

  // Install auto-update hook if module is registered
  if (meta.modules?.['auto-update']) {
    installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles, manifestMeta });
  }

  // Generate namespace root SKILL.md for markdown-format IDEs
  for (const ideId of ides) {
    const rootPath = getNamespaceRootPath(ideId);
    if (!rootPath) continue;

    const content = generateNamespaceRoot();
    const absPath = join(projectDir, rootPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, 'utf8');
    if (onFileWritten) onFileWritten(rootPath);

    createdFiles.push({
      path: rootPath,
      hash: hashContent(content),
      source: '_namespace',
    });
  }

  // NOTE: the installer deliberately does NOT touch .gitignore. The
  // .atomic-skills/ project-tracking tree (plans, phases, reviews, status) is
  // meant to be versioned in git alongside the code it tracks, so adding an
  // ignore line here would fight that. Consumers who prefer to keep it local
  // can add their own ignore entry. (Reversed 2026-06-05.)

  // Write manifest
  const filesMap = {};
  for (const f of createdFiles) {
    filesMap[f.path] = { installed_hash: f.hash, source: f.source };
  }

  writeManifest(projectDir, {
    version: getPackageVersion(),
    language,
    ides,
    modules,
    files: filesMap,
    settingsCreated: manifestMeta.settingsCreated ?? false,
  });

  return { files: createdFiles };
}

export function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

/**
 * Install the auto-update SessionStart hook.
 * Copies version-check.sh to ~/.atomic-skills/hooks/ (or project equivalent)
 * and merges hook config into ~/.claude/settings.json without destroying
 * existing entries.
 */
export function installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles, manifestMeta }) {
  const sourceScript = join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh');
  if (!existsSync(sourceScript)) return;

  const stateDir = scope === 'project'
    ? join(projectDir, '.atomic-skills')
    : join(homedir(), '.atomic-skills');
  const hooksDir = join(stateDir, 'hooks');
  const destScript = join(hooksDir, 'version-check.sh');

  mkdirSync(hooksDir, { recursive: true });
  const scriptContent = readFileSync(sourceScript, 'utf8');
  writeFileSync(destScript, scriptContent, { mode: 0o755 });
  if (onFileWritten) onFileWritten(destScript.replace(projectDir + '/', ''));

  // Merge hook into settings.json (additive, non-destructive)
  const settingsPath = scope === 'project'
    ? join(projectDir, '.claude', 'settings.json')
    : join(homedir(), '.claude', 'settings.json');

  // Record whether the installer is creating settings.json from scratch, so a
  // later uninstall deletes only installer-created files (never a user's own).
  const settingsPreexisted = existsSync(settingsPath);
  if (manifestMeta) manifestMeta.settingsCreated = !settingsPreexisted;

  mkdirSync(dirname(settingsPath), { recursive: true });

  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }

  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];

  let matcherEntry = settings.hooks.SessionStart.find((e) => e.matcher === '*' || e.matcher == null);
  if (!matcherEntry) {
    matcherEntry = { matcher: '*', hooks: [] };
    settings.hooks.SessionStart.push(matcherEntry);
  }
  matcherEntry.hooks = matcherEntry.hooks || [];

  const alreadyPresent = matcherEntry.hooks.some(
    (h) => h && h.type === 'command' && h.command === destScript
  );
  if (!alreadyPresent) {
    matcherEntry.hooks.push({ type: 'command', command: destScript });
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  if (onFileWritten) onFileWritten(settingsPath.replace(projectDir + '/', ''));

  // Track for manifest (so uninstall can remove later)
  createdFiles.push({
    path: relative(projectDir, destScript) || destScript,
    hash: hashContent(scriptContent),
    source: '_hooks/version-check.sh',
  });
}

/**
 * Pre-render all files that installSkills would produce, without writing.
 * Returns a Map of relPath → rendered content string.
 */
function preRenderFiles(options) {
  const { language, ides, modules, skillsDir, metaDir } = options;

  const metaRaw = readFileSync(join(metaDir, 'catalog.yaml'), 'utf8');
  const meta = parseYaml(metaRaw);

  const vars = {};
  const moduleFlags = {};
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (modConfig.installed) {
      moduleFlags[modName] = true;
      for (const [varName, varValue] of Object.entries(modConfig.config || {})) {
        vars[varName] = varValue;
      }
    }
  }

  const rendered = new Map();

  // Mirror installSkills: skill bodies get COMMUNICATION_LANGUAGE; shared assets do not.
  // Without this, preRenderFiles would compute a different hash than installSkills wrote,
  // producing phantom conflicts on update.
  const skillVars = { ...vars, COMMUNICATION_LANGUAGE: language };

  function renderSkill(skillId, skillMeta, langDir) {
    const sourceFile = join(skillsDir, langDir, `${skillId}.md`);
    if (!existsSync(sourceFile)) return;

    const rawContent = readFileSync(sourceFile, 'utf8');

    for (const ideId of ides) {
      const body = renderTemplate(rawContent, skillVars, moduleFlags, ideId);
      const format = getSkillFormat(ideId);
      const renderOpts = skillMeta.argument_hint ? { argumentHint: skillMeta.argument_hint } : {};
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, renderOpts);
      const relPath = getSkillPath(ideId, skillMeta.name);
      rendered.set(relPath, content);
    }
  }

  for (const [skillId, skillMeta] of Object.entries(meta.core || {})) {
    renderSkill(skillId, skillMeta, 'core');
  }

  for (const [modName, modConfig] of Object.entries(modules)) {
    if (!modConfig.installed) continue;
    const modMeta = meta.modules?.[modName];
    if (!modMeta) continue;
    for (const [skillId, skillMeta] of Object.entries(modMeta)) {
      renderSkill(skillId, skillMeta, `modules/${modName}`);
    }
  }

  // Pre-render shared assets — mirror installSkills' core-skill + module branches.
  const sharedDir = join(skillsDir, 'shared');
  if (existsSync(sharedDir)) {
    const sharedEntries = readdirSync(sharedDir, { withFileTypes: true });
    for (const entry of sharedEntries) {
      if (!entry.isDirectory() || !entry.name.endsWith('-assets')) continue;
      const ownerName = entry.name.slice(0, -'-assets'.length);
      const isModule = meta.modules && meta.modules[ownerName];
      const isCoreSkill = meta.core && meta.core[ownerName];
      if (!isModule && !isCoreSkill) continue;
      const assetsSourceDir = join(sharedDir, entry.name);
      const assetFiles = readdirSync(assetsSourceDir, { withFileTypes: true });
      for (const ideId of ides) {
        const ide = IDE_CONFIG[ideId];
        const destBase = ide.format === 'toml'
          ? `${ide.dir}/${SKILL_NAMESPACE}-_assets`
          : `${ide.dir}/${SKILL_NAMESPACE}/_assets`;
        for (const f of assetFiles) {
          if (!f.isFile()) continue;
          const sourceFile = join(assetsSourceDir, f.name);
          const raw = readFileSync(sourceFile, 'utf8');
          const renderedContent = renderTemplate(raw, vars, moduleFlags, ideId);
          rendered.set(`${destBase}/${f.name}`, renderedContent);
        }
      }
    }
  }

  // Generate namespace root SKILL.md for markdown-format IDEs
  for (const ideId of ides) {
    const rootPath = getNamespaceRootPath(ideId);
    if (!rootPath) continue;
    rendered.set(rootPath, generateNamespaceRoot());
  }

  return rendered;
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

    const keepFiles = new Set();
    if (existingManifest) {
      const newRendered = preRenderFiles({ language, ides, modules, skillsDir, metaDir });
      for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
        const absPath = join(basePath, filePath);
        const newContent = newRendered.get(filePath);
        if (!newContent || !existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        const localChanged = currentHash !== manifestEntry.installed_hash;
        if (localChanged) keepFiles.add(filePath);
      }
    }

    const savedContent = new Map();
    for (const filePath of keepFiles) {
      const absPath = join(basePath, filePath);
      if (existsSync(absPath)) savedContent.set(filePath, readFileSync(absPath, 'utf8'));
    }

    const result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope });

    for (const [filePath, content] of savedContent) {
      writeFileSync(join(basePath, filePath), content, 'utf8');
    }

    if (keepFiles.size > 0) {
      const manifest = readManifest(basePath);
      for (const filePath of keepFiles) {
        const keptContent = savedContent.get(filePath);
        if (keptContent && manifest.files[filePath]) {
          manifest.files[filePath].installed_hash = hashContent(keptContent);
        }
      }
      writeManifest(basePath, manifest);
    }

    // Orphan removal (auto-remove unmodified, keep modified)
    if (existingManifest) {
      const newPaths = new Set(result.files.map(f => f.path));
      for (const [oldPath, manifestEntry] of Object.entries(existingManifest.files)) {
        if (newPaths.has(oldPath)) continue;
        const absPath = join(basePath, oldPath);
        if (!existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        if (currentHash === manifestEntry.installed_hash) {
          unlinkSync(absPath);
          let parent = dirname(absPath);
          while (parent !== basePath && parent !== '.') {
            try {
              if (readdirSync(parent).length === 0) { rmdirSync(parent); parent = dirname(parent); }
              else break;
            } catch { break; }
          }
        }
      }
    }

    installRuntimeArtifacts();
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

  // Pre-compute conflict count for dashboard display
  let conflictCount = 0;
  if (existingManifest) {
    const newRendered = preRenderFiles({ language: config.lang, ides: config.ides, modules: config.modules, skillsDir, metaDir });
    for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
      const absPath = join(basePath, filePath);
      const newContent = newRendered.get(filePath);
      if (!newContent || !existsSync(absPath)) continue;
      const currentHash = hashContent(readFileSync(absPath, 'utf8'));
      const newHash = hashContent(newContent);
      if (currentHash !== manifestEntry.installed_hash && manifestEntry.installed_hash !== newHash) {
        conflictCount++;
      }
    }
  }

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
    printConfig(config, conflictCount);
    action = await promptAction(config.lang, { isUpdate, hasConflicts: conflictCount > 0 });

    if (action === 'customize-lang') {
      config.lang = await promptLanguageSelection(config.lang);
      config.languageDetected = false;
    } else if (action === 'customize-ides') {
      config.ides = await promptIDESelection(config.lang, config.ides);
      config.ides = normalizeIDESelection(config.ides);
    } else if (action === 'customize-modules') {
      config.modules = await promptModuleConfig(config.lang, config.modules, moduleYaml);
      config.skillCount = countSkills(metaDir, config.modules);
    } else if (action === 'view-conflicts') {
      const newRendered = preRenderFiles({ language: config.lang, ides: config.ides, modules: config.modules, skillsDir, metaDir });
      for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
        const absPath = join(basePath, filePath);
        const newContent = newRendered.get(filePath);
        if (!newContent || !existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        const newHash = hashContent(newContent);
        if (currentHash !== manifestEntry.installed_hash && manifestEntry.installed_hash !== newHash) {
          p.log.warn(`${filePath}\n  ${config.lang === 'pt' ? 'Mudanças locais serão sobrescritas' : 'Local changes will be overwritten'}`);
        }
      }
    }
  } while (action !== 'install' && action !== 'quit');

  if (action === 'quit') {
    p.outro(msg(config.lang).cancelled);
    return;
  }

  // ─── 3-hash conflict detection ───
  const keepFiles = new Set();
  if (existingManifest) {
    const newRendered = preRenderFiles({ language: config.lang, ides: config.ides, modules: config.modules, skillsDir, metaDir });

    for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
      const absPath = join(basePath, filePath);
      const newContent = newRendered.get(filePath);
      if (!newContent || !existsSync(absPath)) continue;

      const newHash = hashContent(newContent);
      const installedHash = manifestEntry.installed_hash;
      const currentContent = readFileSync(absPath, 'utf8');
      const currentHash = hashContent(currentContent);

      const localUnchanged = currentHash === installedHash;
      const packageUnchanged = installedHash === newHash;

      if (localUnchanged) continue;
      if (!localUnchanged && packageUnchanged) {
        keepFiles.add(filePath);
        continue;
      }

      // Both changed — conflict, ask user
      let conflictAction = await promptConflict(config.lang, filePath);
      while (conflictAction === 'diff') {
        console.log('\n  --- Current (on disk) ---');
        console.log(currentContent);
        console.log('\n  --- New (from package) ---');
        console.log(newContent);
        conflictAction = await promptConflict(config.lang, filePath);
      }
      if (conflictAction === 'keep') keepFiles.add(filePath);
    }
  }

  // Save content of files user wants to keep
  const savedContent = new Map();
  for (const filePath of keepFiles) {
    const absPath = join(basePath, filePath);
    if (existsSync(absPath)) savedContent.set(filePath, readFileSync(absPath, 'utf8'));
  }

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

  // Restore files user chose to keep
  for (const [filePath, content] of savedContent) {
    writeFileSync(join(basePath, filePath), content, 'utf8');
  }

  // Patch manifest hashes for kept files
  if (keepFiles.size > 0) {
    const manifest = readManifest(basePath);
    for (const filePath of keepFiles) {
      const keptContent = savedContent.get(filePath);
      if (keptContent && manifest.files[filePath]) {
        manifest.files[filePath].installed_hash = hashContent(keptContent);
      }
    }
    writeManifest(basePath, manifest);
  }

  // Orphan removal
  if (existingManifest) {
    const newPaths = new Set(result.files.map(f => f.path));
    const orphanEntries = Object.entries(existingManifest.files).filter(([path]) => !newPaths.has(path));

    for (const [oldPath, manifestEntry] of orphanEntries) {
      const absPath = join(basePath, oldPath);
      if (!existsSync(absPath)) continue;

      const currentContent = readFileSync(absPath, 'utf8');
      const currentHash = hashContent(currentContent);
      const wasModified = currentHash !== manifestEntry.installed_hash;

      let shouldRemove = true;
      if (wasModified) {
        let orphanAction = await promptOrphanConflict(config.lang, oldPath);
        while (orphanAction === 'diff') {
          console.log('\n  --- Current (orphan on disk) ---');
          console.log(currentContent);
          orphanAction = await promptOrphanConflict(config.lang, oldPath);
        }
        if (orphanAction === 'keep') shouldRemove = false;
      }

      if (shouldRemove) {
        unlinkSync(absPath);
        let parent = dirname(absPath);
        while (parent !== basePath && parent !== '.') {
          try {
            if (readdirSync(parent).length === 0) { rmdirSync(parent); parent = dirname(parent); }
            else break;
          } catch { break; }
        }
      }
    }
  }

  showPostInstall(result, config.ides, config.lang, isFirstInstall);
}
