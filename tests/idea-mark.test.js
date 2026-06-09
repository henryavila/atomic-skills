import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markTriaged } from '../scripts/idea-mark.js';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'idea-mark.js');

function tmpRoot(prefix = 'as-idea-mark-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function ideasFile(root, projectId = basename(root)) {
  return join(root, '.atomic-skills', 'projects', projectId, 'ideas.md');
}

function seedIdeas(root, text, projectId = basename(root)) {
  const file = ideasFile(root, projectId);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
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

test('pending idea is marked triaged and only the selected meta line changes', () => {
  const root = tmpRoot();
  try {
    const before = '# Ideas\n\n'
      + '## #1 · Primeiro\n'
      + '`2026-06-01 · branch:main · status:pending · scope:one`\n\n'
      + 'body one\n\n'
      + '## #2 · Segundo\n'
      + '`2026-06-02 · branch:feat · status:pending · context:ctx`\n\n'
      + 'body two\n'
      + '  trailing spaces  \n\n'
      + '## #3 · Terceiro\n'
      + '`2026-06-03 · branch:main · status:pending`\n\n'
      + 'body three\n';
    const expected = before.replace(
      '`2026-06-02 · branch:feat · status:pending · context:ctx`',
      '`2026-06-02 · branch:feat · status:triaged→T-005 · context:ctx`',
    );
    seedIdeas(root, before);

    const result = markTriaged(root, 2, 'T-005');

    assert.deepEqual(result, { id: 2, dest: 'T-005', file: ideasFile(root) });
    assert.equal(readFileSync(ideasFile(root), 'utf8'), expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('already triaged idea cannot be re-marked and reports existing destination', () => {
  const root = tmpRoot();
  try {
    const before = '## #1 · Done\n`2026-06-01 · branch:main · status:triaged→T-004`\n\nbody\n';
    seedIdeas(root, before);

    assert.throws(() => markTriaged(root, 1, 'T-005'), /already triaged→T-004/);
    assert.equal(readFileSync(ideasFile(root), 'utf8'), before);

    const result = runCli([root, '--id', '1', '--dest', 'T-005']);
    assert.equal(result.status, 1);
    if (result.stderr) assert.match(result.stderr, /already triaged→T-004/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('duplicate ids mark the first occurrence, warn on stderr, and leave the second untouched', () => {
  const root = tmpRoot();
  try {
    const before = '## #2 · First\n'
      + '`2026-06-01 · branch:main · status:pending`\n\n'
      + 'first body\n\n'
      + '## #2 · Second\n'
      + '`2026-06-02 · branch:main · status:pending`\n\n'
      + 'second body\n';
    const expected = before.replace('status:pending', 'status:triaged→T-005');
    seedIdeas(root, before);
    let stderr = '';
    const originalWrite = process.stderr.write;
    process.stderr.write = function write(chunk, ...args) {
      stderr += String(chunk);
      if (typeof args.at(-1) === 'function') args.at(-1)();
      return true;
    };

    try {
      markTriaged(root, 2, 'T-005');
    } finally {
      process.stderr.write = originalWrite;
    }

    assert.match(stderr, /duplicate id #2/i);
    assert.equal(readFileSync(ideasFile(root), 'utf8'), expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('malformed record errors clearly and leaves the file unchanged', () => {
  const root = tmpRoot();
  try {
    const before = '## #1 · Broken\n\nbody without meta\n';
    seedIdeas(root, before);

    assert.throws(() => markTriaged(root, 1, 'T-005'), /malformed.*#1.*meta/i);
    assert.equal(readFileSync(ideasFile(root), 'utf8'), before);

    const result = runCli([root, '--id', '1', '--dest', 'T-005']);
    assert.equal(result.status, 1);
    if (result.stderr) assert.match(result.stderr, /malformed.*#1.*meta/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing ids, missing file, and ambiguous project resolution exit 1', () => {
  const root = tmpRoot();
  try {
    seedIdeas(root, '## #1 · One\n`2026-06-01 · branch:main · status:pending`\n\nbody\n');

    assert.throws(() => markTriaged(root, 9, 'T-005'), /id #9 not found/i);
    const missingId = runCli([root, '--id', '9', '--dest', 'T-005']);
    assert.equal(missingId.status, 1);
    if (missingId.stderr) assert.match(missingId.stderr, /id #9 not found/i);

    const missingRoot = tmpRoot('as-idea-mark-missing-');
    try {
      const missingFile = runCli([missingRoot, '--id', '1', '--dest', 'T-005']);
      assert.equal(missingFile.status, 1);
      if (missingFile.stderr) assert.match(missingFile.stderr, /ideas\.md.*not found/i);
    } finally {
      rmSync(missingRoot, { recursive: true, force: true });
    }

    const ambiguousRoot = tmpRoot('as-idea-mark-ambiguous-');
    try {
      mkdirSync(join(ambiguousRoot, '.atomic-skills', 'projects', 'a'), { recursive: true });
      mkdirSync(join(ambiguousRoot, '.atomic-skills', 'projects', 'b'), { recursive: true });
      const ambiguous = runCli([ambiguousRoot, '--id', '1', '--dest', 'T-005']);
      assert.equal(ambiguous.status, 1);
      if (ambiguous.stderr) {
        assert.match(ambiguous.stderr, /multiple project directories/i);
        assert.match(ambiguous.stderr, /--project-id/);
      }
    } finally {
      rmSync(ambiguousRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
