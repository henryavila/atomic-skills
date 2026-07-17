/**
 * Pure render helpers for the product docs static site.
 *
 * Catalog is the SSOT for skill/product copy (design D2/D4).
 * Hosts come from src/config.js TESTED_IDE_IDS / IDE_CONFIG (design D3).
 * Skill body prompts are never rendered on public pages.
 */

import {
  IDE_CONFIG,
  PUBLIC_IDE_IDS,
  getIdeSupportLabel,
} from '../../src/config.js';
import { collectSkills } from './validate-skills-core.js';

/** Path/URL-safe catalog key: kebab-case slug only (no traversal). */
const SAFE_KEY_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Assert a catalog skill/module key is safe for use as a dist path segment.
 * @param {string} key
 * @returns {string}
 */
export function assertSafeKey(key) {
  if (typeof key !== 'string' || !SAFE_KEY_RE.test(key)) {
    throw new Error(
      `unsafe catalog key for site path: ${JSON.stringify(key)} (expected kebab-case slug)`
    );
  }
  return key;
}

/**
 * Allow only http(s) URLs for public hrefs; otherwise return null (caller renders text).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function safeHttpUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const NAV = [
  { id: 'home', label: 'Home', path: 'index.html' },
  { id: 'skills', label: 'Skills', path: 'skills/index.html' },
  { id: 'modules', label: 'Modules', path: 'modules/index.html' },
  { id: 'hosts', label: 'Hosts', path: 'hosts/index.html' },
];

const FORMAT_LABELS = {
  command: 'Command (slash)',
  markdown: 'Markdown',
  toml: 'TOML (Slash commands)',
};

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

function renderNav(activeNav, depth) {
  return NAV.map((item) => {
    const cls = item.id === activeNav ? ' class="active"' : '';
    return `<a href="${hrefFor(depth, item.path)}"${cls}>${escapeHtml(item.label)}</a>`;
  }).join('\n      ');
}

/**
 * Full HTML document shell.
 * @param {{ title: string, depth: number, activeNav: string, body: string, description?: string }} opts
 */
export function renderShell({ title, depth, activeNav, body, description }) {
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
</head>
<body>
<div class="site-shell">
  <header class="site-header">
    <a class="site-brand" href="${hrefFor(depth, 'index.html')}">
      <span class="site-brand-title">Atomic Skills</span>
      <span class="site-brand-sub">product docs</span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      ${renderNav(activeNav, depth)}
    </nav>
  </header>
  <main class="site-main">
${body}
  </main>
  <footer class="site-footer">
    Generated from <code>meta/catalog.yaml</code> + <code>src/config.js</code>.
    Catalog is the product SSOT — this HTML is a build view only.
  </footer>
</div>
</body>
</html>
`;
}

function skillDisplayName(skill) {
  const e = skill.entry || {};
  const emoji = typeof e.emoji === 'string' && e.emoji ? `${e.emoji} ` : '';
  const title = typeof e.title === 'string' && e.title.trim() ? e.title.trim() : skill.key;
  return `${emoji}${title}`;
}

function skillPitch(skill) {
  const e = skill.entry || {};
  if (typeof e.value_pitch === 'string' && e.value_pitch.trim()) {
    return e.value_pitch.trim();
  }
  if (typeof e.purpose === 'string' && e.purpose.trim()) {
    return e.purpose.trim();
  }
  if (typeof e.description === 'string' && e.description.trim()) {
    return e.description.trim();
  }
  return '';
}

function renderBulletList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const lis = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('\n');
  return `<ul class="plain">\n${lis}\n</ul>`;
}

function renderExamples(examples) {
  if (!Array.isArray(examples) || examples.length === 0) return '';
  const items = examples
    .map((ex) => {
      const cmd = escapeHtml(ex?.command ?? '');
      const desc = escapeHtml(ex?.description ?? '');
      return `<li><div class="cmd">${cmd}</div><div class="desc">${desc}</div></li>`;
    })
    .join('\n');
  return `<ul class="list-stack">\n${items}\n</ul>`;
}

/**
 * Landing page: product positioning, install, links.
 * @param {{ product: object, skills: ReturnType<typeof collectSkills>, pkgVersion?: string }} opts
 */
export function renderLandingPage({ product, skills, pkgVersion }) {
  const p = product && typeof product === 'object' ? product : {};
  const whatIs = typeof p.what_is === 'string' ? p.what_is.trim() : '';
  const whatIsNot = Array.isArray(p.what_is_not) ? p.what_is_not : [];
  const docsUrl = typeof p.docs_url === 'string' ? p.docs_url : '';
  const installPrimary =
    p.install && typeof p.install === 'object' && typeof p.install.primary === 'string'
      ? p.install.primary.trim()
      : 'npx @henryavila/atomic-skills install';

  const skillCount = skills.length;
  const versionNote = pkgVersion
    ? `<span class="badge badge-module">v${escapeHtml(pkgVersion)}</span>`
    : '';

  const body = `    <section class="section">
      <div class="meta-row">
        <span class="eyebrow">Product</span>
        ${versionNote}
      </div>
      <h1>Atomic Skills</h1>
      <p class="lede">${escapeHtml(whatIs)}</p>
    </section>

    <section class="section">
      <h2>What it is not</h2>
      ${renderBulletList(whatIsNot)}
    </section>

    <section class="section card install-block">
      <h2>Install</h2>
      <pre><code>${escapeHtml(installPrimary)}</code></pre>
      <p class="footnote">Installs optimized developer skills into your AI IDE. See the hosts page for Tested vs Theoretical support.</p>
    </section>

    <section class="section">
      <h2>Explore</h2>
      <div class="card-grid">
        <article class="card">
          <a class="card-title" href="skills/index.html">Skills (${skillCount})</a>
          <p class="one-liner">Iron Laws, when-to-use, and examples from the catalog — no prompt bodies.</p>
        </article>
        <article class="card">
          <a class="card-title" href="modules/index.html">Modules</a>
          <p class="one-liner">Optional install packs: memory, cross-model bridge, auto-update.</p>
        </article>
        <article class="card">
          <a class="card-title" href="hosts/index.html">Hosts</a>
          <p class="one-liner">Tested vs Theoretical IDE support from product config.</p>
        </article>
      </div>
    </section>

    ${
      (() => {
        const safe = safeHttpUrl(docsUrl);
        if (!docsUrl) return '';
        if (safe) {
          return `<section class="section">
      <h2>Canonical URL</h2>
      <p class="prose"><a href="${escapeHtml(safe)}" rel="noopener noreferrer">${escapeHtml(safe)}</a></p>
    </section>`;
        }
        return `<section class="section">
      <h2>Canonical URL</h2>
      <p class="prose"><code>${escapeHtml(String(docsUrl))}</code> <span class="footnote">(not a valid http(s) URL — rendered as text)</span></p>
    </section>`;
      })()
    }`;

  return renderShell({
    title: 'Atomic Skills',
    depth: 0,
    activeNav: 'home',
    description: whatIs.slice(0, 160),
    body,
  });
}

/**
 * Skills index listing all catalog skills.
 * @param {{ skills: ReturnType<typeof collectSkills> }} opts
 */
export function renderSkillsIndex({ skills }) {
  const cards = skills
    .map((skill) => {
      const e = skill.entry || {};
      const oneLiner = typeof e.one_liner === 'string' ? e.one_liner : '';
      const iron = typeof e.iron_law === 'string' ? e.iron_law : '';
      const moduleBadge = skill.modulePath
        ? `<span class="badge badge-module">${escapeHtml(skill.modulePath)}</span>`
        : '';
      return `<article class="card">
          <div class="meta-row">
            <a class="card-title" href="${escapeHtml(skill.key)}/index.html">${escapeHtml(skillDisplayName(skill))}</a>
            ${moduleBadge}
          </div>
          <p class="one-liner">${escapeHtml(oneLiner)}</p>
          ${iron ? `<div class="iron-law">${escapeHtml(iron)}</div>` : ''}
        </article>`;
    })
    .join('\n        ');

  const body = `    <section class="section">
      <p class="back-link"><a href="../index.html">← Home</a></p>
      <h1>Skills</h1>
      <p class="lede">Product blurbs from <code>meta/catalog.yaml</code>. Skill prompt bodies are not published here.</p>
    </section>
    <section class="card-grid">
        ${cards}
    </section>`;

  return renderShell({
    title: 'Skills',
    depth: 1,
    activeNav: 'skills',
    description: 'Atomic Skills catalog — Iron Laws and when-to-use from product SSOT.',
    body,
  });
}

/**
 * Per-skill detail page (catalog fields only).
 * @param {{ skill: { key: string, entry: object, modulePath: string|null } }} opts
 */
export function renderSkillDetail({ skill }) {
  const e = skill.entry || {};
  const oneLiner = typeof e.one_liner === 'string' ? e.one_liner : '';
  const iron = typeof e.iron_law === 'string' ? e.iron_law : '';
  const pitch = skillPitch(skill);
  const whenToUse = Array.isArray(e.when_to_use) ? e.when_to_use : [];
  const whenNot = Array.isArray(e.when_not_to_use) ? e.when_not_to_use : [];
  const examples = Array.isArray(e.examples) ? e.examples : [];
  const moduleBadge = skill.modulePath
    ? `<span class="badge badge-module">module: ${escapeHtml(skill.modulePath)}</span>`
    : `<span class="badge badge-module">core</span>`;

  const body = `    <section class="section">
      <p class="back-link"><a href="../index.html">← All skills</a></p>
      <div class="meta-row">
        <span class="eyebrow">${escapeHtml(skill.key)}</span>
        ${moduleBadge}
      </div>
      <h1>${escapeHtml(skillDisplayName(skill))}</h1>
      ${oneLiner ? `<p class="lede">${escapeHtml(oneLiner)}</p>` : ''}
      ${iron ? `<div class="iron-law">${escapeHtml(iron)}</div>` : ''}
    </section>

    ${
      pitch
        ? `<section class="section card prose">
      <h2>Why it exists</h2>
      <p>${escapeHtml(pitch)}</p>
    </section>`
        : ''
    }

    ${
      whenToUse.length
        ? `<section class="section">
      <h2>When to use</h2>
      ${renderBulletList(whenToUse)}
    </section>`
        : ''
    }

    ${
      whenNot.length
        ? `<section class="section">
      <h2>When not to use</h2>
      ${renderBulletList(whenNot)}
    </section>`
        : ''
    }

    ${
      examples.length
        ? `<section class="section">
      <h2>Examples</h2>
      ${renderExamples(examples)}
    </section>`
        : ''
    }`;

  return renderShell({
    title: skillDisplayName(skill),
    depth: 2,
    activeNav: 'skills',
    description: oneLiner || pitch.slice(0, 160),
    body,
  });
}

/**
 * Modules page from catalog module_meta.
 * @param {{ moduleMeta: Record<string, object>|null|undefined }} opts
 */
export function renderModulesPage({ moduleMeta }) {
  const meta = moduleMeta && typeof moduleMeta === 'object' ? moduleMeta : {};
  const entries = Object.entries(meta);

  const cards =
    entries.length === 0
      ? `<p class="lede">No modules defined in catalog.</p>`
      : entries
          .map(([key, m]) => {
            const title = typeof m?.title === 'string' ? m.title : key;
            const intro = typeof m?.intro === 'string' ? m.intro.trim() : '';
            const features = Array.isArray(m?.features) ? m.features : [];
            const notes = typeof m?.notes === 'string' ? m.notes.trim() : '';
            const version =
              typeof m?.version_added === 'string'
                ? `<span class="badge badge-module">since ${escapeHtml(m.version_added)}</span>`
                : '';
            return `<article class="card">
          <div class="meta-row">
            <h3>${escapeHtml(title)}</h3>
            ${version}
          </div>
          <p class="one-liner mono">${escapeHtml(key)}</p>
          ${intro ? `<div class="prose" style="margin-top:12px"><p>${escapeHtml(intro)}</p></div>` : ''}
          ${
            features.length
              ? `<div style="margin-top:12px">${renderBulletList(features)}</div>`
              : ''
          }
          ${
            notes
              ? `<p class="footnote" style="margin-top:12px">${escapeHtml(notes)}</p>`
              : ''
          }
        </article>`;
          })
          .join('\n        ');

  const body = `    <section class="section">
      <p class="back-link"><a href="../index.html">← Home</a></p>
      <h1>Modules</h1>
      <p class="lede">Optional install packs. Metadata from catalog <code>module_meta</code>.</p>
    </section>
    <section class="section">
        ${cards}
    </section>`;

  return renderShell({
    title: 'Modules',
    depth: 1,
    activeNav: 'modules',
    description: 'Optional Atomic Skills install modules.',
    body,
  });
}

/**
 * Hosts page — Tested vs Theoretical from config (never a parallel catalog list).
 * @param {{ ideConfig?: typeof IDE_CONFIG, supportLabel?: typeof getIdeSupportLabel }} [opts]
 */
export function renderHostsPage(opts = {}) {
  const ideConfig = opts.ideConfig ?? IDE_CONFIG;
  const supportLabel = opts.supportLabel ?? getIdeSupportLabel;
  // Public product surface only — exclude internal aliases (e.g. gemini-commands).
  const publicIds = opts.publicIdeIds ?? PUBLIC_IDE_IDS;

  const rows = publicIds
    .filter((id) => ideConfig[id])
    .map((id) => {
      const ide = ideConfig[id];
      const support = supportLabel(id);
      const badgeClass = support === 'Tested' ? 'badge-tested' : 'badge-theoretical';
      const format = FORMAT_LABELS[ide.format] || ide.format;
      return `<tr>
          <td>${escapeHtml(ide.name)}</td>
          <td><code>${escapeHtml(id)}</code></td>
          <td><code>${escapeHtml(ide.dir)}</code></td>
          <td>${escapeHtml(format)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(support)}</span></td>
        </tr>`;
    })
    .join('\n        ');

  const body = `    <section class="section">
      <p class="back-link"><a href="../index.html">← Home</a></p>
      <h1>Hosts</h1>
      <p class="lede">Product-facing IDE support. <strong>Tested</strong> hosts have been exercised end-to-end in real agent sessions. <strong>Theoretical</strong> hosts have install layouts and adapters but are not day-to-day battle-tested.</p>
      <p class="footnote">Distinct from operational CLI probe tiers in <code>meta/host-qualification.json</code>. Labels come from <code>TESTED_IDE_IDS</code> / <code>getIdeSupportLabel</code> in <code>src/config.js</code>.</p>
    </section>
    <section class="table-wrap">
      <table class="docs">
        <thead>
          <tr>
            <th>IDE</th>
            <th>Profile</th>
            <th>Directory</th>
            <th>Format</th>
            <th>Support</th>
          </tr>
        </thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
    </section>`;

  return renderShell({
    title: 'Hosts',
    depth: 1,
    activeNav: 'hosts',
    description: 'Atomic Skills IDE host support — Tested vs Theoretical.',
    body,
  });
}

/**
 * Build the full site file map (relative paths under dist/).
 * Values are UTF-8 text; binary assets are handled by the CLI.
 *
 * @param {{
 *   catalogData: object,
 *   pkgVersion?: string,
 *   ideConfig?: typeof IDE_CONFIG,
 *   supportLabel?: typeof getIdeSupportLabel,
 * }} opts
 * @returns {Map<string, string>}
 */
export function buildSiteFiles({
  catalogData,
  pkgVersion,
  ideConfig = IDE_CONFIG,
  supportLabel = getIdeSupportLabel,
}) {
  if (catalogData == null || typeof catalogData !== 'object') {
    throw new Error('catalogData must be an object');
  }

  const skills = collectSkills(catalogData);
  const product = catalogData.product ?? {};
  const files = new Map();

  files.set(
    'index.html',
    renderLandingPage({ product, skills, pkgVersion })
  );
  files.set('skills/index.html', renderSkillsIndex({ skills }));
  files.set(
    'modules/index.html',
    renderModulesPage({ moduleMeta: catalogData.module_meta })
  );
  files.set(
    'hosts/index.html',
    renderHostsPage({ ideConfig, supportLabel })
  );

  for (const skill of skills) {
    const key = assertSafeKey(skill.key);
    files.set(
      `skills/${key}/index.html`,
      renderSkillDetail({ skill })
    );
  }

  return files;
}

export { NAV, FORMAT_LABELS };
