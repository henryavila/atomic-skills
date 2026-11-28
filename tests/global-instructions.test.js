import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DELEGATE_MARKERS,
  createGlobalInstructionsProvider,
  globalInstructionBody,
  globalInstructionState,
} from '../src/global-instructions.js';
import { writeManifest } from '../src/manifest.js';

function ownedEffect(agent, path) {
  return { type: 'textBlock', id: `global-instructions:${agent}`, args: { path } };
}

describe('createGlobalInstructionsProvider().plan', () => {
  let base;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'as-global-plan-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  const plan = (config) => createGlobalInstructionsProvider().plan(config, { basePath: base });

  it('is a no-op outside user scope', () => {
    assert.deepEqual(plan({ scope: 'project', ides: ['codex'], globalInstructions: true }), []);
  });

  it('plans an enabled agent with a file-based destination', () => {
    const effects = plan({ scope: 'user', ides: ['codex'], globalInstructions: true, language: 'en' });
    assert.equal(effects.length, 1);
    assert.equal(effects[0].type, 'textBlock');
    assert.equal(effects[0].id, 'global-instructions:codex');
    assert.equal(effects[0].args.basePath, base);
    assert.equal(effects[0].args.path, '.codex/AGENTS.md');
    assert.deepEqual(effects[0].args.markers, DELEGATE_MARKERS);
    assert.equal(effects[0].args.content, globalInstructionBody('en'));
  });

  it('uses the pt body when language is pt (and en otherwise)', () => {
    const pt = plan({ scope: 'user', ides: ['codex'], globalInstructions: true, language: 'pt' });
    assert.equal(pt[0].args.content, globalInstructionBody('pt'));
    const other = plan({ scope: 'user', ides: ['codex'], globalInstructions: true, language: 'fr' });
    assert.equal(other[0].args.content, globalInstructionBody('en'));
  });

  it('skips agents without a file-based destination and disabled agents', () => {
    assert.deepEqual(plan({ scope: 'user', ides: ['cursor'], globalInstructions: true }), []);
    assert.deepEqual(plan({ scope: 'user', ides: ['codex'], globalInstructions: false }), []);
  });

  it('honours refusedGlobalPaths', () => {
    const effects = plan({
      scope: 'user',
      ides: ['codex'],
      globalInstructions: true,
      refusedGlobalPaths: ['.codex/AGENTS.md'],
    });
    assert.deepEqual(effects, []);
  });

  it('keeps a present owned agent even when it is not in the selected IDEs', () => {
    const file = join(base, '.codex/AGENTS.md');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${DELEGATE_MARKERS.begin}\nbody\n${DELEGATE_MARKERS.end}\n`);
    writeManifest(base, { effects: [ownedEffect('codex', '.codex/AGENTS.md')] });
    const effects = plan({ scope: 'user', ides: ['claude-code'], language: 'en' });
    assert.deepEqual(effects.map((e) => e.id), ['global-instructions:codex']);
  });

  it('treats a manually deleted owned block as an opt-out only when the flag is unset', () => {
    writeManifest(base, { effects: [ownedEffect('codex', '.codex/AGENTS.md')] });
    const optedOutGlobalPaths = new Set();
    const effects = plan({ scope: 'user', ides: ['codex'], optedOutGlobalPaths });
    assert.deepEqual(effects, []);
    assert.deepEqual([...optedOutGlobalPaths], ['.codex/AGENTS.md']);
  });

  it('reinstalls a missing owned block when globalInstructions is true', () => {
    writeManifest(base, { effects: [ownedEffect('codex', '.codex/AGENTS.md')] });
    const optedOutGlobalPaths = new Set();
    const effects = plan({ scope: 'user', ides: ['codex'], globalInstructions: true, optedOutGlobalPaths });
    assert.deepEqual(effects.map((e) => e.id), ['global-instructions:codex']);
    assert.deepEqual([...optedOutGlobalPaths], []);
  });

  it('drops a present owned block when globalInstructions is false', () => {
    const file = join(base, '.codex/AGENTS.md');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${DELEGATE_MARKERS.begin}\nbody\n${DELEGATE_MARKERS.end}\n`);
    assert.equal(globalInstructionState(base, '.codex/AGENTS.md'), 'present');
    writeManifest(base, { effects: [ownedEffect('codex', '.codex/AGENTS.md')] });
    assert.deepEqual(plan({ scope: 'user', ides: ['codex'], globalInstructions: false }), []);
  });

  it('rethrows a malformed block with its path when the agent is not owned', () => {
    const file = join(base, '.codex/AGENTS.md');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${DELEGATE_MARKERS.begin}\nbody without end\n`);
    assert.throws(
      () => plan({ scope: 'user', ides: ['codex'], globalInstructions: true }),
      (err) => err.message === 'missing END marker'
        && err.globalInstructionPath === '.codex/AGENTS.md',
    );
  });
});
