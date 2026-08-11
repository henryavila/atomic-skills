/**
 * Pure renderer: process-map YAML/object → self-contained HTML.
 *
 * Design tokens: always inlines `site/assets/ds.css` (Atomic Skills / aiDeck DS).
 * Determinism: same normalized input + same dsCss → byte-identical HTML.
 * No timestamps, random IDs, or absolute paths in the output.
 */

import { createHash } from 'node:crypto';
import { escapeHtml } from './render-site.js';

export const SCHEMA_VERSION = '0.1';
export const KIND_ORDER = Object.freeze(['done', 'main', 'optional', 'always']);
export const AUDIENCES = Object.freeze(['layperson', 'developer', 'both']);

/** Tokens banned in shipped copy (implementation tree leak). */
export const IMPLEMENTATION_TOKEN_RE =
  /\bT-\d{3,}\b|\bF\d+\b(?!-)|verifier:|materialize\b|implementar\b|exitGate\b|scopeBoundary\b|\/[\w.-]+\.(js|ts|py|md)\b/i;

const KIND_LABEL = {
  done: 'Feito',
  main: 'Principal',
  optional: 'Opcional',
  always: 'Sempre',
};

const KIND_BADGE_CLASS = {
  done: 'pm-badge pm-badge-done',
  main: 'pm-badge pm-badge-main',
  optional: 'pm-badge pm-badge-optional',
  always: 'pm-badge pm-badge-always',
};

const AUDIENCE_LABEL = {
  layperson: 'Quem não é de tech',
  developer: 'Dev (alto nível)',
  both: 'Ambas as lentes',
};

/**
 * Stable sha256 hex of a string.
 * @param {string} text
 */
export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Canonical JSON stringify: sorted object keys, stable arrays as given.
 * Used only for content fingerprint of the *data* (not HTML).
 * @param {unknown} value
 */
export function stableStringify(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }
    return v;
  });
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: object } | { ok: false, errors: string[] }}
 */
export function validateProcessMap(raw) {
  const errors = [];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['process map must be a plain object'] };
  }
  const m = /** @type {Record<string, unknown>} */ (raw);

  if (m.schemaVersion !== SCHEMA_VERSION && m.schemaVersion !== '0.1') {
    errors.push(`schemaVersion must be '${SCHEMA_VERSION}'`);
  }
  for (const key of ['planSlug', 'actor', 'scenario']) {
    if (typeof m[key] !== 'string' || !m[key].trim()) {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  if (m.youAreHere != null && typeof m.youAreHere !== 'string') {
    errors.push('youAreHere must be string or null');
  }
  if (m.audience != null && !AUDIENCES.includes(/** @type {string} */ (m.audience))) {
    errors.push(`audience must be one of: ${AUDIENCES.join(', ')}`);
  }
  // ratifiedAt required for on-disk L1 (Iron Law P1); allow draft objects without it
  // when opts.requireRatified is false (default false here; find-missing enforces).
  if (!Array.isArray(m.stages) || m.stages.length === 0) {
    errors.push('stages must be a non-empty array');
  }

  /** @type {Set<string>} */
  const ids = new Set();
  if (Array.isArray(m.stages)) {
    m.stages.forEach((stage, i) => {
      if (!stage || typeof stage !== 'object') {
        errors.push(`stages[${i}] must be an object`);
        return;
      }
      const s = /** @type {Record<string, unknown>} */ (stage);
      if (typeof s.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(s.id)) {
        errors.push(`stages[${i}].id must be kebab-case`);
      } else if (ids.has(s.id)) {
        errors.push(`duplicate stage id: ${s.id}`);
      } else {
        ids.add(s.id);
      }
      if (!KIND_ORDER.includes(/** @type {string} */ (s.kind))) {
        errors.push(`stages[${i}].kind invalid`);
      }
      const copy = s.copy;
      if (!copy || typeof copy !== 'object') {
        errors.push(`stages[${i}].copy required`);
        return;
      }
      const c = /** @type {Record<string, unknown>} */ (copy);
      for (const lens of ['layperson', 'developer']) {
        const block = c[lens];
        if (!block || typeof block !== 'object') {
          errors.push(`stages[${i}].copy.${lens} required`);
          continue;
        }
        const b = /** @type {Record<string, unknown>} */ (block);
        for (const field of ['name', 'youGain', 'unlocks']) {
          if (typeof b[field] !== 'string' || !b[field].trim()) {
            errors.push(`stages[${i}].copy.${lens}.${field} required`);
          } else if (IMPLEMENTATION_TOKEN_RE.test(b[field])) {
            errors.push(
              `stages[${i}].copy.${lens}.${field} contains implementation token (LP lint)`
            );
          }
        }
      }
    });
  }

  if (m.youAreHere != null && typeof m.youAreHere === 'string' && m.youAreHere && !ids.has(m.youAreHere)) {
    errors.push(`youAreHere '${m.youAreHere}' is not a stage id`);
  }

  if (m.edges != null) {
    if (!Array.isArray(m.edges)) {
      errors.push('edges must be an array');
    } else {
      m.edges.forEach((e, i) => {
        if (!e || typeof e !== 'object') {
          errors.push(`edges[${i}] must be an object`);
          return;
        }
        const edge = /** @type {Record<string, unknown>} */ (e);
        if (typeof edge.from !== 'string' || !ids.has(edge.from)) {
          errors.push(`edges[${i}].from invalid`);
        }
        if (typeof edge.to !== 'string' || !ids.has(edge.to)) {
          errors.push(`edges[${i}].to invalid`);
        }
        if (edge.style !== 'solid' && edge.style !== 'dashed') {
          errors.push(`edges[${i}].style must be solid|dashed`);
        }
      });
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: m };
}

/**
 * Normalize for rendering: stable field shapes, sorted edges, default audience.
 * Stage array order is preserved (authorial process order).
 * @param {object} raw — already validated
 * @param {{ audience?: string }} [opts]
 */
export function normalizeProcessMap(raw, opts = {}) {
  const audience =
    opts.audience && AUDIENCES.includes(opts.audience)
      ? opts.audience
      : AUDIENCES.includes(/** @type {string} */ (raw.audience))
        ? raw.audience
        : 'developer';

  const stages = raw.stages.map((s) => ({
    id: s.id,
    kind: s.kind,
    mapsToPhases: Array.isArray(s.mapsToPhases)
      ? [...s.mapsToPhases].map(String).sort()
      : [],
    sourcedFrom: typeof s.sourcedFrom === 'string' ? s.sourcedFrom : '',
    copy: {
      layperson: {
        name: s.copy.layperson.name.trim(),
        youGain: s.copy.layperson.youGain.trim(),
        unlocks: s.copy.layperson.unlocks.trim(),
      },
      developer: {
        name: s.copy.developer.name.trim(),
        youGain: s.copy.developer.youGain.trim(),
        unlocks: s.copy.developer.unlocks.trim(),
      },
    },
  }));

  const edges = Array.isArray(raw.edges)
    ? [...raw.edges]
        .map((e) => ({
          from: e.from,
          to: e.to,
          style: e.style === 'dashed' ? 'dashed' : 'solid',
        }))
        .sort((a, b) => {
          const ka = `${a.from}\0${a.to}\0${a.style}`;
          const kb = `${b.from}\0${b.to}\0${b.style}`;
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        })
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    planSlug: String(raw.planSlug).trim(),
    actor: String(raw.actor).trim(),
    scenario: String(raw.scenario).trim(),
    youAreHere: raw.youAreHere == null || raw.youAreHere === '' ? null : String(raw.youAreHere),
    audience,
    ratifiedAt:
      typeof raw.ratifiedAt === 'string' && raw.ratifiedAt.trim()
        ? raw.ratifiedAt.trim()
        : null,
    stages,
    edges,
  };
}

/**
 * Fingerprint of normalized process data (independent of DS CSS).
 * @param {object} normalized
 */
export function contentFingerprint(normalized) {
  return sha256(stableStringify(normalized));
}

/**
 * Process-map layout CSS — only uses DS custom properties from site/assets/ds.css.
 * Kept as a constant string for deterministic output.
 */
export const PROCESS_MAP_CSS = `/* process-map layout — tokens from inlined ds.css only */
.pm-shell{max-width:960px;margin:0 auto;padding:var(--space-12) var(--space-10) var(--space-24)}
.pm-header{display:flex;flex-direction:column;gap:var(--space-6);margin-bottom:var(--space-12);padding-bottom:var(--space-10);border-bottom:1px solid var(--border-default)}
.pm-eyebrow{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-subtle);letter-spacing:var(--tracking-wide);text-transform:uppercase}
.pm-title{margin:0;font-size:var(--fs-3xl);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);line-height:var(--lh-tight)}
.pm-scenario{margin:0;color:var(--fg-muted);font-size:var(--fs-md);line-height:var(--lh-relaxed);max-width:68ch}
.pm-meta{display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center}
.pm-meta span{font-size:var(--fs-sm);color:var(--fg-subtle)}
.pm-meta strong{color:var(--fg-muted);font-weight:var(--fw-medium)}
.pm-toolbar{display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center;margin:var(--space-6) 0 var(--space-4)}
.pm-toolbar[hidden]{display:none!important}
.pm-lens-btn{appearance:none;cursor:pointer;height:30px;padding:0 var(--space-6);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--fg-muted);font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:var(--fw-medium)}
.pm-lens-btn[aria-pressed="true"]{color:var(--status-info);background:var(--status-info-bg);border-color:var(--status-info-line)}
.pm-lens-btn:focus-visible{outline:none;box-shadow:var(--shadow-focus)}
.pm-legend{display:flex;flex-wrap:wrap;gap:var(--space-6);margin:0 0 var(--space-10);padding:0;list-style:none;font-size:var(--fs-xs);color:var(--fg-subtle)}
.pm-legend li{display:inline-flex;align-items:center;gap:var(--space-3)}
.pm-swatch{width:18px;height:3px;border-radius:var(--radius-pill);background:var(--border-strong)}
.pm-swatch.dashed{background:repeating-linear-gradient(90deg,var(--border-strong) 0 4px,transparent 4px 8px)}
.pm-flow{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}
.pm-step{position:relative;display:grid;grid-template-columns:28px 1fr;gap:var(--space-6);padding:0 0 var(--space-10)}
.pm-step:last-child{padding-bottom:0}
.pm-rail{display:flex;flex-direction:column;align-items:center}
.pm-dot{width:14px;height:14px;border-radius:var(--radius-pill);border:2px solid var(--border-strong);background:var(--bg-canvas);flex-shrink:0;z-index:1}
.pm-step[data-kind="done"] .pm-dot{border-color:var(--status-success);background:var(--status-success)}
.pm-step[data-kind="main"] .pm-dot{border-color:var(--status-info)}
.pm-step[data-kind="optional"] .pm-dot{border-color:var(--status-neutral);border-style:dashed}
.pm-step[data-kind="always"] .pm-dot{border-color:var(--status-warning)}
.pm-step.is-here .pm-dot{border-color:var(--status-info);background:var(--status-info);box-shadow:0 0 0 4px var(--status-info-bg)}
.pm-connector{flex:1;width:2px;min-height:12px;background:var(--border-default);margin:4px 0}
.pm-step:last-child .pm-connector{display:none}
.pm-card{background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-xl);padding:var(--space-8) var(--space-10);box-shadow:var(--shadow-sm)}
.pm-step.is-here .pm-card{border-color:var(--status-info-line);box-shadow:var(--shadow-md)}
.pm-step[data-kind="optional"] .pm-card{opacity:0.95;border-style:dashed}
.pm-card-head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4);margin-bottom:var(--space-4)}
.pm-card-title{margin:0;font-size:var(--fs-lg);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight)}
.pm-here-pill{display:inline-flex;align-items:center;height:22px;padding:0 var(--space-5);border-radius:var(--radius-pill);background:var(--status-info-bg);border:1px solid var(--status-info-line);color:var(--status-info);font-family:var(--font-mono);font-size:var(--fs-2xs);font-weight:var(--fw-medium);letter-spacing:var(--tracking-wide);text-transform:uppercase}
.pm-badge{display:inline-flex;align-items:center;height:22px;padding:0 var(--space-5);border-radius:var(--radius-pill);border:1px solid transparent;font-family:var(--font-mono);font-size:var(--fs-2xs);font-weight:var(--fw-medium);letter-spacing:var(--tracking-wide);text-transform:uppercase}
.pm-badge-done{background:var(--status-success-bg);border-color:var(--status-success-line);color:var(--status-success)}
.pm-badge-main{background:var(--status-info-bg);border-color:var(--status-info-line);color:var(--status-info)}
.pm-badge-optional{background:var(--status-neutral-bg);border-color:var(--status-neutral-line);color:var(--fg-muted)}
.pm-badge-always{background:var(--status-warning-bg);border-color:var(--status-warning-line);color:var(--status-warning)}
.pm-fields{display:grid;gap:var(--space-4);margin:0}
.pm-field{margin:0}
.pm-field dt{font-size:var(--fs-xs);color:var(--fg-subtle);text-transform:uppercase;letter-spacing:var(--tracking-wide);margin-bottom:var(--space-1)}
.pm-field dd{margin:0;color:var(--fg-default);font-size:var(--fs-sm);line-height:var(--lh-snug)}
.pm-copy[hidden]{display:none!important}
.pm-footer{margin-top:var(--space-16);padding-top:var(--space-10);border-top:1px solid var(--border-default);font-size:var(--fs-xs);color:var(--fg-faint);font-family:var(--font-mono)}
.pm-next{margin-top:var(--space-10);padding:var(--space-8) var(--space-10);background:color-mix(in srgb,var(--status-info) 10%,var(--bg-surface));border:1px solid var(--status-info-line);border-radius:var(--radius-lg)}
.pm-next h2{margin:0 0 var(--space-3);font-size:var(--fs-md);color:var(--status-info)}
.pm-next p{margin:0;color:var(--fg-muted);font-size:var(--fs-sm);line-height:var(--lh-relaxed)}
@media (max-width:560px){.pm-shell{padding:var(--space-8) var(--space-6) var(--space-16)}.pm-title{font-size:var(--fs-2xl)}}
`;

/**
 * Minimal client script — lens toggle only. No network. Deterministic source.
 */
export const PROCESS_MAP_JS = `(function(){
  var root=document.documentElement;
  var buttons=document.querySelectorAll("[data-pm-lens]");
  function setLens(lens){
    root.setAttribute("data-pm-lens",lens);
    buttons.forEach(function(b){
      b.setAttribute("aria-pressed",b.getAttribute("data-pm-lens")===lens?"true":"false");
    });
    try{localStorage.setItem("pm-lens-"+root.getAttribute("data-pm-slug"),lens);}catch(e){}
  }
  buttons.forEach(function(b){
    b.addEventListener("click",function(){setLens(b.getAttribute("data-pm-lens"));});
  });
  var slug=root.getAttribute("data-pm-slug")||"";
  var initial=root.getAttribute("data-pm-lens")||"layperson";
  try{
    var saved=localStorage.getItem("pm-lens-"+slug);
    if(saved==="layperson"||saved==="developer")initial=saved;
  }catch(e){}
  setLens(initial);
})();`;

/**
 * Resolve which lens is active for non-toggle render.
 * @param {'layperson'|'developer'|'both'} audience
 */
export function defaultLens(audience) {
  if (audience === 'developer') return 'developer';
  if (audience === 'both') return 'layperson';
  return 'layperson';
}

/**
 * @param {object} normalized
 * @param {string} dsCss — full contents of site/assets/ds.css
 * @returns {string} HTML document, LF, single trailing newline
 */
export function renderProcessMapHtml(normalized, dsCss) {
  if (typeof dsCss !== 'string' || !dsCss.includes('--bg-canvas')) {
    throw new Error('dsCss must be the Atomic Skills design-system CSS (site/assets/ds.css)');
  }

  const fp = contentFingerprint(normalized);
  const lens0 = defaultLens(normalized.audience);
  const showToggle = normalized.audience === 'both';
  const stageById = new Map(normalized.stages.map((s) => [s.id, s]));
  const here = normalized.youAreHere;
  const hereStage = here ? stageById.get(here) : null;

  const styleBlock = `${dsCss.trim()}\n\n${PROCESS_MAP_CSS.trim()}`;

  /** @param {string} lens @param {object} stage */
  function copyBlock(lens, stage) {
    const c = stage.copy[lens];
    return `<div class="pm-copy" data-lens="${escapeHtml(lens)}">
      <h3 class="pm-card-title">${escapeHtml(c.name)}</h3>
      <dl class="pm-fields">
        <div class="pm-field"><dt>O que você ganha</dt><dd>${escapeHtml(c.youGain)}</dd></div>
        <div class="pm-field"><dt>O que destrava</dt><dd>${escapeHtml(c.unlocks)}</dd></div>
      </dl>
    </div>`;
  }

  const stepsHtml = normalized.stages
    .map((stage) => {
      const isHere = here === stage.id;
      const badge = KIND_BADGE_CLASS[stage.kind] || KIND_BADGE_CLASS.main;
      const kindLabel = KIND_LABEL[stage.kind] || stage.kind;
      return `<li class="pm-step${isHere ? ' is-here' : ''}" data-kind="${escapeHtml(stage.kind)}" data-stage-id="${escapeHtml(stage.id)}" id="stage-${escapeHtml(stage.id)}">
  <div class="pm-rail" aria-hidden="true"><span class="pm-dot"></span><span class="pm-connector"></span></div>
  <article class="pm-card">
    <div class="pm-card-head">
      <span class="${badge}">${escapeHtml(kindLabel)}</span>
      ${isHere ? '<span class="pm-here-pill">Você está aqui</span>' : ''}
    </div>
    ${copyBlock('layperson', stage)}
    ${copyBlock('developer', stage)}
  </article>
</li>`;
    })
    .join('\n');

  let nextHtml = '';
  if (hereStage) {
    const c = hereStage.copy[lens0];
    nextHtml = `<aside class="pm-next" aria-label="Próximo passo">
  <h2>Próximo foco</h2>
  <p><strong data-pm-next-name>${escapeHtml(c.name)}</strong> — <span data-pm-next-gain>${escapeHtml(c.youGain)}</span></p>
</aside>`;
  }

  const toolbar = showToggle
    ? `<div class="pm-toolbar" role="group" aria-label="Lente do mapa">
  <button type="button" class="pm-lens-btn" data-pm-lens="layperson" aria-pressed="false">Quem não é de tech</button>
  <button type="button" class="pm-lens-btn" data-pm-lens="developer" aria-pressed="false">Dev (alto nível)</button>
</div>`
    : `<div class="pm-toolbar" hidden></div>`;

  // CSS to show only active lens copies (no FOUC: default on html data-pm-lens)
  const lensCss = `
html[data-pm-lens="layperson"] .pm-copy[data-lens="developer"]{display:none!important}
html[data-pm-lens="developer"] .pm-copy[data-lens="layperson"]{display:none!important}
html:not([data-pm-lens]) .pm-copy[data-lens="developer"]{display:none!important}
`.trim();

  const title = `Mapa do processo — ${normalized.planSlug}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-pm-slug="${escapeHtml(normalized.planSlug)}" data-pm-lens="${escapeHtml(lens0)}" data-pm-content-sha="${escapeHtml(fp)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="atomic-skills render-process-map">
<meta name="process-map-schema" content="${escapeHtml(SCHEMA_VERSION)}">
<title>${escapeHtml(title)}</title>
<style>
${styleBlock}

${lensCss}
</style>
</head>
<body>
<div class="pm-shell">
  <header class="pm-header">
    <p class="pm-eyebrow">Process map · Linguagem de Produto</p>
    <h1 class="pm-title">${escapeHtml(normalized.planSlug)}</h1>
    <p class="pm-scenario">${escapeHtml(normalized.scenario)}</p>
    <div class="pm-meta">
      <span><strong>Ator:</strong> ${escapeHtml(normalized.actor)}</span>
      <span><strong>Lente:</strong> ${escapeHtml(AUDIENCE_LABEL[normalized.audience] || normalized.audience)}</span>
      ${here ? `<span><strong>Pin:</strong> ${escapeHtml(here)}</span>` : ''}
    </div>
    ${toolbar}
    <ul class="pm-legend">
      <li><span class="pm-swatch"></span> Caminho principal</li>
      <li><span class="pm-swatch dashed"></span> Opcional</li>
      <li><span class="pm-badge pm-badge-done">Feito</span></li>
      <li><span class="pm-badge pm-badge-main">Principal</span></li>
      <li><span class="pm-badge pm-badge-optional">Opcional</span></li>
      <li><span class="pm-badge pm-badge-always">Sempre</span></li>
    </ul>
  </header>
  ${nextHtml}
  <ol class="pm-flow">
${stepsHtml}
  </ol>
  <footer class="pm-footer">
    content-sha ${escapeHtml(fp.slice(0, 16))} · schema ${escapeHtml(SCHEMA_VERSION)} · DS inlined from site/assets/ds.css · generated by render-process-map (deterministic)
  </footer>
</div>
${showToggle ? `<script>\n${PROCESS_MAP_JS}\n</script>` : ''}
</body>
</html>
`;

  // Normalize: LF only, trim trailing spaces per line, single trailing newline
  return (
    html
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n+$/g, '\n')
  );
}

/**
 * Validate → normalize → render. Throws on invalid data.
 * @param {unknown} raw
 * @param {string} dsCss
 * @param {{ audience?: string }} [opts]
 */
export function buildProcessMapHtml(raw, dsCss, opts = {}) {
  const v = validateProcessMap(raw);
  if (!v.ok) {
    throw new Error(`Invalid process map:\n- ${v.errors.join('\n- ')}`);
  }
  const normalized = normalizeProcessMap(v.data, opts);
  return {
    html: renderProcessMapHtml(normalized, dsCss),
    normalized,
    contentSha: contentFingerprint(normalized),
  };
}
