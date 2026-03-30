import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate } from '../src/render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(__dirname, '..', 'skills');

// List of forbidden (hardcoded) terms in source .md files
const FORBIDDEN_TERMS = [
  'Bash',
  'Read tool',
  'Write tool',
  'Edit tool',
  'Agent tool',
  '$ARGUMENTS'
];

/**
 * Helper to get all .md files recursively
 */
function getMarkdownFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      getMarkdownFiles(path, files);
    } else if (path.endsWith('.md')) {
      files.push(path);
    }
  }
  return files;
}

describe('Cross-Agent Compatibility (Lint)', () => {
  const skills = getMarkdownFiles(SKILLS_ROOT);

  skills.forEach(file => {
    const relativePath = file.replace(SKILLS_ROOT, '');
    
    it(`skill "${relativePath}" should not have hardcoded tool names`, () => {
      const content = readFileSync(file, 'utf8');
      
      FORBIDDEN_TERMS.forEach(term => {
        // Regex to match the term as a whole word
        const regex = new RegExp(`\\b${term.replace('$', '\\$')}\\b`, 'g');
        const matches = content.match(regex);
        
        if (matches) {
          // Check if it's NOT inside double curly braces {{ }}
          // This is a simple heuristic: check the characters immediately before
          const hasHardcoded = matches.some(match => {
            const index = content.indexOf(match);
            const prefix = content.substring(index - 2, index);
            const suffix = content.substring(index + match.length, index + match.length + 2);
            return prefix !== '{{' && suffix !== '}}';
          });
          
          assert.ok(!hasHardcoded, `File ${relativePath} contains hardcoded tool name: "${term}". Use the corresponding {{VARIABLE}} instead.`);
        }
      });
    });
  });
});

describe('Cross-Agent Rendering Integration', () => {
  const sampleContent = `
# Test Skill
Use {{BASH_TOOL}} and {{READ_TOOL}}.
{{#if ide.gemini}}
Gemini hacks here.
{{/if}}
{{#if ide.claude-code}}
Claude specific instructions.
{{/if}}
  `.trim();

  it('renders correctly for Gemini', () => {
    const rendered = renderTemplate(sampleContent, {}, {}, 'gemini');
    assert.ok(rendered.includes('run_shell_command'));
    assert.ok(rendered.includes('read_file'));
    assert.ok(rendered.includes('Gemini hacks here.'));
    assert.ok(!rendered.includes('Claude specific instructions.'));
  });

  it('renders correctly for Claude Code', () => {
    const rendered = renderTemplate(sampleContent, {}, {}, 'claude-code');
    assert.ok(rendered.includes('Bash'));
    assert.ok(rendered.includes('Read tool'));
    assert.ok(rendered.includes('Claude specific instructions.'));
    assert.ok(!rendered.includes('Gemini hacks here.'));
  });
});
