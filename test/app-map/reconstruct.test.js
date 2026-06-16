import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

import {
  computeReconstruction,
  persistReconstruction,
  resolveTarget,
} from '../../src/app-map/reconstruct.js';
import { validateAppMap } from '../../src/app-map/validate.js';

function tempApp() {
  return mkdtempSync(join(tmpdir(), 'app-map-reconstruct-'));
}

function write(path, content) {
  writeFileSync(path, content);
}

function addRoute(appRoot, name, content = 'export default function Page() { return null; }\n') {
  mkdirSync(join(appRoot, 'src', 'pages'), { recursive: true });
  write(join(appRoot, 'src', 'pages', `${name}.tsx`), content);
}

function addDoc(appRoot, name, body) {
  mkdirSync(join(appRoot, 'docs'), { recursive: true });
  write(join(appRoot, 'docs', name), body);
}

function withApp(fn) {
  const appRoot = tempApp();
  const cleanup = () => rmSync(appRoot, { recursive: true, force: true });
  try {
    const result = fn(appRoot);
    if (result && typeof result.then === 'function') return result.finally(cleanup);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

let cliRun = 0;

async function runCli(args) {
  const originalArgv = process.argv;
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalExitCode = process.exitCode;
  let stdout = '';
  let stderr = '';

  process.argv = [process.execPath, 'scripts/app-map-reconstruct.js', ...args];
  process.exitCode = undefined;
  process.stdout.write = (chunk) => {
    stdout += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  try {
    const cliUrl = pathToFileURL(join(process.cwd(), 'scripts', 'app-map-reconstruct.js'));
    await import(`${cliUrl.href}?run=${cliRun++}`);
    return { status: process.exitCode ?? 0, stdout, stderr };
  } finally {
    process.argv = originalArgv;
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.exitCode = originalExitCode;
  }
}

test('resolveTarget derives projectId and catalog paths inside the target app tree', () => withApp((appRoot) => {
  const implicit = resolveTarget({ appRoot });
  assert.equal(implicit.appRoot, appRoot);
  assert.equal(implicit.projectId, basename(appRoot));
  assert.equal(implicit.catalogDir, join(appRoot, '.atomic-skills', 'app-map'));
  assert.equal(implicit.jsonPath, join(appRoot, '.atomic-skills', 'app-map', 'app-map.json'));

  const explicit = resolveTarget({ appRoot, projectId: 'billing' });
  assert.equal(explicit.projectId, 'billing');
}));

test('first reconstruction reports the whole inventory when the catalog is absent', () => withApp((appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: registered',
    'Access: public',
    '',
    'Page: Settings',
    'Audience: admin',
    'Access: auth:admin',
    '',
  ].join('\n'));

  const result = computeReconstruction({ appRoot, projectId: 'demo' });

  assert.equal(result.catalogMissing, true);
  assert.equal(result.projectId, 'demo');
  assert.equal(result.jsonPath, join(appRoot, '.atomic-skills', 'app-map', 'app-map.json'));
  assert.equal(result.pages.length, 2);
  assert.deepEqual(result.inventory.map((d) => d.pageId).sort(), ['dashboard', 'settings']);
  assert.deepEqual(result.delta, result.inventory);
  assert.equal(result.reRun, null);
}));

test('empty reconstruction refuses to persist instead of silently emitting an empty catalog', () => withApp((appRoot) => {
  const result = computeReconstruction({ appRoot });

  assert.equal(result.pages.length, 0);
  assert.throws(
    () => persistReconstruction({ appRoot, pages: result.pages }),
    /Cannot persist an empty app-map catalog/,
  );
  assert.equal(existsSync(join(appRoot, '.atomic-skills', 'app-map', 'app-map.json')), false);
}));

test('fresh catalog produces zero re-run delta and changed evidence only reports changed pages', () => withApp((appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addRoute(appRoot, 'Settings');
  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: registered',
    'Access: public',
    '',
    'Page: Settings',
    'Audience: registered',
    'Access: auth',
    '',
  ].join('\n'));

  const first = computeReconstruction({ appRoot, projectId: 'demo' });
  const written = persistReconstruction({ appRoot, projectId: 'demo', pages: first.pages });
  assert.equal(existsSync(written.jsonPath), true);

  const fresh = computeReconstruction({ appRoot, projectId: 'demo' });
  assert.equal(fresh.catalogMissing, false);
  assert.deepEqual(fresh.reRun, { delta: [], changed: [], added: [], removed: [] });
  assert.deepEqual(fresh.delta, []);

  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: visitor',
    'Access: public',
    '',
    'Page: Settings',
    'Audience: registered',
    'Access: auth',
    '',
  ].join('\n'));

  const changed = computeReconstruction({ appRoot, projectId: 'demo' });
  assert.deepEqual(changed.reRun.delta, ['dashboard']);
  assert.deepEqual(changed.reRun.changed, ['dashboard']);
  assert.deepEqual(changed.delta, ['dashboard']);
}));

test('re-run delta includes added and removed pages from evidenceHash comparison', () => withApp((appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: registered',
    'Access: public',
    '',
    'Page: Settings',
    'Audience: registered',
    'Access: auth',
    '',
  ].join('\n'));

  const first = computeReconstruction({ appRoot, projectId: 'demo' });
  persistReconstruction({ appRoot, projectId: 'demo', pages: first.pages });

  addRoute(appRoot, 'Reports');
  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: registered',
    'Access: public',
    '',
  ].join('\n'));

  const rerun = computeReconstruction({ appRoot, projectId: 'demo' });
  assert.deepEqual(rerun.reRun.added, ['reports']);
  assert.deepEqual(rerun.reRun.removed, ['settings']);
  assert.deepEqual(rerun.delta, ['reports', 'settings']);
}));

test('CLI prints delta JSON and persist writes the target catalog', async () => withApp(async (appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'map.md', [
    'Page: Dashboard',
    'Audience: registered',
    'Access: public',
    '',
  ].join('\n'));

  const delta = await runCli([appRoot, '--delta']);
  assert.equal(delta.status, 0, delta.stderr);
  assert.deepEqual(JSON.parse(delta.stdout).map((d) => d.pageId), ['dashboard']);

  const persisted = await runCli([appRoot, '--persist']);
  assert.equal(persisted.status, 0, persisted.stderr);
  const payload = JSON.parse(persisted.stdout);
  assert.equal(payload.projectId, basename(appRoot));

  const catalog = JSON.parse(readFileSync(join(appRoot, '.atomic-skills', 'app-map', 'app-map.json'), 'utf8'));
  assert.equal(catalog.projectId, basename(appRoot));
  assert.deepEqual(catalog.pages.map((p) => p.id), ['dashboard']);
}));

// Review F2 #1 (0.3 form) — a persisted field-conflict must NOT fabricate a code
// witness. Two docs disagree on Dashboard's audience; the code page (Dashboard.tsx)
// never asserts audience, so EVERY witness must be kind=artefact — none mislabeled
// as code. Mutation that asserts kind=code for a doc source fails the `every`
// assert below.
test('a doc/doc field-conflict records witnesses all kind=artefact, never a fabricated code witness', () => withApp((appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'a.md', ['Page: Dashboard', 'Audience: registered', ''].join('\n'));
  addDoc(appRoot, 'b.md', ['Page: Dashboard', 'Audience: visitor', ''].join('\n'));

  const result = computeReconstruction({ appRoot, projectId: 'demo' });
  const { jsonPath } = persistReconstruction({ appRoot, projectId: 'demo', pages: result.pages });

  const catalog = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const dashboard = catalog.pages.find((p) => p.id === 'dashboard');
  const audienceConflict = dashboard.conflicts.find((c) => c.field === 'audience');
  assert.ok(audienceConflict, 'the doc/doc audience disagreement is recorded as a conflict');
  assert.equal(audienceConflict.witnesses.length, 2, 'both doc witnesses preserved');
  assert.deepEqual(audienceConflict.witnesses.map((w) => w.value).sort(), ['registered', 'visitor']);
  assert.ok(
    audienceConflict.witnesses.every((w) => w.kind === 'artefact'),
    'no code witness for audience → every witness is artefact, not a fabricated code kind',
  );
  assert.equal('artefactValue' in audienceConflict, false, 'legacy slot removed');
  assert.equal('codeValue' in audienceConflict, false, 'legacy slot removed');
  assert.equal(dashboard.audience, null, 'an unresolved conflict forces audience null');
}));

// P1 (never choose in silence) + L-002 — a conflict of N=3 discordant doc
// witnesses must preserve ALL THREE (the F2 #2 truncation is gone), each with a
// derived kind, in a schema-0.3 catalog that validates emit-time. Mutation that
// caps witnesses at two positional slots drops one value and fails the length
// assert; one that emits 0.2 fails the schemaVersion assert.
test('a 3-doc field-conflict preserves all three witnesses with derived kind in a valid 0.3 catalog', () => withApp((appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'a.md', ['Page: Dashboard', 'Audience: admin', ''].join('\n'));
  addDoc(appRoot, 'b.md', ['Page: Dashboard', 'Audience: registered', ''].join('\n'));
  addDoc(appRoot, 'c.md', ['Page: Dashboard', 'Audience: guardian', ''].join('\n'));

  const result = computeReconstruction({ appRoot, projectId: 'demo' });
  const { jsonPath } = persistReconstruction({ appRoot, projectId: 'demo', pages: result.pages });
  const catalog = JSON.parse(readFileSync(jsonPath, 'utf8'));

  assert.equal(catalog.schemaVersion, '0.3', 'producer emits the 0.3 contract');
  assert.equal(validateAppMap(catalog).valid, true, JSON.stringify(validateAppMap(catalog).errors, null, 2));

  const dashboard = catalog.pages.find((p) => p.id === 'dashboard');
  const audienceConflict = dashboard.conflicts.find((c) => c.field === 'audience');
  assert.ok(audienceConflict, 'the 3-doc audience disagreement is recorded');
  assert.equal(audienceConflict.witnesses.length, 3, 'all three witnesses preserved — none truncated');
  assert.deepEqual(
    audienceConflict.witnesses.map((w) => w.value).sort(),
    ['admin', 'guardian', 'registered'],
  );
  assert.ok(
    audienceConflict.witnesses.every((w) => w.kind === 'artefact'),
    'no fabricated code witness — code-scan does not emit audience',
  );
  assert.ok(
    audienceConflict.witnesses.every((w) => typeof w.source === 'string' && w.source.length > 0),
    'every witness carries its provenance',
  );
  assert.equal(dashboard.audience, null, 'unresolved conflict forces audience null');
}));

// Review F2 #4 — an agent-injected resolved page lacking the raw `evidence`
// descriptor must throw, not collapse to computeEvidenceHash(undefined).
test('persistReconstruction throws on a resolved page missing its evidence descriptor', () => withApp((appRoot) => {
  const resolved = {
    id: 'x', label: 'X', purpose: 'The X page.', audience: null, accessTier: 'public',
    status: 'built', regime: 'brownfield', existence: 'confirmed', provenance: {}, conflicts: [],
    // no `evidence`
  };
  assert.throws(
    () => persistReconstruction({ appRoot, projectId: 'demo', pages: [resolved] }),
    /missing the evidence descriptor/,
  );
  assert.equal(existsSync(join(appRoot, '.atomic-skills', 'app-map', 'app-map.json')), false, 'nothing written on the throw');
}));

// Review F2 #5 — `--project-id` with no trailing value is an error, not a silent
// basename fallback.
test('CLI rejects --project-id with no value instead of silently using basename', async () => withApp(async (appRoot) => {
  addRoute(appRoot, 'Dashboard');
  addDoc(appRoot, 'map.md', ['Page: Dashboard', 'Audience: registered', 'Access: public', ''].join('\n'));

  const result = await runCli([appRoot, '--persist', '--project-id']);
  assert.equal(result.status, 1, 'missing --project-id value is a non-zero exit');
  assert.match(result.stderr, /--project-id requires a non-empty value/);
  assert.equal(existsSync(join(appRoot, '.atomic-skills', 'app-map', 'app-map.json')), false, 'nothing persisted on the arg error');
}));
