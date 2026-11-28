import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  git,
  hasPython3,
  initGitRepo,
  makeFakeBin,
  readLogRecords,
  runDelegate,
} from './helpers/delegate-runner-kit.js';

const CODEX = 'gpt-6.1-sol';
const HYDROGEN_HIGH = 'gemini-4-hydrogen-high';
const HYDROGEN_XHIGH = 'gemini-4-hydrogen-xhigh';
const NEON = 'gemini-4-neon-high';
const ARGON = 'gemini-4-argon-high';
const SONNET = 'claude-sonnet-5-5-medium';
const OPUS = 'claude-opus-5-5-medium';
const LIMIT_TEXT = 'error: Individual quota reached. Resets in 10h0m0s.\n';
const REVIEW = 'R01 | minor | feature.txt:1 | nit | test | fix it\nTOTAL major=0 medium=0 minor=1\n';

// The shape printed by `agy -p /quota --output-format json` (agy 1.5.15).
function quota({ gemini = 1, geminiReset = '1970-01-01T00:00:00Z', fiveHour = 1, fiveHourDisabled = false,
  thirdParty = 1, thirdPartyReset = '1970-01-01T00:00:00Z', argon = 1, argonReset = '2026-11-27T00:00:00Z' } = {}) {
  return JSON.stringify({
    status: 'SUCCESS',
    command: { name: 'usage', data: { groups: [
      { name: 'Gemini Models', buckets: [
        { id: 'gemini-weekly', window: 'weekly', remaining_fraction: gemini, reset_time: geminiReset },
        { id: 'gemini-5h', window: '5h', remaining_fraction: fiveHour, disabled: fiveHourDisabled },
      ] },
      { name: 'Claude and GPT models', buckets: [
        { id: '3p-weekly', window: 'weekly', remaining_fraction: thirdParty, reset_time: thirdPartyReset },
        { id: '3p-5h', window: '5h', remaining_fraction: 1, reset_time: '1970-01-01T00:00:00Z' },
      ] },
      { name: 'Gemini 4 Argon', buckets: [
        { id: 'gemini-argon-wtu-weekly', window: 'weekly', remaining_fraction: argon, reset_time: argonReset },
      ] },
    ] } },
  });
}

describe('delegate.py Antigravity quota groups', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let repoDir;
  let outDir;
  let seqDir;
  let argvFile;
  let cardPath;
  let reviewCardPath;
  let baseEnv;
  let n;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-agy-quota-')));
    atomicHome = join(root, 'atomic-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    seqDir = join(root, 'seq');
    argvFile = join(root, 'argv.json');
    mkdirSync(join(atomicHome, 'delegate'), { recursive: true });
    mkdirSync(join(root, 'empty-home'), { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(seqDir, { recursive: true });
    initGitRepo(repoDir);
    cardPath = join(root, 'card.md');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(cardPath, '# Task\nDo it.\n');
    writeFileSync(reviewCardPath, '# Review\nReview the diff below.\n');
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
      DELEGATE_COOLDOWN_AGY: undefined,
      FAKE_AGY_QUOTA: undefined,
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDOUT: REVIEW,
      FAKE_LAST_MESSAGE: REVIEW,
      TZ: 'UTC',
      DELEGATE_NOW: '2026-11-20T15:00:00Z',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function record(executor, model, completed, failure, errText) {
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
  function route(env = {}, args = []) {
    const res = runDelegate(['route', '--role', 'implement', '--json', ...args], { ...baseEnv, ...env });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout);
  }
  function steps(configs, extra = {}) {
    rmSync(seqDir, { recursive: true, force: true });
    mkdirSync(seqDir, { recursive: true });
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return { ...baseEnv, DELEGATE_NOW: undefined, FAKE_SEQ_DIR: seqDir, ...extra };
  }
  function commitFeature() {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'feature.txt'), 'work\n');
    git(repoDir, 'add', 'feature.txt');
    git(repoDir, 'commit', '-m', 'feature');
    return `${base}...HEAD`;
  }
  function reviewArgs(profile, range, extra = []) {
    return ['run', '--id', 'Q1', '--task', 'quota review', '--role', 'review', '--profile', profile,
      '--cwd', repoDir, '--card', reviewCardPath, '--diff-range', range, '--out', outDir, '--confirmed', ...extra];
  }
  function pipelineArgs(reviewRoute) {
    return ['pipeline', '--id', 'P1', '--task', 'quota pipeline', '--role', 'implement', '--cwd', repoDir,
      '--card', cardPath, '--route', 'flash', '--gate', 'true', '--review-card', reviewCardPath,
      '--review-route', reviewRoute, '--out', outDir, '--confirmed'];
  }

  it('the fixed routes spend the idle Antigravity quotas before the exhausted one', () => {
    const out = route();
    assert.deepEqual(out.route, ['flash', 'codex', 'agy-argon']);
    assert.deepEqual(route({}, ['--open-design']).route, ['codex', 'agy-argon', 'agy']);
    assert.deepEqual(out.review_routes, {
      deepseek: ['muse-review', 'codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review'],
      meta: ['codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review', 'flash-review'],
      openai: ['flash-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review'],
      gemini: ['codex-review', 'flash-review', 'agy-sonnet-review'],
    });
    assert.equal(out.profiles['agy-sonnet-review'].model, SONNET);
    assert.equal(out.profiles['agy-sonnet-review'].family, 'anthropic');
    assert.equal(out.profiles['agy-opus-review'].model, OPUS);
    assert.equal(out.profiles['agy-argon'].model, ARGON);
    assert.equal(out.profiles['agy-argon-review'].family, 'gemini');
    for (const [name, pool] of [['agy', 'gemini'], ['agy-review', 'gemini'], ['agy-argon', 'argon'],
      ['agy-argon-review', 'argon'], ['agy-sonnet-review', 'claude-gpt'], ['agy-opus-review', 'claude-gpt']]) {
      assert.equal(out.profiles[name].pool, pool, name);
    }
    for (const routeName of Object.values(out.review_routes)) {
      assert.equal(routeName.includes('agy-opus-review'), false);
    }
  });

  it('a limit on one model cools its whole quota group and no other group', () => {
    writeLog([record('agy', HYDROGEN_XHIGH, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT)]);
    const out = route();
    assert.equal(out.profiles['agy-review'].cooling_until, '2026-11-21T00:00:00+00:00');
    assert.equal(out.profiles.agy.cooling_until, '2026-11-21T00:00:00+00:00');
    assert.equal(out.profiles['agy-argon'].cooling_until, null);
    assert.equal(out.profiles['agy-sonnet-review'].cooling_until, null);
    assert.equal(out.profiles['agy-opus-review'].cooling_until, null);
  });

  it('a later run of another model in the group ends the limit of the group', () => {
    writeLog([
      record('agy', HYDROGEN_XHIGH, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT),
      record('agy', NEON, '2026-11-20T14:30:00+00:00', 'none'),
    ]);
    assert.equal(route().profiles.agy.cooling_until, null);
  });

  it('a limit on Sonnet cools Opus, and a limit on Argon leaves the Gemini group alone', () => {
    writeLog([
      record('agy', SONNET, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT),
      record('agy', ARGON, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT),
    ]);
    const out = route();
    assert.ok(out.profiles['agy-opus-review'].cooling_until);
    assert.ok(out.profiles['agy-argon-review'].cooling_until);
    assert.equal(out.profiles.agy.cooling_until, null);
  });

  it('an old log line of a model outside the known groups keeps its own limit', () => {
    writeLog([record('agy', 'gemini-future-model', '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT)]);
    const out = route();
    assert.equal(out.profiles.agy.cooling_until, null);
    assert.equal(out.profiles['agy-argon'].cooling_until, null);
  });

  it('the live quota marks an exhausted group with its real reset, with no run in the log', () => {
    const out = route({ FAKE_AGY_QUOTA: quota({ gemini: 0, geminiReset: '2026-11-28T15:53:46Z' }) });
    assert.equal(out.profiles.agy.cooling_until, '2026-11-28T15:53:46+00:00');
    assert.equal(out.profiles['agy-review'].reset_source, 'quota');
    assert.equal(out.profiles['agy-argon'].cooling_until, null);
    assert.equal(out.profiles['agy-sonnet-review'].cooling_until, null);
    assert.deepEqual(out.review_routes.deepseek,
      ['muse-review', 'codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review']);
    assert.equal(out.quota.gemini.remaining, 0);
    assert.equal(out.quota['claude-gpt'].remaining, 1);
  });

  it('the live quota replaces an older limit read from the log, in both directions', () => {
    writeLog([record('agy', HYDROGEN_HIGH, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT)]);
    assert.equal(route({ FAKE_AGY_QUOTA: quota({ gemini: 0.4 }) }).profiles.agy.cooling_until, null);
    const later = route({ FAKE_AGY_QUOTA: quota({ gemini: 0, geminiReset: '2026-11-28T15:53:46Z' }) });
    assert.equal(later.profiles.agy.cooling_until, '2026-11-28T15:53:46+00:00');
  });

  it('a disabled bucket and a reset already past do not count as exhausted', () => {
    const disabled = route({ FAKE_AGY_QUOTA: quota({ fiveHour: 0, fiveHourDisabled: true }) });
    assert.equal(disabled.profiles.agy.cooling_until, null);
    const past = route({ FAKE_AGY_QUOTA: quota({ gemini: 0, geminiReset: '2026-11-19T00:00:00Z' }) });
    assert.equal(past.profiles.agy.cooling_until, null);
    assert.equal(past.quota.gemini.remaining, 1);
    assert.equal(past.profiles.agy.quota_remaining, 1);
  });

  it('without a readable /quota the runner falls back to the log', () => {
    writeLog([record('agy', HYDROGEN_XHIGH, '2026-11-20T14:00:00+00:00', 'provider_limit', LIMIT_TEXT)]);
    for (const env of [{}, { FAKE_AGY_QUOTA: 'not json' }, { FAKE_AGY_QUOTA: '{"status":"SUCCESS"}' },
      { FAKE_AGY_QUOTA: quota({ gemini: 0.5 }), FAKE_AGY_QUOTA_EXIT: '2' }]) {
      const out = route(env);
      assert.equal(out.profiles.agy.cooling_until, '2026-11-21T00:00:00+00:00');
      assert.equal(out.profiles.agy.reset_source, 'provider');
    }
  });

  it('prints the quota of each group in the text output of route', () => {
    const res = runDelegate(['route', '--role', 'implement'],
      { ...baseEnv, FAKE_AGY_QUOTA: quota({ gemini: 0, geminiReset: '2026-11-28T15:53:46Z', argon: 0.5 }) });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^agy quota: gemini 0% until 2026-11-28T15:53:46\+00:00, claude-gpt 100%, argon 50%$/m);
  });

  it('Sonnet via Antigravity reviews other families on the Antigravity login', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs('agy-sonnet-review', range, ['--author-family', 'deepseek']), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.equal(argv[argv.indexOf('--model') + 1], SONNET);
    const rec = readLogRecords(atomicHome).find(r => r.kind === 'run');
    assert.equal(rec.executor, 'agy');
    assert.equal(rec.family, 'anthropic');
    assert.equal(rec.failure, 'none');
  });

  for (const [label, args, pattern] of [
    ['with no author family', [], /--author-family/],
    ['of code written by Claude', ['--author-family', 'anthropic'], /never of the family/],
  ]) {
    it(`a Claude model via Antigravity refuses a review ${label}`, () => {
      const range = commitFeature();
      for (const profile of ['agy-sonnet-review', 'agy-opus-review']) {
        rmSync(argvFile, { force: true });
        const res = runDelegate(reviewArgs(profile, range, args), baseEnv);
        assert.equal(res.status, 2, res.stderr);
        assert.match(res.stderr, pattern);
        assert.equal(existsSync(argvFile), false);
      }
    });
  }

  it('a Claude model via Antigravity never implements, by profile or by explicit model', () => {
    for (const selector of [['--profile', 'agy-sonnet-review'], ['--profile', 'agy-opus-review'],
      ['--executor', 'agy', '--model', 'claude-opus-5-5-high']]) {
      const res = runDelegate(['run', '--id', 'Q2', '--task', 'no', '--role', 'implement', ...selector,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'], baseEnv);
      assert.equal(res.status, 2, res.stderr);
      assert.match(res.stderr, /only review/);
      assert.equal(existsSync(argvFile), false);
    }
    const piped = runDelegate(['pipeline', '--id', 'Q3', '--task', 'no', '--role', 'implement', '--cwd', repoDir,
      '--card', cardPath, '--route', 'agy-sonnet-review', '--gate', 'true', '--review-card', reviewCardPath,
      '--review-route', 'codex-review', '--out', outDir, '--confirmed'], baseEnv);
    assert.equal(piped.status, 2, piped.stderr);
    assert.match(piped.stderr, /only review/);
  });

  it('an explicit Claude model via Antigravity still needs the author family', () => {
    const range = commitFeature();
    const res = runDelegate(['run', '--id', 'Q4', '--task', 'no', '--role', 'review', '--executor', 'agy',
      '--model', SONNET, '--cwd', repoDir, '--card', reviewCardPath, '--diff-range', range,
      '--out', outDir, '--confirmed'], baseEnv);
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /--author-family/);
  });

  it('Opus reviews a small diff and refuses a large one before launching', () => {
    const range = commitFeature();
    const small = runDelegate(reviewArgs('agy-opus-review', range, ['--author-family', 'openai']), baseEnv);
    assert.equal(small.status, 0, small.stderr);
    rmSync(argvFile, { force: true });
    writeFileSync(reviewCardPath, `# Review\n${'x'.repeat(41 * 1024)}\n`);
    const large = runDelegate(reviewArgs('agy-opus-review', range, ['--author-family', 'openai']), baseEnv);
    assert.equal(large.status, 1);
    assert.equal(existsSync(argvFile), false);
    const rec = readLogRecords(atomicHome).filter(r => r.kind === 'run').at(-1);
    assert.equal(rec.failure, 'review_over_model_cap');
  });

  it('a pipeline moves past Opus when the review is above its cap', () => {
    writeFileSync(reviewCardPath, `# Review\n${'x'.repeat(41 * 1024)}\n`);
    const res = runDelegate(pipelineArgs('agy-opus-review,codex-review'),
      steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, {}]));
    assert.equal(res.status, 0, res.stderr + res.stdout);
    const pipe = readLogRecords(atomicHome).find(r => r.kind === 'pipeline');
    assert.equal(pipe.outcome, 'reviewed');
    assert.equal(pipe.reviewer_profile, 'codex-review');
  });

  it('a review over the Opus cap does not stop a pending review when the others are out of quota', () => {
    writeFileSync(reviewCardPath, `# Review\n${'x'.repeat(41 * 1024)}\n`);
    const res = runDelegate(pipelineArgs('agy-opus-review,codex-review'), steps([
      { FAKE_COMMIT_FILE: 'feature.txt' },
      { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' },
    ]));
    assert.notEqual(res.status, 0);
    const pipe = readLogRecords(atomicHome).find(r => r.kind === 'pipeline');
    assert.equal(pipe.outcome, 'review_pending');
  });

  it('a silent Antigravity review stays alive while its own log grows', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs('agy-argon-review', range, ['--idle-timeout', '4']),
      { ...baseEnv, FAKE_LOG_TICKS: '9' });
    assert.equal(res.status, 0, res.stderr + res.stdout);
    const rec = readLogRecords(atomicHome).find(r => r.kind === 'run');
    assert.equal(rec.failure, 'none');
    assert.ok(rec.duration_s >= 8, JSON.stringify(rec));
    assert.ok(existsSync(rec.agy_log), JSON.stringify(rec));
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.equal(argv[argv.indexOf('--log-file') + 1], rec.agy_log);
  });

  it('an Antigravity run whose log stops growing is still stopped at the idle limit', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs('agy-argon-review', range, ['--idle-timeout', '3']),
      { ...baseEnv, FAKE_LOG_TICKS: '1', FAKE_SLEEP: '120' });
    assert.equal(res.status, 1);
    const rec = readLogRecords(atomicHome).find(r => r.kind === 'run');
    assert.equal(rec.failure, 'stalled');
  });

  it('reads the Codex reset with a full date in the machine time zone', () => {
    const text = 'ERROR: You have hit your usage limit. Purchase more credits or try again at Nov 25th, 2026 7:44 AM.\n';
    writeLog([record('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit', text)]);
    const utc = route();
    assert.equal(utc.profiles.codex.cooling_until, '2026-11-25T07:44:00+00:00');
    assert.equal(utc.profiles.codex.reset_source, 'provider');
    const sp = route({ TZ: 'America/Sao_Paulo' });
    assert.equal(sp.profiles.codex.cooling_until, '2026-11-25T10:44:00+00:00');
  });

  for (const [label, when, iso] of [
    ['1st', 'Dec 1st, 2026 12:05 AM', '2026-12-01T00:05:00+00:00'],
    ['2nd in PM', 'Dec 2nd, 2026 12:30 PM', '2026-12-02T12:30:00+00:00'],
    ['3rd', 'Dec 3rd, 2026 1:00 PM', '2026-12-03T13:00:00+00:00'],
  ]) {
    it(`reads the ordinal date of a Codex reset: ${label}`, () => {
      writeLog([record('codex', CODEX, '2026-11-20T14:00:00+00:00', 'provider_limit', `try again at ${when}.`)]);
      assert.equal(route().profiles.codex.cooling_until, iso);
    });
  }

  it('an impossible Codex date falls back to the default cooldown', () => {
    writeLog([record('codex', CODEX, '2026-11-20T14:30:00+00:00', 'provider_limit',
      'try again at Feb 31st, 2026 7:44 AM.')]);
    const out = route();
    assert.equal(out.profiles.codex.cooling_until, '2026-11-20T15:30:00+00:00');
    assert.equal(out.profiles.codex.reset_source, 'default');
  });
});
