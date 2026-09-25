import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessHostWrite,
  assessPenRegistration,
  decidePen,
  extractPenHookScriptToken,
  parseApplyPatchPaths,
  pathInsideWorktree,
  penMatcher,
  resolveAutomateHost,
} from '../src/automate-host-pen.js';
import { runHostWriteProbe, runSyntheticProbe } from '../scripts/automate-run.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function registered() {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Edit|Write|search_replace|write',
          hooks: [{ command: 'bash pre-write.sh' }],
        },
        {
          matcher: penMatcher(),
          hooks: [{ command: 'bash "$PWD/.atomic-skills/status/hooks/automate-pen.sh"' }],
        },
      ],
    },
  };
}

describe('automate host pen', () => {
  it('accepts only claude-code, codex, and grok', () => {
    assert.equal(resolveAutomateHost('claude'), 'claude-code');
    assert.equal(resolveAutomateHost('Codex'), 'codex');
    assert.equal(resolveAutomateHost('grok'), 'grok');
    assert.equal(resolveAutomateHost('cursor'), null);
  });

  it('rejects a provenance-only matcher for every host', () => {
    const legacy = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit|search_replace|write',
            hooks: [{ command: 'bash pre-write.sh' }],
          },
        ],
      },
    };
    for (const host of ['claude-code', 'codex', 'grok']) {
      const result = assessPenRegistration(host, legacy);
      assert.equal(result.ok, false);
      assert.match(result.reason, /automate-pen\.sh/);
    }
  });

  it('requires Codex apply_patch and each host shell on the pen entry', () => {
    const hooks = registered();
    assert.equal(assessPenRegistration('codex', hooks).ok, true);
    assert.equal(assessPenRegistration('claude-code', hooks).ok, true);
    assert.equal(assessPenRegistration('grok', hooks).ok, true);

    const noPatch = structuredClone(hooks);
    noPatch.hooks.PreToolUse[1].matcher = penMatcher().replace('apply_patch|', '');
    const codex = assessPenRegistration('codex', noPatch);
    assert.equal(codex.ok, false);
    assert.match(codex.reason, /apply_patch/);
  });

  it('denies product writes and shells while the lock is held', () => {
    assert.equal(decidePen({ lockHeld: false, toolName: 'Write', filePath: '/src/a.js' }).deny, false);
    assert.equal(
      decidePen({ lockHeld: true, toolName: 'apply_patch', filePath: '/repo/src/a.js' }).deny,
      true,
    );
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'write',
        filePath: '/work/src/a.js',
        writerWorktree: '/work',
      }).deny,
      false,
    );
    assert.equal(decidePen({ lockHeld: true, toolName: 'Bash' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'shell' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'run_terminal_command' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: '' }).deny, true);
  });

  it('resolves paths and rejects worktree traversal and filesystem-root worktrees', () => {
    assert.equal(pathInsideWorktree('/tmp/wt/src/a.js', '/tmp/wt'), true);
    assert.equal(pathInsideWorktree('/tmp/wt/../secret.js', '/tmp/wt'), false);
    assert.equal(pathInsideWorktree('../secret.js', '/tmp/wt'), false);
    assert.equal(pathInsideWorktree('/etc/passwd', '/'), false);
    assert.equal(pathInsideWorktree('/etc/passwd', '/tmp/wt'), false);
    assert.equal(pathInsideWorktree('/tmp/wt-evil/a.js', '/tmp/wt'), false);
    assert.equal(pathInsideWorktree('/tmp/wt', '/tmp/wt'), true);
  });

  it('is fail-closed while locked: unknown tools and reads are denied; listed writes may pass the worktree check', () => {
    // No read allowlist: read_file, Read, and grep are denied while the lock is held.
    assert.equal(decidePen({ lockHeld: true, toolName: 'read_file' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'Read' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'grep' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'FooWrite' }).deny, true);
    assert.equal(decidePen({ lockHeld: true, toolName: 'NotebookEdit' }).deny, true);
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'NotebookEdit',
        filePath: '/work/n.ipynb',
        writerWorktree: '/work',
      }).deny,
      false,
    );
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'notebookedit',
        filePath: '/etc/passwd',
        writerWorktree: '/work',
      }).deny,
      true,
    );
    assert.equal(decidePen({ lockHeld: true, toolName: 'WRITE', filePath: '/x' }).deny, true);
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'WRITE',
        filePath: '/work/a.js',
        writerWorktree: '/work',
      }).deny,
      false,
    );
    assert.equal(decidePen({ lockHeld: true, toolName: 'BASH' }).deny, true);
  });

  it('requires NotebookEdit on the Claude Code pen matcher', () => {
    const hooks = registered();
    assert.equal(assessPenRegistration('claude-code', hooks).ok, true);
    const noNotebook = structuredClone(hooks);
    noNotebook.hooks.PreToolUse[1].matcher = penMatcher().replace('NotebookEdit|', '');
    const claude = assessPenRegistration('claude-code', noNotebook);
    assert.equal(claude.ok, false);
    assert.match(claude.reason, /NotebookEdit/);
  });

  it('rejects a substring spoof as the pen command', () => {
    const spoof = {
      hooks: {
        PreToolUse: [
          {
            matcher: penMatcher(),
            hooks: [{ command: 'echo automate-pen.sh; exit 2' }],
          },
        ],
      },
    };
    for (const host of ['claude-code', 'codex', 'grok']) {
      const result = assessPenRegistration(host, spoof);
      assert.equal(result.ok, false);
      assert.match(result.reason, /automate-pen\.sh/);
    }
    assert.equal(extractPenHookScriptToken('echo automate-pen.sh; exit 2'), null);
    assert.equal(extractPenHookScriptToken('bash -c "echo automate-pen.sh; exit 2"'), null);
    assert.equal(
      extractPenHookScriptToken('bash "$PWD/.atomic-skills/status/hooks/automate-pen.sh"'),
      '$PWD/.atomic-skills/status/hooks/automate-pen.sh',
    );
  });

  it('parses apply_patch paths and only allows in-tree hunks', () => {
    const inTree = '*** Begin Patch\n*** Update File: src/a.js\n@@\n+x\n*** End Patch\n';
    const outOfTree = '*** Begin Patch\n*** Update File: /etc/passwd\n@@\n+x\n*** End Patch\n';
    const mixed =
      '*** Begin Patch\n*** Update File: src/a.js\n*** Add File: /etc/passwd\n*** End Patch\n';
    assert.deepEqual(parseApplyPatchPaths(inTree), ['src/a.js']);
    assert.deepEqual(parseApplyPatchPaths(outOfTree), ['/etc/passwd']);
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'apply_patch',
        patch: inTree,
        writerWorktree: '/work',
      }).deny,
      false,
    );
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'apply_patch',
        patch: outOfTree,
        writerWorktree: '/work',
      }).deny,
      true,
    );
    assert.equal(
      decidePen({
        lockHeld: true,
        toolName: 'apply_patch',
        patch: mixed,
        writerWorktree: '/work',
      }).deny,
      true,
    );
  });

  it('hook exits 2 for a Codex patch while the lock is held, and 0 without it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-'));
    mkdirSync(join(dir, '.atomic-skills'), { recursive: true });
    writeFileSync(join(dir, '.atomic-skills/package-root'), `${ROOT}\n`);
    const lock = join(dir, 'pen.lock');
    writeFileSync(lock, '{}\n');
    const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
    const payload = JSON.stringify({
      tool_name: 'apply_patch',
      tool_input: { file_path: '/repo/src/a.js' },
    });
    const denied = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: dir,
        CLAUDE_PROJECT_DIR: ROOT,
        AUTOMATE_PEN_LOCK: lock,
      },
    });
    assert.equal(denied.status, 2);
    assert.match(denied.stderr, /blocked apply_patch/);

    const allowed = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: dir,
        CLAUDE_PROJECT_DIR: ROOT,
        AUTOMATE_PEN_LOCK: join(dir, 'missing.lock'),
      },
    });
    assert.equal(allowed.status, 0);

    const isolated = mkdtempSync(join(tmpdir(), 'pen-override-'));
    mkdirSync(join(isolated, '.atomic-skills/status/automate'), { recursive: true });
    const realPen = join(isolated, '.atomic-skills/status/automate/pen.lock');
    writeFileSync(realPen, '{}\n');
    const missingOverride = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: dir,
        CLAUDE_PROJECT_DIR: isolated,
        GROK_WORKSPACE_ROOT: isolated,
        AUTOMATE_PEN_LOCK: '/no/such/file',
      },
    });
    assert.equal(missingOverride.status, 2);
    assert.match(missingOverride.stderr, /blocked apply_patch/);
    rmSync(isolated, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  });

  it('hook allows an in-tree apply_patch and denies /etc/passwd while the lock is held', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-patch-'));
    mkdirSync(join(dir, '.atomic-skills'), { recursive: true });
    writeFileSync(join(dir, '.atomic-skills/package-root'), `${ROOT}\n`);
    const lock = join(dir, 'pen.lock');
    writeFileSync(lock, JSON.stringify({ writerWorktree: dir }) + '\n');
    const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
    const env = {
      ...process.env,
      HOME: dir,
      CLAUDE_PROJECT_DIR: dir,
      AUTOMATE_PEN_LOCK: lock,
    };
    const inTree = spawnSync('bash', [script], {
      input: JSON.stringify({
        tool_name: 'apply_patch',
        tool_input: {
          patch: `*** Begin Patch\n*** Update File: ${join(dir, 'src/a.js')}\n@@\n+x\n*** End Patch\n`,
        },
      }),
      encoding: 'utf8',
      env,
    });
    assert.equal(inTree.status, 0, inTree.stderr);
    const outside = spawnSync('bash', [script], {
      input: JSON.stringify({
        tool_name: 'apply_patch',
        tool_input: {
          patch: '*** Begin Patch\n*** Update File: /etc/passwd\n@@\n+x\n*** End Patch\n',
        },
      }),
      encoding: 'utf8',
      env,
    });
    assert.equal(outside.status, 2);
    assert.match(outside.stderr, /blocked apply_patch/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('ships the pen hook on the Grok plugin and in project setup', () => {
    const generator = readFileSync(join(ROOT, 'src/providers/skills-file-set.js'), 'utf8');
    const setup = readFileSync(
      join(ROOT, 'skills/shared/project-assets/project-setup.md'),
      'utf8',
    );
    assert.match(generator, /automate-pen\.sh/);
    assert.match(generator, /apply_patch\|Bash\|shell\|run_terminal_command/);
    assert.match(generator, /NotebookEdit/);
    assert.match(setup, /automate-pen\.sh/);
    assert.match(setup, /apply_patch/);
    assert.match(setup, /NotebookEdit/);
  });

  it('treats probe.lock as a deny and leaves pen.lock untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'probe-'));
    const home = mkdtempSync(join(tmpdir(), 'probe-home-'));
    const probe = join(dir, '.atomic-skills/status/automate/probe.lock');
    const pen = join(dir, '.atomic-skills/status/automate/pen.lock');
    mkdirSync(join(home, '.atomic-skills'), { recursive: true });
    mkdirSync(join(dir, '.atomic-skills/status/automate'), { recursive: true });
    writeFileSync(join(home, '.atomic-skills/package-root'), `${ROOT}\n`);
    writeFileSync(probe, '{"kind":"probe"}\n');
    const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
    const payload = JSON.stringify({
      tool_name: 'apply_patch',
      tool_input: { file_path: join(dir, 'sentinel.js') },
    });
    const env = {
      ...process.env,
      HOME: home,
      CLAUDE_PROJECT_DIR: dir,
      GROK_WORKSPACE_ROOT: dir,
    };
    delete env.AUTOMATE_PEN_LOCK;
    delete env.AUTOMATE_PROBE_LOCK;
    const denied = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: { ...env, AUTOMATE_PROBE_LOCK: probe },
    });
    assert.equal(denied.status, 2);
    assert.equal(existsSync(pen), false);
    rmSync(probe, { force: true });
    const allowed = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env,
    });
    assert.equal(allowed.status, 0);
    assert.equal(existsSync(join(dir, 'sentinel.js')), false);
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('accepts a refused host write only when the hook ran and no file appeared', () => {
    assert.equal(
      assessHostWrite({ invokedHook: true, refused: true, sentinelCreated: false }).ok,
      true,
    );
    const created = assessHostWrite({
      invokedHook: true,
      refused: true,
      sentinelCreated: true,
    });
    assert.equal(created.ok, false);
    assert.match(created.reason, /created a file/);
    const skipped = assessHostWrite({
      invokedHook: false,
      refused: false,
      sentinelCreated: false,
    });
    assert.equal(skipped.ok, false);
    assert.match(skipped.reason, /did not prove/);
  });

  it('find-unreviewed-plans --require-external rejects internal-only and non-CLI receipts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'unrev-ext-'));
    const plan = join(dir, 'plan.md');
    const script = join(ROOT, 'scripts/find-unreviewed-plans.js');
    const run = (args, body) => {
      writeFileSync(plan, body);
      return spawnSync(process.execPath, [script, ...args, plan], { encoding: 'utf8' });
    };
    const internalOnly = `---
slug: fixture
status: active
---

# fixture

## Reviews

- internal: session-written
`;
    const labelsOnly = `---
slug: fixture
status: active
---

# fixture

## Reviews

- internal: session-written
- cross-model (codex): needs_changes
- ground-truth: complete | mode=ground-truth | fp=abc123abc123
`;
    const withCli = `---
slug: fixture
status: active
---

# fixture

## Reviews

- internal: session-written
- grok: command=grok review --plan plan.md | exit=0 | verdict=CLEAN | stderr=
`;
    const noFlag = run([], internalOnly);
    assert.equal(noFlag.status, 0, noFlag.stdout + noFlag.stderr);
    const onlyInternal = run(['--require-external'], internalOnly);
    assert.equal(onlyInternal.status, 1);
    assert.match(`${onlyInternal.stdout}${onlyInternal.stderr}`, /external CLI review receipt/);
    const labels = run(['--require-external'], labelsOnly);
    assert.equal(labels.status, 1);
    assert.match(`${labels.stdout}${labels.stderr}`, /external CLI review receipt/);
    const ok = run(['--require-external'], withCli);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    rmSync(dir, { recursive: true, force: true });
  });

  it('find-unreviewed-plans --require-external rejects failed exit and non-pass verdicts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'unrev-quality-'));
    const plan = join(dir, 'plan.md');
    const script = join(ROOT, 'scripts/find-unreviewed-plans.js');
    const run = (args, body) => {
      writeFileSync(plan, body);
      return spawnSync(process.execPath, [script, ...args, plan], { encoding: 'utf8' });
    };
    const receipt = (line) => `---
slug: fixture
status: active
---

# fixture

## Reviews

- internal: session-written
${line}
`;
    const noFlag = run([], receipt('- internal: still counts without the flag'));
    assert.equal(noFlag.status, 0, noFlag.stdout + noFlag.stderr);
    const failedExit = run(
      ['--require-external'],
      receipt('- grok: command=grok review --plan plan.md | exit=127 | verdict=CLEAN | stderr='),
    );
    assert.equal(failedExit.status, 1);
    assert.match(`${failedExit.stdout}${failedExit.stderr}`, /external CLI review receipt/);
    const needsChanges = run(
      ['--require-external'],
      receipt('- grok: command=grok review --plan plan.md | exit=0 | verdict=needs_changes | stderr='),
    );
    assert.equal(needsChanges.status, 1);
    const passed = run(
      ['--require-external'],
      receipt('- grok: command=grok review --plan plan.md | exit=0 | verdict=PASSED | stderr='),
    );
    assert.equal(passed.status, 0, passed.stdout + passed.stderr);
    const okVerdict = run(
      ['--require-external'],
      receipt('- grok: command=grok review --plan plan.md | exit=0 | verdict=ok | stderr='),
    );
    assert.equal(okVerdict.status, 0, okVerdict.stdout + okVerdict.stderr);
    rmSync(dir, { recursive: true, force: true });
  });

  it('startup calls find-unreviewed-plans --require-external', () => {
    const src = readFileSync(join(ROOT, 'scripts/automate-run.js'), 'utf8');
    assert.match(src, /find-unreviewed-plans\.js',\s*'--require-external'/);
    assert.match(src, /runHostWriteProbe\(/);
    assert.match(src, /--host-write-probe/);
  });

  it('host-shaped probe invokes the registered pen and refuses a write without a sentinel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'host-write-'));
    mkdirSync(join(dir, '.codex'), { recursive: true });
    const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
    writeFileSync(
      join(dir, '.codex/hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: penMatcher(),
              hooks: [{ command: `bash "${script}"` }],
            },
          ],
        },
      }),
    );
    const result = runHostWriteProbe('codex', dir);
    assert.equal(result.ok, true, result.ok ? '' : result.reason);
    assert.equal(existsSync(join(dir, '.atomic-skills/status/automate/pen.lock')), false);
    assert.equal(existsSync(join(dir, '.atomic-skills/status/automate/probe.lock')), false);
    assert.equal(
      existsSync(join(dir, '.atomic-skills/status/automate/host-write-sentinel')),
      false,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('host-shaped probe rejects a command substring spoof', () => {
    const dir = mkdtempSync(join(tmpdir(), 'host-spoof-'));
    mkdirSync(join(dir, '.codex'), { recursive: true });
    writeFileSync(
      join(dir, '.codex/hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: penMatcher(),
              hooks: [{ command: 'echo automate-pen.sh; exit 2' }],
            },
          ],
        },
      }),
    );
    const result = runHostWriteProbe('codex', dir);
    assert.equal(result.ok, false);
    assert.match(result.reason, /did not prove/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('startup probes use a unique lock and do not delete leftover probe.lock or sentinel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'probe-leftover-'));
    mkdirSync(join(dir, '.atomic-skills/status/automate'), { recursive: true });
    mkdirSync(join(dir, '.codex'), { recursive: true });
    const leftover = join(dir, '.atomic-skills/status/automate/probe.lock');
    const leftoverSentinel = join(dir, '.atomic-skills/status/automate/host-write-sentinel');
    writeFileSync(leftover, '{"kind":"leftover"}\n');
    writeFileSync(leftoverSentinel, 'keep\n');
    runSyntheticProbe(dir);
    assert.equal(readFileSync(leftover, 'utf8'), '{"kind":"leftover"}\n');
    const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
    writeFileSync(
      join(dir, '.codex/hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: penMatcher(),
              hooks: [{ command: `bash "${script}"` }],
            },
          ],
        },
      }),
    );
    runHostWriteProbe('codex', dir);
    assert.equal(readFileSync(leftover, 'utf8'), '{"kind":"leftover"}\n');
    assert.equal(readFileSync(leftoverSentinel, 'utf8'), 'keep\n');
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses a fixture plan without flow and does not leave a lock', () => {
    const dir = mkdtempSync(join(tmpdir(), 'automate-run-'));
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n');
    const probe = runSyntheticProbe(dir);
    assert.deepEqual(probe, []);
    const res = spawnSync(process.execPath, [
      join(ROOT, 'scripts/automate-run.js'),
      '--host', 'codex',
      '--plan', plan,
      '--root', dir,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /automate-pen\.sh/);
    assert.match(res.stderr, /find-missing-architecture\.js/);
    assert.match(res.stderr, /did not prove the host refused the write/);
    assert.match(res.stderr, /external CLI review receipt/);
    assert.equal(
      existsSync(join(dir, '.atomic-skills/status/automate/pen.lock')),
      false,
    );
    assert.equal(
      existsSync(join(dir, '.atomic-skills/status/automate/probe.lock')),
      false,
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
