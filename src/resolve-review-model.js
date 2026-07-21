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

/** @typedef {'codex' | 'grok' | 'claude'} ExternalProvider */

/** Stable Claude Code aliases (no live CLI catalog — design D7). */
export const CLAUDE_MODEL_ALIASES = Object.freeze([
  { slug: 'opus', displayName: 'Opus', description: 'Recommended for adversarial review', isDefault: false, priority: 1 },
  { slug: 'sonnet', displayName: 'Sonnet', description: 'Balanced default-class', isDefault: true, priority: 2 },
  { slug: 'haiku', displayName: 'Haiku', description: 'Fast / cheap', isDefault: false, priority: 3 },
  { slug: 'fable', displayName: 'Fable', description: 'Alias named in claude --help', isDefault: false, priority: 4 },
]);

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
 * @property {boolean} [invalidModelId] — true when an explicit/user id failed safety checks
 * @property {ReviewModel[]} [ranked]
 */

/**
 * @param {unknown} raw
 * @returns {ReviewModel[]}
 */
export function parseCodexModelsCatalog(raw) {
  let obj = raw;
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof obj !== 'object' || obj === null) return [];
  const list = Array.isArray(obj)
    ? obj
    : Array.isArray(/** @type {{ models?: unknown }} */ (obj).models)
      ? /** @type {{ models: unknown[] }} */ (obj).models
      : [];

  /** @type {ReviewModel[]} */
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const m = /** @type {Record<string, unknown>} */ (item);
    const slug = String(m.slug ?? m.id ?? m.model ?? '').trim();
    if (!slug) continue;
    const levelsRaw = m.supported_reasoning_levels;
    /** @type {string[]} */
    const reasoningLevels = [];
    if (Array.isArray(levelsRaw)) {
      for (const lvl of levelsRaw) {
        if (lvl && typeof lvl === 'object' && 'effort' in lvl) {
          reasoningLevels.push(String(/** @type {{ effort: unknown }} */ (lvl).effort));
        } else if (typeof lvl === 'string') {
          reasoningLevels.push(lvl);
        }
      }
    }
    const priority =
      typeof m.priority === 'number' && Number.isFinite(m.priority) ? m.priority : null;
    out.push({
      slug,
      displayName: m.display_name != null ? String(m.display_name) : slug,
      description: m.description != null ? String(m.description) : '',
      priority,
      visibility: m.visibility != null ? String(m.visibility) : 'list',
      reasoningLevels,
      isDefault: false,
      provider: 'codex',
    });
  }
  return out;
}

/**
 * Parse `grok models` stdout.
 * @param {string | null | undefined} text
 * @returns {ReviewModel[]}
 */
export function parseGrokModelsList(text) {
  if (text == null || text === '') return [];
  const lines = String(text).split(/\r?\n/);
  /** @type {ReviewModel[]} */
  const out = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^available models:?$/i.test(trimmed)) {
      inList = true;
      continue;
    }
    // bullet: "* slug" or "* slug (default)" or "- slug"
    const bullet = trimmed.match(/^[*•\-]\s+(\S+)(?:\s+\(([^)]+)\))?/);
    if (bullet) {
      const slug = bullet[1];
      const note = (bullet[2] || '').toLowerCase();
      const isDefault = /\bdefault\b/.test(note) || note === 'default';
      out.push({
        slug,
        displayName: slug,
        description: isDefault ? 'CLI default' : '',
        priority: null,
        visibility: 'list',
        reasoningLevels: [],
        isDefault,
        provider: 'grok',
      });
      continue;
    }
    // "Default model: slug" — mark default even if list not yet seen
    const def = trimmed.match(/^default model:\s*(\S+)/i);
    if (def) {
      const slug = def[1];
      const existing = out.find((m) => m.slug === slug);
      if (existing) existing.isDefault = true;
      else if (!inList) {
        // record for later merge when list appears; also keep as candidate
        out.push({
          slug,
          displayName: slug,
          description: 'CLI default',
          priority: null,
          visibility: 'list',
          reasoningLevels: [],
          isDefault: true,
          provider: 'grok',
        });
      }
    }
  }
  // de-dupe by slug (prefer isDefault true)
  const bySlug = new Map();
  for (const m of out) {
    const prev = bySlug.get(m.slug);
    if (!prev || (m.isDefault && !prev.isDefault)) bySlug.set(m.slug, m);
  }
  return [...bySlug.values()];
}

/**
 * Claude has no live CLI catalog. Return stable aliases (optional help-text
 * scan can mark aliases mentioned in `claude --help`).
 *
 * @param {string | null | undefined} helpText
 * @returns {ReviewModel[]}
 */
export function parseClaudeModelsAliases(helpText) {
  const help = helpText == null ? '' : String(helpText);
  /** @type {ReviewModel[]} */
  const out = [];
  for (const a of CLAUDE_MODEL_ALIASES) {
    const mentioned = help === '' || new RegExp(`\\b${a.slug}\\b`, 'i').test(help);
    if (!mentioned && help !== '') continue;
    out.push({
      slug: a.slug,
      displayName: a.displayName,
      description: a.description,
      priority: a.priority,
      visibility: 'list',
      reasoningLevels: [],
      isDefault: a.isDefault === true,
      provider: 'claude',
    });
  }
  // Always return at least the full alias table when help is empty (offline).
  if (out.length === 0) {
    for (const a of CLAUDE_MODEL_ALIASES) {
      out.push({
        slug: a.slug,
        displayName: a.displayName,
        description: a.description,
        priority: a.priority,
        visibility: 'list',
        reasoningLevels: [],
        isDefault: a.isDefault === true,
        provider: 'claude',
      });
    }
  }
  return out;
}

/**
 * Rank models for adversarial external review.
 * Codex: list-visible only, lower priority number first, then deeper reasoning support.
 * Grok: CLI default first, then remaining as listed.
 *
 * @param {ReviewModel[]} models
 * @param {{ provider: ExternalProvider }} opts
 * @returns {ReviewModel[]}
 */
export function rankModelsForReview(models, { provider }) {
  const list = Array.isArray(models) ? models.slice() : [];
  if (provider === 'codex' || provider === 'claude') {
    // Codex: priority + reasoning. Claude: priority only (aliases; opus first).
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
 *   askModel: boolean,
 *   remainingTokens: string[],
 * }}
 */
export function parseModelArgs(args) {
  /** @type {string[]} */
  let tokens;
  if (args == null || args === '') {
    tokens = [];
  } else if (Array.isArray(args)) {
    tokens = args.map(String);
  } else {
    tokens = String(args).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    tokens = tokens.map((t) => t.replace(/^['"]|['"]$/g, ''));
  }

  /** @type {string | null} */
  let model = null;
  /** @type {string | null} */
  let modelCodex = null;
  /** @type {string | null} */
  let modelGrok = null;
  /** @type {string | null} */
  let modelClaude = null;
  let askModel = false;
  /** @type {string[]} */
  const remainingTokens = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--ask-model') {
      askModel = true;
      continue;
    }
    if (t.startsWith('--ask-model=')) {
      const v = t.slice('--ask-model='.length).toLowerCase();
      askModel = v !== '0' && v !== 'false' && v !== 'no';
      continue;
    }

    const eqModel = t.match(/^--model=(.+)$/);
    if (eqModel) {
      model = eqModel[1];
      continue;
    }
    if (t === '--model') {
      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        model = next;
        i++;
      }
      // bare `--model` with no value: drop the flag, leave next token alone
      continue;
    }
    const modelColon = t.match(/^model:(.+)$/i);
    if (modelColon) {
      model = modelColon[1];
      continue;
    }

    const eqCodex = t.match(/^--model-codex=(.+)$/);
    if (eqCodex) {
      modelCodex = eqCodex[1];
      continue;
    }
    if (t === '--model-codex') {
      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        modelCodex = next;
        i++;
      }
      continue;
    }

    const eqGrok = t.match(/^--model-grok=(.+)$/);
    if (eqGrok) {
      modelGrok = eqGrok[1];
      continue;
    }
    if (t === '--model-grok') {
      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        modelGrok = next;
        i++;
      }
      continue;
    }

    const eqClaude = t.match(/^--model-claude=(.+)$/);
    if (eqClaude) {
      modelClaude = eqClaude[1];
      continue;
    }
    if (t === '--model-claude') {
      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        modelClaude = next;
        i++;
      }
      continue;
    }

    remainingTokens.push(t);
  }

  return { model, modelCodex, modelGrok, modelClaude, askModel, remainingTokens };
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
 * @param {string | null | undefined} [input.text] — combined stdout/stderr used for parse
 * @param {number | null | undefined} [input.status] — process exit code
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
 * Resolve which model id / MODEL_FLAG to use for one external provider leg.
 *
 * @param {object} input
 * @param {ExternalProvider} input.provider
 * @param {ReviewModel[]} [input.models]
 * @param {string | null} [input.explicitModel] — generic --model=
 * @param {string | null} [input.modelCodex]
 * @param {string | null} [input.modelGrok]
 * @param {string | null} [input.modelClaude]
 * @param {boolean} [input.askModel]
 * @param {boolean} [input.interactive]
 * @param {string | null} [input.userChoice] — answer from picker (slug | recommended | cli-default)
 * @returns {ResolveReviewModelResult}
 */
export function resolveReviewModel(input) {
  const provider = input.provider;
  const models = Array.isArray(input.models) ? input.models : [];
  const ranked = rankModelsForReview(models, { provider });
  const recommended = ranked[0] ?? null;
  const interactive = Boolean(input.interactive);
  const askModel = Boolean(input.askModel);

  const perProvider =
    provider === 'codex'
      ? input.modelCodex ?? null
      : provider === 'grok'
        ? input.modelGrok ?? null
        : provider === 'claude'
          ? input.modelClaude ?? null
          : null;
  const explicit =
    (perProvider && String(perProvider).trim()) ||
    (input.explicitModel && String(input.explicitModel).trim()) ||
    null;

  if (explicit) {
    if (explicit === 'cli-default') {
      return runResult({
        modelId: null,
        source: 'cli-default',
        recommended,
        ranked,
        models,
      });
    }
    if (!isSafeReviewModelId(explicit)) {
      return runResult({
        modelId: null,
        source: 'explicit',
        recommended,
        ranked,
        models,
        invalidModelId: true,
      });
    }
    return runResult({
      modelId: explicit,
      source: 'explicit',
      recommended,
      ranked,
      models,
    });
  }

  if (input.userChoice != null && String(input.userChoice).trim() !== '') {
    const choice = String(input.userChoice).trim();
    if (choice === 'cli-default') {
      return runResult({
        modelId: null,
        source: 'cli-default',
        recommended,
        ranked,
        models,
      });
    }
    if (choice === 'recommended') {
      if (!recommended) {
        return runResult({
          modelId: null,
          source: 'cli-default',
          recommended,
          ranked,
          models,
        });
      }
      // Recommended comes from catalog — still gate through safety.
      if (!isSafeReviewModelId(recommended.slug)) {
        return runResult({
          modelId: null,
          source: 'recommended',
          recommended,
          ranked,
          models,
          invalidModelId: true,
        });
      }
      return runResult({
        modelId: recommended.slug,
        source: 'recommended',
        recommended,
        ranked,
        models,
      });
    }
    if (!isSafeReviewModelId(choice)) {
      return runResult({
        modelId: null,
        source: 'user-pick',
        recommended,
        ranked,
        models,
        invalidModelId: true,
      });
    }
    return runResult({
      modelId: choice,
      source: 'user-pick',
      recommended,
      ranked,
      models,
    });
  }

  // Interactive (or --ask-model interactive): surface picker
  if (interactive && (askModel || !explicit)) {
    // When interactive without explicit always pick (unless userChoice handled above)
    return {
      action: 'pick',
      recommended,
      ranked,
      options: buildPickerOptions(ranked, recommended),
    };
  }

  // --ask-model headless: bind recommended when catalog known
  if (askModel && !interactive) {
    if (recommended) {
      if (!isSafeReviewModelId(recommended.slug)) {
        return runResult({
          modelId: null,
          source: 'recommended',
          recommended,
          ranked,
          models,
          invalidModelId: true,
        });
      }
      return runResult({
        modelId: recommended.slug,
        source: 'recommended',
        recommended,
        ranked,
        models,
      });
    }
    return runResult({
      modelId: null,
      source: 'cli-default',
      recommended,
      ranked,
      models,
    });
  }

  // Non-interactive default: leave model selection to the CLI
  return runResult({
    modelId: null,
    source: 'cli-default',
    recommended,
    ranked,
    models,
  });
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
