import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { promptLanguage, promptIDEs, promptModule, promptConflict, promptOrphanConflict, promptScope, promptReconfigure } from './prompts.js';
import { parse as parseYaml } from './yaml.js';

const SIGINT_MESSAGES = {
  pt: '\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n',
  en: '\n  ⚛ Installation cancelled. No files kept.\n',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

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
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, ideId);
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

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
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
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, ideId);
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

  return rendered;
}

/**
 * Interactive install entry point.
 */
export async function install(projectDir, scope = null, force = false) {
  console.log('\n  ⚛ Atomic Skills — Stop rewriting prompts.\n');

  // Try reading manifest from both scopes to see if we have defaults
  const userManifest = readManifest(homedir());
  const projectManifest = readManifest(projectDir);
  const existingManifest = scope === 'user' ? userManifest : (projectManifest || userManifest);

  if (existingManifest) {
    const installedMods = Object.keys(existingManifest.modules || {}).filter(m => existingManifest.modules[m].installed);
    console.log(`  Configuração anterior encontrada (${MANIFEST_DIR}/manifest.json).`);
    console.log(`  Idioma: ${existingManifest.language} | IDEs: ${existingManifest.ides.join(', ')} | Módulos: ${installedMods.join(', ') || 'nenhum'}\n`);
  }

  // Always prompt language
  const language = await promptLanguage(existingManifest?.language);

  if (!scope) {
    scope = await promptScope(language, existingManifest?.scope || 'user');
  }

  const basePath = scope === 'user' ? homedir() : projectDir;
  
  const ides0 = await promptIDEs(language, scope, existingManifest?.ides || []);
  let ides = ides0;

  // Load module configs
  const moduleYamlPath = join(PACKAGE_ROOT, 'skills', 'modules', 'memory', 'module.yaml');
  const moduleConfig = parseYaml(readFileSync(moduleYamlPath, 'utf8'));
  const moduleScope = moduleConfig.scope || 'both';

  const modules = {};

  // Only show module if its scope is compatible
  if (moduleScope === 'both' || moduleScope === scope) {
    const msg = language === 'pt' ? '─── Módulos opcionais ───' : '─── Optional Modules ───';
    console.log(`\n  ${msg}`);

    const moduleDefaults = existingManifest?.modules?.memory?.installed ? existingManifest.modules.memory.config : null;
    const moduleResult = await promptModule(language, moduleConfig, moduleDefaults);
    if (moduleResult) {
      modules.memory = { installed: true, config: moduleResult };
    } else {
      modules.memory = { installed: false };
    }
  }

  console.log('\n  Instalando...');

  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  // Conflict detection
  const filesToRestore = new Map();
  if (existingManifest && !force) {
    const newRendered = preRenderFiles({ language, ides, modules, skillsDir, metaDir });

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

      if (localUnchanged && packageUnchanged) {
        continue;
      } else if (localUnchanged && !packageUnchanged) {
        continue;
      } else if (!localUnchanged && packageUnchanged) {
        // Local edit, package unchanged — keep local silently
        filesToRestore.set(filePath, currentContent);
      } else {
        // Both changed — conflict, ask user
        let action = await promptConflict(language, filePath);
        while (action === 'diff') {
          console.log('\n  --- Current (on disk) ---');
          console.log(currentContent);
          console.log('\n  --- New (from package) ---');
          console.log(newContent);
          action = await promptConflict(language, filePath);
        }
        if (action === 'keep') {
          filesToRestore.set(filePath, currentContent);
        }
      }
    }
  }

  const writtenFiles = [];
  const cleanup = () => {
    for (const f of writtenFiles) {
      try { unlinkSync(join(basePath, f)); } catch {}
    }
    const msg = SIGINT_MESSAGES[language] || SIGINT_MESSAGES.en;
    console.log(msg);
    process.exitCode = 1;
    process.kill(process.pid, 'SIGINT');
  };
  process.on('SIGINT', cleanup);

  let result;
  try {
    result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope }, {
      onFileWritten: (path) => writtenFiles.push(path),
    });
  } finally {
    process.removeListener('SIGINT', cleanup);
  }

  // Restore files user chose to keep
  for (const [filePath, content] of filesToRestore) {
    writeFileSync(join(basePath, filePath), content, 'utf8');
  }

  // Patch manifest hashes for kept files
  if (filesToRestore.size > 0) {
    const manifest = readManifest(basePath);
    for (const filePath of filesToRestore.keys()) {
      const keptContent = filesToRestore.get(filePath);
      if (manifest.files[filePath]) {
        manifest.files[filePath].installed_hash = hashContent(keptContent);
      }
    }
    writeManifest(basePath, manifest);
  }

  // Orphan removal
  let removedCount = 0;
  if (existingManifest) {
    const newPaths = new Set(result.files.map(f => f.path));
    const orphanEntries = Object.entries(existingManifest.files).filter(([path]) => !newPaths.has(path));

    for (const [oldPath, manifestEntry] of orphanEntries) {
      const absPath = join(basePath, oldPath);
      if (existsSync(absPath)) {
        const currentContent = readFileSync(absPath, 'utf8');
        const currentHash = hashContent(currentContent);
        const wasModified = currentHash !== manifestEntry.installed_hash;

        let shouldRemove = true;
        if (wasModified && !force) {
          let action = await promptOrphanConflict(language, oldPath);
          while (action === 'diff') {
            console.log('\n  --- Current (orphan on disk) ---');
            console.log(currentContent);
            action = await promptConflict(language, oldPath);
          }
          if (action === 'keep') {
            shouldRemove = false;
          }
        }

        if (shouldRemove) {
          unlinkSync(absPath);
          removedCount++;
          
          let parent = dirname(absPath);
          while (parent !== basePath && parent !== '.') {
            try {
              if (readdirSync(parent).length === 0) {
                rmdirSync(parent);
                parent = dirname(parent);
              } else {
                break;
              }
            } catch {
              break;
            }
          }
        }
      }
    }
  }

  // Final Report
  const isPt = language === 'pt';
  const labels = {
    reportTitle: isPt ? '[Relatório de Instalação]' : '[Installation Report]',
    scope: isPt ? 'Escopo:' : 'Scope:',
    language: isPt ? 'Idioma:' : 'Language:',
    ides: isPt ? 'IDEs:' : 'IDEs:',
    modules: isPt ? 'Módulos:' : 'Modules:',
    cleanup: isPt ? 'Limpeza:' : 'Cleanup:',
    summaryTitle: isPt ? '[Resumo por IDE]' : '[Summary per IDE]',
    filesInstalled: isPt ? 'arquivos instalados com sucesso.' : 'files installed successfully.',
    manifestUpdated: isPt ? 'Manifest atualizado em' : 'Manifest updated at',
    ready: isPt ? '⚛ Atomic Skills pronto para uso!' : '⚛ Atomic Skills ready to use!',
    removed: isPt ? 'arquivos antigos removidos' : 'old files removed',
    global: isPt ? 'Usuário (global)' : 'User (global)',
    project: isPt ? 'Projeto (local)' : 'Project (local)',
    skillsIn: isPt ? 'skills em' : 'skills in',
  };

  console.log(`\n  ${labels.reportTitle}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${labels.scope.padEnd(10)} ${scope === 'user' ? labels.global : labels.project}`);
  console.log(`  ${labels.language.padEnd(10)} ${isPt ? 'Português (BR)' : 'English'}`);
  console.log(`  ${labels.ides.padEnd(10)} ${ides.map(id => IDE_CONFIG[id].name).join(', ')}`);
  
  const activeModules = Object.keys(modules).filter(m => modules[m].installed);
  if (activeModules.length > 0) {
    const modNames = activeModules.map(m => m.charAt(0).toUpperCase() + m.slice(1));
    console.log(`  ${labels.modules.padEnd(10)} ${modNames.join(', ')}`);
  }

  if (removedCount > 0) {
    console.log(`  ${labels.cleanup.padEnd(10)} ${removedCount} ${labels.removed}`);
  }

  console.log(`\n  ${labels.summaryTitle}`);
  for (const id of ides) {
    const cfg = IDE_CONFIG[id];
    const ideFiles = result.files.filter(f => f.path.startsWith(cfg.dir.split('/')[0]));
    const skillCount = new Set(ideFiles.map(f => f.source)).size;
    console.log(`  • ${cfg.name}: ${skillCount} ${labels.skillsIn} ${cfg.dir}/`);
  }

  // Warning for duplicate Gemini profiles
  if (ides.includes('gemini') && ides.includes('codex')) {
    const warn = language === 'pt' 
      ? '  ⚠ Ambos perfis Gemini e Codex instalados. O Gemini CLI pode se confundir.' 
      : '  ⚠ Both Gemini and Codex profiles installed. Gemini CLI might get confused.';
    console.log(`\n${warn}`);
  }

  console.log('  ' + '─'.repeat(50));
  console.log(`  ✓ ${result.files.length} ${labels.filesInstalled}`);
  console.log(`  ✓ ${labels.manifestUpdated} ${join(basePath, MANIFEST_DIR, 'manifest.json')}`);
  console.log(`\n  ${labels.ready}\n`);
}
