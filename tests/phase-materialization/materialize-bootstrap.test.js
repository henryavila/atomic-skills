import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import {
  decomposePlan,
  materializeDecomposition,
  writeInitiativeFile,
} from '../../src/decompose.js';
import { materializeState } from '../../scripts/materialize-state.js';
import { parseFrontmatter } from '../../scripts/validate-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATERIALIZE_SCRIPT = join(__dirname, '..', '..', 'scripts', 'materialize-state.js');
const MATERIALIZE_URL = new URL('../../scripts/materialize-state.js', import.meta.url).href;
const SOURCE = readFileSync(join(__dirname, 'fixtures', 'e2e-lifecycle-source.md'), 'utf8');
const BUSINESS_INTENT = {
  value: 'Prevents a phase transition from exposing only half of its state.',
  workflow: 'Materialize a descriptor-only phase into an active initiative.',
  rules: 'Validate both candidate files before publishing either live file.',
  outOfScope: 'Does not harden reopen, switch, or close transitions.',
  doneWhen: 'The plan and initiative publish as one recoverable transaction.',
};
const F1_SUMMARY = 'Publishes the customer handoff phase as one recoverable state pair.';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'as-materialize-state-'));
  const files = materializeDecomposition(
    decomposePlan(SOURCE, { planSlug: 'e2e-lifecycle' }),
    {
      planSlug: 'e2e-lifecycle',
      projectId: 'atomic-skills',
      branch: 'plan/e2e-lifecycle',
      now: new Date('2026-07-01T09:00:00.000Z'),
      businessIntent: BUSINESS_INTENT,
    },
  );
  const plan = files.find((file) => file.kind === 'plan');
  const f1Source = files.find((file) => file.kind === 'source' && file.content.includes('"phaseId": "F1"'));
  const initiativePath = f1Source.relativePath.replace(/\.source\.json$/, '.md');
  const planAbs = join(root, plan.relativePath);
  mkdirSync(dirname(planAbs), { recursive: true });
  writeFileSync(planAbs, plan.content, 'utf8');
  return { root, files, plan, planAbs, initiativePath, f1Source };
}

function renderFrontmatter(frontmatter, body) {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function seedGuardClaim(
  lockPath,
  { pid, token, choosing = false, ticket = 1, processIdentity },
) {
  const guardPath = `${lockPath}.guard`;
  mkdirSync(guardPath, { recursive: true });
  const claimPath = join(guardPath, `${token}.json`);
  writeFileSync(
    claimPath,
    `${JSON.stringify({
      version: 1,
      pid,
      token,
      choosing,
      ticket,
      ...(processIdentity ? { processIdentity } : {}),
    })}\n`,
    'utf8',
  );
  return { guardPath, claimPath };
}

function candidatePair(state) {
  const capture = JSON.parse(state.f1Source.content);
  const ratifiedCapture = structuredClone(capture);
  for (const task of ratifiedCapture.tasks) {
    if (typeof task.summary !== 'string' || task.summary.trim() === '') {
      task.summary = `Complete ${task.title}`;
    }
    if (!Number.isFinite(task.weight)) task.weight = 1;
  }
  ratifiedCapture.summary = F1_SUMMARY;
  ratifiedCapture.nextAction = 'Run `done T-002` after creating the handoff checklist fixture.';
  const parsedPlan = parseFrontmatter(state.plan.content);
  assert.equal(parsedPlan.error, undefined);
  const planFm = structuredClone(parsedPlan.frontmatter);
  planFm.currentPhase = 'F1';
  planFm.lastUpdated = '2026-07-01T10:00:00.000Z';
  for (const phase of planFm.phases) {
    if (phase.id === 'F0') phase.status = 'done';
    if (phase.id === 'F1') {
      phase.summary = F1_SUMMARY;
      phase.status = 'active';
      phase.subPhaseCount = capture.tasks.length;
      phase.businessIntent = { ...BUSINESS_INTENT };
    }
  }
  const initiative = writeInitiativeFile(ratifiedCapture, 'e2e-lifecycle', {
    iso: '2026-07-01T10:00:00.000Z',
    branch: 'plan/e2e-lifecycle',
    active: true,
    stateRoot: '.atomic-skills',
    planDir: '.atomic-skills/projects/atomic-skills/e2e-lifecycle',
    projectId: 'atomic-skills',
    businessIntent: BUSINESS_INTENT,
    seenSlugs: new Set(),
    seenPaths: new Set(),
  });
  assert.equal(initiative.relativePath, state.initiativePath);
  return {
    planContent: renderFrontmatter(planFm, parsedPlan.body),
    initiativeContent: initiative.content,
    expectedPlanHash: hashBytes(state.plan.content),
  };
}

function runMaterializeWithFsShim(state, pair, shimSource, { platform } = {}) {
  const fsModuleSource = [
    "import * as fs from 'node:fs';",
    "export * from 'node:fs';",
    shimSource,
  ].join('\n');
  const fsModuleUrl = `data:text/javascript,${encodeURIComponent(fsModuleSource)}`;
  const loaderSource = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'node:fs' && context.parentURL === ${JSON.stringify(MATERIALIZE_URL)}) {
        return { url: ${JSON.stringify(fsModuleUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `;
  const loaderUrl = `data:text/javascript,${encodeURIComponent(loaderSource)}`;
  const childSource = `
    ${platform ? `Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });` : ''}
    const { materializeState } = await import(${JSON.stringify(MATERIALIZE_URL)});
    const result = materializeState(${JSON.stringify({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-fs-shim',
    })});
    console.log(JSON.stringify(result));
  `;
  return spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-loader', loaderUrl, '--input-type=module', '-e', childSource],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

test('materialization skips unsupported directory fsync on win32', () => {
  const state = fixture();
  const pair = candidatePair(state);
  try {
    const child = runMaterializeWithFsShim(state, pair, `
      export function openSync(path, ...args) {
        if (args[0] === 'r' && fs.statSync(path).isDirectory()) {
          throw new Error('directory descriptors are unsupported on win32');
        }
        return fs.openSync(path, ...args);
      }
    `, { platform: 'win32' });

    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), {
      status: 'complete',
      txId: 'tx-fs-shim',
      recovered: true,
    });
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(
      readFileSync(join(state.root, state.initiativePath), 'utf8'),
      pair.initiativeContent,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: an invalid staged pair touches no live bytes and publishes no marker', () => {
  const { root, plan, planAbs, initiativePath } = fixture();
  const before = readFileSync(planAbs);
  const markerPath = join(dirname(planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root,
        planPath: plan.relativePath,
        initiativePath,
        planContent: plan.content,
        initiativeContent: 'not valid frontmatter\n',
        expectedPlanHash: hashBytes(plan.content),
        txId: 'tx-invalid-pair',
      }),
      /validation|frontmatter|invalid/i,
    );
    assert.deepEqual(readFileSync(planAbs), before);
    assert.equal(existsSync(join(root, initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('RED: a stale plan candidate is rejected without touching either live path', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const parsed = parseFrontmatter(readFileSync(state.planAbs, 'utf8'));
  parsed.frontmatter.lastUpdated = '2026-07-01T09:30:00.000Z';
  const concurrentPlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  writeFileSync(state.planAbs, concurrentPlan, 'utf8');
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const txDir = join(dirname(state.planAbs), '.materialize-state-tx-stale-candidate');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-stale-candidate',
      }),
      /stale plan candidate: live plan hash does not match expectedPlanHash/,
    );
    assert.equal(readFileSync(state.planAbs, 'utf8'), concurrentPlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
    assert.equal(existsSync(txDir), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a new transaction requires a well-formed expectedPlanHash before staging', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const { expectedPlanHash: _omitted, ...candidateWithoutHash } = pair;
  const beforePlan = readFileSync(state.planAbs);
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...candidateWithoutHash,
        txId: 'tx-missing-expected-hash',
      }),
      /expectedPlanHash must be a lowercase sha256 hash for a new transaction/,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(
      existsSync(join(dirname(state.planAbs), '.materialize-state-tx-missing-expected-hash')),
      false,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a live per-plan lock blocks a second materialization before staging', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  writeFileSync(lockPath, `${JSON.stringify({ version: 1, pid: process.pid, token: 'held-by-test' })}\n`);
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-live-lock',
      }),
      /materialization lock is held by a live process/,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(join(dirname(state.planAbs), '.materialize-state-tx-live-lock')), false);
    assert.equal(existsSync(lockPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: an unreadable existing lock fails closed and is never reclaimed', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const partialLock = '{"version":1,"pid":';
  writeFileSync(lockPath, partialLock, 'utf8');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-unreadable-lock',
      }),
      /materialization lock is unreadable; refusing to reclaim it/,
    );
    assert.equal(readFileSync(lockPath, 'utf8'), partialLock);
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(
      existsSync(join(dirname(state.planAbs), '.materialize-state-tx-unreadable-lock')),
      false,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a crash while preparing the lock cannot brick pending marker recovery', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const lockTempPath = `${lockPath}.tmp`;
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-lock-publication-crash',
        faultAt: 'after-initiative-rename',
      }),
      /fault injection: after-initiative-rename/,
    );
    assert.equal(existsSync(markerPath), true, 'the fixture must leave recovery pending');

    const childSource = `
      import { materializeState } from ${JSON.stringify(new URL('../../scripts/materialize-state.js', import.meta.url).href)};
      materializeState({
        root: process.env.MATERIALIZE_ROOT,
        planPath: process.env.MATERIALIZE_PLAN,
        initiativePath: process.env.MATERIALIZE_INITIATIVE,
        faultAt(point) {
          if (point === 'after-lock-temp-open') process.kill(process.pid, 'SIGKILL');
        },
      });
    `;
    const crashed = spawnSync(process.execPath, ['--input-type=module', '-e', childSource], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MATERIALIZE_ROOT: state.root,
        MATERIALIZE_PLAN: state.plan.relativePath,
        MATERIALIZE_INITIATIVE: state.initiativePath,
      },
    });

    // Mutation killed: writing the owner directly to lockPath either misses this
    // crash point or exposes an empty canonical lock instead of an unpublished temp.
    assert.equal(crashed.signal, 'SIGKILL', crashed.stderr);
    assert.equal(existsSync(lockPath), false, 'an incomplete owner must never become canonical');
    assert.equal(existsSync(lockTempPath), true, 'the forced crash must leave its temp artifact');
    assert.equal(statSync(lockTempPath).size, 0, 'the crash must happen before owner bytes are written');
    assert.equal(existsSync(markerPath), true, 'lock publication must not consume the marker');

    const recovered = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(recovered.status, 'complete');
    assert.equal(recovered.recovered, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(join(state.root, state.initiativePath), 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(lockPath), false);
    assert.equal(existsSync(lockTempPath), false, 'retry must reclaim the unpublished temp');
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a partial unpublished lock temp is reclaimed before a new owner is published', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const lockTempPath = `${lockPath}.tmp`;
  writeFileSync(lockTempPath, '{"version":1,"pid":', 'utf8');
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-partial-lock-temp',
    });

    // Mutation killed: removing orphan-temp cleanup leaves this partial file behind.
    assert.equal(result.status, 'complete');
    assert.equal(existsSync(lockPath), false);
    assert.equal(existsSync(lockTempPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a lock with an invalid owner shape fails closed instead of looking dead', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const malformedOwner = `${JSON.stringify({ version: 1, token: 'missing-pid' })}\n`;
  writeFileSync(lockPath, malformedOwner, 'utf8');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-malformed-lock-owner',
      }),
      /materialization lock is unreadable; refusing to reclaim it/,
    );
    assert.equal(readFileSync(lockPath, 'utf8'), malformedOwner);
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a live reclaim guard serializes stale-lock takeover before either contender stages', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const lockTempPath = `${lockPath}.tmp`;
  const staleOwner = `${JSON.stringify({
    version: 1,
    pid: 2_147_483_646,
    token: 'dead-owner',
  })}\n`;
  const liveReclaimerTemp = `${JSON.stringify({
    version: 1,
    pid: process.pid,
    token: 'live-reclaimer',
  })}\n`;
  writeFileSync(lockPath, staleOwner, 'utf8');
  writeFileSync(lockTempPath, liveReclaimerTemp, 'utf8');
  seedGuardClaim(lockPath, {
    pid: process.pid,
    token: 'live-reclaimer',
    choosing: false,
    ticket: 1,
  });
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-reclaim-guard',
      }),
      /materialization lock guard is held by a live process/,
    );
    assert.equal(readFileSync(lockPath, 'utf8'), staleOwner);
    // Mutation killed: moving temp reclamation outside the acquired guard lets
    // this losing contender delete the live reclaimer's unpublished owner.
    assert.equal(readFileSync(lockTempPath, 'utf8'), liveReclaimerTemp);
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(
      existsSync(join(dirname(state.planAbs), '.materialize-state-tx-reclaim-guard')),
      false,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a stalled guard contender cannot prevent the main-lock owner from releasing', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  let blocker;
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-release-under-stalled-guard',
      faultAt(point) {
        if (point === 'before-plan-rename' && !blocker) {
          blocker = seedGuardClaim(lockPath, {
            pid: process.pid,
            token: 'stalled-live-contender',
            choosing: false,
            ticket: 1,
          });
        }
      },
    });
    assert.equal(result.status, 'complete');
    assert.equal(existsSync(lockPath), false, 'the owning process must always release its main lock');
    assert.equal(existsSync(blocker.claimPath), true, 'the release must not steal a live claim');
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: guard setup retries when cleanup removes the empty directory after mkdir', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const guardPath = `${lockPath}.guard`;
  let removed = 0;
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-guard-directory-retry',
      faultAt(point) {
        if (point === 'after-guard-mkdir' && removed === 0) {
          rmSync(guardPath, { recursive: true, force: true });
          removed += 1;
        }
      },
    });
    assert.equal(removed, 1, 'the deterministic cleanup race must be exercised');
    assert.equal(result.status, 'complete');
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a claim from a reused PID is reclaimed by process-start identity', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  const staleClaim = seedGuardClaim(lockPath, {
    pid: process.pid,
    token: 'claim-from-previous-process-instance',
    choosing: true,
    ticket: null,
    processIdentity: 'stale-process-instance',
  });
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-reused-pid-claim',
    });
    assert.equal(result.status, 'complete');
    assert.equal(existsSync(staleClaim.claimPath), false);
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: process identity is stable across contender locale and timezone', {
  skip: process.platform !== 'darwin',
}, async () => {
  const state = fixture();
  const pair = candidatePair(state);
  const optionsPath = join(state.root, 'child-materialize-options.json');
  writeFileSync(optionsPath, JSON.stringify({
    root: state.root,
    planPath: state.plan.relativePath,
    initiativePath: state.initiativePath,
    ...pair,
    txId: 'tx-locale-owner',
  }), 'utf8');
  const parentStart = spawnSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], {
    encoding: 'utf8',
    env: process.env,
  }).stdout.trim();
  const alternateTimezone = ['Pacific/Kiritimati', 'UTC', 'America/Los_Angeles']
    .find((timezone) => {
      const rendered = spawnSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], {
        encoding: 'utf8',
        env: { ...process.env, LC_ALL: 'C', LANG: 'C', TZ: timezone },
      }).stdout.trim();
      return rendered && rendered !== parentStart;
    });
  assert.ok(alternateTimezone, 'the test requires a timezone that changes ps lstart rendering');

  const childSource = `
    import { readFileSync } from 'node:fs';
    import { materializeState } from ${JSON.stringify(new URL('../../scripts/materialize-state.js', import.meta.url).href)};
    const options = JSON.parse(readFileSync(process.argv[1], 'utf8'));
    materializeState({
      ...options,
      faultAt(point) {
        if (point === 'before-plan-rename') {
          process.stdout.write('READY\\n');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
        }
      },
    });
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', childSource, optionsPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LC_ALL: 'C',
      LANG: 'C',
      TZ: alternateTimezone,
    },
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await new Promise((resolveReady, rejectReady) => {
      let stdout = '';
      const timeout = setTimeout(
        () => rejectReady(new Error(`child did not reach lock barrier: ${stderr}`)),
        5_000,
      );
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (stdout.includes('READY\n')) {
          clearTimeout(timeout);
          resolveReady();
        }
      });
      child.once('exit', (code) => {
        if (!stdout.includes('READY\n')) {
          clearTimeout(timeout);
          rejectReady(new Error(`child exited ${code} before lock barrier: ${stderr}`));
        }
      });
    });

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
      }),
      /materialization lock is held by a live process/,
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await new Promise((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) resolveExit();
      else child.once('exit', resolveExit);
    });
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a lock owned by a dead process is reclaimed and does not brick recovery', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  writeFileSync(lockPath, `${JSON.stringify({
    version: 1,
    pid: 2_147_483_646,
    token: 'dead-owner',
  })}\n`);
  const deadGuard = seedGuardClaim(lockPath, {
    pid: 2_147_483_646,
    token: 'dead-guard-owner',
    choosing: false,
    ticket: 1,
  });
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-dead-lock',
    });
    assert.equal(result.status, 'complete');
    assert.equal(existsSync(lockPath), false);
    assert.equal(existsSync(deadGuard.claimPath), false);
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a serial candidate rejects two active descriptors and divergent currentPhase', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsed = parseFrontmatter(pair.planContent);
  parsed.frontmatter.currentPhase = 'F0';
  parsed.frontmatter.phases.find((phase) => phase.id === 'F0').status = 'active';
  const contradictoryPlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        planContent: contradictoryPlan,
        txId: 'tx-serial-focus',
      }),
      (error) => {
        assert.match(error.message, /serial plan must have exactly one active descriptor \(found 2\)/);
        assert.match(error.message, /serial plan currentPhase must match initiative phaseId/);
        return true;
      },
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(join(dirname(state.planAbs), '.materialize-state.json')), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: staged validation rejects duplicate ids when only the first descriptor is active', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsed = parseFrontmatter(pair.planContent);
  const duplicate = structuredClone(
    parsed.frontmatter.phases.find((phase) => phase.id === 'F1'),
  );
  duplicate.status = 'pending';
  parsed.frontmatter.phases.push(duplicate);
  const duplicatePlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const txDir = join(dirname(state.planAbs), '.materialize-state-tx-duplicate-active-id');
  try {
    // Mutation killed: removing the id-set guard lets find() select the first F1
    // and publishes the ambiguous active/pending pair.
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        planContent: duplicatePlan,
        txId: 'tx-duplicate-active-id',
      }),
      /plan phase id "F1" is duplicated/,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
    assert.equal(existsSync(txDir), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: phase ids are globally unique even outside parallel focus', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsed = parseFrontmatter(pair.planContent);
  parsed.frontmatter.parallelismAllowed = true;
  const duplicate = structuredClone(
    parsed.frontmatter.phases.find((phase) => phase.id === 'F0'),
  );
  duplicate.status = 'pending';
  parsed.frontmatter.phases.push(duplicate);
  const duplicatePlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const txDir = join(dirname(state.planAbs), '.materialize-state-tx-duplicate-unfocused-id');
  try {
    // Mutation killed: limiting uniqueness to initiative.phaseId misses duplicate F0.
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        planContent: duplicatePlan,
        txId: 'tx-duplicate-unfocused-id',
      }),
      /plan phase id "F0" is duplicated/,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
    assert.equal(existsSync(txDir), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('staged validation rejects incomplete task metadata and nextAction before the marker', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsed = parseFrontmatter(pair.initiativeContent);
  parsed.frontmatter.nextAction = '';
  const task = parsed.frontmatter.tasks[0];
  const taskId = task.id;
  delete task.summary;
  delete task.weight;
  delete task.verifier;
  delete task.outputs;
  const incompleteInitiative = renderFrontmatter(parsed.frontmatter, parsed.body);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        initiativeContent: incompleteInitiative,
        txId: 'tx-incomplete-task-metadata',
      }),
      (error) => {
        assert.match(error.message, /materialized initiative nextAction is required/);
        assert.match(error.message, new RegExp(`task ${taskId} summary is required`));
        assert.match(error.message, new RegExp(`task ${taskId} weight is required`));
        assert.match(error.message, new RegExp(`task ${taskId} completion signal is required`));
        return true;
      },
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('staged validation rejects mismatched phase summaries before the marker', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsed = parseFrontmatter(pair.initiativeContent);
  parsed.frontmatter.summary = 'A different, unratified phase purpose.';
  const mismatchedInitiative = renderFrontmatter(parsed.frontmatter, parsed.body);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        initiativeContent: mismatchedInitiative,
        txId: 'tx-mismatched-phase-summary',
      }),
      /descriptor summary does not match initiative summary/,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('parallel candidates may activate a selected phase while currentPhase names another selected phase', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const parsed = parseFrontmatter(pair.planContent);
  parsed.frontmatter.parallelismAllowed = true;
  parsed.frontmatter.currentPhase = 'F0';
  parsed.frontmatter.phases.find((phase) => phase.id === 'F0').status = 'active';
  const parallelPlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      planContent: parallelPlan,
      txId: 'tx-parallel-focus',
    });
    assert.equal(result.status, 'complete');
    assert.equal(readFileSync(state.planAbs, 'utf8'), parallelPlan);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: both businessIntent surfaces are required before either live path changes', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const parsedPlan = parseFrontmatter(pair.planContent);
  delete parsedPlan.frontmatter.phases.find((phase) => phase.id === 'F1').businessIntent;
  const parsedInitiative = parseFrontmatter(pair.initiativeContent);
  delete parsedInitiative.frontmatter.businessIntent;
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        planContent: renderFrontmatter(parsedPlan.frontmatter, parsedPlan.body),
        initiativeContent: renderFrontmatter(parsedInitiative.frontmatter, parsedInitiative.body),
        txId: 'tx-missing-business-intent',
      }),
      (error) => {
        assert.match(error.message, /materialized descriptor businessIntent is required/);
        assert.match(error.message, /materialized initiative businessIntent is required/);
        return true;
      },
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
    assert.equal(existsSync(join(dirname(state.planAbs), '.materialize-state.json')), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: successful publication preserves the existing plan permission bits', () => {
  const state = fixture();
  const pair = candidatePair(state);
  chmodSync(state.planAbs, 0o640);
  try {
    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-plan-mode',
    });
    assert.equal(result.status, 'complete');
    assert.equal(statSync(state.planAbs).mode & 0o777, 0o640);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('fault after initiative rename leaves a durable marker and retry completes initiative then plan', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs, 'utf8');
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const lockPath = join(dirname(state.planAbs), '.materialize-state.lock');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-after-initiative',
        faultAt: 'after-initiative-rename',
      }),
      /fault injection: after-initiative-rename/,
    );
    assert.equal(readFileSync(state.planAbs, 'utf8'), beforePlan);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.equal(marker.txId, 'tx-after-initiative');
    assert.ok(Object.values(marker.paths).every((path) => !path.startsWith('/')));
    assert.match(marker.hashes.plan.before, /^[a-f0-9]{64}$/);
    assert.match(marker.hashes.plan.after, /^[a-f0-9]{64}$/);
    assert.equal(existsSync(lockPath), false, 'fault unwinding releases the per-plan lock');
    const deadGuard = seedGuardClaim(lockPath, {
      pid: 2_147_483_646,
      token: 'dead-guard-before-marker-recovery',
      choosing: false,
      ticket: 1,
    });

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'complete');
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), false);
    assert.equal(existsSync(deadGuard.claimPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a concurrent live-plan write immediately before publish is preserved and blocks the rename', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const parsed = parseFrontmatter(readFileSync(state.planAbs, 'utf8'));
  parsed.frontmatter.lastUpdated = '2026-07-01T10:00:00.001Z';
  const concurrentPlan = renderFrontmatter(parsed.frontmatter, parsed.body);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  let injected = false;
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-concurrent-plan-before-publish',
        faultAt(point) {
          if (point === 'before-plan-rename') {
            injected = true;
            writeFileSync(state.planAbs, concurrentPlan, 'utf8');
          }
        },
      }),
      /live plan changed before publish; refusing writes/,
    );
    assert.equal(injected, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), concurrentPlan);
    assert.equal(existsSync(join(state.root, state.initiativePath)), true);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a concurrent initiative write after its rename blocks plan publication', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs, 'utf8');
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const concurrentInitiative = 'concurrent-initiative-corruption\n';
  let injected = false;
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-concurrent-initiative-after-publish',
        faultAt(point) {
          if (point === 'after-initiative-rename' && !injected) {
            writeFileSync(initiativeAbs, concurrentInitiative, 'utf8');
            injected = true;
          }
        },
      }),
      /live initiative changed before plan publish; refusing writes/,
    );
    assert.equal(injected, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), beforePlan);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), concurrentInitiative);
    assert.equal(existsSync(markerPath), true, 'recovery authority remains for fail-closed repair');
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: a concurrent write after plan rename keeps the recovery marker', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const concurrentInitiative = 'concurrent-write-before-finalize\n';
  let injected = false;
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-concurrent-pair-before-finalize',
        faultAt(point) {
          if (point === 'after-plan-rename' && !injected) {
            writeFileSync(initiativeAbs, concurrentInitiative, 'utf8');
            injected = true;
          }
        },
      }),
      /published materialization pair changed before finalize; retaining marker/,
    );
    assert.equal(injected, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), concurrentInitiative);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: CLI recovery succeeds after both candidate temp files are gone', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const planCandidate = join(state.root, 'plan-candidate.md');
  const initiativeCandidate = join(state.root, 'initiative-candidate.md');
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  writeFileSync(planCandidate, pair.planContent, 'utf8');
  writeFileSync(initiativeCandidate, pair.initiativeContent, 'utf8');
  const args = [
    MATERIALIZE_SCRIPT,
    '--root', state.root,
    '--plan', state.plan.relativePath,
    '--initiative', state.initiativePath,
    '--plan-candidate', 'plan-candidate.md',
    '--initiative-candidate', 'initiative-candidate.md',
    '--expected-plan-hash', pair.expectedPlanHash,
    '--tx-id', 'tx-cli-lost-candidates',
  ];
  try {
    const interrupted = spawnSync(process.execPath, [...args, '--fault', 'after-initiative-rename'], {
      encoding: 'utf8',
    });
    assert.equal(interrupted.status, 1, interrupted.stdout || interrupted.stderr);
    assert.match(interrupted.stderr, /fault injection: after-initiative-rename/);
    assert.equal(existsSync(markerPath), true);

    rmSync(planCandidate);
    rmSync(initiativeCandidate);
    const recovered = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.deepEqual(JSON.parse(recovered.stdout), {
      status: 'complete',
      txId: 'tx-cli-lost-candidates',
      recovered: true,
    });
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(join(state.root, state.initiativePath), 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('fault after plan rename keeps the completed pair recoverable and retry only finalizes it', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-after-plan',
        faultAt: 'after-plan-rename',
      }),
      /fault injection: after-plan-rename/,
    );
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), true);

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'complete');
    assert.equal(result.recovered, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: complete-pair recovery rechecks live bytes immediately before cleanup', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const concurrentInitiative = 'concurrent-complete-pair-write\n';
  let injected = false;
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-complete-pair-recheck',
      faultAt: 'after-plan-rename',
    }), /fault injection: after-plan-rename/);

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        faultAt(point) {
          if (point === 'before-complete-cleanup' && !injected) {
            writeFileSync(initiativeAbs, concurrentInitiative, 'utf8');
            injected = true;
          }
        },
      }),
      /completed materialization pair changed before cleanup; retaining marker/,
    );
    assert.equal(injected, true);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), concurrentInitiative);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('retry rolls back to the exact previous pair when required staging was lost', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-lost-stage',
      faultAt: 'after-initiative-rename',
    }), /fault injection/);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    rmSync(resolve(state.root, marker.paths.txDir, 'stage'), { recursive: true, force: true });

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'rolled-back');
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(initiativeAbs), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('RED: rollback rechecks the restored pair immediately before cleanup', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  const concurrentPlan = 'concurrent-rollback-write\n';
  let injected = false;
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-rollback-recheck',
      faultAt: 'after-initiative-rename',
    }), /fault injection: after-initiative-rename/);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    rmSync(resolve(state.root, marker.paths.txDir, 'stage'), { recursive: true, force: true });

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        faultAt(point) {
          if (point === 'before-rollback-cleanup' && !injected) {
            writeFileSync(state.planAbs, concurrentPlan, 'utf8');
            injected = true;
          }
        },
      }),
      /rolled-back materialization pair changed before cleanup; retaining marker/,
    );
    assert.equal(injected, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), concurrentPlan);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('retry fails closed without writes when a live hash is outside before/after', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-ambiguous',
      faultAt: 'after-initiative-rename',
    }), /fault injection/);
    writeFileSync(state.planAbs, 'concurrent unknown bytes\n', 'utf8');
    const strangePlan = readFileSync(state.planAbs);
    const publishedInitiative = readFileSync(initiativeAbs);

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
      }),
      /ambiguous live plan hash/,
    );
    assert.deepEqual(readFileSync(state.planAbs), strangePlan);
    assert.deepEqual(readFileSync(initiativeAbs), publishedInitiative);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('repeating the same completed request is idempotent', () => {
  const state = fixture();
  const pair = candidatePair(state);
  try {
    const request = {
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-idempotent',
    };
    assert.equal(materializeState(request).status, 'complete');
    const planAfter = readFileSync(state.planAbs);
    const initiativeAfter = readFileSync(join(state.root, state.initiativePath));

    const retry = materializeState(request);
    assert.equal(retry.status, 'complete');
    assert.equal(retry.idempotent, true);
    assert.deepEqual(readFileSync(state.planAbs), planAfter);
    assert.deepEqual(readFileSync(join(state.root, state.initiativePath)), initiativeAfter);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialization rejects symlinked plan ancestry without touching the external target', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const outside = mkdtempSync(join(tmpdir(), 'as-materialize-state-outside-'));
  const planDir = dirname(state.planAbs);
  const txDir = join(outside, '.materialize-state-tx-symlink-escape');
  const sentinel = join(txDir, 'sentinel.txt');
  const initiativeOutside = join(outside, 'phases', basename(state.initiativePath));
  const beforePlan = state.plan.content;
  try {
    rmSync(planDir, { recursive: true, force: true });
    writeFileSync(join(outside, 'plan.md'), beforePlan, 'utf8');
    mkdirSync(txDir, { recursive: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    symlinkSync(outside, planDir, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-symlink-escape',
      }),
      /symbolic link|symlink/i,
    );
    assert.equal(readFileSync(join(outside, 'plan.md'), 'utf8'), beforePlan);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.equal(existsSync(initiativeOutside), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('recovery rejects a transaction directory replaced by a symlink', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const outside = mkdtempSync(join(tmpdir(), 'as-materialize-state-recovery-outside-'));
  const sentinel = join(outside, 'sentinel.txt');
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-recovery-symlink',
        faultAt: 'after-initiative-rename',
      }),
      /fault injection: after-initiative-rename/,
    );
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const txDir = resolve(state.root, marker.paths.txDir);
    const planBeforeRetry = readFileSync(state.planAbs);
    const initiativeBeforeRetry = readFileSync(join(state.root, state.initiativePath));
    rmSync(txDir, { recursive: true, force: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    symlinkSync(outside, txDir, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
      }),
      /marker paths\.txDir.*symbolic link/i,
    );
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.deepEqual(readFileSync(state.planAbs), planBeforeRetry);
    assert.deepEqual(
      readFileSync(join(state.root, state.initiativePath)),
      initiativeBeforeRetry,
    );
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('materialization rejects an initiative path outside the supplied plan phases directory', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const foreignInitiativePath = join(
    '.atomic-skills',
    'projects',
    'atomic-skills',
    'other-plan',
    'phases',
    basename(state.initiativePath),
  );
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: foreignInitiativePath,
        ...pair,
        txId: 'tx-foreign-initiative',
      }),
      /initiativePath.*plan.*phases/i,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, foreignInitiativePath)), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialization never adopts or removes a pre-existing transaction directory', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const txDir = join(dirname(state.planAbs), '.materialize-state-tx-preexisting');
  const sentinel = join(txDir, 'sentinel.txt');
  try {
    mkdirSync(txDir, { recursive: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-preexisting',
      }),
      /transaction directory already exists/i,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialize skill routes descriptor-only publication through the package-root authority', () => {
  const detail = readFileSync(
    join(__dirname, '..', '..', 'skills', 'shared', 'project-assets', 'project-materialize.md'),
    'utf8',
  );
  const command = detail.split('\n').find((line) => line.includes('node "$PKG_ROOT/scripts/materialize-state.js"')) ?? '';
  assert.match(detail, /PKG_ROOT="\$\(cat "\$HOME\/\.atomic-skills\/package-root" 2>\/dev\/null \|\| true\)"/);
  assert.match(detail, /pkg\.name === "@henryavila\/atomic-skills"/);
  assert.match(detail, /\[ -f "\$CANDIDATE\/scripts\/materialize-state\.js" \]/);
  assert.doesNotMatch(detail, /package-root[^\n]*\|\| echo \./);
  assert.match(command, /node "\$PKG_ROOT\/scripts\/materialize-state\.js"/);
  assert.match(command, /--plan .*\/plan\.md --initiative .*\/phases\//);
  assert.match(detail, /one command, no sequential live writes/);
  assert.doesNotMatch(detail, /Write the returned initiative file with `\{\{WRITE_TOOL\}\}`/);
  assert.match(detail, /descriptor-only-to-initiative publication inside `materialize`/);
});
