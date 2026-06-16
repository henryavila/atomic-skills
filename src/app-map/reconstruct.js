import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { scanCode } from './code-scan.js';
import { diverge } from './diverge.js';
import { buildCatalog, emitCatalog, reRunDelta } from './persist.js';
import { recallSources } from './sources.js';

/**
 * Orquestrador reconstrução-primeiro. Roda os módulos F1 em sequência, calcula
 * o delta de frescor por `evidenceHash` quando já existe catálogo, e deixa a
 * confirmação interativa fora do JS: o agente injeta páginas já resolvidas antes
 * de persistir.
 *
 * Invariantes (scopeBoundary T-001): só orquestra sources/code-scan/diverge/
 * persist/hash; grava apenas o catálogo no app-alvo; não pergunta ao operador.
 */

const CATALOG_DIR = ['.atomic-skills', 'app-map'];
const CATALOG_JSON = 'app-map.json';
const FIELD_NAMES = ['audience', 'accessTier'];

function normalizeKey(name) {
  return String(name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function sourceLabel(source) {
  if (!source) return null;
  return `${source.path}:${source.line}`;
}

function uniqueSorted(items) {
  return [...new Set(items.filter((item) => item !== null && item !== undefined))].sort();
}

function groupByKey(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function evidenceForPage(page, docCandidates) {
  const docs = [];
  for (const candidate of docCandidates) {
    if (candidate.evidence) docs.push(candidate.evidence);
    if (candidate.page?.source) {
      docs.push({ field: 'page', value: candidate.page.value, source: candidate.page.source });
    }
    for (const field of FIELD_NAMES) {
      const value = candidate[field];
      if (value?.source) docs.push({ field, value: value.value, source: value.source });
    }
  }

  return {
    code: page.codeEvidence ? { ...page.codeEvidence } : null,
    docs: docs
      .map((doc) => JSON.stringify(doc))
      .sort()
      .map((doc) => JSON.parse(doc)),
  };
}

function inventoryFromPages(pages) {
  return pages.map((page) => ({
    kind: 'inventory',
    pageId: page.id,
    existence: page.existence,
  }));
}

function readCatalog(path, readFile) {
  return JSON.parse(readFile(path, 'utf8'));
}

function fieldValue(page, field) {
  return page.fields?.[field]?.value ?? null;
}

function fieldSources(page, field) {
  return page.fields?.[field]?.sources ?? [];
}

function provenanceForPage(page) {
  const provenance = {};
  if (page.codeEvidence?.path) provenance.code = page.codeEvidence.path;
  for (const field of FIELD_NAMES) {
    const sources = uniqueSorted(fieldSources(page, field).map((candidate) => sourceLabel(candidate.source)));
    if (sources.length > 0) provenance[field] = sources.join(', ');
  }
  return provenance;
}

function conflictForField(field, aggregate) {
  const values = uniqueSorted((aggregate.sources ?? []).map((source) => source.value));
  const evidence = uniqueSorted((aggregate.sources ?? []).map((source) => sourceLabel(source.source))).join(', ');
  return {
    field,
    artefactValue: values[0] ?? null,
    codeValue: values[1] ?? null,
    evidence: evidence || `${field} unresolved`,
    resolution: 'pending',
  };
}

function conflictsForPage(page) {
  const conflicts = [];
  for (const [field, aggregate] of Object.entries(page.fields ?? {})) {
    if (aggregate.status === 'conflict') conflicts.push(conflictForField(field, aggregate));
  }
  return conflicts;
}

function toPageFact(page) {
  if ('purpose' in page && 'provenance' in page && 'status' in page) return { ...page };

  return {
    id: page.id,
    label: page.label,
    purpose: `Reconstrói a superfície ${page.label}.`,
    audience: fieldValue(page, 'audience'),
    accessTier: fieldValue(page, 'accessTier'),
    status: page.regime === 'brownfield' ? 'built' : 'planned',
    regime: page.regime,
    existence: page.existence,
    provenance: provenanceForPage(page),
    conflicts: conflictsForPage(page),
    evidence: page.evidence ?? {
      code: page.codeEvidence ? { ...page.codeEvidence } : null,
      docs: uniqueSorted(FIELD_NAMES.flatMap((field) => fieldSources(page, field).map((source) => sourceLabel(source.source)))),
    },
  };
}

export function resolveTarget({ appRoot, projectId } = {}) {
  if (!appRoot) throw new Error('appRoot is required');
  const resolvedProjectId = projectId ?? basename(appRoot);
  const catalogDir = join(appRoot, ...CATALOG_DIR);
  const jsonPath = join(catalogDir, CATALOG_JSON);
  return { appRoot, projectId: resolvedProjectId, catalogDir, jsonPath };
}

export function computeReconstruction({
  appRoot,
  projectId,
  readFile = readFileSync,
  exists = existsSync,
} = {}) {
  const target = resolveTarget({ appRoot, projectId });
  const docCandidates = recallSources({ roots: [target.appRoot] });
  const codePages = scanCode({ roots: [target.appRoot] });
  const byDocKey = groupByKey(docCandidates, (candidate) => normalizeKey(candidate.page.value));
  const result = diverge({ docCandidates, codePages });
  const pages = result.pages.map((page) => ({
    ...page,
    evidence: evidenceForPage(page, byDocKey.get(page.id) ?? []),
  }));
  const inventory = inventoryFromPages(pages);

  if (!exists(target.jsonPath)) {
    return {
      projectId: target.projectId,
      jsonPath: target.jsonPath,
      pages,
      delta: inventory,
      reRun: null,
      catalogMissing: true,
      inventory,
    };
  }

  const prevCatalog = readCatalog(target.jsonPath, readFile);
  const nextCatalog = buildCatalog({ pages: pages.map(toPageFact), projectId: target.projectId });
  const reRun = reRunDelta(prevCatalog, nextCatalog);
  return {
    projectId: target.projectId,
    jsonPath: target.jsonPath,
    pages,
    delta: reRun.delta,
    reRun,
    catalogMissing: false,
    inventory,
  };
}

export function persistReconstruction({ appRoot, projectId, pages = [] } = {}) {
  const target = resolveTarget({ appRoot, projectId });
  if (pages.length === 0) throw new Error('Cannot persist an empty app-map catalog');

  const catalog = buildCatalog({ pages: pages.map(toPageFact), projectId: target.projectId });
  const paths = emitCatalog(catalog, { dir: target.appRoot });
  return { ...paths, projectId: target.projectId };
}
