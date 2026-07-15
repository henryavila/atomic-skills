import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const BUSINESS_INTENT = {
  value: 'Protect the successor transition.',
  workflow: 'Materialize F3 after the guarded F4 close.',
  rules: 'Receipt and close authorization must remain current.',
  outOfScope: 'No installer changes.',
  doneWhen: 'F3 is published as one validated pair.',
};

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
  const f4InitiativeRel = '.atomic-skills/projects/proj/demo/phases/archive/f4-demo.md';
  const creationGateRel = '.atomic-skills/status/creation-gates/proj-demo.json';
  const completionLogRel = '.atomic-skills/analytics/completions.jsonl';
  const receiptRel = 'docs/audits/demo-f0-reconciliation.json';
  const sidecarRel = '.atomic-skills/projects/proj/demo/phases/f3-demo.source.json';
  const planPath = join(root, planRel);
  const initiativePath = join(root, initiativeRel);
  const f4InitiativePath = join(root, f4InitiativeRel);
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
  const f4Criterion = {
    ...structuredClone(criterion), id: 'F4-G1', description: 'authority is complete',
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
        subPhaseCount: 0, status: 'done',
        exitGate: { summary: 'one', criteria: [f4Criterion] },
        reviewGate: {
          status: 'passed', at: reviewedSha, mode: 'local',
          reviewFile: '.atomic-skills/reviews/demo-f4.md',
        },
      },
      {
        id: 'F3', slug: 'f3-demo', title: 'F3', goal: 'successor', dependsOn: ['F4'],
        summary: 'Publish the guarded successor.', subPhaseCount: 1, status: 'pending',
        businessIntent: structuredClone(BUSINESS_INTENT),
        exitGate: { summary: 'none', criteria: [] },
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
  writeMarkdown(f4InitiativePath, {
    ...structuredClone(initiative),
    slug: 'f4-demo', title: 'F4', goal: 'authority', phaseId: 'F4',
    exitGates: [structuredClone(f4Criterion)],
    tasks: [{
      id: 'T-001', title: 'authority', status: 'done',
      lastUpdated: '2026-07-14T20:00:00Z', closedAt: '2026-07-14T20:00:00Z',
    }],
  }, '# F4 Initiative');
  mkdirSync(dirname(creationGatePath), { recursive: true });
  writeFileSync(creationGatePath, `${JSON.stringify({
    schemaVersion: '0.1', kind: 'new-plan', slug: 'demo', projectId: 'proj',
    stage: 'ready', status: 'ready', filesPlanned: [planRel, initiativeRel, sidecarRel],
    filesWritten: [planRel, initiativeRel, sidecarRel],
  }, null, 2)}\n`);
  mkdirSync(dirname(join(root, sidecarRel)), { recursive: true });
  writeFileSync(join(root, sidecarRel), '{"captureVersion":"0.1","phaseId":"F3"}\n');
  mkdirSync(join(root, '.atomic-skills', 'reviews'), { recursive: true });
  const reviewReceipt = (mode) => `---\nartifact: ${'0'.repeat(40)}..${reviewedSha}\nskill: review-code\nreviewer: gpt-5-codex\nmode: ${mode}\nfinal_verdict: approve\nschema_version: "1.0"\n---\n`;
  writeFileSync(join(root, '.atomic-skills/reviews/demo-f0.md'), reviewReceipt('both'));
  writeFileSync(join(root, '.atomic-skills/reviews/demo-f4.md'), reviewReceipt('local'));
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
  const f4Event = {
    ts: '2026-07-14T20:00:01Z', event: 'phase-done', projectId: 'proj',
    planSlug: 'demo', phaseId: 'F4', taskId: null, weight: 1, weightBasis: 'count',
    idempotencyKey: 'phase-done:proj/demo/F4@2026-07-14T20%3A00%3A01Z', closeSha,
  };
  writeFileSync(completionLogPath, `${JSON.stringify(event)}\n${JSON.stringify(f4Event)}\n`);
  git(root, ['add', completionLogRel]);
  git(root, ['commit', '-qm', 'record close identity']);
  const reconciledCommit = git(root, ['rev-parse', 'HEAD']);
  return {
    root, planRel, initiativeRel, f4InitiativeRel, creationGateRel, completionLogRel, receiptRel, sidecarRel,
    planPath, initiativePath, f4InitiativePath, creationGatePath, completionLogPath, receiptPath,
    reviewedSha, closeSha, reconciledCommit, event, f4Event,
    options: {
      root, projectId: 'proj', planSlug: 'demo', phaseId: 'F0', planPath: planRel,
      initiativePath: initiativeRel, creationGatePath: creationGateRel,
      completionLogPath: completionLogRel, receiptPath: receiptRel, closeSha,
      sidecarPaths: [sidecarRel],
    },
  };
}

export function buildF3Pair(state) {
  const raw = readFileSync(state.planPath, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.currentPhase = 'F3';
  plan.lastUpdated = '2026-07-14T20:01:00Z';
  plan.phases.find((phase) => phase.id === 'F3').status = 'active';
  const planContent = markdown(plan, '# Plan');
  const initiativeContent = markdown({
    schemaVersion: '0.2', slug: 'f3-demo', title: 'F3', goal: 'successor',
    summary: 'Publish the guarded successor.', status: 'active', branch: 'plan/demo',
    started: '2026-07-14T20:01:00Z', lastUpdated: '2026-07-14T20:01:00Z',
    nextAction: 'Run `done T-001` after publishing the guarded successor.',
    parentPlan: 'demo', phaseId: 'F3', businessIntent: structuredClone(BUSINESS_INTENT),
    tasks: [{
      id: 'T-001', title: 'Publish successor', summary: 'Publish the successor pair.',
      status: 'pending', lastUpdated: '2026-07-14T20:01:00Z', weight: 1,
      verifier: { kind: 'shell', command: 'true', expectExitCode: 0 },
    }],
    exitGates: [], stack: [], parked: [], emerged: [],
  }, '# Initiative');
  return { planContent, initiativeContent, expectedPlanHash: sha256(raw) };
}
