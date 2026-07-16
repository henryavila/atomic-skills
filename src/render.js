import { IDE_CONFIG, getAssetsDir } from './config.js';

/**
 * Process template variables and conditional blocks.
 * @param {string} content - Template content
 * @param {Record<string, string>} vars - Variable substitutions
 * @param {Record<string, boolean>} modules - Installed modules (for conditionals)
 * @param {string} ideId - The current IDE ID
 * @param {''|'user'|'project'} scope - Install scope; 'user' prefixes ASSETS_PATH
 *   with `~/` so the rendered path resolves from ANY repo (the files live under
 *   $HOME, and a relative path only resolves when CWD is $HOME itself).
 * @returns {string}
 */
export function renderTemplate(content, vars = {}, modules = {}, ideId = '', scope = '') {
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

  // IDE-specific tool names. Profiles must never free-ride Claude names for
  // hosts that have their own tool surface (Gemini, Grok, Codex).
  const noNativeAskTool =
    'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)';
  Object.assign(allVars, toolProfileFor(ideId, noNativeAskTool));

  // Add IDE-specific ASSETS_PATH (where shared assets live for this IDE).
  // User scope: the install base is $HOME, so the path must be ~/-anchored —
  // a relative `.claude/...` only resolves when the skill happens to run with
  // CWD == $HOME, and these skills run from arbitrary repos.
  const ide = IDE_CONFIG[ideId];
  const scopePrefix = scope === 'user' ? '~/' : '';
  if (ide) {
    allVars.ASSETS_PATH = `${scopePrefix}${getAssetsDir(ideId)}`;
  } else {
    allVars.ASSETS_PATH = `${scopePrefix}_assets`;
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
 * Resolve the tool-name substitution map for an IDE.
 * @param {string} ideId
 * @param {string} noNativeAskTool
 * @returns {Record<string, string>}
 */
function toolProfileFor(ideId, noNativeAskTool) {
  const isGemini = ideId === 'gemini' || ideId === 'gemini-commands';
  if (isGemini) {
    return {
      BASH_TOOL: 'run_shell_command',
      READ_TOOL: 'read_file',
      WRITE_TOOL: 'write_file',
      REPLACE_TOOL: 'replace',
      GREP_TOOL: 'grep_search',
      GLOB_TOOL: 'glob',
      INVESTIGATOR_TOOL: 'codebase_investigator',
      ARG_VAR: '$ARGUMENTS',
      ASK_USER_QUESTION_TOOL: noNativeAskTool,
    };
  }
  if (ideId === 'grok') {
    // Provisional Grok Build map (design D2). Locked by render tests; F2 may
    // adjust if headless CLI tool ids differ from the interactive surface.
    return {
      BASH_TOOL: 'run_terminal_command',
      READ_TOOL: 'read_file',
      WRITE_TOOL: 'write',
      REPLACE_TOOL: 'search_replace',
      GREP_TOOL: 'grep',
      GLOB_TOOL: 'list_dir',
      INVESTIGATOR_TOOL: 'spawn_subagent',
      ARG_VAR: '$ARGUMENTS',
      ASK_USER_QUESTION_TOOL: 'ask_user_question',
    };
  }
  if (ideId === 'codex') {
    // Codex CLI agent tools — not Claude names (Bash / Read tool).
    return {
      BASH_TOOL: 'shell',
      READ_TOOL: 'read_file',
      WRITE_TOOL: 'apply_patch',
      REPLACE_TOOL: 'apply_patch',
      GREP_TOOL: 'grep_files',
      GLOB_TOOL: 'list_dir',
      INVESTIGATOR_TOOL: 'spawn_agent',
      ARG_VAR: '$ARGUMENTS',
      ASK_USER_QUESTION_TOOL: noNativeAskTool,
    };
  }
  // Default: Claude Code style (also free-ride baseline for hosts without a
  // dedicated profile: cursor, opencode, github-copilot, unknown).
  const isClaudeCode = ideId === 'claude-code';
  return {
    BASH_TOOL: 'Bash',
    READ_TOOL: 'Read tool',
    WRITE_TOOL: 'Write tool',
    REPLACE_TOOL: 'Edit tool',
    GREP_TOOL: 'Grep',
    GLOB_TOOL: 'Glob',
    INVESTIGATOR_TOOL: 'Agent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL: isClaudeCode ? 'AskUserQuestion tool' : noNativeAskTool,
  };
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
