import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { collectSkills, bodyPathForSkill } from './validate-skills-core.js';
import { extractIronLaw } from './extract-iron-law.js';
import { IDE_CONFIG, SKILL_NAMESPACE } from '../../src/config.js';

const TABLE_START = '<!-- SKILLS_TABLE_START -->';
const TABLE_END = '<!-- SKILLS_TABLE_END -->';
const DETAILS_START = '<!-- SKILL_DETAILS_START -->';
const DETAILS_END = '<!-- SKILL_DETAILS_END -->';
const IDES_START = '<!-- IDES_TABLE_START -->';
const IDES_END = '<!-- IDES_TABLE_END -->';
const MODULES_START = '<!-- MODULES_START -->';
const MODULES_END = '<!-- MODULES_END -->';
const VERSION_NOTE_START = '<!-- VERSION_NOTE_START -->';
const VERSION_NOTE_END = '<!-- VERSION_NOTE_END -->';

const FORMAT_LABELS = {
  command: 'Command (slash)',
  markdown: 'Markdown',
  toml: 'TOML (Slash commands)',
};

function ideTargetDir(ide) {
  // `toml` installers encode the namespace in the filename prefix
  // (`atomic-skills-X.toml`), so the directory itself is the literal `ide.dir`.
  // Every other format nests skill bodies under `<ide.dir>/<namespace>/`.
  return ide.format === 'toml' ? `${ide.dir}/` : `${ide.dir}/${SKILL_NAMESPACE}/`;
}

export function renderIdesTable() {
  const header = '| IDE | Profile | Directory | Format |\n|-----|---------|-----------|--------|';
  const rows = Object.entries(IDE_CONFIG).map(([id, ide]) => {
    const label = FORMAT_LABELS[ide.format] || ide.format;
    return `| ${ide.name} | \`${id}\` | \`${ideTargetDir(ide)}\` | ${label} |`;
  });
  return [header, ...rows].join('\n');
}

function renderOneModule(key, meta) {
  const heading = meta.version_added
    ? `### ${meta.title} (new in ${meta.version_added})`
    : `### ${meta.title}`;
  const parts = [heading, '', meta.intro];
  if (Array.isArray(meta.features) && meta.features.length > 0) {
    parts.push('');
    for (const f of meta.features) parts.push(`- ${f}`);
  }
  if (meta.notes) {
    parts.push('');
    parts.push(meta.notes);
  }
  return parts.join('\n');
}

/**
 * Render the `> Note (vX.Y.Z): ...` callout under `## Skills`. Returns an
 * empty string when `release_highlight` is absent (note is suppressed).
 * Version is authoritative from `package.json` — the catalog only carries
 * the editorial body so the two cannot disagree.
 */
export function renderVersionNote(releaseHighlight, pkgVersion) {
  if (!releaseHighlight) return '';
  if (typeof releaseHighlight !== 'object') {
    throw new Error('release_highlight must be an object with a `body` field');
  }
  const body = typeof releaseHighlight.body === 'string' ? releaseHighlight.body.trim() : '';
  if (body.length === 0) {
    throw new Error('release_highlight.body must be a non-empty string');
  }
  const lines = body.split('\n');
  const first = `> **Note (v${pkgVersion}):** ${lines[0]}`;
  const rest = lines.slice(1).map((l) => `> ${l}`);
  return [first, ...rest].join('\n');
}

/**
 * Render the `## Modules` body from `data.module_meta`. Order follows the
 * insertion order of the YAML map. Returns an empty string when the block
 * is absent (suppresses the section — useful in unit-test fixtures). The
 * orphan/missing cross-check is enforced separately by validateModuleMeta.
 */
export function renderModulesSection(moduleMeta) {
  if (moduleMeta == null) return '';
  if (typeof moduleMeta !== 'object') {
    throw new Error('module_meta must be a mapping');
  }
  return Object.entries(moduleMeta)
    .map(([key, meta]) => renderOneModule(key, meta))
    .join('\n\n');
}

/**
 * Reproduce GitHub's auto-anchor algorithm for a Markdown heading:
 *   1. lowercase
 *   2. strip punctuation that GitHub drops (backticks, dots, parens, etc.)
 *   3. replace spaces with hyphens
 *   4. preserve hyphens and alphanumerics
 *
 * Empirically matched against GitHub-rendered anchors for the headings in
 * this README (e.g. "atomic-skills:fix — Root Cause + TDD"
 * → "atomic-skillsfix--root-cause--tdd").
 */
function githubAnchor(headingText) {
  return headingText
    .toLowerCase()
    .replace(/[`*_~()[\].,;:!?'"\\/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

function anchor(skill) {
  const headingText = `atomic-skills:${skill.key} — ${titleSuffix(skill.entry.title || skill.key)}`;
  return `#${githubAnchor(headingText)}`;
}

function renderTableRow(skill, ironLaw) {
  const e = skill.entry;
  const law = ironLaw ? `\`${ironLaw}\`` : '`—`';
  return `| ${e.emoji} | [\`${skill.key}\`](${anchor(skill)}) | ${e.one_liner} | ${law} |`;
}

export function renderTable(skills, ironLaws) {
  const header =
    '| | Skill | One-liner | Iron Law |\n|-|-------|-----------|----------|';
  const rows = skills.map((s) => renderTableRow(s, ironLaws.get(s.key))).join('\n');
  return `${header}\n${rows}`;
}

function renderUsageList(label, items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const bullets = items.map((x) => `- ${x}`).join('\n');
  return `**${label}:**\n${bullets}\n\n`;
}

function renderSubcommands(skill) {
  const subs = skill.entry.subcommands;
  if (!Array.isArray(subs) || subs.length === 0) return '';
  const rows = subs
    .map((s) => `| \`${s.example}\` | ${s.description} |`)
    .join('\n');
  return (
    '**Subcommands:**\n\n' +
    '| Example | Description |\n|---------|-------------|\n' +
    rows +
    '\n\n'
  );
}

function renderArgs(skill) {
  const args = skill.entry.args;
  if (!Array.isArray(args) || args.length === 0) return '';
  const rows = args
    .map((a) => {
      const req = a.required ? 'required' : 'optional';
      const def = a.default ? ` _(defaults to ${a.default})_` : '';
      return `| \`${a.name}\` | ${a.kind} | ${req} | ${a.description}${def} |`;
    })
    .join('\n');
  return (
    '**Arguments:**\n\n' +
    '| Name | Kind | Required | Description |\n|------|------|----------|-------------|\n' +
    rows +
    '\n\n'
  );
}

function renderExamples(skill) {
  const exs = skill.entry.examples;
  if (!Array.isArray(exs) || exs.length === 0) return '';
  const bullets = exs
    .map((e) => `- \`${e.command}\` — ${e.description}`)
    .join('\n');
  return `**Examples:**\n${bullets}\n\n`;
}

function renderListField(label, items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const inline = items.map((x) => `\`${x}\``).join(', ');
  return `**${label}:** ${inline}\n\n`;
}

function titleSuffix(title) {
  // Strip the leading "<prefix> — " when the title already carries the skill
  // name (e.g. "Fix — Root Cause + TDD" + key "fix" produces a doubled
  // prefix in the H3). Falls back to the full title when no " — " exists.
  const idx = title.indexOf(' — ');
  return idx >= 0 ? title.slice(idx + 3) : title;
}

function renderDetail(skill, ironLaw) {
  const e = skill.entry;
  const title = `### \`atomic-skills:${skill.key}\` — ${titleSuffix(e.title)}`;
  const lines = [title, ''];
  if (ironLaw) lines.push(`**Iron Law:** \`${ironLaw}\``, '');
  lines.push(`**One-liner:** ${e.one_liner}`, '');
  lines.push(`**Summary:** ${e.description}`, '');
  if (e.purpose) lines.push(`**Purpose:** ${e.purpose.trim()}`, '');
  const usage = renderUsageList('When to use', e.when_to_use);
  const usageNot = renderUsageList('When NOT to use', e.when_not_to_use);
  const subs = renderSubcommands(skill);
  const args = renderArgs(skill);
  const examples = renderExamples(skill);
  const outputs = renderListField('Output artifacts', e.output_artifacts);
  const deps = renderListField('Dependencies', e.dependencies);
  const related = renderListField('Related', e.related);
  const tags = renderListField('Tags', e.tags);
  const versionLine = `**Version added:** \`${e.version_added}\`\n\n`;

  return (
    lines.join('\n').trimEnd() +
    '\n\n' +
    usage +
    usageNot +
    subs +
    args +
    examples +
    outputs +
    deps +
    related +
    tags +
    versionLine +
    '---'
  );
}

export function renderDetails(skills, ironLaws) {
  return skills.map((s) => renderDetail(s, ironLaws.get(s.key))).join('\n\n');
}

function ensureMarkers(readme) {
  for (const marker of [
    TABLE_START, TABLE_END,
    DETAILS_START, DETAILS_END,
    IDES_START, IDES_END,
    MODULES_START, MODULES_END,
    VERSION_NOTE_START, VERSION_NOTE_END,
  ]) {
    if (!readme.includes(marker)) {
      throw new Error(
        `README missing required marker "${marker}". ` +
          `Add the marker pair around the generated section before running generate-docs.`
      );
    }
  }
}

function replaceBetween(text, startMarker, endMarker, replacement) {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error(`marker pair not found or out of order: ${startMarker} / ${endMarker}`);
  }
  const head = text.slice(0, startIdx + startMarker.length);
  const tail = text.slice(endIdx);
  return `${head}\n${replacement}\n${tail}`;
}

/**
 * Pure renderer: takes a parsed catalog + current README content + a function
 * to read body files, returns the new README content.
 */
export function renderReadme({ catalogData, readme, skillsDir, pkgVersion }) {
  ensureMarkers(readme);

  // pkgVersion is only required when the catalog carries a release_highlight
  // block; otherwise the version-note section renders empty and the absence
  // of package.json is tolerated (useful in unit-test fixtures).
  if (catalogData.release_highlight && (!pkgVersion || typeof pkgVersion !== 'string')) {
    throw new Error(
      'renderReadme: pkgVersion is required when catalog has release_highlight'
    );
  }

  const skills = collectSkills(catalogData);
  const ironLaws = new Map();
  for (const skill of skills) {
    const bodyPath = bodyPathForSkill(skill, skillsDir);
    const law = extractIronLaw(bodyPath);
    if (!law) {
      throw new Error(
        `skill body missing canonical \`## Iron Law\` section: ${bodyPath}`
      );
    }
    ironLaws.set(skill.key, law);
  }

  const table = renderTable(skills, ironLaws);
  const details = renderDetails(skills, ironLaws);
  const idesTable = renderIdesTable();
  const modulesBody = renderModulesSection(catalogData.module_meta);
  const versionNote = renderVersionNote(catalogData.release_highlight, pkgVersion);

  let next = replaceBetween(readme, TABLE_START, TABLE_END, table);
  next = replaceBetween(next, DETAILS_START, DETAILS_END, details);
  next = replaceBetween(next, IDES_START, IDES_END, idesTable);
  next = replaceBetween(next, MODULES_START, MODULES_END, modulesBody);
  next = replaceBetween(next, VERSION_NOTE_START, VERSION_NOTE_END, versionNote);
  return next;
}

/**
 * Convenience: read catalog and README from a project root, return the
 * rendered README.
 */
export function renderReadmeFromPaths({ projectRoot, catalogPath, readmePath, skillsDir, pkgPath }) {
  const yamlPath = catalogPath || join(projectRoot, 'meta', 'catalog.yaml');
  const mdPath = readmePath || join(projectRoot, 'README.md');
  const skDir = skillsDir || join(projectRoot, 'skills');
  const pkgJsonPath = pkgPath || join(projectRoot, 'package.json');
  const catalogData = parse(readFileSync(yamlPath, 'utf8'));
  const readme = readFileSync(mdPath, 'utf8');
  let pkgVersion;
  try {
    pkgVersion = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    pkgVersion = undefined; // tolerated only when catalog has no release_highlight
  }
  return renderReadme({ catalogData, readme, skillsDir: skDir, pkgVersion });
}

export const MARKERS = {
  TABLE_START, TABLE_END,
  DETAILS_START, DETAILS_END,
  IDES_START, IDES_END,
  MODULES_START, MODULES_END,
  VERSION_NOTE_START, VERSION_NOTE_END,
};
