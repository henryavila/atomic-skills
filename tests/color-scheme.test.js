/**
 * Color scheme: system (prefers-color-scheme) + explicit light/dark override.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COLOR_SCHEME_KEY,
  normalizeColorScheme,
  themeAttribute,
  colorSchemeBootScript,
  renderColorSchemeSwitch,
} from '../scripts/lib/color-scheme.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');

describe('normalizeColorScheme', () => {
  it('accepts only light, dark, or system', () => {
    assert.equal(normalizeColorScheme('light'), 'light');
    assert.equal(normalizeColorScheme('dark'), 'dark');
    assert.equal(normalizeColorScheme('system'), 'system');
    assert.equal(normalizeColorScheme(null), 'system');
    assert.equal(normalizeColorScheme('auto'), 'system');
    assert.equal(normalizeColorScheme(''), 'system');
  });
});

describe('themeAttribute', () => {
  it('is null for system so CSS prefers-color-scheme can win', () => {
    assert.equal(themeAttribute('system'), null);
    assert.equal(themeAttribute(undefined), null);
    assert.equal(themeAttribute('light'), 'light');
    assert.equal(themeAttribute('dark'), 'dark');
  });
});

describe('colorSchemeBootScript', () => {
  it('reads as-color-scheme and sets data-theme only for light|dark', () => {
    assert.equal(COLOR_SCHEME_KEY, 'as-color-scheme');
    const src = colorSchemeBootScript();
    assert.match(src, /as-color-scheme/);
    assert.match(src, /data-theme/);
    assert.match(src, /localStorage/);
    assert.doesNotMatch(src, /Date\.now/);
    assert.doesNotMatch(src, /Math\.random/);
  });
});

describe('renderColorSchemeSwitch', () => {
  it('emits a 3-way radiogroup with system/light/dark', () => {
    const html = renderColorSchemeSwitch({ locale: 'en' });
    assert.match(html, /role="radiogroup"/);
    assert.match(html, /data-theme-set="system"/);
    assert.match(html, /data-theme-set="light"/);
    assert.match(html, /data-theme-set="dark"/);
    assert.match(html, />System</);
    assert.match(html, />Light</);
    assert.match(html, />Dark</);
  });

  it('uses Portuguese labels for pt', () => {
    const html = renderColorSchemeSwitch({ locale: 'pt' });
    assert.match(html, />Sistema</);
    assert.match(html, />Claro</);
    assert.match(html, />Escuro</);
  });
});

describe('ds.css light tokens', () => {
  it('overrides canvas in light without replacing dark :root', () => {
    assert.match(DS, /:root\s*\{[^}]*--bg-canvas:\s*#0a0d12/s);
    assert.match(DS, /html\[data-theme="light"\]/);
    assert.match(DS, /prefers-color-scheme:\s*light/);
    assert.match(DS, /html:not\(\[data-theme="dark"\]\)/);
    assert.match(DS, /--bg-canvas:\s*#f4f6fa/);
    assert.match(DS, /--fg-default:\s*#12161d/);
  });
});
