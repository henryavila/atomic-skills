/**
 * Build a multi-page PDF (one JPEG per flow surface) for attachment.
 * Runtime download only — not part of HTML bytes / content-sha.
 *
 * Raster path: clone SVG → inject flowPdfEmbeddedStyle() → JPEG.
 * Standalone SVG-as-image has no access to the page stylesheet, so the
 * clone must carry light-paper tokens + diagram rules (and color-mix
 * overrides that some SVG image engines skip).
 */

import { FLOW_DIAGRAM_CSS } from './flow-diagram-css.js';

/**
 * Light-paper token map for PDF (ds.css html[data-theme=light] surfaces +
 * status hues; *-line values pre-resolved from color-mix against light border).
 * Independent of the on-screen dark/light toggle.
 */
export const FLOW_PDF_LIGHT_TOKENS = Object.freeze({
  '--bg-sunken': '#e8edf4',
  '--bg-canvas': '#f4f6fa',
  '--bg-surface': '#ffffff',
  '--bg-elevated': '#eef2f7',
  '--border-subtle': '#e8edf3',
  '--border-default': '#d5dce6',
  '--fg-default': '#12161d',
  '--fg-muted': '#4a5565',
  '--fg-subtle': '#6b7585',
  '--fg-faint': '#98a1ad',
  '--status-success': '#4cc28e',
  '--status-warning': '#e0a44a',
  '--status-error': '#ff5c5c',
  '--status-info': '#5fb1ff',
  '--status-success-line': '#9bd1c1',
  '--status-warning-line': '#dac4a4',
  '--status-error-line': '#e99fa4',
  '--status-info-line': '#a3caf0',
  '--font-sans':
    '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '--font-mono':
    '"JetBrains Mono", ui-monospace, "SF Mono", "Menlo", "Consolas", monospace',
});

/**
 * SVG-as-image engines are uneven on color-mix(); pin the two diagram rules
 * that use it to light-paper literals (same math as ds light tokens).
 */
export const FLOW_PDF_COLOR_MIX_OVERRIDES = `.xor-wash{fill:rgba(238,242,247,0.18);stroke:none}
.diamond{fill:#fcf6ed;stroke:var(--status-warning-line);stroke-width:1.25}
`;

/**
 * Self-contained stylesheet for a cloned diagram SVG (papel claro).
 * @returns {string}
 */
export function flowPdfEmbeddedStyle() {
  const tokenBlock = Object.entries(FLOW_PDF_LIGHT_TOKENS)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `svg{${tokenBlock}}${FLOW_DIAGRAM_CSS}${FLOW_PDF_COLOR_MIX_OVERRIDES}`;
}

/**
 * @param {unknown} slug
 * @returns {string}
 */
export function pdfFilename(slug) {
  const s = String(slug || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s ? `${s}-fluxo.pdf` : 'fluxo.pdf';
}

/**
 * @param {string} s
 * @returns {Uint8Array}
 */
function enc(s) {
  return new TextEncoder().encode(s);
}

/**
 * @param {Uint8Array[]} chunks
 * @returns {Uint8Array}
 */
function concat(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * @param {{ pages: Array<{ jpeg: Uint8Array|ArrayBuffer, width: number, height: number, ptWidth?: number, ptHeight?: number }> }} input
 * @returns {Uint8Array}
 */
export function buildFlowPdf(input) {
  const list = Array.isArray(input?.pages) ? input.pages : [];
  if (!list.length) throw new Error('buildFlowPdf: pages required');

  const header = enc('%PDF-1.4\n%\x80\x80\x80\x80\n');
  const bodyParts = [];
  const offsets = [0];
  let pos = header.length;

  function pushObj(num, payload) {
    const start = enc(`${num} 0 obj\n`);
    const end = enc('\nendobj\n');
    offsets[num] = pos;
    const chunk = concat([start, payload, end]);
    bodyParts.push(chunk);
    pos += chunk.length;
  }

  const n = list.length;
  const kids = list.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  pushObj(1, enc('<< /Type /Catalog /Pages 2 0 R >>'));
  pushObj(2, enc(`<< /Type /Pages /Kids [ ${kids} ] /Count ${n} >>`));

  list.forEach((p, i) => {
    const pageNo = 3 + i * 3;
    const contentNo = pageNo + 1;
    const imageNo = pageNo + 2;
    const ptW = Number(p.ptWidth) || Number(p.width) || 595;
    const ptH = Number(p.ptHeight) || Number(p.height) || 842;
    const raw = p.jpeg;
    const jpeg = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const pxW = Math.max(1, Number(p.width) || 1);
    const pxH = Math.max(1, Number(p.height) || 1);
    const content = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
    pushObj(
      pageNo,
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${ptW} ${ptH} ] /Resources << /XObject << /Im0 ${imageNo} 0 R >> >> /Contents ${contentNo} 0 R >>`,
      ),
    );
    pushObj(contentNo, enc(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    pushObj(
      imageNo,
      concat([
        enc(
          `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        ),
        jpeg,
        enc('\nendstream'),
      ]),
    );
  });

  const xrefStart = pos;
  const maxObj = 2 + n * 3;
  let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObj; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  return concat([
    header,
    ...bodyParts,
    enc(xref),
    enc(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`),
  ]);
}
