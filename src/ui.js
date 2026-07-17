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
    customizeLang: 'Mudar idioma de comunicação',
    customizeIDEs: 'Mudar IDEs',
    viewConflicts: 'Ver conflitos',
    quit: 'Sair',
    detected: 'detectado',
    selectIDEs: 'Quais IDEs você usa?',
    selectLang: 'Em qual idioma você quer que eu me comunique com você?',
    selectScope: 'Onde instalar?',
    scopeUserInstall: 'Usuário — todos os seus repos',
    scopeProjectInstall: 'Projeto — repo atual',
    scopeProjectUnavailable: (reason) => `Projeto indisponível: ${reason}`,
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
    noIDEsDetected: 'Nenhuma IDE detectada — selecione manualmente.',
    done: 'Concluído.',
    installingMsg: (version) => `Instalando atomic-skills v${version}...`,
    skillsCount: (n) => `${n} skills`,
    filesInstalled: (n) => `${n} arquivos instalados.`,
  },
  en: {
    installDefaults: 'Install with detected defaults',
    updateDefaults: 'Update with current configuration',
    customizeLang: 'Change communication language',
    customizeIDEs: 'Change IDEs',
    viewConflicts: 'View conflicts',
    quit: 'Quit',
    detected: 'detected',
    selectIDEs: 'Which IDEs do you use?',
    selectLang: 'Which language should I communicate with you in?',
    selectScope: 'Where should Atomic Skills be installed?',
    scopeUserInstall: 'User — all your repos',
    scopeProjectInstall: 'Project — current repo',
    scopeProjectUnavailable: (reason) => `Project unavailable: ${reason}`,
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
    noIDEsDetected: 'No IDEs detected — please select manually.',
    done: 'Done.',
    installingMsg: (version) => `Installing atomic-skills v${version}...`,
    skillsCount: (n) => `${n} skills`,
    filesInstalled: (n) => `${n} files installed.`,
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

// Primary IDE IDs exposed to users (gemini-commands is internal).
// Keep in sync with PUBLIC_IDE_IDS order in config.js (minus non-interactive hosts).
const PRIMARY_IDE_IDS = [
  'claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot', 'grok',
];

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
 * @param {object} config       - { lang, scope, ides, skillCount, conflictCount }
 * @param {number} conflictCount
 */
export function printConfig(config, conflictCount = 0) {
  const { lang, scope, scopePath, ides = [], skillCount } = config;

  const scopeLabel = scope === 'user'
    ? `user (${pc.dim(scopePath || '~/')})`
    : `project (${pc.dim(scopePath || './')})`;

  const ideLabels = ides
    .filter((id) => id !== 'gemini-commands')
    .map((id) => pc.cyan(ideDisplayName(id)))
    .join('  ');

  const langLabel = lang === 'pt' ? 'Comunicação' : 'Communication';
  p.log.message(`  ${langLabel}  ${pc.cyan(lang)}`);
  p.log.message(`  Scope       ${scopeLabel}`);
  p.log.message(`  IDEs        ${ideLabels || pc.dim('none')}`);
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

  // Count skills (not files) per IDE
  const byIDE = {};
  for (const id of ides) {
    byIDE[id] = { skills: 0, assets: 0 };
  }
  for (const f of result.files) {
    const isSkill = f.source.startsWith('core/');
    for (const id of ides) {
      const cfg = IDE_CONFIG[id];
      if (cfg && f.path.startsWith(cfg.dir + '/')) {
        if (isSkill) byIDE[id].skills++;
        else byIDE[id].assets++;
      }
    }
  }

  for (const id of ides) {
    if (id === 'gemini-commands') continue;
    const cfg = IDE_CONFIG[id];
    if (!cfg) continue;
    const { skills, assets } = byIDE[id] ?? { skills: 0, assets: 0 };
    // Plugin delivery already nests under the package root; do not append
    // SKILL_NAMESPACE again (would print .../skills/atomic-skills/).
    const dirLabel = cfg.delivery === 'plugin'
      ? `${cfg.dir}/`
      : `${cfg.dir}/${SKILL_NAMESPACE}/`;
    const detail = assets > 0 ? ` ${pc.dim(`(+${assets} assets)`)}` : '';
    p.log.success(`${pc.bold(ideDisplayName(id))}  ${m.skillsCount(skills)}${detail} → ${pc.dim(dirLabel)}`);
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
    byIDE[id] = { skills: 0, assets: 0 };
  }
  for (const f of result.files) {
    const isSkill = f.source.startsWith('core/');
    for (const id of ides) {
      const cfg = IDE_CONFIG[id];
      if (cfg && f.path.startsWith(cfg.dir + '/')) {
        if (isSkill) byIDE[id].skills++;
        else byIDE[id].assets++;
      }
    }
  }

  for (const id of ides) {
    if (id === 'gemini-commands') continue;
    const cfg = IDE_CONFIG[id];
    if (!cfg) continue;
    const { skills } = byIDE[id] ?? { skills: 0 };
    p.log.success(`${pc.bold(ideDisplayName(id))}  ${m.skillsCount(skills)}`);
  }

  // Surface effective reconciler decisions when present (F2/T-003)
  if (result.decisions) {
    const bits = [];
    for (const key of ['preserved', 'conflict', 'modified', 'stale', 'missing']) {
      const n = result.decisions[key]?.length || 0;
      if (n > 0) bits.push(`${n} ${key}`);
    }
    if (bits.length > 0) {
      p.log.warn(pc.yellow('Decisions:') + ' ' + bits.join(', '));
    }
  }

  p.outro(`${m.done} ${m.filesInstalled(result.files.length)}`);
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

/**
 * Main action select: Install/Update, customize lang/ides, view conflicts, quit.
 * @param {string} lang
 * @param {object} opts
 * @param {boolean} opts.isUpdate
 * @param {boolean} opts.hasConflicts
 * @returns {Promise<string>} 'install'|'customize-lang'|'customize-ides'|'view-conflicts'|'quit'
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
 * Select communication language: which language Claude (or other AI) should
 * use when talking to the user in this project. Skill source is always EN;
 * this preference is injected as a directive at the top of each rendered skill.
 *
 * @param {string} lang - current language (used to pre-select)
 * @returns {Promise<string>} language code (e.g. 'pt', 'en', 'ja', 'fr')
 */
export async function promptLanguageSelection(lang) {
  const m = msg(lang);

  const result = await p.select({
    message: m.selectLang,
    options: [
      { value: 'pt', label: 'Português (BR)' },
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' },
      { value: '__other', label: lang === 'pt' ? 'Outro (digitar código)' : 'Other (type code)' },
    ],
    initialValue: lang,
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  if (result === '__other') {
    const custom = await p.text({
      message: lang === 'pt'
        ? 'Digite o código do idioma (ex: ja, ko, zh, it, ru):'
        : 'Type the language code (e.g. ja, ko, zh, it, ru):',
      placeholder: 'ja',
      validate: (v) => {
        if (!v || v.trim().length < 2) {
          return lang === 'pt' ? 'Mínimo 2 caracteres' : 'At least 2 characters';
        }
      },
    });

    if (p.isCancel(custom)) {
      p.cancel(m.cancelled);
      process.exit(0);
    }

    return custom.trim().toLowerCase();
  }

  return result;
}

/**
 * Select install scope. Project scope is only offered when the current
 * directory resolves to a valid, writable Git worktree root.
 * @param {string} lang
 * @param {object} opts
 * @param {{ok: boolean, path?: string, reason?: string}} opts.projectTarget
 * @param {'user'|'project'} opts.initialScope
 * @returns {Promise<'user'|'project'>}
 */
export async function promptInstallScope(lang, opts = {}) {
  const m = msg(lang);
  const projectTarget = opts.projectTarget || { ok: false, reason: 'No project target resolved.' };
  const options = [
    { value: 'user', label: m.scopeUserInstall, hint: '~/' },
  ];

  if (projectTarget.ok) {
    options.push({ value: 'project', label: m.scopeProjectInstall, hint: projectTarget.path });
  } else {
    p.log.warn(m.scopeProjectUnavailable(projectTarget.reason));
  }

  const initialValue = projectTarget.ok && opts.initialScope === 'project' ? 'project' : 'user';
  const result = await p.select({
    message: m.selectScope,
    options,
    initialValue,
  });

  if (p.isCancel(result)) {
    p.cancel(m.cancelled);
    process.exit(0);
  }

  return result;
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
