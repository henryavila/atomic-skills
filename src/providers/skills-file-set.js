import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { renderTemplate, renderForIDE } from '../render.js';
import {
  IDE_CONFIG,
  SKILL_NAMESPACE,
  getSkillPath,
  getSkillFormat,
  getNamespaceRootPath,
  getAssetsDir,
} from '../config.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Pure computation of the atomic-skills file set — skill bodies, shared assets
 * (recursive under each `*-assets/` tree, e.g. project-assets/hooks/ and
 * codex-bridge-assets/providers/{codex,grok}/) and the per-IDE namespace root —
 * returned as `[{ path, content }]` with project-root-relative paths. This is
 * the declarative file-set domain (P2) the reconcileFileSet effect manages.
 *
 * It reproduces the footprint that installSkills (src/install.js) writes for the
 * same config, WITHOUT writing and WITHOUT the runtime-layer artifacts
 * (auto-update hook, settings.json, manifest), which belong to the runtime
 * layers (T-F3-3) and the Driver's journal — not to this provider.
 *
 * NOTE (strangler-fig): the catalog walk + generateNamespaceRoot are
 * intentionally duplicated from installSkills/preRenderFiles for now. The flip
 * (T-F3-4) removes the legacy in-repo walk and leaves this module as the single
 * source.
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
  // registered module OR a registered core skill. Walk the asset tree
  // recursively so nested leaves (hooks/, providers/codex/, providers/grok/)
  // are staged with the same relative path under the IDE assets dir.
  const walkAssetFiles = (dir, relParts = []) => {
    const out = [];
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const nextRel = [...relParts, f.name];
      if (f.isDirectory()) {
        out.push(...walkAssetFiles(join(dir, f.name), nextRel));
        continue;
      }
      if (!f.isFile()) continue;
      out.push({ abs: join(dir, f.name), rel: nextRel.join('/') });
    }
    return out;
  };

  const sharedDir = join(skillsDir, 'shared');
  if (existsSync(sharedDir)) {
    for (const entry of readdirSync(sharedDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.endsWith('-assets')) continue;
      const ownerName = entry.name.slice(0, -'-assets'.length);
      const isModule = meta.modules && meta.modules[ownerName];
      const isCoreSkill = meta.core && meta.core[ownerName];
      if (!isModule && !isCoreSkill) continue;

      const assetsSourceDir = join(sharedDir, entry.name);
      const assetFiles = walkAssetFiles(assetsSourceDir);

      for (const ideId of ides) {
        const destBase = getAssetsDir(ideId);

        for (const { abs, rel } of assetFiles) {
          const raw = readFileSync(abs, 'utf8');
          add(
            `${destBase}/${rel}`,
            renderTemplate(raw, vars, moduleFlags, ideId, scope),
            `_assets/${entry.name}/${rel}`,
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

  // Plugin-delivery hosts (Grok Build): package root owns plugin.json + Soft
  // project hooks. Skills/assets already land under the plugin tree via
  // getSkillPath / getAssetsDir. Strict (Stop) is opt-in at project setup.
  for (const ideId of ides) {
    const ide = IDE_CONFIG[ideId];
    if (!ide || ide.delivery !== 'plugin') continue;
    // ide.dir is `<pluginRoot>/skills` → plugin root is the parent (posix paths).
    const pluginRoot = posix.dirname(ide.dir);
    add(
      `${pluginRoot}/plugin.json`,
      generatePluginJson(),
      `_plugin/${ideId}/plugin.json`,
    );
    add(
      `${pluginRoot}/hooks/hooks.json`,
      generatePluginHooksSoft(),
      `_plugin/${ideId}/hooks.json`,
    );
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

function readPackageMeta() {
  try {
    return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  } catch {
    return { name: SKILL_NAMESPACE, version: '0.0.0', description: '' };
  }
}

/**
 * Minimal Grok plugin manifest (convention paths + version from package.json).
 * Skills/hooks load from the standard plugin subdirs even without a manifest;
 * we still write one so inspect/validate surfaces name+version.
 */
function generatePluginJson() {
  const pkg = readPackageMeta();
  const manifest = {
    name: SKILL_NAMESPACE,
    version: pkg.version || '0.0.0',
    description:
      pkg.description
      || 'Stop rewriting prompts. Install optimized developer skills in any AI IDE.',
    skills: './skills/',
    hooks: './hooks/hooks.json',
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Soft project hooks for plugin-delivery hosts (Grok Build).
 * Soft = SessionStart + PreToolUse; Strict adds Stop at project setup (not
 * installed by default). Matchers dual-vocab: Claude Edit|Write|MultiEdit and
 * Grok search_replace|write (Grok also aliases Claude names). Commands use the
 * same CLAUDE_PROJECT_DIR:-$PWD wrapper as Claude/Codex so scripts under
 * .atomic-skills/status/hooks/ resolve when the host injects CLAUDE_PROJECT_DIR
 * (Grok does) or when only $PWD is available.
 */
function generatePluginHooksSoft() {
  // Prefer scripts bundled under the plugin package (always present after install).
  // Fall back to project-status copy + CLAUDE_PROJECT_DIR for dual-host wrappers.
  // GROK_PLUGIN_ROOT is set by Grok for plugin-owned hooks.
  const cmd = (script) =>
    `bash "\${GROK_PLUGIN_ROOT:-\${CLAUDE_PROJECT_DIR:-\$PWD}/.grok/plugins/atomic-skills}/_assets/hooks/${script}"`;
  const envelope = {
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: 'command', command: cmd('session-start.sh') }],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit|search_replace|write',
          hooks: [{ type: 'command', command: cmd('pre-write.sh') }],
        },
      ],
    },
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
