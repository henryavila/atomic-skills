import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
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
  hasPython3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

// A pipeline holds one review, and at most one fix round: only a computed
// major opens it, the gate runs again, one follow-up review reads the fix
// commits alone, and nothing follows it. The pipeline writes the verdict
// itself. All executors below are disposable fake CLIs.
const RUBRIC = readFileSync(join(REPO_ROOT, 'skills/shared/delegate-assets/severity-rubric.md'), 'utf8');

const CLEAN = 'Read feature.txt and ran the tests; nothing wrong.\nFINDINGS 0\n';
const MAJOR_LINE = 'F01 | feature.txt:1 | origin=diff | dup=none | card=none | kind=behaviour | reach=normal | proof=shown | the flag is ignored | ran the cli: no effect';
const MEDIUM_LINE = 'F02 | feature.txt:2 | origin=diff | dup=none | card=none | kind=upkeep | reach=- | proof=shown | a duplicated helper | feature.txt:2';
const MINOR_LINE = 'F03 | feature.txt:3 | origin=diff | dup=none | card=none | kind=style | reach=- | proof=shown | a vague name | feature.txt:3';
const WITH_MAJOR = [MAJOR_LINE, MEDIUM_LINE, 'FINDINGS 2'].join('\n') + '\n';
const NO_MAJOR = [MEDIUM_LINE, MINOR_LINE, 'FINDINGS 2'].join('\n') + '\n';
// Nothing here is a counted major: pre-existing, merged, unclassified, and a
// major whose proof is none (lowered to medium).
const NOT_COUNTED = [
  'F01 | old.js:9 | origin=base | dup=none | card=none | kind=behaviour | reach=normal | proof=shown | an old crash | ran old.js',
  'F02 | feature.txt:1 | origin=diff | dup=none | card=none | kind=behaviour | reach=normal | proof=none | may be ignored | not run',
  'F03 | feature.txt:1 | origin=diff | dup=F02 | card=none | kind=behaviour | reach=normal | proof=shown | same | same',
  'F04 | feature.txt:4 | origin=diff | dup=none | card=none | kind=bug | reach=normal | proof=shown | unknown kind | feature.txt:4',
  'FINDINGS 4',
].join('\n') + '\n';
const FIXED = 'MAJOR F01 fixed | the flag is read now, test added\nFINDINGS 0\n';
const STILL_OPEN = 'MAJOR F01 open | the flag is still ignored on the second call\nFINDINGS 0\n';
const NEW_MAJOR = [
  'MAJOR F01 fixed | the flag is read now',
  'F04 | fix.txt:1 | origin=diff | dup=none | card=none | kind=data | reach=normal | proof=shown | the fix deletes the cache file | ran it: cache gone',
  'FINDINGS 1',
].join('\n') + '\n';

describe('delegate.py fix round and pipeline verdict', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let repoDir;
  let outDir;
  let cardPath;
  let reviewCardPath;
  let seqDir;
  let gateRuns;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-fix-')));
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
    gateRuns = join(root, 'gate-runs.txt');
    baseEnv = {
      PATH: `${binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: join(root, 'empty-home'),
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_CODEX_MODEL: undefined,
      FAKE_STDOUT: CLEAN,
      FAKE_LAST_MESSAGE: CLEAN,
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'F1', '--task', 'fix round case', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', `echo ran >> ${gateRuns}`,
      '--review-card', reviewCardPath, '--review-route', 'codex-review,agy-review',
      '--out', outDir, '--confirmed', ...extra];
  }
  function review(text) { return { FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text }; }
  function steps(configs) {
    rmSync(seqDir, { recursive: true, force: true });
    mkdirSync(seqDir, { recursive: true });
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return { ...baseEnv, FAKE_SEQ_DIR: seqDir };
  }
  function summary() { return readFileSync(join(outDir, 'F1.summary.md'), 'utf8'); }
  function records() { return readLogRecords(atomicHome); }
  function runs() { return records().filter((r) => r.kind === 'run'); }
  function pipeRec() { return records().filter((r) => r.kind === 'pipeline').at(-1); }
  function verdicts() { return records().filter((r) => r.kind === 'verdict'); }
  function gateCount() { return existsSync(gateRuns) ? readFileSync(gateRuns, 'utf8').trim().split('\n').length : 0; }
  function prompt(i) { return readFileSync(runs()[i].prompt, 'utf8'); }

  describe('when a fix round opens', () => {
    it('opens no fix round for a clean review and ends clean with exit 0', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, review(CLEAN)]));
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review']);
      assert.equal(pipeRec().outcome, 'reviewed');
      assert.equal(pipeRec().final, 'clean');
      assert.equal(pipeRec().review_rounds, 1);
      assert.equal(gateCount(), 1);
      assert.match(summary(), /^# Pipeline F1: fix round case — reviewed\n- final: clean/);
    });

    it('opens no fix round for mediums and minors, and records them for the cleanup card', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, review(NO_MAJOR)]));
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review']);
      assert.equal(pipeRec().final, 'delivered_with_findings');
      assert.deepEqual(pipeRec().findings, { major: 0, medium: 1, minor: 1 });
      assert.match(summary(), /^- final: delivered with findings recorded: 0 open majors, 1 medium, 1 minor/m);
      assert.match(summary(), /^- mediums and minors recorded \(one cleanup card at the end of the batch\): medium F02 feature\.txt:2; minor F03 feature\.txt:3$/m);
      assert.equal(summary().trimEnd().split('\n').at(-1), 'TOTAL major=0 medium=1 minor=1');
    });

    it('opens no fix round for pre-existing, merged, unclassified or unproven findings', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, review(NOT_COUNTED)]));
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review']);
      assert.deepEqual(pipeRec().findings, { major: 0, medium: 2, minor: 0 });
      assert.equal(gateCount(), 1);
    });
  });

  describe('the one fix round', () => {
    it('sends only the majors to the same executor, gates again and reviews only the fix commits', () => {
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(FIXED)]));
      assert.equal(res.status, 0, res.stderr);
      const all = runs();
      assert.deepEqual(all.map((r) => [r.role, r.executor]),
        [['implement', 'opencode'], ['review', 'codex'], ['fix', 'opencode'], ['review', 'codex']]);
      assert.equal(gateCount(), 2);

      const fixPrompt = prompt(2);
      assert.ok(fixPrompt.startsWith('You are the executor of this card'), fixPrompt);
      assert.match(fixPrompt, /major \| F01 \| feature\.txt:1 \| .*the flag is ignored/);
      assert.doesNotMatch(fixPrompt, /a duplicated helper/, 'a medium never goes into the fix card');
      assert.ok(fixPrompt.includes('Implement feature X.'), 'the task card is attached for context');

      const followUp = prompt(3);
      assert.ok(followUp.startsWith('You are the reviewer of this card'), followUp);
      assert.match(followUp, /major \| F01 \| feature\.txt:1 \| .*the flag is ignored/);
      assert.doesNotMatch(followUp, /a duplicated helper/);
      assert.match(followUp, /MAJOR <id> fixed/);
      assert.match(followUp, /MAJOR <id> open/);
      assert.ok(followUp.includes('diff --git a/fix.txt b/fix.txt'), 'the fix diff is in the prompt');
      assert.ok(!followUp.includes('diff --git a/feature.txt b/feature.txt'), 'the task diff is not');
      assert.ok(!followUp.includes('Implement feature X.'), 'the task card is not');
      assert.ok(followUp.trimEnd().endsWith(RUBRIC.trimEnd()), 'new findings are answered with the rubric');
      const fixBase = all[2].base;
      assert.match(followUp, new RegExp(`## Diff ${fixBase}[0-9a-f]*\\.\\.\\.`));

      const rec = pipeRec();
      assert.equal(rec.outcome, 'fixed');
      assert.equal(rec.final, 'delivered_with_findings');
      assert.deepEqual(rec.first_findings, { major: 1, medium: 1, minor: 0 });
      assert.deepEqual(rec.findings, { major: 0, medium: 1, minor: 0 });
      assert.equal(rec.review_rounds, 2);
      assert.equal(rec.fix_round.profile, 'flash');
      assert.equal(rec.fix_round.state, 'reviewed');
      assert.equal(rec.fix_round.gate_exit, 0);
      assert.equal(rec.fix_round.reviewer_profile, 'codex-review');
      assert.deepEqual(rec.fix_round.verdicts, { F01: 'fixed' });
      assert.deepEqual(rec.open_majors, []);
      assert.equal(summary().trimEnd().split('\n').at(-1), 'TOTAL major=0 medium=1 minor=0');
    });

    it('records a major still open after the fix, shows it first, exits non-zero and opens no second round', () => {
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(STILL_OPEN),
        { FAKE_COMMIT_FILE: 'second-fix.txt' }, review(FIXED)]));
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review', 'fix', 'review']);
      assert.equal(existsSync(join(repoDir, 'second-fix.txt')), false, 'no second fix round');
      const rec = pipeRec();
      assert.equal(rec.outcome, 'open_majors');
      assert.equal(rec.final, 'delivered_with_findings');
      assert.deepEqual(rec.findings, { major: 1, medium: 1, minor: 0 });
      assert.deepEqual(rec.open_majors.map((m) => [m.id, m.status]), [['F01', 'open']]);
      const lines = summary().split('\n');
      assert.match(lines[1], /^- final: delivered with findings recorded: 1 open major \(for you to decide\), 1 medium, 0 minor/);
      assert.match(lines[2], /^- open major F01 \| feature\.txt:1 \| open: the flag is still ignored on the second call \| /);
      const [verdict] = verdicts();
      assert.match(verdict.deviation, /F01 feature\.txt:1/);
      assert.match(verdict.deviation, /still ignored on the second call/);
      assert.equal(verdict.delivered, 'partial');
      assert.equal(verdict.findings_major, 1);
    });

    it('takes a new major in the fix diff as open, with no second round', () => {
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(NEW_MAJOR),
        { FAKE_COMMIT_FILE: 'second-fix.txt' }]));
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review', 'fix', 'review']);
      const rec = pipeRec();
      assert.equal(rec.outcome, 'open_majors');
      assert.deepEqual(rec.fix_round.verdicts, { F01: 'fixed' });
      assert.deepEqual(rec.open_majors.map((m) => [m.id, m.status]), [['F04', 'new']]);
      assert.match(summary(), /^- open major F04 \| fix\.txt:1 \| new in the fix diff \| /m);
    });

    it('counts a major the follow-up review does not answer as open', () => {
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(CLEAN)]));
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(pipeRec().open_majors.map((m) => [m.id, m.status]), [['F01', 'not answered']]);
    });

    it('ends gate_failed when the gate fails after the fix, with no follow-up review', () => {
      const gate = `echo ran >> ${gateRuns}; test ! -e fix.txt`;
      const res = runDelegate(pipelineArgs(['--gate', gate]), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(FIXED)]));
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review', 'fix']);
      assert.equal(gateCount(), 2);
      const rec = pipeRec();
      assert.equal(rec.outcome, 'gate_failed');
      assert.equal(rec.final, 'gate_failed');
      assert.equal(rec.failed_step, 'fix_gate');
      assert.equal(rec.fix_round.gate_exit, 1);
      assert.match(summary(), /^- final: gate failed after the fix round/m);
      assert.match(summary(), /^- gate after the fix: .* \| exit 1 \| /m);
      assert.equal(verdicts()[0].gate_host, 'fail');
    });

    it('leaves the majors open when the fix run changes nothing, without a second gate or review', () => {
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), {}, review(FIXED)]));
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(runs().map((r) => r.role), ['implement', 'review', 'fix']);
      assert.equal(gateCount(), 1);
      const rec = pipeRec();
      assert.equal(rec.outcome, 'open_majors');
      assert.equal(rec.fix_round.state, 'no_changes');
      assert.deepEqual(rec.open_majors.map((m) => [m.id, m.status]), [['F01', 'not fixed']]);
    });

    it('moves the fix to the next profile of the approved route when the executor is out of quota', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      const res = runDelegate(pipelineArgs(['--route', 'flash,codex', '--review-route', 'agy-review']), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), LIMIT, { FAKE_COMMIT_FILE: 'fix.txt' }, review(FIXED)]));
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(runs().map((r) => [r.role, r.executor, r.failure]), [
        ['implement', 'opencode', 'none'], ['review', 'agy', 'none'], ['fix', 'opencode', 'provider_limit'],
        ['fix', 'codex', 'none'], ['review', 'agy', 'none']]);
      assert.equal(pipeRec().fix_round.profile, 'codex');
    });

    it('never lets the fix author review the fix', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      const res = runDelegate(pipelineArgs(['--route', 'flash,codex', '--review-route', 'codex-review,agy-review']), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), LIMIT, { FAKE_COMMIT_FILE: 'fix.txt' }, review(FIXED)]));
      assert.equal(res.status, 0, res.stderr);
      const last = runs().at(-1);
      assert.equal(last.role, 'review');
      assert.equal(last.executor, 'agy', 'codex wrote the fix, so codex-review is skipped');
    });

    it('records the majors as not verified when no reviewer can read the fix', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      const res = runDelegate(pipelineArgs(), steps([
        { FAKE_COMMIT_FILE: 'feature.txt' }, review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, LIMIT, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      const rec = pipeRec();
      assert.equal(rec.outcome, 'open_majors');
      assert.equal(rec.fix_round.state, 'not_reviewed');
      assert.deepEqual(rec.open_majors.map((m) => [m.id, m.status]), [['F01', 'not verified']]);
      assert.equal(existsSync(join(atomicHome, 'delegate', 'pending')), false, 'a follow-up review is never pending');
    });

    it('offers no option that sets the number of fix or review rounds', () => {
      for (const option of ['--fix-rounds', '--review-rounds', '--rounds', '--max-rounds']) {
        const res = runDelegate(pipelineArgs([option, '2']), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }]));
        assert.equal(res.status, 2, option);
        assert.match(res.stderr, /unrecognized arguments/, option);
      }
    });
  });

  describe('the verdict the pipeline writes', () => {
    it('writes the verdict before its pipeline record, marked as written by the pipeline', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, review(NO_MAJOR)]));
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(records().map((r) => r.kind), ['run', 'run', 'verdict', 'pipeline']);
      const [verdict] = verdicts();
      assert.equal(verdict.id, 'F1');
      assert.equal(verdict.written_by, 'pipeline');
      assert.equal(verdict.gate_host, 'pass');
      assert.equal(verdict.delivered, 'yes');
      assert.equal(verdict.review_by, 'codex-review');
      assert.equal(verdict.review_rounds, 1);
      assert.equal(verdict.findings_major, 0);
      assert.equal(verdict.findings_medium, 1);
      assert.equal(verdict.findings_minor, 1);
      assert.equal(verdict.orchestrator_rework, 'none');
      assert.equal(verdict.final, 'delivered_with_findings');
      assert.equal(verdict.gate_executor_claim, undefined, 'the runner does not know what the executor claimed');
      assert.equal(verdict.deviation, undefined);
    });

    it('records a failed gate and no review', () => {
      const res = runDelegate(pipelineArgs(['--gate', 'false']), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }]));
      assert.equal(res.status, 1, res.stderr);
      const [verdict] = verdicts();
      assert.equal(verdict.gate_host, 'fail');
      assert.equal(verdict.delivered, 'no');
      assert.equal(verdict.review_rounds, 0);
      assert.equal(pipeRec().final, 'gate_failed');
    });

    it('records gate not_run when the executor failed', () => {
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_EXIT: '1' }]));
      assert.equal(res.status, 1, res.stderr);
      const [verdict] = verdicts();
      assert.equal(verdict.gate_host, 'not_run');
      assert.equal(verdict.delivered, 'no');
      assert.equal(pipeRec().final, 'not_delivered');
    });

    it('writes no verdict while the review is pending, and review-pending writes it when it ends', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      assert.equal(pipeRec().final, 'review_pending');
      assert.deepEqual(verdicts(), []);
      res = runDelegate(['review-pending', '--id', 'F1', '--confirmed'], steps([review(NO_MAJOR)]));
      assert.equal(res.status, 0, res.stderr);
      const [verdict] = verdicts();
      assert.equal(verdict.written_by, 'pipeline');
      assert.equal(verdict.gate_host, 'pass');
      assert.equal(verdict.findings_medium, 1);
      assert.equal(records().at(-1).kind, 'pipeline');
    });

    it('lets a later record for the same id still be written and read last by report', () => {
      let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, review(CLEAN)]));
      assert.equal(res.status, 0, res.stderr);
      res = runDelegate(['record', '--id', 'F1', '--gate-host', 'fail', '--delivered', 'no',
        '--review-rounds', '1', '--findings-major', '2'], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const [first, second] = verdicts();
      assert.equal(first.written_by, 'pipeline');
      assert.equal(second.written_by, undefined);
      assert.equal(second.gate_host, 'fail');
      res = runDelegate(['report'], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      assert.match(res.stdout, /implement \| opencode \| [^:]+: n=1; host gate 0\/1/);
      assert.match(res.stdout, /major findings 2/);
    });
  });

  describe('a finished pending review', () => {
    it('opens the same one fix round for a computed major', () => {
      const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
      let res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      const before = records().length;
      res = runDelegate(['review-pending', '--id', 'F1', '--confirmed'], steps([
        review(WITH_MAJOR), { FAKE_COMMIT_FILE: 'fix.txt' }, review(STILL_OPEN), { FAKE_COMMIT_FILE: 'second-fix.txt' }]));
      assert.equal(res.status, 1, res.stderr);
      const after = records().slice(before);
      assert.deepEqual(after.map((r) => [r.kind, r.role || null]),
        [['run', 'review'], ['run', 'fix'], ['run', 'review'], ['verdict', null], ['pipeline', null]]);
      assert.equal(gateCount(), 2);
      assert.equal(existsSync(join(repoDir, 'second-fix.txt')), false);
      const rec = after.at(-1);
      assert.equal(rec.resumed_from, 'review_pending');
      assert.equal(rec.outcome, 'open_majors');
      assert.deepEqual(rec.open_majors.map((m) => [m.id, m.status]), [['F01', 'open']]);
      assert.match(summary(), /^- open major F01 \| /m);
      assert.ok(git(repoDir, 'log', '--format=%s').includes('fake commit'));
    });
  });
});
