import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { renderTemplate, renderForIDE } from '../render.js';
import {
  SKILL_NAMESPACE,
  getSkillPath,
  getSkillFormat,
  getNamespaceRootPath,
  getAssetsDir,
} from '../config.js';

/**
 * Pure computation of the atomic-skills file set — skill bodies, shared assets
 * (including one level of subdir recursion, e.g. project-assets/hooks/) and the
 * per-IDE namespace root — returned as `[{ path, content }]` with project-root-
 * relative paths. This is the declarative file-set domain (P2) the
 * reconcileFileSet effect manages.
 *
 * It reproduces the footprint that installSkills (src/install.js) writes for the
 * same config, WITHOUT writing and WITHOUT the runtime-layer artifacts
 * (auto-update hook, settings.json, manifest), which belong to the runtime
 * layers (T-F3-3) and the Driver's journal — not to this provider.
 *
 * NOTE (strangler-fig): the catalog walk + generateNamespaceRoot are
 * intentionally duplicated from installSkills/preRenderFiles for now. The flip
 * (T-F3-4) removes the legacy in-repo walk and leaves this module as the single
 * source. preRenderFiles omits the asset subdir recursion that installSkills
 * performs; this module matches installSkills (the ground truth), not the
 * incomplete preRenderFiles view.
 *
 * @param {object} config
 * @param {string} config.language - communication language code (e.g. 'en')
 * @param {string[]} config.ides - IDE ids to render for
 * @param {Record<string, {installed?: boolean, config?: Record<string,string>}>} [config.modules]
 * @param {string} config.skillsDir - path to the skills/ source tree
 * @param {string} config.metaDir - path to the meta/ dir holding catalog.yaml
 * @param {''|'user'|'project'} config.scope - install scope (drives ASSETS_PATH)
 * @returns {Array<{ path: string, content: string }>}
 */
export function computeSkillsFileSet(config) {
  const { language, ides, modules = {}, skillsDir, metaDir, scope } = config;

  const meta = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));

  // Module flags + variable bag from installed modules (mirrors installSkills).
  const vars = {};
  const moduleFlags = {};
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (!modConfig.installed) continue;
    moduleFlags[modName] = true;
    for (const [varName, varValue] of Object.entries(modConfig.config || {})) {
      vars[varName] = varValue;
    }
  }

  // Skill bodies carry the communication-language directive; shared assets do
  // not (they are inputs to skills, not skill bodies).
  const skillVars = { ...vars, COMMUNICATION_LANGUAGE: language };

  const files = [];
  const seen = new Set();
  // `source` tags each file's origin (e.g. `core/fix`, `modules/x/y`, `_assets/...`,
  // `_namespace`) — the same taxonomy the legacy installSkills recorded. It is
  // carried so the install return can classify skills vs assets for the post-install
  // summary; reconcileFileSet ignores it (it consumes only { path, content }).
  const add = (path, content, source) => {
    if (seen.has(path)) return;
    seen.add(path);
    files.push({ path, content, source });
  };

  const renderSkill = (skillId, skillMeta, langDir, sourceTag) => {
    const sourceFile = join(skillsDir, langDir, `${skillId}.md`);
    if (!existsSync(sourceFile)) return;
    const rawContent = readFileSync(sourceFile, 'utf8');
    for (const ideId of ides) {
      const body = renderTemplate(rawContent, skillVars, moduleFlags, ideId, scope);
      const format = getSkillFormat(ideId);
      const renderOpts = skillMeta.argument_hint ? { argumentHint: skillMeta.argument_hint } : {};
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, renderOpts);
      add(getSkillPath(ideId, skillMeta.name), content, sourceTag);
    }
  };

  // Core skills.
  for (const [skillId, skillMeta] of Object.entries(meta.core || {})) {
    renderSkill(skillId, skillMeta, 'core', `core/${skillId}`);
  }

  // Module skills (only installed modules).
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (!modConfig.installed) continue;
    const modMeta = meta.modules?.[modName];
    if (!modMeta) continue;
    for (const [skillId, skillMeta] of Object.entries(modMeta)) {
      renderSkill(skillId, skillMeta, `modules/${modName}`, `modules/${modName}/${skillId}`);
    }
  }

  // Shared assets — an `<name>-assets/` dir installs when `<name>` is a
  // registered module OR a registered core skill. Recurse ONE level into
  // subdirs (e.g. hooks/) to match installSkills.
  const sharedDir = join(skillsDir, 'shared');
  if (existsSync(sharedDir)) {
    for (const entry of readdirSync(sharedDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.endsWith('-assets')) continue;
      const ownerName = entry.name.slice(0, -'-assets'.length);
      const isModule = meta.modules && meta.modules[ownerName];
      const isCoreSkill = meta.core && meta.core[ownerName];
      if (!isModule && !isCoreSkill) continue;

      const assetsSourceDir = join(sharedDir, entry.name);
      const assetFiles = readdirSync(assetsSourceDir, { withFileTypes: true });

      for (const ideId of ides) {
        const destBase = getAssetsDir(ideId);

        for (const f of assetFiles) {
          if (f.isDirectory()) {
            const subSrc = join(assetsSourceDir, f.name);
            for (const sf of readdirSync(subSrc, { withFileTypes: true })) {
              if (!sf.isFile()) continue;
              const raw = readFileSync(join(subSrc, sf.name), 'utf8');
              add(
                `${destBase}/${f.name}/${sf.name}`,
                renderTemplate(raw, vars, moduleFlags, ideId, scope),
                `_assets/${entry.name}/${f.name}/${sf.name}`,
              );
            }
            continue;
          }
          if (!f.isFile()) continue;
          const raw = readFileSync(join(assetsSourceDir, f.name), 'utf8');
          add(
            `${destBase}/${f.name}`,
            renderTemplate(raw, vars, moduleFlags, ideId, scope),
            `_assets/${entry.name}/${f.name}`,
          );
        }
      }
    }
  }

  // Namespace root SKILL.md for markdown-format IDEs.
  for (const ideId of ides) {
    const rootPath = getNamespaceRootPath(ideId);
    if (!rootPath) continue;
    add(rootPath, generateNamespaceRoot(), '_namespace');
  }

  return files;
}

// Mirror of install.js generateNamespaceRoot() — duplicated for the strangler-fig
// phase; collapsed at the flip (T-F3-4).
function generateNamespaceRoot() {
  const desc = 'Stop rewriting prompts. Install optimized developer skills in any AI IDE.';
  const escaped = desc.replace(/'/g, "''");
  return `---\nname: ${SKILL_NAMESPACE}\ndescription: '${escaped}'\nuser-invocable: false\n---\n\nNamespace package for Atomic Skills.\n`;
}
