/**
 * F2/T-001 — every PUBLIC_IDE_ID has an explicit tool profile; Claude tool
 * names never leak into non-Claude hosts; template vars always substitute.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  PUBLIC_IDE_IDS,
  HOST_TOOL_PROFILES,
  getHostToolProfile,
  getHostSupportTier,
} from '../src/config.js';
import { renderTemplate } from '../src/render.js';
import { loadHostQualification } from '../scripts/validate-host-qualification.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'meta', 'host-qualification.json');

const CLAUDE_LEAKS = ['Bash', 'Read tool', 'Write tool', 'Edit tool', 'AskUserQuestion tool'];
const TOOL_KEYS = [
  'BASH_TOOL',
  'READ_TOOL',
  'WRITE_TOOL',
  'REPLACE_TOOL',
  'GREP_TOOL',
  'GLOB_TOOL',
  'INVESTIGATOR_TOOL',
  'ARG_VAR',
  'ASK_USER_QUESTION_TOOL',
];

const TEMPLATE = TOOL_KEYS.map((k) => `{{${k}}}`).join('|');

describe('host profile contract (F2/T-001)', () => {
  it('exports HOST_TOOL_PROFILES for every PUBLIC_IDE_ID', () => {
    for (const id of PUBLIC_IDE_IDS) {
      assert.ok(HOST_TOOL_PROFILES[id], `missing HOST_TOOL_PROFILES['${id}']`);
      const profile = getHostToolProfile(id);
      for (const key of TOOL_KEYS) {
        assert.equal(typeof profile[key], 'string', `${id}.${key}`);
        assert.ok(profile[key].length > 0, `${id}.${key} empty`);
      }
    }
  });

  it('does not free-ride Claude tool names on non-Claude public hosts', () => {
    for (const id of PUBLIC_IDE_IDS) {
      if (id === 'claude-code') continue;
      const rendered = renderTemplate(TEMPLATE, {}, {}, id).trim();
      for (const leak of CLAUDE_LEAKS) {
        assert.ok(
          !rendered.includes(leak),
          `${id} must not emit Claude token "${leak}"; got: ${rendered}`,
        );
      }
    }
  });

  it('claude-code keeps Claude-native tool names', () => {
    const rendered = renderTemplate(TEMPLATE, {}, {}, 'claude-code').trim();
    assert.ok(rendered.includes('Bash'));
    assert.ok(rendered.includes('Read tool'));
  });

  it('leaves no unsubstituted tool template variables for any public host', () => {
    for (const id of PUBLIC_IDE_IDS) {
      const rendered = renderTemplate(TEMPLATE, {}, {}, id);
      assert.ok(!rendered.includes('{{'), `unsubstituted token in ${id}: ${rendered}`);
      for (const key of TOOL_KEYS) {
        assert.ok(!rendered.includes(`{{${key}}}`), `${id} left {{${key}}}`);
      }
    }
  });

  it('getHostSupportTier mirrors host-qualification.json tiers', () => {
    const doc = loadHostQualification(MANIFEST);
    const tiers = getHostSupportTier();
    for (const host of doc.hosts) {
      assert.equal(tiers[host.id], host.supportTier, host.id);
    }
    for (const id of PUBLIC_IDE_IDS) {
      assert.ok(tiers[id] === 'operational' || tiers[id] === 'layout-only', id);
    }
  });

  it('unknown ideId uses a non-Claude layout fallback that still substitutes', () => {
    const rendered = renderTemplate(TEMPLATE, {}, {}, 'unknown-host-xyz').trim();
    assert.ok(!rendered.includes('{{'));
    for (const leak of ['Bash', 'Read tool']) {
      assert.ok(!rendered.includes(leak), `unknown host must not freeride Claude: ${leak}`);
    }
  });
});
