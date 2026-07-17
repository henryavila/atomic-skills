/**
 * P1-E / F-008 + P1-F / F-009 source guards.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_SRC = readFileSync(join(REPO, 'src/install.js'), 'utf8');

/** Strip comments for call-site guards. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('SIGINT honesty (P1-E / F-008)', () => {
  it('does not re-signal SIGINT to self', () => {
    const code = codeOnly(INSTALL_SRC);
    assert.equal(
      /process\.kill\s*\(\s*process\.pid\s*,\s*['"]SIGINT['"]\s*\)/.test(code),
      false,
      'install.js must not process.kill(process.pid, SIGINT) (reentrancy)',
    );
  });

  it('does not install a fake writtenFiles SIGINT cleanup handler', () => {
    const code = codeOnly(INSTALL_SRC);
    // No process.on('SIGINT', ...) in install flow
    assert.equal(
      /process\.on\s*\(\s*['"]SIGINT['"]/.test(code),
      false,
      'install.js must not register a SIGINT handler with fake cleanup',
    );
    assert.equal(
      /No files kept/.test(code),
      false,
      'must not claim "No files kept" (false mid-install message)',
    );
  });
});

describe('publishRuntimeAndRegister parity (P1-F / F-009)', () => {
  it('interactive success path does not call bare installRuntimeArtifacts + registerInstall', () => {
    const code = codeOnly(INSTALL_SRC);

    // Find the interactive branch after non-interactive early return.
    // Heuristic: the --yes path uses publishRuntimeAndRegister; interactive must too
    // and must not have sequential installRuntimeArtifacts(); registerInstall(basePath);
    const sequentialBare = /installRuntimeArtifacts\s*\(\s*\)\s*;\s*registerInstall\s*\(\s*basePath\s*\)/;
    assert.equal(
      sequentialBare.test(code),
      false,
      'interactive path must not call installRuntimeArtifacts() then registerInstall(basePath)',
    );

    // publishRuntimeAndRegister must appear (shared path)
    assert.ok(
      /publishRuntimeAndRegister\s*\(\s*basePath\s*\)/.test(code),
      'install success must call publishRuntimeAndRegister(basePath)',
    );

    // Count bare registerInstall(basePath) outside function definitions —
    // publishRuntimeAndRegister body contains installRuntimeArtifacts() + write registry,
    // not registerInstall(basePath).
    // registerInstall export definition is ok; call sites on success path should be gone.
    const callSites = [...code.matchAll(/\bregisterInstall\s*\(\s*basePath\s*\)/g)];
    // Only the export function declaration uses that signature in a definition context.
    // Allow the function declaration itself: `export function registerInstall(basePath)`
    // which appears as registerInstall(basePath) after comment strip.
    // Filter to statement calls: preceded by not "function ".
    const statementCalls = callSites.filter((m) => {
      const idx = m.index ?? 0;
      const before = code.slice(Math.max(0, idx - 20), idx);
      return !/function\s*$/.test(before);
    });
    assert.equal(
      statementCalls.length,
      0,
      `no bare registerInstall(basePath) call sites on install paths (found ${statementCalls.length})`,
    );
  });
});
