import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Recall de fontes (open-world). Encontra docs heterogêneos SEM classificar a
 * convenção do framework e extrai candidatos que afirmam página / público /
 * acesso, cada campo com a proveniência da fonte que o afirmou.
 *
 * Invariantes (scopeBoundary T-001): read-only sobre artefatos; NUNCA cruza com
 * código nem escreve catálogo; precedência (ordem de roots) só ordena
 * apresentação, nunca resolve divergência — candidatos que colidem são todos
 * devolvidos intactos (P2: nunca escolher no silêncio).
 */

const DEFAULT_DOC_EXTENSIONS = ['.md', '.markdown', '.txt', '.adoc', '.rst'];
const DEFAULT_IGNORE_DIRS = new Set(['node_modules', '.git', '.atomic-skills', 'dist']);

// Marcadores de identidade-de-página explícitos, comuns entre convenções
// (BMAD/PRD, ADR, brainstorm, memória).
const PAGE_MARKER = /^\s*(?:page|screen|view|tela|route|rota)\s*[:-]\s*(.+?)\s*$/i;
// Linhas de atributo explícitas — público/acesso declarados, não inferidos.
const AUDIENCE_ATTR = /^\s*(?:audience|p[uú]blico|persona|for|para)\s*[:-]\s*(.+?)\s*$/i;
const ACCESS_ATTR = /^\s*(?:access|acesso|visibility|visibilidade|gate|auth(?:orization)?)\s*[:-]\s*(.+?)\s*$/i;
const HEADING = /^#{1,6}\s+(.+?)\s*$/;

// Referência inline a uma página em prosa ("the **Profile** page", "a Checkout page").
const INLINE_BOLD_PAGE = /\*\*(.+?)\*\*/;
const INLINE_NAMED_PAGE = /\b([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*)\s+(?:pages?|screens?|views?|telas?)\b/;

// Vocabulário aberto de segmento de público — recall, não classificação.
const AUDIENCE_TOKENS = [
  'visitor', 'guest', 'anonymous', 'registered', 'member', 'subscriber',
  'minor', 'child', 'guardian', 'parent', 'admin',
];

function detectAudience(text) {
  const lower = text.toLowerCase();
  for (const token of AUDIENCE_TOKENS) {
    if (new RegExp(`\\b${token}\\b`).test(lower)) return token;
  }
  return null;
}

// Normalização leve do eixo de visibilidade. NÃO é precedência: mapeia o
// fraseado de UMA fonte para um token canônico; nunca escolhe entre fontes.
function detectAccess(text) {
  const lower = text.toLowerCase();
  if (/admin[- ]only/.test(lower)) return 'auth:admin';
  if (/\bpublic\b/.test(lower)) return 'public';
  if (/\bprivate\b|\blogin\b|logged[- ]in|authenticated|\bprotected\b|requires?\s+login|sign[- ]in|\bauth\b/.test(lower)) {
    return 'auth';
  }
  return null;
}

function cleanPageName(raw) {
  return raw.replace(/[*_`]/g, '').replace(/[.:;,]+$/, '').trim();
}

function prov(value, path, line) {
  return value === null ? null : { value, source: { path, line } };
}

// Quebra um arquivo em blocos delimitados por headings markdown, preservando o
// número de linha absoluto (1-based) de cada linha.
function splitBlocks(lines) {
  const blocks = [];
  let current = { heading: null, body: [] };
  lines.forEach((text, index) => {
    const line = index + 1;
    const headingMatch = text.match(HEADING);
    if (headingMatch) {
      if (current.heading || current.body.length > 0) blocks.push(current);
      current = { heading: { text: cleanPageName(headingMatch[1]), line }, body: [] };
    } else {
      current.body.push({ text, line });
    }
  });
  if (current.heading || current.body.length > 0) blocks.push(current);
  return blocks;
}

// Segmenta o corpo de um bloco por marcadores `Page:` explícitos: cada marcador
// abre um candidato; atributos seguintes anexam-se até o próximo marcador.
function segmentByMarkers(body) {
  const segments = [];
  let current = null;
  for (const { text, line } of body) {
    const marker = text.match(PAGE_MARKER);
    if (marker) {
      if (current) segments.push(current);
      current = { page: { value: cleanPageName(marker[1]), line }, lines: [] };
    } else if (current) {
      current.lines.push({ text, line });
    }
  }
  if (current) segments.push(current);
  return segments;
}

function findAttr(lines, regex, normalize) {
  for (const { text, line } of lines) {
    const match = text.match(regex);
    if (match) {
      const value = normalize(match[1]);
      if (value !== null) return { value, line };
    }
  }
  return null;
}

function candidateFromAttrs(pageValue, pageLine, attrLines, path, text) {
  const audience = findAttr(attrLines, AUDIENCE_ATTR, detectAudience);
  const access = findAttr(attrLines, ACCESS_ATTR, detectAccess);
  return {
    page: { value: pageValue, source: { path, line: pageLine } },
    audience: audience ? prov(audience.value, path, audience.line) : null,
    accessTier: access ? prov(access.value, path, access.line) : null,
    evidence: { path, line: pageLine, text },
  };
}

// Modo inline: uma única linha de prosa que nomeia uma página E afirma público
// ou acesso na mesma linha.
function candidateFromInline({ text, line }, path) {
  const bold = text.match(INLINE_BOLD_PAGE);
  const named = text.match(INLINE_NAMED_PAGE);
  const pageRaw = bold ? bold[1] : named ? named[1] : null;
  if (!pageRaw) return null;

  const audience = detectAudience(text);
  const access = detectAccess(text);
  if (audience === null && access === null) return null;

  return {
    page: { value: cleanPageName(pageRaw), source: { path, line } },
    audience: prov(audience, path, line),
    accessTier: prov(access, path, line),
    evidence: { path, line, text: text.trim() },
  };
}

function extractCandidates(content, path) {
  const lines = content.split(/\r?\n/);
  const candidates = [];

  for (const block of splitBlocks(lines)) {
    const segments = segmentByMarkers(block.body);

    if (segments.length > 0) {
      for (const seg of segments) {
        const text = `Page: ${seg.page.value}`;
        candidates.push(candidateFromAttrs(seg.page.value, seg.page.line, seg.lines, path, text));
      }
      continue;
    }

    // Modo heading: o heading nomeia a página só quando o bloco afirma
    // público/acesso por linha de atributo EXPLÍCITA (prosa não promove um
    // título a página — evita "## Pages" virar candidato).
    if (block.heading) {
      const hasAttr =
        findAttr(block.body, AUDIENCE_ATTR, detectAudience) ||
        findAttr(block.body, ACCESS_ATTR, detectAccess);
      if (hasAttr) {
        candidates.push(
          candidateFromAttrs(block.heading.text, block.heading.line, block.body, path, `# ${block.heading.text}`),
        );
      }
    }

    // Modo inline: cobre list-items e prosa solta (docs sem convenção).
    for (const bodyLine of block.body) {
      const inline = candidateFromInline(bodyLine, path);
      if (inline) candidates.push(inline);
    }
  }

  return candidates;
}

function walkDocs(root, extensions, ignoreDirs) {
  const files = [];
  function recurse(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) recurse(full);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(full);
      }
    }
  }
  if (statSync(root).isDirectory()) recurse(root);
  return files.sort();
}

export function recallSources({
  roots,
  extensions = DEFAULT_DOC_EXTENSIONS,
  ignoreDirs = DEFAULT_IGNORE_DIRS,
} = {}) {
  const rootList = Array.isArray(roots) ? roots : roots ? [roots] : [];
  const ignore = ignoreDirs instanceof Set ? ignoreDirs : new Set(ignoreDirs);
  const candidates = [];

  for (const root of rootList) {
    for (const file of walkDocs(root, extensions, ignore)) {
      const path = relative(root, file).split(/[\\/]/).join('/');
      candidates.push(...extractCandidates(readFileSync(file, 'utf8'), path));
    }
  }

  return candidates;
}
