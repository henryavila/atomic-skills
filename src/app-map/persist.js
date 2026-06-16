import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertValidAppMap } from './validate.js';
import { computeEvidenceHash } from './hash.js';

/**
 * Persistência do catálogo (T-005, D5'). Monta o `app-map.json` 0.2 com
 * `evidenceHash` por-página, valida emit-time reusando o `validateAppMap` da F0
 * (aborta em catálogo malformado, ANTES de gravar), e grava o catálogo + espelho
 * `.md` na árvore do app-alvo. A re-execução compara `evidenceHash` por página e
 * emite só o delta.
 *
 * Invariantes (scopeBoundary T-005): grava SÓ o catálogo na árvore do app-alvo;
 * não muta artefatos humanos; valida emit-time reusando validateAppMap da F0.
 */

const CATALOG_SUBDIR = ['.atomic-skills', 'app-map'];
const CATALOG_JSON = 'app-map.json';
const CATALOG_MD = 'app-map.md';

// Monta um catálogo 0.2 a partir de fatos de página prontos-para-catálogo, cada
// um carregando um descritor `evidence` cru. O hash do evidence vira o
// evidenceHash por-página; o evidence cru NÃO é persistido. O inputsHash
// top-level é o roll-up (hash dos evidenceHashes ordenados).
export function buildCatalog({ pages = [], projectId } = {}) {
  const catalogPages = pages.map((page) => {
    const { evidence, ...rest } = page;
    return { ...rest, evidenceHash: computeEvidenceHash(evidence) };
  });

  const inputsHash = computeEvidenceHash(catalogPages.map((p) => p.evidenceHash).sort());

  const catalog = {
    schemaVersion: '0.2',
    inputsHash,
    pages: catalogPages,
  };
  if (projectId) catalog.projectId = projectId;
  return catalog;
}

function mirrorMarkdown(catalog) {
  const lines = [`# app-map (${catalog.projectId ?? 'app'})`, '', `schemaVersion: ${catalog.schemaVersion}`, ''];
  for (const page of catalog.pages) {
    lines.push(`## ${page.label} (\`${page.id}\`)`);
    lines.push(`- existence: ${page.existence} · regime: ${page.regime} · status: ${page.status}`);
    lines.push(`- audience: ${page.audience ?? '—'} · accessTier: ${page.accessTier ?? '—'}`);
    lines.push(`- purpose: ${page.purpose}`);
    if (page.conflicts && page.conflicts.length > 0) lines.push(`- unresolved conflicts: ${page.conflicts.length}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

// Grava o catálogo + espelho .md. A validação emit-time é o GATE universal
// (funciona para app externo, fora do alcance do validate-state): malformado ⇒
// aborta sem gravar nada.
export function emitCatalog(catalog, { dir, writeFile = writeFileSync } = {}) {
  assertValidAppMap(catalog);

  const baseDir = join(dir, ...CATALOG_SUBDIR);
  const jsonPath = join(baseDir, CATALOG_JSON);
  const mdPath = join(baseDir, CATALOG_MD);

  writeFile(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFile(mdPath, mirrorMarkdown(catalog));
  return { jsonPath, mdPath };
}

// Delta de re-execução por evidenceHash. Páginas com hash inalterado ⟹ sem
// re-pergunta; alteradas/novas/removidas ⟹ entram no delta.
export function reRunDelta(prevCatalog, nextCatalog) {
  const prevById = new Map((prevCatalog.pages ?? []).map((p) => [p.id, p.evidenceHash]));
  const nextById = new Map((nextCatalog.pages ?? []).map((p) => [p.id, p.evidenceHash]));

  const changed = [];
  const added = [];
  const removed = [];

  for (const [id, hash] of nextById) {
    if (!prevById.has(id)) added.push(id);
    else if (prevById.get(id) !== hash) changed.push(id);
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) removed.push(id);
  }

  const delta = [...changed, ...added, ...removed].sort();
  return { delta, changed, added, removed };
}
