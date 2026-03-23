import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { promptLanguage, promptIDEs, promptModule, promptReuseConfig, promptConflict } from './prompts.js';
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
    const body = renderTemplate(rawContent, vars, moduleFlags);

    for (const ideId of ides) {
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
    const body = renderTemplate(rawContent, vars, moduleFlags);

    for (const ideId of ides) {
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

  return rendered;
}

/**
 * Interactive install entry point.
 */
export async function install(projectDir) {
  console.log('\n  ⚛ Atomic Skills — Stop rewriting prompts.\n');

  const existingManifest = readManifest(projectDir);

  let language, ides, modules;

  if (existingManifest) {
    const installedMods = Object.keys(existingManifest.modules || {}).filter(m => existingManifest.modules[m].installed);
    console.log(`  Configuração anterior encontrada (${MANIFEST_DIR}/manifest.json).`);
    console.log(`  Idioma: ${existingManifest.language} | IDEs: ${existingManifest.ides.join(', ')} | Módulos: ${installedMods.join(', ') || 'nenhum'}\n`);

    const reuse = await promptReuseConfig(existingManifest.language);
    if (reuse) {
      language = existingManifest.language;
      ides = existingManifest.ides;
      modules = existingManifest.modules;
    }
  }

  if (!language) {
    language = await promptLanguage();
    ides = await promptIDEs(language);

    // Load module configs
    const moduleYamlPath = join(PACKAGE_ROOT, 'skills', 'modules', 'memory', 'module.yaml');
    const moduleConfig = parseYaml(readFileSync(moduleYamlPath, 'utf8'));

    const msg = language === 'pt' ? '─── Módulos opcionais ───' : '─── Optional Modules ───';
    console.log(`\n  ${msg}`);

    modules = {};
    const moduleResult = await promptModule(language, moduleConfig);
    if (moduleResult) {
      modules.memory = { installed: true, config: moduleResult };
    } else {
      modules.memory = { installed: false };
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
      const absPath = join(projectDir, filePath);
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
    const absPath = join(projectDir, filePath);
    if (existsSync(absPath)) {
      savedContent.set(filePath, readFileSync(absPath, 'utf8'));
    }
  }

  const writtenFiles = [];
  const cleanup = () => {
    for (const f of writtenFiles) {
      try { unlinkSync(join(projectDir, f)); } catch {}
    }
    const msg = SIGINT_MESSAGES[language] || SIGINT_MESSAGES.en;
    console.log(msg);
    process.exitCode = 1;
    process.kill(process.pid, 'SIGINT');
  };
  process.on('SIGINT', cleanup);

  let result;
  try {
    result = installSkills(projectDir, { language, ides, modules, skillsDir, metaDir }, {
      onFileWritten: (path) => writtenFiles.push(path),
    });
  } finally {
    process.removeListener('SIGINT', cleanup);
  }

  // Restore files user chose to keep
  for (const [filePath, content] of savedContent) {
    writeFileSync(join(projectDir, filePath), content, 'utf8');
  }

  // C2: Patch manifest hashes for kept files to reflect the kept content
  if (keepFiles.size > 0) {
    const manifest = readManifest(projectDir);
    for (const filePath of keepFiles) {
      const keptContent = savedContent.get(filePath);
      if (keptContent && manifest.files[filePath]) {
        manifest.files[filePath].installed_hash = hashContent(keptContent);
      }
    }
    writeManifest(projectDir, manifest);
  }

  // Orphan removal: remove files from old manifest that aren't in new install
  if (existingManifest) {
    const newPaths = new Set(result.files.map(f => f.path));
    for (const oldPath of Object.keys(existingManifest.files)) {
      if (!newPaths.has(oldPath)) {
        const absPath = join(projectDir, oldPath);
        if (existsSync(absPath)) {
          unlinkSync(absPath);
          // Try removing empty parent dir
          try { const p = dirname(absPath); if (readdirSync(p).length === 0) rmdirSync(p); } catch {}
          console.log(`  ✗ ${oldPath} (removed — IDE/module deselected)`);
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
