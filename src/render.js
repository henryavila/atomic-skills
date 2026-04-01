/**
 * Process template variables and conditional blocks.
 * @param {string} content - Template content
 * @param {Record<string, string>} vars - Variable substitutions
 * @param {Record<string, boolean>} modules - Installed modules (for conditionals)
 * @param {string} ideId - The current IDE ID
 * @returns {string}
 */
export function renderTemplate(content, vars = {}, modules = {}, ideId = '') {
  // Build full context for conditionals
  const context = {
    modules,
    ide: ideId ? { [ideId]: true } : {},
  };

  if (ideId === 'codex') {
    context.ide.gemini = true;
  }

  // Process conditional blocks (single-level, no nesting)
  // Support {{#if modules.name}} and {{#if ide.name}}
  let result = content.replace(
    /{{#if (modules|ide)\.([\w-]+)}}\n([\s\S]*?){{\/if}}\n?/g,
    (_, type, name, block) => {
      const isTrue = context[type] && context[type][name];
      return isTrue ? block : '';
    }
  );

  // Substitute variables
  const allVars = { ...vars };
  
  // Add IDE-specific tool names
  const isGemini = ideId === 'gemini' || ideId === 'codex';
  if (isGemini) {
    allVars.BASH_TOOL = 'run_shell_command';
    allVars.READ_TOOL = 'read_file';
    allVars.WRITE_TOOL = 'write_file';
    allVars.REPLACE_TOOL = 'replace';
    allVars.GREP_TOOL = 'grep_search';
    allVars.GLOB_TOOL = 'glob';
    allVars.INVESTIGATOR_TOOL = 'codebase_investigator';
    allVars.ARG_VAR = '$ARGUMENTS';
  } else {
    // Default to Claude Code style tool names
    allVars.BASH_TOOL = 'Bash';
    allVars.READ_TOOL = 'Read tool';
    allVars.WRITE_TOOL = 'Write tool';
    allVars.REPLACE_TOOL = 'Edit tool';
    allVars.GREP_TOOL = 'Grep';
    allVars.GLOB_TOOL = 'Glob';
    allVars.INVESTIGATOR_TOOL = 'Agent';
    allVars.ARG_VAR = '$ARGUMENTS';
  }

  for (const [key, value] of Object.entries(allVars)) {
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
 * @param {string} [ideId] - The current IDE ID
 * @returns {string}
 */
export function renderForIDE(format, name, description, body, ideId = '') {
  let finalBody = body;
  
  if (ideId === 'gemini' || ideId === 'codex') {
    finalBody += `\n\n<HARD-GATE>\n**EXECUTION MANDATE:** If you were activated via a direct user command (e.g. /${name}) and the user provided no other instructions, you MUST IMMEDIATELY begin executing the process defined above. Do not just acknowledge activation. Stop waiting for further prompting.\n</HARD-GATE>\n`;
  }

  // markdown (default) — YAML single-quote escaping: ' → ''
  const escaped = description.replace(/'/g, "''");
  return `---\nname: ${name}\ndescription: '${escaped}'\n---\n\n${finalBody}\n`;
}
