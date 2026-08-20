/**
 * Per-process diagram zoom. Stored in localStorage as as-flow-zoom:<slug>.
 * Opening the same process restores that scale; another process has its own.
 * Runtime only — not part of HTML bytes / content-sha.
 */

export const FLOW_ZOOM_KEY_PREFIX = 'as-flow-zoom:';
export const FLOW_ZOOM_MIN = 0.3;
export const FLOW_ZOOM_MAX = 2.8;

/**
 * @param {unknown} id plan slug / process id
 * @returns {string}
 */
export function zoomStorageKey(id) {
  const s = String(id ?? '').trim();
  return `${FLOW_ZOOM_KEY_PREFIX}${s || 'default'}`;
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function clampFlowZoom(raw) {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(FLOW_ZOOM_MAX, Math.max(FLOW_ZOOM_MIN, n));
}
