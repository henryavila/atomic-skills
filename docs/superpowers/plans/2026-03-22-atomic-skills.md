# Atomic Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `atomic-skills` — an npm package that installs optimized developer prompts in the native format of 6 AI IDEs via `npx @henryavila/atomic-skills install`.

**Architecture:** Node.js CLI with interactive prompts (inquirer), a simple template engine (string replacement + single-level conditionals), and a manifest-based tracking system. Skills are Markdown files organized by language (pt/en), rendered into IDE-specific formats (YAML-frontmatter Markdown or TOML).

**Tech Stack:** Node.js (ESM), `inquirer` for interactive prompts, `node:crypto` for hashing, `node:test` + `node:assert` for testing. No template engine — custom render.js.

**Spec:** `docs/superpowers/specs/2026-03-22-atomic-skills-design.md`

---

## File Structure

```
atomic-skills/
├── package.json                          # npm package config, bin entry
├── bin/
│   └── cli.js                            # Entry point — routes to install/uninstall
├── src/
│   ├── config.js                         # IDE definitions (dirs, formats, invocations)
│   ├── hash.js                           # sha256 hashing utility
│   ├── render.js                         # Template engine ({{var}} + {{#if}})
│   ├── manifest.js                       # Read/write/update .atomic-skills/manifest.json
│   ├── prompts.js                        # Interactive prompts (language, IDEs, modules)
│   ├── install.js                        # Install/update orchestrator
│   └── uninstall.js                      # Uninstall orchestrator
├── skills/
│   ├── modules/
│   │   └── memory/
│   │       └── module.yaml               # Bilingual module metadata
│   ├── pt/
│   │   ├── core/
│   │   │   ├── fix.md
│   │   │   ├── resume.md
│   │   │   ├── save-and-push.md
│   │   │   ├── review-plan-internal.md
│   │   │   └── review-plan-vs-artifacts.md
│   │   └── modules/
│   │       └── memory/
│   │           └── init-memory.md
│   └── en/
│       ├── core/
│       │   ├── fix.md
│       │   ├── resume.md
│       │   ├── save-and-push.md
│       │   ├── review-plan-internal.md
│       │   └── review-plan-vs-artifacts.md
│       └── modules/
│           └── memory/
│               └── init-memory.md
├── meta/
│   └── skills.yaml                       # Skill names + English descriptions (frontmatter source)
├── tests/
│   ├── hash.test.js
│   ├── render.test.js
│   ├── manifest.test.js
│   ├── config.test.js
│   └── install.test.js
└── README.md
```

---

### Task 1: Project scaffold + package.json

**Files:**
- Create: `atomic-skills/package.json`
- Create: `atomic-skills/bin/cli.js`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p atomic-skills/bin atomic-skills/src atomic-skills/skills atomic-skills/meta atomic-skills/tests
```

```json
// atomic-skills/package.json
{
  "name": "atomic-skills",
  "version": "1.0.0",
  "description": "Stop rewriting prompts. Install optimized developer skills in any AI IDE.",
  "type": "module",
  "bin": {
    "atomic-skills": "./bin/cli.js"
  },
  "scripts": {
    "test": "node --test tests/"
  },
  "keywords": ["ai", "skills", "prompts", "claude", "cursor", "gemini", "codex", "copilot"],
  "license": "MIT",
  "dependencies": {
    "inquirer": "^9.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Create CLI entry point**

```js
// atomic-skills/bin/cli.js
#!/usr/bin/env node

import { resolve } from 'node:path';
import { argv } from 'node:process';

const command = argv[2];

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd());
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd());
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install      Install skills for your AI IDEs
    npx @henryavila/atomic-skills uninstall    Remove installed skills

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
```

- [ ] **Step 3: Run `npm install` and verify**

```bash
cd atomic-skills && npm install
```

Expected: `node_modules/` created, `inquirer` installed.

- [ ] **Step 4: Test CLI entry point**

```bash
node bin/cli.js
```

Expected: Shows usage text with `⚛ Atomic Skills`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json bin/cli.js
git commit -m "feat: scaffold atomic-skills npm package with CLI entry point"
```

---

### Task 2: IDE config mapping

**Files:**
- Create: `atomic-skills/src/config.js`
- Create: `atomic-skills/tests/config.test.js`

- [ ] **Step 1: Write failing test**

```js
// atomic-skills/tests/config.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from '../src/config.js';

describe('IDE config', () => {
  it('defines all 6 IDEs', () => {
    const ids = Object.keys(IDE_CONFIG);
    assert.deepStrictEqual(ids.sort(), [
      'claude-code', 'codex', 'cursor', 'gemini', 'github-copilot', 'opencode'
    ]);
  });

  it('returns correct skill path for claude-code markdown IDE', () => {
    const path = getSkillPath('claude-code', 'as-fix');
    assert.strictEqual(path, '.claude/skills/as-fix/SKILL.md');
  });

  it('returns correct skill path for gemini toml IDE', () => {
    const path = getSkillPath('gemini', 'as-fix');
    assert.strictEqual(path, '.gemini/commands/as-fix.toml');
  });

  it('returns markdown format for most IDEs', () => {
    assert.strictEqual(getSkillFormat('claude-code'), 'markdown');
    assert.strictEqual(getSkillFormat('cursor'), 'markdown');
    assert.strictEqual(getSkillFormat('codex'), 'markdown');
  });

  it('returns toml format for gemini', () => {
    assert.strictEqual(getSkillFormat('gemini'), 'toml');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/config.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement config.js**

```js
// atomic-skills/src/config.js

export const IDE_CONFIG = {
  'claude-code': {
    name: 'Claude Code',
    dir: '.claude/skills',
    format: 'markdown',
    filePattern: (skillName) => `${skillName}/SKILL.md`,
  },
  'cursor': {
    name: 'Cursor',
    dir: '.cursor/skills',
    format: 'markdown',
    filePattern: (skillName) => `${skillName}/SKILL.md`,
  },
  'gemini': {
    name: 'Gemini CLI',
    dir: '.gemini/commands',
    format: 'toml',
    filePattern: (skillName) => `${skillName}.toml`,
  },
  'codex': {
    name: 'Codex',
    dir: '.agents/skills',
    format: 'markdown',
    filePattern: (skillName) => `${skillName}/SKILL.md`,
  },
  'opencode': {
    name: 'OpenCode',
    dir: '.opencode/skills',
    format: 'markdown',
    filePattern: (skillName) => `${skillName}/SKILL.md`,
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    dir: '.github/skills',
    format: 'markdown',
    filePattern: (skillName) => `${skillName}/SKILL.md`,
  },
};

export function getSkillPath(ideId, skillName) {
  const ide = IDE_CONFIG[ideId];
  return `${ide.dir}/${ide.filePattern(skillName)}`;
}

export function getSkillFormat(ideId) {
  return IDE_CONFIG[ideId].format;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/config.test.js
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add IDE config mapping for 6 supported IDEs"
```

---

### Task 3: Hash utility

**Files:**
- Create: `atomic-skills/src/hash.js`
- Create: `atomic-skills/tests/hash.test.js`

- [ ] **Step 1: Write failing test**

```js
// atomic-skills/tests/hash.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { hashContent } from '../src/hash.js';

describe('hashContent', () => {
  it('returns consistent sha256 for same input', () => {
    const h1 = hashContent('hello world');
    const h2 = hashContent('hello world');
    assert.strictEqual(h1, h2);
  });

  it('returns different hashes for different input', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('world');
    assert.notStrictEqual(h1, h2);
  });

  it('returns a sha256 hex string (64 chars)', () => {
    const h = hashContent('test');
    assert.match(h, /^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/hash.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement hash.js**

```js
// atomic-skills/src/hash.js
import { createHash } from 'node:crypto';

export function hashContent(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/hash.test.js
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hash.js tests/hash.test.js
git commit -m "feat: add sha256 hash utility"
```

---

### Task 4: Template renderer

**Files:**
- Create: `atomic-skills/src/render.js`
- Create: `atomic-skills/tests/render.test.js`

- [ ] **Step 1: Write failing test**

```js
// atomic-skills/tests/render.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderTemplate, renderForIDE } from '../src/render.js';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    const result = renderTemplate('path is {{memory_path}}', { memory_path: '.ai/memory/' });
    assert.strictEqual(result, 'path is .ai/memory/');
  });

  it('keeps block when condition is true', () => {
    const input = 'before\n{{#if modules.memory}}\nmemory line\n{{/if}}\nafter';
    const result = renderTemplate(input, {}, { memory: true });
    assert.strictEqual(result, 'before\nmemory line\nafter');
  });

  it('removes block when condition is false', () => {
    const input = 'before\n{{#if modules.memory}}\nmemory line\n{{/if}}\nafter';
    const result = renderTemplate(input, {}, {});
    assert.strictEqual(result, 'before\nafter');
  });

  it('handles variable inside conditional block', () => {
    const input = '{{#if modules.memory}}\npath: {{memory_path}}\n{{/if}}';
    const result = renderTemplate(input, { memory_path: '.ctx/' }, { memory: true });
    assert.strictEqual(result, 'path: .ctx/');
  });

  it('strips blank lines left by removed blocks', () => {
    const input = 'line1\n\n{{#if modules.memory}}\nremoved\n{{/if}}\n\nline2';
    const result = renderTemplate(input, {}, {});
    assert.strictEqual(result, 'line1\n\nline2');
  });
});

describe('renderForIDE', () => {
  it('renders markdown format with YAML frontmatter', () => {
    const result = renderForIDE('markdown', 'as-fix', 'My description', 'prompt body');
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('name: as-fix'));
    assert.ok(result.includes("description: 'My description'"));
    assert.ok(result.includes('prompt body'));
  });

  it('renders toml format', () => {
    const result = renderForIDE('toml', 'as-fix', 'My description', 'prompt body');
    assert.ok(result.includes('description = "My description"'));
    assert.ok(result.includes('prompt = """'));
    assert.ok(result.includes('prompt body'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/render.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement render.js**

```js
// atomic-skills/src/render.js

/**
 * Process template variables and conditional blocks.
 * @param {string} content - Template content
 * @param {Record<string, string>} vars - Variable substitutions
 * @param {Record<string, boolean>} modules - Installed modules (for conditionals)
 * @returns {string}
 */
export function renderTemplate(content, vars = {}, modules = {}) {
  // Process conditional blocks (single-level, no nesting)
  let result = content.replace(
    /{{#if modules\.(\w+)}}\n([\s\S]*?){{\/if}}\n?/g,
    (_, moduleName, block) => {
      return modules[moduleName] ? block : '';
    }
  );

  // Substitute variables
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Strip consecutive blank lines (more than 2 newlines → 2)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim() + '\n';
}

/**
 * Wrap rendered content in IDE-specific format.
 * @param {'markdown'|'toml'} format
 * @param {string} name - Skill name (e.g. 'as-fix')
 * @param {string} description - English description
 * @param {string} body - Rendered prompt body
 * @returns {string}
 */
export function renderForIDE(format, name, description, body) {
  if (format === 'toml') {
    return `description = "${description}"\nprompt = """\n${body}\n"""\n`;
  }

  // markdown (default)
  return `---\nname: ${name}\ndescription: '${description}'\n---\n\n${body}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/render.test.js
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render.js tests/render.test.js
git commit -m "feat: add template renderer with variable substitution and conditionals"
```

---

### Task 5: Manifest management

**Files:**
- Create: `atomic-skills/src/manifest.js`
- Create: `atomic-skills/tests/manifest.test.js`

- [ ] **Step 1: Write failing test**

```js
// atomic-skills/tests/manifest.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest, writeManifest, MANIFEST_DIR, MANIFEST_FILE } from '../src/manifest.js';

describe('manifest', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no manifest exists', () => {
    const result = readManifest(tempDir);
    assert.strictEqual(result, null);
  });

  it('writes and reads manifest', () => {
    const data = {
      version: '1.0.0',
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      files: {},
    };
    writeManifest(tempDir, data);
    const result = readManifest(tempDir);
    assert.deepStrictEqual(result.version, '1.0.0');
    assert.deepStrictEqual(result.language, 'pt');
  });

  it('creates .atomic-skills/ directory', () => {
    writeManifest(tempDir, { version: '1.0.0' });
    assert.ok(existsSync(join(tempDir, MANIFEST_DIR)));
  });

  it('writes valid JSON', () => {
    writeManifest(tempDir, { version: '1.0.0' });
    const raw = readFileSync(join(tempDir, MANIFEST_DIR, MANIFEST_FILE), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/manifest.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement manifest.js**

```js
// atomic-skills/src/manifest.js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_DIR = '.atomic-skills';
export const MANIFEST_FILE = 'manifest.json';

export function readManifest(projectDir) {
  const filePath = join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function writeManifest(projectDir, data) {
  const dir = join(projectDir, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, MANIFEST_FILE);
  data.updated_at = new Date().toISOString();
  if (!data.installed_at) data.installed_at = data.updated_at;
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/manifest.test.js
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/manifest.js tests/manifest.test.js
git commit -m "feat: add manifest read/write for tracking installed files"
```

---

### Task 6: Interactive prompts

**Files:**
- Create: `atomic-skills/src/prompts.js`

- [ ] **Step 1: Implement prompts.js**

```js
// atomic-skills/src/prompts.js
import inquirer from 'inquirer';
import { IDE_CONFIG } from './config.js';

const MESSAGES = {
  pt: {
    langQuestion: 'Language / Idioma:',
    ideQuestion: 'Quais IDEs você usa?',
    modulesHeader: '─── Módulos opcionais ───',
    reuseConfig: 'Usar mesma configuração?',
    confirmUninstall: 'Remover arquivos gerados?',
    conflictPrompt: (file) => `⚠ ${file} foi modificado localmente.`,
    conflictOverwrite: 'Sobrescrever (perder mudanças locais)',
    conflictKeep: 'Manter versão local',
    conflictDiff: 'Ver diff',
  },
  en: {
    langQuestion: 'Language / Idioma:',
    ideQuestion: 'Which IDEs do you use?',
    modulesHeader: '─── Optional Modules ───',
    reuseConfig: 'Use same configuration?',
    confirmUninstall: 'Remove generated files?',
    conflictPrompt: (file) => `⚠ ${file} was modified locally.`,
    conflictOverwrite: 'Overwrite (lose local changes)',
    conflictKeep: 'Keep local version',
    conflictDiff: 'View diff',
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

export async function promptIDEs(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { ides } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'ides',
    message: msg.ideQuestion,
    choices: Object.entries(IDE_CONFIG).map(([id, cfg]) => ({
      name: cfg.name,
      value: id,
    })),
    validate: (input) => input.length > 0 || (lang === 'pt' ? 'Selecione ao menos uma IDE.' : 'Select at least one IDE.'),
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

export async function promptReuseConfig(lang, manifest) {
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
```

- [ ] **Step 2: Verify import works**

```bash
node -e "import('./src/prompts.js').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/prompts.js
git commit -m "feat: add interactive prompts for language, IDEs, modules, and conflicts"
```

---

### Task 7: Install command

**Files:**
- Create: `atomic-skills/src/install.js`
- Create: `atomic-skills/tests/install.test.js`

- [ ] **Step 1: Write failing test for core install logic**

```js
// atomic-skills/tests/install.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkills } from '../src/install.js';

describe('installSkills (non-interactive core)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-install-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates skill files for selected IDEs', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(import.meta.dirname, '..', 'skills'),
      metaDir: join(import.meta.dirname, '..', 'meta'),
    });

    assert.ok(existsSync(join(tempDir, '.claude/skills/as-fix/SKILL.md')));
    assert.ok(result.files.length > 0);
  });

  it('creates TOML for gemini', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini'],
      modules: {},
      skillsDir: join(import.meta.dirname, '..', 'skills'),
      metaDir: join(import.meta.dirname, '..', 'meta'),
    });

    const geminiFile = join(tempDir, '.gemini/commands/as-fix.toml');
    assert.ok(existsSync(geminiFile));
    const content = readFileSync(geminiFile, 'utf8');
    assert.ok(content.includes('description = "'));
    assert.ok(content.includes('prompt = """'));
  });

  it('substitutes memory_path variable when memory module installed', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: { memory: { installed: true, config: { memory_path: '.custom/mem/' } } },
      skillsDir: join(import.meta.dirname, '..', 'skills'),
      metaDir: join(import.meta.dirname, '..', 'meta'),
    });

    // Check that init-memory skill was created
    assert.ok(existsSync(join(tempDir, '.claude/skills/as-init-memory/SKILL.md')));
  });

  it('adds .atomic-skills/ to .gitignore', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(import.meta.dirname, '..', 'skills'),
      metaDir: join(import.meta.dirname, '..', 'meta'),
    });

    const gitignore = readFileSync(join(tempDir, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.atomic-skills/'));
  });

  it('writes manifest with file hashes', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(import.meta.dirname, '..', 'skills'),
      metaDir: join(import.meta.dirname, '..', 'meta'),
    });

    const manifest = JSON.parse(readFileSync(join(tempDir, '.atomic-skills/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.language, 'en');
    assert.ok(Object.keys(manifest.files).length > 0);
    const firstFile = Object.values(manifest.files)[0];
    assert.ok(firstFile.installed_hash);
    assert.ok(firstFile.source);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/install.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement install.js**

```js
// atomic-skills/src/install.js
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE_CONFIG, getSkillPath, getSkillFormat } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { promptLanguage, promptIDEs, promptModule, promptReuseConfig, promptConflict } from './prompts.js';
import { parse as parseYaml } from './yaml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

/**
 * Core install logic (non-interactive, testable).
 */
export function installSkills(projectDir, options) {
  const { language, ides, modules, skillsDir, metaDir } = options;

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

  // Process core skills
  for (const [skillId, skillMeta] of Object.entries(meta.core || {})) {
    const skillFile = join(skillsDir, language, 'core', `${skillId}.md`);
    let fallback = false;
    let sourceFile = skillFile;

    if (!existsSync(skillFile)) {
      // Fallback to English
      sourceFile = join(skillsDir, 'en', 'core', `${skillId}.md`);
      if (!existsSync(sourceFile)) continue;
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

      createdFiles.push({
        path: relPath,
        hash: hashContent(content),
        source: `core/${skillId}`,
      });
    }

    if (fallback) {
      console.log(`  ⚠ ${skillMeta.name}: fallback to en (${language} not available)`);
    }
  }

  // Process module skills
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (!modConfig.installed) continue;

    const modMeta = meta.modules?.[modName];
    if (!modMeta) continue;

    for (const [skillId, skillMeta] of Object.entries(modMeta)) {
      const skillFile = join(skillsDir, language, 'modules', modName, `${skillId}.md`);
      let sourceFile = skillFile;

      if (!existsSync(skillFile)) {
        sourceFile = join(skillsDir, 'en', 'modules', modName, `${skillId}.md`);
        if (!existsSync(sourceFile)) continue;
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

        createdFiles.push({
          path: relPath,
          hash: hashContent(content),
          source: `modules/${modName}/${skillId}`,
        });
      }
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
    console.log(`  Configuração anterior encontrada (${MANIFEST_DIR}/manifest.json).`);
    console.log(`  Idioma: ${existingManifest.language} | IDEs: ${existingManifest.ides.join(', ')} | Módulos: ${Object.keys(existingManifest.modules).filter(m => existingManifest.modules[m].installed).join(', ') || 'nenhum'}\n`);

    const reuse = await promptReuseConfig(existingManifest.language, existingManifest);
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

  // Handle update conflict detection
  if (existingManifest) {
    // TODO: implement 3-hash conflict detection per spec section 8
    // For now, overwrite all
  }

  console.log('\n  Instalando...');

  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  const result = installSkills(projectDir, { language, ides, modules, skillsDir, metaDir });

  for (const f of result.files) {
    console.log(`  ✓ ${f.path}`);
  }

  const uniqueSkills = new Set(result.files.map(f => f.source)).size;
  console.log(`\n  ⚛ ${uniqueSkills} skills instalados para ${ides.length} IDE${ides.length > 1 ? 's' : ''} (${result.files.length} arquivos).\n`);
}
```

- [ ] **Step 4: Create minimal YAML parser with tests**

The project needs to parse `skills.yaml` and `module.yaml`. Rather than adding `js-yaml` as a dependency, create a minimal parser for the simple YAML structures used:

```js
// atomic-skills/src/yaml.js

/**
 * Minimal YAML parser for the simple structures used in skills.yaml and module.yaml.
 * Supports: string values, nested objects (2 levels), multiline strings (|).
 * Does NOT support: arrays, comments inline, anchors, tags, flow style.
 */
export function parse(input) {
  const lines = input.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  let multilineKey = null;
  let multilineIndent = 0;
  let multilineValue = '';

  for (const line of lines) {
    // Handle multiline string continuation
    if (multilineKey !== null) {
      const lineIndent = line.search(/\S/);
      if (lineIndent >= multilineIndent && line.trim() !== '') {
        multilineValue += line.slice(multilineIndent) + '\n';
        continue;
      } else {
        // End of multiline
        setNestedValue(stack, multilineKey, multilineValue.trimEnd());
        multilineKey = null;
      }
    }

    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const match = trimmed.match(/^(\w[\w.-]*)\s*:\s*(.*)/);
    if (!match) continue;

    const [, key, rawValue] = match;

    // Pop stack to correct nesting level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const value = rawValue.trim();

    if (value === '' || value === '|') {
      // Nested object or multiline string
      if (value === '|') {
        multilineKey = key;
        multilineIndent = indent + 2;
        multilineValue = '';
      } else {
        const newObj = {};
        stack[stack.length - 1].obj[key] = newObj;
        stack.push({ obj: newObj, indent });
      }
    } else {
      // Simple value — strip quotes
      const cleaned = value.replace(/^['"]|['"]$/g, '');
      stack[stack.length - 1].obj[key] = cleaned;
    }
  }

  // Flush any remaining multiline
  if (multilineKey !== null) {
    setNestedValue(stack, multilineKey, multilineValue.trimEnd());
  }

  return result;
}

function setNestedValue(stack, key, value) {
  stack[stack.length - 1].obj[key] = value;
}
```

- [ ] **Step 5: Write YAML parser tests**

```js
// atomic-skills/tests/yaml.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from '../src/yaml.js';

describe('YAML parser', () => {
  it('parses simple key-value pairs', () => {
    const result = parse('name: as-fix\nversion: 1.0.0');
    assert.strictEqual(result.name, 'as-fix');
    assert.strictEqual(result.version, '1.0.0');
  });

  it('parses nested objects', () => {
    const result = parse('core:\n  fix:\n    name: as-fix');
    assert.strictEqual(result.core.fix.name, 'as-fix');
  });

  it('strips quotes from values', () => {
    const result = parse("description: 'hello world'");
    assert.strictEqual(result.description, 'hello world');
  });

  it('parses multiline strings with pipe', () => {
    const result = parse('description:\n  pt: |\n    line one\n    line two\n  en: |\n    eng one\n    eng two');
    assert.ok(result.description.pt.includes('line one'));
    assert.ok(result.description.pt.includes('line two'));
    assert.ok(result.description.en.includes('eng one'));
  });

  it('parses the actual module.yaml structure', () => {
    const input = `name: memory
display_name:
  pt: Memória
  en: Memory
description:
  pt: |
    Sistema de memória persistente.
  en: |
    Persistent memory system.
variables:
  memory_path:
    description:
      pt: Diretório da memória
      en: Memory directory
    default: .ai/memory/`;
    const result = parse(input);
    assert.strictEqual(result.name, 'memory');
    assert.strictEqual(result.display_name.pt, 'Memória');
    assert.strictEqual(result.description.pt, 'Sistema de memória persistente.');
    assert.strictEqual(result.variables.memory_path.default, '.ai/memory/');
  });
});
```

- [ ] **Step 6: Run YAML tests**

```bash
node --test tests/yaml.test.js
```

Expected: All 5 tests PASS. If any fail, fix the parser and re-run.

- [ ] **Step 7: Verify install module loads**

```bash
node -e "import('./src/install.js').then(() => console.log('OK'))"
```

Expected: `OK` (install.test.js needs Task 9+10 content to fully pass)

- [ ] **Step 8: Commit**

```bash
git add src/install.js src/yaml.js tests/yaml.test.js
git commit -m "feat: add install command with YAML parser, rendering, and gitignore management"
```

---

### Task 8: Uninstall command

**Files:**
- Create: `atomic-skills/src/uninstall.js`

- [ ] **Step 1: Implement uninstall.js**

```js
// atomic-skills/src/uninstall.js
import { unlinkSync, rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { promptConfirmUninstall } from './prompts.js';

export async function uninstall(projectDir) {
  console.log('\n  ⚛ Removendo Atomic Skills...\n');

  const manifest = readManifest(projectDir);
  if (!manifest) {
    console.log('  Nenhuma instalação encontrada.\n');
    return;
  }

  const lang = manifest.language || 'en';
  const confirmed = await promptConfirmUninstall(lang);
  if (!confirmed) {
    console.log('  Cancelado.\n');
    return;
  }

  let removed = 0;
  for (const relPath of Object.keys(manifest.files)) {
    const absPath = join(projectDir, relPath);
    if (existsSync(absPath)) {
      unlinkSync(absPath);
      removed++;

      // Remove parent directory if empty
      const parentDir = dirname(absPath);
      try {
        if (readdirSync(parentDir).length === 0) {
          rmdirSync(parentDir);
        }
      } catch {
        // Ignore — parent might not be empty or might not exist
      }
    }
  }

  // Remove manifest
  const manifestPath = join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  const manifestDir = join(projectDir, MANIFEST_DIR);
  try {
    if (existsSync(manifestDir) && readdirSync(manifestDir).length === 0) {
      rmdirSync(manifestDir);
    }
  } catch {
    // Ignore
  }

  console.log(`  ✓ ${removed} arquivos removidos.`);
  console.log(`  ✓ ${MANIFEST_DIR}/manifest.json removido.`);
  console.log(`  ℹ Entrada .atomic-skills/ mantida no .gitignore (segurança).\n`);
  console.log('  ⚛ Desinstalação completa.\n');
}
```

- [ ] **Step 2: Verify import works**

```bash
node -e "import('./src/uninstall.js').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/uninstall.js
git commit -m "feat: add uninstall command with manifest-based file removal"
```

---

### Task 9: Skill metadata files

**Files:**
- Create: `atomic-skills/meta/skills.yaml`
- Create: `atomic-skills/skills/modules/memory/module.yaml`

- [ ] **Step 1: Create skills.yaml**

```yaml
# atomic-skills/meta/skills.yaml
core:
  fix:
    name: as-fix
    description: "Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior."
  resume:
    name: as-resume
    description: "Investigate project context and generate a handoff prompt for a clean session."
  save-and-push:
    name: as-save-and-push
    description: "Review conversation, save learnings to memory, commit and push work."
  review-plan-internal:
    name: as-review-plan-internal
    description: "Adversarial review of an implementation plan for gaps and risks."
  review-plan-vs-artifacts:
    name: as-review-plan-vs-artifacts
    description: "Adversarial review comparing plan against actual generated artifacts."

modules:
  memory:
    init-memory:
      name: as-init-memory
      description: "Initialize persistent memory structure for cross-session context."
```

- [ ] **Step 2: Create module.yaml**

```yaml
# atomic-skills/skills/modules/memory/module.yaml
name: memory
display_name:
  pt: Memória
  en: Memory
description:
  pt: |
    Sistema de memória persistente entre sessões.
    O agente salva aprendizados, decisões e feedback entre conversas,
    mantendo contexto entre sessões diferentes.
  en: |
    Persistent memory system across sessions.
    The agent saves learnings, decisions and feedback between conversations,
    maintaining context across different sessions.
variables:
  memory_path:
    description:
      pt: Diretório da memória
      en: Memory directory
    default: .ai/memory/
```

- [ ] **Step 3: Commit**

```bash
git add meta/skills.yaml skills/modules/memory/module.yaml
git commit -m "feat: add skill metadata and memory module config"
```

---

### Task 10: Adapt core skills — Portuguese (pt)

**Files:**
- Create: `atomic-skills/skills/pt/core/fix.md`
- Create: `atomic-skills/skills/pt/core/resume.md`
- Create: `atomic-skills/skills/pt/core/save-and-push.md`
- Create: `atomic-skills/skills/pt/core/review-plan-internal.md`
- Create: `atomic-skills/skills/pt/core/review-plan-vs-artifacts.md`
- Create: `atomic-skills/skills/pt/modules/memory/init-memory.md`
- Source: `claude/commands/hca-*.md` (from the claude-commands repo)

- [ ] **Step 1: Adapt hca-fix → as-fix (pt)**

Read `claude/commands/hca-fix.md` from the source repo. Apply all 7 adaptations from spec section 10:
1. Replace `/hca-*` references with generic skill names (no `/` or `$` prefix)
2. Parametrize `{{memory_path}}` where `.ai/memory/` is hardcoded
3. Wrap memory references in `{{#if modules.memory}}...{{/if}}`
4. Remove personal setup references (nexus.yaml, etc.)
5. Keep all techniques (Iron Laws, HARD-GATEs, Red Flags, Racionalização)
6. File goes to `skills/pt/core/fix.md`
7. No platform-specific logic

Write the adapted file to `skills/pt/core/fix.md`.

- [ ] **Step 2: Adapt hca-resume → as-resume (pt)**

Same adaptation rules. Read `claude/commands/hca-resume.md`, apply adaptations, write to `skills/pt/core/resume.md`.

Key changes: remove references to `nexus.yaml`, `_bmad/`, Claude-specific paths. Make framework detection generic.

- [ ] **Step 3: Adapt hca-save-and-push → as-save-and-push (pt)**

Same adaptation rules. Read `claude/commands/hca-save-and-push.md`, apply adaptations, write to `skills/pt/core/save-and-push.md`.

Key change: wrap memory section in `{{#if modules.memory}}`.

- [ ] **Step 4: Adapt hca-review-plan-internal → as-review-plan-internal (pt)**

Same adaptation rules. Write to `skills/pt/core/review-plan-internal.md`.

- [ ] **Step 5: Adapt hca-review-plan-vs-artifacts → as-review-plan-vs-artifacts (pt)**

Same adaptation rules. Write to `skills/pt/core/review-plan-vs-artifacts.md`.

- [ ] **Step 6: Adapt hca-init-memory → as-init-memory (pt, module)**

Critical adaptations beyond the standard 7:
- Remove ALL symlink logic (`ln -s`, `readlink`)
- Remove Claude-specific paths (`~/.claude/projects/`)
- Keep: directory creation, MEMORY.md creation, file migration, validation
- Make OS/IDE-agnostic: use generic "create directory" instead of `ln -s`
- Parametrize `{{memory_path}}` throughout

Write to `skills/pt/modules/memory/init-memory.md`.

- [ ] **Step 7: Commit all pt skills**

```bash
git add skills/pt/
git commit -m "feat: add Portuguese skill content (5 core + 1 module)"
```

---

### Task 11: Translate skills to English

**Files:**
- Create: `atomic-skills/skills/en/core/fix.md`
- Create: `atomic-skills/skills/en/core/resume.md`
- Create: `atomic-skills/skills/en/core/save-and-push.md`
- Create: `atomic-skills/skills/en/core/review-plan-internal.md`
- Create: `atomic-skills/skills/en/core/review-plan-vs-artifacts.md`
- Create: `atomic-skills/skills/en/modules/memory/init-memory.md`

- [ ] **Step 1: Translate fix.md**

Read `skills/pt/core/fix.md`. Translate all Portuguese text to English. Keep `{{var}}` and `{{#if}}` blocks unchanged. Write to `skills/en/core/fix.md`.

- [ ] **Step 2: Translate resume.md**

Same process. Write to `skills/en/core/resume.md`.

- [ ] **Step 3: Translate save-and-push.md**

Same process. Write to `skills/en/core/save-and-push.md`.

- [ ] **Step 4: Translate review-plan-internal.md**

Same process. Write to `skills/en/core/review-plan-internal.md`.

- [ ] **Step 5: Translate review-plan-vs-artifacts.md**

Same process. Write to `skills/en/core/review-plan-vs-artifacts.md`.

- [ ] **Step 6: Translate init-memory.md**

Same process. Write to `skills/en/modules/memory/init-memory.md`.

- [ ] **Step 7: Commit all en skills**

```bash
git add skills/en/
git commit -m "feat: add English skill content (5 core + 1 module)"
```

---

### Task 12: Run full test suite

**Files:**
- Modify: `atomic-skills/tests/install.test.js` (verify it passes now)

- [ ] **Step 1: Run all tests**

```bash
node --test tests/
```

Expected: All tests PASS (hash, render, config, manifest, install).

- [ ] **Step 2: Fix any failures**

If any test fails, fix the issue in the corresponding source file and re-run.

- [ ] **Step 3: Commit fixes if any**

```bash
git add -A && git commit -m "fix: resolve test failures from integration"
```

---

### Task 13: End-to-end smoke test

- [ ] **Step 1: Create a temp project and run install**

```bash
mkdir /tmp/test-project && cd /tmp/test-project && git init
node /path/to/atomic-skills/bin/cli.js install
```

Select: English, Claude Code + Gemini CLI, Memory with default path.

- [ ] **Step 2: Verify generated files**

```bash
ls .claude/skills/as-fix/SKILL.md       # Should exist
ls .gemini/commands/as-fix.toml          # Should exist
ls .claude/skills/as-init-memory/SKILL.md  # Should exist (memory module)
cat .atomic-skills/manifest.json         # Should have all files listed
cat .gitignore                           # Should contain .atomic-skills/
```

- [ ] **Step 3: Verify SKILL.md format**

```bash
head -5 .claude/skills/as-fix/SKILL.md
```

Expected:
```
---
name: as-fix
description: 'Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior.'
---
```

- [ ] **Step 4: Verify TOML format**

```bash
head -3 .gemini/commands/as-fix.toml
```

Expected:
```
description = "Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior."
prompt = """
```

- [ ] **Step 5: Run uninstall**

```bash
node /path/to/atomic-skills/bin/cli.js uninstall
```

Confirm removal. Verify files are gone:

```bash
ls .claude/skills/as-fix/SKILL.md 2>/dev/null && echo "FAIL: file still exists" || echo "OK: removed"
ls .atomic-skills/manifest.json 2>/dev/null && echo "FAIL: manifest still exists" || echo "OK: removed"
```

- [ ] **Step 6: Cleanup**

```bash
rm -rf /tmp/test-project
```

---

### Task 14: README.md

**Files:**
- Create: `atomic-skills/README.md`

- [ ] **Step 1: Write README**

Content should include:
- Project name, tagline, concept
- Quick start (`npx @henryavila/atomic-skills install`)
- Supported IDEs table (from spec section 4)
- Available skills list with descriptions
- Modules section (Memory)
- Update and uninstall instructions
- Contributing section (how to add skills/languages)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation guide and skill reference"
```

---

### Task 15: SIGINT handler for atomic install

**Files:**
- Modify: `atomic-skills/src/install.js`

- [ ] **Step 1: Refactor installSkills to accept an `onFileWritten` callback**

Modify `installSkills()` to accept an optional `onFileWritten(relPath)` callback that is called immediately after each file is written. This allows the SIGINT handler to track files in real-time.

```js
// In installSkills signature:
export function installSkills(projectDir, options, { onFileWritten } = {}) {
  // ... after each writeFileSync(absPath, ...):
  if (onFileWritten) onFileWritten(relPath);
  // ...
}
```

- [ ] **Step 2: Add SIGINT cleanup to install function**

In `install()`, before calling `installSkills()`, register a SIGINT handler:

```js
const writtenFiles = [];
const cleanup = () => {
  for (const f of writtenFiles) {
    try { unlinkSync(join(projectDir, f)); } catch {}
  }
  console.log('\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n');
  process.exit(1);
};
process.on('SIGINT', cleanup);

const result = installSkills(projectDir, options, {
  onFileWritten: (path) => writtenFiles.push(path),
});

process.removeListener('SIGINT', cleanup);
```

- [ ] **Step 2: Test manually with Ctrl+C**

Run `node bin/cli.js install` in a test project, press Ctrl+C during IDE selection. Verify no files were created.

- [ ] **Step 3: Commit**

```bash
git add src/install.js
git commit -m "feat: add SIGINT handler for atomic install (cleanup on Ctrl+C)"
```

---

### Task 16: Update conflict detection

**Files:**
- Modify: `atomic-skills/src/install.js`

- [ ] **Step 1: Implement 3-hash comparison in install**

Replace the `// TODO` in `install()` with the actual conflict detection logic from spec section 8:

```js
// For each file in existing manifest:
// 1. new_hash = hash of freshly rendered content
// 2. installed_hash = manifest.files[path].installed_hash
// 3. current_hash = hash of file on disk
// Compare per the 4-case table in spec section 8
```

- [ ] **Step 2: Wire promptConflict for conflict case**

When `current_hash !== installed_hash && new_hash !== installed_hash`, call `promptConflict()` and handle overwrite/keep/diff.

- [ ] **Step 3: Implement orphan file removal for deselected IDEs/modules**

When re-installing with different config (user answered "n" to reuse), compare old manifest files against newly generated files. Files in the old manifest that are NOT in the new file list are orphans from deselected IDEs/modules and must be deleted:

```js
// After installSkills returns the new file list:
if (existingManifest) {
  const newPaths = new Set(result.files.map(f => f.path));
  for (const oldPath of Object.keys(existingManifest.files)) {
    if (!newPaths.has(oldPath)) {
      const absPath = join(projectDir, oldPath);
      if (existsSync(absPath)) unlinkSync(absPath);
      // Remove empty parent dir
      try { rmdirSync(dirname(absPath)); } catch {}
      console.log(`  ✗ ${oldPath} (removido — IDE/módulo deselecionado)`);
    }
  }
}
```

- [ ] **Step 4: Add diff display**

When user selects "diff", show a simple line-by-line comparison between the current file and the new version.

- [ ] **Step 5: Test with a modified skill file**

1. Install skills in a test project
2. Manually edit one SKILL.md
3. Re-run install
4. Verify conflict prompt appears

- [ ] **Step 6: Test orphan removal**

1. Install with Claude Code + Cursor
2. Re-run install, answer "n" to reuse, select only Claude Code
3. Verify Cursor files are removed

- [ ] **Step 7: Commit**

```bash
git add src/install.js
git commit -m "feat: add 3-hash conflict detection and orphan removal for safe updates"
```

---

### Task 17: Publish preparation

- [ ] **Step 1: Verify package.json fields**

Ensure `name`, `version`, `description`, `bin`, `keywords`, `license`, `repository`, `files` are all set.

Add `files` field to whitelist published files:

```json
"files": [
  "bin/",
  "src/",
  "skills/",
  "meta/",
  "README.md"
]
```

- [ ] **Step 2: Test npx simulation**

```bash
npm pack                        # Creates atomic-skills-1.0.0.tgz
cd /tmp && mkdir test-npx && cd test-npx && git init
npm exec --package=../atomic-skills-1.0.0.tgz -- atomic-skills install
```

Verify the full install flow works from the packed tarball.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: prepare package.json for npm publish"
```
