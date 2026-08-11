/**
 * Deterministic process-map HTML renderer tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  buildProcessMapHtml,
  validateProcessMap,
  normalizeProcessMap,
  contentFingerprint,
  renderProcessMapHtml,
  sha256,
  IMPLEMENTATION_TOKEN_RE,
} from '../scripts/lib/render-process-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const FIX = join(ROOT, 'docs', 'design', 'process-map-sketches', 'fixtures');

function loadFixture(name) {
  return parse(readFileSync(join(FIX, name), 'utf8'));
}

describe('validateProcessMap', () => {
  it('accepts quality-judge fixture', () => {
    const v = validateProcessMap(loadFixture('quality-judge-program.yaml'));
    assert.equal(v.ok, true);
  });

  it('rejects implementation tokens in copy', () => {
    const raw = loadFixture('help-command.yaml');
    raw.stages[0].copy.layperson.name = 'Implementar T-001 em src/foo.js';
    const v = validateProcessMap(raw);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /implementation token/i.test(e)));
  });

  it('rejects unknown youAreHere', () => {
    const raw = loadFixture('titan-v01.yaml');
    raw.youAreHere = 'nao-existe';
    const v = validateProcessMap(raw);
    assert.equal(v.ok, false);
  });
});

describe('IMPLEMENTATION_TOKEN_RE', () => {
  it('flags task ids and paths', () => {
    assert.ok(IMPLEMENTATION_TOKEN_RE.test('see T-012'));
    assert.ok(IMPLEMENTATION_TOKEN_RE.test('edit src/foo.js'));
    assert.ok(!IMPLEMENTATION_TOKEN_RE.test('Validar qualidade no corpus'));
  });
});

describe('determinism', () => {
  const fixtures = [
    'quality-judge-program.yaml',
    'quick-idea-capture.yaml',
    'help-command.yaml',
    'titan-v01.yaml',
  ];

  for (const name of fixtures) {
    it(`byte-identical double render: ${name}`, () => {
      const raw = loadFixture(name);
      const a = buildProcessMapHtml(raw, DS, { audience: 'both' });
      const b = buildProcessMapHtml(raw, DS, { audience: 'both' });
      assert.equal(a.html, b.html);
      assert.equal(a.contentSha, b.contentSha);
      assert.equal(sha256(a.html), sha256(b.html));
    });
  }

  it('same data + same DS → same content-sha regardless of edge order in input', () => {
    const raw = loadFixture('quality-judge-program.yaml');
    const flipped = {
      ...raw,
      edges: [...raw.edges].reverse(),
    };
    const a = buildProcessMapHtml(raw, DS);
    const b = buildProcessMapHtml(flipped, DS);
    assert.equal(a.contentSha, b.contentSha);
    assert.equal(a.html, b.html);
  });

  it('contentFingerprint ignores presentation-only DS changes? no — html changes with DS; fingerprint is data-only', () => {
    const raw = loadFixture('titan-v01.yaml');
    const n = normalizeProcessMap(validateProcessMap(raw).data);
    const fp1 = contentFingerprint(n);
    const html1 = renderProcessMapHtml(n, DS);
    const html2 = renderProcessMapHtml(n, DS + '\n/* comment */\n');
    assert.equal(contentFingerprint(n), fp1);
    assert.notEqual(html1, html2);
  });

  it('no Date.now or absolute paths in HTML', () => {
    const { html } = buildProcessMapHtml(loadFixture('help-command.yaml'), DS);
    assert.ok(!/20\d{2}-\d{2}-\d{2}T/.test(html));
    assert.ok(!html.includes(ROOT));
    assert.ok(!html.includes('/Volumes/'));
  });

  it('embeds DS tokens', () => {
    const { html } = buildProcessMapHtml(loadFixture('quick-idea-capture.yaml'), DS);
    assert.ok(html.includes('--bg-canvas'));
    assert.ok(html.includes('--status-info'));
    assert.ok(html.includes('data-pm-content-sha='));
  });
});

describe('audience lenses', () => {
  it('both includes toggle script and both copies', () => {
    const { html } = buildProcessMapHtml(loadFixture('titan-v01.yaml'), DS, {
      audience: 'both',
    });
    assert.ok(html.includes('data-pm-lens="layperson"'));
    assert.ok(html.includes('data-lens="developer"'));
    assert.ok(html.includes('localStorage'));
  });

  it('developer-only omits toggle script', () => {
    const { html, normalized } = buildProcessMapHtml(
      loadFixture('titan-v01.yaml'),
      DS,
      { audience: 'developer' }
    );
    assert.equal(normalized.audience, 'developer');
    assert.ok(!html.includes('localStorage'));
    assert.ok(html.includes('data-pm-lens="developer"'));
  });

  it('pin marks youAreHere stage', () => {
    const { html } = buildProcessMapHtml(loadFixture('titan-v01.yaml'), DS);
    assert.ok(html.includes('id="stage-qualidade-release"'));
    assert.ok(html.includes('Você está aqui'));
  });
});

describe('fixtures exist', () => {
  for (const name of [
    'quality-judge-program.yaml',
    'quick-idea-capture.yaml',
    'help-command.yaml',
    'titan-v01.yaml',
  ]) {
    it(name, () => {
      assert.ok(existsSync(join(FIX, name)));
    });
  }
});
