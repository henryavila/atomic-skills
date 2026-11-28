/**
 * Publish-workflow inspection for the release planner.
 *
 * Only an executable `run:` step counts: a workflow name or comment that
 * merely contains the words `npm publish` or `npm stage publish` is not
 * adoption.
 */

function stripYamlComments(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*#.*$/, ''))
    .join('\n');
}

function extractRunScripts(yaml) {
  const scripts = [];
  const lines = yaml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!header) continue;
    const indent = header[1].length;
    const inline = header[2].trim();
    if (inline && inline !== '|' && inline !== '|-' && inline !== '>' && inline !== '>-') {
      scripts.push(inline);
      continue;
    }
    const buf = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') {
        buf.push(line);
        continue;
      }
      const lineIndent = line.match(/^(\s*)/)[1].length;
      if (lineIndent <= indent) break;
      buf.push(line);
    }
    scripts.push(buf.join('\n'));
  }
  return scripts;
}

function classifyNpmLine(line) {
  const trimmed = line.replace(/#.*$/, '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:npx\s+--yes\s+)?npm(?:@[\w.-]+)?\b(.*)$/);
  if (!match) return null;
  const positional = match[1]
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.startsWith('-'));
  if (positional[0] === 'stage' && positional.includes('publish')) return 'stage';
  if (positional.includes('publish')) return 'direct';
  return null;
}

/** @param {string} text workflow file contents */
export function executablePublishKinds(text) {
  const scripts = extractRunScripts(stripYamlComments(text));
  let stage = false;
  let direct = false;
  for (const script of scripts) {
    for (const line of script.split('\n')) {
      const kind = classifyNpmLine(line);
      if (kind === 'stage') stage = true;
      if (kind === 'direct') direct = true;
    }
  }
  return { stage, direct };
}

/**
 * Stage Action is adopted only when no executable step publishes directly.
 * @param {{stage: boolean, direct: boolean}} kinds
 */
export function isStageOnly({ stage, direct }) {
  return stage && !direct;
}

/** @param {{stage: boolean, direct: boolean}} kinds */
export function assertNoRegistryPublish({ stage, direct }) {
  if (stage || direct) {
    throw new Error(
      'publish.yml still runs a registry publish on release. Adopt the gh-only template or remove the workflow before shipping without npm.',
    );
  }
}
