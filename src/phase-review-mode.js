/**
 * Pure phase-done review mode picker (design D5 / F2 T-007).
 *
 * Single definition shared by project-transitions phase-done review gate
 * and implement automate spine. No I/O.
 *
 * Precedence:
 * 1. explicitOverride ∈ {local, both, skip} → that value
 *    - `skip` is the only full skip (record as --skip-review)
 *    - `local` is a downgrade from `both`, not a skip — still runs local review
 * 2. else if automateActive → `both` regardless of destructive
 * 3. else if destructive → `both` else `local` (non-automate DESTRUCTIVE ladder)
 */

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
 * Pick phase-done `review-code` mode under automate vs non-automate.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   destructive?: boolean | null,
 *   explicitOverride?: string | null,
 * }} [input]
 * @returns {PhaseReviewMode}
 */
export function phaseReviewMode(input = {}) {
  const override = normalizeOverride(input.explicitOverride);
  if (override != null) {
    return override;
  }

  if (input.automateActive === true) {
    return 'both';
  }

  if (input.destructive === true) {
    return 'both';
  }

  return 'local';
}
