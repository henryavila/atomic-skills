import test from 'node:test';
import assert from 'node:assert/strict';

import { MATERIALIZATION_PUBLISH_FAULTS } from '../../scripts/materialize-state.js';

test('materialization authority publishes an explicit fault point for every durable boundary', () => {
  assert.deepEqual(MATERIALIZATION_PUBLISH_FAULTS, [
    'before-initiative-rename',
    'after-initiative-rename',
    'before-plan-rename',
    'after-plan-rename',
    'before-complete-cleanup',
  ]);
});
