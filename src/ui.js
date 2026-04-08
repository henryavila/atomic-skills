import * as p from '@clack/prompts';
import pc from 'picocolors';
import { IDE_CONFIG, SKILL_NAMESPACE } from './config.js';

// ---------------------------------------------------------------------------
// i18n Messages
// ---------------------------------------------------------------------------

export const MESSAGES = {
  pt: {
    installDefaults: 'Instalar com padrões detectados',
    updateDefaults: 'Atualizar com configuração atual',
    customizeLang: 'Mudar idioma',
    customizeIDEs: 'Mudar IDEs',
    customizeModules: 'Mudar módulos',
    viewConflicts: 'Ver conflitos',
    quit: 'Sair',
    detected: 'detectado',
    selectIDEs: 'Quais IDEs você usa?',
    selectLang: 'Idioma / Language:',
    confirmUninstall: 'Remover arquivos gerados?',
    uninstallScope: 'Qual instalação remover?',
    scopeProject: 'Projeto — somente este repo',
    scopeUser: 'Usuário — todos os seus repos',
    conflictOverwrite: 'Sobrescrever (perder mudanças locais)',
    conflictKeep: 'Manter versão local',
    conflictDiff: 'Ver diff',
    orphanRemove: 'Remover (não faz mais parte da configuração)',
    orphanKeep: 'Manter versão modificada (ficará não-gerenciado)',
    nextSteps: 'Próximos passos',
    restart: 'Reinicie sua IDE ou inicie uma nova conversa',
    trySkills: 'Experimente: /fix, /hunt, /prompt',
    updateCmd: (ns) => `Atualizar: npx @henryavila/${ns} install`,
    removeCmd: (ns) => `Remover:   npx @henryavila/${ns} uninstall`,
    cancelled: 'Operação cancelada.',
    moduleInstall: (path) => `Instalar com padrão (${path})`,
    moduleSkip: 'Não instalar',
    moduleCustomPath: 'Escolher diretório customizado',
    memoryDir: 'Diretório para o módulo de memória',
    noIDEsDetected: 'Nenhuma IDE detectada — selecione manualmente.',
    done: 'Concluído.',
    installingMsg: (version) => `Instalando atomic-skills v${version}...`,
  },
  en: {
    installDefaults: 'Install with detected defaults',
    updateDefaults: 'Update with current configuration',
    customizeLang: 'Change language',
    customizeIDEs: 'Change IDEs',
    customizeModules: 'Change modules',
    viewConflicts: 'View conflicts',
    quit: 'Quit',
    detected: 'detected',
    selectIDEs: 'Which IDEs do you use?',
    selectLang: 'Language / Idioma:',
    confirmUninstall: 'Remove generated files?',
    uninstallScope: 'Which installation to remove?',
    scopeProject: 'Project — this repo only',
    scopeUser: 'User — all your repos',
    conflictOverwrite: 'Overwrite (lose local changes)',
    conflictKeep: 'Keep local version',
    conflictDiff: 'View diff',
    orphanRemove: 'Remove (no longer part of the config)',
    orphanKeep: 'Keep modified version (will stay as unmanaged orphan)',
    nextSteps: 'Next steps',
    restart: 'Restart your IDE or start a new conversation',
    trySkills: 'Try: /fix, /hunt, /prompt',
    updateCmd: (ns) => `Update later: npx @henryavila/${ns} install`,
    removeCmd: (ns) => `Remove:       npx @henryavila/${ns} uninstall`,
    cancelled: 'Operation cancelled.',
    moduleInstall: (path) => `Install with default (${path})`,
    moduleSkip: 'Do not install',
    moduleCustomPath: 'Choose custom directory',
    memoryDir: 'Directory for the memory module',
    noIDEsDetected: 'No IDEs detected — please select manually.',
    done: 'Done.',
    installingMsg: (version) => `Installing atomic-skills v${version}...`,
  },
};

// ---------------------------------------------------------------------------
// Helper: msg(lang)
// ---------------------------------------------------------------------------

/**
 * Returns the MESSAGES object for the given language, defaulting to 'en'.
 * @param {string} lang
 * @returns {object}
 */
export function msg(lang) {
  return MESSAGES[lang] || MESSAGES.en;
}

// ---------------------------------------------------------------------------
// Helper: ideDisplayName
// ---------------------------------------------------------------------------

/**
 * Strips " (Skills)" and " (Commands)" suffixes from an IDE_CONFIG display name.
 * @param {string} ideId
 * @returns {string}
 */
export function ideDisplayName(ideId) {
  const name = IDE_CONFIG[ideId]?.name ?? ideId;
  return name.replace(/ \(Skills\)$/, '').replace(/ \(Commands\)$/, '');
}

// Primary IDE IDs exposed to users (gemini-commands is internal)
const PRIMARY_IDE_IDS = ['claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot'];

// ---------------------------------------------------------------------------
// Display functions
// ---------------------------------------------------------------------------

/**
 * Calls p.intro() once with version info.
 * @param {object} config  - parsed config (not used directly, kept for extension)
 * @param {object} opts
 * @param {boolean} opts.isUpdate
 * @param {string}  opts.pkgVersion
 */
export function showIntro(config, { isUpdate, pkgVersion } = {}) {
  let label;
  if (isUpdate && config.existingVersion) {
    label = pc.bold(`atomic-skills`) + ` v${config.existingVersion} → v${pkgVersion}` + pc.dim('  update');
  } else {
    label = pc.bold(`atomic-skills v${pkgVersion}`);
  }
  p.intro(label);
}

/**
 * Prints dashboard config lines using p.log.message().
 * @param {object} config       - { lang, scope, ides, modules, skillCount, conflictCount }
 * @param {number} conflictCount
 */
export function printConfig(config, conflictCount = 0) {
  const { lang, scope, ides = [], modules = {}, skillCount } = config;

  const scopeLabel = scope === 'user' ? `user (${pc.dim('~/')})` : `project (${pc.dim('./')})`;

  const ideLabels = ides
    .filter((id) => id !== 'gemini-commands')
    .map((id) => pc.cyan(ideDisplayName(id)))
    .join('  ');

  const moduleEntries = Object.entries(modules).filter(([, v]) => v.installed);
  const modulesLabel = moduleEntries.length
    ? moduleEntries
        .map(([name, v]) => {
          const dir = v.config?.memory_path ?? '';
          return pc.cyan(name) + (dir ? pc.dim(` → ${dir}`) : '');
        })
        .join('  ')
    : pc.dim('none');

  p.log.message(`  Language    ${pc.cyan(lang)}`);
  p.log.message(`  Scope       ${scopeLabel}`);
  p.log.message(`  IDEs        ${ideLabels || pc.dim('none')}`);
  p.log.message(`  Modules     ${modulesLabel}`);
  if (skillCount) {
    p.log.message(`  Skills      ${pc.dim(skillCount)}`);
  }
  if (conflictCount > 0) {
    p.log.message(`  Conflicts   ${pc.yellow(`${conflictCount} files modified locally`)}`);
  }
}

/**
 * Per-IDE summary + "Next steps" on first install.
 * @param {object} result          - { files: [{path, hash, source}] }
 * @param {string[]} ides          - installed IDE IDs
 * @param {string} lang
 * @param {boolean} isFirstInstall
 */
export function showPostInstall(result, ides, lang, isFirstInstall) {
  const m = msg(lang);

  // Group files by IDE
  const byIDE = {};
  for (const id of ides) {
    byIDE[id] = 0;
  }
  for (const f of result.files) {
    for (const id of ides) {
      const cfg = IDE_CONFIG[id];
      if (cfg && f.path.startsWith(cfg.dir + '/')) {
        byIDE[id] = (byIDE[id] || 0) + 1;
      }
    }
  }

  for (const id of ides) {
    if (id === 'gemini-commands') continue;
    const cfg = IDE_CONFIG[id];
    if (!cfg) continue;
    const count = byIDE[id] ?? 0;
    const dirLabel = `${cfg.dir}/${SKILL_NAMESPACE}/`;
    p.log.success(`${pc.bold(ideDisplayName(id))}  ${count} skills → ${pc.dim(dirLabel)}`);
  }

  if (isFirstInstall) {
    p.note(
      [
        `• ${m.restart}`,
        `• ${m.trySkills}`,
        `• ${m.updateCmd(SKILL_NAMESPACE)}`,
        `• ${m.removeCmd(SKILL_NAMESPACE)}`,
      ].join('\n'),
      m.nextSteps,
    );
  }

  p.outro(pc.green(m.done));
}

/**
 * Minimal output for --yes (non-interactive) mode.
 * @param {object} result
 * @param {string[]} ides
 * @param {string} lang
 */
export function showNonInteractiveResult(result, ides, lang) {
  const m = msg(lang);

  const byIDE = {};
  for (const id of ides) {
    byIDE[id] = 0;
  }
  for (const f of result.files) {
    for (const id of ides) {
      const cfg = IDE_CONFIG[id];
      if (cfg && f.path.startsWith(cfg.dir + '/')) {
        byIDE[id] = (byIDE[id] || 0) + 1;
      }
    }
  }

  for (const id of ides) {
    if (id === 'gemini-commands') continue;
    const cfg = IDE_CONFIG[id];
    if (!cfg) continue;
    const count = byIDE[id] ?? 0;
    p.log.success(`${pc.bold(ideDisplayName(id))}  ${count} skills`);
  }

  p.outro(`${m.done} ${result.files.length} files installed.`);
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

/**
 * Main action select: Install/Update, customize lang/ides/modules, view conflicts, quit.
 * @param {string} lang
 * @param {object} opts
 * @param {boolean} opts.isUpdate
 * @param {boolean} opts.hasConflicts
 * @returns {Promise<string>} 'install'|'customize-lang'|'customize-ides'|'customize-modules'|'view-conflicts'|'quit'
 */
export async function promptAction(lang, { isUpdate = false, hasConflicts = false } = {}) {
  const m = msg(lang);

  const options = [
    {
      value: 'install',
      label: isUpdate ? m.updateDefaults : m.installDefaults,
    },
    { value: 'customize-lang', label: m.customizeLang },
    { value: 'customize-ides', label: m.customizeIDEs },
    { value: 'customize-modules', label: m.customizeModules },
  ];

  if (hasConflicts) {
    options.push({ value: 'view-conflicts', label: m.viewConflicts });
  }

  options.push({ value: 'quit', label: m.quit });

  const action = await p.select({
    message: '',
    options,
  });

  if (p.isCancel(action)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return action;
}

/**
 * Multiselect of 6 primary IDEs (not gemini-commands, which is internal).
 * @param {string} lang
 * @param {string[]} currentIDEs  - already selected IDE IDs (used as initial values)
 * @returns {Promise<string[]>}
 */
export async function promptIDESelection(lang, currentIDEs = []) {
  const m = msg(lang);

  const options = PRIMARY_IDE_IDS.map((id) => ({
    value: id,
    label: ideDisplayName(id),
    // hint when detected (pre-checked)
    hint: currentIDEs.includes(id) ? m.detected : undefined,
  }));

  const result = await p.multiselect({
    message: m.selectIDEs,
    options,
    initialValues: currentIDEs.filter((id) => PRIMARY_IDE_IDS.includes(id)),
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return result;
}

/**
 * Select language: pt or en.
 * @param {string} lang - current language (used to pre-select)
 * @returns {Promise<string>} 'pt'|'en'
 */
export async function promptLanguageSelection(lang) {
  const m = msg(lang);

  const result = await p.select({
    message: m.selectLang,
    options: [
      { value: 'pt', label: 'Português (BR)' },
      { value: 'en', label: 'English' },
    ],
    initialValue: lang,
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return result;
}

/**
 * Select install/custom path/skip for memory module.
 * @param {string} lang
 * @param {object} currentModules  - e.g. { memory: { installed: true, config: { memory_path: '...' } } }
 * @param {object} moduleYamlConfig - parsed module.yaml content
 * @returns {Promise<object>} updated modules object
 */
export async function promptModuleConfig(lang, currentModules = {}, moduleYamlConfig) {
  const m = msg(lang);
  const display = moduleYamlConfig.display_name?.[lang] || moduleYamlConfig.display_name?.en || 'Memory';
  const desc =
    moduleYamlConfig.description?.[lang] || moduleYamlConfig.description?.en || '';
  const defaultPath = moduleYamlConfig.variables?.memory_path?.default ?? '.ai/memory/';

  p.log.message(`\n  ${pc.bold(display)}`);
  if (desc) {
    p.log.message(`  ${desc.trim().split('\n').join('\n  ')}`);
  }

  const choice = await p.select({
    message: '',
    options: [
      { value: 'default', label: m.moduleInstall(defaultPath) },
      { value: 'custom', label: m.moduleCustomPath },
      { value: 'skip', label: m.moduleSkip },
    ],
    initialValue: currentModules.memory?.installed ? 'default' : 'skip',
  });

  if (p.isCancel(choice)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  if (choice === 'skip') {
    return { memory: { installed: false } };
  }

  if (choice === 'custom') {
    const varDesc =
      moduleYamlConfig.variables?.memory_path?.description?.[lang] ||
      moduleYamlConfig.variables?.memory_path?.description?.en ||
      m.memoryDir;

    const customPath = await p.text({
      message: `${varDesc}:`,
      placeholder: defaultPath,
      initialValue: currentModules.memory?.config?.memory_path ?? defaultPath,
      validate(value) {
        if (!value || value.trim().length === 0) return 'Path is required.';
      },
    });

    if (p.isCancel(customPath)) {
      p.cancel(m.cancelled);
      process.exit(0);
    }

    return { memory: { installed: true, config: { memory_path: customPath } } };
  }

  // default
  return { memory: { installed: true, config: { memory_path: defaultPath } } };
}

// ---------------------------------------------------------------------------
// Conflict resolution prompts
// ---------------------------------------------------------------------------

/**
 * Conflict prompt: overwrite/keep/diff.
 * @param {string} lang
 * @param {string} filePath
 * @returns {Promise<'overwrite'|'keep'|'diff'>}
 */
export async function promptConflict(lang, filePath) {
  const m = msg(lang);

  p.log.warn(`${filePath} was modified locally.`);

  const action = await p.select({
    message: '',
    options: [
      { value: 'overwrite', label: m.conflictOverwrite },
      { value: 'keep', label: m.conflictKeep },
      { value: 'diff', label: m.conflictDiff },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return action;
}

/**
 * Orphan conflict prompt: remove/keep/diff.
 * Returns 'overwrite' when the user chooses 'remove' (matches old prompts.js behavior).
 * @param {string} lang
 * @param {string} filePath
 * @returns {Promise<'overwrite'|'keep'|'diff'>}
 */
export async function promptOrphanConflict(lang, filePath) {
  const m = msg(lang);

  p.log.warn(`Orphan file ${filePath} was modified locally.`);

  const action = await p.select({
    message: '',
    options: [
      { value: 'remove', label: m.orphanRemove },
      { value: 'keep', label: m.orphanKeep },
      { value: 'diff', label: m.conflictDiff },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return action === 'remove' ? 'overwrite' : action;
}

// ---------------------------------------------------------------------------
// Uninstall prompts
// ---------------------------------------------------------------------------

/**
 * Confirm uninstall (yes/no).
 * @param {string} lang
 * @returns {Promise<boolean>}
 */
export async function promptConfirmUninstall(lang) {
  const m = msg(lang);

  const result = await p.confirm({
    message: m.confirmUninstall,
    initialValue: false,
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return result;
}

/**
 * Select uninstall scope: project or user.
 * @param {string} lang
 * @returns {Promise<'project'|'user'>}
 */
export async function promptUninstallScope(lang) {
  const m = msg(lang);

  const result = await p.select({
    message: m.uninstallScope,
    options: [
      { value: 'project', label: m.scopeProject },
      { value: 'user', label: m.scopeUser },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return result;
}
