import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ideaAdd } from '../scripts/idea-add.js';
import { extractIdea, markTriaged } from '../scripts/idea-mark.js';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'idea-mark.js');

function tmpRoot(prefix = 'as-idea-promote-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function ideasFile(root, projectId = basename(root)) {
  return join(root, '.atomic-skills', 'projects', projectId, 'ideas.md');
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

function seedTwoIdeas(root) {
  ideaAdd(root, { title: 'Primeira', desc: 'desc one' });
  ideaAdd(root, {
    title: 'Promover fluxo',
    desc: 'linha A\n\nlinha B',
    scope: 'scripts',
    context: 'handoff fixture',
  });
  return ideasFile(root);
}

test('extractIdea returns structured fields and does not mutate ideas.md', () => {
  const root = tmpRoot();
  try {
    const file = seedTwoIdeas(root);
    const before = readFileSync(file, 'utf8');
    const beforeMtime = statSync(file).mtimeMs;

    const idea = extractIdea(root, 2);

    assert.deepEqual(idea, {
      id: 2,
      title: 'Promover fluxo',
      date: new Date().toISOString().slice(0, 10),
      branch: '-',
      status: 'pending',
      scope: 'scripts',
      context: 'handoff fixture',
      desc: 'linha A\n\nlinha B',
    });
    assert.equal(readFileSync(file, 'utf8'), before);
    assert.equal(statSync(file).mtimeMs, beforeMtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('extract then markTriaged then re-extract confines the diff to one meta line', () => {
  const root = tmpRoot();
  try {
    const file = seedTwoIdeas(root);
    const before = readFileSync(file, 'utf8');
    const extracted = extractIdea(root, 2);
    assert.equal(extracted.status, 'pending');

    const result = markTriaged(root, 2, 'T-005');
    const after = readFileSync(file, 'utf8');
    const expected = before.replace(
      /(`\d{4}-\d{2}-\d{2} · branch:- · status:)pending( · scope:scripts · context:handoff fixture`)/,
      '$1triaged→T-005$2',
    );

    assert.deepEqual(result, { id: 2, dest: 'T-005', file });
    assert.equal(after, expected);
    assert.equal(extractIdea(root, 2).status, 'triaged→T-005');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI extract prints JSON and CLI dest prints confirmation', () => {
  const root = tmpRoot();
  try {
    const file = seedTwoIdeas(root);

    const extracted = runCli([root, '--id', '2', '--extract']);
    assert.equal(extracted.status, 0);
    if (extracted.stdout) {
      const parsed = JSON.parse(extracted.stdout);
      assert.equal(parsed.id, 2);
      assert.equal(parsed.title, 'Promover fluxo');
      assert.equal(parsed.status, 'pending');
      assert.equal(parsed.scope, 'scripts');
      assert.equal(parsed.context, 'handoff fixture');
    } else {
      assert.equal(extracted.sandboxEperm, true, 'sandbox may hide nested child stdout');
    }

    const marked = runCli([root, '--id', '2', '--dest', 'T-005']);
    assert.equal(marked.status, 0);
    if (marked.stdout) assert.match(marked.stdout, /#2 → triaged→T-005/);
    assert.match(readFileSync(file, 'utf8'), /status:triaged→T-005/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
