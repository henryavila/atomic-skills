import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { IDE_CONFIG, getSkillPath, getSkillFormat, SKILL_NAMESPACE, getNamespaceRootPath } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { parse as parseYaml } from './yaml.js';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptModuleConfig, promptConflict,
  promptOrphanConflict, showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

function generateNamespaceRoot() {
  const desc = "Stop rewriting prompts. Install optimized developer skills in any AI IDE.";
  const escaped = desc.replace(/'/g, "''");
  return `---\nname: ${SKILL_NAMESPACE}\ndescription: '${escaped}'\nuser-invocable: false\n---\n\nNamespace package for Atomic Skills.\n`;
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
  const metaRaw = readFileSync(join(metaDir, 'skills.yaml'), 'utf8');
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

  // Helper to process a skill
  function processSkill(skillId, skillMeta, langDir, sourceType) {
    let sourceFile = join(skillsDir, language, langDir, `${skillId}.md`);
    let fallback = false;

    if (!existsSync(sourceFile)) {
      sourceFile = join(skillsDir, 'en', langDir, `${skillId}.md`);
      if (!existsSync(sourceFile)) return;
      fallback = true;
    }

    const rawContent = readFileSync(sourceFile, 'utf8');

    for (const ideId of ides) {
      const body = renderTemplate(rawContent, vars, moduleFlags, ideId);
      const format = getSkillFormat(ideId);
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body);
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

    if (fallback) {
      console.log(`  ⚠ ${skillMeta.name}: fallback to en (${language} not available)`);
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

  // Add .atomic-skills/ to .gitignore (skip for user scope)
  if (scope !== 'user') {
    const gitignorePath = join(projectDir, '.gitignore');
    let gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
    if (!gitignore.includes('.atomic-skills/')) {
      gitignore += (gitignore.endsWith('\n') || gitignore === '' ? '' : '\n') + '.atomic-skills/\n';
      writeFileSync(gitignorePath, gitignore, 'utf8');
    }
  }

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
  });

  return { files: createdFiles };
}

export function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function deduplicateGeminiCodex(ides) {
  if (ides.includes('gemini') && ides.includes('codex')) {
    const result = [...ides];
    result[result.indexOf('gemini')] = 'gemini-commands';
    return result;
  }
  return ides;
}

/**
 * Pre-render all files that installSkills would produce, without writing.
 * Returns a Map of relPath → rendered content string.
 */
function preRenderFiles(options) {
  const { language, ides, modules, skillsDir, metaDir } = options;

  const metaRaw = readFileSync(join(metaDir, 'skills.yaml'), 'utf8');
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

  function renderSkill(skillId, skillMeta, langDir) {
    let sourceFile = join(skillsDir, language, langDir, `${skillId}.md`);
    if (!existsSync(sourceFile)) {
      sourceFile = join(skillsDir, 'en', langDir, `${skillId}.md`);
      if (!existsSync(sourceFile)) return;
    }

    const rawContent = readFileSync(sourceFile, 'utf8');

    for (const ideId of ides) {
      const body = renderTemplate(rawContent, vars, moduleFlags, ideId);
      const format = getSkillFormat(ideId);
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body);
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

  // Generate namespace root SKILL.md for markdown-format IDEs
  for (const ideId of ides) {
    const rootPath = getNamespaceRootPath(ideId);
    if (!rootPath) continue;
    rendered.set(rootPath, generateNamespaceRoot());
  }

  return rendered;
}

export async function install(projectDir, options = {}) {
  const { yes = false, project = false, ide: cliIDEs = null, lang: cliLang = null } = options;

  const basePath = project ? projectDir : homedir();
  const existingManifest = readManifest(basePath);
  const isFirstInstall = !existingManifest;
  const isUpdate = !!existingManifest;
  const pkgVersion = getPackageVersion();
  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  // Build initial config: CLI overrides > manifest > auto-detection > defaults
  let language = cliLang || existingManifest?.language || detectLanguage();
  const languageDetected = !cliLang && !existingManifest?.language;

  let ides = cliIDEs || existingManifest?.ides?.slice() || detectIDEs(basePath);

  // Validate CLI-provided IDE IDs
  if (cliIDEs) {
    const validIDs = new Set(Object.keys(IDE_CONFIG));
    const invalid = cliIDEs.filter(id => !validIDs.has(id));
    if (invalid.length > 0) {
      const validList = Object.keys(IDE_CONFIG).filter(id => id !== 'gemini-commands').join(', ');
      console.error(`  Error: Unknown IDE(s): ${invalid.join(', ')}. Valid: ${validList}`);
      process.exit(1);
    }
  }

  ides = deduplicateGeminiCodex(ides);

  let modules = existingManifest?.modules ? JSON.parse(JSON.stringify(existingManifest.modules)) : {};
  if (isFirstInstall && !Object.values(modules).some(m => m.installed)) {
    const moduleYaml = parseYaml(readFileSync(join(skillsDir, 'modules', 'memory', 'module.yaml'), 'utf8'));
    modules = { memory: { installed: true, config: { memory_path: moduleYaml.variables.memory_path.default } } };
  }

  const scope = project ? 'project' : 'user';

  // ─── Non-interactive mode (--yes) ───
  if (yes) {
    if (ides.length === 0) {
      console.error(`  ${pc.red('Error:')} No IDEs detected. Use --ide to specify.`);
      process.exit(1);
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

  // If no IDEs detected, force selection
  if (config.ides.length === 0) {
    p.log.warn(msg(config.lang).noIDEsDetected);
    config.ides = await promptIDESelection(config.lang, []);
    if (config.ides.length === 0) {
      p.outro(msg(config.lang).cancelled);
      return;
    }
    config.ides = deduplicateGeminiCodex(config.ides);
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
      config.ides = deduplicateGeminiCodex(config.ides);
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
