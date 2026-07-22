/**
 * Pure phase-done review mode picker (design D5 / F2 T-007 / F3).
 *
 * Single definition shared by project-transitions phase-done review gate
 * and implement automate spine. No I/O.
 *
 * Precedence:
 * 1. Resolve automate via `automateActive === true` OR `isAutomateActive`
 *    (`planExecutionMode` / `cliMode` / `clearExecutionMode`). Stamp alone
 *    (`planExecutionMode: 'automate'`) → automate → `both` (fail-closed F3).
 * 2. explicitOverride ∈ {local, both, skip}:
 *    - Under automate, `local` | `skip` are **never** honored — always `both`
 *      (mandatory cross-model phase review; reason cannot open a skip).
 *    - Non-automate: `skip` is full skip; `local` is downgrade from `both`.
 * 3. else if automate → `both` regardless of destructive
 * 4. else if destructive → `both` else `local` (non-automate DESTRUCTIVE ladder)
 */

import { isAutomateActive } from './implement-mode.js';

/** @typedef {'local' | 'both' | 'skip'} PhaseReviewMode */

/**
 * Known phase-done review mode tokens.
 * @type {readonly PhaseReviewMode[]}
 */
export const PHASE_REVIEW_MODES = Object.freeze(['local', 'both', 'skip']);

const MODE_SET = new Set(PHASE_REVIEW_MODES);

/**
 * Normalize an explicit override token.
 * @param {unknown} raw
 * @returns {PhaseReviewMode | null}
 */
function normalizeOverride(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === '') return null;
  if (MODE_SET.has(/** @type {PhaseReviewMode} */ (s))) {
    return /** @type {PhaseReviewMode} */ (s);
  }
  return null;
}

/**
 * Resolve whether automate review cadence applies (fail-closed on stamp).
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   modeExplicit?: boolean,
 * }} input
 * @returns {boolean}
 */
function resolveAutomate(input) {
  if (input.automateActive === true) return true;
  return isAutomateActive({
    cliMode: input.cliMode,
    planExecutionMode: input.planExecutionMode,
    clearExecutionMode: input.clearExecutionMode,
  });
}

/**
 * Pick phase-done `review-code` mode under automate vs non-automate.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   destructive?: boolean | null,
 *   explicitOverride?: string | null,
 *   overrideReason?: string | null,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   modeExplicit?: boolean,
 * }} [input]
 * @returns {PhaseReviewMode}
 */
export function phaseReviewMode(input = {}) {
  const automate = resolveAutomate(input);
  const override = normalizeOverride(input.explicitOverride);

  if (override != null) {
    if (automate && (override === 'local' || override === 'skip')) {
      // Mandatory review under automate: reason cannot downgrade or skip.
      return 'both';
    }
    return override;
  }

  if (automate) {
    return 'both';
  }

  if (input.destructive === true) {
    return 'both';
  }

  return 'local';
}
