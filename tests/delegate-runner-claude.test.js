import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { hostname, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py Claude fallback reviewer', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let fakeBin;
  let fakePaths;
  let cardPath;
  let reviewCardPath;
  let seqDir;
  let argvFile;
  let stdinFile;
  let outDir;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-')));
    atomicHome = join(root, 'atomic-home');
    emptyHome = join(root, 'empty-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(emptyHome, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

    const fakes = makeFakeBin(root, ['codex', 'agy', 'opencode', 'claude']);
    fakeBin = fakes.binDir;
    fakePaths = fakes.paths;

    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');

    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(
      reviewCardPath,
      '# Review CARD-1\nReview the diff `git diff {{DIFF_RANGE}}`\nTOTAL major=0 medium=0 minor=0\n',
    );

    seqDir = join(root, 'seq');
    mkdirSync(seqDir, { recursive: true });

    argvFile = join(root, 'captured.argv.json');
    stdinFile = join(root, 'captured.stdin.txt');

    baseEnv = {
      PATH: `${fakeBin}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDIN_FILE: stdinFile,
      FAKE_STDOUT: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
      FAKE_LAST_MESSAGE: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
  const REVIEW = 'R01 | minor | feature.txt:1 | nit | test | fix it\nTOTAL major=0 medium=0 minor=1\n';
  const OK = { FAKE_STDOUT: REVIEW, FAKE_LAST_MESSAGE: REVIEW };
  const FORBIDDEN = ['--auto', '--dangerously-skip-permissions', '--danger-full-access',
    '--dangerously-bypass-approvals-and-sandbox', '--yolo', '--allow-dangerously-skip-permissions'];

  function env(extra = {}) {
    return { ...baseEnv, DELEGATE_NO_FALLBACK_PATHS: '1', DELEGATE_CODEX_MODEL: undefined,
      DELEGATE_CLAUDE_MODEL: undefined, ...extra };
  }
  function steps(configs, extra = {}) {
    rmSync(seqDir, { recursive: true, force: true });
    mkdirSync(seqDir, { recursive: true });
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return env({ FAKE_SEQ_DIR: seqDir, ...extra });
  }
  function commitFeature() {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'feature.txt'), 'work\n');
    git(repoDir, 'add', 'feature.txt');
    git(repoDir, 'commit', '-m', 'feature');
    return `${base}...HEAD`;
  }
  function reviewArgs(extra = []) {
    return ['run', '--id', 'C1', '--task', 'claude review', '--role', 'review', '--profile', 'claude-review',
      '--cwd', repoDir, '--card', reviewCardPath, '--out', outDir, '--confirmed', ...extra];
  }
  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'P1', '--task', 'fallback case', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review,agy-review',
      '--out', outDir, '--confirmed', ...extra];
  }
  // The operator must be able to act on the message alone: which machine, which
  // user, the exact command with its full path, what happens, and how to check.
  function assertLoginHelp(text) {
    const cli = join(fakeBin, 'claude').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(text, /never an API key, a token or another endpoint/);
    assert.match(text, new RegExp(`^  Where: a terminal on this machine \\(${hostname().split('.')[0]}\\), as user \\S+`, 'm'));
    assert.match(text, /not on a remote host, not in WSL/);
    assert.match(text, new RegExp(`^  Command: ${cli} auth login --claudeai$`, 'm'));
    assert.match(text, /^  How: it opens the browser/m);
    assert.match(text, /prints a URL/);
    assert.match(text, new RegExp(`^  Check: ${cli} --setting-sources "" auth status`, 'm'));
    assert.match(text, /"loggedIn": true and "authMethod": "claude\.ai"/);
    assert.match(text, /settings\.json .* not used/);
  }
  function pythonHarness(code) {
    const prelude = `import importlib.util, json
spec = importlib.util.spec_from_file_location('delegate', ${JSON.stringify(DELEGATE_PY)})
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
`;
    return spawnSync(PYTHON3, ['-B', '-c', prelude + code], { env: { ...process.env, ...env() }, encoding: 'utf8' });
  }
  function logLength() {
    return existsSync(join(atomicHome, 'delegate', 'runs.jsonl')) ? readLogRecords(atomicHome).length : 0;
  }

  it('claude-review is refused without --allow-claude-review and launches nothing', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs(['--diff-range', range, '--author-family', 'deepseek']), env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review needs --allow-claude-review/);
    assert.equal(logLength(), 0);
    assert.equal(existsSync(argvFile), false);
  });

  it('claude-review needs the author family and never reviews Claude work', () => {
    const range = commitFeature();
    let res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review']), env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /--author-family/);
    res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'anthropic']), env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /never of the family that wrote the code/);
    assert.equal(logLength(), 0);
  });

  it('claude-review is a review profile only, local only, and needs the diff', () => {
    const range = commitFeature();
    let res = runDelegate(['run', '--id', 'C1', '--task', 't', '--role', 'implement', '--profile', 'claude-review',
      '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed', '--allow-claude-review'], env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review only reviews/);
    res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek',
      '--host', 'devbox']), env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review does not run on a remote host/);
    res = runDelegate(reviewArgs(['--allow-claude-review', '--author-family', 'deepseek']), env());
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude review requires --diff-range/);
    assert.equal(logLength(), 0);
  });

  it('builds the read-only Claude argv, sends the prompt on stdin and records the access', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']), env());
    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.deepEqual(argv.slice(1), ['--safe-mode', '-p', '--setting-sources', '', '--model', 'claude-sonnet-5-5', '--effort', 'high',
      '--tools', 'Read,Grep,Glob', '--permission-mode', 'dontAsk', '--no-session-persistence',
      '--disable-slash-commands', '--output-format', 'text']);
    for (const flag of FORBIDDEN) assert.equal(argv.includes(flag), false, flag);
    const stdin = readFileSync(stdinFile, 'utf8');
    assert.match(stdin, /Review CARD-1/);
    assert.match(stdin, /feature\.txt/);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.executor, 'claude');
    assert.equal(rec.model, 'claude-sonnet-5-5');
    assert.equal(rec.family, 'anthropic');
    assert.equal(rec.failure, 'none');
    assert.equal(rec.fallback_reviewer, true);
    assert.equal(rec.author_family, 'deepseek');
    assert.equal(rec.access.network, false);
    assert.equal(rec.access.git_write, false);
    assert.ok(rec.access.limits.some(limit => /Read, Grep and Glob/.test(limit)));
    // --access strict gives the same argv: there is nothing left to remove.
    const strict = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'openai',
      '--access', 'strict', '--attempt', '2']), env({ DELEGATE_CLAUDE_MODEL: 'claude-opus-5-5' }));
    assert.equal(strict.status, 0, strict.stderr);
    const strictArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.deepEqual(strictArgv.slice(1), argv.slice(1).map(a => a === 'claude-sonnet-5-5' ? 'claude-opus-5-5' : a));
    assert.equal(readLogRecords(atomicHome).at(-1).access.mode, 'strict');
  });

  it('a Claude session limit printed with exit 0 is a provider limit with its reset time', () => {
    const range = commitFeature();
    const banner = "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)\n";
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
      env({ FAKE_STDOUT: banner, FAKE_LAST_MESSAGE: banner }));
    assert.equal(res.status, 1, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).failure, 'provider_limit');
    const route = runDelegate(['route', '--role', 'implement', '--json'], env());
    const state = JSON.parse(route.stdout).profiles['claude-review'];
    assert.equal(state.reset_source, 'provider');
    assert.ok(state.cooling_until);
    const parsed = pythonHarness(`
import datetime as dt
at = dt.datetime(2026, 11, 20, 15, 0, tzinfo=dt.timezone.utc)
print(d.parse_reset(${JSON.stringify(banner)}, at).isoformat())
print(d.parse_reset("resets 9am (UTC)", at).isoformat())
print(d.parse_reset("resets 5:10pm (Not/AZone)", at))
`);
    assert.equal(parsed.status, 0, parsed.stderr);
    assert.deepEqual(parsed.stdout.trim().split('\n'),
      ['2026-11-20T20:10:00+00:00', '2026-11-21T09:00:00+00:00', 'None']);
  });

  it('an exhausted balance is a provider limit, whatever the exit code', () => {
    const range = commitFeature();
    for (const text of [
      'API Error: 402 Insufficient balance. This request is pay-as-you-go.\n',
      'Credit balance is too low to access the API\n',
    ]) {
      const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
        env({ FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text, FAKE_EXIT: '1' }));
      assert.equal(res.status, 1, res.stderr);
      assert.equal(readLogRecords(atomicHome).at(-1).failure, 'provider_limit', text);
    }
  });

  it('the Claude child gets no API key, endpoint or session variable: only the local login is left', () => {
    const parsed = pythonHarness(`
import json
env = {"PATH": "/bin", "HOME": "/h", "CLAUDECODE": "1", "CLAUDE_CODE_ENTRYPOINT": "x",
       "CLAUDE_CODE_USE_BEDROCK": "1", "CLAUDE_CODE_OAUTH_TOKEN": "t",
       "ANTHROPIC_BASE_URL": "https://gateway", "ANTHROPIC_CUSTOM_HEADERS": "h",
       "ANTHROPIC_API_KEY": "k", "ANTHROPIC_AUTH_TOKEN": "t", "CLAUDE_CONFIG_DIR": "/cfg"}
print(json.dumps(d.child_environment("claude", env, {}), sort_keys=True))
print(json.dumps(d.child_environment("codex", env, {"X": "1"}), sort_keys=True))
`);
    assert.equal(parsed.status, 0, parsed.stderr);
    const [claude, codex] = parsed.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(claude, { PATH: '/bin', HOME: '/h', CLAUDE_CONFIG_DIR: '/cfg' });
    // Other executors keep the whole environment.
    assert.equal(codex.ANTHROPIC_API_KEY, 'k');
    assert.equal(codex.X, '1');
  });

  it('a Claude that is not logged in fails with the command that fixes it', () => {
    const range = commitFeature();
    const text = 'Failed to authenticate: OAuth session expired and could not be refreshed\n';
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
      env({ FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text, FAKE_EXIT: '1' }));
    assert.equal(res.status, 1);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.failure, 'error');
    assert.match(rec.hint, /claude auth login/);
    assert.match(res.stderr, /claude-review cannot run: Claude Code refused the local login/);
    assertLoginHelp(res.stderr);
  });

  it('refuses before launching when the local login is missing, and says where and how to log in', () => {
    const range = commitFeature();
    const out = { FAKE_AUTH_STATUS: '{"loggedIn": false, "authMethod": "none"}' };
    let res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']), env(out));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review cannot run: this machine has no Claude Code login/);
    assertLoginHelp(res.stderr);
    res = runDelegate(pipelineArgs(['--review-route', 'codex-review,claude-review', '--allow-claude-review']),
      steps([], out));
    assert.equal(res.status, 2);
    assertLoginHelp(res.stderr);
    assert.equal(logLength(), 0);
    assert.equal(git(repoDir, 'rev-list', '--count', 'HEAD'), '2');
  });

  it('refuses a login that bills an API instead of the subscription', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
      env({ FAKE_AUTH_STATUS: '{"loggedIn": true, "authMethod": "console"}' }));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review cannot run: the local login is "console", not a claude\.ai subscription/);
    assertLoginHelp(res.stderr);
    assert.equal(logLength(), 0);
  });

  it('an unreadable login state does not block the review', () => {
    const range = commitFeature();
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
      env({ FAKE_AUTH_STATUS: 'not json' }));
    assert.equal(res.status, 0, res.stderr);
  });

  it('a complete review that mentions a session limit is not a provider limit', () => {
    const range = commitFeature();
    const text = "R01 | minor | a:1 | the code says you've hit your session limit | t | f\nTOTAL major=0 medium=0 minor=1\n";
    const res = runDelegate(reviewArgs(['--diff-range', range, '--allow-claude-review', '--author-family', 'deepseek']),
      env({ FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text }));
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).failure, 'none');
  });

  it('a pipeline refuses claude-review without the flag, and as an executor, before launching', () => {
    let res = runDelegate(pipelineArgs(['--review-route', 'codex-review,claude-review']), steps([]));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review needs --allow-claude-review/);
    res = runDelegate(pipelineArgs(['--route', 'claude-review', '--allow-claude-review']), steps([]));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review only reviews/);
    assert.equal(logLength(), 0);
    assert.equal(git(repoDir, 'rev-list', '--count', 'HEAD'), '1');
  });

  it('a pipeline tries Claude last, only after the other reviewers ran out', () => {
    const res = runDelegate(pipelineArgs(['--review-route', 'claude-review,codex-review,agy-review',
      '--allow-claude-review']), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT, OK]));
    assert.equal(res.status, 0, res.stderr);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.reviewer_profile, 'claude-review');
    assert.equal(pipeRec.fallback_reviewer, true);
    assert.deepEqual(pipeRec.attempts.map(rec => rec.profile),
      ['flash', 'codex-review', 'agy-review', 'claude-review']);
    assert.match(readFileSync(join(outDir, 'P1.summary.md'), 'utf8'), /reviewed by the fallback reviewer claude-review/);
  });

  it('a pipeline with a usable reviewer never reaches Claude', () => {
    const res = runDelegate(pipelineArgs(['--review-route', 'claude-review,codex-review', '--allow-claude-review']),
      steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, OK]));
    assert.equal(res.status, 0, res.stderr);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.reviewer_profile, 'codex-review');
    assert.equal(pipeRec.fallback_reviewer, undefined);
  });

  it('review-pending adds Claude only with --reviewer and the flag', () => {
    let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
    assert.equal(res.status, 1, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).outcome, 'review_pending');
    res = runDelegate(['review-pending', '--id', 'P1', '--confirmed', '--reviewer', 'claude-review'], steps([OK]));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /claude-review needs --allow-claude-review/);
    res = runDelegate(['review-pending', '--id', 'P1', '--confirmed', '--reviewer', 'claude-review',
      '--allow-claude-review'], steps([LIMIT, LIMIT, OK]));
    assert.equal(res.status, 0, res.stderr);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.reviewer_profile, 'claude-review');
    assert.equal(pipeRec.fallback_reviewer, true);
    assert.equal(pipeRec.resumed_from, 'review_pending');
  });

  it('route and profiles show claude-review, and the warning says it needs a yes', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const completed = new Date(Date.now() - 60000).toISOString().replace('Z', '+00:00');
    const limit = (executor, model) => JSON.stringify({ kind: 'run', id: 'OLD', role: 'review', executor, model,
      completed, started: completed, duration_s: 1, failure: 'provider_limit' });
    writeFileSync(join(logDir, 'runs.jsonl'),
      [limit('codex', 'gpt-6.1-sol'), limit('agy', 'gemini-4-hydrogen-xhigh'),
        limit('agy', 'claude-sonnet-5-5-medium'), limit('agy', 'gemini-4-argon-high'),
        limit('opencode', 'opencode-go/muse-spark-1.3-contributor')].join('\n') + '\n');
    const out = JSON.parse(runDelegate(['route', '--role', 'implement', '--json'], env()).stdout);
    assert.equal(out.profiles['claude-review'].found, true);
    assert.deepEqual(out.review_routes.deepseek,
      ['muse-review', 'codex-review', 'agy-sonnet-review', 'agy-argon-review', 'agy-review']);
    assert.match(out.warnings[0], /claude-review can review with the operator's yes \(--allow-claude-review\)/);
    const profiles = runDelegate(['profiles'], env());
    assert.match(profiles.stdout, /^claude-review \| claude \| claude-sonnet-5-5 \| anthropic \| found \| login=claude\.ai \(max\)$/m);
    const noLogin = runDelegate(['profiles'], env({ FAKE_AUTH_STATUS: '{"loggedIn": false}' }));
    assert.equal(noLogin.status, 0);
    assert.match(noLogin.stdout, /^claude-review \| .* \| found \| login=missing$/m);
    assertLoginHelp(noLogin.stderr);
    assert.equal(out.profiles['claude-review'].login, 'claude.ai (max)');
    assert.doesNotMatch(profiles.stdout.split('claude-review |')[1], /implement/);
  });
});
