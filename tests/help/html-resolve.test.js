import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  HTML_GUIDE_PATH,
  formatHelp,
  htmlGuideExists,
  openHtmlGuide,
  resolveHtmlGuide,
} from '../../scripts/compute-help.js';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const COMPUTE = join(ROOT, 'scripts', 'compute-help.js');

function makeDir({ withHtml = false, withState = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'help-html-'));
  if (withHtml) {
    const htmlPath = join(dir, HTML_GUIDE_PATH);
    mkdirSync(dirname(htmlPath), { recursive: true });
    writeFileSync(htmlPath, '<!doctype html><title>Project onboarding</title>');
  }
  if (withState) {
    const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'help-command');
    mkdirSync(join(planDir, 'phases'), { recursive: true });
    writeFileSync(join(planDir, 'plan.md'), [
      '---',
      'schemaVersion: "0.1"',
      'slug: help-command',
      'status: active',
      'currentPhase: F2',
      'phases:',
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
      'nextAction: "Rode `done T-002` depois de implementar `help --html`."',
      'tasksDone: 1',
      'tasksTotal: 2',
      'tasks:',
      '  - id: T-001',
      '    status: done',
      '  - id: T-002',
      '    status: pending',
      '---',
      '# f2',
      '',
    ].join('\n'));
  }
  return dir;
}

function sampleJson() {
  return {
    youAreHere: { planSlug: 'help-command', phaseId: 'F2', phaseSummary: 'Rendering do bloco de ensino' },
    doneSummary: { phasesDone: 1, phasesTotal: 2, tasksDone: 1, tasksTotal: 2, blocked: 0 },
    nextStep: {
      command: 'Rode `done T-002` depois de implementar `help --html`.',
      reason: 'A fase tem tasks abertas para codar.',
      why: 'implement dirige as tasks admitidas ate done, uma a uma.',
    },
    escapes: ['why F2', 'status --browser', 'help'],
    spineStage: { n: 6, m: 10, name: 'IMPLEMENT' },
  };
}

test('resolveHtmlGuide: fixed contract path resolves under the requested repo root', () => {
  const dir = makeDir({ withHtml: true });
  try {
    const guide = resolveHtmlGuide({ dir });
    assert.equal(guide.contractPath, HTML_GUIDE_PATH);
    assert.equal(guide.exists, true);
    assert.equal(guide.path, join(dir, HTML_GUIDE_PATH));
    assert.match(guide.url, /^file:\/\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveHtmlGuide: a directory at the contract path is not treated as HTML', () => {
  const dir = makeDir();
  try {
    mkdirSync(join(dir, HTML_GUIDE_PATH), { recursive: true });
    const guide = resolveHtmlGuide({ dir });
    assert.equal(guide.exists, false);
    assert.equal(htmlGuideExists(dir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openHtmlGuide: present HTML invokes the injected open_url helper and exits 0', () => {
  const dir = makeDir({ withHtml: true });
  const calls = [];
  const output = [];
  try {
    const result = openHtmlGuide({
      dir,
      openUrl: (url) => { calls.push(url); return true; },
      write: (text) => output.push(text),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.opened, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^file:\/\//);
    assert.match(calls[0], /docs\/design\/project-onboarding\/index\.html$/);
    assert.match(output.join(''), /GUIA VISUAL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openHtmlGuide: missing HTML is fail-open and does not call the opener', () => {
  const dir = makeDir();
  const calls = [];
  const output = [];
  try {
    const result = openHtmlGuide({
      dir,
      openUrl: (url) => { calls.push(url); return true; },
      write: (text) => output.push(text),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.opened, false);
    assert.equal(result.reason, 'missing');
    assert.equal(calls.length, 0);
    assert.match(output.join(''), new RegExp(HTML_GUIDE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openHtmlGuide: opener failure is fail-open and still exits 0', () => {
  const dir = makeDir({ withHtml: true });
  const output = [];
  try {
    const result = openHtmlGuide({
      dir,
      openUrl: () => false,
      write: (text) => output.push(text),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.opened, false);
    assert.equal(result.reason, 'opener-failed');
    assert.match(output.join(''), /Open manually:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('formatHelp and --render show GUIA VISUAL only when the contract HTML exists', () => {
  const withoutHtml = makeDir({ withState: true });
  const withHtml = makeDir({ withHtml: true, withState: true });
  try {
    assert.equal(htmlGuideExists(withoutHtml), false);
    assert.equal(htmlGuideExists(withHtml), true);
    assert.doesNotMatch(formatHelp(sampleJson(), { hasHtmlGuide: htmlGuideExists(withoutHtml) }), /GUIA VISUAL/);
    assert.match(formatHelp(sampleJson(), { hasHtmlGuide: htmlGuideExists(withHtml) }), /GUIA VISUAL\s+→ project help --html/);

    const absent = spawnSync(process.execPath, [COMPUTE, '--render', withoutHtml], { encoding: 'utf8' });
    const present = spawnSync(process.execPath, [COMPUTE, '--render', withHtml], { encoding: 'utf8' });
    assert.equal(absent.status, 0, absent.stderr);
    assert.equal(present.status, 0, present.stderr);
    assert.doesNotMatch(absent.stdout, /GUIA VISUAL/);
    assert.match(present.stdout, /GUIA VISUAL\s+→ project help --html/);
  } finally {
    rmSync(withoutHtml, { recursive: true, force: true });
    rmSync(withHtml, { recursive: true, force: true });
  }
});

test('project-help asset names open_url as the canonical opener for help --html', () => {
  const asset = readFileSync(join(ROOT, 'skills', 'shared', 'project-assets', 'project-help.md'), 'utf8');
  assert.match(asset, /open_url/);
  assert.match(asset, /project-view\.md/);
  assert.match(asset, /docs\/design\/project-onboarding\/index\.html/);
});
