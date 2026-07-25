import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintSpec, acceptanceVerifierOverlap } from '../scripts/lint-source.js';

describe('acceptance↔verifier overlap', () => {
  it('HARD when zero overlap on a non-suite command', () => {
    assert.equal(
      acceptanceVerifierOverlap(
        'src/a.js',
        'it - pure prose without paths or shared tokens here for sure.',
        '{ kind: shell, command: "node scripts/totally-other-tool.js --xyz" }',
      ),
      'hard',
    );
  });

  it('ok for whole-suite runners without path tokens (npm test / pytest / go test)', () => {
    assert.equal(
      acceptanceVerifierOverlap(
        'src/parser.js',
        'Parser handles nested arrays correctly in edge cases.',
        '{ kind: shell, command: "npm test", expectExitCode: 0 }',
      ),
      'ok',
    );
    assert.equal(
      acceptanceVerifierOverlap(
        'src/parser.js',
        'Parser handles nested arrays correctly in edge cases.',
        '{ kind: shell, command: "pytest", expectExitCode: 0 }',
      ),
      'ok',
    );
    assert.equal(
      acceptanceVerifierOverlap(
        'src/parser.js',
        'Parser handles nested arrays correctly in edge cases.',
        '{ kind: shell, command: "go test ./...", expectExitCode: 0 }',
      ),
      'ok',
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

  it('lintSpec hard-fails zero-overlap task on non-suite command', () => {
    const md = `# t
## F0 — p
### T-001 t
- Files: src/unrelated-only.js
- scopeBoundary: none extra
- acceptance: it - pure narrative without shared command tokens for the verifier path.
- verifier: { kind: shell, command: "node scripts/totally-other-tool.js --flag", expectExitCode: 0 }
`;
    const v = lintSpec(md);
    assert.ok(v.some((x) => /zero path\/token overlap/i.test(x)), v.join('\n'));
  });

  it('lintSpec admits npm test whole-suite verifier without path overlap', () => {
    const md = `# t
## F0 — p
### T-001 t
- Files: src/parser.js
- scopeBoundary: do not touch other packages
- acceptance: it - Parser handles nested arrays correctly.
- verifier: { kind: shell, command: "npm test", expectExitCode: 0 }
`;
    const v = lintSpec(md);
    assert.equal(v.filter((x) => /zero path\/token overlap/i.test(x)).length, 0, v.join('\n'));
  });
});
