/**
 * build-aideck-widget-registry.mjs — regenerate meta/aideck-widget-registry.json
 * from the aiDeck client's authoritative `widgetMap`.
 *
 * WHY: the aiDeck manifest schema types `widget:` as `z.string()` — a FALSE
 * GREEN: a typo or a not-yet-implemented widget parses fine and only surfaces at
 * render time as an "Unknown widget" placeholder. The single source of truth for
 * which widget strings are real is the `widgetMap` object in the client's
 * `WidgetRenderer.vue` (a `Record<string, Component>`); nothing in the published
 * npm package exports it (the package ships `dist/` only, and `dist/server`'s
 * manifest schema keeps `widget: z.string()`), so we VENDOR a snapshot of the
 * keys here and let tests/aideck-manifest-widget-registry.test.js (a) gate the
 * consumer manifest against the snapshot and (b) drift-check the snapshot back
 * against this same source when an aiDeck checkout is reachable.
 *
 * SOURCE: the aiDeck repo is a sibling checkout, not a node_modules artifact
 * (the package excludes `src/`). Resolution order:
 *   1. $AIDECK_SRC                      (explicit aiDeck repo root)
 *   2. the candidate sibling paths below (relative to this repo)
 * The file read is <root>/src/client/components/WidgetRenderer.vue.
 *
 * USAGE: node scripts/build-aideck-widget-registry.mjs [<aideck-repo-root>]
 *        AIDECK_SRC=/path/to/aideck npm run build:aideck-widget-registry
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const OUT = join(REPO, 'meta', 'aideck-widget-registry.json');
const RENDERER_REL = join('src', 'client', 'components', 'WidgetRenderer.vue');

/** Candidate aiDeck checkout roots, in priority order (CLI arg → env → siblings). */
export function candidateRoots(cliArg) {
  const out = [];
  if (cliArg) out.push(resolve(cliArg));
  if (process.env.AIDECK_SRC) out.push(resolve(process.env.AIDECK_SRC));
  // Sibling checkouts: ../aideck from the repo root, and ../../../aideck from a
  // .worktrees/<name>/ worktree (repo → .worktrees → repo → parent → aideck).
  for (const rel of ['../aideck', '../../aideck', '../../../aideck']) {
    out.push(resolve(REPO, rel));
  }
  return out;
}

/** First candidate root that actually holds WidgetRenderer.vue, or null. */
export function resolveRendererPath(cliArg) {
  for (const root of candidateRoots(cliArg)) {
    const p = join(root, RENDERER_REL);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Extract the quoted keys of the `const widgetMap: Record<string, Component> = {
 * … }` object. Pure (takes the file text) so the test can reuse it on the source
 * it discovers. Returns a sorted, de-duplicated string[].
 */
export function parseWidgetMapKeys(vueSource) {
  const start = vueSource.indexOf('widgetMap');
  if (start === -1) throw new Error('parseWidgetMapKeys: no `widgetMap` in source');
  const open = vueSource.indexOf('{', start);
  if (open === -1) throw new Error('parseWidgetMapKeys: no `{` after `widgetMap`');
  // Walk braces to find the matching close, so a stray `}` in a later comment
  // cannot truncate the object.
  let depth = 0;
  let end = -1;
  for (let i = open; i < vueSource.length; i++) {
    const ch = vueSource[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('parseWidgetMapKeys: unbalanced braces in widgetMap');
  const body = vueSource.slice(open + 1, end);
  // Keys are `'name':` / `"name":` at the start of an entry. Ignore `//` lines so
  // a commented-out alias is not counted as live.
  const keys = new Set();
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    const m = line.match(/^['"]([a-z0-9-]+)['"]\s*:/i);
    if (m) keys.add(m[1]);
  }
  if (keys.size === 0) throw new Error('parseWidgetMapKeys: matched zero keys');
  return [...keys].sort();
}

function main() {
  const rendererPath = resolveRendererPath(process.argv[2]);
  if (!rendererPath) {
    process.stderr.write(
      'build-aideck-widget-registry: no aiDeck checkout found.\n' +
      `  Tried: ${candidateRoots(process.argv[2]).map((r) => join(r, RENDERER_REL)).join('\n         ')}\n` +
      '  Pass the aiDeck repo root as an arg or set AIDECK_SRC.\n'
    );
    process.exit(1);
  }
  const widgets = parseWidgetMapKeys(readFileSync(rendererPath, 'utf8'));
  const payload = {
    _comment:
      'Vendored snapshot of the aiDeck client widget registry (the `widgetMap` ' +
      'keys in WidgetRenderer.vue). The aiDeck manifest schema types `widget:` as ' +
      'z.string() (a false green), so tests/aideck-manifest-widget-registry.test.js ' +
      'gates the consumer manifest against this list. Regenerate with ' +
      '`npm run build:aideck-widget-registry` (needs an aiDeck checkout: AIDECK_SRC or a sibling).',
    _source: 'aideck:src/client/components/WidgetRenderer.vue (widgetMap)',
    widgets,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  process.stdout.write(`build-aideck-widget-registry: wrote ${widgets.length} widget types → ${OUT}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
