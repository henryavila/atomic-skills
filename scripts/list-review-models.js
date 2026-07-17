#!/usr/bin/env node
/**
 * list-review-models.js — discover + resolve external review models.
 *
 * Usage:
 *   node scripts/list-review-models.js --provider=codex
 *   node scripts/list-review-models.js --provider=grok --human
 *   node scripts/list-review-models.js --provider=codex --resolve --model=gpt-5.6-sol
 *   node scripts/list-review-models.js --provider=codex --resolve --ask-model --interactive=0
 *   node scripts/list-review-models.js --provider=grok --resolve --interactive --user-choice=recommended
 *   node scripts/list-review-models.js --provider=codex --catalog=path/to.json
 *
 * Catalog discovery (live CLI; fail-open to empty catalog):
 *   codex → `codex debug models --bundled` (JSON)
 *   grok  → `grok models` (text)
 *
 * Package-root invocation (installed):
 *   node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/list-review-models.js" \
 *     --provider=codex --resolve --ask-model
 *
 * Exit 0 on success; exit 1 on usage errors.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  catalogDiscoveryResult,
  parseCodexModelsCatalog,
  parseGrokModelsList,
  parseModelArgs,
  rankModelsForReview,
  recommendedReviewModel,
  resolveReviewModel,
} from '../src/resolve-review-model.js';

/**
 * @param {string[]} argv
 */
function parseCli(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {
    provider: '',
    resolve: false,
    json: true,
    interactive: false,
    'user-choice': '',
    catalog: '',
    model: '',
    'ask-model': false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      flags.help = true;
      continue;
    }
    if (a === '--resolve') {
      flags.resolve = true;
      continue;
    }
    if (a === '--json') {
      flags.json = true;
      continue;
    }
    if (a === '--human') {
      flags.json = false;
      continue;
    }
    if (a === '--interactive') {
      flags.interactive = true;
      continue;
    }
    if (a === '--ask-model') {
      flags['ask-model'] = true;
      continue;
    }
    if (a.startsWith('--interactive=')) {
      const v = a.slice('--interactive='.length).toLowerCase();
      flags.interactive = v === '1' || v === 'true' || v === 'yes';
      continue;
    }
    const eq = a.match(/^--([^=]+)=(.*)$/);
    if (eq) {
      flags[eq[1]] = eq[2];
      continue;
    }
    if (a.startsWith('--') && argv[i + 1] && !String(argv[i + 1]).startsWith('-')) {
      flags[a.slice(2)] = argv[++i];
      continue;
    }
  }

  const modelArgs = parseModelArgs(argv);
  return { flags, modelArgs };
}

/**
 * @param {'codex'|'grok'} provider
 * @param {string} [catalogPath]
 * @returns {{ models: import('../src/resolve-review-model.js').ReviewModel[], error: string | null }}
 */
function fetchModels(provider, catalogPath) {
  if (catalogPath) {
    const text = readFileSync(catalogPath, 'utf8');
    const models =
      provider === 'codex' ? parseCodexModelsCatalog(text) : parseGrokModelsList(text);
    // File catalogs: no process status; still report parse failure on nonblank empty parse.
    return catalogDiscoveryResult({
      provider,
      models,
      text,
      status: 0,
      spawnError: null,
    });
  }
  if (provider === 'codex') {
    const r = spawnSync('codex', ['debug', 'models', '--bundled'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 30_000,
    });
    const text = `${r.stdout || ''}\n${r.stderr || ''}`;
    const models = parseCodexModelsCatalog(r.stdout || '');
    return catalogDiscoveryResult({
      provider: 'codex',
      models,
      text,
      status: r.status,
      spawnError: r.error || (r.status !== 0 ? r.stderr || `codex debug models exited ${r.status}` : null),
    });
  }
  const r = spawnSync('grok', ['models'], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000,
  });
  const text = `${r.stdout || ''}\n${r.stderr || ''}`;
  const models = parseGrokModelsList(text);
  return catalogDiscoveryResult({
    provider: 'grok',
    models,
    text,
    status: r.status,
    spawnError: r.error || (r.status != null && r.status !== 0 ? r.stderr || `grok models exited ${r.status}` : null),
  });
}

function main() {
  const { flags, modelArgs } = parseCli(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(
      'Usage: list-review-models.js --provider=codex|grok [--resolve] [--model=ID] [--ask-model] [--interactive] [--user-choice=ID] [--catalog=path] [--human]\n',
    );
    process.exit(0);
  }
  const provider = String(flags.provider || '').toLowerCase();
  if (provider !== 'codex' && provider !== 'grok') {
    process.stderr.write('ERROR: --provider=codex|grok is required\n');
    process.exit(1);
  }

  const catalogPath = flags.catalog ? String(flags.catalog) : undefined;
  const { models, error } = fetchModels(/** @type {'codex'|'grok'} */ (provider), catalogPath);
  const ranked = rankModelsForReview(models, { provider: /** @type {'codex'|'grok'} */ (provider) });
  const recommended = recommendedReviewModel(models, {
    provider: /** @type {'codex'|'grok'} */ (provider),
  });

  if (!flags.resolve) {
    const payload = {
      provider,
      recommended: recommended
        ? {
            slug: recommended.slug,
            displayName: recommended.displayName,
            description: recommended.description,
          }
        : null,
      models: ranked.map((m) => ({
        slug: m.slug,
        displayName: m.displayName,
        description: m.description,
        priority: m.priority,
        isDefault: m.isDefault,
        visibility: m.visibility,
      })),
      catalogError: error,
    };
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`provider: ${provider}\n`);
      process.stdout.write(`recommended: ${recommended?.slug ?? '(none)'}\n`);
      if (error) process.stdout.write(`catalog-error: ${error}\n`);
      for (const m of ranked) {
        const mark = recommended && m.slug === recommended.slug ? ' *' : '';
        process.stdout.write(
          `  - ${m.slug}${mark}${m.description ? ` — ${m.description}` : ''}\n`,
        );
      }
    }
    process.exit(0);
  }

  const explicitFromFlag = flags.model ? String(flags.model) : null;
  const resolved = resolveReviewModel({
    provider: /** @type {'codex'|'grok'} */ (provider),
    models,
    explicitModel: modelArgs.model || explicitFromFlag,
    modelCodex: modelArgs.modelCodex,
    modelGrok: modelArgs.modelGrok,
    askModel: modelArgs.askModel || flags['ask-model'] === true || flags['ask-model'] === '1',
    interactive: Boolean(flags.interactive),
    userChoice: flags['user-choice'] ? String(flags['user-choice']) : null,
  });

  const out = {
    provider,
    catalogError: error,
    recommended: recommended
      ? { slug: recommended.slug, displayName: recommended.displayName }
      : null,
    ...resolved,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(0);
}

main();
