/**
 * T-005 — stage/GH-only templates + adopt contract.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
  });

  it('release.md points at adopt', () => {
    const md = readFileSync(RELEASE_SKILL, 'utf8');
    assert.match(md, /release-assets\/adopt\.md/);
  });
});
