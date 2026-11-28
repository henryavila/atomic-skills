/**
 * Project deep guide page renderer.
 *
 * The dataset comes from meta/product/project-guide.yaml (design D4); this
 * module only turns it into the static page body. Exported from render-site.js
 * for callers that import the page renderer from there.
 */

import { escapeHtml, renderShell } from './render-html.js';

function guideText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function guideList(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {object|null|undefined} guide */
function normalizeProjectGuide(guide) {
  const g = guide && typeof guide === 'object' ? guide : {};
  return {
    title: guideText(g.title) || 'Project guide',
    lede: guideText(g.lede),
    oneLiner: guideText(g.one_liner),
    iron: guideText(g.iron_law),
    prefix: guideText(g.prefix),
    stateRoot: guideText(g.state_root, '.atomic-skills/'),
    entities: guideList(g.entities),
    keyConcepts: guideList(g.key_concepts),
    spine: guideList(g.lifecycle_spine),
    execLoop: guideList(g.execution_loop),
    can: guideList(g.can),
    cannot: guideList(g.cannot),
    commandGroups: guideList(g.command_groups),
    sisterSkills: guideList(g.sister_skills),
    lostFooter: guideList(g.lost_footer),
  };
}

function renderEntityRows(entities) {
  return entities
    .map((e) => {
      const name = escapeHtml(e?.name ?? e?.id ?? '');
      const summary = escapeHtml(e?.summary ?? '');
      const nests = escapeHtml(e?.nests ?? '');
      return `<tr>
          <td><strong>${name}</strong></td>
          <td>${summary}</td>
          <td>${nests}</td>
        </tr>`;
    })
    .join('\n        ');
}

function renderConceptCards(keyConcepts) {
  return keyConcepts
    .map((c) => {
      const t = escapeHtml(c?.title ?? c?.id ?? '');
      const body = escapeHtml(c?.body ?? '');
      return `<article class="card">
          <h3>${t}</h3>
          <p class="one-liner">${body}</p>
        </article>`;
    })
    .join('\n        ');
}

function renderSpineItems(spine) {
  return spine
    .map((s, i) => {
      const label = escapeHtml(s?.label ?? s?.id ?? '');
      const note = escapeHtml(s?.note ?? '');
      const arrow =
        i < spine.length - 1
          ? `<span class="spine-arrow" aria-hidden="true">→</span>`
          : '';
      return `<li class="spine-step">
          <span class="spine-label">${label}</span>
          ${note ? `<span class="spine-note">${note}</span>` : ''}
          ${arrow}
        </li>`;
    })
    .join('\n        ');
}

function renderLoopItems(execLoop) {
  return execLoop
    .map((step) => {
      const s = escapeHtml(step?.step ?? '');
      const gate = escapeHtml(step?.gate ?? '');
      return `<li><div class="cmd">${s}</div><div class="desc">${gate}</div></li>`;
    })
    .join('\n');
}

function renderSimpleList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
}

function renderCommandSections(commandGroups, prefix) {
  return commandGroups
    .map((group) => {
      const gTitle = escapeHtml(group?.title ?? group?.id ?? '');
      const cmds = Array.isArray(group?.commands) ? group.commands : [];
      const rows = cmds
        .map((cmd) => {
          const name = escapeHtml(cmd?.name ?? '');
          const args =
            typeof cmd?.args === 'string' && cmd.args.trim()
              ? ` ${escapeHtml(cmd.args.trim())}`
              : '';
          const desc = escapeHtml(cmd?.description ?? '');
          return `<li>
          <div class="cmd"><code>${escapeHtml(prefix)} ${name}</code>${args ? `<span class="cmd-args">${args}</span>` : ''}</div>
          <div class="desc">${desc}</div>
        </li>`;
        })
        .join('\n        ');
      return `<section class="section">
      <h3>${gTitle}</h3>
      <ul class="list-stack">
        ${rows}
      </ul>
    </section>`;
    })
    .join('\n    ');
}

function renderSisterRows(sisterSkills) {
  return sisterSkills
    .map((s) => {
      return `<tr>
          <td>${escapeHtml(s?.moment ?? '')}</td>
          <td><code>${escapeHtml(s?.skill ?? '')}</code></td>
          <td>${escapeHtml(s?.role ?? '')}</td>
        </tr>`;
    })
    .join('\n        ');
}

function renderLostCards(lostFooter) {
  return lostFooter
    .map((item) => {
      return `<article class="card">
          <div class="eyebrow">${escapeHtml(item?.label ?? '')}</div>
          <div class="cmd" style="margin-top:8px"><code>${escapeHtml(item?.command ?? '')}</code></div>
          <p class="one-liner">${escapeHtml(item?.note ?? '')}</p>
        </article>`;
    })
    .join('\n        ');
}

function renderEntitiesSection(entities) {
  return `<section class="section">
      <h2>Entities</h2>
      <p class="lede">Three-level hierarchy plus inbox and side frames.</p>
      <div class="table-wrap">
        <table class="docs">
          <thead>
            <tr>
              <th>Entity</th>
              <th>What it is</th>
              <th>Nests</th>
            </tr>
          </thead>
          <tbody>
        ${renderEntityRows(entities)}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderConceptsSection(keyConcepts) {
  return `<section class="section">
      <h2>Key concepts</h2>
      <div class="card-grid">
        ${renderConceptCards(keyConcepts)}
      </div>
    </section>`;
}

function renderSpineSection(spine) {
  return `<section class="section">
      <h2>Lifecycle spine</h2>
      <p class="lede">Work follows one gated spine from idea to archive. You do not advance a stage with an open question.</p>
      <ol class="spine">
        ${renderSpineItems(spine)}
      </ol>
    </section>`;
}

function renderExecutionLoopSection(execLoop) {
  return `<section class="section">
      <h2>Execution loop (per phase)</h2>
      <ul class="list-stack">
${renderLoopItems(execLoop)}
      </ul>
    </section>`;
}

function renderCanCannotSection(can, cannot) {
  return `<section class="section">
      <h2>Can / cannot</h2>
      <div class="card-grid">
        <article class="card">
          <h3>What the skill does</h3>
          <ul class="plain">
${renderSimpleList(can)}
          </ul>
        </article>
        <article class="card">
          <h3>What it does not allow</h3>
          <ul class="plain">
${renderSimpleList(cannot)}
          </ul>
        </article>
      </div>
    </section>`;
}

function renderCommandReferenceSection(prefix, commandGroups) {
  return `<section class="section">
      <h2>Command reference</h2>
      <p class="lede">All commands share the prefix <code>${escapeHtml(prefix)}</code>. Bare <code>${escapeHtml(prefix)}</code> prints a compact 5-line summary and stops (no browser).</p>
    </section>`;
}

function renderSisterSection(sisterSkills) {
  return `<section class="section">
      <h2>Sister skills</h2>
      <p class="lede">Project is a thin orchestrator — it delegates parts of the cycle.</p>
      <div class="table-wrap">
        <table class="docs">
          <thead>
            <tr>
              <th>Moment</th>
              <th>Skill</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
        ${renderSisterRows(sisterSkills)}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderLostSection(lostFooter) {
  return `<section class="section">
      <h2>Lost?</h2>
      <div class="card-grid">
        ${renderLostCards(lostFooter)}
      </div>
    </section>`;
}

function renderProjectGuideBody(model) {
  const {
    title,
    lede,
    oneLiner,
    iron,
    prefix,
    stateRoot,
    entities,
    keyConcepts,
    spine,
    execLoop,
    can,
    cannot,
    commandGroups,
    sisterSkills,
    lostFooter,
  } = model;

  return `    <section class="section">
      <p class="back-link"><a href="../index.html">← Home</a></p>
      <div class="meta-row">
        <span class="eyebrow">Project skill</span>
        <span class="badge badge-module">domain dataset</span>
      </div>
      <h1>${escapeHtml(title)}</h1>
      ${oneLiner ? `<p class="lede">${escapeHtml(oneLiner)}</p>` : ''}
      ${iron ? `<div class="iron-law">${escapeHtml(iron)}</div>` : ''}
      ${lede ? `<p class="prose" style="margin-top:12px"><span class="lede">${escapeHtml(lede)}</span></p>` : ''}
      <p class="footnote">Canonical state lives in <code>${escapeHtml(stateRoot)}</code> (git-tracked; never hand-edited). Command prefix: <code>${escapeHtml(prefix)}</code>. This page is generated from <code>meta/product/project-guide.yaml</code> — not from catalog <code>core.project</code> bloat.</p>
    </section>

    ${renderEntitiesSection(entities)}

    ${
      keyConcepts.length
        ? renderConceptsSection(keyConcepts)
        : ''
    }

    ${renderSpineSection(spine)}

    ${
      execLoop.length
        ? renderExecutionLoopSection(execLoop)
        : ''
    }

    ${renderCanCannotSection(can, cannot)}

    ${renderCommandReferenceSection(prefix, commandGroups)}
    ${renderCommandSections(commandGroups, prefix)}

    ${
      sisterSkills.length
        ? renderSisterSection(sisterSkills)
        : ''
    }

    ${
      lostFooter.length
        ? renderLostSection(lostFooter)
        : ''
    }`;
}

/**
 * Project deep guide from meta/product/project-guide.yaml (not catalog core.project).
 * @param {{ guide: object }} opts
 */
export function renderProjectGuidePage({ guide }) {
  const model = normalizeProjectGuide(guide);
  return renderShell({
    title: model.title,
    depth: 1,
    activeNav: 'project',
    description: model.oneLiner || model.lede.slice(0, 160),
    body: renderProjectGuideBody(model),
    includeProject: true,
  });
}
