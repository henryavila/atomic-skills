import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lintSpec,
  isTautologicalVerifier,
  extractVerifierCommand,
} from '../scripts/lint-source.js';

function taskMd({ verifier, acceptance = 'it - scripts/lint-source.js smoke works.', files = 'scripts/lint-source.js, tests/lint-source-verifier-smoke.test.js' }) {
  return `# t
## F0 — Phase
### T-001 Task
- Files: ${files}
- scopeBoundary: Do not invent schema keys.
- acceptance: ${acceptance}
- verifier: ${verifier}
`;
}

describe('verifier smoke', () => {
  it('detects tautological commands', () => {
    assert.equal(isTautologicalVerifier('{ kind: shell, command: "exit 0" }'), true);
    assert.equal(isTautologicalVerifier('{ kind: shell, command: "true" }'), true);
    assert.equal(isTautologicalVerifier('{ kind: shell, command: "echo ok" }'), true);
    assert.equal(
      isTautologicalVerifier('{ kind: shell, command: "node --test tests/lint-source-verifier-smoke.test.js" }'),
      false,
    );
    assert.equal(extractVerifierCommand('{ kind: shell, command: "exit 0" }'), 'exit 0');
  });

  it('lintSpec HARD-fails tautological verifier', () => {
    const v = lintSpec(taskMd({ verifier: '{ kind: shell, command: "exit 0", expectExitCode: 0 }' }));
    assert.ok(v.some((x) => /tautological|smoke-banned/i.test(x)), v.join('\n'));
  });

  it('lintSpec passes legitimate node --test verifier with path overlap', () => {
    const v = lintSpec(
      taskMd({
        verifier: '{ kind: shell, command: "node --test tests/lint-source-verifier-smoke.test.js", expectExitCode: 0 }',
        acceptance: 'it - tests/lint-source-verifier-smoke.test.js passes.',
        files: 'scripts/lint-source.js, tests/lint-source-verifier-smoke.test.js',
      }),
    );
    assert.deepEqual(v, []);
  });
});
