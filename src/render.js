/**
 * Process template variables and conditional blocks.
 * @param {string} content - Template content
 * @param {Record<string, string>} vars - Variable substitutions
 * @param {Record<string, boolean>} modules - Installed modules (for conditionals)
 * @returns {string}
 */
export function renderTemplate(content, vars = {}, modules = {}) {
  // Process conditional blocks (single-level, no nesting)
  let result = content.replace(
    /{{#if modules\.(\w+)}}\n([\s\S]*?){{\/if}}\n?/g,
    (_, moduleName, block) => {
      return modules[moduleName] ? block : '';
    }
  );

  // Substitute variables
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Strip consecutive blank lines (more than 2 newlines → 2)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim() + '\n';
}

/**
 * Wrap rendered content in IDE-specific format.
 * @param {'markdown'|'toml'} format
 * @param {string} name - Skill name (e.g. 'as-fix')
 * @param {string} description - English description
 * @param {string} body - Rendered prompt body
 * @returns {string}
 */
export function renderForIDE(format, name, description, body) {
  if (format === 'toml') {
    const escaped = description.replace(/"/g, '\\"');
    return `description = "${escaped}"\nprompt = """\n${body}\n"""\n`;
  }

  // markdown (default) — YAML single-quote escaping: ' → ''
  const escaped = description.replace(/'/g, "''");
  return `---\nname: ${name}\ndescription: '${escaped}'\n---\n\n${body}\n`;
}
