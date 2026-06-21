import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Builds the bin/aideck.mjs launcher shim that re-execs the published
 * @henryavila/aideck CLI. Mirrors installRuntimeArtifacts (src/install.js): the
 * shim rewrites argv[1] so the CLI entrypoint guard fires under
 * `node aideck.mjs <args>` (a bare import would load the module without running
 * the CLI).
 */
function buildShim(cliPath) {
  const cliLit = JSON.stringify(cliPath);
  return (
    '// atomic-skills launcher for the published @henryavila/aideck CLI.\n'
    + '// Rewrites argv[1] so the CLI entrypoint guard fires under\n'
    + '// `node aideck.mjs <args>`. Regenerated on every install.\n'
    + `process.argv[1] = ${cliLit}\n`
    + `await import(${cliLit})\n`
  );
}

/**
 * aiDeck runtime layer — a pure planner (Provider) that re-expresses
 * installRuntimeArtifacts (src/install.js:70-132) over the kernel: it emits a
 * single stageRuntimeArtifacts effect staging the bin shim, dashboard client,
 * consumer template, provisioner and package-root marker under
 * <basePath>/.atomic-skills/. Reversal is the journal's (removeRuntimeArtifacts
 * equivalent), not this provider's.
 *
 * Sources come from config (so the test can fixture them):
 *   config.aideckDir   — resolved @henryavila/aideck package dir (or null → bin
 *                        + dashboard skipped, matching the legacy graceful skip)
 *   config.packageRoot — this package's root (assets/, src/, scripts/)
 */
export function createAideckRuntimeProvider() {
  return {
    plan(config, { basePath }) {
      const { aideckDir = null, packageRoot } = config;
      const items = [];

      if (aideckDir) {
        const cli = join(aideckDir, 'dist', 'cli.js');
        if (existsSync(cli)) {
          items.push({ path: '.atomic-skills/bin/aideck.mjs', content: buildShim(cli) });
        }
        const clientSrc = join(aideckDir, 'dist', 'client');
        if (existsSync(join(clientSrc, 'index.html'))) {
          items.push({ path: '.atomic-skills/dashboard', sourceTree: clientSrc });
        }
      }

      const consumerSrc = join(packageRoot, 'assets', 'aideck-consumer');
      if (existsSync(join(consumerSrc, 'manifest.yaml'))) {
        items.push({ path: '.atomic-skills/aideck-consumer', sourceTree: consumerSrc });
      }

      const provSrc = join(packageRoot, 'src', 'provision-consumer.js');
      if (existsSync(provSrc)) {
        items.push({ path: '.atomic-skills/src/provision-consumer.js', source: provSrc });
      }

      if (existsSync(join(packageRoot, 'scripts', 'detect-completion.js'))) {
        items.push({ path: '.atomic-skills/package-root', content: packageRoot + '\n' });
      }

      if (items.length === 0) return [];
      return [{ type: 'stageRuntimeArtifacts', args: { basePath, items } }];
    },
  };
}
