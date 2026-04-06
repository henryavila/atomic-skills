import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { IDE_CONFIG, getSkillPath, getSkillFormat, SKILL_NAMESPACE, getNamespaceRootPath } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { promptLanguage, promptIDEs, promptModule, promptReuseConfig, promptConflict, promptOrphanConflict, promptScope, promptReconfigure } from './prompts.js';
import { parse as parseYaml } from './yaml.js';

const SIGINT_MESSAGES = {
  pt: '\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n',
  en: '\n  ⚛ Installation cancelled. No files kept.\n',
};

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

/**
 * Interactive install entry point.
 */
export async function install(projectDir, scope = null) {
  console.log('\n  ⚛ Atomic Skills — Stop rewriting prompts.\n');

  // Always prompt language first (needed for scope prompt localization)
  const language0 = await promptLanguage();
  if (!scope) {
    scope = await promptScope(language0);
  }

  const basePath = scope === 'user' ? homedir() : projectDir;
  const existingManifest = readManifest(basePath);

  let language = language0;
  let ides, modules;

  if (existingManifest) {
    const installedMods = Object.keys(existingManifest.modules || {}).filter(m => existingManifest.modules[m].installed);
    console.log(`  Configuração anterior encontrada (${MANIFEST_DIR}/manifest.json).`);
    console.log(`  Idioma: ${existingManifest.language} | IDEs: ${existingManifest.ides.join(', ')} | Módulos: ${installedMods.join(', ') || 'nenhum'}\n`);

    const reuse = await promptReuseConfig(existingManifest.language);
    if (reuse) {
      // Check for Gemini/Codex conflict in the existing config
      if (scope === 'user' && existingManifest.ides.includes('gemini') && existingManifest.ides.includes('codex')) {
        console.log(existingManifest.language === 'pt' 
          ? '\n  ⚠ Atenção: Sua configuração atual tem conflitos (Gemini CLI + Codex no escopo global).'
          : '\n  ⚠ Warning: Your current configuration has conflicts (Gemini CLI + Codex in user scope).');
        const reconfig = await promptReconfigure(existingManifest.language);
        if (reconfig) {
          // Fall through to prompts
        } else {
          language = existingManifest.language;
          ides = existingManifest.ides;
          modules = existingManifest.modules;
        }
      } else {
        language = existingManifest.language;
        ides = existingManifest.ides;
        modules = existingManifest.modules;
      }
    }
  }

  if (!ides) {
    ides = await promptIDEs(language, scope);

    // Smart Deduplication for Gemini + Codex
    // If both are selected, we switch Gemini to 'gemini-commands' (TOML)
    // to avoid the "Skill conflict" warning while keeping native optimizations.
    if (ides.includes('gemini') && ides.includes('codex')) {
      const idx = ides.indexOf('gemini');
      ides[idx] = 'gemini-commands';
      
      console.log(language === 'pt'
        ? '\n  💡 Otimização detectada: Instalando Gemini como "Commands" (TOML) e Codex como "Skills" (Markdown).'
        : '\n  💡 Optimization detected: Installing Gemini as "Commands" (TOML) and Codex as "Skills" (Markdown).');
      console.log(language === 'pt'
        ? '  Isso permite usar ambos simultaneamente sem avisos de conflito.\n'
        : '  This allows using both simultaneously without conflict warnings.\n');
    }

    // Load module configs
    const moduleYamlPath = join(PACKAGE_ROOT, 'skills', 'modules', 'memory', 'module.yaml');
    const moduleConfig = parseYaml(readFileSync(moduleYamlPath, 'utf8'));
    const moduleScope = moduleConfig.scope || 'both';

    modules = {};

    // Only show module if its scope is compatible
    if (moduleScope === 'both' || moduleScope === scope) {
      const msg = language === 'pt' ? '─── Módulos opcionais ───' : '─── Optional Modules ───';
      console.log(`\n  ${msg}`);

      const moduleResult = await promptModule(language, moduleConfig);
      if (moduleResult) {
        modules.memory = { installed: true, config: moduleResult };
      } else {
        modules.memory = { installed: false };
      }
    }
  }

  console.log('\n  Instalando...');

  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  // 3-hash conflict detection before installSkills
  const keepFiles = new Set();
  if (existingManifest) {
    const newRendered = preRenderFiles({ language, ides, modules, skillsDir, metaDir });

    for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
      const absPath = join(basePath, filePath);
      const newContent = newRendered.get(filePath);

      // File no longer in new install — will be handled by orphan removal
      if (!newContent) continue;

      // File doesn't exist on disk — nothing to conflict with
      if (!existsSync(absPath)) continue;

      const newHash = hashContent(newContent);
      const installedHash = manifestEntry.installed_hash;
      const currentContent = readFileSync(absPath, 'utf8');
      const currentHash = hashContent(currentContent);

      const localUnchanged = currentHash === installedHash;
      const packageUnchanged = installedHash === newHash;

      if (localUnchanged && packageUnchanged) {
        // No changes anywhere — skip
        continue;
      } else if (localUnchanged && !packageUnchanged) {
        // No local edit, new content from package — overwrite silently
        continue;
      } else if (!localUnchanged && packageUnchanged) {
        // Local edit, package unchanged — keep local
        keepFiles.add(filePath);
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
          keepFiles.add(filePath);
        }
        // 'overwrite' falls through — installSkills will write new content
      }
    }
  }

  // Save content of files user wants to keep (before installSkills overwrites)
  const savedContent = new Map();
  for (const filePath of keepFiles) {
    const absPath = join(basePath, filePath);
    if (existsSync(absPath)) {
      savedContent.set(filePath, readFileSync(absPath, 'utf8'));
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
  for (const [filePath, content] of savedContent) {
    writeFileSync(join(basePath, filePath), content, 'utf8');
  }

  // C2: Patch manifest hashes for kept files to reflect the kept content
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

  // Orphan removal: remove files from old manifest that aren't in new install
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
        if (wasModified) {
          let action = await promptOrphanConflict(language, oldPath);
          while (action === 'diff') {
            console.log('\n  --- Current (orphan on disk) ---');
            console.log(currentContent);
            action = await promptConflict(language, oldPath);
          }
          if (action === 'keep') {
            shouldRemove = false;
            console.log(`  ○ ${oldPath} mantido (mesmo sendo órfão)`);
          }
        }

        if (shouldRemove) {
          unlinkSync(absPath);
          console.log(`  ✗ ${oldPath} removido (não faz mais parte da configuração)`);
          
          // Try removing empty parent dirs recursively
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

  for (const f of result.files) {
    console.log(`  ✓ ${f.path}`);
  }

  const uniqueSkills = new Set(result.files.map(f => f.source)).size;
  const ideCount = ides.length;
  console.log(`\n  ⚛ ${uniqueSkills} skills instalados para ${ideCount} IDE${ideCount > 1 ? 's' : ''} (${result.files.length} arquivos).\n`);
}
