/**
 * Shared HTML primitives for the product docs static site.
 *
 * Page shell, navigation, depth prefixes and text escaping live here so the
 * per-page renderers can share them without importing each other.
 */

import { colorSchemeBootScript, renderColorSchemeSwitch } from './color-scheme.js';

/**
 * Escape text for safe HTML text/attribute content.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Relative prefix from a dist page depth to the dist root.
 * depth 0 = site/dist/, depth 1 = site/dist/skills/, depth 2 = site/dist/skills/x/
 * @param {number} depth
 */
export function depthPrefix(depth) {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error(`depth must be a non-negative integer, got ${depth}`);
  }
  if (depth === 0) return '';
  return '../'.repeat(depth);
}

function hrefFor(depth, relativePath) {
  return `${depthPrefix(depth)}${relativePath}`;
}

const NAV_BASE = [
  { id: 'home', label: 'Home', path: 'index.html' },
  { id: 'skills', label: 'Skills', path: 'skills/index.html' },
  { id: 'modules', label: 'Modules', path: 'modules/index.html' },
  { id: 'hosts', label: 'Hosts', path: 'hosts/index.html' },
];

const NAV_PROJECT = { id: 'project', label: 'Project', path: 'project/index.html' };

/** @param {boolean} includeProject */
export function navItems(includeProject = false) {
  if (!includeProject) return [...NAV_BASE];
  // Insert Project after Skills for product IA.
  return [NAV_BASE[0], NAV_BASE[1], NAV_PROJECT, NAV_BASE[2], NAV_BASE[3]];
}

/** Default export alias used by tests — includes Project when site has the guide. */
export const NAV = navItems(true);

function renderNav(activeNav, depth, includeProject = false) {
  return navItems(includeProject).map((item) => {
    const cls = item.id === activeNav ? ' class="active"' : '';
    return `<a href="${hrefFor(depth, item.path)}"${cls}>${escapeHtml(item.label)}</a>`;
  }).join('\n      ');
}

/**
 * Full HTML document shell.
 * @param {{ title: string, depth: number, activeNav: string, body: string, description?: string, includeProject?: boolean }} opts
 */
export function renderShell({ title, depth, activeNav, body, description, includeProject = false }) {
  const cssHref = `${depthPrefix(depth)}assets/ds.css`;
  const pageTitle = title.includes('Atomic Skills')
    ? title
    : `${title} · Atomic Skills`;
  const desc = description
    ? `\n<meta name="description" content="${escapeHtml(description)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)}</title>${desc}
<link rel="stylesheet" href="${cssHref}">
<script>${colorSchemeBootScript()}</script>
</head>
<body>
<div class="site-shell">
  <header class="site-header">
    <a class="site-brand" href="${hrefFor(depth, 'index.html')}">
      <span class="site-brand-title">Atomic Skills</span>
      <span class="site-brand-sub">product docs</span>
    </a>
    <div class="site-header-tools">
      <nav class="site-nav" aria-label="Primary">
        ${renderNav(activeNav, depth, includeProject)}
      </nav>
      ${renderColorSchemeSwitch({ locale: 'en' })}
    </div>
  </header>
  <main class="site-main">
${body}
  </main>
  <footer class="site-footer">
    Generated from <code>meta/catalog.yaml</code>, <code>src/config.js</code>,
    and optional <code>meta/product/*.yaml</code> datasets.
    Product HTML is a build view only — not the SSOT.
  </footer>
</div>
</body>
</html>
`;
}
