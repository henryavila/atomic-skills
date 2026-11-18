/**
 * YAML frontmatter splitter for markdown skills that still read a document
 * with a leading `---` fence (review-plan ground-truth). No plan schema.
 */
import { parse as parseYaml } from 'yaml';

/**
 * Extract YAML frontmatter and markdown body from a `.md` file.
 * Returns { frontmatter, body, error? }.
 *
 * Expects the file to start with `---\n`, contain a second `---\n`, and
 * have a (possibly empty) body after.
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') {
    return { error: 'content is not a string' };
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { error: 'file does not start with `---` fence' };
  }
  const lines = raw.split(/\r?\n/);
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { error: 'no closing `---` fence found' };
  }
  const yamlBlock = lines.slice(1, closeIdx).join('\n');
  const body = lines.slice(closeIdx + 1).join('\n');
  let frontmatter;
  try {
    frontmatter = parseYaml(yamlBlock);
  } catch (err) {
    return { error: `YAML parse error: ${err.message}` };
  }
  if (frontmatter == null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return { error: 'frontmatter is not a YAML object' };
  }
  return { frontmatter, body };
}
