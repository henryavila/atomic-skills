import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { promptLanguage, promptIDEs, promptModule, promptReuseConfig } from './prompts.js';
import { parse as parseYaml } from './yaml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

/**
 * Core install logic (non-interactive, testable).
 * @param {string} projectDir
 * @param {object} options - { language, ides, modules, skillsDir, metaDir }
 * @param {object} [callbacks] - { onFileWritten }
 */
export function installSkills(projectDir, options, callbacks = {}) {
  const { language, ides, modules, skillsDir, metaDir } = options;
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

  // Add .atomic-skills/ to .gitignore
  const gitignorePath = join(projectDir, '.gitignore');
  let gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.includes('.atomic-skills/')) {
    gitignore += (gitignore.endsWith('\n') || gitignore === '' ? '' : '\n') + '.atomic-skills/\n';
    writeFileSync(gitignorePath, gitignore, 'utf8');
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

  const writtenFiles = [];
  const cleanup = () => {
    for (const f of writtenFiles) {
      try { unlinkSync(join(projectDir, f)); } catch {}
    }
    console.log('\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n');
    process.exit(1);
  };
  process.on('SIGINT', cleanup);

  const result = installSkills(projectDir, { language, ides, modules, skillsDir, metaDir }, {
    onFileWritten: (path) => writtenFiles.push(path),
  });

  process.removeListener('SIGINT', cleanup);

  for (const f of result.files) {
    console.log(`  ✓ ${f.path}`);
  }

  const uniqueSkills = new Set(result.files.map(f => f.source)).size;
  const ideCount = ides.length;
  console.log(`\n  ⚛ ${uniqueSkills} skills instalados para ${ideCount} IDE${ideCount > 1 ? 's' : ''} (${result.files.length} arquivos).\n`);
}
