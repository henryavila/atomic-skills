import inquirer from 'inquirer';
import { IDE_CONFIG } from './config.js';

const MESSAGES = {
  pt: {
    ideQuestion: 'Quais IDEs você usa?',
    ideValidation: 'Selecione ao menos uma IDE.',
    reuseConfig: 'Usar mesma configuração?',
    confirmUninstall: 'Remover arquivos gerados?',
    conflictPrompt: (file) => `⚠ ${file} foi modificado localmente.`,
    conflictOverwrite: 'Sobrescrever (perder mudanças locais)',
    conflictKeep: 'Manter versão local',
    conflictDiff: 'Ver diff',
    scopeQuestion: 'Escopo de instalação:',
    scopeProject: 'Projeto — somente este repo',
    scopeUser: 'Usuário — todos os seus repos',
    uninstallScopeQuestion: 'Qual instalação remover?',
  },
  en: {
    ideQuestion: 'Which IDEs do you use?',
    ideValidation: 'Select at least one IDE.',
    reuseConfig: 'Use same configuration?',
    confirmUninstall: 'Remove generated files?',
    conflictPrompt: (file) => `⚠ ${file} was modified locally.`,
    conflictOverwrite: 'Overwrite (lose local changes)',
    conflictKeep: 'Keep local version',
    conflictDiff: 'View diff',
    scopeQuestion: 'Installation scope:',
    scopeProject: 'Project — this repo only',
    scopeUser: 'User — all your repos',
    uninstallScopeQuestion: 'Which installation to remove?',
  },
};

export async function promptLanguage() {
  const { language } = await inquirer.prompt([{
    type: 'list',
    name: 'language',
    message: 'Language / Idioma:',
    choices: [
      { name: 'Português (BR)', value: 'pt' },
      { name: 'English', value: 'en' },
    ],
  }]);
  return language;
}

export async function promptScope(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: msg.scopeQuestion,
    choices: [
      { name: msg.scopeProject, value: 'project' },
      { name: msg.scopeUser, value: 'user' },
    ],
  }]);
  return scope;
}

export async function promptUninstallScope(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: msg.uninstallScopeQuestion,
    choices: [
      { name: msg.scopeProject, value: 'project' },
      { name: msg.scopeUser, value: 'user' },
    ],
  }]);
  return scope;
}

export async function promptIDEs(lang, scope = 'project') {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const ideEntries = scope === 'user'
    ? Object.entries(IDE_CONFIG).filter(([_, cfg]) => cfg.supportsUserScope)
    : Object.entries(IDE_CONFIG);

  const { ides } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'ides',
    message: msg.ideQuestion,
    choices: ideEntries.map(([id, cfg]) => ({
      name: cfg.name,
      value: id,
    })),
    validate: (input) => input.length > 0 || msg.ideValidation,
  }]);
  return ides;
}

export async function promptModule(lang, moduleConfig) {
  const display = moduleConfig.display_name[lang] || moduleConfig.display_name.en;
  const desc = moduleConfig.description[lang] || moduleConfig.description.en;

  console.log(`\n  📦 ${display}`);
  console.log(`  ${desc.trim().split('\n').join('\n  ')}`);

  const defaultPath = moduleConfig.variables.memory_path.default;
  const choices = lang === 'pt'
    ? [
        { name: `Instalar com padrão (${defaultPath})`, value: 'default' },
        { name: 'Escolher diretório customizado', value: 'custom' },
        { name: 'Não instalar', value: 'skip' },
      ]
    : [
        { name: `Install with default (${defaultPath})`, value: 'default' },
        { name: 'Choose custom directory', value: 'custom' },
        { name: 'Do not install', value: 'skip' },
      ];

  const { choice } = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: '',
    choices,
  }]);

  if (choice === 'skip') return null;

  if (choice === 'custom') {
    const varDesc = moduleConfig.variables.memory_path.description[lang] || moduleConfig.variables.memory_path.description.en;
    const { customPath } = await inquirer.prompt([{
      type: 'input',
      name: 'customPath',
      message: `${varDesc}:`,
      default: defaultPath,
    }]);
    return { memory_path: customPath };
  }

  return { memory_path: defaultPath };
}

export async function promptReuseConfig(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { reuse } = await inquirer.prompt([{
    type: 'confirm',
    name: 'reuse',
    message: msg.reuseConfig,
    default: true,
  }]);
  return reuse;
}

export async function promptConflict(lang, filePath) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  console.log(`\n  ${msg.conflictPrompt(filePath)}`);
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '',
    choices: [
      { name: msg.conflictOverwrite, value: 'overwrite' },
      { name: msg.conflictKeep, value: 'keep' },
      { name: msg.conflictDiff, value: 'diff' },
    ],
  }]);
  return action;
}

export async function promptConfirmUninstall(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: msg.confirmUninstall,
    default: false,
  }]);
  return confirm;
}
