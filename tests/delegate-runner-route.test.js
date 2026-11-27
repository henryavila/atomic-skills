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
    assert.deepEqual(out.route, ['flash', 'codex', 'agy-argon']);
    assert.deepEqual(out.review_routes, {
      deepseek: ['muse-review', 'codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review'],
      meta: ['codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review', 'flash-review'],
      openai: ['flash-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review'],
      gemini: ['codex-review', 'flash-review', 'agy-sonnet-review'],
    });
    assert.deepEqual(out.warnings, []);
    assert.equal(out.peak, false);
    for (const name of ['flash', 'flash-review', 'muse', 'muse-review', 'codex', 'codex-review', 'agy', 'agy-review']) {
      assert.equal(out.profiles[name].found, true, name);
      assert.equal(out.profiles[name].cooling_until, null, name);
    }
    assert.equal(out.profiles.codex.slots_free, 1);
  });

  it('off-peak the executor route has no muse and the JSON says so', () => {
    const out = route([], { DELEGATE_PEAK_WINDOWS: '01:00-04:00,06:00-10:00', DELEGATE_NOW: '2026-11-27T12:00:00Z' });
    assert.deepEqual(out.route, ['flash', 'codex', 'agy-argon']);
    assert.equal(out.peak, false);
  });

  it('in DeepSeek peak hours muse goes first, on weekdays only and never for open design', () => {
    const peakEnv = { DELEGATE_PEAK_WINDOWS: '01:00-04:00,06:00-10:00', DELEGATE_NOW: '2026-11-27T08:00:00Z' };
    const friday = route([], peakEnv);
    assert.deepEqual(friday.route, ['muse', 'flash', 'codex', 'agy-argon']);
    assert.equal(friday.peak, true);
    assert.deepEqual(route(['--open-design'], peakEnv).route, ['codex', 'agy-argon', 'agy']);
    for (const role of ['mechanical', 'test', 'fix']) {
      const res = runDelegate(['route', '--role', role, '--json'], { ...baseEnv, ...peakEnv });
      assert.deepEqual(JSON.parse(res.stdout).route, ['muse', 'flash', 'codex', 'agy-argon'], role);
    }
    const saturday = route([], { ...peakEnv, DELEGATE_NOW: '2026-11-28T08:00:00Z' });
    assert.deepEqual(saturday.route, ['flash', 'codex', 'agy-argon']);
    assert.equal(saturday.peak, false);
    // Sunday 22:00 in GMT-3 is Monday 01:00 UTC: the first peak of the week.
    assert.equal(route([], { ...peakEnv, DELEGATE_NOW: '2026-11-30T01:00:00Z' }).peak, true);
    // Friday 07:00 in GMT-3 is 10:00 UTC: the last peak of the week has ended.
    assert.equal(route([], { ...peakEnv, DELEGATE_NOW: '2026-11-27T10:00:00Z' }).peak, false);
  });

  it('the plain output names the peak route only while in peak', () => {
    const peakEnv = { ...baseEnv, DELEGATE_PEAK_WINDOWS: '01:00-04:00,06:00-10:00' };
    const inPeak = runDelegate(['route', '--role', 'implement'], { ...peakEnv, DELEGATE_NOW: '2026-11-27T08:00:00Z' });
    assert.equal(inPeak.status, 0, inPeak.stderr);
    const lines = inPeak.stdout.split('\n');
    assert.equal(lines[0], 'route: muse,flash,codex,agy-argon');
    assert.equal(lines[1], 'peak: muse first (DeepSeek peak hours)');
    assert.match(inPeak.stdout, /^review route after muse \(meta\): codex-review,agy-sonnet-review,agy-argon-review,agy-review,flash-review$/m);
    const offPeak = runDelegate(['route', '--role', 'implement'], { ...peakEnv, DELEGATE_NOW: '2026-11-27T12:00:00Z' });
    assert.doesNotMatch(offPeak.stdout, /muse first|after muse/);
    assert.match(offPeak.stdout, /^review route after flash \(deepseek\): muse-review,codex-review,/m);
  });

  it('a muse under a provider limit goes last in the peak route and in the deepseek review route', () => {
    writeLog([run('opencode', 'opencode-go/muse-spark-1.3-contributor', '2026-11-27T07:30:00+00:00', 'provider_limit', 'rate limit')]);
    const out = route([], { DELEGATE_PEAK_WINDOWS: '01:00-04:00,06:00-10:00', DELEGATE_NOW: '2026-11-27T08:00:00Z' });
    assert.deepEqual(out.route, ['flash', 'codex', 'agy-argon', 'muse']);
    assert.equal(out.review_routes.deepseek[0], 'codex-review');
    assert.equal(out.review_routes.deepseek.at(-1), 'muse-review');
    assert.equal(out.profiles.flash.cooling_until, null);
  });

  it('--open-design and the mechanical role use their own fixed routes', () => {
    assert.deepEqual(route(['--open-design']).route, ['codex', 'agy-argon', 'agy']);
    const res = runDelegate(['route', '--role', 'mechanical', '--json'], baseEnv);
    assert.deepEqual(JSON.parse(res.stdout).route, ['flash', 'codex', 'agy-argon']);
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
    assert.deepEqual(out.route, ['flash', 'agy-argon', 'codex']);
    assert.deepEqual(out.review_routes.deepseek, ['muse-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review', 'codex-review']);
    assert.deepEqual(out.review_routes.gemini, ['flash-review', 'agy-sonnet-review', 'codex-review']);
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

  it('reads the Antigravity "Resets in" duration and keys the limit by quota group', () => {
    writeLog([run('agy', AGY_REVIEW, '2026-11-20T14:00:00+00:00', 'provider_limit',
      'error: Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 107h24m20s.\n')]);
    const out = route();
    assert.equal(out.profiles['agy-review'].cooling_until, '2026-11-25T01:24:20+00:00');
    assert.equal(out.profiles.agy.cooling_until, '2026-11-25T01:24:20+00:00');
    assert.equal(out.profiles['agy-argon-review'].cooling_until, null);
    assert.deepEqual(out.review_routes.openai, ['flash-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review']);
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
      run('agy', 'claude-sonnet-5-5-medium', '2026-11-20T14:10:00+00:00', 'provider_limit', 'Resets in 100h0m0s.'),
      run('agy', 'gemini-4-argon-high', '2026-11-20T14:10:00+00:00', 'provider_limit', 'Resets in 100h0m0s.'),
      run('opencode', 'opencode-go/muse-spark-1.3-contributor', '2026-11-20T14:50:00+00:00', 'provider_limit', 'rate limit'),
    ]);
    const out = route();
    assert.equal(out.warnings.length, 1);
    assert.match(out.warnings[0], /^flash: no reviewer usable now; first back: muse-review at 2026-11-20T15:50:00\+00:00/);
    const text = runDelegate(['route', '--role', 'implement'], baseEnv);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /^route: flash,codex,agy-argon$/m);
    assert.match(text.stdout, /^review route after flash \(deepseek\): muse-review,codex-review,agy-sonnet-review,agy-argon-review,agy-review$/m);
    assert.match(text.stdout, /^cooling: codex, codex-review until 2026-11-20T17:51:00\+00:00 \(provider\)$/m);
    assert.match(text.stdout, /^warning: flash: no reviewer usable now/m);
  });

  it('a missing CLI moves its profiles to the end and is named', () => {
    const fakes = makeFakeBin(join(root, 'partial'), ['opencode', 'agy']);
    const out = route([], { PATH: `${fakes.binDir}:/usr/bin:/bin` });
    assert.equal(out.profiles.codex.found, false);
    assert.deepEqual(out.review_routes.deepseek, ['muse-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review', 'codex-review']);
    assert.deepEqual(out.route, ['flash', 'agy-argon', 'codex']);
  });

  it('ignores broken log lines and unknown models', () => {
    writeFileSync(join(atomicHome, 'delegate', 'runs.jsonl'),
      'not json\n' + JSON.stringify(run('codex', 'some-old-model', '2026-11-20T14:50:00+00:00', 'provider_limit', 'rate limit')) + '\n{"kind":"run"}\n');
    assert.equal(route().profiles.codex.cooling_until, null);
  });
});
