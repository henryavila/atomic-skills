import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderTemplate, renderForIDE } from '../src/render.js';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    const result = renderTemplate('path is {{memory_path}}', { memory_path: '.ai/memory/' });
    assert.strictEqual(result, 'path is .ai/memory/\n');
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
});

describe('renderForIDE', () => {
  it('renders markdown format with YAML frontmatter', () => {
    const result = renderForIDE('markdown', 'as-fix', 'My description', 'prompt body');
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('name: as-fix'));
    assert.ok(result.includes("description: 'My description'"));
    assert.ok(result.includes('prompt body'));
  });

  it('renders toml format', () => {
    const result = renderForIDE('toml', 'as-fix', 'My description', 'prompt body');
    assert.ok(result.includes('description = "My description"'));
    assert.ok(result.includes('prompt = """'));
    assert.ok(result.includes('prompt body'));
  });

  it('escapes double quotes in toml description', () => {
    const result = renderForIDE('toml', 'as-fix', 'Say "hello" world', 'body');
    assert.ok(result.includes('description = "Say \\"hello\\" world"'));
  });

  it('escapes single quotes in markdown description', () => {
    const result = renderForIDE('markdown', 'as-fix', "It's a test", 'body');
    assert.ok(result.includes("description: 'It''s a test'"));
  });
});
