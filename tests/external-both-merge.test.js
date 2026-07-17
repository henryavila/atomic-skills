import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mergeExternalBothFindings,
  mergeKey,
  normalizeClaim,
  normalizeSeverity,
  compareSeverity,
  resolveProviderSide,
  SEVERITY_ORDER,
} from '../src/external-both-merge.js';
import { mergeFromArgs, loadProviderArg } from '../scripts/merge-external-both.js';

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

describe('resolveProviderSide', () => {
  it('treats absent provider key as skipped', () => {
    const side = resolveProviderSide({}, 'codex');
    assert.equal(side.status, 'skipped');
    assert.deepEqual(side.findings, []);
    assert.equal(side.error, null);
  });

  it('treats null provider value as skipped', () => {
    const side = resolveProviderSide({ codex: null }, 'codex');
    assert.equal(side.status, 'skipped');
  });

  it('infers failed from error text when status omitted', () => {
    const side = resolveProviderSide(
      { codex: { findings: [], error: 'timeout' } },
      'codex',
    );
    assert.equal(side.status, 'failed');
    assert.equal(side.error, 'timeout');
  });

  it('infers succeeded when key present without error', () => {
    const side = resolveProviderSide(
      { codex: { findings: [{ file: 'a.js', line: 1, claim: 'x' }] } },
      'codex',
    );
    assert.equal(side.status, 'succeeded');
    assert.equal(side.findings.length, 1);
  });

  it('honours explicit status over inference', () => {
    assert.equal(
      resolveProviderSide({ codex: { status: 'skipped', findings: [{ claim: 'x' }] } }, 'codex')
        .status,
      'skipped',
    );
    assert.equal(
      resolveProviderSide({ grok: { status: 'failed', reason: 'preflight' } }, 'grok').error,
      'preflight',
    );
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
    assert.deepEqual(result.providerStatus, { codex: 'succeeded', grok: 'succeeded', claude: 'skipped' });
    assert.deepEqual(result.providersSucceeded, ['codex', 'grok']);
    assert.deepEqual(result.providersFailed, []);
    assert.deepEqual(result.providersSkipped, ['claude']);
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
    assert.deepEqual(result.providerStatus, { codex: 'failed', grok: 'succeeded', claude: 'skipped' });
    assert.deepEqual(result.providersFailed, ['codex']);
    assert.deepEqual(result.providersSucceeded, ['grok']);
    assert.deepEqual(result.providersSkipped, ['claude']);
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
    assert.deepEqual(result.providerStatus, { codex: 'succeeded', grok: 'failed', claude: 'skipped' });
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
    assert.deepEqual(result.providersSkipped, ['claude']);
    assert.equal(result.errors.codex, 'codex down');
    assert.equal(result.errors.grok, 'grok down');
    assert.deepEqual(result.providerStatus, { codex: 'failed', grok: 'failed', claude: 'skipped' });
  });

  it('only codex run (grok skipped) keeps codex findings and does not mark partial', () => {
    const result = mergeExternalBothFindings({
      codex: {
        status: 'succeeded',
        findings: [
          { file: 'a.js', line: 1, claim: 'Codex only leg', severity: 'major' },
        ],
      },
      grok: { status: 'skipped', reason: 'same-family filtered on grok host' },
    });
    assert.equal(result.partial, false);
    assert.deepEqual(result.providerStatus, { codex: 'succeeded', grok: 'skipped', claude: 'skipped' });
    assert.deepEqual(result.providersSucceeded, ['codex']);
    assert.deepEqual(result.providersFailed, []);
    assert.deepEqual(result.providersSkipped, ['grok', 'claude']);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].claim, 'Codex only leg');
    assert.deepEqual(result.errors, {});
  });

  it('absent provider key is skipped, not succeeded', () => {
    // Regression: previously {}-default treated missing grok as succeeded.
    const result = mergeExternalBothFindings({
      codex: {
        findings: [
          { file: 'only.js', line: 1, claim: 'codex ran alone', severity: 'minor' },
        ],
      },
      // grok intentionally omitted
    });
    assert.deepEqual(result.providerStatus, { codex: 'succeeded', grok: 'skipped', claude: 'skipped' });
    assert.deepEqual(result.providersSucceeded, ['codex']);
    assert.deepEqual(result.providersSkipped, ['grok', 'claude']);
    assert.deepEqual(result.providersFailed, []);
    assert.equal(result.partial, false);
    assert.equal(result.findings.length, 1);
  });

  it('both skipped yields empty findings and no partial', () => {
    const result = mergeExternalBothFindings({
      codex: { status: 'skipped' },
      grok: { status: 'skipped' },
    });
    assert.equal(result.findings.length, 0);
    assert.equal(result.partial, false);
    assert.deepEqual(result.providersSucceeded, []);
    assert.deepEqual(result.providersFailed, []);
    assert.deepEqual(result.providersSkipped, ['codex', 'grok', 'claude']);
    assert.deepEqual(result.providerStatus, { codex: 'skipped', grok: 'skipped', claude: 'skipped' });
  });

  it('empty input (both absent) is both skipped, not both succeeded', () => {
    const result = mergeExternalBothFindings({});
    assert.deepEqual(result.providerStatus, { codex: 'skipped', grok: 'skipped', claude: 'skipped' });
    assert.deepEqual(result.providersSucceeded, []);
    assert.deepEqual(result.providersSkipped, ['codex', 'grok', 'claude']);
    assert.equal(result.partial, false);
    assert.equal(result.findings.length, 0);
  });

  it('skipped provider findings are ignored even if present', () => {
    const result = mergeExternalBothFindings({
      codex: {
        status: 'skipped',
        findings: [
          { file: 'x.js', line: 1, claim: 'should not appear', severity: 'blocker' },
        ],
      },
      grok: {
        status: 'succeeded',
        findings: [
          { file: 'y.js', line: 2, claim: 'grok only', severity: 'major' },
        ],
      },
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].claim, 'grok only');
    assert.deepEqual(result.providersSkipped, ['codex', 'claude']);
  });


  it('triple provenance when all three providers report same identity', () => {
    const f = { file: 'a.js', line: 1, claim: 'Same claim', severity: 'major' };
    const result = mergeExternalBothFindings({
      codex: { status: 'succeeded', findings: [f] },
      grok: { status: 'succeeded', findings: [f] },
      claude: { status: 'succeeded', findings: [{ ...f, severity: 'critical' }] },
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'critical');
    assert.deepEqual(result.findings[0].providers, ['codex', 'grok', 'claude']);
    assert.equal(result.findings[0].primaryProvider, 'claude');
    assert.deepEqual(result.providerStatus, {
      codex: 'succeeded',
      grok: 'succeeded',
      claude: 'succeeded',
    });
    assert.deepEqual(result.providersSkipped, []);
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
    // grok key present with empty findings → succeeded, not skipped
    assert.equal(result.providerStatus.grok, 'succeeded');
  });
});

describe('merge-external-both CLI helpers', () => {
  it('loadProviderArg treats skip tokens as null (omitted)', () => {
    assert.equal(loadProviderArg('-', 'codex'), null);
    assert.equal(loadProviderArg('skip', 'grok'), null);
    assert.equal(loadProviderArg('none', 'codex'), null);
  });

  it('mergeFromArgs merges two finding JSON files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ext-both-'));
    try {
      const codexPath = join(dir, 'codex.json');
      const grokPath = join(dir, 'grok.json');
      writeFileSync(
        codexPath,
        JSON.stringify({
          findings: [{ file: 'a.js', line: 1, claim: 'from codex', severity: 'major' }],
        }),
      );
      writeFileSync(
        grokPath,
        JSON.stringify([
          { file: 'b.js', line: 2, claim: 'from grok', severity: 'minor' },
        ]),
      );
      const result = mergeFromArgs([codexPath, grokPath]);
      assert.equal(result.findings.length, 2);
      assert.deepEqual(result.providersSucceeded, ['codex', 'grok']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('mergeFromArgs with skip marks provider skipped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ext-both-skip-'));
    try {
      const codexPath = join(dir, 'codex.json');
      writeFileSync(
        codexPath,
        JSON.stringify({
          findings: [{ file: 'a.js', line: 1, claim: 'only codex', severity: 'major' }],
        }),
      );
      const result = mergeFromArgs([codexPath, 'skip']);
      assert.deepEqual(result.providerStatus, { codex: 'succeeded', grok: 'skipped', claude: 'skipped' });
      assert.equal(result.findings.length, 1);
      assert.equal(result.partial, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
