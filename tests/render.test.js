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

  it('handles conditional IDE blocks', () => {
    const input = 'Common\n{{#if ide.gemini}}\nGemini only\n{{/if}}\n{{#if ide.claude-code}}\nClaude only\n{{/if}}';
    
    const resultGemini = renderTemplate(input, {}, {}, 'gemini');
    assert.strictEqual(resultGemini, 'Common\nGemini only\n');

    const resultClaude = renderTemplate(input, {}, {}, 'claude-code');
    assert.strictEqual(resultClaude, 'Common\nClaude only\n');
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
});
