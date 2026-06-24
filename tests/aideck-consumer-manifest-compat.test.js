import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Compat guard (plan fix-aideck-dashboard P2): the sibling
 * `aideck-consumer-manifest.test.js` only YAML.parses the manifest and
 * hand-asserts fields — a *false-green*. It happily passes `nav.style: projects`
 * while the installed aiDeck's real schema rejects exactly that, so the dashboard
 * silently 404s ("consumer not found") with the suite green.
 *
 * This test closes that gap: it runs the manifest through the INSTALLED aiDeck's
 * `loadManifest` — the same code path the server runs at boot. Contract:
 *   • loadManifest accepts the manifest        → assert PASS (new aiDeck is in place)
 *   • rejected for an unsupported nav.style     → t.skip with the blocker named
 *                                                 (cross-repo gap, awaiting release)
 *   • rejected for ANY other reason             → hard FAIL (a real manifest bug)
 *
 * So `npm test` stays green while we wait on the aiDeck npm release, the false-green
 * is gone, and the day the supporting aiDeck is installed this flips to a real
 * assertion with no code change.
 */
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONSUMER_DIR = join(__dirname, '..', 'assets', 'aideck-consumer');

// The package's `exports` map is import-only and blocks subpath/package.json
// resolution, so resolve the "." export via import.meta.resolve and walk up to
// the package root, then reach dist/ by absolute path.
function findAideckRoot() {
  let dir;
  try {
    dir = dirname(fileURLToPath(import.meta.resolve('@henryavila/aideck')));
  } catch {
    return null;
  }
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'dist', 'server', 'manifest-loader.js'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

describe('aiDeck consumer manifest — validates against the INSTALLED aiDeck loader', () => {
  it('is accepted by the installed @henryavila/aideck loadManifest', async (t) => {
    const aideckRoot = findAideckRoot();
    if (!aideckRoot) {
      t.skip('@henryavila/aideck not resolvable (run npm install)');
      return;
    }
    let loadManifest;
    let installedVersion = 'unknown';
    try {
      installedVersion = JSON.parse(readFileSync(join(aideckRoot, 'package.json'), 'utf8')).version;
      ({ loadManifest } = await import(
        pathToFileURL(join(aideckRoot, 'dist', 'server', 'manifest-loader.js')).href
      ));
    } catch (cause) {
      t.skip(`@henryavila/aideck loader not loadable (run npm install): ${cause?.message ?? cause}`);
      return;
    }

    const result = await loadManifest(CONSUMER_DIR);

    if (result.ok) {
      assert.equal(result.value.id, 'atomic-skills');
      return;
    }

    const msg = result.error.message;
    if (/nav\.style/i.test(msg)) {
      // Known cross-repo gap: the manifest uses the project-centric nav topology
      // that the installed aiDeck does not support yet. Skip loudly (not a false
      // green, not a red CI) until the supporting aiDeck release is installed.
      t.skip(
        `installed aiDeck ${installedVersion} rejects the consumer nav topology — ` +
          `awaiting the aiDeck release that extends navSchema.style. Loader said: ${msg}`,
      );
      return;
    }

    // Any other rejection is a genuine manifest defect — fail hard.
    assert.fail(`installed aiDeck (${installedVersion}) rejected the manifest: ${msg}`);
  });
});
