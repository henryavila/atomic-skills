import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as engine from '@henryavila/minimalist-installer';

it('R1-R05 installed driver matches the adapter except reviewed compatibility hunks', () => {
  const pin = 'e37ae7f3d70c96ab3d920522ba739da5fb324a03';
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies['@henryavila/minimalist-installer'], `github:henryavila/minimalist-installer#${pin}`,
    'A pin bump requires re-syncing and reviewing this adapter');
  assert.equal(engine.prepareTextBlockPlan, undefined, 'Use the public planner if upstream exports it');
  const upstream = readFileSync(new URL('./driver.js', import.meta.resolve('@henryavila/minimalist-installer')), 'utf8');
  const local = readFileSync(new URL('../src/installer-driver.js', import.meta.url), 'utf8');
  const anchor = '// The Driver is identical';
  const expectedUpstreamImports = `import { prepareTextBlockPlan } from './kernel/effects/text-block.js';
import {
  readManifest,
  writeManifest,
  removeManifest,
  MANIFEST_DIR,
} from './manifest.js';
import { readEffects, recordEffect, replayReverse, stableEffectId, JOURNAL_VERSION } from './kernel/journal.js';
import { acquireInstallLocks } from './lock.js';
import { assertNoIncompleteTransaction } from './recovery.js';

`;
  assert.equal(upstream.slice(0, upstream.indexOf(anchor)), expectedUpstreamImports);
  const expectedImports = `// Mirrors minimalist-installer/src/driver.js (MIT) at upstream commit
// e37ae7f3d70c96ab3d920522ba739da5fb324a03.
// tests/installer-driver-sync.test.js guards every deviation from the installed copy.
// The upstream driver hardcodes textBlock preflight before registry.apply.
// Keep its transaction/locking protocol, adding only the registry preparePlan
// hook, retention of refused instruction states, and revert language below. Drop this adapter
// when upstream exposes those hooks.
import {
  readManifest, writeManifest, removeManifest, MANIFEST_DIR,
  readEffects, recordEffect, replayReverse, stableEffectId, JOURNAL_VERSION,
  acquireInstallLocks, assertNoIncompleteTransaction,
} from '@henryavila/minimalist-installer';
// No public prepareTextBlockPlan export exists at this pin (only the effect
// factory is exported). Reuse the private planner's byte/marker validation.
export const { prepareTextBlockPlan } = await import(new URL('./kernel/effects/text-block.js',
  import.meta.resolve('@henryavila/minimalist-installer')).href);

`;
  assert.equal(local.slice(0, local.indexOf(anchor)), expectedImports);
  let expected = upstream.slice(upstream.indexOf(anchor));
  const hunk = (before, after) => {
    assert.equal(expected.split(before).length - 1, 1, 'Upstream hunk changed; re-sync the adapter');
    expected = expected.replace(before, after);
  };
  hunk('export const createDriver = ({',
    `/**
 * @typedef {object} DriverRegistry
 * @property {(type: string) => ({ apply: Function, revert: Function, preparePlan?: Function } | undefined)} get
 */

/**
 * @typedef {object} DriverOptions
 * @property {DriverRegistry} [registry]
 * @property {Array<{ plan: Function }>} [providers]
 * @property {string} [manifestDir]
 * @property {string} [lockRoot]
 * @property {Function | object[]} [resourceIdentities]
 */

/**
 * @param {DriverOptions} [options]
 */
export const createDriver = ({`);
  hunk('const prepared = prepareTextBlockPlan(',
    "const preparePlan = registry.get('textBlock').preparePlan ?? prepareTextBlockPlan;\n        const prepared = preparePlan(");
  hunk('manifest = { ...manifest, effects: [] };',
    `manifest = { ...manifest, effects: (prepared.parked ?? []).map((beforeState) => ({
          type: 'textBlock', id: priorTextIds.get(beforeState), beforeState,
        })) };`);
  hunk('revert({ basePath: projectDir }, state)',
    'revert({ basePath: projectDir, language: config.language }, state)');
  hunk('replayReverse(manifest, { basePath: projectDir, manifestDir }, registry)',
    'replayReverse(manifest, { basePath: projectDir, manifestDir, language: manifest.language }, registry)');
  assert.equal(local.slice(local.indexOf(anchor)), expected);
});
