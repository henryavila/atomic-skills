import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { formatHelp } from '../../scripts/compute-help.js';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const COMPUTE = join(ROOT, 'scripts', 'compute-help.js');

function sampleJson() {
  return {
    youAreHere: {
      planSlug: 'help-command',
      phaseId: 'F2',
      phaseSummary: 'Rendering do bloco de ensino',
    },
    doneSummary: {
      phasesDone: 2,
      phasesTotal: 4,
      tasksDone: 0,
      tasksTotal: 2,
      blocked: 0,
    },
    nextStep: {
      command: 'Rode `done T-001` depois de adicionar o smoke test de render e ligar project-help.md ao compute-help.js',
      commandSource: 'persisted',
      reason: 'A fase tem tasks abertas para codar.',
      why: 'implement dirige as tasks admitidas ate done, uma a uma.',
    },
    escapes: ['why F2', 'status --browser', 'help'],
    spineStage: { n: 6, m: 10, name: 'IMPLEMENT' },
  };
}

function buildFixtureTree() {
  const dir = mkdtempSync(join(tmpdir(), 'render-help-'));
  const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'help-command');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), [
    '---',
    'schemaVersion: "0.1"',
    'slug: help-command',
    'status: active',
    'currentPhase: F2',
    'phases:',
    '  - id: F1',
    '    status: done',
    '  - id: F2',
    '    status: active',
    '---',
    '# help-command',
    '',
  ].join('\n'));
  writeFileSync(join(planDir, 'phases', 'f2.md'), [
    '---',
    'schemaVersion: "0.1"',
    'slug: help-command-f2',
    'status: active',
    'phaseId: F2',
    'parentPlan: help-command',
    'title: Rendering do bloco de ensino',
    'nextAction: "Rode `done T-001` depois de adicionar o smoke test de render e ligar project-help.md ao compute-help.js"',
    'tasksDone: 0',
    'tasksTotal: 2',
    'tasks:',
    '  - id: T-001',
    '    status: pending',
    '  - id: T-002',
    '    status: pending',
    '---',
    '# f2',
    '',
  ].join('\n'));
  return dir;
}

test('formatHelp: renders the terminal teaching block with the persisted command verbatim', () => {
  const out = formatHelp(sampleJson());
  assert.match(out, /VOC[EÊ] EST[AÁ] AQUI\s+help-command · F2 \(Rendering do bloco de ensino\) — est[aá]gio 6\/10 do ciclo/);
  assert.match(out, /MAPA\s+.*\[IMPLEMENT\] voce esta aqui/);
  assert.match(out, /FEITO\s+fases 2\/4 · tasks 0\/2 · 0 blocked/);
  assert.match(out, /PR[OÓ]XIMO PASSO\s+→ Rode `done T-001` depois de adicionar o smoke test de render e ligar project-help\.md ao compute-help\.js/);
  assert.match(out, /POR QU[EÊ]\s+implement dirige as tasks admitidas ate done, uma a uma\./);
  assert.match(out, /SE TRAVAR\s+→ project why F2\s+·\s+project status --browser\s+·\s+project help/);
});

test('compute-help --render: covers the IO-to-render path used by project help', () => {
  const dir = buildFixtureTree();
  try {
    const result = spawnSync(process.execPath, [COMPUTE, '--render', dir], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /VOC[EÊ] EST[AÁ] AQUI\s+help-command · F2/);
    assert.match(result.stdout, /PR[OÓ]XIMO PASSO\s+→ Rode `done T-001` depois de adicionar o smoke test de render e ligar project-help\.md ao compute-help\.js/);
    assert.match(result.stdout, /MAPA\s+.*\[IMPLEMENT\] voce esta aqui/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('project-help asset delegates normal help rendering to compute-help --render', () => {
  const asset = readFileSync(join(ROOT, 'skills', 'shared', 'project-assets', 'project-help.md'), 'utf8');
  assert.match(asset, /\{\{BASH_TOOL\}\}/);
  assert.match(asset, /scripts\/compute-help\.js/);
  assert.match(asset, /--render/);
  assert.doesNotMatch(asset, /Enquanto F2 n[aã]o landa/);
});
