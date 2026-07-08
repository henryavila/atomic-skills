import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate } from '../src/render.js';
import { PUBLIC_IDE_IDS } from '../src/config.js';

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

const HARDCODED_INVESTIGATOR_TOOL_PATTERNS = [
  { label: 'native Agent', regex: /\bnative Agent\b/ },
  { label: '`Agent`', regex: /`Agent`/ },
  { label: 'Agent(', regex: /\bAgent\(/ },
  { label: '`Workflow`', regex: /`Workflow`/ },
  { label: 'Workflow(', regex: /\bWorkflow\(/ },
];

function hardcodedInvestigatorToolViolations(text) {
  return HARDCODED_INVESTIGATOR_TOOL_PATTERNS
    .filter(({ regex }) => regex.test(text))
    .map(({ label }) => label);
}

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

      const investigatorViolations = hardcodedInvestigatorToolViolations(content);
      assert.deepEqual(
        investigatorViolations,
        [],
        `File ${relativePath} hardcodes investigator tool reference(s) [${investigatorViolations.join(', ')}]. Use {{INVESTIGATOR_TOOL}} instead.`,
      );
    });
  });

  it('flags hardcoded investigator tool names in source markdown', () => {
    const bad = 'Use native Agent / `Workflow` fan-out.';
    assert.deepEqual(
      hardcodedInvestigatorToolViolations(bad),
      ['native Agent', '`Workflow`'],
    );
  });

  it('allows the investigator abstraction in source markdown', () => {
    const good = 'Use {{INVESTIGATOR_TOOL}} fan-out.';
    assert.deepEqual(hardcodedInvestigatorToolViolations(good), []);
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

  it('substitutes ASSETS_PATH for every public IDE', () => {
    for (const ideId of PUBLIC_IDE_IDS) {
      const result = renderTemplate('see {{ASSETS_PATH}}/x.md', {}, {}, ideId);
      assert.ok(!result.includes('{{ASSETS_PATH}}'),
        `ASSETS_PATH not substituted for ${ideId}`);
      assert.ok(result.includes('_assets'),
        `_assets not present for ${ideId}: ${result}`);
    }
  });
});

// ── R-XAGENT-01: host-orchestration ban + byte-runnable-when-stripped test ──
// The Claude-Code Workflow/Task/Worktree/Cron tooling is host-only; skills must
// also run on Gemini, where the portable spine is {{INVESTIGATOR_TOOL}} subagent
// dispatch + {{BASH_TOOL}} + durable state. Those host tools are admitted ONLY
// inside {{#if ide.claude-code}} accelerator blocks. We enforce this by RENDERING
// each skill for gemini (which strips every ide.claude-code block) and asserting
// the result is "byte-runnable when stripped": no dangling conditional, no
// claude-code block leaked, and no host-orchestration tool survives. This is the
// CI guarantee R-ORCH-30/31 rest on — it MUST land before any orchestration does.
const HOST_ORCHESTRATION_TOOLS = [
  'Workflow',
  'TaskCreate', 'TaskUpdate', 'TaskStop', 'TaskGet', 'TaskList', 'TaskOutput',
  'Monitor',
  'EnterWorktree', 'ExitWorktree',
  'CronCreate', 'CronDelete', 'CronList',
];

/**
 * Detect host-orchestration tools in CODE form only — call-shaped `Tool(` or a
 * `Tool` code-span — never bare prose words. This deliberately does NOT flag
 * ordinary English ("monitor the output", "the workflow of the audit"); the
 * tokens are only a violation when invoked/referenced as the actual tool.
 */
function hostToolViolations(text) {
  const hits = [];
  for (const tool of HOST_ORCHESTRATION_TOOLS) {
    const re = new RegExp('\\b' + tool + '\\(|`' + tool + '`');
    if (re.test(text)) hits.push(tool);
  }
  return hits;
}

describe('Cross-Agent Portability — host-orchestration ban + strip-test (R-XAGENT-01)', () => {
  const skills = getMarkdownFiles(SKILLS_ROOT);

  skills.forEach(file => {
    const relativePath = file.replace(SKILLS_ROOT, '');

    it(`skill "${relativePath}" is byte-runnable when stripped for Gemini`, () => {
      const source = readFileSync(file, 'utf8');
      const rendered = renderTemplate(source, {}, {}, 'gemini');

      // 1) every conditional was processed — no dangling handlebars structure.
      assert.ok(!rendered.includes('{{#if'),
        `File ${relativePath} has an unprocessed {{#if ...}} after rendering for Gemini.`);
      assert.ok(!rendered.includes('{{/if}}'),
        `File ${relativePath} has a dangling {{/if}} after rendering for Gemini.`);

      // 2) no claude-code conditional leaked through the strip.
      assert.ok(!rendered.includes('ide.claude-code'),
        `File ${relativePath} still references ide.claude-code after the Gemini render (block not stripped).`);

      // 3) no Claude-Code-only host-orchestration tool survives outside a CC block.
      const violations = hostToolViolations(rendered);
      assert.equal(violations.length, 0,
        `File ${relativePath} uses host-orchestration tool(s) [${violations.join(', ')}] OUTSIDE a {{#if ide.claude-code}} block. Wrap CC-only orchestration in an ide.claude-code conditional so the skill stays runnable on Gemini.`);
    });
  });

  // Synthetic fixtures prove the gate DISCRIMINATES — today zero skills use these
  // tokens, so without these the per-file checks would pass vacuously.
  it('FLAGS a host-orchestration tool used OUTSIDE a claude-code block', () => {
    const bad = [
      '# Bad skill',
      'Dispatch the work:',
      'TaskCreate({ subject: "x" })',
    ].join('\n');
    const rendered = renderTemplate(bad, {}, {}, 'gemini');
    assert.deepEqual(hostToolViolations(rendered), ['TaskCreate'],
      'a TaskCreate( call outside a CC block must be detected after the Gemini render');
  });

  it('ALLOWS the same tool INSIDE an ide.claude-code block (stripped for Gemini, kept for Claude Code)', () => {
    const good = [
      '# Good skill',
      'Portable step using {{INVESTIGATOR_TOOL}}.',
      '{{#if ide.claude-code}}',
      'Accelerator: TaskCreate({ subject: "x" })',
      '{{/if}}',
    ].join('\n');
    const gemini = renderTemplate(good, {}, {}, 'gemini');
    assert.equal(hostToolViolations(gemini).length, 0,
      'a CC-only TaskCreate inside an ide.claude-code block must be stripped for Gemini → no violation');
    assert.ok(!gemini.includes('TaskCreate'), 'the CC block must actually be removed for Gemini');
    const claude = renderTemplate(good, {}, {}, 'claude-code');
    assert.ok(claude.includes('TaskCreate('),
      'the claude-code render must keep the in-block accelerator');
  });

  it('does NOT flag ordinary prose containing the bare words "monitor"/"workflow"', () => {
    const prose = 'Monitor the build output and follow the workflow of the audit.';
    const rendered = renderTemplate(prose, {}, {}, 'gemini');
    assert.equal(hostToolViolations(rendered).length, 0,
      'bare English words must not be flagged — only code-shaped tool references');
  });
});
