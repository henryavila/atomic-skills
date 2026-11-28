/**
 * Provider model catalogs for external review model resolution.
 *
 * Parses the formats each provider CLI exposes (Codex JSON, Grok text, Agy
 * TSV) into the shared ReviewModel shape, and holds the stable alias tables
 * for providers without a live catalog (Claude, Agy fallback).
 *
 * No I/O. Callers fetch catalog text and pass it in.
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

/** Stable Claude Code aliases (no live CLI catalog — design D7). */
export const CLAUDE_MODEL_ALIASES = Object.freeze([
  { slug: 'opus', displayName: 'Opus', description: 'Recommended for adversarial review', isDefault: false, priority: 1 },
  { slug: 'sonnet', displayName: 'Sonnet', description: 'Balanced default-class', isDefault: true, priority: 2 },
  { slug: 'haiku', displayName: 'Haiku', description: 'Fast / cheap', isDefault: false, priority: 3 },
  { slug: 'fable', displayName: 'Fable', description: 'Alias named in claude --help', isDefault: false, priority: 4 },
]);

/** Stable Antigravity model aliases and defaults. */
export const AGY_MODEL_ALIASES = Object.freeze([
  { slug: 'hybrid', displayName: 'Hybrid (Flash Pass 1 + Pro Pass 2)', description: 'Recommended: fast sweep + deep reasoning verdict', isDefault: true, priority: 1 },
  { slug: 'gemini-3.8-flash-high', displayName: 'Gemini 3.8 Flash (High)', description: 'Fast scan (~8s) for code review', isDefault: false, priority: 2 },
  { slug: 'gemini-3.1-pro-high', displayName: 'Gemini 3.1 Pro (High)', description: 'Deep reasoning for architecture and plan review', isDefault: false, priority: 3 },
  { slug: 'claude-sonnet-5-5-high', displayName: 'Claude Sonnet 5.5 (High)', description: 'Balanced cross-family option in agy', isDefault: false, priority: 4 },
  { slug: 'claude-opus-5-5-high', displayName: 'Claude Opus 5.5 (High)', description: 'Heavy reasoning option in agy', isDefault: false, priority: 5 },
]);

/**
 * Turn raw catalog input into a parsed JSON object or array.
 *
 * @param {unknown} raw
 * @returns {Record<string, unknown> | unknown[] | null}
 */
function coerceCatalog(raw) {
  if (raw == null || raw === '') return null;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  return /** @type {Record<string, unknown> | unknown[]} */ (obj);
}

/**
 * @param {Record<string, unknown> | unknown[]} obj
 * @returns {unknown[]}
 */
function codexCatalogItems(obj) {
  if (Array.isArray(obj)) return obj;
  const models = /** @type {{ models?: unknown }} */ (obj).models;
  return Array.isArray(models) ? models : [];
}

/**
 * @param {unknown} levelsRaw
 * @returns {string[]}
 */
function parseReasoningLevels(levelsRaw) {
  if (!Array.isArray(levelsRaw)) return [];
  /** @type {string[]} */
  const levels = [];
  for (const level of levelsRaw) {
    if (level && typeof level === 'object' && 'effort' in level) {
      levels.push(String(/** @type {{ effort: unknown }} */ (level).effort));
    } else if (typeof level === 'string') {
      levels.push(level);
    }
  }
  return levels;
}

/**
 * @param {unknown} item
 * @returns {ReviewModel | null}
 */
function parseCodexModel(item) {
  if (!item || typeof item !== 'object') return null;
  const m = /** @type {Record<string, unknown>} */ (item);
  const slug = String(m.slug ?? m.id ?? m.model ?? '').trim();
  if (!slug) return null;
  return {
    slug,
    displayName: m.display_name != null ? String(m.display_name) : slug,
    description: m.description != null ? String(m.description) : '',
    priority:
      typeof m.priority === 'number' && Number.isFinite(m.priority) ? m.priority : null,
    visibility: m.visibility != null ? String(m.visibility) : 'list',
    reasoningLevels: parseReasoningLevels(m.supported_reasoning_levels),
    isDefault: false,
    provider: 'codex',
  };
}

/**
 * @param {unknown} raw
 * @returns {ReviewModel[]}
 */
export function parseCodexModelsCatalog(raw) {
  const obj = coerceCatalog(raw);
  if (obj == null) return [];
  /** @type {ReviewModel[]} */
  const out = [];
  for (const item of codexCatalogItems(obj)) {
    const model = parseCodexModel(item);
    if (model) out.push(model);
  }
  return out;
}

/**
 * @param {string} slug
 * @param {{ description?: string, isDefault?: boolean }} [overrides]
 * @returns {ReviewModel}
 */
function grokModel(slug, { description = '', isDefault = false } = {}) {
  return {
    slug,
    displayName: slug,
    description,
    priority: null,
    visibility: 'list',
    reasoningLevels: [],
    isDefault,
    provider: 'grok',
  };
}

/**
 * @param {string} trimmed
 * @returns {ReviewModel | null}
 */
function grokBulletModel(trimmed) {
  // bullet: "* slug" or "* slug (default)" or "- slug"
  const bullet = trimmed.match(/^[*•\-]\s+(\S+)(?:\s+\(([^)]+)\))?/);
  if (!bullet) return null;
  const slug = bullet[1];
  const note = (bullet[2] || '').toLowerCase();
  const isDefault = /\bdefault\b/.test(note) || note === 'default';
  return grokModel(slug, { description: isDefault ? 'CLI default' : '', isDefault });
}

/**
 * @param {string} trimmed
 * @returns {string | null}
 */
function grokDefaultSlug(trimmed) {
  const def = trimmed.match(/^default model:\s*(\S+)/i);
  return def ? def[1] : null;
}

/**
 * Mark an already-listed model as the default, or record a default seen before
 * the list starts.
 *
 * @param {ReviewModel[]} models
 * @param {string} slug
 * @param {boolean} inList
 */
function addGrokDefault(models, slug, inList) {
  const existing = models.find((m) => m.slug === slug);
  if (existing) {
    existing.isDefault = true;
    return;
  }
  if (!inList) models.push(grokModel(slug, { description: 'CLI default', isDefault: true }));
}

/**
 * @param {ReviewModel[]} models
 * @returns {ReviewModel[]}
 */
function dedupeGrokModels(models) {
  const bySlug = new Map();
  for (const m of models) {
    const prev = bySlug.get(m.slug);
    if (!prev || (m.isDefault && !prev.isDefault)) bySlug.set(m.slug, m);
  }
  return [...bySlug.values()];
}

/**
 * Parse `grok models` stdout.
 * @param {string | null | undefined} text
 * @returns {ReviewModel[]}
 */
export function parseGrokModelsList(text) {
  if (text == null || text === '') return [];
  /** @type {ReviewModel[]} */
  const out = [];
  let inList = false;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^available models:?$/i.test(trimmed)) {
      inList = true;
      continue;
    }
    const bullet = grokBulletModel(trimmed);
    if (bullet) {
      out.push(bullet);
      continue;
    }
    const defaultSlug = grokDefaultSlug(trimmed);
    if (defaultSlug) addGrokDefault(out, defaultSlug, inList);
  }
  return dedupeGrokModels(out);
}

/**
 * @param {{ slug: string, displayName: string, description: string, priority: number, isDefault: boolean }} alias
 * @returns {ReviewModel}
 */
function claudeAliasModel(alias) {
  return {
    slug: alias.slug,
    displayName: alias.displayName,
    description: alias.description,
    priority: alias.priority,
    visibility: 'list',
    reasoningLevels: [],
    isDefault: alias.isDefault === true,
    provider: 'claude',
  };
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
  if (help === '') return CLAUDE_MODEL_ALIASES.map(claudeAliasModel);
  const out = [];
  for (const alias of CLAUDE_MODEL_ALIASES) {
    const mentioned = new RegExp(`\\b${alias.slug}\\b`, 'i').test(help);
    if (mentioned) out.push(claudeAliasModel(alias));
  }
  // Always return at least the full alias table when no alias is mentioned.
  return out.length === 0 ? CLAUDE_MODEL_ALIASES.map(claudeAliasModel) : out;
}

/**
 * @returns {ReviewModel[]}
 */
function agyFallbackModels() {
  return AGY_MODEL_ALIASES.map((alias) => ({
    ...alias,
    visibility: 'list',
    reasoningLevels: [],
    provider: 'agy',
  }));
}

/**
 * @returns {ReviewModel}
 */
function agyHybridModel() {
  return {
    slug: 'hybrid',
    displayName: 'Hybrid (Flash Pass 1 + Pro Pass 2)',
    description: 'Recommended: fast sweep + deep reasoning verdict',
    priority: 1,
    visibility: 'list',
    reasoningLevels: [],
    isDefault: true,
    provider: 'agy',
  };
}

/**
 * Spinner and status lines printed by `agy models` while it fetches the list.
 *
 * @param {string} trimmed
 * @returns {boolean}
 */
function isAgyNoise(trimmed) {
  return (
    !trimmed ||
    trimmed.startsWith('⠋') ||
    trimmed.startsWith('⠙') ||
    trimmed.startsWith('⠹') ||
    trimmed.includes('Fetching available models')
  );
}

/**
 * @param {string} line
 * @returns {ReviewModel | null}
 */
function agyLineModel(line) {
  const trimmed = line.trim();
  if (isAgyNoise(trimmed)) return null;
  const parts = trimmed.split('\t');
  const slug = parts[0]?.trim();
  if (!slug) return null;
  const displayName = parts[1]?.trim() || slug;
  const isFlash = slug.includes('flash');
  const isPro = slug.includes('pro');
  return {
    slug,
    displayName,
    description: isFlash ? 'Fast scan (~8s)' : isPro ? 'Deep reasoning' : 'Available in agy',
    priority: isFlash ? 2 : isPro ? 3 : 4,
    visibility: 'list',
    reasoningLevels: [],
    isDefault: false,
    provider: 'agy',
  };
}

/**
 * Parse output of `agy models` (TSV `<slug>\t<displayName>`).
 * @param {string | null | undefined} raw
 * @returns {ReviewModel[]}
 */
export function parseAgyModelsList(raw) {
  if (raw == null || String(raw).trim() === '') return agyFallbackModels();
  /** @type {ReviewModel[]} */
  const out = [agyHybridModel()];
  for (const line of String(raw).split(/\r?\n/)) {
    const model = agyLineModel(line);
    if (model) out.push(model);
  }
  return out;
}
