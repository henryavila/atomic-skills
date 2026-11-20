import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasPython3,
  makeFakeBin,
  runDelegate,
} from './helpers/delegate-runner-kit.js';

const FLASH = 'opencode-go/deepseek-v4.1-flash';
const CODEX = 'gpt-6.1-sol';
const AGY_REVIEW = 'gemini-4-hydrogen-xhigh';

describe('delegate.py route and availability', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let baseEnv;
  let n;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-route-')));
    atomicHome = join(root, 'atomic-home');
    mkdirSync(join(atomicHome, 'delegate'), { recursive: true });
    mkdirSync(join(root, 'empty-home'), { recursive: true });
    const fakes = makeFakeBin(root, ['opencode', 'codex', 'agy', 'claude']);
    n = 0;
    baseEnv = {
      PATH: `${fakes.binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: join(root, 'empty-home'),
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_NO_FALLBACK_PATHS: '1',
      DELEGATE_CODEX_MODEL: undefined,
      DELEGATE_OPENCODE_MODEL: undefined,
      DELEGATE_COOLDOWN_CODEX: undefined,
      DELEGATE_COOLDOWN_AGY: undefined,
      DELEGATE_COOLDOWN_OPENCODE: undefined,
      TZ: 'UTC',
      DELEGATE_NOW: '2026-11-20T15:00:00Z',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(executor, model, completed, failure, errText) {
    const rec = { kind: 'run', id: `T${n}`, role: 'review', executor, model, completed, failure,
      started: completed, duration_s: 1 };
    if (errText !== undefined) {
      rec.stderr = join(root, `run-${n}.err`);
      writeFileSync(rec.stderr, errText);
    }
    n += 1;
    return rec;
  }
  function writeLog(records) {
    writeFileSync(join(atomicHome, 'delegate', 'runs.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
  }
  function route(args = [], env = {}) {
    const res = runDelegate(['route', '--role', 'implement', '--json', ...args], { ...baseEnv, ...env });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout);
  }

  it('with no log every profile is usable and the routes are the fixed ones', () => {
    const out = route();
    assert.deepEqual(out.route, ['flash', 'codex']);
    assert.deepEqual(out.review_routes, {
      deepseek: ['codex-review', 'agy-review'],
      openai: ['flash-review', 'agy-review'],
      gemini: ['codex-review', 'flash-review'],
    });
    assert.deepEqual(out.warnings, []);
    for (const name of ['flash', 'flash-review', 'codex', 'codex-review', 'agy', 'agy-review']) {
      assert.equal(out.profiles[name].found, true, name);
      assert.equal(out.profiles[name].cooling_until, null, name);
    }
    assert.equal(out.profiles.codex.slots_free, 1);
  });

  it('--open-design and the mechanical role use their own fixed routes', () => {
    assert.deepEqual(route(['--open-design']).route, ['codex', 'agy']);
    const res = runDelegate(['route', '--role', 'mechanical', '--json'], baseEnv);
    assert.deepEqual(JSON.parse(res.stdout).route, ['flash', 'codex']);
    const review = runDelegate(['route', '--role', 'review'], baseEnv);
    assert.notEqual(review.status, 0);
  });

  it('reads the Codex reset time as local wall-clock time after the limit', () => {
    writeLog([run('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit',
      'ERROR: You’ve hit your usage limit. Upgrade to Pro, or try again at 5:51 PM.\n')]);
    const out = route();
    assert.equal(out.profiles['codex-review'].cooling_until, '2026-11-20T17:51:00+00:00');
    assert.equal(out.profiles.codex.cooling_until, '2026-11-20T17:51:00+00:00');
    assert.equal(out.profiles.codex.reset_source, 'provider');
    assert.deepEqual(out.route, ['flash', 'codex']);
    assert.deepEqual(out.review_routes.deepseek, ['agy-review', 'codex-review']);
    assert.deepEqual(out.review_routes.gemini, ['flash-review', 'codex-review']);
    assert.deepEqual(out.warnings, []);
  });

  it('honours the machine time zone and rolls a past clock time to the next day', () => {
    writeLog([run('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit', 'try again at 12:28 PM.')]);
    // 14:00 UTC is 11:00 in America/Sao_Paulo (UTC-3); 12:28 PM there is 15:28 UTC.
    const sp = route([], { TZ: 'America/Sao_Paulo' });
    assert.equal(sp.profiles.codex.cooling_until, '2026-11-20T15:28:00+00:00');
    // In UTC 12:28 PM is already past at 14:00, so it means tomorrow.
    const utc = route();
    assert.equal(utc.profiles.codex.cooling_until, '2026-11-21T12:28:00+00:00');
  });

  it('reads the Antigravity "Resets in" duration and keys the limit by model', () => {
    writeLog([run('agy', AGY_REVIEW, '2026-11-20T14:00:00+00:00', 'provider_limit',
      'error: Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 107h24m20s.\n')]);
    const out = route();
    assert.equal(out.profiles['agy-review'].cooling_until, '2026-11-25T01:24:20+00:00');
    assert.equal(out.profiles.agy.cooling_until, null);
    assert.deepEqual(out.review_routes.openai, ['flash-review', 'agy-review']);
  });

  it('falls back to the default cooldown, which the environment can change', () => {
    writeLog([run('codex', CODEX, '2026-11-20T14:30:00+00:00', 'provider_limit', 'rate limit')]);
    const out = route();
    assert.equal(out.profiles.codex.cooling_until, '2026-11-20T15:30:00+00:00');
    assert.equal(out.profiles.codex.reset_source, 'default');
    assert.equal(route([], { DELEGATE_COOLDOWN_CODEX: '10m' }).profiles.codex.cooling_until, null);
    assert.equal(route([], { DELEGATE_COOLDOWN_CODEX: '2h' }).profiles.codex.cooling_until,
      '2026-11-20T16:30:00+00:00');
  });

  it('a limit whose stderr file is gone uses the default cooldown', () => {
    const rec = run('codex', CODEX, '2026-11-20T14:30:00+00:00', 'provider_limit', 'try again at 11:00 PM.');
    rmSync(rec.stderr);
    writeLog([rec]);
    assert.equal(route().profiles.codex.cooling_until, '2026-11-20T15:30:00+00:00');
  });

  it('a later run that reached the provider clears the limit; one that never ran does not', () => {
    const limit = run('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit', 'try again at 11:00 PM.');
    writeLog([limit, run('codex', CODEX, '2026-11-20T14:20:00+00:00', 'slot_timeout')]);
    assert.equal(route().profiles.codex.cooling_until, '2026-11-20T23:00:00+00:00');
    writeLog([limit, run('codex', CODEX, '2026-11-20T14:20:00+00:00', 'none')]);
    assert.equal(route().profiles.codex.cooling_until, null);
    // Order in the file does not matter, only the completion time.
    writeLog([run('codex', CODEX, '2026-11-20T14:20:00+00:00', 'none'), limit]);
    assert.equal(route().profiles.codex.cooling_until, null);
  });

  it('a limit that already ended is not reported', () => {
    writeLog([run('codex', CODEX, '2026-11-20T10:00:00+00:00', 'provider_limit', 'try again at 2:59 PM.')]);
    assert.equal(route().profiles.codex.cooling_until, null);
  });

  it('warns when no reviewer of another family is usable and names the first one back', () => {
    writeLog([
      run('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit', 'try again at 5:51 PM.'),
      run('agy', AGY_REVIEW, '2026-11-20T14:10:00+00:00', 'provider_limit', 'Resets in 100h0m0s.'),
    ]);
    const out = route();
    assert.equal(out.warnings.length, 1);
    assert.match(out.warnings[0], /^flash: no reviewer usable now; first back: codex-review at 2026-11-20T17:51:00\+00:00/);
    const text = runDelegate(['route', '--role', 'implement'], baseEnv);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /^route: flash,codex$/m);
    assert.match(text.stdout, /^review route after flash \(deepseek\): codex-review,agy-review$/m);
    assert.match(text.stdout, /^cooling: codex, codex-review until 2026-11-20T17:51:00\+00:00 \(provider\)$/m);
    assert.match(text.stdout, /^warning: flash: no reviewer usable now/m);
  });

  it('a missing CLI moves its profiles to the end and is named', () => {
    const fakes = makeFakeBin(join(root, 'partial'), ['opencode', 'agy']);
    const out = route([], { PATH: `${fakes.binDir}:/usr/bin:/bin` });
    assert.equal(out.profiles.codex.found, false);
    assert.deepEqual(out.review_routes.deepseek, ['agy-review', 'codex-review']);
    assert.deepEqual(out.route, ['flash', 'codex']);
  });

  it('ignores broken log lines and unknown models', () => {
    writeFileSync(join(atomicHome, 'delegate', 'runs.jsonl'),
      'not json\n' + JSON.stringify(run('codex', 'some-old-model', '2026-11-20T14:50:00+00:00', 'provider_limit', 'rate limit')) + '\n{"kind":"run"}\n');
    assert.equal(route().profiles.codex.cooling_until, null);
  });
});
