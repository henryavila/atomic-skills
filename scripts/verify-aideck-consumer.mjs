#!/usr/bin/env node
/**
 * verify-aideck-consumer.mjs — the P2 guardrail: validate the repo's aiDeck
 * consumer manifest against the *installed* aiDeck, not against a hand-written
 * YAML.parse + field-assert (that is the false-green P2 warns about — it happily
 * passes `nav.style: projects` while the real loader rejects it).
 *
 * It answers one question end-to-end: "will the dashboard actually render the
 * atomic-skills consumer with the aiDeck I have installed right now?" — by
 *   1. loading assets/aideck-consumer/manifest.yaml through the installed
 *      @henryavila/aideck `loadManifest` (the same code the server runs at boot),
 *   2. probing a running aiDeck instance (if any): is `atomic-skills` registered,
 *      and is that server the same build as the installed package (a stale server
 *      reused by `aideck up` will keep serving the old schema/SPA),
 *   3. (with --smoke) test data routes that the client calls: /api/consumers/.../data/...
 * and exits non-zero on any blocking mismatch.
 *
 * This is the "is it fixed yet?" probe: after the aiDeck npm release lands and you
 * `npm i` + reinstall + `aideck down`, run `npm run verify:aideck-consumer` — green
 * means the cross-repo contract is satisfied.
 *
 * CLI:
 *   node scripts/verify-aideck-consumer.mjs           — manifest + server check
 *   node scripts/verify-aideck-consumer.mjs --smoke   — + data routes smoke test
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { refreshState } from './refresh-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CONSUMER_DIR = join(REPO_ROOT, 'assets', 'aideck-consumer');
const CONSUMER_ID = 'atomic-skills';

// Parse args
const args = process.argv.slice(2);
const shouldSmoke = args.includes('--smoke') || args.includes('--smoke-routes');

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let blocking = 0;
let warnings = 0;

function head(s) {
  process.stdout.write(`\n${s}\n`);
}

// ── installed aideck ───────────────────────────────────────────────────────
// The package's `exports` map blocks subpath/package.json resolution, so resolve
// the package root from the "." export and reach into dist/ by absolute path.
function findAideckRoot() {
  let dir;
  try {
    dir = dirname(fileURLToPath(import.meta.resolve('@henryavila/aideck')));
  } catch {
    return null;
  }
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'dist', 'server', 'manifest-loader.js'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const aideckRoot = findAideckRoot();
if (!aideckRoot) {
  console.error(
    c.bad('✗ cannot resolve @henryavila/aideck') +
      '\n  → run `npm install` so the aiDeck dependency is present.',
  );
  process.exit(2);
}

let installedVersion = 'unknown';
try {
  installedVersion = JSON.parse(readFileSync(join(aideckRoot, 'package.json'), 'utf8')).version;
} catch {
  /* keep 'unknown' */
}

let loadManifest;
try {
  ({ loadManifest } = await import(
    pathToFileURL(join(aideckRoot, 'dist', 'server', 'manifest-loader.js')).href
  ));
} catch (cause) {
  console.error(
    c.bad('✗ cannot load @henryavila/aideck manifest-loader') +
      `\n  ${cause instanceof Error ? cause.message : String(cause)}` +
      '\n  → run `npm install` so the aiDeck dependency is present.',
  );
  process.exit(2);
}

// What nav.style does the repo manifest declare? (for messaging)
let declaredNavStyle = '(unparsed)';
try {
  const m = parseYaml(readFileSync(join(CONSUMER_DIR, 'manifest.yaml'), 'utf8'));
  declaredNavStyle = m?.nav?.style ?? '(none)';
} catch {
  /* leave as-is; loadManifest below will report the real parse error */
}

head('aiDeck consumer contract check');
console.log(`  installed @henryavila/aideck: ${installedVersion}`);
console.log(`  manifest: assets/aideck-consumer/manifest.yaml ${c.dim(`(nav.style: ${declaredNavStyle})`)}`);

// ── 1. manifest → installed loader ─────────────────────────────────────────
head('[manifest → installed loader]');
const result = await loadManifest(CONSUMER_DIR);
if (result.ok) {
  console.log(`  ${c.ok('✓ PASS')}  loadManifest accepts the manifest (id=${result.value.id})`);
} else {
  const msg = result.error.message;
  blocking++;
  console.log(`  ${c.bad('✗ FAIL')}  ${msg}`);
  if (/nav\.style/i.test(msg)) {
    console.log(
      c.dim(
        `    → installed aiDeck ${installedVersion} does not support nav.style: ${declaredNavStyle}.\n` +
          "      This is the cross-repo gap: the consumer manifest was advanced to the\n" +
          "      project-centric nav topology, but no installed aiDeck accepts it yet.\n" +
          '      Blocked on the aiDeck npm release that extends navSchema.style.',
      ),
    );
  }
}

// ── 2. running server probe ────────────────────────────────────────────────
head('[running server]');
if (shouldSmoke) {
  head('[derived state refresh]');
  const refreshed = refreshState(REPO_ROOT);
  if (refreshed.seriesError) {
    warnings++;
    console.log(c.warn(`  ⚠ refresh-state had a partial failure: ${refreshed.seriesError}`));
  } else {
    console.log(`  ${c.ok('✓ PASS')}  refreshed ${refreshed.seriesWritten} aiDeck state files`);
  }
}

const aideckUrl = readRunningUrl();
if (!aideckUrl) {
  console.log(c.dim('  no running instance found (~/.aideck/env absent or unreadable) — skipping live probe'));
} else {
  console.log(`  url: ${aideckUrl}`);
  const health = await getJson(`${aideckUrl}/api/health`);
  const serverVersion = health?.version ?? health?.aideck?.version ?? 'unknown';
  console.log(`  server build: ${serverVersion}`);
  if (serverVersion !== 'unknown' && installedVersion !== 'unknown' && serverVersion !== installedVersion) {
    warnings++;
    console.log(
      c.warn(`  ⚠ running server (${serverVersion}) ≠ installed package (${installedVersion}).`) +
        c.dim('\n    → `aideck up` reuses a live process; it will keep serving the old build.\n' +
          '      Run `node ~/.atomic-skills/bin/aideck.mjs down` then re-open the dashboard.'),
    );
  }

  const consumers = await getJson(`${aideckUrl}/api/consumers`);
  const ids = Array.isArray(consumers?.consumers) ? consumers.consumers.map((x) => x.id) : [];
  console.log(`  consumers registered: ${ids.length ? ids.join(', ') : '(none)'}`);
  if (ids.includes(CONSUMER_ID)) {
    console.log(`  ${c.ok('✓')} '${CONSUMER_ID}' is registered — data endpoints will resolve`);
  } else {
    blocking++;
    console.log(
      `  ${c.bad("✗")} '${CONSUMER_ID}' NOT registered ` +
        c.dim('→ /api/consumers/atomic-skills/... will 404 (empty/error dashboard).'),
    );
    console.log(
      c.dim(
        '    Cause is one of: (a) manifest rejected at boot (see section above), or\n' +
          '    (b) the server scanned before the consumer was provisioned and serve-mode\n' +
          '    never re-scans — restart with `aideck down` to force a fresh scan.',
      ),
    );
  }

  // Smoke test de rotas se --smoke foi passado
  if (shouldSmoke && ids.includes(CONSUMER_ID)) {
    await smokeTestRoutes(aideckUrl, CONSUMER_ID);
  } else if (shouldSmoke) {
    console.log(c.dim('  (smoke test skipped — consumer not registered)'));
  }
}

// ── smoke test de rotas de dados ─────────────────────────────────────────────
async function smokeTestRoutes(aideckUrl, consumerId) {
  head('[data routes smoke]');
  const tests = [
    {
      name: 'GET /api/consumers',
      url: `${aideckUrl}/api/consumers`,
      check: (body) => Array.isArray(body?.consumers) && body.consumers.length > 0,
    },
    {
      name: `GET /api/consumers/${consumerId}`,
      url: `${aideckUrl}/api/consumers/${consumerId}`,
      check: (body) => body?.manifest?.id === consumerId,
    },
    {
      name: `GET /api/consumers/${consumerId}/projects`,
      url: `${aideckUrl}/api/consumers/${consumerId}/projects`,
      check: (body) => Array.isArray(body?.projects),
    },
  ];

  // Se temos projetos registrados, testa rotas project-scoped
  const projectsResp = await getJson(`${aideckUrl}/api/consumers/${consumerId}/projects`);
  if (projectsResp?.projects && projectsResp.projects.length > 0) {
    const firstProject = projectsResp.projects[0].projectId || projectsResp.projects[0].id || projectsResp.projects[0].slug;
    tests.push(
      {
        name: `GET /api/consumers/${consumerId}/projects/${firstProject}/data/phases`,
        url: `${aideckUrl}/api/consumers/${consumerId}/projects/${firstProject}/data/phases`,
        check: (body) => Array.isArray(body?.records),
      },
      {
        name: `GET /api/consumers/${consumerId}/projects/${firstProject}/data/plans`,
        url: `${aideckUrl}/api/consumers/${consumerId}/projects/${firstProject}/data/plans`,
        check: (body) => Array.isArray(body?.records),
      },
      {
        name: `GET /api/consumers/${consumerId}/projects/${firstProject}/data/initiatives`,
        url: `${aideckUrl}/api/consumers/${consumerId}/projects/${firstProject}/data/initiatives`,
        check: (body) => Array.isArray(body?.records),
      },
    );
  } else {
    console.log(c.dim('  (no projects registered, skipping project-scoped routes)'));
  }

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const resp = await fetch(test.url);
    const body = await resp.json().catch(() => null);
    const ok = resp.ok && test.check(body);

    if (ok) {
      passed++;
      console.log(`  ${c.ok('✓')} ${test.name}`);
    } else {
      failed++;
      blocking++;
      console.log(`  ${c.bad('✗')} ${test.name} — ${resp.status} ${resp.statusText}`);
      if (body?.error) {
        console.log(c.dim(`    → ${body.error.code || body.error.message || 'unknown error'}`));
      }
    }
  }

  console.log(c.dim(`  Summary: ${passed} passed, ${failed} failed`));
}

// ── verdict ────────────────────────────────────────────────────────────────
head('───');
if (blocking === 0 && warnings === 0) {
  console.log(c.ok('RESULT: PASS') + ' — the consumer contract is satisfied by the installed aiDeck.');
  process.exit(0);
}
if (blocking === 0) {
  console.log(c.warn(`RESULT: PASS with ${warnings} warning(s)`) + ' — see ⚠ above.');
  process.exit(0);
}
console.log(c.bad(`RESULT: FAIL (${blocking} blocking, ${warnings} warning)`) + ' — dashboard will not render the consumer.');
process.exit(1);

// ── helpers ────────────────────────────────────────────────────────────────
function readRunningUrl() {
  for (const envf of [join(homedir(), '.aideck', 'env'), join(homedir(), '.atomic-skills', 'env')]) {
    try {
      const txt = readFileSync(envf, 'utf8');
      const m = txt.match(/AIDECK_URL=['"]?([^'"\n]+)/);
      if (m) return m[1];
    } catch {
      /* try next */
    }
  }
  return null;
}

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
