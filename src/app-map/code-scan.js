import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * Code-scan framework-agnóstico. Enumera páginas/rotas/views do código por
 * convenções comuns entre frameworks (Next pages/app-router, Vue/React
 * views/screens, naming *.page/*Screen/*View) e anexa `codeEvidence` + regime
 * POR-PÁGINA.
 *
 * Invariantes (scopeBoundary T-002): read-only; enumera SÓ evidência de código;
 * não cruza com docs nem escreve catálogo. O regime é derivado da própria página
 * (`deriveRegime`), nunca de um veredito global "routes está vazio" — é por isso
 * que greenfield emerge como caso-limite (página sem codeEvidence), não um branch
 * especial.
 */

const DEFAULT_CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro'];
const DEFAULT_IGNORE_DIRS = new Set(['node_modules', '.git', '.atomic-skills', 'dist', 'build', 'coverage']);

// Segmentos de diretório que sinalizam superfície de rota entre frameworks.
const PAGE_DIRS = new Set(['pages', 'routes', 'views', 'screens']);
// Sufixos de nome de arquivo que sinalizam uma página por si só.
const PAGE_NAME_SUFFIX = /(?:\.(?:page|screen|view)|(?:Page|Screen|View))$/;

function toId(name) {
  return name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function toLabel(name) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => (/^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Regime por-página, derivado SÓ da evidência da própria página. Página com
 * code-evidence ⟹ brownfield; sem evidence (doc-only) ⟹ greenfield. Pura por
 * design: T-003 a reusa para classificar páginas que só vieram dos artefatos.
 */
export function deriveRegime(codeEvidence) {
  return codeEvidence && codeEvidence.path ? 'brownfield' : 'greenfield';
}

// Decide se um arquivo é uma página e qual nome lógico ela carrega. Retorna null
// quando o arquivo não é superfície de rota (ex: util/lib).
function classifyFile(relPath) {
  const parts = relPath.split('/');
  const file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);
  const base = file.slice(0, file.length - extname(file).length);

  // Next app-router: `page.<ext>` resolve para o diretório-pai (a rota real).
  if (base === 'page' && dirs.includes('app')) {
    const name = dirs[dirs.length - 1];
    if (name && name !== 'app') return { name, kind: 'app-router' };
  }

  // Diretório de página/rota/view/screen → o nome do arquivo é a página.
  if (dirs.some((dir) => PAGE_DIRS.has(dir.toLowerCase()))) {
    if (base.toLowerCase() === 'index') {
      const parent = dirs[dirs.length - 1];
      return { name: parent, kind: 'page-dir' };
    }
    return { name: base, kind: 'page-dir' };
  }

  // Naming explícito: Foo.page.tsx, ProfileScreen.ts, AccountView.jsx.
  if (PAGE_NAME_SUFFIX.test(base)) {
    const name = base.replace(PAGE_NAME_SUFFIX, '');
    if (name) return { name, kind: 'page-named' };
  }

  return null;
}

function walkCodeFiles(root, extensions, ignoreDirs) {
  const files = [];
  function recurse(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) recurse(full);
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        files.push(full);
      }
    }
  }
  if (statSync(root).isDirectory()) recurse(root);
  return files.sort();
}

export function scanCode({
  roots,
  extensions = DEFAULT_CODE_EXTENSIONS,
  ignoreDirs = DEFAULT_IGNORE_DIRS,
} = {}) {
  const rootList = Array.isArray(roots) ? roots : roots ? [roots] : [];
  const ignore = ignoreDirs instanceof Set ? ignoreDirs : new Set(ignoreDirs);
  const pages = [];

  for (const root of rootList) {
    for (const file of walkCodeFiles(root, extensions, ignore)) {
      const relPath = relative(root, file).split(/[\\/]/).join('/');
      const classified = classifyFile(relPath);
      if (!classified) continue;

      const codeEvidence = { path: relPath, kind: classified.kind };
      pages.push({
        id: toId(classified.name),
        label: toLabel(classified.name),
        codeEvidence,
        regime: deriveRegime(codeEvidence),
      });
    }
  }

  return pages;
}
