import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  REPO_ROOT,
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

// The runner appends severity-rubric.md to every review prompt, refuses a
// review when that file is missing, and decides everything downstream on the
// severities it computes. All executors below are disposable fake CLIs.
const RUBRIC = readFileSync(join(REPO_ROOT, 'skills/shared/delegate-assets/severity-rubric.md'), 'utf8');

const CLEAN = 'Read src/a.js and ran npm test; nothing wrong.\nFINDINGS 0\n';
const QUOTE = 'the runner refuses the review before launching';
const NEW_REVIEW = [
  `F01 | src/a.js:3 | origin=diff | dup=none | card="${QUOTE}" | kind=behaviour | reach=normal | proof=none | the refusal may not happen | not run`,
  'F02 | README.md:4 | origin=diff | dup=none | card=none | kind=doc-false | reach=- | proof=shown | README says --all, the flag is --every | src/cli.js:20 parses --every',
  'F03 | src/old.js:9 | origin=base | dup=none | card=none | kind=behaviour | reach=normal | proof=shown | an old crash | ran node old.js: TypeError',
  'F04 | docs/b.md:2 | origin=diff | dup=F02 | card=none | kind=doc-loose | reach=- | proof=shown | the same wrong flag again | docs/b.md:2',
  'F05 | src/c.js:1 | origin=diff | dup=none | card=none | kind=style | reach=- | proof=shown | a major problem in naming, says the reviewer | src/c.js:1 names it x',
  'F06 | src/d.js:7 | origin=diff | dup=none | card=none | kind=bug | reach=normal | proof=shown | an unknown kind | src/d.js:7',
  'FINDINGS 6',
].join('\n') + '\n';
const OLD_WRONG_TOTAL = 'R01 | medium | a.js:3 | issue | saw | fix\nTOTAL major=3 medium=0 minor=0\n';
// The follow-up review after the one fix round of NEW_REVIEW's only major.
const FIXED_F02 = 'MAJOR F02 fixed | README.md:4 says --every now\nFINDINGS 0\n';

describe('delegate.py severity in runs and pipelines', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let repoDir;
  let outDir;
  let cardPath;
  let reviewCardPath;
  let seqDir;
  let argvFile;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-severity-')));
    atomicHome = join(root, 'atomic-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    seqDir = join(root, 'seq');
    for (const dir of [atomicHome, join(root, 'empty-home'), repoDir, seqDir]) mkdirSync(dir, { recursive: true });
    initGitRepo(repoDir);
    const { binDir } = makeFakeBin(root);
    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(reviewCardPath, '# Review CARD-1\nReview the diff below against the attached card.\n');
    argvFile = join(root, 'captured.argv.json');
    baseEnv = {
      PATH: `${binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: join(root, 'empty-home'),
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_CODEX_MODEL: undefined,
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDOUT: CLEAN,
      FAKE_LAST_MESSAGE: CLEAN,
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function reviewArgs(extra = []) {
    return ['run', '--id', 'S1', '--task', 'severity', '--role', 'review', '--profile', 'codex-review',
      '--cwd', repoDir, '--card', reviewCardPath, '--out', outDir, '--confirmed', ...extra];
  }
  function implementArgs() {
    return ['run', '--id', 'S2', '--task', 'implement', '--role', 'implement', '--profile', 'flash',
      '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'];
  }
  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'P1', '--task', 'severity case', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review,agy-review',
      '--out', outDir, '--confirmed', ...extra];
  }
  function reviewStep(text) { return { FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text }; }
  function review(text) { return { ...baseEnv, ...reviewStep(text) }; }
  function steps(configs) {
    rmSync(seqDir, { recursive: true, force: true });
    mkdirSync(seqDir, { recursive: true });
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return { ...baseEnv, FAKE_SEQ_DIR: seqDir };
  }
  function summary() { return readFileSync(join(outDir, 'P1.summary.md'), 'utf8'); }
  function lastRun() { return readLogRecords(atomicHome).filter((r) => r.kind === 'run').at(-1); }
  // A copy of the runner in a folder that has no severity-rubric.md beside it.
  function runnerWithoutRubric() {
    const dir = join(root, 'assets-without-rubric');
    mkdirSync(dir, { recursive: true });
    copyFileSync(DELEGATE_PY, join(dir, 'delegate.py'));
    return join(dir, 'delegate.py');
  }
  function runCopy(script, args, env) {
    const childEnv = { ...process.env, ...env };
    for (const [key, value] of Object.entries(childEnv)) if (value === undefined) delete childEnv[key];
    const short = ['run', 'pipeline'].includes(args[0]) ? ['--allow-short-timeout'] : [];
    return spawnSync(PYTHON3, ['-B', script, ...args, ...short], { encoding: 'utf8', env: childEnv });
  }

  describe('the rubric in the prompt', () => {
    it('ends every review prompt with the severity rubric, after the card', () => {
      const res = runDelegate(reviewArgs(), baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const prompt = readFileSync(lastRun().prompt, 'utf8');
      const card = readFileSync(reviewCardPath, 'utf8');
      assert.ok(prompt.includes(card));
      assert.ok(prompt.trimEnd().endsWith(RUBRIC.trimEnd()), 'the prompt must end with the rubric');
      assert.ok(prompt.indexOf(card) < prompt.indexOf(RUBRIC.trimEnd()));
      assert.equal(lastRun().prompt_bytes, Buffer.byteLength(prompt));
    });

    it('does not add the rubric to an implement prompt', () => {
      const res = runDelegate(implementArgs(), baseEnv);
      assert.equal(res.status, 0, res.stderr);
      assert.ok(!readFileSync(lastRun().prompt, 'utf8').includes('# Severity rubric'));
    });

    it('refuses a review run before launching when the rubric is not beside the runner', () => {
      const script = runnerWithoutRubric();
      const res = runCopy(script, reviewArgs(), baseEnv);
      assert.equal(res.status, 2, res.stderr);
      assert.ok(res.stderr.includes(join(root, 'assets-without-rubric', 'severity-rubric.md')), res.stderr);
      assert.match(res.stderr, /missing/);
      assert.equal(existsSync(argvFile), false, 'no executor may be launched');
      assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);
    });

    it('still runs an implement step when the rubric is missing', () => {
      const res = runCopy(runnerWithoutRubric(), implementArgs(), baseEnv);
      assert.equal(res.status, 0, res.stderr);
    });

    it('refuses a pipeline before its executor runs when the rubric is missing', () => {
      const res = runCopy(runnerWithoutRubric(), pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }]));
      assert.equal(res.status, 2, res.stderr);
      assert.match(res.stderr, /severity-rubric\.md/);
      assert.equal(existsSync(join(seqDir, 'count')), false, 'no executor may be launched');
      assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);
    });

    it('refuses review-pending before launching when the rubric is missing', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      const pending = join(atomicHome, 'delegate', 'pending', 'repo', 'P1.json');
      assert.ok(existsSync(pending));
      const before = readLogRecords(atomicHome).length;
      res = runCopy(runnerWithoutRubric(), ['review-pending', '--id', 'P1', '--confirmed'], steps([reviewStep(CLEAN)]));
      assert.equal(res.status, 2, res.stderr);
      assert.match(res.stderr, /severity-rubric\.md/);
      assert.equal(existsSync(join(seqDir, 'count')), false, 'no reviewer may be launched');
      assert.equal(readLogRecords(atomicHome).length, before);
      assert.ok(existsSync(pending), 'the pending review stays');
    });
  });

  describe('the review record', () => {
    it('records the computed severity of each finding', () => {
      const res = runDelegate(reviewArgs(), review(NEW_REVIEW));
      assert.equal(res.status, 0, res.stderr);
      const rec = lastRun();
      assert.equal(rec.failure, 'none');
      assert.equal(rec.severity_source, 'computed');
      assert.deepEqual(rec.severity_counts,
        { major: 1, medium: 2, minor: 1, pre_existing: 1, merged: 1, unclassified: 1 });
      assert.deepEqual(rec.findings.map((f) => [f.id, f.location, f.severity]), [
        ['F01', 'src/a.js:3', 'medium'], ['F02', 'README.md:4', 'major'], ['F03', 'src/old.js:9', 'pre-existing'],
        ['F04', 'docs/b.md:2', 'merged'], ['F05', 'src/c.js:1', 'minor'], ['F06', 'src/d.js:7', 'unclassified'],
      ]);
      assert.deepEqual(rec.findings[0].answers,
        { origin: 'diff', dup: 'none', card: QUOTE, kind: 'behaviour', reach: 'normal', proof: 'none' });
      assert.equal(rec.findings_mismatch, false);
    });

    it('records a FINDINGS number that disagrees with the lines', () => {
      const res = runDelegate(reviewArgs(), review(NEW_REVIEW.replace('FINDINGS 6', 'FINDINGS 9')));
      assert.equal(res.status, 0, res.stderr);
      assert.equal(lastRun().findings_mismatch, true);
      assert.equal(lastRun().findings_claimed, 9);
      assert.equal(lastRun().severity_counts.major, 1);
    });

    it('takes a clean review as complete only when it ends with FINDINGS 0', () => {
      let res = runDelegate(reviewArgs(), review(CLEAN));
      assert.equal(res.status, 0, res.stderr);
      assert.equal(lastRun().failure, 'none');
      assert.equal(lastRun().severity_source, 'computed');
      assert.deepEqual(lastRun().findings, []);
      res = runDelegate(reviewArgs(), review('Read src/a.js; nothing wrong.\n'));
      assert.equal(res.status, 1, res.stderr);
      assert.equal(lastRun().failure, 'incomplete_review');
      res = runDelegate(reviewArgs(), review(NEW_REVIEW.replace('FINDINGS 6\n', '')));
      assert.equal(res.status, 1, res.stderr);
      assert.equal(lastRun().failure, 'incomplete_review');
      assert.equal(lastRun().severity_source, undefined);
    });

    it('records FINDINGS above 0 with no readable finding line as an incomplete review', () => {
      const res = runDelegate(reviewArgs(), review('Checked src/a.js; two problems.\nFINDINGS 2\n'));
      assert.equal(res.status, 1, res.stderr);
      assert.equal(lastRun().failure, 'incomplete_review');
      assert.equal(lastRun().severity_source, undefined);
    });

    it('accepts an old-format review, counts its lines and records severity_source reviewer', () => {
      const res = runDelegate(reviewArgs(), review(OLD_WRONG_TOTAL));
      assert.equal(res.status, 0, res.stderr);
      const rec = lastRun();
      assert.equal(rec.failure, 'none');
      assert.equal(rec.severity_source, 'reviewer');
      assert.equal(rec.findings_mismatch, true);
      assert.deepEqual(rec.findings_claimed, { major: 3, medium: 0, minor: 0 });
      assert.deepEqual(rec.severity_counts,
        { major: 0, medium: 1, minor: 0, pre_existing: 0, merged: 0, unclassified: 0 });
      assert.deepEqual(rec.findings, [{ id: 'R01', location: 'a.js:3', severity: 'medium' }]);
    });

    it('reads a finished rubric review that quotes the Claude limit banner as a review', () => {
      const banner = "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)";
      const finished = join(root, 'finished.txt');
      const cut = join(root, 'cut.txt');
      writeFileSync(finished, `F01 | a.js:1 | origin=diff | dup=none | card=none | kind=doc-false | reach=- | proof=shown | the help says "${banner}" | a.js:1\nFINDINGS 1\n`);
      writeFileSync(cut, `${banner}\n`);
      const res = spawnSync(PYTHON3, ['-B', '-c', `import importlib.util, json, pathlib, sys
spec = importlib.util.spec_from_file_location('delegate', ${JSON.stringify(DELEGATE_PY)})
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
print(json.dumps([d.claude_limit(pathlib.Path(p)) for p in sys.argv[1:]]))`, finished, cut], { encoding: 'utf8' });
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(res.stdout), [false, true]);
    });
  });

  describe('the pipeline decides on the computed counts', () => {
    it('counts majors from the answers, never from the words of a finding', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, reviewStep(NEW_REVIEW),
        { FAKE_COMMIT_FILE: 'fix.txt' }, reviewStep(FIXED_F02)]));
      assert.equal(res.status, 0, res.stderr);
      const pipeRec = readLogRecords(atomicHome).at(-1);
      // Only F02 is a computed major: it alone opens the fix round.
      assert.equal(pipeRec.outcome, 'fixed');
      assert.deepEqual(pipeRec.first_findings, { major: 1, medium: 2, minor: 1 });
      assert.deepEqual(pipeRec.findings, { major: 0, medium: 2, minor: 1 });
      const fixPrompt = readFileSync(readLogRecords(atomicHome).find((r) => r.role === 'fix').prompt, 'utf8');
      assert.match(fixPrompt, /major \| F02 \| README\.md:4 /);
      assert.doesNotMatch(fixPrompt, /a major problem in naming/);
      assert.equal(pipeRec.severity_source, 'computed');
      assert.equal(pipeRec.findings_unclassified, 1);
      assert.equal(pipeRec.findings_mismatch, false);
      const text = summary();
      assert.ok(text.includes('major | F02 | README.md:4 | kind=doc-false reach=- proof=shown | README says --all, the flag is --every'), text);
      assert.ok(text.includes(`medium | F01 | src/a.js:3 | card="${QUOTE}" kind=behaviour reach=normal proof=none | the refusal may not happen`), text);
      assert.match(text, /^pre-existing \| F03 \| src\/old\.js:9 \| origin=base /m);
      assert.match(text, /^merged \| F04 \| docs\/b\.md:2 \| dup=F02 /m);
      assert.match(text, /^minor \| F05 \| src\/c\.js:1 \| kind=style reach=- proof=shown \| a major problem/m);
      assert.match(text, /^unclassified \| F06 \| src\/d\.js:7 \| /m);
      assert.match(text, /^- unclassified findings: 1, counted as medium/m);
      assert.deepEqual(text.split('\n').filter((line) => line.includes('TOTAL major=')),
        ['- first review: TOTAL major=1 medium=2 minor=1', 'TOTAL major=0 medium=2 minor=1']);
      assert.equal(text.trimEnd().split('\n').at(-1), 'TOTAL major=0 medium=2 minor=1');
      assert.equal(res.stdout.trim(), text.trim());
    });

    it('opens no major for an old-format TOTAL that claims majors no line has', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, reviewStep(OLD_WRONG_TOTAL)]));
      assert.equal(res.status, 0, res.stderr);
      const pipeRec = readLogRecords(atomicHome).at(-1);
      assert.deepEqual(pipeRec.findings, { major: 0, medium: 1, minor: 0 });
      assert.equal(pipeRec.severity_source, 'reviewer');
      assert.equal(pipeRec.findings_mismatch, true);
      const reviewRun = readLogRecords(atomicHome).find((r) => r.kind === 'run' && r.role === 'review');
      assert.equal(reviewRun.findings_mismatch, true);
      const text = summary();
      assert.ok(text.includes('R01 | medium | a.js:3 | issue | saw | fix'));
      assert.match(text, /^- findings mismatch: /m);
      assert.match(text, /^- severity: chosen by the reviewer/m);
      assert.deepEqual(text.split('\n').filter((line) => line.includes('TOTAL major=')),
        ['TOTAL major=0 medium=1 minor=0']);
    });

    it('moves to the next reviewer when a review says FINDINGS 2 and has no finding line', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' },
        reviewStep('Checked src/a.js; two problems.\nFINDINGS 2\n'), reviewStep(CLEAN)]));
      assert.equal(res.status, 0, res.stderr);
      const reviews = readLogRecords(atomicHome).filter((r) => r.kind === 'run' && r.role === 'review');
      assert.deepEqual(reviews.map((r) => r.failure), ['incomplete_review', 'none']);
      const pipeRec = readLogRecords(atomicHome).at(-1);
      assert.equal(pipeRec.outcome, 'reviewed');
      assert.equal(pipeRec.reviewer_profile, 'agy-review');
      assert.deepEqual(pipeRec.findings, { major: 0, medium: 0, minor: 0 });
    });

    it('decides a finished pending review on the computed counts too', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'], steps([reviewStep(NEW_REVIEW),
        { FAKE_COMMIT_FILE: 'fix.txt' }, reviewStep(FIXED_F02)]));
      assert.equal(res.status, 0, res.stderr);
      const pipeRec = readLogRecords(atomicHome).at(-1);
      assert.equal(pipeRec.resumed_from, 'review_pending');
      assert.deepEqual(pipeRec.first_findings, { major: 1, medium: 2, minor: 1 });
      assert.deepEqual(pipeRec.findings, { major: 0, medium: 2, minor: 1 });
      assert.equal(pipeRec.severity_source, 'computed');
      assert.match(summary(), /^major \| F02 \| README\.md:4 \| /m);
      assert.deepEqual(summary().split('\n').filter((line) => line.includes('TOTAL major=')),
        ['- first review: TOTAL major=1 medium=2 minor=1', 'TOTAL major=0 medium=2 minor=1']);
    });
  });
});
