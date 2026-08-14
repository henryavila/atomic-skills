/**
 * Build a multi-page PDF (one JPEG per flow surface) for attachment.
 * Runtime download only — not part of HTML bytes / content-sha.
 */

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
