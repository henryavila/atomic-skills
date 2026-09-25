/**
 * T-005 — stage/GH-only templates + adopt contract.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAdopt } from '../scripts/release/adopt.js';

const ROOT = process.cwd();
const STAGE = join(ROOT, 'skills/shared/release-assets/templates/publish-stage.yml');
const GH_ONLY = join(ROOT, 'skills/shared/release-assets/templates/publish-gh-only.yml');
const ADOPT = join(ROOT, 'skills/shared/release-assets/adopt.md');
const RELEASE_SKILL = join(ROOT, 'skills/core/release.md');

/** Strip YAML comments and collect `run:` block bodies (approx). */
function runBlocks(yaml) {
  const lines = yaml.split('\n');
  const blocks = [];
  let collecting = false;
  let buf = [];
  let runIndent = 0;
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue;
    const runMatch = line.match(/^(\s*)run:\s*(.*)$/);
    if (runMatch) {
      if (collecting && buf.length) blocks.push(buf.join('\n'));
      collecting = true;
      buf = [];
      runIndent = runMatch[1].length;
      const inline = runMatch[2].trim();
      if (inline && inline !== '|' && inline !== '>') {
        blocks.push(inline);
        collecting = false;
      }
      continue;
    }
    if (collecting) {
      if (line.trim() === '') {
        buf.push(line);
        continue;
      }
      const indent = line.match(/^(\s*)/)[1].length;
      if (indent > runIndent) {
        buf.push(line);
      } else {
        blocks.push(buf.join('\n'));
        collecting = false;
        buf = [];
      }
    }
  }
  if (collecting && buf.length) blocks.push(buf.join('\n'));
  return blocks;
}

describe('publish-stage.yml template', () => {
  it('exists and uses release published + id-token write + npm stage publish', () => {
    assert.equal(existsSync(STAGE), true);
    const yaml = readFileSync(STAGE, 'utf8');
    assert.match(yaml, /on:\s*\n\s*release:\s*\n\s*types:\s*\[published\]/);
    assert.match(yaml, /id-token:\s*write/);
    assert.match(yaml, /stage\s+publish/);
    assert.match(yaml, /npm@11/);
  });

  it('happy-path run steps use stage publish, not bare npm publish', () => {
    const yaml = readFileSync(STAGE, 'utf8');
    const blocks = runBlocks(yaml);
    assert.ok(blocks.length > 0, 'expected at least one run block');

    const publishBlocks = blocks.filter((b) => /npm|stage|publish/i.test(b));
    assert.ok(publishBlocks.length > 0, 'expected a publish-related run block');

    for (const block of publishBlocks) {
      assert.match(block, /stage\s+publish/, 'publish-related run must stage publish');
      // Bare `npm publish` (no "stage") as an executable command is forbidden.
      const withoutStageLines = block
        .split('\n')
        .map((l) => l.replace(/^\s*#.*$/, ''))
        .join('\n');
      assert.doesNotMatch(
        withoutStageLines,
        /(?:^|[^\w-])(?:npx\s+--yes\s+)?npm(?:@[\w.-]+)?\s+publish(?:\s|$)/m,
        'must not contain unprotected npm publish command',
      );
    }
  });
});

describe('publish-gh-only.yml template', () => {
  it('exists, triggers on release published, and does not npm publish', () => {
    assert.equal(existsSync(GH_ONLY), true);
    const yaml = readFileSync(GH_ONLY, 'utf8');
    assert.match(yaml, /on:\s*\n\s*release:\s*\n\s*types:\s*\[published\]/);
    assert.doesNotMatch(yaml, /id-token:\s*write/);
    const blocks = runBlocks(yaml).join('\n');
    assert.doesNotMatch(blocks, /npm\s+publish/);
    assert.doesNotMatch(blocks, /stage\s+publish/);
  });
});

describe('adopt.md + release skill pointer', () => {
  it('requires dry-run/--check with pin, diff, and consent before write', () => {
    const md = readFileSync(ADOPT, 'utf8');
    assert.match(md, /--check|dry-run/i);
    assert.match(md, /pin/i);
    assert.match(md, /diff/i);
    assert.match(md, /consent/i);
    assert.match(md, /MUST/);
    assert.match(md, /scripts\/release\/adopt\.js/);
  });

  it('release.md points at adopt', () => {
    const md = readFileSync(RELEASE_SKILL, 'utf8');
    assert.match(md, /release-assets\/adopt\.md/);
  });
});

describe('adopt.js CLI — check / write', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-adopt-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('check exits 1 when target is missing', () => {
    const cli = createAdopt({ root, templateName: 'stage' });
    let out = '';
    const code = cli.run(['--check'], {
      stdout: { write: (s) => { out += s; } },
      stderr: { write: () => {} },
    });
    assert.equal(code, 1);
    assert.match(out, /status:\s+missing/);
    assert.match(out, /publish-stage@v1/);
  });

  it('check exits 0 when target matches pinned template', () => {
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(join(root, '.github/workflows/publish.yml'), readFileSync(STAGE, 'utf8'));
    const cli = createAdopt({ root, templateName: 'stage' });
    let out = '';
    const code = cli.run(['--check'], {
      stdout: { write: (s) => { out += s; } },
      stderr: { write: () => {} },
    });
    assert.equal(code, 0);
    assert.match(out, /status:\s+match/);
  });

  it('check exits 1 on drift', () => {
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      'name: drifted\non:\n  release:\n    types: [published]\n',
    );
    const cli = createAdopt({ root, templateName: 'stage' });
    const code = cli.run(['--check'], {
      stdout: { write: () => {} },
      stderr: { write: () => {} },
    });
    assert.equal(code, 1);
    assert.equal(cli.inspect().status, 'drift');
  });

  it('refuses --write without --check when missing', () => {
    const cli = createAdopt({ root, templateName: 'stage' });
    let err = '';
    const code = cli.run(['--write'], {
      stdout: { write: () => {} },
      stderr: { write: (s) => { err += s; } },
    });
    assert.equal(code, 1);
    assert.match(err, /refuse write without --check/i);
    assert.equal(existsSync(join(root, '.github/workflows/publish.yml')), false);
  });

  it('refuses --check --write without --diff when missing', () => {
    const cli = createAdopt({ root, templateName: 'stage' });
    let err = '';
    const code = cli.run(['--check', '--write'], {
      stdout: { write: () => {} },
      stderr: { write: (s) => { err += s; } },
    });
    assert.equal(code, 1);
    assert.match(err, /refuse write without --diff/i);
    assert.equal(existsSync(join(root, '.github/workflows/publish.yml')), false);
  });

  it('writes template bytes with --check --diff --write', () => {
    const cli = createAdopt({ root, templateName: 'stage' });
    const code = cli.run(['--check', '--diff', '--write'], {
      stdout: { write: () => {} },
      stderr: { write: () => {} },
    });
    assert.equal(code, 0);
    const target = join(root, '.github/workflows/publish.yml');
    assert.equal(existsSync(target), true);
    assert.equal(readFileSync(target, 'utf8'), readFileSync(STAGE, 'utf8'));
  });
});
