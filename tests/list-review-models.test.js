import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'list-review-models.js');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'cross-model-bridge');
const CODEX_CATALOG = join(FIXTURES, 'codex-models-catalog-slim.json');
const GROK_LIST = join(FIXTURES, 'grok-models-list.txt');

/** Run the script without a provider CLI on PATH unless the test supplies one. */
function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, ...env },
  });
}

function writeStub(binDir, name, bodyText) {
  const path = join(binDir, name);
  writeFileSync(path, `#!/bin/sh\n${bodyText}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** Record each stub's argv in $FAKE_ARGV_DIR/<name>.argv, one token per line. */
function writeArgvStub(binDir, name, output) {
  return writeStub(
    binDir,
    name,
    [
      `printf '%s\\n' "$@" > "$FAKE_ARGV_DIR/${name}.argv"`,
      `printf '%s' '${output.replace(/'/g, "'\\''")}'`,
    ].join('\n'),
  );
}

describe('list-review-models CLI', () => {
  let tempDir;
  let binDir;
  let argvDir;
  let env;

  beforeEach(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'as-list-review-models-')));
    binDir = join(tempDir, 'bin');
    argvDir = join(tempDir, 'argv');
    mkdirSync(binDir);
    mkdirSync(argvDir);
    env = { PATH: binDir, FAKE_ARGV_DIR: argvDir };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('--help prints the usage line and exits 0 without a provider', () => {
    const result = run(['--help'], env);
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      'Usage: list-review-models.js --provider=codex|grok|claude|agy [--resolve] [--model=ID] [--ask-model] [--interactive] [--user-choice=ID] [--catalog=path] [--human]\n',
    );
    assert.equal(result.stderr, '');
  });

  it('a missing or unknown provider exits 1 with the usage error', () => {
    for (const args of [[], ['--provider=other'], ['--provider']]) {
      const result = run(args, env);
      assert.equal(result.status, 1, `args: ${args.join(' ')}`);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'ERROR: --provider=codex|grok|claude|agy is required\n');
    }
  });

  it('lists a codex file catalog as JSON with the recommended model', () => {
    const result = run(['--provider=codex', `--catalog=${CODEX_CATALOG}`], env);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.ok(result.stdout.endsWith('\n'));
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.provider, 'codex');
    assert.equal(payload.catalogError, null);
    assert.deepEqual(payload.recommended, {
      slug: 'gpt-5.6-sol',
      displayName: 'GPT-5.6-Sol',
      description: 'Latest frontier agentic coding model.',
    });
    assert.deepEqual(
      payload.models.map((m) => m.slug),
      ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2'],
    );
    assert.deepEqual(Object.keys(payload.models[0]), [
      'slug',
      'displayName',
      'description',
      'priority',
      'isDefault',
      'visibility',
    ]);
  });

  it('--human renders the same catalog as text', () => {
    const result = run(['--provider=grok', `--catalog=${GROK_LIST}`, '--human'], env);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.equal(
      result.stdout,
      [
        'provider: grok',
        'recommended: grok-4.5',
        '  - grok-4.5 * — CLI default',
        '  - grok-3-mini',
        '  - grok-4',
        '',
      ].join('\n'),
    );
  });

  it('--json after --human turns the JSON listing back on', () => {
    const result = run(['--provider=grok', `--catalog=${GROK_LIST}`, '--human', '--json'], env);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).provider, 'grok');
  });

  it('--resolve reports the explicit model and flag', () => {
    const result = run(
      ['--provider=codex', `--catalog=${CODEX_CATALOG}`, '--resolve', '--model=gpt-5.5'],
      env,
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.action, 'run');
    assert.equal(payload.modelId, 'gpt-5.5');
    assert.equal(payload.modelFlag, '--model gpt-5.5');
    assert.equal(payload.source, 'explicit');
    assert.equal(payload.recommended.slug, 'gpt-5.6-sol');
    assert.equal(payload.catalogError, null);
  });

  it('--resolve honours the per-provider agy model flag', () => {
    const result = run(
      ['--provider=agy', `--catalog=${GROK_LIST}`, '--resolve', '--model-agy=pro'],
      env,
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.modelId, 'gemini-3.1-pro-high');
    assert.equal(payload.modelFlag, '--model gemini-3.1-pro-high');
  });

  it('--resolve --ask-model picks the recommended model non-interactively', () => {
    const result = run(
      ['--provider=codex', `--catalog=${CODEX_CATALOG}`, '--resolve', '--ask-model', '--interactive=0'],
      env,
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.action, 'run');
    assert.equal(payload.source, 'recommended');
    assert.equal(payload.modelId, 'gpt-5.6-sol');
  });

  it('--resolve --interactive asks for a pick', () => {
    const result = run(
      ['--provider=grok', `--catalog=${GROK_LIST}`, '--resolve', '--interactive'],
      env,
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.action, 'pick');
    assert.deepEqual(payload.options.map((o) => o.slug), [
      'grok-4.5',
      'grok-3-mini',
      'grok-4',
      'cli-default',
    ]);
  });

  it('discovers codex through `codex debug models --bundled` on PATH', () => {
    writeArgvStub(
      binDir,
      'codex',
      '{"models":[{"slug":"stub-codex","display_name":"Stub Codex","description":"from stub","priority":1,"visibility":"list","supported_reasoning_levels":[{"effort":"high"}]}]}',
    );
    const result = run(['--provider=codex'], env);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.catalogError, null);
    assert.equal(payload.recommended.slug, 'stub-codex');
    assert.equal(
      readFileSync(join(argvDir, 'codex.argv'), 'utf8'),
      'debug\nmodels\n--bundled\n',
    );
  });

  it('discovers grok through `grok models` on PATH', () => {
    writeArgvStub(
      binDir,
      'grok',
      'Default model: grok-stub\n\nAvailable models:\n  * grok-stub (default)\n  * grok-stub-mini\n',
    );
    const result = run(['--provider=grok'], env);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.catalogError, null);
    assert.equal(payload.recommended.slug, 'grok-stub');
    assert.equal(readFileSync(join(argvDir, 'grok.argv'), 'utf8'), 'models\n');
  });

  it('discovers agy through `agy models` on PATH', () => {
    writeArgvStub(binDir, 'agy', 'gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n');
    const result = run(['--provider=antigravity'], env);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.provider, 'agy');
    assert.equal(payload.catalogError, null);
    assert.equal(payload.recommended.slug, 'hybrid');
    assert.ok(payload.models.some((m) => m.slug === 'gemini-3.8-flash-high'));
    assert.equal(readFileSync(join(argvDir, 'agy.argv'), 'utf8'), 'models\n');
  });

  it('claude uses aliases and the `claude --help` text when the CLI is on PATH', () => {
    writeArgvStub(
      binDir,
      'claude',
      'Usage: claude [options]\n  opus, sonnet, haiku, fable  model aliases\n',
    );
    const result = run(['--provider=claude'], env);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.catalogError, null);
    assert.deepEqual(
      payload.models.map((m) => m.slug),
      ['opus', 'sonnet', 'haiku', 'fable'],
    );
    assert.equal(readFileSync(join(argvDir, 'claude.argv'), 'utf8'), '--help\n');
  });

  it('reports a failing provider CLI as catalogError and keeps exit 0', () => {
    writeStub(binDir, 'grok', 'printf "stub exploded" >&2\nexit 3');
    const result = run(['--provider=grok'], env);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.catalogError, 'stub exploded');
    assert.deepEqual(payload.models, []);
    assert.equal(payload.recommended, null);
  });

  it('a missing provider CLI is reported as catalogError, not a crash', () => {
    const result = run(['--provider=codex'], env);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.models.length, 0);
    assert.equal(payload.recommended, null);
    assert.match(payload.catalogError, /ENOENT/);
  });
});
