import { mkdirSync, writeFileSync } from 'node:fs';
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

// Monta um catálogo 0.3 a partir de fatos de página prontos-para-catálogo, cada
// um carregando um descritor `evidence` cru. O hash do evidence vira o
// evidenceHash por-página; o evidence cru NÃO é persistido. O inputsHash
// top-level é o roll-up (hash dos evidenceHashes ordenados). 0.3 reshapeou o
// conflict para witnesses[] (o produtor emite via conflictForField); o
// evidenceHash por-página segue requerido (porta de direção única, de 0.2 em diante).
export function buildCatalog({ pages = [], projectId } = {}) {
  const catalogPages = pages.map((page) => {
    const { evidence, ...rest } = page;
    return { ...rest, evidenceHash: computeEvidenceHash(evidence) };
  });

  const inputsHash = computeEvidenceHash(catalogPages.map((p) => p.evidenceHash).sort());

  const catalog = {
    schemaVersion: '0.3',
    inputsHash,
    pages: catalogPages,
  };
  if (projectId) catalog.projectId = projectId;
  return catalog;
}

// Estável e sem perda: a witness.value e a witness.source são PERMISSIVAS no
// schema 0.3 (string, null, array, objeto). Coerção por template-string
// colapsaria um objeto em `[object Object]`, escondendo o valor/proveniência do
// operador (viola P1). Strings saem como estão; não-strings via JSON determinístico.
function renderField(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// Um conflito é RESOLVIDO quando resolution é o objeto de arbitragem (ou a string
// 'resolved'); 'pending' (ou ausente) é não-resolvido. O mirror não pode rotular
// um conflito resolvido como "unresolved" nem esconder a testemunha escolhida.
function conflictResolved(resolution) {
  if (resolution && typeof resolution === 'object') return true;
  return resolution === 'resolved';
}

function mirrorMarkdown(catalog) {
  const lines = [`# app-map (${catalog.projectId ?? 'app'})`, '', `schemaVersion: ${catalog.schemaVersion}`, ''];
  for (const page of catalog.pages) {
    lines.push(`## ${page.label} (\`${page.id}\`)`);
    lines.push(`- existence: ${page.existence} · regime: ${page.regime} · status: ${page.status}`);
    lines.push(`- audience: ${page.audience ?? '—'} · accessTier: ${page.accessTier ?? '—'}`);
    lines.push(`- purpose: ${page.purpose}`);
    const conflicts = Array.isArray(page.conflicts) ? page.conflicts : [];
    const pending = conflicts.filter((c) => !conflictResolved(c.resolution));
    const resolved = conflicts.filter((c) => conflictResolved(c.resolution));
    if (pending.length > 0) {
      lines.push(`- unresolved conflicts: ${pending.length}`);
      // 0.3 (P1): enumerate every witness so the operator arbitrates over the
      // FULL set — value, derived kind, and provenance — not a bare count.
      for (const conflict of pending) {
        const witnesses = Array.isArray(conflict.witnesses) ? conflict.witnesses : [];
        const rendered = witnesses.map((w) => `${renderField(w.value)} (${w.kind}, ${renderField(w.source)})`).join('; ');
        lines.push(`  - ${conflict.field}: ${rendered}`);
      }
    }
    for (const conflict of resolved) {
      const choice = conflict.resolution?.choice;
      const decision = choice ? `${renderField(choice.value)} (from ${renderField(choice.source)})` : 'resolved';
      lines.push(`- resolved conflict — ${conflict.field}: ${decision}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

// Grava o catálogo + espelho .md. A validação emit-time é o GATE universal
// (funciona para app externo, fora do alcance do validate-state): malformado ⇒
// aborta sem gravar nada.
export function emitCatalog(catalog, { dir, writeFile = writeFileSync, mkdir = mkdirSync } = {}) {
  // Valida ANTES de qualquer efeito colateral: malformado aborta sem criar dir.
  assertValidAppMap(catalog);

  const baseDir = join(dir, ...CATALOG_SUBDIR);
  const jsonPath = join(baseDir, CATALOG_JSON);
  const mdPath = join(baseDir, CATALOG_MD);

  // O destino é a árvore do app-alvo: na 1ª execução o `.atomic-skills/app-map/`
  // não existe ainda. Sem este mkdir, o writeFileSync lança ENOENT.
  mkdir(baseDir, { recursive: true });
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
