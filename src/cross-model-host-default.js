/**
 * Pure host → external-reviewer routing for cross-model-bridge (design D6/D7).
 *
 * No I/O. Callers supply already-detected host signals, interactivity, and flags.
 * Skill bodies and F3 mode pickers should call this helper (or mirror its table)
 * rather than re-deriving same-family rules ad hoc.
 */

/** @typedef {'claude' | 'codex' | 'grok' | 'agy' | 'cursor' | 'unknown'} HostFamily */
/** @typedef {'local' | 'codex' | 'grok' | 'claude' | 'agy'} ProviderId */
/** @typedef {'local' | 'codex' | 'grok' | 'claude' | 'agy' | 'both' | 'both-codex' | 'both-grok' | 'both-claude' | 'both-agy' | 'external-both'} ReviewMode */

export const HOST_FAMILIES = Object.freeze(['claude', 'codex', 'grok', 'agy', 'cursor', 'unknown']);

/** External default when mode is `both` or when resolving the host default provider. */
export const HOST_EXTERNAL_DEFAULT = Object.freeze({
  grok: 'codex',
  codex: 'grok',
  claude: 'codex',
  cursor: 'codex',
  agy: 'codex',
  unknown: 'codex',
});

/** Fixed order for multi-provider legs (external-both). */
export const EXTERNAL_PROVIDER_ORDER = Object.freeze(/** @type {const} */ (['codex', 'grok', 'claude', 'agy']));

/** @type {Set<string>} */
const EXTERNAL_PROVIDERS = new Set(EXTERNAL_PROVIDER_ORDER);

/** Modes accepted by resolveReviewRoute — unknown values abort (no silent local). */
export const REVIEW_MODES = Object.freeze([
  'local',
  'codex',
  'grok',
  'claude',
  'agy',
  'both',
  'both-codex',
  'both-grok',
  'both-claude',
  'both-agy',
  'external-both',
]);

/** Alias table for free-form host labels (lowercased before lookup). */
const HOST_FAMILY_ALIASES = Object.freeze(
  /** @type {Readonly<Record<string, HostFamily>>} */ ({
    claude: 'claude',
    'claude-code': 'claude',
    claude_code: 'claude',
    codex: 'codex',
    'openai-codex': 'codex',
    grok: 'grok',
    'grok-build': 'grok',
    grok_build: 'grok',
    agy: 'agy',
    antigravity: 'agy',
    'antigravity-cli': 'agy',
    cursor: 'cursor',
    unknown: 'unknown',
  }),
);

const AGY_ENV_SIGNALS = Object.freeze([
  'ANTIGRAVITY_AGENT',
  'ANTIGRAVITY_CONVERSATION_ID',
  'ANTIGRAVITY_APP_DATA_DIR',
  'AGY_SESSION_ID',
]);
const GROK_ENV_SIGNALS = Object.freeze(['GROK_SESSION_ID', 'GROK_WORKSPACE_ROOT']);
const CODEX_ENV_SIGNALS = Object.freeze(['CODEX_THREAD_ID']);
const CLAUDE_ENV_SIGNALS = Object.freeze(['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_PROJECT_DIR']);
const CURSOR_ENV_SIGNALS = Object.freeze(['CURSOR_TRACE_ID', 'CURSOR_SESSION_ID']);

/**
 * Normalize a free-form host label into a HostFamily.
 * @param {string | null | undefined} raw
 * @returns {HostFamily}
 */
export function normalizeHostFamily(raw) {
  if (raw == null || raw === '') return 'unknown';
  const s = String(raw).trim().toLowerCase();
  return HOST_FAMILY_ALIASES[s] ?? 'unknown';
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {readonly string[]} keys
 * @returns {boolean}
 */
function anyEnvSet(env, keys) {
  return keys.some((key) => Boolean(env[key]));
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {HostFamily}
 */
function familyFromEnvSignals(env) {
  if (anyEnvSet(env, AGY_ENV_SIGNALS)) return 'agy';
  if (anyEnvSet(env, GROK_ENV_SIGNALS)) return 'grok';
  if (anyEnvSet(env, CODEX_ENV_SIGNALS) || env.CODEX_CI === '1' || env.CODEX_CI === 'true') return 'codex';
  if (anyEnvSet(env, CLAUDE_ENV_SIGNALS)) return 'claude';
  if (anyEnvSet(env, CURSOR_ENV_SIGNALS)) return 'cursor';
  return 'unknown';
}

/**
 * Detect host family from explicit override + env-like bag (pure).
 * Detection order matches host-default-external.md.
 *
 * @param {{ explicitHost?: string | null, env?: Record<string, string | undefined> }} [input]
 * @returns {HostFamily}
 */
export function detectHostFamily(input = {}) {
  const env = input.env || {};
  if (input.explicitHost != null && String(input.explicitHost).trim() !== '') {
    return normalizeHostFamily(input.explicitHost);
  }
  if (env.ATOMIC_SKILLS_HOST != null && String(env.ATOMIC_SKILLS_HOST).trim() !== '') {
    return normalizeHostFamily(env.ATOMIC_SKILLS_HOST);
  }
  return familyFromEnvSignals(env);
}

/**
 * @param {HostFamily | string} hostFamily
 * @returns {'codex' | 'grok' | 'claude'}
 */
export function defaultExternalProvider(hostFamily) {
  const host = normalizeHostFamily(hostFamily);
  return HOST_EXTERNAL_DEFAULT[host] || 'codex';
}

/**
 * Whether an external provider id is the same model family as the host.
 * External providers: codex, grok, claude. `local` is never "same-family external".
 *
 * @param {HostFamily | string} hostFamily
 * @param {string} provider
 * @returns {boolean}
 */
export function isSameFamilyExternal(hostFamily, provider) {
  const host = normalizeHostFamily(hostFamily);
  const p = String(provider || '').toLowerCase();
  if (!EXTERNAL_PROVIDERS.has(p)) return false;
  return host === p;
}

/**
 * Family-different external legs in fixed order for external-both.
 * @param {HostFamily | string} hostFamily
 * @returns {Array<'codex' | 'grok' | 'claude' | 'agy'>}
 */
export function externalBothLegs(hostFamily) {
  return EXTERNAL_PROVIDER_ORDER.filter((p) => !isSameFamilyExternal(hostFamily, p));
}

/**
 * Accept-same-family flag from CLI-shaped options + env.
 * @param {{ acceptSameFamilyAsLocal?: boolean, env?: Record<string, string | undefined> }} [opts]
 */
export function acceptsSameFamilyAsLocal(opts = {}) {
  if (opts.acceptSameFamilyAsLocal === true) return true;
  const env = opts.env || {};
  const v = env.ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Resolve the primary external provider implied by a review mode + host.
 * Returns null for pure `local` mode (no external leg).
 *
 * @param {ReviewMode | string} mode
 * @param {HostFamily | string} hostFamily
 * @returns {'codex' | 'grok' | 'claude' | 'agy' | null}
 */
export function externalProviderForMode(mode, hostFamily) {
  const m = String(mode || '').toLowerCase();
  if (m === 'local') return null;
  if (m === 'codex' || m === 'both-codex') return 'codex';
  if (m === 'grok' || m === 'both-grok') return 'grok';
  if (m === 'claude' || m === 'both-claude') return 'claude';
  if (m === 'agy' || m === 'both-agy') return 'agy';
  if (m === 'both') return defaultExternalProvider(hostFamily);
  if (m === 'external-both') {
    const legs = externalBothLegs(hostFamily);
    return legs[0] ?? null; // first remaining leg after family filter
  }
  return undefined; // unknown mode — callers must abort (do not treat as local)
}

/**
 * @typedef {object} RouteResult
 * @property {'run' | 'abort' | 'confirm-same-family'} action
 * @property {ProviderId} [provider] - effective provider when action is run
 * @property {boolean} [sameFamilyRemap]
 * @property {boolean} [includesLocal] - true for both* modes that run local first
 * @property {'codex' | 'grok' | 'claude' | 'agy' | null} [externalProvider] - external leg if any
 * @property {Array<'codex' | 'grok' | 'claude' | 'agy'>} [externalProviders] - all external legs (external-both)
 * @property {'codex' | 'grok' | 'claude' | 'agy'} [crossFamilyAlternative]
 * @property {string} [message]
 * @property {HostFamily} hostFamily
 * @property {string} mode
 */

/**
 * @typedef {object} RouteInput
 * @property {HostFamily | string} [hostFamily]
 * @property {string} [explicitHost]
 * @property {Record<string, string | undefined>} [env]
 * @property {ReviewMode | string} [mode]
 * @property {boolean} [interactive] - TTY / ask_user available
 * @property {boolean} [acceptSameFamilyAsLocal]
 * @property {'confirm' | 'decline' | 'offer-cross-family' | null | ''} [sameFamilyDecision]
 *        Required after a confirm-same-family pause when re-entering the helper.
 */

/**
 * @typedef {object} RunFields
 * @property {ProviderId} provider
 * @property {boolean} sameFamilyRemap
 * @property {boolean} includesLocal
 * @property {'codex' | 'grok' | 'claude' | 'agy' | null} externalProvider
 * @property {Array<'codex' | 'grok' | 'claude' | 'agy'>} [externalProviders]
 * @property {HostFamily} hostFamily
 * @property {string} mode
 */

/**
 * @typedef {object} AbortFields
 * @property {string} message
 * @property {'codex' | 'grok' | 'claude' | 'agy'} [crossFamilyAlternative]
 * @property {HostFamily} hostFamily
 * @property {string} mode
 * @property {'codex' | 'grok' | 'claude' | 'agy' | null} [externalProvider]
 */

const LOCAL_AND_EXTERNAL_MODES = new Set(['both', 'both-codex', 'both-grok', 'both-claude', 'both-agy']);

/**
 * @param {RunFields} fields
 * @returns {RouteResult}
 */
function runResult(fields) {
  if (fields.externalProviders) {
    return {
      action: 'run',
      provider: fields.provider,
      sameFamilyRemap: fields.sameFamilyRemap,
      includesLocal: fields.includesLocal,
      externalProvider: fields.externalProvider,
      externalProviders: fields.externalProviders,
      hostFamily: fields.hostFamily,
      mode: fields.mode,
    };
  }
  return {
    action: 'run',
    provider: fields.provider,
    sameFamilyRemap: fields.sameFamilyRemap,
    includesLocal: fields.includesLocal,
    externalProvider: fields.externalProvider,
    hostFamily: fields.hostFamily,
    mode: fields.mode,
  };
}

/**
 * @param {AbortFields} fields
 * @returns {RouteResult}
 */
function abortResult(fields) {
  return {
    action: 'abort',
    message: fields.message,
    ...(fields.crossFamilyAlternative ? { crossFamilyAlternative: fields.crossFamilyAlternative } : {}),
    hostFamily: fields.hostFamily,
    mode: fields.mode,
    externalProvider: fields.externalProvider ?? null,
  };
}

/**
 * @param {HostFamily} hostFamily
 * @param {string} mode
 * @returns {RouteResult}
 */
function localSameFamilyRemap(hostFamily, mode) {
  return runResult({
    provider: 'local',
    sameFamilyRemap: true,
    includesLocal: true,
    externalProvider: null,
    hostFamily,
    mode,
  });
}

/**
 * @param {RouteInput} input
 * @returns {{ hostFamily: HostFamily, mode: string, interactive: boolean, acceptFlag: boolean }}
 */
function routeContext(input) {
  const env = input.env || {};
  const hostFamily = input.hostFamily
    ? normalizeHostFamily(input.hostFamily)
    : detectHostFamily({ explicitHost: input.explicitHost, env });
  return {
    hostFamily,
    mode: String(input.mode || 'both').toLowerCase(),
    interactive: input.interactive === true,
    acceptFlag: acceptsSameFamilyAsLocal({
      acceptSameFamilyAsLocal: input.acceptSameFamilyAsLocal,
      env,
    }),
  };
}

/**
 * external-both with no family-different leg left after filtering.
 *
 * @param {object} fields
 * @param {RouteInput} fields.input
 * @param {boolean} fields.acceptFlag
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.crossFamilyAlternative
 * @param {HostFamily} fields.hostFamily
 * @param {string} fields.mode
 * @param {boolean} fields.interactive
 * @returns {RouteResult}
 */
function externalBothNoLegsRoute(fields) {
  const { input, acceptFlag, crossFamilyAlternative, hostFamily, mode, interactive } = fields;
  const decision = input.sameFamilyDecision;
  if (interactive && (decision == null || decision === '')) {
    return {
      action: 'confirm-same-family',
      message:
        'external-both has no family-different provider for this host. Confirm sealed local, or abort.',
      crossFamilyAlternative,
      hostFamily,
      mode,
      externalProvider: null,
      externalProviders: [],
    };
  }
  if ((interactive && decision === 'confirm') || acceptFlag) {
    return localSameFamilyRemap(hostFamily, mode);
  }
  return abortResult({
    message:
      'HARD ABORT: external-both has no family-different provider for this host. ' +
      'Use --accept-same-family-as-local for sealed local, or pick a single cross-family mode.',
    crossFamilyAlternative,
    hostFamily,
    mode,
    externalProvider: null,
  });
}

/**
 * external-both: run every leg left after filtering the same-family one.
 *
 * @param {object} fields
 * @param {RouteInput} fields.input
 * @param {boolean} fields.acceptFlag
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.crossFamilyAlternative
 * @param {HostFamily} fields.hostFamily
 * @param {string} fields.mode
 * @param {boolean} fields.interactive
 * @param {Array<'codex' | 'grok' | 'claude' | 'agy'>} fields.legs
 * @returns {RouteResult}
 */
function externalBothRoute(fields) {
  const { legs, hostFamily, mode } = fields;
  if (legs.length === 0) return externalBothNoLegsRoute(fields);
  return runResult({
    provider: legs[0],
    sameFamilyRemap: false,
    includesLocal: false,
    externalProvider: legs[0],
    externalProviders: legs,
    hostFamily,
    mode,
  });
}

/**
 * @param {object} fields
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.externalProvider
 * @param {HostFamily} fields.hostFamily
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.crossFamilyAlternative
 * @returns {string}
 */
function sameFamilyAbortMessage(fields) {
  const { externalProvider, hostFamily, crossFamilyAlternative } = fields;
  return `HARD ABORT: requested external provider "${externalProvider}" is the same model family ` +
    `as host "${hostFamily}". Same-family is not cross-model review. ` +
    `Use the cross-family default "${crossFamilyAlternative}", mode=local, ` +
    `or pass --accept-same-family-as-local (env ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1) ` +
    `to run the sealed local path (records provider:local, sameFamilyRemap:true; does not count as CROSS-MODEL REVIEW).`;
}

/**
 * Interactive answer to a same-family external request.
 *
 * @param {object} fields
 * @param {RouteInput} fields.input
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.externalProvider
 * @param {HostFamily} fields.hostFamily
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.crossFamilyAlternative
 * @param {boolean} fields.includesLocal
 * @param {string} fields.mode
 * @returns {RouteResult}
 */
function interactiveSameFamilyRoute(fields) {
  const { input, externalProvider, hostFamily, crossFamilyAlternative, includesLocal, mode } = fields;
  const decision = input.sameFamilyDecision;
  if (decision == null || decision === '') {
    return {
      action: 'confirm-same-family',
      provider: externalProvider,
      sameFamilyRemap: false,
      includesLocal,
      externalProvider,
      crossFamilyAlternative,
      message:
        `Same-family external (${externalProvider} on host ${hostFamily}) is equivalent to a ` +
        `clean local review agent, not cross-model review. Confirm to run local, decline to abort, ` +
        `or switch to cross-family provider ${crossFamilyAlternative}.`,
      hostFamily,
      mode,
    };
  }
  if (decision === 'confirm') return localSameFamilyRemap(hostFamily, mode);
  if (decision === 'offer-cross-family') {
    return runResult({
      provider: crossFamilyAlternative,
      sameFamilyRemap: false,
      includesLocal,
      externalProvider: crossFamilyAlternative,
      hostFamily,
      mode,
    });
  }
  return abortResult({
    message: `Aborted: same-family external ${externalProvider} declined. Cross-family alternative: ${crossFamilyAlternative}.`,
    crossFamilyAlternative,
    hostFamily,
    mode,
    externalProvider,
  });
}

/**
 * A same-family external was requested: confirm/remap, or abort.
 *
 * @param {object} fields
 * @param {RouteInput} fields.input
 * @param {boolean} fields.acceptFlag
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.externalProvider
 * @param {HostFamily} fields.hostFamily
 * @param {'codex' | 'grok' | 'claude' | 'agy'} fields.crossFamilyAlternative
 * @param {boolean} fields.includesLocal
 * @param {string} fields.mode
 * @param {boolean} fields.interactive
 * @returns {RouteResult}
 */
function sameFamilyRoute(fields) {
  const { input, acceptFlag, externalProvider, hostFamily, crossFamilyAlternative, includesLocal, mode, interactive } = fields;
  if (interactive) return interactiveSameFamilyRoute({ input, externalProvider, hostFamily, crossFamilyAlternative, includesLocal, mode });
  if (acceptFlag) return localSameFamilyRemap(hostFamily, mode);
  return abortResult({
    message: sameFamilyAbortMessage({ externalProvider, hostFamily, crossFamilyAlternative }),
    crossFamilyAlternative,
    hostFamily,
    mode,
    externalProvider,
  });
}

/**
 * Route a review invocation through the host≠reviewer matrix and same-family rules.
 *
 * @param {RouteInput} input
 * @returns {RouteResult}
 */
export function resolveReviewRoute(input) {
  const { hostFamily, mode, interactive, acceptFlag } = routeContext(input);

  if (!REVIEW_MODES.includes(mode)) {
    return abortResult({
      message:
        `HARD ABORT: unknown review mode "${mode}". ` +
        `Valid modes: ${REVIEW_MODES.join(', ')}.`,
      hostFamily,
      mode,
    });
  }

  const includesLocal = LOCAL_AND_EXTERNAL_MODES.has(mode);
  const externalProvider = externalProviderForMode(mode, hostFamily);
  const crossFamilyAlternative = defaultExternalProvider(hostFamily);

  if (mode === 'local') {
    return runResult({
      provider: 'local',
      sameFamilyRemap: false,
      includesLocal: true,
      externalProvider: null,
      hostFamily,
      mode,
    });
  }

  if (mode === 'external-both') {
    return externalBothRoute({
      input,
      acceptFlag,
      crossFamilyAlternative,
      hostFamily,
      mode,
      interactive,
      legs: externalBothLegs(hostFamily),
    });
  }

  if (!isSameFamilyExternal(hostFamily, externalProvider)) {
    return runResult({
      provider: /** @type {'codex' | 'grok' | 'claude' | 'agy'} */ (externalProvider),
      sameFamilyRemap: false,
      includesLocal,
      externalProvider,
      hostFamily,
      mode,
    });
  }

  return sameFamilyRoute({
    input,
    acceptFlag,
    externalProvider: /** @type {'codex' | 'grok' | 'claude' | 'agy'} */ (externalProvider),
    hostFamily,
    crossFamilyAlternative,
    includesLocal,
    mode,
    interactive,
  });
}
