import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mergeExternalBothFindings,
  mergeKey,
  normalizeClaim,
  normalizeSeverity,
  compareSeverity,
  SEVERITY_ORDER,
} from '../src/external-both-merge.js';

describe('normalizeClaim / mergeKey', () => {
  it('normalizes claim whitespace, case, and trailing punctuation', () => {
    assert.equal(normalizeClaim('  Auth  Bypass.  '), 'auth bypass');
    assert.equal(normalizeClaim('Auth bypass!'), 'auth bypass');
  });

  it('builds identity from file:line + normalized claim', () => {
    assert.equal(
      mergeKey('src/a.js', 10, 'Missing null check.'),
      mergeKey('src/a.js', '10-20', 'missing null check'),
    );
    assert.notEqual(
      mergeKey('src/a.js', 10, 'Missing null check'),
      mergeKey('src/a.js', 11, 'Missing null check'),
    );
    assert.notEqual(
      mergeKey('src/a.js', 10, 'Missing null check'),
      mergeKey('src/b.js', 10, 'Missing null check'),
    );
  });
});

describe('severity ranking', () => {
  it('orders blocker > critical > major > minor > nit', () => {
    for (let i = 0; i < SEVERITY_ORDER.length - 1; i++) {
      assert.ok(
        compareSeverity(SEVERITY_ORDER[i], SEVERITY_ORDER[i + 1]) > 0,
        `${SEVERITY_ORDER[i]} should outrank ${SEVERITY_ORDER[i + 1]}`,
      );
    }
  });

  it('defaults blank severity to major', () => {
    assert.equal(normalizeSeverity(''), 'major');
    assert.equal(normalizeSeverity(null), 'major');
  });
});

describe('mergeExternalBothFindings', () => {
  it('unions distinct findings with single-provider provenance', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          { file: 'a.js', line: 1, claim: 'Codex only', severity: 'major' },
        ],
      },
      grok: {
        findings: [
          { file: 'b.js', line: 2, claim: 'Grok only', severity: 'minor' },
        ],
      },
    });
    assert.equal(result.findings.length, 2);
    assert.equal(result.partial, false);
    assert.deepEqual(result.errors, {});
    const byClaim = Object.fromEntries(result.findings.map((f) => [f.claim, f]));
    assert.deepEqual(byClaim['Codex only'].providers, ['codex']);
    assert.deepEqual(byClaim['Grok only'].providers, ['grok']);
  });

  it('dedupes identical identity into dual provenance', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          {
            file: 'src/x.js',
            line: 42,
            claim: 'Missing guard on token.',
            severity: 'major',
            evidence: 'codex-evidence',
          },
        ],
      },
      grok: {
        findings: [
          {
            file: 'src/x.js',
            line: '42-50',
            claim: 'missing guard on token',
            severity: 'major',
            evidence: 'grok-evidence',
          },
        ],
      },
    });
    assert.equal(result.findings.length, 1);
    const f = result.findings[0];
    assert.deepEqual(f.providers, ['codex', 'grok']);
    assert.equal(f.primaryProvider, 'codex');
    assert.equal(f.evidence, 'codex-evidence');
    assert.equal(f.otherSeverity, undefined);
  });

  it('keeps higher severity on conflict and records dual provenance', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          {
            file: 'auth.js',
            line: 7,
            claim: 'token not rotated',
            severity: 'minor',
            recommendation: 'codex rec',
          },
        ],
      },
      grok: {
        findings: [
          {
            file: 'auth.js',
            line: 7,
            claim: 'Token not rotated.',
            severity: 'critical',
            recommendation: 'grok rec',
          },
        ],
      },
    });
    assert.equal(result.findings.length, 1);
    const f = result.findings[0];
    assert.equal(f.severity, 'critical');
    assert.equal(f.primaryProvider, 'grok');
    assert.equal(f.recommendation, 'grok rec');
    assert.equal(f.otherSeverity, 'minor');
    assert.deepEqual(f.providers, ['codex', 'grok']);
  });

  it('keeps Codex body when Codex severity is higher', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          {
            file: 'db.js',
            line: 3,
            claim: 'SQL injection',
            severity: 'blocker',
            recommendation: 'parameterize',
          },
        ],
      },
      grok: {
        findings: [
          {
            file: 'db.js',
            line: 3,
            claim: 'SQL injection',
            severity: 'major',
            recommendation: 'escape',
          },
        ],
      },
    });
    const f = result.findings[0];
    assert.equal(f.severity, 'blocker');
    assert.equal(f.primaryProvider, 'codex');
    assert.equal(f.recommendation, 'parameterize');
    assert.equal(f.otherSeverity, 'major');
    assert.deepEqual(f.providers, ['codex', 'grok']);
  });

  it('partial Codex failure keeps Grok findings and surfaces error', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [],
        error: 'preflight: codex binary missing',
      },
      grok: {
        findings: [
          { file: 'z.js', line: 1, claim: 'Grok saw this', severity: 'major' },
        ],
      },
    });
    assert.equal(result.partial, true);
    assert.equal(result.errors.codex, 'preflight: codex binary missing');
    assert.equal(result.errors.grok, undefined);
    assert.deepEqual(result.providersFailed, ['codex']);
    assert.deepEqual(result.providersSucceeded, ['grok']);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].claim, 'Grok saw this');
  });

  it('partial Grok failure keeps Codex findings and surfaces error', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          { file: 'z.js', line: 2, claim: 'Codex saw this', severity: 'critical' },
        ],
      },
      grok: {
        findings: [],
        error: 'timeout after 600s',
      },
    });
    assert.equal(result.partial, true);
    assert.equal(result.errors.grok, 'timeout after 600s');
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].primaryProvider, 'codex');
  });

  it('both providers failing yields empty findings and both errors', () => {
    const result = mergeExternalBothFindings({
      codex: { error: 'codex down' },
      grok: { error: 'grok down' },
    });
    assert.equal(result.findings.length, 0);
    assert.equal(result.partial, false); // no successful half
    assert.deepEqual(result.providersFailed, ['codex', 'grok']);
    assert.deepEqual(result.providersSucceeded, []);
    assert.equal(result.errors.codex, 'codex down');
    assert.equal(result.errors.grok, 'grok down');
  });

  it('sorts merged findings by severity then mergeKey', () => {
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          { file: 'b.js', line: 1, claim: 'low', severity: 'nit' },
          { file: 'a.js', line: 1, claim: 'high', severity: 'blocker' },
        ],
      },
      grok: {
        findings: [
          { file: 'c.js', line: 1, claim: 'mid', severity: 'major' },
        ],
      },
    });
    assert.deepEqual(
      result.findings.map((f) => f.claim),
      ['high', 'mid', 'low'],
    );
  });

  it('ignores empty/invalid finding rows without throwing', () => {
    const result = mergeExternalBothFindings({
      codex: { findings: [null, {}, { file: 'x.js', line: 1, claim: 'ok', severity: 'minor' }] },
      grok: { findings: undefined },
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].claim, 'ok');
  });
});
