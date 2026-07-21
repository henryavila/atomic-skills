/**
 * Provider field writers/readers for CROSS-MODEL REVIEW receipts (design D8).
 *
 * Pure helpers — no I/O. Skill bodies (review-code/plan, project-drift review-due)
 * and last-review.json writers should call these so same-family remaps never
 * record provider:codex|grok and so the enum stays consistent.
 */

import {
  defaultExternalProvider,
  isSameFamilyExternal,
  normalizeHostFamily,
} from './cross-model-host-default.js';

/** @typedef {'codex' | 'grok' | 'claude' | 'local'} ProviderId */

export const PROVIDER_ENUM = Object.freeze(
  /** @type {const} */ (['codex', 'grok', 'claude', 'local']),
);

const PROVIDER_SET = new Set(PROVIDER_ENUM);

/**
 * @param {unknown} raw
 * @returns {ProviderId | null}
 */
export function normalizeProvider(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (PROVIDER_SET.has(s)) return /** @type {ProviderId} */ (s);
  return null;
}

/**
 * Build the provider fields for a review receipt / last-review write.
 * Same-family remap ALWAYS forces provider:local and clears version.
 *
 * @param {object} input
 * @param {string} input.provider - requested or routed provider
 * @param {boolean} [input.sameFamilyRemap]
 * @param {string} [input.providerVersion]
 * @returns {{ provider: ProviderId, providerVersion: string, sameFamilyRemap: boolean }}
 */
export function buildProviderFields(input) {
  const sameFamilyRemap = input.sameFamilyRemap === true;
  if (sameFamilyRemap) {
    return {
      provider: 'local',
      providerVersion: '',
      sameFamilyRemap: true,
    };
  }

  const provider = normalizeProvider(input.provider);
  if (!provider) {
    throw new Error(
      `unknown provider "${input.provider}". Valid: ${PROVIDER_ENUM.join('|')}.`,
    );
  }

  const providerVersion =
    provider === 'local'
      ? ''
      : input.providerVersion == null
        ? ''
        : String(input.providerVersion);

  return {
    provider,
    providerVersion,
    sameFamilyRemap: false,
  };
}

/**
 * Read provider fields from a plain object (JSON last-review, YAML frontmatter).
 * Legacy: `codex_version` alone → provider codex.
 *
 * @param {Record<string, unknown> | null | undefined} obj
 * @returns {{ provider: ProviderId | null, providerVersion: string, sameFamilyRemap: boolean }}
 */
export function parseProviderFields(obj) {
  if (obj == null || typeof obj !== 'object') {
    return { provider: null, providerVersion: '', sameFamilyRemap: false };
  }

  const sameFamilyRemap =
    obj.sameFamilyRemap === true ||
    obj.same_family_remap === true ||
    obj.sameFamilyRemap === 'true';

  let provider = normalizeProvider(obj.provider);
  let providerVersion = '';

  if (obj.providerVersion != null && String(obj.providerVersion) !== '') {
    providerVersion = String(obj.providerVersion);
  } else if (obj.provider_version != null && String(obj.provider_version) !== '') {
    providerVersion = String(obj.provider_version);
  }

  if (provider == null && obj.codex_version != null && String(obj.codex_version) !== '') {
    provider = 'codex';
    providerVersion = String(obj.codex_version);
  }

  if (sameFamilyRemap) {
    // Defense in depth: remap never surfaces as external even if a buggy writer
    // left provider:codex|grok in the blob.
    return { provider: 'local', providerVersion: '', sameFamilyRemap: true };
  }

  return {
    provider,
    providerVersion: provider === 'local' ? '' : providerVersion,
    sameFamilyRemap: false,
  };
}

/**
 * Writer → reader identity for the provider field set.
 * @param {Record<string, unknown>} fields
 */
export function roundTripProviderFields(fields) {
  return parseProviderFields(buildProviderFields({
    provider: /** @type {string} */ (fields.provider),
    sameFamilyRemap: fields.sameFamilyRemap === true,
    providerVersion: /** @type {string | undefined} */ (
      fields.providerVersion ?? fields.provider_version
    ),
  }));
}

/**
 * Parse YAML-like frontmatter from a review markdown file (minimal; no full YAML).
 * @param {string} markdown
 */
export function parseReviewFileFrontmatter(markdown) {
  if (typeof markdown !== 'string') {
    return parseProviderFields(null);
  }
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return parseProviderFields(null);

  /** @type {Record<string, string>} */
  const obj = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return parseProviderFields(obj);
}

/**
 * Mode flag for review-due / create-plan when forcing a single external pass:
 * host's family-different default (`codex` | `grok` | rarely `claude`), never
 * hardcoded codex-only.
 *
 * @param {string} hostFamily
 * @returns {'codex' | 'grok' | 'claude'}
 */
export function hostDefaultExternalMode(hostFamily) {
  return defaultExternalProvider(hostFamily);
}

/**
 * Whether a completed receipt counts toward CROSS-MODEL REVIEW cadence.
 * Fail closed: hostFamily is required; without it, return false (unknown host
 * must not advance cadence).
 *
 * @param {object} input
 * @param {string | null | undefined} input.provider
 * @param {boolean} [input.sameFamilyRemap]
 * @param {string} [input.hostFamily] - required for true; absent → false
 */
export function countsAsCrossModel(input) {
  if (input.sameFamilyRemap === true) return false;
  const provider = normalizeProvider(input.provider);
  if (provider == null || provider === 'local') return false;
  if (input.hostFamily == null || String(input.hostFamily) === '') {
    return false;
  }
  return !isSameFamilyExternal(normalizeHostFamily(input.hostFamily), provider);
}
