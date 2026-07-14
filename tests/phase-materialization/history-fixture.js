import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

export function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function markdown(frontmatter, body = '') {
  return `---\n${stringifyYaml(frontmatter)}---\n${body}\n`;
}

export function writeMarkdown(path, frontmatter, body = '') {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown(frontmatter, body));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createHistoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'as-history-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'tests@example.com']);
  git(root, ['config', 'user.name', 'Atomic Tests']);
  git(root, ['commit', '--allow-empty', '-qm', 'reviewed checkpoint']);
  const reviewedSha = git(root, ['rev-parse', 'HEAD']);
  const planRel = '.atomic-skills/projects/proj/demo/plan.md';
  const initiativeRel = '.atomic-skills/projects/proj/demo/phases/archive/f0-demo.md';
  const creationGateRel = '.atomic-skills/status/creation-gates/proj-demo.json';
  const completionLogRel = '.atomic-skills/analytics/completions.jsonl';
  const receiptRel = 'docs/audits/demo-f0-reconciliation.json';
  const sidecarRel = '.atomic-skills/projects/proj/demo/phases/f3-demo.source.json';
  const planPath = join(root, planRel);
  const initiativePath = join(root, initiativeRel);
  const creationGatePath = join(root, creationGateRel);
  const completionLogPath = join(root, completionLogRel);
  const receiptPath = join(root, receiptRel);
  const evidence = {
    verifierKind: 'shell', verifiedAt: '2026-07-14T20:00:00Z',
    verifiedCommit: reviewedSha, passed: true, exitCode: 0,
  };
  const criterion = {
    id: 'F0-G1', description: 'history is complete', status: 'met',
    metAt: '2026-07-14T20:00:00Z',
    verifier: { kind: 'shell', command: 'true', expectExitCode: 0 }, evidence,
  };
  const plan = {
    schemaVersion: '0.2', slug: 'demo', title: 'Demo', version: '1', status: 'active',
    started: '2026-07-14T19:00:00Z', lastUpdated: '2026-07-14T20:00:00Z',
    branch: 'plan/demo', currentPhase: 'F3', parallelismAllowed: false,
    phases: [
      {
        id: 'F0', slug: 'f0-demo', title: 'F0', goal: 'bootstrap', dependsOn: [],
        subPhaseCount: 1, status: 'done',
        exitGate: { summary: 'one', criteria: [structuredClone(criterion)] },
        reviewGate: {
          status: 'passed', at: reviewedSha, mode: 'both',
          reviewFile: '.atomic-skills/reviews/demo-f0.md',
        },
      },
      {
        id: 'F4', slug: 'f4-demo', title: 'F4', goal: 'authority', dependsOn: ['F0'],
        subPhaseCount: 0, status: 'done', exitGate: { summary: 'none', criteria: [] },
        reviewGate: {
          status: 'passed', at: reviewedSha, mode: 'local',
          reviewFile: '.atomic-skills/reviews/demo-f4.md',
        },
      },
      {
        id: 'F3', slug: 'f3-demo', title: 'F3', goal: 'successor', dependsOn: ['F4'],
        subPhaseCount: 1, status: 'pending', exitGate: { summary: 'none', criteria: [] },
      },
    ],
  };
  const initiative = {
    schemaVersion: '0.2', slug: 'f0-demo', title: 'F0', goal: 'bootstrap',
    status: 'archived', branch: 'plan/demo', started: '2026-07-14T19:00:00Z',
    lastUpdated: '2026-07-14T20:00:00Z', nextAction: null, parentPlan: 'demo', phaseId: 'F0',
    exitGates: [structuredClone(criterion)], stack: [],
    tasks: [{
      id: 'T-001', title: 'bootstrap', status: 'done',
      lastUpdated: '2026-07-14T20:00:00Z', closedAt: '2026-07-14T20:00:00Z',
    }],
    parked: [], emerged: [],
  };
  writeMarkdown(planPath, plan, '# Plan');
  writeMarkdown(initiativePath, initiative, '# Initiative');
  mkdirSync(dirname(creationGatePath), { recursive: true });
  writeFileSync(creationGatePath, `${JSON.stringify({
    schemaVersion: '0.1', kind: 'new-plan', slug: 'demo', projectId: 'proj',
    stage: 'ready', status: 'ready', filesPlanned: [planRel, initiativeRel, sidecarRel],
    filesWritten: [planRel, initiativeRel, sidecarRel],
  }, null, 2)}\n`);
  mkdirSync(dirname(join(root, sidecarRel)), { recursive: true });
  writeFileSync(join(root, sidecarRel), '{"captureVersion":"0.1","phaseId":"F3"}\n');
  mkdirSync(join(root, '.atomic-skills', 'reviews'), { recursive: true });
  writeFileSync(join(root, '.atomic-skills/reviews/demo-f0.md'), `review ${reviewedSha}\n`);
  writeFileSync(join(root, '.atomic-skills/reviews/demo-f4.md'), `review ${reviewedSha}\n`);
  mkdirSync(dirname(completionLogPath), { recursive: true });
  const event = {
    ts: '2026-07-14T20:00:00Z', event: 'task-done', projectId: 'proj',
    planSlug: 'demo', phaseId: 'F0', taskId: 'T-001', weight: 1, weightBasis: 'count',
    idempotencyKey: 'task-done:proj/demo/F0/T-001@2026-07-14T20%3A00%3A00Z',
  };
  writeFileSync(completionLogPath, `${JSON.stringify(event)}\n`);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'close F0 and F4']);
  const closeSha = git(root, ['rev-parse', 'HEAD']);
  event.closeSha = closeSha;
  writeFileSync(completionLogPath, `${JSON.stringify(event)}\n`);
  git(root, ['add', completionLogRel]);
  git(root, ['commit', '-qm', 'record close identity']);
  const reconciledCommit = git(root, ['rev-parse', 'HEAD']);
  return {
    root, planRel, initiativeRel, creationGateRel, completionLogRel, receiptRel, sidecarRel,
    planPath, initiativePath, creationGatePath, completionLogPath, receiptPath,
    reviewedSha, closeSha, reconciledCommit, event,
    options: {
      root, projectId: 'proj', planSlug: 'demo', phaseId: 'F0', planPath: planRel,
      initiativePath: initiativeRel, creationGatePath: creationGateRel,
      completionLogPath: completionLogRel, receiptPath: receiptRel, closeSha,
      sidecarPaths: [sidecarRel],
    },
  };
}
