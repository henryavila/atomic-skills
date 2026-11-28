/**
 * Pure external-reviewer model resolution for cross-model-bridge.
 *
 * Discovers models from provider catalogs (Codex JSON / Grok text), ranks a
 * recommended reviewer model, and resolves --model / --ask-model / interactive
 * picker decisions into a CLI MODEL_FLAG string.
 *
 * No I/O. Callers (skills / scripts) fetch catalog text and pass it in.
 *
 * Design (docs/superpowers/specs/2026-05-16-cross-model-review-design.md §8.4):
 * - Default non-interactive: do NOT pass --model (CLI recommended / user config)
 * - Explicit --model always wins
 * - Interactive: surface ranked options with recommended first
 * - --ask-model non-interactive: auto-bind recommended
 */

/** @typedef {'codex' | 'grok' | 'claude' | 'agy'} ExternalProvider */

/**
 * @typedef {object} ReviewModel
 * @property {string} slug
 * @property {string} [displayName]
 * @property {string} [description]
 * @property {number | null} [priority]
 * @property {string} [visibility]
 * @property {string[]} [reasoningLevels]
 * @property {boolean} [isDefault]
 * @property {ExternalProvider} [provider]
 */

/**
 * @typedef {object} ModelOption
 * @property {string} slug
 * @property {string} label
 * @property {string} [description]
 */

/**
 * @typedef {object} ResolveReviewModelResult
 * @property {'run' | 'pick'} action
 * @property {string | null} [modelId]
 * @property {string} [modelFlag]
 * @property {'explicit' | 'user-pick' | 'recommended' | 'cli-default'} [source]
 * @property {ReviewModel | null} [recommended]
 * @property {ModelOption[]} [options]
 * @property {boolean} [unknownToCatalog]
 * @property {boolean} [invalidModelId] true when an explicit/user id failed safety checks
 * @property {ReviewModel[]} [ranked]
 */

export {
  AGY_MODEL_ALIASES,
  CLAUDE_MODEL_ALIASES,
  parseAgyModelsList,
  parseClaudeModelsAliases,
  parseCodexModelsCatalog,
  parseGrokModelsList,
} from './review-model-catalog.js';

/**
 * Rank models for adversarial external review.
 * Codex: list-visible only, lower priority number first, then deeper reasoning support.
 * Claude/Agy: priority only (aliases; hybrid/opus first).
 * Grok: CLI default first, then remaining as listed.
 *
 * @param {ReviewModel[]} models
 * @param {{ provider: ExternalProvider }} opts
 * @returns {ReviewModel[]}
 */
export function rankModelsForReview(models, { provider }) {
  const list = Array.isArray(models) ? models.slice() : [];
  if (provider === 'codex' || provider === 'claude' || provider === 'agy') {
    // Codex: priority + reasoning. Claude/Agy: priority only (aliases; hybrid/opus first).
    return list
      .filter((m) => (m.visibility || 'list') !== 'hide')
      .sort((a, b) => {
        const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
        const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        if (provider === 'codex') {
          const da = reasoningDepthScore(a);
          const db = reasoningDepthScore(b);
          if (da !== db) return db - da;
        }
        return a.slug.localeCompare(b.slug);
      });
  }
  // grok
  return list
    .filter((m) => (m.visibility || 'list') !== 'hide')
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.slug.localeCompare(b.slug);
    });
}

/**
 * @param {ReviewModel} m
 * @returns {number}
 */
function reasoningDepthScore(m) {
  const levels = m.reasoningLevels || [];
  let score = 0;
  if (levels.includes('high')) score += 1;
  if (levels.includes('xhigh')) score += 2;
  if (levels.includes('max')) score += 3;
  if (levels.includes('ultra')) score += 4;
  return score;
}

/**
 * @param {ReviewModel[]} models
 * @param {{ provider: ExternalProvider }} opts
 * @returns {ReviewModel | null}
 */
export function recommendedReviewModel(models, opts) {
  const ranked = rankModelsForReview(models, opts);
  return ranked[0] ?? null;
}

/**
 * Model ids used in shell argv must be slug-shaped. Rejects shell metacharacters,
 * whitespace, control chars, and option-shaped values (leading `-`).
 *
 * Allowed: letters, digits, and `. _ : + - /` (catalog ids like `gpt-5.6-sol`,
 * `org/model`). First character must be alphanumeric.
 *
 * @param {string | null | undefined} modelId
 * @returns {boolean}
 */
export function isSafeReviewModelId(modelId) {
  if (modelId == null) return false;
  const s = String(modelId).trim();
  if (!s || s === 'cli-default') return false;
  if (s.startsWith('-')) return false;
  // Fail closed: only slug-shaped ids may be interpolated into provider CLIs.
  return /^[A-Za-z0-9][A-Za-z0-9._:+\-/]*$/.test(s);
}

/**
 * @param {string | null | undefined} modelId
 * @returns {string} empty when absent/unsafe; otherwise `--model <safe-id>`
 *   (safe-id is proven free of shell metacharacters so unquoted use is ok, but
 *   callers should prefer `--model "$REVIEW_MODEL_ID"` for defense in depth).
 */
export function buildModelFlag(modelId) {
  if (modelId == null || modelId === '' || modelId === 'cli-default') return '';
  const id = String(modelId).trim();
  if (!isSafeReviewModelId(id)) return '';
  return `--model ${id}`;
}

/**
 * @param {string | string[] | null | undefined} args
 * @returns {string[]}
 */
function tokenizeModelArgs(args) {
  if (args == null || args === '') return [];
  if (Array.isArray(args)) return args.map(String);
  const tokens = String(args).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return tokens.map((t) => t.replace(/^['"]|['"]$/g, ''));
}

/**
 * Read `--flag=value` or `--flag value` at index. A bare flag consumes only
 * itself, leaving the next token for the caller.
 *
 * @param {string[]} tokens
 * @param {number} index
 * @param {string} flag
 * @returns {{ value: string | null, next: number } | null}
 */
function readModelFlag(tokens, index, flag) {
  const token = tokens[index];
  const equals = token.match(new RegExp(`^${flag}=(.+)$`));
  if (equals) return { value: equals[1], next: index + 1 };
  if (token !== flag) return null;
  const next = tokens[index + 1];
  if (next && !next.startsWith('-')) return { value: next, next: index + 2 };
  return { value: null, next: index + 1 };
}

/** @typedef {'model' | 'modelCodex' | 'modelGrok' | 'modelClaude' | 'modelAgy'} ModelFlagField */

/** @type {ReadonlyArray<readonly [ModelFlagField, string]>} */
const MODEL_FLAGS = [
  ['model', '--model'],
  ['modelCodex', '--model-codex'],
  ['modelGrok', '--model-grok'],
  ['modelClaude', '--model-claude'],
  ['modelAgy', '--model-agy'],
];

/**
 * @param {string[]} tokens
 * @param {number} index
 * @returns {{ field: ModelFlagField, value: string | null, next: number } | null}
 */
function readFirstModelFlag(tokens, index) {
  for (const [field, flag] of MODEL_FLAGS) {
    const match = readModelFlag(tokens, index, flag);
    if (match) return { field, value: match.value, next: match.next };
  }
  return null;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isAskModelEnabled(value) {
  const normalized = value.toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'no';
}

/**
 * Parse model-related flags from a skill argument string or token list.
 * Consumes model flags **and** their values (including space-form
 * `--model <id>` and compact `model:<id>`), returning remaining tokens so
 * callers can resolve `git_ref` / `plan_path` without pollution.
 *
 * @param {string | string[] | null | undefined} args
 * @returns {{
 *   model: string | null,
 *   modelCodex: string | null,
 *   modelGrok: string | null,
 *   modelClaude: string | null,
 *   modelAgy: string | null,
 *   askModel: boolean,
 *   remainingTokens: string[],
 * }}
 */
export function parseModelArgs(args) {
  const tokens = tokenizeModelArgs(args);
  /** @type {Record<ModelFlagField, string | null>} */
  const parsed = {
    model: null,
    modelCodex: null,
    modelGrok: null,
    modelClaude: null,
    modelAgy: null,
  };
  let askModel = false;
  /** @type {string[]} */
  const remainingTokens = [];

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token === '--ask-model') {
      askModel = true;
      i++;
      continue;
    }
    if (token.startsWith('--ask-model=')) {
      askModel = isAskModelEnabled(token.slice('--ask-model='.length));
      i++;
      continue;
    }
    const compact = token.match(/^model:(.+)$/i);
    if (compact) {
      parsed.model = compact[1];
      i++;
      continue;
    }
    const matched = readFirstModelFlag(tokens, i);
    if (matched) {
      // A bare flag is dropped; it must not clear a value set earlier.
      if (matched.value != null) parsed[matched.field] = matched.value;
      i = matched.next;
      continue;
    }
    remainingTokens.push(token);
    i++;
  }

  return { ...parsed, askModel, remainingTokens };
}

/**
 * Join non-flag remaining tokens into the skill positional (`git_ref` / `plan_path`).
 *
 * @param {string[] | null | undefined} remainingTokens
 * @returns {string}
 */
export function positionalFromRemaining(remainingTokens) {
  if (!Array.isArray(remainingTokens) || remainingTokens.length === 0) return '';
  return remainingTokens
    .filter((t) => t != null && String(t).trim() !== '' && !String(t).startsWith('--'))
    .join(' ')
    .trim();
}

/**
 * Fail-open catalog discovery: keep any parsed models, but always surface process
 * or parse failures via `error` (never clear `catalogError` just because ≥1 model
 * parsed).
 *
 * @param {object} input
 * @param {ExternalProvider} input.provider
 * @param {ReviewModel[]} [input.models]
 * @param {string | null | undefined} [input.text] combined stdout/stderr used for parse
 * @param {number | null | undefined} [input.status] process exit code
 * @param {Error | string | null | undefined} [input.spawnError]
 * @returns {{ models: ReviewModel[], error: string | null }}
 */
export function catalogDiscoveryResult(input) {
  const provider = input.provider || 'codex';
  const models = Array.isArray(input.models) ? input.models : [];
  const text = input.text == null ? '' : String(input.text);
  const status = input.status;
  const spawnError = input.spawnError;
  const procFailed = Boolean(spawnError || (status != null && status !== 0));

  /** @type {string | null} */
  let error = null;
  if (procFailed) {
    if (spawnError instanceof Error) error = spawnError.message;
    else if (spawnError) error = String(spawnError);
    else error = `${provider} models exited ${status}`;
  } else if (models.length === 0 && text.trim() !== '') {
    error = `${provider} models: non-empty output but no models parsed`;
  }

  return { models, error };
}

/**
 * @typedef {object} ResolveInput
 * @property {ExternalProvider} provider
 * @property {ReviewModel[]} [models]
 * @property {string | null} [explicitModel] generic --model=
 * @property {string | null} [modelCodex]
 * @property {string | null} [modelGrok]
 * @property {string | null} [modelClaude]
 * @property {string | null} [modelAgy]
 * @property {boolean} [askModel]
 * @property {boolean} [interactive]
 * @property {string | null} [userChoice] answer from picker (slug | recommended | cli-default)
 */

/**
 * @typedef {object} ResolveBase
 * @property {ReviewModel | null} recommended
 * @property {ReviewModel[]} ranked
 * @property {ReviewModel[]} models
 */

/** Short aliases accepted for Antigravity model ids. */
const AGY_MODEL_IDS = new Map([
  ['flash', 'gemini-3.8-flash-high'],
  ['pro', 'gemini-3.1-pro-high'],
  ['hybrid', 'hybrid'],
  ['sonnet', 'claude-sonnet-5-5-high'],
  ['claude-sonnet', 'claude-sonnet-5-5-high'],
  ['claude-sonnet-4-6', 'claude-sonnet-5-5-high'],
  ['opus', 'claude-opus-5-5-high'],
  ['claude-opus', 'claude-opus-5-5-high'],
  ['claude-opus-4-6-thinking', 'claude-opus-5-5-high'],
]);

/**
 * @param {ExternalProvider} provider
 * @param {string | null} modelId
 * @returns {string | null}
 */
function normalizeProviderModelId(provider, modelId) {
  if (provider !== 'agy' || !modelId) return modelId;
  return AGY_MODEL_IDS.get(modelId.toLowerCase()) ?? modelId;
}

/**
 * @param {ResolveInput} input
 * @returns {string | null}
 */
function perProviderModel(input) {
  switch (input.provider) {
    case 'codex':
      return input.modelCodex ?? null;
    case 'grok':
      return input.modelGrok ?? null;
    case 'claude':
      return input.modelClaude ?? null;
    case 'agy':
      return input.modelAgy ?? null;
    default:
      return null;
  }
}

/**
 * Per-provider flag wins over the generic --model; both are normalized before
 * the safety check.
 *
 * @param {ResolveInput} input
 * @returns {string | null}
 */
function explicitModelFor(input) {
  const perProvider = perProviderModel(input);
  const explicit =
    (perProvider && String(perProvider).trim()) ||
    (input.explicitModel && String(input.explicitModel).trim()) ||
    null;
  return normalizeProviderModelId(input.provider, explicit);
}

/**
 * @param {ResolveInput} input
 * @returns {string | null}
 */
function userChoiceModel(input) {
  if (input.userChoice == null || String(input.userChoice).trim() === '') return null;
  return normalizeProviderModelId(input.provider, String(input.userChoice).trim());
}

/**
 * @param {ResolveBase} base
 * @returns {ResolveReviewModelResult}
 */
function runRecommended(base) {
  const { recommended } = base;
  if (!recommended) {
    return runResult({ ...base, modelId: null, source: 'cli-default' });
  }
  // Recommended comes from catalog: still gate through safety.
  if (!isSafeReviewModelId(recommended.slug)) {
    return runResult({ ...base, modelId: null, source: 'recommended', invalidModelId: true });
  }
  return runResult({ ...base, modelId: recommended.slug, source: 'recommended' });
}

/**
 * @param {string} explicit
 * @param {ResolveBase} base
 * @returns {ResolveReviewModelResult}
 */
function runExplicit(explicit, base) {
  if (explicit === 'cli-default') {
    return runResult({ ...base, modelId: null, source: 'cli-default' });
  }
  if (!isSafeReviewModelId(explicit)) {
    return runResult({ ...base, modelId: null, source: 'explicit', invalidModelId: true });
  }
  return runResult({ ...base, modelId: explicit, source: 'explicit' });
}

/**
 * @param {string} choice
 * @param {ResolveBase} base
 * @returns {ResolveReviewModelResult}
 */
function runUserChoice(choice, base) {
  if (choice === 'cli-default') {
    return runResult({ ...base, modelId: null, source: 'cli-default' });
  }
  if (choice === 'recommended') return runRecommended(base);
  if (!isSafeReviewModelId(choice)) {
    return runResult({ ...base, modelId: null, source: 'user-pick', invalidModelId: true });
  }
  return runResult({ ...base, modelId: choice, source: 'user-pick' });
}

/**
 * --ask-model headless: bind the recommended model when the catalog is known.
 *
 * @param {ResolveBase} base
 * @returns {ResolveReviewModelResult}
 */
function runAskModel(base) {
  if (base.recommended) return runRecommended(base);
  return runResult({ ...base, modelId: null, source: 'cli-default' });
}

/**
 * @param {ResolveBase} base
 * @returns {ResolveReviewModelResult}
 */
function pickResult(base) {
  return {
    action: 'pick',
    recommended: base.recommended,
    ranked: base.ranked,
    options: buildPickerOptions(base.ranked, base.recommended),
  };
}

/**
 * Resolve which model id / MODEL_FLAG to use for one external provider leg.
 *
 * @param {ResolveInput} input
 * @returns {ResolveReviewModelResult}
 */
export function resolveReviewModel(input) {
  const provider = input.provider;
  const models = Array.isArray(input.models) ? input.models : [];
  const ranked = rankModelsForReview(models, { provider });
  const recommended = ranked[0] ?? null;
  const base = { recommended, ranked, models };

  const explicit = explicitModelFor(input);
  if (explicit) return runExplicit(explicit, base);

  const choice = userChoiceModel(input);
  if (choice != null) return runUserChoice(choice, base);

  // Interactive (or --ask-model interactive): surface the picker.
  if (Boolean(input.interactive)) return pickResult(base);
  if (Boolean(input.askModel)) return runAskModel(base);

  // Non-interactive default: leave model selection to the CLI.
  return runResult({ ...base, modelId: null, source: 'cli-default' });
}

/**
 * @param {ReviewModel[]} ranked
 * @param {ReviewModel | null} recommended
 * @returns {ModelOption[]}
 */
function buildPickerOptions(ranked, recommended) {
  /** @type {ModelOption[]} */
  const options = [];
  if (recommended) {
    options.push({
      slug: recommended.slug,
      label: `${recommended.displayName || recommended.slug} (recommended)`,
      description: truncate(
        recommended.description ||
          `Best available for adversarial review (priority ${recommended.priority ?? 'n/a'})`,
        120,
      ),
    });
  }
  for (const m of ranked) {
    if (recommended && m.slug === recommended.slug) continue;
    options.push({
      slug: m.slug,
      label: m.displayName || m.slug,
      description: truncate(
        m.description ||
          (m.isDefault ? 'CLI default' : m.priority != null ? `priority ${m.priority}` : ''),
        120,
      ),
    });
  }
  options.push({
    slug: 'cli-default',
    label: 'CLI default (no --model flag)',
    description:
      'Let the provider CLI use its configured/recommended default (config.toml / grok default).',
  });
  return options;
}

/**
 * @param {object} p
 * @param {string | null} p.modelId
 * @param {'explicit' | 'user-pick' | 'recommended' | 'cli-default'} p.source
 * @param {ReviewModel | null} p.recommended
 * @param {ReviewModel[]} p.ranked
 * @param {ReviewModel[]} p.models
 * @param {boolean} [p.invalidModelId]
 * @returns {ResolveReviewModelResult}
 */
function runResult({ modelId, source, recommended, ranked, models, invalidModelId = false }) {
  const id = modelId == null || modelId === '' ? null : modelId;
  const known =
    id == null ||
    models.some((m) => m.slug === id) ||
    id === 'cli-default';
  return {
    action: 'run',
    modelId: id,
    modelFlag: buildModelFlag(id),
    source,
    recommended,
    ranked,
    unknownToCatalog: id != null && !known,
    invalidModelId: Boolean(invalidModelId),
  };
}

/**
 * @param {string} s
 * @param {number} n
 */
function truncate(s, n) {
  const t = String(s || '');
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}
