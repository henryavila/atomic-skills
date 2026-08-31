/**
 * Flow PDF export: one JPEG page per surface, filename per process slug.
 * Raster path embeds light-paper diagram CSS (standalone SVG has no page DS).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_DIAGRAM_CSS } from '../scripts/lib/flow-diagram-css.js';
import {
  buildFlowPdf,
  flowPdfEmbeddedStyle,
  FLOW_PDF_LIGHT_TOKENS,
  pdfFilename,
} from '../scripts/lib/flow-pdf.js';
import { flowChromeScript } from '../scripts/lib/flow-chrome.js';

/** 1×1 grey JPEG (valid DCT stream). */
const TINY_JPEG = Buffer.from(
  'ffd8ffe000104a46494600010100000100010000' +
    'ffdb004300010101010101010101010101010101010101010101010101010101010101' +
    '01010101010101010101010101010101010101010101010101010101010101' +
    'ffc0000b080001000101011100ffc40014100100000000000000000000000000000000' +
    'ffda00080001000100003f00ffd9',
  'hex',
);

describe('pdfFilename', () => {
  it('is unique per process and safe for a download', () => {
    assert.equal(pdfFilename('sugestao-necessidade-pdti'), 'sugestao-necessidade-pdti-fluxo.pdf');
    assert.equal(pdfFilename('project-flow'), 'project-flow-fluxo.pdf');
    assert.notEqual(pdfFilename('sugestao-necessidade-pdti'), pdfFilename('project-flow'));
    assert.equal(pdfFilename('a/b c'), 'a-b-c-fluxo.pdf');
    assert.equal(pdfFilename(''), 'fluxo.pdf');
  });
});

describe('flowPdfEmbeddedStyle', () => {
  it('defines every token the diagram CSS references (light paper, no dark defaults)', () => {
    const style = flowPdfEmbeddedStyle();
    const refs = [...FLOW_DIAGRAM_CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    const unique = [...new Set(refs)];
    assert.ok(unique.length >= 10, `expected diagram tokens, got ${unique.length}`);
    for (const token of unique) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(FLOW_PDF_LIGHT_TOKENS, token),
        true,
        `missing PDF token for ${token}`,
      );
      assert.ok(style.includes(`${token}:`), `embedded style missing ${token}`);
    }
    assert.match(style, /--fg-default:#12161d/);
    assert.match(style, /--bg-surface:#ffffff/);
    assert.doesNotMatch(style, /--fg-default:#e9eef5/);
    assert.match(style, /\.xor-wash\{fill:rgba\(238,242,247,0\.18\)/);
    assert.match(style, /\.diamond\{fill:#fcf6ed/);
    assert.match(style, /\.actor-box\{/);
    assert.match(style, /\.edge-t\{/);
  });

  it('is baked into the chrome script so svgToJpeg clones carry style', () => {
    const js = flowChromeScript();
    assert.match(js, /var PDF_DIAGRAM_STYLE=/);
    assert.match(js, /function svgForPdf/);
    assert.match(js, /data-fl-pdf/);
    assert.match(js, /cloneNode\(true\)/);
    assert.match(js, /--fg-default:#12161d/);
    assert.match(js, /insertBefore\(style/);
  });
});

describe('buildFlowPdf', () => {
  it('emits a PDF with one page per surface and no clock', () => {
    const one = buildFlowPdf({
      pages: [{ jpeg: TINY_JPEG, width: 1, height: 1, ptWidth: 595, ptHeight: 200 }],
    });
    const a = Buffer.from(one);
    assert.match(a.subarray(0, 8).toString('latin1'), /^%PDF-1\./);
    assert.match(a.toString('latin1'), /%%EOF/);
    assert.match(a.toString('latin1'), /\/Count 1/);
    assert.doesNotMatch(a.toString('latin1'), /Date\.now|CreationDate/);

    const two = buildFlowPdf({
      pages: [
        { jpeg: TINY_JPEG, width: 1, height: 1, ptWidth: 595, ptHeight: 400 },
        { jpeg: TINY_JPEG, width: 1, height: 1, ptWidth: 595, ptHeight: 300 },
        { jpeg: TINY_JPEG, width: 1, height: 1, ptWidth: 595, ptHeight: 200 },
      ],
    });
    assert.match(Buffer.from(two).toString('latin1'), /\/Count 3/);
    assert.ok(two.byteLength > one.byteLength);
  });
});
