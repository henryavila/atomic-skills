// MCP-mode helpers for the project-status skill body.
//
// The skill body's "aiDeck MCP integration" section describes a runtime
// detection rule the LLM applies inline: "is an `mcp__*aideck*__get_state`
// tool listed?". That decision is made by the agent against its tool set
// and cannot be tested in pure Node, so the helpers here cover the parts
// that *can* be unit-tested:
//
//   - matchAideckTool: given a tool name listed by the IDE, decide whether
//     it belongs to the aideck MCP server. The skill body uses the exact
//     pattern documented below; centralizing it here keeps that pattern
//     auditable.
//   - selectMcpTool: pick the preferred MCP tool name for a skill command
//     when aideck is present. Returns null when no MCP mapping exists for
//     the command (i.e. the skill must fall through to direct file writes).
//   - mcpToolMap: the canonical command → tool mapping, exposed so the
//     skill body documentation and the runtime helper stay in sync.

/**
 * Regex matching tool names that the aiDeck MCP server exposes. Connectors
 * may prefix server names (e.g. Claude Code uses `mcp__claude_ai_aideck__*`,
 * other IDEs use `mcp__aideck__*`), so the matcher accepts any prefix that
 * contains `aideck` between the leading `mcp__` and the tool short name.
 */
export const AIDECK_TOOL_RE = /^mcp__[A-Za-z0-9_]*aideck[A-Za-z0-9_]*__([A-Za-z0-9_]+)$/;

/**
 * @typedef {Object} ToolMatch
 * @property {string} fullName  Original tool name as listed by the IDE.
 * @property {string} shortName Short name after the namespace, e.g. `mark_task_done`.
 */

/**
 * Returns the short name (post-namespace) when `toolName` belongs to the
 * aiDeck MCP server, else null. Pure function — does NOT call any tool.
 *
 * @param {string} toolName
 * @returns {string|null}
 */
export function matchAideckTool(toolName) {
  if (typeof toolName !== 'string') return null;
  const m = AIDECK_TOOL_RE.exec(toolName);
  return m ? m[1] : null;
}

/**
 * Indexes a list of currently-available tool names by their aideck short
 * name. Tools that don't belong to aideck are dropped.
 *
 * @param {readonly string[]} availableTools
 * @returns {Map<string, string>}  short-name → full-name
 */
export function indexAideckTools(availableTools) {
  const out = new Map();
  if (!Array.isArray(availableTools)) return out;
  for (const name of availableTools) {
    const short = matchAideckTool(name);
    if (short !== null && !out.has(short)) out.set(short, name);
  }
  return out;
}

/**
 * Canonical command → MCP-short-name mapping. Mirrors the skill body table
 * in `skills/en/core/project-status.md` § aiDeck MCP integration. Commands
 * not listed here have no MCP equivalent and always fall back to direct
 * file writes.
 *
 * The values are SHORT names (without the `mcp__*aideck*__` prefix) because
 * the prefix varies per connector. Callers compose the full tool name via
 * `indexAideckTools()`.
 */
export const mcpToolMap = Object.freeze({
  'push': 'push_frame',
  'pop': 'pop_frame',
  'park': 'park_item',
  'emerge': 'emerge_item',
  'promote': 'promote_parked',
  'done': 'mark_task_done',
  'phase-done': 'update_initiative_status', // also calls verify_exit_gate per criterion
  'archive': 'update_initiative_status',
  'switch': 'update_initiative_status',
});

/**
 * Resolves the MCP tool the skill should prefer for a given command, given
 * the IDE's currently-listed tools. Returns the full namespaced tool name
 * when both the command has an MCP mapping AND that tool is actually
 * exposed by aideck right now. Returns null otherwise — the skill body
 * then falls back to direct file writes.
 *
 * @param {string} command
 * @param {readonly string[]} availableTools
 * @returns {string|null}
 */
export function selectMcpTool(command, availableTools) {
  const shortName = mcpToolMap[command];
  if (!shortName) return null;
  const index = indexAideckTools(availableTools);
  return index.get(shortName) ?? null;
}
