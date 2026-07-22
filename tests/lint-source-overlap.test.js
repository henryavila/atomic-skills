import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintSpec, acceptanceVerifierOverlap } from '../scripts/lint-source.js';

describe('acceptance↔verifier overlap', () => {
  it('HARD when zero overlap', () => {
    assert.equal(
      acceptanceVerifierOverlap(
        'src/a.js',
        'it - pure prose without paths or shared tokens here for sure.',
        '{ kind: shell, command: "npm test -- matcher-xyz-only" }',
      ),
      'hard',
    );
  });

  it('ok when acceptance mentions path used in verifier', () => {
    assert.equal(
      acceptanceVerifierOverlap(
        'scripts/lint-source.js',
        'it - scripts/lint-source.js overlap works.',
        '{ kind: shell, command: "node scripts/lint-source.js foo.md --spec" }',
      ),
      'ok',
    );
  });

  it('lintSpec hard-fails zero-overlap task', () => {
    const md = `# t
## F0 — p
### T-001 t
- Files: src/unrelated-only.js
- scopeBoundary: none extra
- acceptance: it - pure narrative without shared command tokens for the verifier path.
- verifier: { kind: shell, command: "npm test -- totally-other-suite", expectExitCode: 0 }
`;
    const v = lintSpec(md);
    assert.ok(v.some((x) => /zero path\/token overlap/i.test(x)), v.join('\n'));
  });
});
