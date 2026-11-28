#!/usr/bin/env node
/**
 * list-review-models.js — discover + resolve external review models.
 *
 * Usage:
 *   node scripts/list-review-models.js --provider=codex
 *   node scripts/list-review-models.js --provider=grok --human
 *   node scripts/list-review-models.js --provider=claude
 *   node scripts/list-review-models.js --provider=codex --resolve --model=gpt-5.6-sol
 *   node scripts/list-review-models.js --provider=codex --resolve --ask-model --interactive=0
 *   node scripts/list-review-models.js --provider=grok --resolve --interactive --user-choice=recommended
 *   node scripts/list-review-models.js --provider=codex --catalog=path/to.json
 *
 * Catalog discovery (live CLI; fail-open to empty catalog):
 *   codex  → `codex debug models --bundled` (JSON)
 *   grok   → `grok models` (text)
 *   claude → stable aliases only (no live CLI catalog; optional `claude --help` filter)
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
  parseAgyModelsList,
  parseClaudeModelsAliases,
  parseCodexModelsCatalog,
  parseGrokModelsList,
  parseModelArgs,
  rankModelsForReview,
  recommendedReviewModel,
  resolveReviewModel,
} from '../src/resolve-review-model.js';

const USAGE =
  'Usage: list-review-models.js --provider=codex|grok|claude|agy [--resolve] [--model=ID] [--ask-model] [--interactive] [--user-choice=ID] [--catalog=path] [--human]\n';
const PROVIDER_ERROR = 'ERROR: --provider=codex|grok|claude|agy is required\n';
const INTERACTIVE_TRUTHY = ['1', 'true', 'yes'];

/** @typedef {'codex' | 'grok' | 'claude' | 'agy'} Provider */

/** @type {Set<string>} */
const PROVIDERS = new Set(['codex', 'grok', 'claude', 'agy']);

/**
 * One parser per provider: the catalog text is the only input, so the schema
 * of each provider stays with the provider's command instead of a branch.
 *
 * @type {Record<Provider, (text: string) => import('../src/resolve-review-model.js').ReviewModel[]>}
 */
const CATALOG_PARSERS = {
  codex: parseCodexModelsCatalog,
  grok: parseGrokModelsList,
  claude: parseClaudeModelsAliases,
  agy: parseAgyModelsList,
};

/**
 * @typedef {object} DiscoverySpec
 * @property {string} command
 * @property {string[]} args
 * @property {number} maxBuffer
 * @property {number} timeout
 * @property {'stdout' | 'combined'} parseFrom which stream the catalog parser reads
 * @property {boolean} statusFromExit report the CLI exit code as the catalog status
 * @property {'never' | 'known-nonzero' | 'any-nonzero'} failure when a non-zero exit is an error
 * @property {boolean} [blankTextWhenModels] omit the text when models were parsed
 * @property {string} label command name used in the exit message
 */

/** @type {Record<Provider, DiscoverySpec>} */
const LIVE_DISCOVERY = {
  codex: {
    command: 'codex',
    args: ['debug', 'models', '--bundled'],
    maxBuffer: 20 * 1024 * 1024,
    timeout: 30_000,
    parseFrom: 'stdout',
    statusFromExit: true,
    failure: 'any-nonzero',
    label: 'codex debug models',
  },
  grok: {
    command: 'grok',
    args: ['models'],
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000,
    parseFrom: 'combined',
    statusFromExit: true,
    failure: 'known-nonzero',
    label: 'grok models',
  },
  claude: {
    command: 'claude',
    args: ['--help'],
    maxBuffer: 2 * 1024 * 1024,
    timeout: 15_000,
    parseFrom: 'combined',
    statusFromExit: false,
    failure: 'never',
    blankTextWhenModels: true,
    label: 'claude --help',
  },
  agy: {
    command: 'agy',
    args: ['models'],
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000,
    parseFrom: 'stdout',
    statusFromExit: true,
    failure: 'known-nonzero',
    label: 'agy models',
  },
};

/**
 * Flags that take no value. `--human` writes `json` instead of its own key.
 *
 * @type {Map<string, [string, boolean]>}
 */
const BOOLEAN_FLAGS = new Map([
  ['--help', ['help', true]],
  ['-h', ['help', true]],
  ['--resolve', ['resolve', true]],
  ['--json', ['json', true]],
  ['--human', ['json', false]],
  ['--interactive', ['interactive', true]],
  ['--ask-model', ['ask-model', true]],
]);

/**
 * Apply one `--flag` token to `flags`.
 *
 * @param {string[]} argv
 * @param {number} index
 * @param {Record<string, string | boolean>} flags
 * @returns {number} argv tokens consumed (2 for `--flag value`)
 */
function applyFlag(argv, index, flags) {
  const token = argv[index];
  const boolean = BOOLEAN_FLAGS.get(token);
  if (boolean) {
    flags[boolean[0]] = boolean[1];
    return 1;
  }
  if (token.startsWith('--interactive=')) {
    const value = token.slice('--interactive='.length).toLowerCase();
    flags.interactive = INTERACTIVE_TRUTHY.includes(value);
    return 1;
  }
  const inline = token.match(/^--([^=]+)=(.*)$/);
  if (inline) {
    flags[inline[1]] = inline[2];
    return 1;
  }
  const next = argv[index + 1];
  if (token.startsWith('--') && next && !String(next).startsWith('-')) {
    flags[token.slice(2)] = next;
    return 2;
  }
  return 1;
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
function parseFlags(argv) {
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
  let index = 0;
  while (index < argv.length) index += applyFlag(argv, index, flags);
  return flags;
}

/**
 * @param {string[]} argv
 */
function parseCli(argv) {
  return { flags: parseFlags(argv), modelArgs: parseModelArgs(argv) };
}

/**
 * @param {Provider} provider
 * @param {string} text
 * @returns {import('../src/resolve-review-model.js').ReviewModel[]}
 */
function parseCatalog(provider, text) {
  return CATALOG_PARSERS[provider](text);
}

/**
 * @param {Provider} provider
 * @param {string} catalogPath
 * @returns {{ models: import('../src/resolve-review-model.js').ReviewModel[], error: string | null }}
 */
function fetchFromFile(provider, catalogPath) {
  const text = readFileSync(catalogPath, 'utf8');
  const models = parseCatalog(provider, text);
  // File catalogs: no process status; still report parse failure on nonblank empty parse.
  return catalogDiscoveryResult({ provider, models, text, status: 0, spawnError: null });
}

/**
 * @param {import('node:child_process').SpawnSyncReturns<string>} result
 * @param {DiscoverySpec} spec
 * @returns {Error | string | null}
 */
function cliFailure(result, spec) {
  if (spec.failure === 'never') return null;
  if (result.error) return result.error;
  const failed =
    spec.failure === 'any-nonzero'
      ? result.status !== 0
      : result.status != null && result.status !== 0;
  if (!failed) return null;
  return result.stderr || `${spec.label} exited ${result.status}`;
}

/**
 * @param {Provider} provider
 * @returns {{ models: import('../src/resolve-review-model.js').ReviewModel[], error: string | null }}
 */
function discoverLive(provider) {
  const spec = LIVE_DISCOVERY[provider];
  const result = spawnSync(spec.command, spec.args, {
    encoding: 'utf8',
    maxBuffer: spec.maxBuffer,
    timeout: spec.timeout,
  });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const catalogText = spec.parseFrom === 'stdout' ? result.stdout || '' : combined;
  const models = parseCatalog(provider, catalogText);
  return catalogDiscoveryResult({
    provider,
    models,
    // Empty text when aliases are present → no false parse error.
    text: spec.blankTextWhenModels && models.length > 0 ? '' : combined,
    status: spec.statusFromExit ? result.status : 0,
    spawnError: cliFailure(result, spec),
  });
}

/**
 * @param {'codex'|'grok'|'claude'|'agy'|'antigravity'} provider
 * @param {string} [catalogPath]
 * @returns {{ models: import('../src/resolve-review-model.js').ReviewModel[], error: string | null }}
 */
function fetchModels(provider, catalogPath) {
  const target = provider === 'antigravity' ? 'agy' : provider;
  return catalogPath ? fetchFromFile(target, catalogPath) : discoverLive(target);
}

/**
 * @typedef {object} Catalog
 * @property {Provider} provider
 * @property {import('../src/resolve-review-model.js').ReviewModel[]} models
 * @property {string | null} error
 * @property {import('../src/resolve-review-model.js').ReviewModel | null} recommended
 */

/**
 * @param {Record<string, string | boolean>} flags
 * @returns {Provider}
 */
function requestedProvider(flags) {
  let provider = String(flags.provider || '').toLowerCase();
  if (provider === 'antigravity') provider = 'agy';
  if (!PROVIDERS.has(provider)) {
    process.stderr.write(PROVIDER_ERROR);
    process.exit(1);
  }
  return /** @type {Provider} */ (provider);
}

/**
 * @param {Provider} provider
 * @param {import('../src/resolve-review-model.js').ReviewModel[]} ranked
 * @param {import('../src/resolve-review-model.js').ReviewModel | null} recommended
 * @param {string | null} catalogError
 */
function listingPayload(provider, ranked, recommended, catalogError) {
  return {
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
    catalogError,
  };
}

/**
 * @param {Provider} provider
 * @param {import('../src/resolve-review-model.js').ReviewModel[]} ranked
 * @param {import('../src/resolve-review-model.js').ReviewModel | null} recommended
 * @param {string | null} catalogError
 */
function writeHumanListing(provider, ranked, recommended, catalogError) {
  process.stdout.write(`provider: ${provider}\n`);
  process.stdout.write(`recommended: ${recommended?.slug ?? '(none)'}\n`);
  if (catalogError) process.stdout.write(`catalog-error: ${catalogError}\n`);
  for (const m of ranked) {
    const mark = recommended && m.slug === recommended.slug ? ' *' : '';
    process.stdout.write(
      `  - ${m.slug}${mark}${m.description ? ` — ${m.description}` : ''}\n`,
    );
  }
}

/**
 * @param {Catalog} catalog
 * @param {boolean} asJson
 */
function printCatalog(catalog, asJson) {
  const ranked = rankModelsForReview(catalog.models, { provider: catalog.provider });
  if (asJson) {
    const payload = listingPayload(catalog.provider, ranked, catalog.recommended, catalog.error);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  writeHumanListing(catalog.provider, ranked, catalog.recommended, catalog.error);
}

/**
 * @param {Catalog} catalog
 * @param {Record<string, string | boolean>} flags
 * @param {ReturnType<typeof parseModelArgs>} modelArgs
 */
function resolveOptions(catalog, flags, modelArgs) {
  const explicitFromFlag = flags.model ? String(flags.model) : null;
  return {
    provider: catalog.provider,
    models: catalog.models,
    explicitModel: modelArgs.model || explicitFromFlag,
    modelCodex: modelArgs.modelCodex,
    modelGrok: modelArgs.modelGrok,
    modelClaude: modelArgs.modelClaude,
    modelAgy: modelArgs.modelAgy,
    askModel: modelArgs.askModel || flags['ask-model'] === true || flags['ask-model'] === '1',
    interactive: Boolean(flags.interactive),
    userChoice: flags['user-choice'] ? String(flags['user-choice']) : null,
  };
}

/**
 * @param {Catalog} catalog
 * @param {Record<string, string | boolean>} flags
 * @param {ReturnType<typeof parseModelArgs>} modelArgs
 */
function resolvePayload(catalog, flags, modelArgs) {
  const resolved = resolveReviewModel(resolveOptions(catalog, flags, modelArgs));
  return {
    provider: catalog.provider,
    catalogError: catalog.error,
    recommended: catalog.recommended
      ? { slug: catalog.recommended.slug, displayName: catalog.recommended.displayName }
      : null,
    ...resolved,
  };
}

/**
 * @param {Catalog} catalog
 * @param {Record<string, string | boolean>} flags
 * @param {ReturnType<typeof parseModelArgs>} modelArgs
 */
function printResolution(catalog, flags, modelArgs) {
  process.stdout.write(`${JSON.stringify(resolvePayload(catalog, flags, modelArgs), null, 2)}\n`);
}

function main() {
  const { flags, modelArgs } = parseCli(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  const provider = requestedProvider(flags);
  const catalogPath = flags.catalog ? String(flags.catalog) : undefined;
  const { models, error } = fetchModels(provider, catalogPath);
  const catalog = {
    provider,
    models,
    error,
    recommended: recommendedReviewModel(models, { provider }),
  };

  if (flags.resolve) printResolution(catalog, flags, modelArgs);
  else printCatalog(catalog, Boolean(flags.json));
  process.exit(0);
}

main();
