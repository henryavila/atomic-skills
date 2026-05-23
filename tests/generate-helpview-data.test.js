import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderHelpViewData } from '../scripts/lib/render-helpview-data.js';

const baseV02 = (name, overrides = {}) => ({
  name,
  title: `${name} — Demo`,
  description: 'A demo skill used by tests.',
  purpose: 'A demo skill used by tests.',
  when_to_use: ['Testing'],
  when_not_to_use: ['Production'],
  examples: [{ command: `/atomic-skills:${name}`, description: 'Run it' }],
  one_liner: 'Compact demo skill used by unit tests',
  emoji: '🧪',
  version_added: '3.1.0',
  schema_version: '0.2',
  ...overrides,
});

describe('renderHelpViewData', () => {
  it('produces a TS file starting with the GENERATED banner', () => {
    const out = renderHelpViewData({ core: { demo: baseV02('demo') } });
    assert.match(out, /^\/\/ GENERATED — do not edit/);
    assert.match(out, /export const SKILLS: Skill\[\]/);
  });

  it('renders the v0.2 required fields', () => {
    const out = renderHelpViewData({ core: { demo: baseV02('demo') } });
    assert.match(out, /id: "demo"/);
    assert.match(out, /emoji: "🧪"/);
    assert.match(out, /oneLiner: "Compact demo skill/);
    assert.match(out, /versionAdded: "3.1.0"/);
    assert.match(out, /summary: "A demo skill used by tests."/);
  });

  it('omits optional fields when absent (no spurious empty arrays)', () => {
    const out = renderHelpViewData({ core: { demo: baseV02('demo') } });
    assert.ok(!out.includes('subcommands:'), 'no empty subcommands key');
    assert.ok(!out.includes('outputArtifacts:'), 'no empty outputArtifacts key');
    assert.ok(!out.includes('dependencies:'), 'no empty dependencies key');
  });

  it('renders subcommands when present', () => {
    const entry = baseV02('demo', {
      subcommands: [
        {
          name: 'go',
          signature: '<slug>',
          description: 'Run go subcommand',
          example: '/atomic-skills:demo go thing',
        },
      ],
    });
    const out = renderHelpViewData({ core: { demo: entry } });
    assert.match(out, /subcommands: \[/);
    assert.match(out, /name: "go"/);
    assert.match(out, /signature: "<slug>"/);
    assert.match(out, /example: "\/atomic-skills:demo go thing"/);
  });

  it('renders args with optional default', () => {
    const entry = baseV02('demo', {
      args: [
        {
          name: '--target',
          kind: 'option',
          required: false,
          description: 'Phase id',
          default: 'active phase',
        },
        {
          name: '--flag',
          kind: 'flag',
          required: false,
          description: 'Enable flag',
        },
      ],
    });
    const out = renderHelpViewData({ core: { demo: entry } });
    assert.match(out, /args: \[/);
    assert.match(out, /name: "--target"/);
    assert.match(out, /default: "active phase"/);
    assert.match(out, /name: "--flag"/);
    // The flag arg must NOT carry a default key.
    const flagBlock = out.slice(out.indexOf('"--flag"'));
    const nextBrace = flagBlock.indexOf('},');
    assert.ok(
      !flagBlock.slice(0, nextBrace).includes('default:'),
      'flag arg must not carry a default key when none provided'
    );
  });

  it('preserves unicode characters without escaping', () => {
    const entry = baseV02('demo', { emoji: '📊', one_liner: 'Status tracking with → arrow' });
    const out = renderHelpViewData({ core: { demo: entry } });
    assert.ok(out.includes('"📊"'), 'emoji preserved verbatim');
    assert.ok(out.includes('→'), 'arrow preserved verbatim');
    assert.ok(!/\\u[0-9a-fA-F]{4}/.test(out), 'no unicode escape sequences');
  });

  it('emits examples as a flat string array (commands only)', () => {
    const entry = baseV02('demo', {
      examples: [
        { command: '/atomic-skills:demo', description: 'first' },
        { command: '/atomic-skills:demo --flag', description: 'second' },
      ],
    });
    const out = renderHelpViewData({ core: { demo: entry } });
    assert.match(out, /examples: \["\/atomic-skills:demo", "\/atomic-skills:demo --flag"\]/);
  });

  it('includes modules.<mod>.<name> entries alongside core', () => {
    const out = renderHelpViewData({
      core: { demo: baseV02('demo') },
      modules: { memory: { 'init-memory': baseV02('init-memory') } },
    });
    assert.match(out, /id: "demo"/);
    assert.match(out, /id: "init-memory"/);
  });
});
