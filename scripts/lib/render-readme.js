import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { collectSkills, bodyPathForSkill } from './validate-skills-core.js';
import { extractIronLaw } from './extract-iron-law.js';

const TABLE_START = '<!-- SKILLS_TABLE_START -->';
const TABLE_END = '<!-- SKILLS_TABLE_END -->';
const DETAILS_START = '<!-- SKILL_DETAILS_START -->';
const DETAILS_END = '<!-- SKILL_DETAILS_END -->';

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
  for (const marker of [TABLE_START, TABLE_END, DETAILS_START, DETAILS_END]) {
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
export function renderReadme({ catalogData, readme, skillsDir }) {
  ensureMarkers(readme);

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

  let next = replaceBetween(readme, TABLE_START, TABLE_END, table);
  next = replaceBetween(next, DETAILS_START, DETAILS_END, details);
  return next;
}

/**
 * Convenience: read catalog and README from a project root, return the
 * rendered README.
 */
export function renderReadmeFromPaths({ projectRoot, catalogPath, readmePath, skillsDir }) {
  const yamlPath = catalogPath || join(projectRoot, 'meta', 'skills.yaml');
  const mdPath = readmePath || join(projectRoot, 'README.md');
  const skDir = skillsDir || join(projectRoot, 'skills', 'en');
  const catalogData = parse(readFileSync(yamlPath, 'utf8'));
  const readme = readFileSync(mdPath, 'utf8');
  return renderReadme({ catalogData, readme, skillsDir: skDir });
}

export const MARKERS = { TABLE_START, TABLE_END, DETAILS_START, DETAILS_END };
