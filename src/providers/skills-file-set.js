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

/** Canonical project memory directory — always rendered into skill bodies. */
export const DEFAULT_MEMORY_PATH = '.ai/memory/';

/**
 * Pure computation of the atomic-skills file set — skill bodies, shared assets
 * (including arbitrary subdir recursion, e.g. project-assets/hooks/ and
 * codex-bridge-assets/providers/{codex,grok}/) and the per-IDE namespace root —
 * returned as `[{ path, content }]` with project-root-relative paths. This is
 * the declarative file-set domain (P2) the reconcileFileSet effect manages.
 *
 * It reproduces the footprint that installSkills (src/install.js) writes for the
 * same config, WITHOUT writing and WITHOUT the runtime-layer artifacts
 * (auto-update hook, settings.json, manifest), which belong to the runtime
 * layers (T-F3-3) and the Driver's journal — not to this provider.
 *
 * @param {object} config
 * @param {string} config.language - communication language code (e.g. 'en')
 * @param {string[]} config.ides - IDE ids to render for
 * @param {string} config.skillsDir - path to the skills/ source tree
 * @param {string} config.metaDir - path to the meta/ dir holding catalog.yaml
 * @param {''|'user'|'project'} config.scope - install scope (drives ASSETS_PATH)
 * @returns {Array<{ path: string, content: string }>}
 */
export function computeSkillsFileSet(config) {
  const { language, ides, skillsDir, metaDir, scope } = config;

  const meta = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));

  // Canonical memory path is always on; injection lives here (not in renderTemplate).
  const vars = { memory_path: DEFAULT_MEMORY_PATH };
  const skillVars = { ...vars, COMMUNICATION_LANGUAGE: language };

  const files = [];
  const seen = new Map();
  // `source` tags each file's origin (e.g. `core/fix`, `_assets/...`,
  // `_namespace`) — carried so the install return can classify skills vs assets
  // for the post-install summary; reconcileFileSet ignores it.
  const add = (path, content, source) => {
    const previous = seen.get(path);
    if (previous) {
      if (previous.source === source && previous.content === content) return;
      throw new Error(
        `computeSkillsFileSet: destination collision at '${path}' ` +
        `between '${previous.source}' and '${source}'`,
      );
    }
    seen.set(path, { content, source });
    files.push({ path, content, source });
  };

  const renderSkill = (skillId, skillMeta, langDir, sourceTag) => {
    const sourceFile = join(skillsDir, langDir, `${skillId}.md`);
    if (!existsSync(sourceFile)) return;
    const rawContent = readFileSync(sourceFile, 'utf8');
    for (const ideId of ides) {
      const body = renderTemplate(rawContent, skillVars, ideId, scope);
      const format = getSkillFormat(ideId);
      const renderOpts = skillMeta.argument_hint ? { argumentHint: skillMeta.argument_hint } : {};
      const content = renderForIDE(format, skillMeta.name, skillMeta.description, body, renderOpts);
      add(getSkillPath(ideId, skillMeta.name), content, sourceTag);
    }
  };

  // Core skills (the only skill namespace).
  for (const [skillId, skillMeta] of Object.entries(meta.core || {})) {
    renderSkill(skillId, skillMeta, 'core', `core/${skillId}`);
  }

  // Shared assets — install every standalone helper and every file below a
  // `<name>-assets/` group. Group names organize the source tree only, so their
  // contents share the destination root; nested paths remain nested.
  const sharedDir = join(skillsDir, 'shared');
  if (existsSync(sharedDir)) {
    const assetSources = collectSharedAssetSources(sharedDir);
    for (const ideId of ides) {
      const destBase = getAssetsDir(ideId);
      for (const sourceRelativePath of assetSources) {
        const destinationSegments = sourceRelativePath.split('/');
        if (destinationSegments[0].endsWith('-assets')) destinationSegments.shift();
        const destinationRelativePath = destinationSegments.join('/');
        const raw = readFileSync(join(sharedDir, sourceRelativePath), 'utf8');
        add(
          `${destBase}/${destinationRelativePath}`,
          renderTemplate(raw, vars, ideId, scope),
          `_assets/${sourceRelativePath}`,
        );
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

function collectSharedAssetSources(sharedDir) {
  const sources = [];

  const walk = (directory, prefix) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(directory, entry.name), relativePath);
      } else if (entry.isFile()) {
        sources.push(relativePath);
      }
    }
  };

  for (const entry of readdirSync(sharedDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile()) {
      sources.push(entry.name);
    } else if (entry.isDirectory() && entry.name.endsWith('-assets')) {
      walk(join(sharedDir, entry.name), entry.name);
    }
  }

  return sources;
}

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
 * Soft = SessionStart + PreToolUse; Strict adds Stop at project setup.
 */
function generatePluginHooksSoft() {
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
