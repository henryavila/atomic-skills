import { IDE_CONFIG, SKILL_NAMESPACE } from './config.js';

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

  // Process conditional blocks (single-level, no nesting)
  // Support {{#if modules.name}} and {{#if ide.name}}
  let result = content.replace(
    /{{#if (modules|ide)\.([\w-]+)}}\n([\s\S]*?){{\/if}}\n?/g,
    (_, type, name, block) => {
      // Normalize ideId for conditional checks (e.g. gemini-commands -> gemini)
      const normalizedName = type === 'ide' && name === 'gemini' && ideId === 'gemini-commands' ? 'gemini' : name;
      const isTrue = context[type] && context[type][normalizedName];
      return isTrue ? block : '';
    }
  );

  // Substitute variables
  const allVars = { ...vars };
  
  // Add IDE-specific tool names
  const isGemini = ideId === 'gemini' || ideId === 'gemini-commands';
  const isClaudeCode = ideId === 'claude-code';
  const noNativeAskTool =
    'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)';
  if (isGemini) {
    allVars.BASH_TOOL = 'run_shell_command';
    allVars.READ_TOOL = 'read_file';
    allVars.WRITE_TOOL = 'write_file';
    allVars.REPLACE_TOOL = 'replace';
    allVars.GREP_TOOL = 'grep_search';
    allVars.GLOB_TOOL = 'glob';
    allVars.INVESTIGATOR_TOOL = 'codebase_investigator';
    allVars.ARG_VAR = '$ARGUMENTS';
    allVars.ASK_USER_QUESTION_TOOL = noNativeAskTool;
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
    allVars.ASK_USER_QUESTION_TOOL = isClaudeCode ? 'AskUserQuestion tool' : noNativeAskTool;
  }

  // Add IDE-specific ASSETS_PATH (where shared assets live for this IDE)
  const ide = IDE_CONFIG[ideId];
  if (ide) {
    const assetsDir = ide.format === 'toml'
      ? `${ide.dir}/${SKILL_NAMESPACE}-_assets`        // toml IDEs use flat name pattern
      : `${ide.dir}/${SKILL_NAMESPACE}/_assets`;       // markdown/command IDEs use directory pattern
    allVars.ASSETS_PATH = assetsDir;
  } else {
    allVars.ASSETS_PATH = '_assets';
  }

  for (const [key, value] of Object.entries(allVars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Inject communication-language directive at the top of the body when configured.
  // This makes the AI respond to the user in their chosen language regardless of
  // the (English) language the skill source is written in.
  if (allVars.COMMUNICATION_LANGUAGE) {
    const langLabels = {
      en: 'English', pt: 'Portuguese (Brazilian)',
      es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
      ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
      nl: 'Dutch', pl: 'Polish', ar: 'Arabic', hi: 'Hindi',
      tr: 'Turkish', sv: 'Swedish', da: 'Danish', nb: 'Norwegian',
    };
    const label = langLabels[allVars.COMMUNICATION_LANGUAGE] || allVars.COMMUNICATION_LANGUAGE;
    const directive = `> Communicate with the user in ${label}. Translate any English example strings in this skill at runtime; do not output them verbatim.`;
    result = `${directive}\n\n${result}`;
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
 * @param {object} [opts] - Optional fields
 * @param {string} [opts.argumentHint] - Displayed in autocomplete (Claude Code)
 * @returns {string}
 */
export function renderForIDE(format, name, description, body, opts = {}) {
  if (format === 'toml') {
    const escaped = description.replace(/"/g, '\\"');
    return `description = "${escaped}"\nprompt = """\n${body}\n"""\n`;
  }

  if (format === 'command') {
    const escaped = description.replace(/'/g, "''");
    const hintLine = opts.argumentHint
      ? `\nargument-hint: '${opts.argumentHint.replace(/'/g, "''")}'`
      : '';
    return `---\ndescription: '${escaped}'${hintLine}\n---\n\n${body}\n`;
  }

  // markdown (default for Cursor, Gemini, Codex, etc.) — YAML single-quote escaping: ' → ''
  const escaped = description.replace(/'/g, "''");
  return `---\nname: ${name}\ndescription: '${escaped}'\nuser-invocable: true\n---\n\n${body}\n`;
}
