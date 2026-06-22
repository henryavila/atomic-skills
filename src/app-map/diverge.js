import { deriveRegime } from './code-scan.js';

/**
 * Justaposição e cômputo do delta. Junta candidatos de doc (T-001) + páginas de
 * código (T-002) por chave-lógica normalizada EXATA, computa `existence` e as
 * divergências por-campo (o delta). NUNCA escolhe um lado: concordância vira
 * auto-aceito; divergência vira delta pendente com AMBAS as proveniências; o
 * valor resolvido fica `null` até o operador arbitrar (T-004).
 *
 * Invariantes (scopeBoundary T-003): nunca escolhe um lado automaticamente; não
 * pergunta ao operador (isso é T-004); não escreve catálogo nem muta fontes.
 */

const CANDIDATE_FIELDS = ['audience', 'accessTier'];

function normalizeKey(name) {
  return String(name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

// Conservador (open q (d)): plural-fold ou distância 1. Suficiente para sinalizar
// "talvez a mesma página" ao operador, longe o bastante de unir páginas distintas.
function isNearMiss(a, b) {
  if (a === b) return false;
  if (a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a) return true;
  return levenshtein(a, b) <= 1;
}

// Coleta todas as tuplas {value, source} de um campo, de TODOS os candidatos doc
// + a página de código (quando ela carrega o campo). Nenhuma é descartada.
function fieldTuples(fieldName, docCandidates, codePage) {
  const tuples = [];
  for (const candidate of docCandidates) {
    const field = candidate[fieldName];
    if (field && field.value != null) tuples.push({ value: field.value, source: field.source });
  }
  const codeField = codePage ? codePage[fieldName] : null;
  if (codeField && codeField.value != null) tuples.push({ value: codeField.value, source: codeField.source });
  return tuples;
}

function aggregateField(tuples) {
  const distinct = [...new Set(tuples.map((t) => t.value))];
  if (distinct.length >= 2) {
    // Duas testemunhas discordam → conflito; nenhum lado vence (value null).
    return { status: 'conflict', value: null, sources: tuples };
  }
  // Uma única afirmação distinta: duas testemunhas concordando = auto-aceito;
  // uma só testemunha = afirmação simples carregada (não é conflito).
  return { status: tuples.length >= 2 ? 'agreed' : 'single', value: distinct[0], sources: tuples };
}

function buildPage(key, docCandidates, codePage) {
  const existence = docCandidates.length > 0 && codePage
    ? 'confirmed'
    : docCandidates.length > 0
      ? 'artefact-only'
      : 'code-only';

  const fields = {};
  for (const fieldName of CANDIDATE_FIELDS) {
    const tuples = fieldTuples(fieldName, docCandidates, codePage);
    if (tuples.length > 0) fields[fieldName] = aggregateField(tuples);
  }

  const label = docCandidates[0]?.page?.value ?? codePage?.label ?? key;
  return {
    id: key,
    label,
    existence,
    regime: deriveRegime(codePage ? codePage.codeEvidence : null),
    codeEvidence: codePage ? codePage.codeEvidence : null,
    fields,
    possibleAliasOf: [],
  };
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

// Reclassifica pares (artefact-only ⟷ code-only) que são near-miss como
// possible-alias — apresentados ao operador, NUNCA auto-unidos.
function markPossibleAliases(pages) {
  const artefactOnly = pages.filter((p) => p.existence === 'artefact-only');
  const codeOnly = pages.filter((p) => p.existence === 'code-only');
  for (const a of artefactOnly) {
    for (const c of codeOnly) {
      if (isNearMiss(a.id, c.id)) {
        a.existence = 'possible-alias';
        c.existence = 'possible-alias';
        a.possibleAliasOf.push(c.id);
        c.possibleAliasOf.push(a.id);
      }
    }
  }
}

// O delta = tudo que precisa do operador: divergências de campo + existências
// ambíguas (não-confirmed). Páginas confirmadas e auto-aceitas ficam fora.
function computeDelta(pages) {
  const delta = [];
  for (const page of pages) {
    for (const [field, agg] of Object.entries(page.fields)) {
      if (agg.status === 'conflict') {
        delta.push({ kind: 'field-conflict', pageId: page.id, field, candidates: agg.sources });
      }
    }
    if (page.existence !== 'confirmed') {
      delta.push({ kind: 'existence', pageId: page.id, existence: page.existence });
    }
  }
  return delta;
}

export function diverge({ docCandidates = [], codePages = [] } = {}) {
  const docByKey = groupByKey(docCandidates, (c) => normalizeKey(c.page.value));
  const codeByKey = groupByKey(codePages, (p) => normalizeKey(p.id));

  const keys = [...new Set([...docByKey.keys(), ...codeByKey.keys()])].sort();
  const pages = keys.map((key) =>
    buildPage(key, docByKey.get(key) ?? [], (codeByKey.get(key) ?? [])[0] ?? null),
  );

  markPossibleAliases(pages);
  return { pages, delta: computeDelta(pages) };
}
