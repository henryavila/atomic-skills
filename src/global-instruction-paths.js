/**
 * File-based user instructions: https://code.claude.com/docs/en/memory,
 * https://developers.openai.com/codex/guides/agents-md,
 * https://opencode.ai/docs/rules/, https://antigravity.google/docs/rules-workflows.
 * No confirmed file-based global instructions for the remaining agents.
 *
 * Own module so the instruction provider and the IDE-symlink registry wrapper
 * can both read the table without importing each other.
 */
export const GLOBAL_INSTRUCTION_PATHS = Object.freeze({
  'claude-code': '.claude/CLAUDE.md',
  codex: '.codex/AGENTS.md',
  opencode: '.config/opencode/AGENTS.md',
  antigravity: '.gemini/GEMINI.md',
  cursor: null,
  'github-copilot': null,
  grok: null,
});
