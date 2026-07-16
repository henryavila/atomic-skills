import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderTemplate, renderForIDE } from '../src/render.js';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    const result = renderTemplate('path is {{memory_path}}', { memory_path: '.ai/memory/' });
    assert.ok(result.includes('path is .ai/memory/'));
  });

  it('keeps block when condition is true', () => {
    const input = 'before\n{{#if modules.memory}}\nmemory line\n{{/if}}\nafter';
    const result = renderTemplate(input, {}, { memory: true });
    assert.strictEqual(result, 'before\nmemory line\nafter\n');
  });

  it('removes block when condition is false', () => {
    const input = 'before\n{{#if modules.memory}}\nmemory line\n{{/if}}\nafter';
    const result = renderTemplate(input, {}, {});
    assert.strictEqual(result, 'before\nafter\n');
  });

  it('handles variable inside conditional block', () => {
    const input = '{{#if modules.memory}}\npath: {{memory_path}}\n{{/if}}';
    const result = renderTemplate(input, { memory_path: '.ctx/' }, { memory: true });
    assert.strictEqual(result, 'path: .ctx/\n');
  });

  it('strips extra blank lines left by removed blocks', () => {
    const input = 'line1\n\n{{#if modules.memory}}\nremoved\n{{/if}}\n\nline2';
    const result = renderTemplate(input, {}, {});
    assert.strictEqual(result, 'line1\n\nline2\n');
  });

  it('substitutes default tool names for claude-code', () => {
    const input = 'Use {{BASH_TOOL}} and {{READ_TOOL}}';
    const result = renderTemplate(input, {}, {}, 'claude-code');
    assert.strictEqual(result, 'Use Bash and Read tool\n');
  });

  it('substitutes gemini-specific tool names', () => {
    const input = 'Use {{BASH_TOOL}} and {{READ_TOOL}}';
    const result = renderTemplate(input, {}, {}, 'gemini');
    assert.strictEqual(result, 'Use run_shell_command and read_file\n');
  });

  it('substitutes grok tool profile (provisional D2 map)', () => {
    const input = [
      '{{BASH_TOOL}}',
      '{{READ_TOOL}}',
      '{{WRITE_TOOL}}',
      '{{REPLACE_TOOL}}',
      '{{GREP_TOOL}}',
      '{{GLOB_TOOL}}',
      '{{INVESTIGATOR_TOOL}}',
      '{{ASK_USER_QUESTION_TOOL}}',
    ].join('|');
    const result = renderTemplate(input, {}, {}, 'grok').trim();
    assert.strictEqual(
      result,
      'run_terminal_command|read_file|write|search_replace|grep|list_dir|spawn_subagent|ask_user_question',
    );
    assert.ok(!result.includes('Bash'), 'grok must not emit Claude Bash');
    assert.ok(!result.includes('Read tool'), 'grok must not emit Claude Read tool');
  });

  it('substitutes codex tool profile without Claude default names', () => {
    const input = 'Use {{BASH_TOOL}} and {{READ_TOOL}} then {{WRITE_TOOL}}/{{REPLACE_TOOL}}';
    const result = renderTemplate(input, {}, {}, 'codex');
    assert.strictEqual(result, 'Use shell and read_file then apply_patch/apply_patch\n');
    assert.ok(!result.includes('Bash'), 'codex must not emit Bash');
    assert.ok(!result.includes('Read tool'), 'codex must not emit Read tool');
  });

  it('substitutes ASSETS_PATH for grok plugin package', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'grok');
    assert.ok(
      result.includes('asset at .grok/plugins/atomic-skills/_assets/foo.md'),
      `expected plugin assets path, got: ${result}`,
    );
  });

  it('handles conditional IDE blocks', () => {
    const input = 'Common\n{{#if ide.gemini}}\nGemini only\n{{/if}}\n{{#if ide.claude-code}}\nClaude only\n{{/if}}';

    const resultGemini = renderTemplate(input, {}, {}, 'gemini');
    assert.strictEqual(resultGemini, 'Common\nGemini only\n');

    const resultClaude = renderTemplate(input, {}, {}, 'claude-code');
    assert.strictEqual(resultClaude, 'Common\nClaude only\n');
  });

  it('substitutes ASSETS_PATH for claude-code IDE', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'claude-code');
    assert.ok(result.includes('asset at .claude/atomic-skills/_assets/foo.md'));
  });

  it('substitutes ASSETS_PATH for cursor IDE', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'cursor');
    assert.ok(result.includes('asset at .cursor/atomic-skills/_assets/foo.md'));
  });

  it('substitutes ASSETS_PATH for codex IDE', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'codex');
    assert.ok(result.includes('asset at .agents/atomic-skills/_assets/foo.md'));
  });

  it('substitutes ASSETS_PATH for gemini-commands IDE (TOML flat pattern)', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'gemini-commands');
    assert.ok(result.includes('asset at .gemini/atomic-skills-_assets/foo.md'),
      `expected TOML flat pattern, got: ${result}`);
  });

  it('prefixes ASSETS_PATH with ~/ for user-scope installs (cross-repo resolution)', () => {
    // A user-scope install lives under $HOME; a relative path only resolves
    // when CWD is $HOME itself, so the skill breaks in every other repo.
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'claude-code', 'user');
    assert.ok(result.includes('asset at ~/.claude/atomic-skills/_assets/foo.md'),
      `expected ~/ prefix for user scope, got: ${result}`);
  });

  it('keeps ASSETS_PATH relative for project-scope installs', () => {
    const result = renderTemplate('asset at {{ASSETS_PATH}}/foo.md', {}, {}, 'claude-code', 'project');
    assert.ok(result.includes('asset at .claude/atomic-skills/_assets/foo.md'),
      `expected relative path for project scope, got: ${result}`);
    assert.ok(!result.includes('~/'), 'project scope must not get the ~/ prefix');
  });

  describe('ASK_USER_QUESTION_TOOL substitution', () => {
    const sample = 'Use {{ASK_USER_QUESTION_TOOL}} to ask the user.';

    it('claude-code → AskUserQuestion tool (native)', () => {
      const out = renderTemplate(sample, {}, {}, 'claude-code');
      assert.strictEqual(out, 'Use AskUserQuestion tool to ask the user.\n');
    });

    it('gemini → multiple-choice prompt string (no native tool)', () => {
      const out = renderTemplate(sample, {}, {}, 'gemini');
      assert.ok(out.includes('ask the user via a multiple-choice prompt'));
      assert.ok(!out.includes('{{ASK_USER_QUESTION_TOOL}}'));
    });

    it('cursor → same descriptive string as Gemini (no native tool)', () => {
      const out = renderTemplate(sample, {}, {}, 'cursor');
      assert.ok(out.includes('ask the user via a multiple-choice prompt'));
      assert.ok(!out.includes('{{ASK_USER_QUESTION_TOOL}}'));
    });

    it('grok → ask_user_question (native)', () => {
      const out = renderTemplate(sample, {}, {}, 'grok');
      assert.strictEqual(out, 'Use ask_user_question to ask the user.\n');
    });

    it('codex → no-native-tool string (Codex has no AskUserQuestion)', () => {
      const out = renderTemplate(sample, {}, {}, 'codex');
      assert.ok(!out.includes('{{ASK_USER_QUESTION_TOOL}}'));
      assert.ok(out.includes('ask the user via a multiple-choice prompt'));
      assert.ok(!out.includes('Bash'));
    });

    for (const ide of ['opencode', 'github-copilot', 'generic']) {
      it(`${ide} → no-native-tool string (covers ELSE branch)`, () => {
        const out = renderTemplate(sample, {}, {}, ide);
        assert.ok(!out.includes('{{ASK_USER_QUESTION_TOOL}}'));
        assert.ok(out.includes('ask the user via a multiple-choice prompt'));
      });
    }
  });
});

describe('renderForIDE', () => {
  it('renders markdown format with YAML frontmatter', () => {
    const result = renderForIDE('markdown', 'fix', 'My description', 'prompt body');
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('name: fix'));
    assert.ok(result.includes("description: 'My description'"));
    assert.ok(result.includes('user-invocable: true'));
    assert.ok(result.includes('prompt body'));
  });

  it('renders toml format', () => {
    const result = renderForIDE('toml', 'fix', 'My description', 'prompt body');
    assert.ok(result.includes('description = "My description"'));
    assert.ok(result.includes('prompt = """'));
    assert.ok(result.includes('prompt body'));
  });

  it('escapes double quotes in toml description', () => {
    const result = renderForIDE('toml', 'fix', 'Say "hello" world', 'body');
    assert.ok(result.includes('description = "Say \\"hello\\" world"'));
  });

  it('escapes single quotes in markdown description', () => {
    const result = renderForIDE('markdown', 'fix', "It's a test", 'body');
    assert.ok(result.includes("description: 'It''s a test'"));
  });

  it('renders command format for claude-code', () => {
    const result = renderForIDE('command', 'fix', 'My description', 'prompt body');
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes("description: 'My description'"));
    assert.ok(!result.includes('name:'));  // commands don't have name field
    assert.ok(!result.includes('user-invocable'));  // commands don't need this
    assert.ok(result.includes('prompt body'));
  });

  it('includes argument-hint in command format when provided', () => {
    const result = renderForIDE('command', 'fix', 'My description', 'body', { argumentHint: '[symptom]' });
    assert.ok(result.includes("argument-hint: '[symptom]'"));
  });

  it('omits argument-hint in command format when not provided', () => {
    const result = renderForIDE('command', 'fix', 'My description', 'body');
    assert.ok(!result.includes('argument-hint'));
  });

  it('omits argument-hint in non-command formats even when provided', () => {
    const markdown = renderForIDE('markdown', 'fix', 'desc', 'body', { argumentHint: '[x]' });
    const toml = renderForIDE('toml', 'fix', 'desc', 'body', { argumentHint: '[x]' });
    assert.ok(!markdown.includes('argument-hint'));
    assert.ok(!toml.includes('argument-hint'));
  });

  it('escapes single quotes in argument-hint', () => {
    const result = renderForIDE('command', 'fix', 'desc', 'body', { argumentHint: "it's a test" });
    assert.ok(result.includes("argument-hint: 'it''s a test'"));
  });
});
