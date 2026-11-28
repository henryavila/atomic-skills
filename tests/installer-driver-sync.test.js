import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as engine from '@henryavila/minimalist-installer';

/**
 * The local driver is the upstream driver plus the reviewed compatibility
 * hunks below. It no longer mirrors upstream line for line: each install step
 * lives in a named helper so no function crosses the size ceiling. This test
 * pins the engine export surface and every deviation, which are the parts that
 * must be re-reviewed when the pin moves.
 */
it('R1-R05 installed driver keeps the reviewed compatibility hunks', () => {
  const pin = 'e37ae7f3d70c96ab3d920522ba739da5fb324a03';
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies['@henryavila/minimalist-installer'], `github:henryavila/minimalist-installer#${pin}`,
    'A pin bump requires re-syncing and reviewing this adapter');
  assert.equal(engine.prepareTextBlockPlan, undefined, 'Use the public planner if upstream exports it');

  const local = readFileSync(new URL('../src/installer-driver.js', import.meta.url), 'utf8');

  const reviewed = [
    // The private planner is the only source of byte/marker validation at this pin.
    "export const { prepareTextBlockPlan } = await import(new URL('./kernel/effects/text-block.js',",
    // install() accepts a consumer preparePlan hook before the engine planner.
    "const preparePlan = registry.get('textBlock').preparePlan ?? prepareTextBlockPlan;",
    // Refused global-instruction states stay parked in the journal.
    '(prepared.parked ?? []).map((beforeState) => ({',
    // textBlock revert needs the install language for its refusal message.
    "revert({ basePath: projectDir, language: config.language }, state)",
    // Uninstall replay needs the manifest language for the same message.
    'replayReverse(manifest, { basePath: projectDir, manifestDir, language: manifest.language }, registry)',
  ];
  for (const fragment of reviewed) {
    assert.equal(local.includes(fragment), true, `missing reviewed hunk: ${fragment}`);
  }

  // The transaction/locking protocol is copied from upstream and must not drift.
  const protocol = [
    'assertNoIncompleteTransaction(projectDir, manifestDir);',
    'const locks = acquireInstallLocks({ projectDir, extra, lockRoot });',
    'locks.release();',
    "journalMode: 'per-effect',",
    "state: 'incomplete',",
    "state: 'complete',",
    'appliedCount: readEffects(manifest).length,',
  ];
  for (const fragment of protocol) {
    assert.equal(local.includes(fragment), true, `transaction protocol drifted: ${fragment}`);
  }
});
