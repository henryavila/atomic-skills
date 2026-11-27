import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/hygiene');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');

/** Fixture text is assembled at run time so this file is not a finding itself. */
const sups = {
  eslint: 'eslint' + '-disable',
  noqa: 'no' + 'qa',
  shellcheck: 'shell' + 'check disable',
  jscpdStart: 'jscpd' + ':ignore-start',
  jscpdEnd: 'jscpd' + ':ignore-end',
  mypyIgnore: 'mypy' + ': ignore-errors',
  mypyConfig: 'mypy' + ': disable-error-code=import',
  ruff: 'ruff' + ': no' + 'qa',
  shellcheckSource: 'shell' + 'check source=' + 'lib.sh',
  shellcheckShell: 'shell' + 'check shell=' + 'bash',
  shellcheckSpaced: 'shell' + 'check  disable=SC2086',
  shellcheckTabbed: 'shell' + 'check\tdisable=SC2086',
  shellcheckSourceAndDisable: 'shell' + 'check source=lib.sh disable=SC2086',
  shellcheckSourceExactAndDisable: 'shell' + 'check source=x disable=SC2086',
  shellcheckSourceAndDisableAndNoqa: 'shell' + 'check source=lib.sh disable=SC2086 # ' + 'no' + 'qa',
  shellcheckDisableAndNoqa: 'shell' + 'check disable=SC2086 # ' + 'no' + 'qa',
  shellcheckDisableAndEslint: 'shell' + 'check disable=SC2086 # ' + 'eslint' + '-disable-next-line',
  shellcheckEnableThenSpacedDisable: 'shell' + 'check ' + 'enable=all # '
    + 'shell' + 'check  disable=SC2086',
  shellcheckEnableThenTabbedDisable: 'shell' + 'check ' + 'enable=all # '
    + 'shell' + 'check\tdisable=SC2086',
  shellcheckDisableTwice: 'shell' + 'check disable=SC1090 # '
    + 'shell' + 'check disable=SC2086',
  shellcheckRepeatedDisable: 'shell' + 'check disable=SC2086 disable=SC1090',
  shellcheckAfterHashInString: 'echo "a' + '#' + 'b" ' + '#' + ' shell' + 'check disable=SC2086',
  shellcheckEnableAll: 'shell' + 'check ' + 'enable=all',
  shellcheckEnableCheck: 'shell' + 'check ' + 'enable=check-unassigned-uppercase',
  tsNoCheck: '@ts-' + 'nocheck',
  tsIgnore: '@ts-' + 'ignore',
};

function awsKey() {
  return 'AK' + 'IA' + 'A'.repeat(16);
}

function githubToken() {
  return 'ghp' + '_' + 'a'.repeat(30);
}

describe('qa/measure/hygiene', () => {
  let root;

  function plant(files) {
    mkdirSync(join(root, 'qa'), { recursive: true });
    copyFileSync(CEILINGS, join(root, 'qa/ceilings.tsv'));
    copyFileSync(STACKS, join(root, 'qa/stacks.tsv'));
    for (const [path, body] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }

  function run(args = []) {
    return spawnSync(process.execPath, [MEASURER, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root },
    });
  }

  function lines(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.split('\n').filter(Boolean).sort();
  }

  function expectLines(result, expected) {
    assert.deepEqual(lines(result), [...expected].sort());
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-hygiene-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('describes itself', () => {
    const result = run(['--describe']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'mode\tfast',
      'changed\tyes',
      'covers\tjs\tsuppressions',
      'covers\tjs\tsecrets',
      'covers\tpy\tsuppressions',
      'covers\tpy\tsecrets',
      'covers\tsh\tsuppressions',
      'covers\tsh\tsecrets',
    ]);
  });

  it('prints nothing for a clean tree and ignores generated fixtures', () => {
    plant({
      'src/clean.js': 'export const clean = 1;\n',
      'skills/shared/clean.py': 'clean = 1\n',
      '.husky/clean': 'set -e\n',
      'test/app-map/fixtures/x.js': `// ${sups.eslint}-next-line\nexport const x = 1;\n`,
    });
    expectLines(run(), []);
  });

  it('ignores the husky-generated .husky/_ directory', () => {
    plant({
      '.husky/_/hook': `# ${sups.shellcheck}=SC2086\n`,
      '.husky/pre-commit': `# ${sups.shellcheck}=SC2086\n`,
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/pre-commit::*\t1']);
  });

  it('measures only tracked shell files in a git tree', () => {
    plant({ '.husky/pre-commit': `# ${sups.shellcheck}=SC2086\n` });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'qa@example.test'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'QA Test'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });

    plant({
      '.husky/_/hook': `# ${sups.shellcheck}=SC2086\n`,
      '.husky/untracked': `# ${sups.shellcheck}=SC2086\n`,
      'tests/hooks/untracked.sh': `# ${sups.shellcheck}=SC2086\n`,
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/pre-commit::*\t1']);
  });

  it('measures suppression comments in every stack', () => {
    plant({
      'src/a.js': `// ${sups.eslint}-next-line\nconst a = 1;\n`,
      'skills/shared/x.py': `# ${sups.noqa}\nvalue = 1\n`,
      '.husky/pre-commit': `# ${sups.shellcheck}=SC2086\nwith space\n`,
    });
    expectLines(run(), [
      'js\tsuppressions\tsrc/a.js::*\t1',
      'py\tsuppressions\tskills/shared/x.py::*\t1',
      'sh\tsuppressions\t.husky/pre-commit::*\t1',
    ]);
  });

  it('measures secrets in every stack', () => {
    plant({
      'src/leak.js': `export const value = '${awsKey()}';\n`,
      'skills/shared/leak.py': `password = "${'x'.repeat(24)}"\n`,
      '.husky/leak': `value='${githubToken()}'\n`,
    });
    expectLines(run(), [
      'js\tsecrets\tsrc/leak.js::*\t1',
      'py\tsecrets\tskills/shared/leak.py::*\t1',
      'sh\tsecrets\t.husky/leak::*\t1',
    ]);
  });

  it('limits --files to the listed files inside the stack roots', () => {
    plant({
      'src/a.js': `// ${sups.eslint}-next-line\nconst a = 1;\n`,
      'src/b.js': `// ${sups.eslint}-next-line\nconst b = 1;\n`,
      'docs/ignored.js': `// ${sups.eslint}-next-line\nconst x = 1;\n`,
    });
    expectLines(run(), [
      'js\tsuppressions\tsrc/a.js::*\t1',
      'js\tsuppressions\tsrc/b.js::*\t1',
    ]);
    expectLines(run(['--files', 'src/a.js', 'docs/ignored.js']), [
      'js\tsuppressions\tsrc/a.js::*\t1',
    ]);
  });

  it('counts TypeScript suppression comments as suppressions', () => {
    plant({
      'src/types.js': `// ${sups.tsNoCheck}\n// ${sups.tsIgnore}\nexport const value = 1;\n`,
    });
    expectLines(run(), ['js\tsuppressions\tsrc/types.js::*\t2']);
  });

  const directives = [
    {
      name: 'jscpd ignore-start',
      path: 'src/ignore-start.js',
      body: `// ${sups.jscpdStart}\nconst value = 1;\n`,
      stack: 'js',
    },
    {
      name: 'jscpd ignore-end',
      path: 'src/ignore-end.js',
      body: `// ${sups.jscpdEnd}\nconst value = 1;\n`,
      stack: 'js',
    },
    {
      name: 'mypy ignore-errors',
      path: 'skills/shared/mypy-ignore.py',
      body: `# ${sups.mypyIgnore}\nvalue = 1\n`,
      stack: 'py',
    },
    {
      name: 'mypy inline configuration',
      path: 'skills/shared/mypy-config.py',
      body: `# ${sups.mypyConfig}\nvalue = 1\n`,
      stack: 'py',
    },
    {
      name: 'ruff noqa',
      path: 'skills/shared/ruff.py',
      body: `# ${sups.ruff}\nvalue = 1\n`,
      stack: 'py',
    },
    {
      name: 'shellcheck source override',
      path: '.husky/source-override',
      body: `# ${sups.shellcheckSource}\nwith space\n`,
      stack: 'sh',
    },
    {
      name: 'shellcheck shell override',
      path: '.husky/shell-override',
      body: `# ${sups.shellcheckShell}\nwith space\n`,
      stack: 'sh',
    },
  ];

  for (const directive of directives) {
    it(`counts a ${directive.name} directive`, () => {
      plant({ [directive.path]: directive.body });
      expectLines(run(), [
        `${directive.stack}\tsuppressions\t${directive.path}::*\t1`,
      ]);
    });
  }

  it('counts a shellcheck directive whatever whitespace separates its parts', () => {
    plant({
      '.husky/two-spaces': `# ${sups.shellcheckSpaced}\n`,
      '.husky/tab': `# ${sups.shellcheckTabbed}\n`,
      '.husky/source-and-disable': `# ${sups.shellcheckSourceAndDisable}\n`,
    });
    expectLines(run(), [
      'sh\tsuppressions\t.husky/source-and-disable::*\t1',
      'sh\tsuppressions\t.husky/tab::*\t1',
      'sh\tsuppressions\t.husky/two-spaces::*\t1',
    ]);
  });

  it('counts independent suppressions next to a shellcheck disable directive', () => {
    plant({
      '.husky/disable-and-noqa': `# ${sups.shellcheckDisableAndNoqa}\n`,
      '.husky/disable-and-eslint': `# ${sups.shellcheckDisableAndEslint}\n`,
      '.husky/source-disable-and-noqa': `# ${sups.shellcheckSourceAndDisableAndNoqa}\n`,
    });
    expectLines(run(), [
      'sh\tsuppressions\t.husky/disable-and-eslint::*\t2',
      'sh\tsuppressions\t.husky/disable-and-noqa::*\t2',
      'sh\tsuppressions\t.husky/source-disable-and-noqa::*\t2',
    ]);
  });

  it('counts every shellcheck marker on a shell line, not only the first', () => {
    plant({
      '.husky/enable-then-spaced-disable': `# ${sups.shellcheckEnableThenSpacedDisable}\n`,
      '.husky/enable-then-tabbed-disable': `# ${sups.shellcheckEnableThenTabbedDisable}\n`,
      '.husky/disable-twice': `# ${sups.shellcheckDisableTwice}\n`,
      '.husky/repeated-disable-token': `# ${sups.shellcheckRepeatedDisable}\n`,
      '.husky/source-exact-and-disable': `# ${sups.shellcheckSourceExactAndDisable}\n`,
      '.husky/hash-in-string': `${sups.shellcheckAfterHashInString}\n`,
    });
    expectLines(run(), [
      'sh\tsuppressions\t.husky/disable-twice::*\t2',
      'sh\tsuppressions\t.husky/enable-then-spaced-disable::*\t1',
      'sh\tsuppressions\t.husky/enable-then-tabbed-disable::*\t1',
      'sh\tsuppressions\t.husky/hash-in-string::*\t1',
      'sh\tsuppressions\t.husky/repeated-disable-token::*\t1',
      'sh\tsuppressions\t.husky/source-exact-and-disable::*\t1',
    ]);
  });

  it('does not count shellcheck directives that do not disable a check', () => {
    plant({
      '.husky/enable-all': `# ${sups.shellcheckEnableAll}\n`,
      '.husky/enable-check': `# ${sups.shellcheckEnableCheck}\n`,
      '.husky/enable-and-noqa': `# ${sups.shellcheckEnableAll} # ${sups.noqa}\n`,
    });
    expectLines(run(), [
      'sh\tsuppressions\t.husky/enable-and-noqa::*\t1',
    ]);
  });

  it('parses CommonJS with a top-level return before reading comments', () => {
    plant({
      'src/commonjs.js': `// ${sups.eslint}-next-line\nreturn 1;\n`,
    });
    expectLines(run(), ['js\tsuppressions\tsrc/commonjs.js::*\t1']);
  });

  it('fails when JavaScript comments cannot be parsed', () => {
    plant({
      'src/broken.js': `// ${sups.eslint}-next-line\nconst broken = ;\n`,
    });
    const result = run();
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /src\/broken\.js/);
    assert.equal(result.stdout, '');
  });

  it('keeps shell quoting state across lines', () => {
    plant({
      '.husky/multiline': [
        'value="first line',
        `second line" # ${sups.shellcheck}=SC2086`,
        'echo "$value"',
        '',
      ].join('\n'),
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/multiline::*\t1']);
  });

  it('counts a shellcheck directive the tokenizer misses in a command substitution', () => {
    plant({
      '.husky/arithmetic-command': [
        'x=$(( $( # shellcheck disable=SC2086',
        'printf 1',
        ') << 2 ))',
        '',
      ].join('\n'),
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/arithmetic-command::*\t1']);
  });

  it('counts a shellcheck directive after an escaped hash and an unclosed quote', () => {
    plant({
      '.husky/escaped-hash': [
        'echo foo\\ #bar "first line',
        `second line" # ${sups.shellcheck}=SC2086`,
        '',
      ].join('\n'),
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/escaped-hash::*\t1']);
  });

  it('does not start a shell comment inside a word', () => {
    plant({
      '.husky/params': [
        'echo $# "first line',
        `second line" # ${sups.shellcheck}=SC2086`,
        'echo ${value#prefix}',
        '',
      ].join('\n'),
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/params::*\t1']);
  });

  it('does not treat arithmetic shifts as here-documents', () => {
    plant({
      '.husky/arithmetic': [
        'x=$((1 << 2))',
        `# ${sups.shellcheck}=SC2086`,
        '(( x <<= 1 ))',
        `# ${sups.shellcheck}=SC2086`,
        'echo "$x"',
        '',
      ].join('\n'),
    });
    expectLines(run(), ['sh\tsuppressions\t.husky/arithmetic::*\t2']);
  });

  it('measures only shell sources inside .husky', () => {
    plant({
      '.husky/pre-commit': `# ${sups.shellcheck}=SC2086\n`,
      '.husky/nested/data.json': `# ${sups.shellcheck}=SC2086\n`,
      '.husky/nested/x.sh': `# ${sups.shellcheck}=SC2086\n`,
    });
    expectLines(run(), [
      'sh\tsuppressions\t.husky/nested/x.sh::*\t1',
      'sh\tsuppressions\t.husky/pre-commit::*\t1',
    ]);
  });

  it('does not count comments inside python triple-quoted strings', () => {
    plant({
      'skills/shared/text.py': [
        'text = """',
        `# ${sups.noqa}`,
        '"""',
        'value = 1',
        '',
      ].join('\n'),
    });
    expectLines(run(), []);
  });

  it('finds a quoted secret containing another quote character', () => {
    plant({
      'src/mixed.js': `const password = '${'a'.repeat(10)}"${'b'.repeat(10)}';\n`,
    });
    expectLines(run(), ['js\tsecrets\tsrc/mixed.js::*\t1']);
  });

  it('fails when a measured file cannot be read', () => {
    plant({ 'src/locked.js': 'export const locked = 1;\n' });
    const locked = join(root, 'src/locked.js');
    chmodSync(locked, 0o000);
    try {
      let readable = true;
      try {
        readFileSync(locked);
      } catch {
        readable = false;
      }
      if (!readable) {
        const result = run();
        assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
        assert.match(result.stderr, /hygiene:.*cannot read.*locked/);
        assert.equal(result.stdout, '');
      }
    } finally {
      chmodSync(locked, 0o644);
    }
  });

  it('fails when a measured subtree cannot be read', () => {
    plant({
      'src/ok.js': 'export const ok = 1;\n',
      'src/locked/hidden.js': 'export const hidden = 1;\n',
    });
    const locked = join(root, 'src/locked');
    chmodSync(locked, 0o000);
    try {
      const result = run();
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /locked/);
      assert.equal(result.stdout, '');
    } finally {
      chmodSync(locked, 0o755);
    }
  });
});
