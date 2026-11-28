import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { renderProjectGuidePage, renderSkillDetail } from '../scripts/lib/render-site.js';
import { renderProductEnvelope } from '../scripts/lib/render-readme.js';

// Byte-exact pins for the renderers split in PAY-8C. The refactors move code
// between helpers and modules; these hashes make any change to the emitted
// text or markup fail loudly.

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const fullGuide = {
  title: 'Project guide',
  lede: 'Tracks delivery.',
  one_liner: 'Plan ⊃ Phase ⊃ Task',
  iron_law: 'NO IMPLEMENTATION WITHOUT AN ANCHORED INITIATIVE.',
  prefix: '/atomic-skills:project',
  state_root: '.atomic-skills/',
  entities: [
    { id: 'plan', name: 'Plan', summary: 'Multi-phase delivery', nests: 'Phases' },
  ],
  key_concepts: [{ id: 'k', title: 'Frame', body: 'One frame per initiative.' }],
  lifecycle_spine: [
    { id: 'idea', label: 'IDEA', note: 'Capture' },
    { id: 'done', label: 'DONE', note: '' },
  ],
  execution_loop: [{ step: 'plan', gate: 'No open questions' }],
  can: ['Reload the frame'],
  cannot: ['Hand-edit state'],
  command_groups: [
    {
      id: 'view',
      title: 'View',
      commands: [{ name: 'status', args: '[--browser]', description: 'See state' }],
    },
  ],
  sister_skills: [{ moment: 'Research', skill: 'fix', role: 'Root cause' }],
  lost_footer: [
    { label: 'Lost', command: '/atomic-skills:project status', note: 'Reload' },
  ],
};

const fullSkill = {
  key: 'demo',
  modulePath: null,
  entry: {
    emoji: '🧪',
    title: 'Demo — Sample',
    one_liner: 'A short sample one-liner.',
    iron_law: 'NO DEMO WITHOUT LAW.',
    value_pitch: 'Because demos deserve law.',
    purpose: 'Demonstrate rendering.',
    when_to_use: ['When testing'],
    when_not_to_use: ['Never'],
    examples: [{ command: '/x', description: 'Run x' }],
  },
};

const fullProduct = {
  what_is: 'Battle-tested prompts.',
  what_is_not: ['A pack'],
  docs_url: 'https://example.test',
  install: { primary: 'npx example install' },
};

describe('render-site snapshots', () => {
  it('renderProjectGuidePage emits the recorded project guide page', () => {
    const html = renderProjectGuidePage({ guide: fullGuide });
    assert.equal(
      sha256(html),
      '0a2d2348249b7927410eff63cc8199f324776a6a0b92e4017e4b3251b2533083'
    );
  });

  it('renderSkillDetail emits the recorded skill detail page', () => {
    const html = renderSkillDetail({ skill: fullSkill });
    assert.equal(
      sha256(html),
      'db332d2168073633d478ed1565870ad96932d1dcf7a535a4613e141a5f25dc5b'
    );
  });

  it('renderProductEnvelope emits the recorded product envelope', () => {
    const body = renderProductEnvelope(fullProduct);
    assert.equal(
      sha256(body),
      'bef8ab3da8ff83b4eaf1a888fe27e84be132a23a313541de745b49c189682233'
    );
  });
});
