import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  matchAideckTool,
  indexAideckTools,
  selectMcpTool,
  mcpToolMap,
  AIDECK_TOOL_RE,
} from '../src/mcp-mode.js';

describe('matchAideckTool', () => {
  it('recognizes the Claude Code namespacing convention', () => {
    assert.equal(matchAideckTool('mcp__claude_ai_aideck__mark_task_done'), 'mark_task_done');
  });

  it('recognizes the bare aideck namespacing', () => {
    assert.equal(matchAideckTool('mcp__aideck__push_frame'), 'push_frame');
  });

  it('accepts arbitrary prefixes / suffixes containing `aideck`', () => {
    assert.equal(matchAideckTool('mcp__local_aideck_v2__park_item'), 'park_item');
  });

  it('rejects non-aideck MCP tools', () => {
    assert.equal(matchAideckTool('mcp__notion__create_page'), null);
    assert.equal(matchAideckTool('mcp__mdprobe__mdprobe_view'), null);
  });

  it('rejects non-MCP tool names', () => {
    assert.equal(matchAideckTool('Bash'), null);
    assert.equal(matchAideckTool('mcp__'), null);
    assert.equal(matchAideckTool(''), null);
  });

  it('rejects non-string inputs without throwing', () => {
    assert.equal(matchAideckTool(null), null);
    assert.equal(matchAideckTool(undefined), null);
    assert.equal(matchAideckTool(42), null);
  });

  it('regex is exported for documentation cross-checks', () => {
    assert.ok(AIDECK_TOOL_RE instanceof RegExp);
  });
});

describe('indexAideckTools', () => {
  it('keeps only aideck tools and indexes by short name', () => {
    const idx = indexAideckTools([
      'Bash',
      'mcp__notion__notion-search',
      'mcp__claude_ai_aideck__mark_task_done',
      'mcp__claude_ai_aideck__push_frame',
    ]);
    assert.equal(idx.size, 2);
    assert.equal(idx.get('mark_task_done'), 'mcp__claude_ai_aideck__mark_task_done');
    assert.equal(idx.get('push_frame'), 'mcp__claude_ai_aideck__push_frame');
  });

  it('preserves first-wins when duplicate short names appear', () => {
    const idx = indexAideckTools([
      'mcp__aideck__push_frame',
      'mcp__local_aideck__push_frame',
    ]);
    assert.equal(idx.get('push_frame'), 'mcp__aideck__push_frame');
  });

  it('handles non-array inputs without throwing', () => {
    assert.equal(indexAideckTools(null).size, 0);
    assert.equal(indexAideckTools(undefined).size, 0);
    assert.equal(indexAideckTools('not-an-array').size, 0);
  });
});

describe('selectMcpTool', () => {
  const FULL_TOOLSET = [
    'Bash',
    'Read',
    'mcp__claude_ai_aideck__mark_task_done',
    'mcp__claude_ai_aideck__push_frame',
    'mcp__claude_ai_aideck__pop_frame',
    'mcp__claude_ai_aideck__park_item',
    'mcp__claude_ai_aideck__emerge_item',
    'mcp__claude_ai_aideck__promote_parked',
    'mcp__claude_ai_aideck__update_initiative_status',
  ];

  it('resolves `done` to mark_task_done when aideck is listed', () => {
    assert.equal(
      selectMcpTool('done', FULL_TOOLSET),
      'mcp__claude_ai_aideck__mark_task_done'
    );
  });

  it('resolves `phase-done` and `archive` both to update_initiative_status', () => {
    assert.equal(
      selectMcpTool('phase-done', FULL_TOOLSET),
      'mcp__claude_ai_aideck__update_initiative_status'
    );
    assert.equal(
      selectMcpTool('archive', FULL_TOOLSET),
      'mcp__claude_ai_aideck__update_initiative_status'
    );
  });

  it('returns null when no aideck tools are listed (offline mode)', () => {
    assert.equal(selectMcpTool('done', ['Bash', 'Read']), null);
  });

  it('returns null when the specific tool is missing from a partial toolset', () => {
    // aideck connected but somehow doesn't expose update_initiative_status
    assert.equal(
      selectMcpTool('phase-done', ['mcp__aideck__mark_task_done']),
      null
    );
  });

  it('returns null for commands without an MCP mapping', () => {
    assert.equal(selectMcpTool('new', FULL_TOOLSET), null);
    assert.equal(selectMcpTool('new-plan', FULL_TOOLSET), null);
    assert.equal(selectMcpTool('migrate', FULL_TOOLSET), null);
    assert.equal(selectMcpTool('detect-scope', FULL_TOOLSET), null);
  });

  it('returns null for unknown commands without throwing', () => {
    assert.equal(selectMcpTool('definitely-not-a-command', FULL_TOOLSET), null);
  });
});

describe('mcpToolMap', () => {
  it('is frozen so the skill body and runtime cannot drift independently', () => {
    assert.ok(Object.isFrozen(mcpToolMap));
  });

  it('covers exactly the mutating commands documented in the skill body', () => {
    // The skill body's "Command → MCP tool map" table lists these mutating
    // commands. Commands intentionally NOT mapped (file-write fallback):
    //   new-plan, new, detect-scope, migrate.
    const mapped = new Set(Object.keys(mcpToolMap));
    const expected = new Set([
      'push', 'pop', 'park', 'emerge', 'promote',
      'done', 'phase-done', 'archive', 'switch',
    ]);
    assert.deepEqual(mapped, expected);
  });
});
