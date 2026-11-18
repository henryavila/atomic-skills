/**
 * Color scheme for product HTML (docs site + flow.html).
 * Stored preference is system | light | dark. System leaves `data-theme`
 * unset so `prefers-color-scheme` in ds.css wins.
 */

export const COLOR_SCHEME_KEY = 'as-color-scheme';

/**
 * @param {unknown} raw
 * @returns {'system' | 'light' | 'dark'}
 */
export function normalizeColorScheme(raw) {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * @param {unknown} raw
 * @returns {'light' | 'dark' | null}
 */
export function themeAttribute(raw) {
  const mode = normalizeColorScheme(raw);
  return mode === 'system' ? null : mode;
}

/**
 * Blocking <head> script. Deterministic source (no Date/random).
 * @returns {string}
 */
export function colorSchemeBootScript() {
  return `(function(){var K=${JSON.stringify(COLOR_SCHEME_KEY)};function read(){try{var v=localStorage.getItem(K);return v==='light'||v==='dark'?v:'system'}catch(e){return'system'}}function apply(mode){var r=document.documentElement;if(mode==='light'||mode==='dark')r.setAttribute('data-theme',mode);else r.removeAttribute('data-theme');document.querySelectorAll('[data-theme-set]').forEach(function(b){b.setAttribute('aria-checked',String(b.getAttribute('data-theme-set')===mode))})}apply(read());document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-theme-set]');if(!b)return;var mode=b.getAttribute('data-theme-set');try{localStorage.setItem(K,mode)}catch(err){}apply(mode)});document.addEventListener('DOMContentLoaded',function(){apply(read())})})();`;
}

/**
 * @param {{ locale?: 'en' | 'pt' }} [opts]
 * @returns {string}
 */
export function renderColorSchemeSwitch(opts = {}) {
  const pt = opts.locale === 'pt';
  const label = pt ? 'Aparência' : 'Appearance';
  const items = pt
    ? [
        ['system', 'Sistema'],
        ['light', 'Claro'],
        ['dark', 'Escuro'],
      ]
    : [
        ['system', 'System'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ];
  const buttons = items
    .map(
      ([id, text]) =>
        `<button type="button" role="radio" data-theme-set="${id}" aria-checked="${id === 'system' ? 'true' : 'false'}">${text}</button>`,
    )
    .join('');
  return `<div class="theme-switch" role="radiogroup" aria-label="${label}">${buttons}</div>`;
}
