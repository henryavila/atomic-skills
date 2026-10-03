/**
 * Pure plan-end review and user-validation predicates (design D7, D9, D12, F2/P4).
 *
 * planEndReviewOk =
 *   receipt exists
 *   AND (
 *     (
 *       count(succeeded family-different external legs) ≥ 1
 *       AND non-empty reviewFile
 *       AND mode is 'external-both' only (F5 — not bare 'both')
 *       AND non-empty verifiedAt (ISO preferred / Date.parse finite)
 *       AND (when forbidSkip/durableAutomate: non-empty intentVsDelivered rows
 *            with status matched|partial|missing|extra — F2 intent-vs-delivered)
 *     )
 *     OR (NOT forbidSkip AND explicit skipPlanEndReview with non-empty reason)
 *   )
 *
 * Under durable automate (`forbidSkip: true` / `automatePlanEndGatesOk`), the
 * skip path is HARD-CLOSED: review is mandatory. Agent- or operator-skips with
 * only a free-text reason cannot open finalize/archive while the stamp holds.
 * Empty or missing `intentVsDelivered` also HARD-BLOCKs under automate
 * (session default via automateActive **or** stamp) — generic external-both
 * without intent-vs-delivered does not satisfy plan-end.
 *
 * A leg counts ONLY when ALL of:
 *   - status === 'succeeded'
 *   - familyDifferent === true (strict boolean; missing is NOT true)
 *   - provider is a known external ('codex' | 'grok' | 'claude')
 *
 * userValidationOk: under automateActive === true, require a non-empty
 * ISO-8601-ish timestamp in userValidatedAt. When automate is not active
 * the gate does not apply (returns true). Stamp alone also activates via
 * durable plan-end resolution. Operator-owned — never auto-stamped by review.
 *
 * automatePlanEndGatesOk durable HARD-BLOCK (F4): uses **stamp only**:
 *   durableAutomate = planExecutionMode === 'automate' OR automateActive === true
 * Session cliMode / clearExecutionMode do NOT disable finalize/archive gates
 * while the stamp remains automate. To leave the durable gate, call
 * `clearExecutionModeStamp` (remove stamp). Session `isAutomateActive` remains
 * for the maestro coding loop only — finalize/archive MUST use
 * `isDurableAutomateActive` (not session isAutomateActive alone).
 *
 * Finalize/archive under automate HARD-BLOCK unless BOTH planEndReviewOk
 * and userValidationOk are true (see automatePlanEndGatesOk). Receipt files
 * land under `.atomic-skills/reviews/` and are linked from the plan
 * `## Reviews` section; frontmatter may carry a machine-readable
 * `planEndReview` object (finalize-shaped receipt) plus `userValidatedAt`.
 *
 * No I/O.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { EXTERNAL_PROVIDER_ORDER } from './cross-model-host-default.js';
import { INTENT_VS_DELIVERED_STATUSES } from './plan-end-intent-surface.js';

/**
 * Family-different external providers that count toward planEndReviewOk.
 * Single source: EXTERNAL_PROVIDER_ORDER (codex → grok → claude) — never `local`.
 */
export const KNOWN_EXTERNAL_PROVIDERS = EXTERNAL_PROVIDER_ORDER;

const KNOWN_EXTERNAL_PROVIDER_SET = new Set(KNOWN_EXTERNAL_PROVIDERS);

/** Modes accepted on a non-skip plan-end receipt (F5: external-both only). */
const PLAN_END_OK_MODES = new Set(['external-both']);

/** Receipt row statuses for intent-vs-delivered (F2). */
const INTENT_VS_DELIVERED_STATUS_SET = new Set(INTENT_VS_DELIVERED_STATUSES);

/** Re-export for gate callers / assert formatters. */
export { INTENT_VS_DELIVERED_STATUSES };

/**
 * Guided `--skip-plan-end-review` reason taxonomy (non-empty required).
 * Operators may use free-form reasons; these tokens are the recommended
 * vocabulary when zero family-different providers remain or residual risk
 * is accepted — never strand a plan without a durable reason.
 */
export const SKIP_PLAN_END_REASON_TAXONOMY = Object.freeze([
  'no-family-different-provider',
  'external-providers-unavailable',
  'operator-accepted-residual-risk',
  'single-external-leg-already-reviewed-at-phase',
]);

/**
 * Basic ISO-8601-ish: full date (YYYY-MM-DD) optionally with time (T...).
 * Rejects bare words like "ok"/"yes" and pure numeric strings.
 */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]+)?$/;

/**
 * @typedef {{
 *   provider?: 'codex' | 'grok' | string,
 *   status: 'succeeded' | 'failed' | 'skipped' | string,
 *   familyDifferent?: boolean,
 * }} PlanEndReviewLeg
 *
 * @typedef {{
 *   id?: string,
 *   label?: string,
 *   status: 'matched' | 'partial' | 'missing' | 'extra' | string,
 *   intentId?: string,
 *   deliveredId?: string,
 *   note?: string,
 * }} IntentVsDeliveredRow
 *
 * Finalize-shaped receipt: durable machine fields plus optional metadata
 * written by finalize/plan-end (`reviewFile`, `mode`, `range`, `verifiedAt`,
 * `intentVsDelivered`). Extra keys are ignored by planEndReviewOk.
 *
 * @typedef {{
 *   legs?: PlanEndReviewLeg[],
 *   skipPlanEndReview?: boolean,
 *   skipReason?: string,
 *   reviewFile?: string,
 *   mode?: string,
 *   range?: string,
 *   verifiedAt?: string,
 *   intentVsDelivered?: IntentVsDeliveredRow[] | null,
 * }} PlanEndReviewReceipt
 */

/**
 * Whether a single external review leg counts toward planEndReviewOk.
 * Fail-closed: requires succeeded + familyDifferent === true + known external provider.
 * @param {PlanEndReviewLeg | null | undefined} leg
 * @returns {boolean}
 */
function legCountsAsSucceededFamilyDifferent(leg) {
  if (leg == null || typeof leg !== 'object') return false;
  if (leg.status !== 'succeeded') return false;
  if (leg.familyDifferent !== true) return false;
  const provider = leg.provider != null ? String(leg.provider).trim().toLowerCase() : '';
  if (!KNOWN_EXTERNAL_PROVIDER_SET.has(provider)) return false;
  return true;
}

/**
 * Non-skip success path requires durable receipt shape fields.
 * @param {PlanEndReviewReceipt} receipt
 * @returns {boolean}
 */
function receiptShapeOk(receipt) {
  const reviewFile =
    receipt.reviewFile != null ? String(receipt.reviewFile).trim() : '';
  if (reviewFile === '') return false;

  const mode =
    receipt.mode != null ? String(receipt.mode).trim().toLowerCase() : '';
  if (!PLAN_END_OK_MODES.has(mode)) return false;

  const verifiedAt =
    receipt.verifiedAt != null ? String(receipt.verifiedAt).trim() : '';
  if (verifiedAt === '') return false;
  // ISO preferred; accept non-empty with finite Date.parse (v1).
  if (isIsoTimestamp(verifiedAt)) return true;
  return Number.isFinite(Date.parse(verifiedAt));
}

/**
 * Machine-checkable intent-vs-delivered section on the plan-end receipt (F2).
 *
 * Under automate, a non-empty array of rows is required; each row must carry
 * status ∈ {matched, partial, missing, extra}. Empty array, missing field,
 * non-array, or unknown status ⇒ fail closed.
 *
 * Outside automate this helper is optional (planEndReviewOk only calls it when
 * forbidSkip/durableAutomate is set).
 *
 * @param {unknown} rows
 * @returns {boolean}
 */
export function intentVsDeliveredOk(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  for (const row of rows) {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) {
      return false;
    }
    const status =
      /** @type {{ status?: unknown }} */ (row).status != null
        ? String(/** @type {{ status?: unknown }} */ (row).status)
            .trim()
            .toLowerCase()
        : '';
    if (!INTENT_VS_DELIVERED_STATUS_SET.has(status)) return false;
  }
  return true;
}

/**
 * Machine-checkable plan-end external review predicate (HARD-BLOCK finalize/archive).
 *
 * Accepts a bare receipt or a finalize-shaped object.
 * CLI flag name in skill prose: `--skip-plan-end-review` maps to
 * `skipPlanEndReview: true` + non-empty `skipReason` on the durable receipt.
 * **Under durable automate that skip is ignored** (`forbidSkip: true`).
 *
 * Non-skip path requires ≥1 succeeded family-different known-provider leg
 * AND non-empty reviewFile + mode === 'external-both' + non-empty verifiedAt.
 * Under automate (forbidSkip/durableAutomate): also requires non-empty
 * `intentVsDelivered` rows with status matched|partial|missing|extra.
 * Skip path (non-automate only): skipPlanEndReview + non-empty reason.
 *
 * @param {PlanEndReviewReceipt | null | undefined} receipt
 * @param {{
 *   forbidSkip?: boolean,
 *   durableAutomate?: boolean,
 * }} [opts] When `forbidSkip` or `durableAutomate` is true, skipPlanEndReview
 *   never counts as ok (automate mandatory review) and intentVsDelivered is
 *   required (F2 intent-vs-delivered).
 * @returns {boolean}
 */
export function planEndReviewOk(receipt, opts = {}) {
  if (receipt == null || typeof receipt !== 'object') {
    return false;
  }

  const forbidSkip =
    opts.forbidSkip === true || opts.durableAutomate === true;

  if (receipt.skipPlanEndReview === true) {
    if (forbidSkip) {
      return false;
    }
    const reason = receipt.skipReason;
    if (reason != null && String(reason).trim() !== '') {
      return true;
    }
  }

  const legs = Array.isArray(receipt.legs) ? receipt.legs : [];
  const succeededCount = legs.filter(legCountsAsSucceededFamilyDifferent).length;
  if (succeededCount >= 1 && receiptShapeOk(receipt)) {
    // F2: under automate, intent-vs-delivered section is mandatory.
    if (forbidSkip && !intentVsDeliveredOk(receipt.intentVsDelivered)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Whether a string is a usable ISO-8601-ish timestamp for userValidatedAt.
 * @param {string} s
 * @returns {boolean}
 */
function isIsoTimestamp(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed === '') return false;
  if (!ISO_TIMESTAMP_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
}

/**
 * Resolve whether durable automate plan-end gates apply (F4).
 *
 * Durable HARD-BLOCK uses **stamp only** (plus legacy automateActive flag):
 *   durableAutomate =
 *     automateActive === true
 *     OR planExecutionMode === 'automate'
 *
 * Session cliMode / clearExecutionMode are IGNORED for finalize/archive.
 * To leave the durable gate: `clearExecutionModeStamp` must remove the stamp.
 * Session `isAutomateActive` remains for the maestro coding loop.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} input
 * @returns {boolean}
 */
/**
 * Durable automate for finalize/archive HARD-BLOCK (stamp-first).
 * Exported so skill prose and gates share one definition — never early-exit
 * finalize on session `isAutomateActive` alone while the stamp remains.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateActive(input = {}) {
  if (input.automateActive === true) {
    return true;
  }
  const stamp =
    input.planExecutionMode != null
      ? String(input.planExecutionMode).trim().toLowerCase()
      : '';
  return stamp === 'automate';
}

/** @deprecated use isDurableAutomateActive — same predicate */
function resolveDurableAutomateForGates(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * Operator validation gate before finalize/archive under automate.
 *
 * When automate is not active, returns true (gate does not apply).
 * Activation: automateActive === true, OR durable stamp planExecutionMode
 * automate (session CLI override does not disable — F4). Under automate,
 * userValidatedAt must be a non-empty ISO-8601-ish timestamp.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function userValidationOk(input = {}) {
  if (!resolveDurableAutomateForGates(input)) {
    return true;
  }

  const at = input.userValidatedAt;
  if (at == null) return false;
  if (typeof at !== 'string') return false;
  return isIsoTimestamp(at) && authenticatedEvidence.has(input.userValidationEvidence)
    && input.userValidationEvidence.at === at;
}

/**
 * Combined finalize/archive gate under automate (design D7 + D9 + D12 / F4).
 *
 * When durable automate is not active, both sub-gates are inactive → ok: true.
 * Under durable automate (automateActive or stamp automate — **ignore** session
 * cliMode/clear for this gate), HARD-BLOCK unless planEndReviewOk(receipt,
 * { forbidSkip: true }) AND userValidationOk. Skip-with-reason cannot open
 * finalize/archive while the stamp remains.
 *
 * @param {{
 *   automateActive?: boolean,
 *   planExecutionMode?: string | null,
 *   cliMode?: string | null,
 *   clearExecutionMode?: boolean,
 *   receipt?: PlanEndReviewReceipt | null,
 *   userValidatedAt?: string | null,
 *   validatorId?: string | null,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   planEndReviewOk: boolean,
 *   userValidationOk: boolean,
 *   reviewSkipForbidden?: boolean,
 * }}
 */
export function automatePlanEndGatesOk(input = {}) {
  if (!resolveDurableAutomateForGates(input)) {
    return {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
      reviewSkipForbidden: false,
    };
  }

  // Mandatory external-both under durable automate — no skipPlanEndReview path.
  const pe = planEndReviewOk(input.receipt, { forbidSkip: true });
  const uv = userValidationOk({
    automateActive: true,
    userValidatedAt: input.userValidatedAt,
    validatorId: input.validatorId,
    userValidationEvidence: input.userValidationEvidence,
  });
  return {
    ok: pe && uv,
    planEndReviewOk: pe,
    userValidationOk: uv,
    reviewSkipForbidden: true,
  };
}


// Server authority lives outside the repository; copying a timestamp or a receipt
// cannot mint evidence. Only disk-authenticated objects enter this WeakSet.
const authenticatedEvidence = new WeakSet();
function validationKeyPath(planPath) {
  const identity = createHash('sha256').update(realpathSync(planPath)).digest('hex');
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.atomic-skills', 'final-page-keys', identity);
}
export function readFinalPlan(planPath) {
  const text = readFileSync(planPath, 'utf8');
  if (Buffer.byteLength(text) > 2_000_000) throw new Error('plan exceeds size cap');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('invalid plan frontmatter');
  const fm = parseYaml(match[1]);
  if (!fm || typeof fm !== 'object') throw new Error('invalid plan');
  return { text, fm };
}
export function finalAuditsPassed(planPath) {
  try {
    const {fm} = readFinalPlan(planPath);
    return Array.isArray(fm.phases) && fm.phases.length > 0 && fm.phases.every(p => p && p.deliveryAuditGate?.status === 'passed');
  } catch { return false; }
}
function validationSnapshot(planPath) {
  const {text, fm} = readFinalPlan(planPath);
  const hash = createHash('sha256').update(text.replace(/^userValidatedAt:.*\r?\n/gm, ''));
  const planDir = realpathSync(dirname(planPath));
  const marker = `${sep}.atomic-skills${sep}`;
  const root = planDir.includes(marker) ? planDir.slice(0, planDir.indexOf(marker)) : planDir;
  for (const p of fm.phases || []) {
    for (const rel of [p.initiativePath || p.initiative, p.deliveryAuditGate?.reportPath].filter(Boolean)) {
      const file = realpathSync(resolve(String(rel).startsWith('.atomic-skills/') ? root : planDir, String(rel)));
      if (!file.startsWith(root + sep)) throw new Error('delivery path escapes plan');
      const bytes = readFileSync(file);
      if (!bytes.length || bytes.length > 2_000_000) throw new Error('empty or oversized delivery evidence');
      hash.update(file).update(bytes);
    }
  }
  return hash.digest('hex');
}
/** Called exclusively by the authenticated HTTP button route. */
export function recordButtonValidation(planPath) {
  if (!finalAuditsPassed(planPath)) throw new Error('phase delivery audits are not passed');
  validationSnapshot(planPath); // Fail before writing the timestamp if evidence is unavailable.
  const keyPath = validationKeyPath(planPath);
  mkdirSync(dirname(keyPath), {recursive:true, mode:0o700});
  if (!existsSync(keyPath)) {try {writeFileSync(keyPath, randomBytes(32), {flag:'wx',mode:0o600});} catch(e) {if(e.code !== 'EEXIST') throw e;}}
  const {text} = readFinalPlan(planPath);
  const at = new Date().toISOString();
  const without = text.replace(/^userValidatedAt:.*\r?\n/gm, '');
  const updated = without.replace(/^---\r?\n/, `---\nuserValidatedAt: "${at}"\n`);
  const temp = `${planPath}.button-${process.pid}`;
  writeFileSync(temp, updated); renameSync(temp, planPath);
  const proof = {at, planPath: realpathSync(planPath), snapshot: validationSnapshot(planPath), source:'http-button'};
  const signature = createHmac('sha256',readFileSync(keyPath)).update(JSON.stringify(proof)).digest('hex');
  const receiptPath = join(dirname(planPath), 'final-validation.json');
  writeFileSync(`${receiptPath}.tmp`, JSON.stringify({proof, signature})+'\n');
  renameSync(`${receiptPath}.tmp`, receiptPath);
  return at;
}
export function readUserValidationEvidence(planPath) {
  try {
    if (!finalAuditsPassed(planPath)) return null;
    const {fm} = readFinalPlan(planPath);
    const {proof,signature} = JSON.parse(readFileSync(join(dirname(planPath),'final-validation.json'),'utf8'));
    if (proof.source !== 'http-button' || proof.planPath !== realpathSync(planPath) || proof.at !== fm.userValidatedAt || proof.snapshot !== validationSnapshot(planPath)) return null;
    const expected=createHmac('sha256',readFileSync(validationKeyPath(planPath))).update(JSON.stringify(proof)).digest();
    const actual=Buffer.from(signature,'hex');
    if(actual.length !== expected.length || !timingSafeEqual(actual,expected)) return null;
    const evidence={at:proof.at}; authenticatedEvidence.add(evidence); return evidence;
  } catch {return null;}
}
