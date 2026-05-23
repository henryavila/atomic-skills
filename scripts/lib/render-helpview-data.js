import { collectSkills } from './validate-skills-core.js';

const FILE_HEADER = `// GENERATED — do not edit. Source: meta/catalog.yaml.
// Run \`npm run generate-docs\` to regenerate. See
// docs/plan-skills-catalog-v0.2.md for the generator contract.

export interface Subcommand {
  name: string
  signature: string
  description: string
  example: string
}

export interface SkillArg {
  name: string
  kind: 'positional' | 'flag' | 'option'
  required: boolean
  description: string
  default?: string
}

export interface Skill {
  id: string
  title: string
  emoji: string
  oneLiner: string
  versionAdded: string
  summary?: string
  active?: boolean
  incomplete?: boolean
  when?: string[]
  whenNot?: string[]
  examples?: string[]
  subcommands?: Subcommand[]
  args?: SkillArg[]
  outputArtifacts?: string[]
  dependencies?: string[]
  related?: string[]
  tags?: string[]
}
`;

function quoteJsonString(s) {
  // JSON.stringify handles escaping; we wrap with backticks to keep diffs
  // tight for multi-line strings (none in our catalog right now, but keeps
  // future-proof).
  return JSON.stringify(s);
}

function renderArray(items) {
  if (!Array.isArray(items) || items.length === 0) return '[]';
  return `[${items.map(quoteJsonString).join(', ')}]`;
}

function renderSubcommands(subs) {
  if (!Array.isArray(subs) || subs.length === 0) return null;
  const rows = subs.map(
    (s) =>
      `      { name: ${quoteJsonString(s.name)}, signature: ${quoteJsonString(
        s.signature
      )}, description: ${quoteJsonString(s.description)}, example: ${quoteJsonString(
        s.example
      )} },`
  );
  return `[\n${rows.join('\n')}\n    ]`;
}

function renderArgs(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  const rows = args.map((a) => {
    const defaultPart = a.default ? `, default: ${quoteJsonString(a.default)}` : '';
    return (
      `      { name: ${quoteJsonString(a.name)}, kind: ${quoteJsonString(
        a.kind
      )}, required: ${a.required ? 'true' : 'false'}, description: ${quoteJsonString(
        a.description
      )}${defaultPart} },`
    );
  });
  return `[\n${rows.join('\n')}\n    ]`;
}

function renderSkill(skill) {
  const e = skill.entry;
  const lines = [];
  lines.push('  {');
  lines.push(`    id: ${quoteJsonString(skill.key)},`);
  lines.push(`    title: ${quoteJsonString(e.title)},`);
  lines.push(`    emoji: ${quoteJsonString(e.emoji)},`);
  lines.push(`    oneLiner: ${quoteJsonString(e.one_liner)},`);
  lines.push(`    versionAdded: ${quoteJsonString(e.version_added)},`);
  if (e.description) {
    lines.push(`    summary: ${quoteJsonString(e.description)},`);
  }
  lines.push(`    active: true,`);
  if (Array.isArray(e.when_to_use)) {
    lines.push(`    when: ${renderArray(e.when_to_use)},`);
  }
  if (Array.isArray(e.when_not_to_use)) {
    lines.push(`    whenNot: ${renderArray(e.when_not_to_use)},`);
  }
  if (Array.isArray(e.examples) && e.examples.length > 0) {
    const cmds = e.examples.map((ex) => ex.command);
    lines.push(`    examples: ${renderArray(cmds)},`);
  }
  const subs = renderSubcommands(e.subcommands);
  if (subs) lines.push(`    subcommands: ${subs},`);
  const args = renderArgs(e.args);
  if (args) lines.push(`    args: ${args},`);
  if (Array.isArray(e.output_artifacts) && e.output_artifacts.length > 0) {
    lines.push(`    outputArtifacts: ${renderArray(e.output_artifacts)},`);
  }
  if (Array.isArray(e.dependencies) && e.dependencies.length > 0) {
    lines.push(`    dependencies: ${renderArray(e.dependencies)},`);
  }
  if (Array.isArray(e.related) && e.related.length > 0) {
    lines.push(`    related: ${renderArray(e.related)},`);
  }
  if (Array.isArray(e.tags) && e.tags.length > 0) {
    lines.push(`    tags: ${renderArray(e.tags)},`);
  }
  lines.push('  },');
  return lines.join('\n');
}

export function renderHelpViewData(catalogData) {
  const skills = collectSkills(catalogData);
  const body = skills.map(renderSkill).join('\n');
  return `${FILE_HEADER}\nexport const SKILLS: Skill[] = [\n${body}\n]\n`;
}
