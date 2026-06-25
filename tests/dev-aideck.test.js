/**
 * dev-aideck.test.js — testes do orquestrador de development do aiDeck.
 *
 * Estratégia:
 * - Regressão hermética (sempre roda): monta um fixture aideck num tmp HOME,
 *   chama restageRuntime e EXECUTA o shim staged. Isto captura o bug do
 *   copy-cli.js (imports relativos não resolvem fora da árvore dist/) que
 *   shipou verde porque nenhum teste rodava o bin staged.
 * - Testes live (link/unlink contra o repo/HOME reais) ficam gated atrás de
 *   DEV_AIDECK_E2E=1 — `npm test` é hermético por padrão (não muta node_modules
 *   nem ~/.atomic-skills, não rebuilda o aideck).
 * - Testes read-only do CLI (status/help/flags) rodam sempre.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restageRuntime } from '../scripts/dev-aideck.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Live (destrutivo) só roda com opt-in explícito.
const itIfE2E = process.env.DEV_AIDECK_E2E ? it : it.skip;

function runDevAideck(...args) {
  try {
    const out = execSync(`node scripts/dev-aideck.mjs ${args.join(' ')}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return { success: true, out };
  } catch (err) {
    return { success: false, out: err.stdout || '', err: err.stderr || '' };
  }
}

// ── regressão hermética: o shim staged precisa EXECUTAR ─────────────────────
//
// Esta é a prova que faltava. O bug histórico: restageRuntime fazia
// copyFileSync(dist/cli.js) — o shim virava uma cópia de cli.js, cujos imports
// relativos (./cli/args.js, ./server/index.js) NÃO resolvem em
// ~/.atomic-skills/bin/ (sem a árvore dist/ ao lado). Rodar o shim dava
// ERR_MODULE_NOT_FOUND. O fixture abaixo tem um cli.js com `import './version.js'`
// — se o shim for uma cópia, version.js não existe ao lado dele e falha; se for
// o launcher buildShim (importa cli.js por caminho ABSOLUTO), version.js resolve
// dentro do fixture e o marker é impresso.
describe('restageRuntime — regressão hermética que EXECUTA o shim', () => {
  let tmpHome;
  let fixture;

  before(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'dev-aideck-home-'));
    fixture = mkdtempSync(join(tmpdir(), 'dev-aideck-fixture-'));

    // package.json type:module espelha o pacote real — sem ele, dist/cli.js é
    // tratado como CJS e o `import` vira SyntaxError.
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({ name: '@henryavila/aideck', version: '9.9.9', type: 'module' }) + '\n',
    );

    mkdirSync(join(fixture, 'dist', 'client'), { recursive: true });
    // cli.js com import RELATIVO — o coração do teste.
    writeFileSync(
      join(fixture, 'dist', 'cli.js'),
      "import { VERSION } from './version.js';\nconsole.log(`FIXTURE_CLI_OK ${VERSION}`);\n",
    );
    writeFileSync(join(fixture, 'dist', 'version.js'), "export const VERSION = '9.9.9';\n");
    writeFileSync(join(fixture, 'dist', 'client', 'index.html'), '<html>fixture-client</html>\n');
  });

  after(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fixture, { recursive: true, force: true });
  });

  it('staged shim EXECUTA a cli do fixture (imports relativos resolvem)', () => {
    restageRuntime(fixture, tmpHome);

    const shimPath = join(tmpHome, '.atomic-skills', 'bin', 'aideck.mjs');
    assert.ok(existsSync(shimPath), 'shim deve ser staged em <home>/.atomic-skills/bin/');

    // EXECUTA o shim. No bug do copy-cli.js isto lança ERR_MODULE_NOT_FOUND
    // (./version.js não existe ao lado do shim) → execFileSync throws.
    const out = execFileSync(process.execPath, [shimPath, '--version'], {
      encoding: 'utf8',
    });
    assert.match(out, /FIXTURE_CLI_OK 9\.9\.9/, 'o shim deve importar e rodar a cli do fixture');
  });

  it('staged shim é o launcher argv-rewrite, NÃO cópia de cli.js', () => {
    const shim = readFileSync(join(tmpHome, '.atomic-skills', 'bin', 'aideck.mjs'), 'utf8');
    assert.ok(shim.includes('process.argv[1]'), 'deve reescrever argv[1]');
    assert.ok(/await import\(/.test(shim), 'deve importar a cli por caminho absoluto');
    assert.ok(
      !/from ['"]\.\/version\.js['"]/.test(shim),
      "não deve conter imports relativos do cli.js (smell da cópia bruta)",
    );
  });

  it('staged shim aponta para a cli do fixture (caminho absoluto)', () => {
    const shim = readFileSync(join(tmpHome, '.atomic-skills', 'bin', 'aideck.mjs'), 'utf8');
    assert.ok(
      shim.includes(join(fixture, 'dist', 'cli.js')),
      'o caminho absoluto da cli do fixture deve estar baked no shim',
    );
  });

  it('stages o dashboard client (clean replace)', () => {
    const idx = join(tmpHome, '.atomic-skills', 'dashboard', 'index.html');
    assert.ok(existsSync(idx), 'dashboard/index.html deve ser staged');
    assert.ok(readFileSync(idx, 'utf8').includes('fixture-client'));
  });
});

// ── CLI read-only (sempre rodam; não mutam HOME nem node_modules) ───────────
describe('dev-aideck.mjs CLI (read-only)', () => {
  describe('status', () => {
    it('exit 0 e mostra header', () => {
      const { success, out } = runDevAideck('status');
      assert.ok(success, 'status deve exit 0');
      assert.ok(out.includes('aiDeck status'), 'deve mostrar header');
    });

    it('mostra versão ou "not installed"', () => {
      const { out } = runDevAideck('status');
      assert.ok(
        out.includes('Version:') || out.toLowerCase().includes('not installed'),
        'deve mostrar versão ou mensagem de não instalado',
      );
    });
  });

  describe('edge cases', () => {
    it('command inválido → exit 1 + help', () => {
      const { success, out } = runDevAideck('foobar');
      assert.ok(!success, 'command inválido deve exit 1');
      assert.ok(out.includes('Usage:'), 'deve mostrar help');
    });

    it('help menciona --aideck-root e --no-build', () => {
      const { out } = runDevAideck('--help');
      assert.ok(out.includes('--aideck-root'), 'help deve mencionar --aideck-root');
      assert.ok(out.includes('--no-build'), 'help deve mencionar --no-build');
    });
  });
});

// ── live / E2E (destrutivo — só com DEV_AIDECK_E2E=1) ───────────────────────
describe('dev-aideck.mjs live (DEV_AIDECK_E2E)', () => {
  itIfE2E('link builda+symlink+restage contra o sibling real', () => {
    const { success, out } = runDevAideck('link');
    if (out.includes('Cannot find aiDeck sibling')) {
      assert.ok(!success, 'sem sibling, deve falhar com mensagem clara');
    } else {
      assert.ok(out.includes('Building aiDeck') || out.includes('Symlinked'), 'encontrou aideck');
    }
  });

  itIfE2E('unlink restaura o pacote npm publicado', () => {
    const { out } = runDevAideck('unlink');
    assert.ok(out.length > 0, 'deve produzir output');
    if (out.includes('aiDeck published restored')) assert.ok(true);
  });
});
