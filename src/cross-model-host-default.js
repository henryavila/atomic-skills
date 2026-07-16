/**
 * Pure host → external-reviewer routing for cross-model-bridge (design D6/D7).
 *
 * No I/O. Callers supply already-detected host signals, interactivity, and flags.
 * Skill bodies and F3 mode pickers should call this helper (or mirror its table)
 * rather than re-deriving same-family rules ad hoc.
 */

/** @typedef {'claude' | 'codex' | 'grok' | 'cursor' | 'unknown'} HostFamily */
/** @typedef {'local' | 'codex' | 'grok'} ProviderId */
/** @typedef {'local' | 'codex' | 'grok' | 'both' | 'both-codex' | 'both-grok' | 'external-both'} ReviewMode */

export const HOST_FAMILIES = Object.freeze(['claude', 'codex', 'grok', 'cursor', 'unknown']);

/** External default when mode is `both` or when resolving the host default provider. */
export const HOST_EXTERNAL_DEFAULT = Object.freeze({
  grok: 'codex',
  codex: 'grok',
  claude: 'codex',
  cursor: 'codex',
  unknown: 'codex',
});

const EXTERNAL_PROVIDERS = new Set(['codex', 'grok']);

/** Modes accepted by resolveReviewRoute — unknown values abort (no silent local). */
export const REVIEW_MODES = Object.freeze([
  'local',
  'codex',
  'grok',
  'both',
  'both-codex',
  'both-grok',
  'external-both',
]);

/**
 * Normalize a free-form host label into a HostFamily.
 * @param {string | null | undefined} raw
 * @returns {HostFamily}
 */
export function normalizeHostFamily(raw) {
  if (raw == null || raw === '') return 'unknown';
  const s = String(raw).trim().toLowerCase();
  if (s === 'claude' || s === 'claude-code' || s === 'claude_code') return 'claude';
  if (s === 'codex' || s === 'openai-codex') return 'codex';
  if (s === 'grok' || s === 'grok-build' || s === 'grok_build') return 'grok';
  if (s === 'cursor') return 'cursor';
  if (s === 'unknown') return 'unknown';
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
  if (env.GROK_SESSION_ID || env.GROK_WORKSPACE_ROOT) return 'grok';
  if (env.CODEX_THREAD_ID || env.CODEX_CI === '1' || env.CODEX_CI === 'true') return 'codex';
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_PROJECT_DIR) return 'claude';
  if (env.CURSOR_TRACE_ID || env.CURSOR_SESSION_ID) return 'cursor';
  return 'unknown';
}

/**
 * @param {HostFamily | string} hostFamily
 * @returns {'codex' | 'grok'}
 */
export function defaultExternalProvider(hostFamily) {
  const host = normalizeHostFamily(hostFamily);
  return HOST_EXTERNAL_DEFAULT[host] || 'codex';
}

/**
 * Whether an external provider id is the same model family as the host.
 * Only `codex` and `grok` are external providers; `local` is never "same-family external".
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
 * @returns {'codex' | 'grok' | null}
 */
export function externalProviderForMode(mode, hostFamily) {
  const m = String(mode || '').toLowerCase();
  if (m === 'local') return null;
  if (m === 'codex' || m === 'both-codex') return 'codex';
  if (m === 'grok' || m === 'both-grok') return 'grok';
  if (m === 'both') return defaultExternalProvider(hostFamily);
  if (m === 'external-both') return 'codex'; // first leg; second is always grok
  return undefined; // unknown mode — callers must abort (do not treat as local)
}

/**
 * @typedef {object} RouteResult
 * @property {'run' | 'abort' | 'confirm-same-family'} action
 * @property {ProviderId} [provider] - effective provider when action is run
 * @property {boolean} [sameFamilyRemap]
 * @property {boolean} [includesLocal] - true for both* modes that run local first
 * @property {'codex' | 'grok' | null} [externalProvider] - external leg if any
 * @property {'codex' | 'grok'} [crossFamilyAlternative]
 * @property {string} [message]
 * @property {HostFamily} hostFamily
 * @property {string} mode
 */

/**
 * Route a review invocation through the host≠reviewer matrix and same-family rules.
 *
 * @param {object} input
 * @param {HostFamily | string} [input.hostFamily]
 * @param {string} [input.explicitHost]
 * @param {Record<string, string | undefined>} [input.env]
 * @param {ReviewMode | string} input.mode
 * @param {boolean} [input.interactive] - TTY / ask_user available
 * @param {boolean} [input.acceptSameFamilyAsLocal]
 * @param {'confirm' | 'decline' | 'offer-cross-family' | null} [input.sameFamilyDecision]
 *        Required after a confirm-same-family pause when re-entering the helper.
 * @returns {RouteResult}
 */
export function resolveReviewRoute(input) {
  const env = input.env || {};
  const hostFamily = input.hostFamily
    ? normalizeHostFamily(input.hostFamily)
    : detectHostFamily({ explicitHost: input.explicitHost, env });
  const mode = String(input.mode || 'both').toLowerCase();
  const interactive = input.interactive === true;
  const acceptFlag = acceptsSameFamilyAsLocal({
    acceptSameFamilyAsLocal: input.acceptSameFamilyAsLocal,
    env,
  });

  if (!REVIEW_MODES.includes(mode)) {
    return {
      action: 'abort',
      message:
        `HARD ABORT: unknown review mode "${mode}". ` +
        `Valid modes: ${REVIEW_MODES.join(', ')}.`,
      hostFamily,
      mode,
      externalProvider: null,
    };
  }

  const includesLocal = mode === 'both' || mode === 'both-codex' || mode === 'both-grok';
  const externalProvider = externalProviderForMode(mode, hostFamily);
  const crossFamilyAlternative = defaultExternalProvider(hostFamily);

  if (mode === 'local') {
    return {
      action: 'run',
      provider: 'local',
      sameFamilyRemap: false,
      includesLocal: true,
      externalProvider: null,
      hostFamily,
      mode,
    };
  }

  // external-both: filter same-family legs (Codex host drops codex; Grok drops grok).
  if (mode === 'external-both') {
    const legs = ['codex', 'grok'].filter((p) => !isSameFamilyExternal(hostFamily, p));
    if (legs.length === 0) {
      if (interactive && (input.sameFamilyDecision == null || input.sameFamilyDecision === '')) {
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
      if (interactive && input.sameFamilyDecision === 'confirm') {
        return {
          action: 'run',
          provider: 'local',
          sameFamilyRemap: true,
          includesLocal: true,
          externalProvider: null,
          hostFamily,
          mode,
        };
      }
      if (acceptFlag) {
        return {
          action: 'run',
          provider: 'local',
          sameFamilyRemap: true,
          includesLocal: true,
          externalProvider: null,
          hostFamily,
          mode,
        };
      }
      return {
        action: 'abort',
        message:
          'HARD ABORT: external-both has no family-different provider for this host. ' +
          'Use --accept-same-family-as-local for sealed local, or pick a single cross-family mode.',
        crossFamilyAlternative,
        hostFamily,
        mode,
        externalProvider: null,
      };
    }
    return {
      action: 'run',
      provider: legs[0],
      sameFamilyRemap: false,
      includesLocal: false,
      externalProvider: legs[0],
      externalProviders: legs,
      hostFamily,
      mode,
    };
  }

  if (!isSameFamilyExternal(hostFamily, externalProvider)) {
    return {
      action: 'run',
      provider: externalProvider,
      sameFamilyRemap: false,
      includesLocal,
      externalProvider,
      hostFamily,
      mode,
    };
  }

  // Same-family external requested.
  const abortMessage =
    `HARD ABORT: requested external provider "${externalProvider}" is the same model family ` +
    `as host "${hostFamily}". Same-family is not cross-model review. ` +
    `Use the cross-family default "${crossFamilyAlternative}", mode=local, ` +
    `or pass --accept-same-family-as-local (env ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1) ` +
    `to run the sealed local path (records provider:local, sameFamilyRemap:true; does not count as CROSS-MODEL REVIEW).`;

  if (interactive) {
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
    if (decision === 'confirm') {
      return {
        action: 'run',
        provider: 'local',
        sameFamilyRemap: true,
        includesLocal: true,
        externalProvider: null,
        hostFamily,
        mode,
      };
    }
    if (decision === 'offer-cross-family') {
      return {
        action: 'run',
        provider: crossFamilyAlternative,
        sameFamilyRemap: false,
        includesLocal,
        externalProvider: crossFamilyAlternative,
        hostFamily,
        mode,
      };
    }
    // decline
    return {
      action: 'abort',
      message: `Aborted: same-family external ${externalProvider} declined. Cross-family alternative: ${crossFamilyAlternative}.`,
      crossFamilyAlternative,
      hostFamily,
      mode,
      externalProvider,
    };
  }

  // Non-interactive
  if (acceptFlag) {
    return {
      action: 'run',
      provider: 'local',
      sameFamilyRemap: true,
      includesLocal: true,
      externalProvider: null,
      hostFamily,
      mode,
    };
  }

  return {
    action: 'abort',
    message: abortMessage,
    crossFamilyAlternative,
    hostFamily,
    mode,
    externalProvider,
  };
}
