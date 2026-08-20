/**
 * Flow PDF export: one JPEG page per surface, filename per process slug.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowPdf, pdfFilename } from '../scripts/lib/flow-pdf.js';

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
