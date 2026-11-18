/**
 * ground-truth-review.js — pure helpers for the plan↔code ground-truth receipt.
 *
 * Bidirectional review (plan premises vs code; code present but plan-silent)
 * is authored by review-plan Flow E (`--mode=ground-truth`). Persistence is
 * machine-checkable:
 *   1. `## Reviews` carries a `- ground-truth:` line with mode= + fp=
 *   2. `## Ground-truth review` section exists with Status + A + B + content floor
 *   3. `fp=<hex>` matches current plan substance fingerprint (freshness)
 *
 * Empty / no-product-code repos still require the full section (with explicit
 * empty-repo / none results) — silence is not a pass.
 *
 * Pure — no I/O (fingerprint of supplied strings only). Sibling of
 * find-unreviewed-plans' reviewReceiptGap shape.
 */

import { createHash } from 'node:crypto';

/**
 * @typedef {'no-reviews-section'
 *   | 'no-ground-truth-line'
 *   | 'no-ground-truth-mode-token'
 *   | 'no-ground-truth-fingerprint'
 *   | 'stale-ground-truth-receipt'
 *   | 'no-ground-truth-section'
 *   | 'incomplete-ground-truth-section'
 *   | 'thin-ground-truth-section'
 *   | 'invalid-ground-truth-status'} GroundTruthGapReason
 */

/**
 * Slice lines belonging to an H2 section (from heading to next H2 or EOF).
 * @param {string[]} lines
 * @param {RegExp} headingRe
 * @returns {{ start: number, end: number, lines: string[] } | null}
 */
export function findH2Section(lines, headingRe) {
  if (!Array.isArray(lines)) return null;
  const start = lines.findIndex((l) => headingRe.test(String(l).trim()));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end, lines: lines.slice(start, end) };
}

/**
 * Remove ## Reviews and ## Ground-truth review sections (and ## Self-review optional)
 * so the fingerprint tracks plan substance, not the receipt itself.
 * @param {string} markdown
 */
export function stripReceiptSections(markdown) {
  if (typeof markdown !== 'string' || !markdown) return '';
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (/^##\s+(Reviews|Ground-truth review|Self-review against code-quality gates)\s*$/i.test(line.trim())) {
      skip = true;
      continue;
    }
    if (skip && /^##\s+\S/.test(line)) {
      skip = false;
    }
    if (!skip) out.push(line);
  }
  return out.join('\n');
}

/**
 * Normalize frontmatter for fingerprint: drop volatile keys (lastUpdated, etc.).
 * @param {string} raw full plan file (frontmatter + body)
 */
export function planSubstanceText(raw) {
  if (typeof raw !== 'string') return '';
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let fm = '';
  let body = raw;
  if (m) {
    fm = m[1]
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return false;
        // Volatile / non-substance keys — exclude from freshness fingerprint
        if (/^(lastUpdated|started|userValidatedAt|executionMode)\s*:/i.test(t)) return false;
        return true;
      })
      .join('\n');
    body = m[2] || '';
  }
  const substanceBody = stripReceiptSections(body).replace(/\s+$/g, '').trimEnd();
  return `${fm}\n---\n${substanceBody}\n`;
}

/**
 * Stable short fingerprint of plan substance (and optional extra blobs, e.g. initiatives).
 * @param {string | string[]} substanceTexts
 * @returns {string} 12-char hex
 */
export function fingerprintSubstance(substanceTexts) {
  const parts = Array.isArray(substanceTexts) ? substanceTexts : [substanceTexts];
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(typeof p === 'string' ? p : '');
    h.update('\n--\n');
  }
  return h.digest('hex').slice(0, 12);
}

/**
 * Parse a `- ground-truth:` receipt line from a Reviews section body lines.
 * @param {string[]} reviewSectionLines
 * @returns {null | { raw: string, statusToken: string | null, hasModeToken: boolean, fingerprint: string | null }}
 */
export function parseGroundTruthReceiptLine(reviewSectionLines) {
  if (!Array.isArray(reviewSectionLines)) return null;
  for (const line of reviewSectionLines) {
    const m = String(line).match(/^\s*-\s*ground-truth\s*:\s*(.+)$/i);
    if (!m) continue;
    const raw = m[1].trim();
    // First token before `|` or `@` is the status token (complete / complete-empty-repo / …)
    const statusToken = (raw.split(/[|@]/)[0] || '').trim().toLowerCase() || null;
    // Attributable specialized mode: mode=ground-truth | mode=gt (Flow E stamp)
    const hasModeToken = /\bmode\s*=\s*(ground-truth|gt)\b/i.test(raw);
    const fpM = raw.match(/\bfp\s*=\s*([a-f0-9]{8,64})\b/i);
    const fingerprint = fpM ? fpM[1].toLowerCase() : null;
    return { raw, statusToken, hasModeToken, fingerprint };
  }
  return null;
}

/**
 * Valid status tokens for a ground-truth receipt (must run even on empty repos).
 * @param {string | null | undefined} token
 */
export function isValidGroundTruthStatus(token) {
  if (typeof token !== 'string' || !token) return false;
  const t = token.toLowerCase().trim();
  return (
    t === 'complete'
    || t === 'complete-empty-repo'
    || t === 'complete-with-findings'
    || t === 'ok' // alias accepted for terse receipts
  );
}

/**
 * Content floor: section must show real review work, not empty headings.
 * Requires Scanned line, A/B substance (table row or explicit none), Counts line.
 * @param {string} body section text
 * @returns {null | 'thin-ground-truth-section'}
 */
export function groundTruthContentFloorGap(body) {
  if (typeof body !== 'string' || !body.trim()) return 'thin-ground-truth-section';

  const hasScanned = /\*\*Scanned:\*\*\s*\S/i.test(body) || /^Scanned:\s*\S/im.test(body);
  if (!hasScanned) return 'thin-ground-truth-section';

  const hasCounts = /\*\*Counts:\*\*\s*\S/i.test(body) || /^Counts:\s*\S/im.test(body);
  if (!hasCounts) return 'thin-ground-truth-section';

  // Split loosely on A vs B headings for per-direction substance
  const aIdx = body.search(/^###\s+(A\b|Premises|Plan premises|Direção A)/im);
  const bIdx = body.search(/^###\s+(B\b|Code impacts|Code present|Impact candidates|Direção B)/im);
  if (aIdx === -1 || bIdx === -1) return 'thin-ground-truth-section';

  const aPart = bIdx > aIdx ? body.slice(aIdx, bIdx) : body.slice(aIdx);
  const bPart = bIdx > aIdx ? body.slice(bIdx) : body.slice(bIdx);

  const hasSubstance = (part) => {
    // Table rows that are not markdown separators (|---|---|)
    const rows = part.split(/\n/).filter((l) => {
      if (!/^\|/.test(l.trim())) return false;
      if (/^\|\s*[-:| ]+\s*\|/.test(l.trim())) return false;
      return true;
    });
    // header + ≥1 data row, or a single row that says "none"
    if (rows.length >= 2) return true;
    if (rows.some((r) => /\bnone\b/i.test(r))) return true;
    // prose fallback
    if (/\bnone\b/i.test(part) && /(greenfield|empty|n\/a|scan|premise|finding)/i.test(part)) {
      return true;
    }
    if (/^\s*[-*]\s+\S+/m.test(part) || /^\s*\d+\.\s+\S+/m.test(part)) return true;
    return false;
  };

  if (!hasSubstance(aPart) || !hasSubstance(bPart)) return 'thin-ground-truth-section';
  return null;
}

/**
 * Whether a Ground-truth review section has the required structure + content floor.
 * @param {string[]} sectionLines including the H2 heading
 * @returns {null | 'incomplete-ground-truth-section' | 'invalid-ground-truth-status' | 'thin-ground-truth-section'}
 */
export function groundTruthSectionGap(sectionLines) {
  if (!Array.isArray(sectionLines) || sectionLines.length < 2) {
    return 'incomplete-ground-truth-section';
  }
  const body = sectionLines.join('\n');

  const hasStatus = /\*\*Status:\*\*\s*(complete|complete-empty-repo|complete-with-findings|ok)\b/i.test(body)
    || /^Status:\s*(complete|complete-empty-repo|complete-with-findings|ok)\b/im.test(body);
  if (!hasStatus) return 'invalid-ground-truth-status';

  const hasA = /^###\s+(A\b|Premises|Plan premises|Direção A)/im.test(body)
    || /^\*\*A\s*[—–-]/im.test(body);
  const hasB = /^###\s+(B\b|Code impacts|Code present|Impact candidates|Direção B)/im.test(body)
    || /^\*\*B\s*[—–-]/im.test(body);

  if (!hasA || !hasB) return 'incomplete-ground-truth-section';

  return groundTruthContentFloorGap(body);
}

/**
 * Classify a plan body's ground-truth receipt (structure + content floor).
 * Freshness (fp match) is optional via `currentFingerprint`.
 *
 * @param {string} body markdown body (after frontmatter) OR full file if fingerprinting body-only
 * @param {{ currentFingerprint?: string | null }} [opts]
 * @returns {null | GroundTruthGapReason}
 *   null = receipt OK.
 */
export function groundTruthReceiptGap(body, opts = {}) {
  if (typeof body !== 'string') return 'no-reviews-section';
  const lines = body.split(/\r?\n/);

  const reviews = findH2Section(lines, /^##\s+Reviews\s*$/i);
  if (!reviews) return 'no-reviews-section';

  const receipt = parseGroundTruthReceiptLine(reviews.lines);
  if (!receipt) return 'no-ground-truth-line';
  if (!isValidGroundTruthStatus(receipt.statusToken)) return 'invalid-ground-truth-status';
  if (!receipt.hasModeToken) return 'no-ground-truth-mode-token';
  if (!receipt.fingerprint) return 'no-ground-truth-fingerprint';

  const gt = findH2Section(lines, /^##\s+Ground-truth review\s*$/i);
  if (!gt) return 'no-ground-truth-section';

  const sectionGap = groundTruthSectionGap(gt.lines);
  if (sectionGap) return sectionGap;

  if (opts.currentFingerprint != null && opts.currentFingerprint !== '') {
    const want = String(opts.currentFingerprint).toLowerCase().slice(0, 12);
    const got = receipt.fingerprint.slice(0, 12);
    if (want !== got) return 'stale-ground-truth-receipt';
  }

  return null;
}

/**
 * Full-file assess: structure + content floor + freshness from substance fingerprint.
 * @param {string} rawFile full plan.md contents
 * @param {{ extraSubstance?: string[] }} [opts] extra blobs (e.g. initiative files)
 * @returns {{ gap: null | GroundTruthGapReason, fingerprint: string, receiptFp: string | null }}
 */
export function assessGroundTruthPlanFile(rawFile, opts = {}) {
  const substance = planSubstanceText(rawFile);
  const extras = Array.isArray(opts.extraSubstance) ? opts.extraSubstance : [];
  const fingerprint = fingerprintSubstance([substance, ...extras]);

  // Gap uses body (prefer parsed) for section find — full file works too
  let body = rawFile;
  const m = typeof rawFile === 'string'
    ? rawFile.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)
    : null;
  if (m) body = m[1];

  const gap = groundTruthReceiptGap(body, { currentFingerprint: fingerprint });

  const lines = (typeof body === 'string' ? body : '').split(/\r?\n/);
  const reviews = findH2Section(lines, /^##\s+Reviews\s*$/i);
  const receipt = reviews ? parseGroundTruthReceiptLine(reviews.lines) : null;

  return {
    gap,
    fingerprint,
    receiptFp: receipt?.fingerprint ?? null,
  };
}

/**
 * Human-readable reason for CLI / skill messages.
 * @param {GroundTruthGapReason | null | undefined} reason
 */
export function groundTruthGapMessage(reason) {
  switch (reason) {
    case 'no-reviews-section':
      return 'no `## Reviews` section';
    case 'no-ground-truth-line':
      return '`## Reviews` present but no `- ground-truth:` line';
    case 'no-ground-truth-mode-token':
      return '`- ground-truth:` line missing `mode=ground-truth` (run `review-plan --mode=ground-truth`)';
    case 'no-ground-truth-fingerprint':
      return '`- ground-truth:` line missing `fp=<hex>` (re-run Flow E to stamp plan substance fingerprint)';
    case 'stale-ground-truth-receipt':
      return 'ground-truth receipt stale — plan/initiative substance changed after review (re-run `--mode=ground-truth`)';
    case 'no-ground-truth-section':
      return 'missing `## Ground-truth review` section (must persist A+B results even on empty repos)';
    case 'incomplete-ground-truth-section':
      return '`## Ground-truth review` incomplete (need Status + ### A premises + ### B impacts)';
    case 'thin-ground-truth-section':
      return '`## Ground-truth review` too thin (need Scanned:, Counts:, and A/B substance — table rows or explicit none)';
    case 'invalid-ground-truth-status':
      return 'ground-truth status invalid (use complete | complete-empty-repo | complete-with-findings)';
    default:
      return 'unknown ground-truth gap';
  }
}
