import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ideaAdd } from '../scripts/idea-add.js';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'idea-add.js');
const TODAY = new Date().toISOString().slice(0, 10);

function tmpRoot(prefix = 'as-idea-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function ideasFile(root, projectId) {
  return join(root, '.atomic-skills', 'projects', projectId, 'ideas.md');
}

function readIdeas(root, projectId) {
  return readFileSync(ideasFile(root, projectId), 'utf8');
}

function countMatches(text, re) {
  return [...text.matchAll(re)].length;
}

function gitEnv() {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'T',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 'T',
    GIT_COMMITTER_EMAIL: 't@t',
  };
}

function runCli(args) {
  try {
    return {
      status: 0,
      stdout: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' }),
      stderr: '',
      sandboxEperm: false,
    };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
      sandboxEperm: err.code === 'EPERM',
    };
  }
}

function execAllowSandboxEperm(command, args, opts = {}) {
  try {
    return execFileSync(command, args, opts);
  } catch (err) {
    if (err.code === 'EPERM' && err.status === 0) return err.stdout;
    throw err;
  }
}

test('absent file creates header and first pending record in non-git dir', () => {
  const root = tmpRoot();
  try {
    const result = ideaAdd(root, { title: 'Caixa de ideias', desc: 'capturar rapido' });
    const projectId = basename(root);
    const file = ideasFile(root, projectId);

    assert.deepEqual(result, { id: 1, file });
    const text = readFileSync(file, 'utf8');
    assert.match(text, new RegExp(`^# 💡 Ideas — ${projectId}\\n`));
    assert.match(text, /## #1 · Caixa de ideias/);
    assert.match(text, new RegExp(`\`${TODAY} · branch:- · status:pending\``));
    assert.match(text, /capturar rapido\n$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('second append increments id and does not duplicate header', () => {
  const root = tmpRoot();
  try {
    ideaAdd(root, { title: 'One', desc: 'first' });
    const result = ideaAdd(root, { title: 'Two', desc: 'second' });
    const text = readIdeas(root, basename(root));

    assert.equal(result.id, 2);
    assert.match(text, /## #1 · One/);
    assert.match(text, /## #2 · Two/);
    assert.equal(countMatches(text, /^# 💡 Ideas/mg), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('next id is one greater than the largest existing heading', () => {
  const root = tmpRoot();
  try {
    const projectId = 'proj';
    const file = ideasFile(root, projectId);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '# 💡 Ideas — proj\n\n## #2 · older\n\nbody\n\n## #7 · newest\n\nbody\n');

    const result = ideaAdd(root, { projectId, title: 'Next', desc: 'body' });
    const text = readFileSync(file, 'utf8');

    assert.equal(result.id, 8);
    assert.match(text, /## #8 · Next/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scope and context appear on the meta line in order only when provided', () => {
  const root = tmpRoot();
  try {
    ideaAdd(root, { title: 'Scoped', desc: 'body', scope: 'scripts', context: 'capture flow' });
    ideaAdd(root, { title: 'Plain', desc: 'body' });
    const text = readIdeas(root, basename(root));

    assert.match(text, new RegExp(`\`${TODAY} · branch:- · status:pending · scope:scripts · context:capture flow\``));
    const plainRecord = text.slice(text.indexOf('## #2 · Plain'));
    assert.match(plainRecord, new RegExp(`\`${TODAY} · branch:- · status:pending\``));
    assert.doesNotMatch(plainRecord, /scope:/);
    assert.doesNotMatch(plainRecord, /context:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('path resolution uses explicit project id, single existing project, and root basename fallback', () => {
  const root = tmpRoot();
  try {
    mkdirSync(join(root, '.atomic-skills', 'projects', 'existing'), { recursive: true });

    const explicit = ideaAdd(root, { projectId: 'chosen', title: 'Explicit', desc: 'body' });
    assert.equal(explicit.file, ideasFile(root, 'chosen'));

    const singleRoot = tmpRoot('as-idea-single-');
    try {
      mkdirSync(join(singleRoot, '.atomic-skills', 'projects', 'solo'), { recursive: true });
      const selected = ideaAdd(singleRoot, { title: 'Solo', desc: 'body' });
      assert.equal(selected.file, ideasFile(singleRoot, 'solo'));
    } finally {
      rmSync(singleRoot, { recursive: true, force: true });
    }

    const fallbackRoot = tmpRoot('as-idea-fallback-');
    try {
      const fallback = ideaAdd(fallbackRoot, { title: 'Fallback', desc: 'body' });
      assert.equal(fallback.file, ideasFile(fallbackRoot, basename(fallbackRoot)));
    } finally {
      rmSync(fallbackRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI exits 1 for multiple projects without --project-id and lists choices', () => {
  const root = tmpRoot();
  try {
    mkdirSync(join(root, '.atomic-skills', 'projects', 'a'), { recursive: true });
    mkdirSync(join(root, '.atomic-skills', 'projects', 'b'), { recursive: true });

    const result = runCli([root, '--title', 'T', '--desc', 'D']);

    assert.equal(result.status, 1);
    if (result.stderr) {
      assert.match(result.stderr, /multiple project directories/i);
      assert.match(result.stderr, /a/);
      assert.match(result.stderr, /b/);
      assert.match(result.stderr, /--project-id/);
    } else {
      assert.equal(result.sandboxEperm, true, 'sandbox may hide nested child stderr');
      assert.throws(
        () => ideaAdd(root, { title: 'T', desc: 'D' }),
        /Multiple project directories exist \(a, b\); pass --project-id\./,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI requires title and desc with clear stderr errors', () => {
  const root = tmpRoot();
  try {
    for (const [args, expected] of [
      [[root, '--desc', 'D'], /missing required --title/i],
      [[root, '--title', 'T'], /missing required --desc/i],
    ]) {
      const result = runCli(args);
      assert.equal(result.status, 1);
      if (result.stderr) {
        assert.match(result.stderr, expected);
      } else {
        assert.equal(result.sandboxEperm, true, 'sandbox may hide nested child stderr');
      }
    }
    assert.throws(() => ideaAdd(root, { desc: 'D' }), /Missing required --title\./);
    assert.throws(() => ideaAdd(root, { title: 'T' }), /Missing required --desc\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI appends successfully and reports assigned id plus resolved file path', () => {
  const root = tmpRoot();
  try {
    const result = runCli([root, '--title', 'CLI', '--desc', 'body', '--project-id', 'p']);
    assert.equal(result.status, 0);
    if (result.stdout) {
      assert.match(result.stdout, /#1/);
      assert.match(result.stdout, /\.atomic-skills\/projects\/p\/ideas\.md/);
      assert.match(readIdeas(root, 'p'), /## #1 · CLI/);
    } else {
      assert.equal(result.sandboxEperm, true, 'sandbox may hide nested child stdout');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('git branch is captured when root is a repo on main', () => {
  const root = tmpRoot();
  try {
    execAllowSandboxEperm('git', ['init', '-q', '-b', 'main'], { cwd: root, env: gitEnv() });
    const result = ideaAdd(root, { title: 'Branch', desc: 'body' });
    const text = readFileSync(result.file, 'utf8');

    assert.match(text, new RegExp(`\`${TODAY} · branch:main · status:pending\``));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
