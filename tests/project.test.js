import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';
import { PUBLIC_IDE_IDS } from '../src/config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const SKILLS_DIR = join(__dirname, '..', 'skills');
const META_DIR = join(__dirname, '..', 'meta');

const HOST_HOOK_MATRIX = [
  {
    host: 'Claude Code',
    ideId: 'claude-code',
    skillPath: '.claude/commands/atomic-skills/<skill>.md',
    hookConfig: '.claude/settings.local.json',
  },
  {
    host: 'Cursor',
    ideId: 'cursor',
    skillPath: '.cursor/skills/atomic-skills/<skill>/SKILL.md',
    hookConfig: null,
  },
  {
    host: 'Gemini CLI',
    ideId: 'gemini',
    skillPath: '.gemini/skills/atomic-skills/<skill>/SKILL.md',
    hookConfig: null,
  },
  {
    host: 'Codex',
    ideId: 'codex',
    skillPath: '.agents/skills/atomic-skills/<skill>/SKILL.md',
    hookConfig: '.codex/hooks.json',
  },
  {
    host: 'OpenCode',
    ideId: 'opencode',
    skillPath: '.opencode/skills/atomic-skills/<skill>/SKILL.md',
    hookConfig: null,
  },
  {
    host: 'GitHub Copilot',
    ideId: 'github-copilot',
    skillPath: '.github/skills/atomic-skills/<skill>/SKILL.md',
    hookConfig: null,
  },
];

const GENERIC_NO_HOOK_HOST = 'generic IDE';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// After the v2.0.0 unification, `project-status` + `project-plan` are a single
// `project` skill: a thin router (skills/core/project.md) plus lazy detail
// files (skills/shared/project-assets/project-*.md) installed to _assets/.
// The router holds dispatch + always-resident invariants; procedures live in
// the lazy files. Tests therefore assert against BOTH the rendered router and
// the rendered asset files.

describe('project skill (unified router + lazy assets)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-project-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function install(language = 'en', ides = ['claude-code']) {
    installSkills(tempDir, {
      language,
      ides,
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
  }

  const ROUTER = '.claude/commands/atomic-skills/project.md';
  const ASSET = (name) => `.claude/atomic-skills/_assets/${name}`;

  function readRouter() {
    return readFileSync(join(tempDir, ROUTER), 'utf8');
  }
  function readRouterInitialDetection() {
    const router = readRouter();
    return router.slice(
      router.indexOf('## Initial detection'),
      router.indexOf('## No-args'),
    );
  }
  function readAsset(name) {
    return readFileSync(join(tempDir, ASSET(name)), 'utf8');
  }

  function readAideckStatusScript() {
    const content = readAsset('project-view.md');
    const section = content.indexOf('1. **Ensure aiDeck is running.**');
    const start = content.indexOf('```bash', section) + '```bash'.length;
    const end = content.indexOf('```', start);
    assert.ok(section >= 0 && start >= '```bash'.length && end > start, 'ensure-aiDeck script block missing');
    return content.slice(start, end);
  }

  function runAideckStatusScript({
    repoName,
    projectIds = [],
    registeredProjectId,
    registrationRoot = 'same-repo',
    omitRegistrationRoot = false,
    emptyRegistration = false,
  }) {
    const repo = join(tempDir, repoName);
    let registeredRoot = registrationRoot === 'same-repo' ? '__SAME_REPO__' : registrationRoot;
    const home = join(tempDir, 'home');
    const fakeBin = join(tempDir, 'bin');
    const curlLog = join(tempDir, 'curl.log');
    for (const projectId of projectIds) {
      const planDir = join(repo, '.atomic-skills', 'projects', projectId, 'demo');
      mkdirSync(planDir, { recursive: true });
      writeFileSync(join(planDir, 'plan.md'), '---\nslug: demo\n---\n');
    }
    mkdirSync(join(home, '.aideck'), { recursive: true });
    mkdirSync(join(home, '.atomic-skills', 'bin'), { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    mkdirSync(repo, { recursive: true });
    if (registrationRoot === 'same-repo-alias') {
      registeredRoot = join(tempDir, repoName + '-alias');
      symlinkSync(repo, registeredRoot, process.platform === 'win32' ? 'junction' : 'dir');
    }
    writeFileSync(join(home, '.aideck', 'env'), "export AIDECK_URL='http://127.0.0.1:7777'\n");
    writeFileSync(join(home, '.atomic-skills', 'package-root'), `${PACKAGE_ROOT}\n`);
    writeFileSync(join(home, '.atomic-skills', 'bin', 'aideck.mjs'), '');
    writeFileSync(join(fakeBin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$FAKE_NPM_ROOT"\n');
    writeFileSync(join(fakeBin, 'curl'), `#!/bin/sh
printf '%s\\n' "$*" >> "$CURL_LOG"
case "$*" in
  *'/api/health'*) printf '%s\\n' '{"service":"aideck"}' ;;
  *'/api/projects/register'*)
    if [ "$EMPTY_REGISTRATION" = 1 ]; then
      printf '%s\\n' '{"project":{}}'
    elif [ "$OMIT_REGISTRATION_ROOT" = 1 ]; then
      printf '{"project":{"projectId":"%s"}}\\n' "$REGISTERED_PROJECT_ID"
    else
      registration_root="$REGISTERED_ROOT"
      [ "$registration_root" = "__SAME_REPO__" ] && registration_root="$PWD"
      printf '{"project":{"projectId":"%s","rootDir":"%s"}}\\n' "$REGISTERED_PROJECT_ID" "$registration_root"
    fi
    ;;
  *'/data/plans'*) printf '%s\\n' '{"records":[]}' ;;
esac
`);
    chmodSync(join(fakeBin, 'npm'), 0o755);
    chmodSync(join(fakeBin, 'curl'), 0o755);

    const stdout = execFileSync('bash', ['-c', readAideckStatusScript()], {
      cwd: repo,
      env: {
        ...process.env,
        HOME: home,
        PATH: `${fakeBin}:${process.env.PATH}`,
        CURL_LOG: curlLog,
        EMPTY_REGISTRATION: emptyRegistration ? '1' : '0',
        FAKE_NPM_ROOT: join(tempDir, 'missing-global-root'),
        OMIT_REGISTRATION_ROOT: omitRegistrationRoot ? '1' : '0',
        REGISTERED_PROJECT_ID: registeredProjectId,
        REGISTERED_ROOT: registeredRoot,
      },
      encoding: 'utf8',
    });
    return { calls: readFileSync(curlLog, 'utf8'), stdout };
  }

  // ─── Router: rendering + structure ──────────────────────────────────────

  it('router renders for claude-code without template leaks', () => {
    install();
    const content = readRouter();
    assert.ok(!content.includes('{{BASH_TOOL}}'), '{{BASH_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ARG_VAR}}'), '{{ARG_VAR}} must be rendered');
    assert.ok(!content.includes('{{READ_TOOL}}'), '{{READ_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ASSETS_PATH}}'), '{{ASSETS_PATH}} must be rendered');
  });

  it('router accepts a verified atomic-skills source checkout when the install marker is absent', () => {
    install();
    const content = readRouter();
    const runtime = content.slice(
      content.indexOf('## Trusted package runtime'),
      content.indexOf('## Grammar'),
    );

    assert.match(runtime, /CANDIDATE="\$PWD"/);
    assert.match(runtime, /pkg\.name === "@henryavila\/atomic-skills"/);
    assert.match(runtime, /scripts\/detect-completion\.js/);
    assert.doesNotMatch(runtime, /package-root[^\n]*\|\| echo \./);

    const script = runtime.match(/```bash\n([\s\S]*?)```/)?.[1];
    assert.ok(script, 'trusted package runtime shell block must exist');
    const resolved = execFileSync(
      'bash',
      ['-c', `${script}\nprintf '%s\\n' "$PKG_ROOT"`],
      {
        cwd: PACKAGE_ROOT,
        env: { ...process.env, HOME: join(tempDir, 'markerless-home') },
        encoding: 'utf8',
      },
    );
    assert.equal(resolved.trim(), PACKAGE_ROOT);
  });

  it('router sends empty and installer-only .atomic-skills roots to setup', () => {
    install();
    const detection = readRouterInitialDetection();

    assert.doesNotMatch(detection, /test -d \.atomic-skills\//);
    assert.match(detection, /already\s+exists or is empty/);
    assert.match(detection, /manifest\.json.*installer ledger/is);
    assert.match(detection, /hooks\/version-check\.sh.*installer runtime/is);
    assert.match(detection, /never\s+count\s+as its sentinel/);
    assert.match(detection, /setup\s+mode/i);
  });

  it('router accepts either the setup index or a nested plan as a configured sentinel', () => {
    install();
    const detection = readRouterInitialDetection();

    assert.match(detection, /\*\*Configured:\*\*/);
    assert.match(detection, /\.atomic-skills\/PROJECT-STATUS\.md/);
    assert.match(detection, /PROJECT-STATUS\.md.*schemaVersion.*# Project Status Index/is);
    assert.match(
      detection,
      /\.atomic-skills\/projects\/<project-id>\/<plan-slug>\/plan\.md/,
    );
    assert.match(detection, /nested.*plan\.md.*validate-state/is);
    assert.match(detection, /OR at least one nested/);
    assert.match(detection, /Continue with normal resolution/);
  });

  it('router diagnoses legacy flat state without fresh setup or destructive writes', () => {
    install();
    const detection = readRouterInitialDetection();

    assert.match(detection, /\*\*Legacy coexistence:\*\*/);
    assert.match(detection, /\.atomic-skills\/plans\/\*\.md/);
    assert.match(detection, /\.atomic-skills\/initiatives\/\*\.md/);
    assert.match(detection, /Do not run fresh setup over it/);
    assert.match(detection, /do not\s+delete or overwrite it/);
    assert.match(detection, /project-migrate\.md/);
    assert.match(detection, /diagnostic\/migration\s+flow/);
    assert.match(detection, /even when a configured\s+sentinel also exists/);
  });

  it('new plan and new initiative reuse the resident Project setup sentinel', () => {
    install();

    for (const asset of ['project-create-plan.md', 'project-create-initiative.md']) {
      const content = readAsset(asset);
      const preflight = content.slice(0, content.indexOf('## Steps') === -1
        ? content.indexOf('## Default flow')
        : content.indexOf('## Steps'));
      assert.doesNotMatch(preflight, /test -d \.atomic-skills\//, asset);
      assert.match(preflight, /Project setup sentinel/, asset);
      assert.match(preflight, /Configured.*Legacy coexistence.*Setup\s+required/is, asset);
      assert.match(preflight, /project-setup\.md/, asset);
      assert.match(preflight, /project-migrate\.md/, asset);
    }
  });

  it('old skill files are gone (project-status.md / project-plan.md)', () => {
    install();
    assert.ok(existsSync(join(tempDir, ROUTER)), 'project.md must exist');
    assert.ok(
      !existsSync(join(tempDir, '.claude/commands/atomic-skills/project-status.md')),
      'project-status.md must NOT be installed'
    );
    assert.ok(
      !existsSync(join(tempDir, '.claude/commands/atomic-skills/project-plan.md')),
      'project-plan.md must NOT be installed'
    );
  });

  it('router documents the Iron Law', () => {
    install();
    const content = readRouter();
    assert.match(content, /Iron Law/);
    assert.match(content, /NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE/);
  });

  it('router holds the always-resident invariants (gate-status, ratify, reconciliation, ladder)', () => {
    install();
    const content = readRouter();
    assert.match(content, /Gate-status invariant/i);
    assert.match(content, /Ratify gate/i);
    assert.match(content, /[Rr]econciliation gate/);
    assert.match(content, /[Ee]mergence ladder/);
    // The magnitude→action table is resident so ambient triggers are recognized.
    assert.match(content, /magnitude/i);
    assert.match(content, /\bpark\b/);
    assert.match(content, /\bsplit-phase\b/);
  });

  it('router holds the dispatch table referencing each lazy detail file', () => {
    install();
    const content = readRouter();
    for (const f of [
      'project-view.md', 'project-verify.md', 'project-setup.md',
      'project-create-plan.md', 'project-create-initiative.md', 'project-discover.md',
      'project-emergence.md', 'project-transitions.md', 'project-migrate.md',
      'project-drift.md',
    ]) {
      assert.ok(content.includes(f), `dispatch table must reference ${f}`);
    }
  });

  it('router dispatches help, help --html, and next to project-help.md', () => {
    install();
    const content = readRouter();
    assert.match(
      content,
      /\|\s*`help`, `help --html`, `next`\s*\|\s*`Read .*?project-help\.md`\s*\|/,
      'help dispatch row must route all help aliases to project-help.md'
    );
  });

  it('router stays thin (≤ ~250 lines so the token economy holds)', () => {
    install();
    const lineCount = readRouter().split('\n').length;
    assert.ok(lineCount <= 260, `router should stay thin, got ${lineCount} lines`);
  });

  it('router documents the git-style grammar + new menu (plan | initiative)', () => {
    install();
    const content = readRouter();
    assert.match(content, /atomic-skills:project status/);
    assert.match(content, /\bverify\b/);
    assert.match(content, /new plan/);
    assert.match(content, /new initiative/);
    // new menu exposes only the two file entities
    assert.match(content, /What do you want to create\?/);
  });

  it('router no-args summary does NOT open the browser', () => {
    install();
    const content = readRouter();
    assert.match(content, /No-args/i);
    assert.match(content, /does NOT open the browser|cheap; does NOT/i);
  });

  it('schema quick-reference lives in project-create-plan.md (moved from the router), router points to it', () => {
    install();
    // T1.1 moved the schema field-reference out of the resident router into the
    // creation flow (lazy); the router keeps a one-line pointer (P2).
    const router = readRouter();
    assert.match(router, /schema field-reference/i);
    assert.match(router, /project-create-plan\.md/);
    const content = readAsset('project-create-plan.md');
    assert.match(content, /Schema quick-reference/i);
    for (const field of [
      'currentPhase', 'parallelismAllowed', 'phases[]',
      'parentPlan', 'phaseId', 'exitGates[]', 'scope',
      'StackFrame', 'CrossTaskRef', 'ExitCriterion',
      'shell', 'query', 'test', 'manual',
    ]) {
      assert.ok(content.includes(field), `schema quick-ref must mention: ${field}`);
    }
  });

  it('router injects communication-language directive at top when language=pt', () => {
    install('pt');
    const content = readRouter();
    assert.match(content.slice(0, 900), /Communicate with the user in Portuguese/);
    assert.match(content, /Iron Law/);
  });

  it('router renders for gemini with proper tool-name substitution', () => {
    install('en', ['gemini']);
    const content = readFileSync(
      join(tempDir, '.gemini/skills/atomic-skills/project/SKILL.md'),
      'utf8'
    );
    assert.ok(content.includes('run_shell_command'), 'Gemini should get run_shell_command');
    assert.ok(!content.includes('{{BASH_TOOL}}'));
  });

  // ─── Lazy asset: view modes ─────────────────────────────────────────────

  it('project-view documents view modes default/--list/--stack/--archived/--browser/--report', () => {
    install();
    const content = readAsset('project-view.md');
    for (const mode of ['--list', '--stack', '--archived', '--browser', '--report', '--terminal', '--plan', '--phase']) {
      assert.ok(content.includes(mode), `project-view must document ${mode}`);
    }
    assert.ok(content.toLowerCase().includes('disambig'), 'view must hold the disambiguation flow');
    assert.ok(content.includes('aiDeck'), 'view must reference aiDeck');
  });

  it('project-view quarantines the aiDeck contract behind a single named constant', () => {
    install();
    const content = readAsset('project-view.md');
    // ONE shared consumer (Q10): AIDECK_CONSUMER is the FIXED `atomic-skills`;
    // the project is scoped by $pid (registered via /api/projects/register).
    // (Regression guard for the consumer-collapse fix — never per-project ids.)
    assert.match(content, /AIDECK_CONSUMER="atomic-skills"/);
    assert.doesNotMatch(content, /AIDECK_CONSUMER="\$pid"/);
    assert.match(content, /AIDECK CONTRACT/);
    // The single consumer is provisioned from the shipped template.
    assert.match(content, /provision-consumer\.js/);
    assert.match(content, /\/api\/projects\/register/);
    // The data curl uses the parameter + the $pid project scope, not a hardcoded path.
    assert.match(content, /consumers\/\$AIDECK_CONSUMER\/projects\/\$pid\/data/);
    // Separation of produce-data vs deliver-to-aiDeck is documented.
    assert.match(content, /[Pp]roduce the data/);
    assert.match(content, /[Dd]eliver to aiDeck/);
  });

  it('project-view registers and probes the sole nested project id when the worktree basename differs', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'atomic-skills',
    });
    assert.match(calls, /"projectId":"atomic-skills"/, 'registration must request the sole nested project id');
    assert.match(calls, /\/projects\/atomic-skills\/data\/plans/, 'data probe must use the registered project id');
    assert.doesNotMatch(calls, /"projectId":"plan-dependencies"/);
  });

  it('project-view falls back to the normalized worktree id when no nested project exists', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: '123-Worktree_Zero',
      registeredProjectId: 'worktree-zero',
    });
    assert.match(calls, /"projectId":"worktree-zero"/);
    assert.match(calls, /\/projects\/worktree-zero\/data\/plans/);
  });

  it('project-view keeps one root registration when multiple nested projects exist', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'Shared_Worktree',
      projectIds: ['alpha', 'beta'],
      registeredProjectId: 'shared-worktree',
    });
    assert.match(calls, /"projectId":"shared-worktree"/);
    assert.match(calls, /\/projects\/shared-worktree\/data\/plans/);
    assert.doesNotMatch(calls, /"projectId":"(?:alpha|beta)"/);
  });

  it('project-view probes the collision-resolved id returned by registration', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'atomic-skills-2',
    });
    assert.match(calls, /"projectId":"atomic-skills"/, 'request must use the canonical candidate');
    assert.match(calls, /\/projects\/atomic-skills-2\/data\/plans/, 'probe must use the server response');
  });

  it('project-view accepts a collision-resolved id for a symlinked alias of the same root', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'atomic-skills-2',
      registrationRoot: 'same-repo-alias',
    });
    assert.match(calls, /\/projects\/atomic-skills-2\/data\/plans/, 'canonical root identity must accept an alias');
  });

  it('project-view fails closed when registration returns a conflicting root', () => {
    install();
    const { calls, stdout } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'atomic-skills-2',
      registrationRoot: join(tempDir, 'different-repo'),
    });
    assert.match(calls, /"projectId":"atomic-skills"/, 'request must use the canonical candidate');
    assert.doesNotMatch(calls, /\/data\/plans/, 'a conflicting registration must not probe project data');
    assert.match(stdout, /^AIDECK_URL=$/m, 'a conflicting registration must disable the browser flow');
  });

  it('project-view accepts a legacy same-id registration without rootDir', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'atomic-skills',
      omitRegistrationRoot: true,
    });
    assert.match(calls, /\/projects\/atomic-skills\/data\/plans/);
  });

  it('project-view retains the canonical candidate when registration omits a project id', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: 'unused',
      emptyRegistration: true,
    });
    assert.match(calls, /"projectId":"atomic-skills"/);
    assert.match(calls, /\/projects\/atomic-skills\/data\/plans/);
  });

  it('project-view rejects an invalid project id returned by registration', () => {
    install();
    const { calls } = runAideckStatusScript({
      repoName: 'plan-dependencies',
      projectIds: ['atomic-skills'],
      registeredProjectId: '../outside',
    });
    assert.match(calls, /"projectId":"atomic-skills"/);
    assert.match(calls, /\/projects\/atomic-skills\/data\/plans/);
    assert.doesNotMatch(calls, /\/projects\/\.\.\/outside/);
  });

  it('project-view gates the dashboard open on a legacy flat tree (empty-dashboard guard)', () => {
    install();
    const content = readAsset('project-view.md');
    // The ensure-aideck script must DETECT the layouts: the dashboard dataSources
    // read only the nested projects/<id>/<slug>/ tree, and a flat legacy tree
    // loads as zero records (no STATE_ERROR) — so detection must be explicit.
    assert.match(content, /LEGACY_FLAT=/);
    assert.match(content, /NESTED_TREE=/);
    // Detection must be glob-free (`find ... -print -quit`): under zsh with
    // nullglob (Claude Code shell snapshots set it) `ls <unmatched-glob>`
    // becomes bare `ls` and exits 0 — a false positive that disarms the gate.
    assert.match(content, /-print -quit/);
    assert.doesNotMatch(content, /ls "\$PWD\/\.atomic-skills\/(?:plans|initiatives|projects)\/"\*/);
    // The flow must route a flat-only tree to the layout cut-over instead of
    // silently opening an empty dashboard.
    assert.match(content, /[Ll]egacy[- ]layout gate/);
    assert.match(content, /\bmigrate\b/);
  });

  it('project-view documents nested-first terminal/status resolution', () => {
    install();
    const content = readAsset('project-view.md');
    assert.match(content, /Nested-first state resolution/);
    assert.match(content, /projects\/<project-id>\/<plan-slug>\/plan\.md/);
    assert.match(content, /projects\/<project-id>\/<plan-slug>\/phases/);
    assert.match(content, /top-level `\.atomic-skills\/PROJECT-STATUS\.md` only when no nested project index exists/);
    assert.match(content, /legacy `\.atomic-skills\/plans\/archive\/\*\.md`/);
  });

  it('project-view gates every status refresh/repair write behind explicit approval', () => {
    install();
    const content = readAsset('project-view.md');
    assert.match(content, /## Mutation policy/);
    assert.match(content, /status.*read-only by default/i);
    assert.match(content, /Refresh derived dashboard state now\? \(y\/N\)/);
    assert.match(content, /Do NOT run `compute-rollups\.js` or `reconcile-focus\.js` automatically/);
    assert.match(content, /Repair STATE_ERROR now\? \(y\/N\)/);
    assert.match(content, /Terminal, list, plan, phase, stack, archived, and report views never run refresh or repair writers/);
  });

  // ─── Lazy asset: verify (NEW) ───────────────────────────────────────────

  it('project-verify defines an explicit contract (NEW command)', () => {
    install();
    const content = readAsset('project-verify.md');
    assert.match(content, /\bverify\b/);
    assert.match(content, /## Contract/);
    // read-only by default; only --fix mutates, and only via normalize.
    assert.match(content, /READ-ONLY/);
    assert.match(content, /--fix/);
    // wraps the existing machinery
    assert.match(content, /validate-state/);
    assert.match(content, /branch/i);
    assert.match(content, /[Oo]rphan/);
    assert.match(content, /scope/i);
    assert.match(content, /aideck|aiDeck/i);
    // failure messages
    assert.match(content, /FAIL/);
  });

  it('router and verify detail agree that verify --fix is the only verify mutation path', () => {
    install();
    const router = readRouter();
    const verify = readAsset('project-verify.md');
    assert.match(router, /project verify \[--fix\]/);
    assert.match(router, /READ-ONLY unless `--fix`/);
    assert.match(router, /`verify --fix` exception: its only allowed mutation is the normalization gate in `project-verify\.md`/);
    assert.match(verify, /`verify --fix` is the explicit mutation gate/);
    assert.match(verify, /Before any `--fix` write/);
    assert.match(verify, /print the target scope and the normalization classes/);
  });

  // ─── Lazy asset: review ─────────────────────────────────────────────────

  it('project-review is honest about delegated review writes and gates them', () => {
    install();
    const router = readRouter();
    const content = readAsset('project-review.md');
    assert.match(router, /review \[<slug>\].*mutation-gated audit/);
    assert.match(content, /report-only until a delegated write-capable leg is explicitly approved/);
    assert.match(content, /Before invoking a delegated leg that can write/);
    assert.match(content, /ask for explicit approval/);
    assert.match(content, /If approval is denied or unavailable, SKIP that leg/);
    assert.match(content, /never closes a task, never meets a gate, never advances a phase/);
  });

  // ─── Lazy asset: setup ──────────────────────────────────────────────────

  it('project-setup documents the first-time setup flow + gitignore', () => {
    install();
    const content = readAsset('project-setup.md');
    assert.match(content, /CLAUDE\.md/);
    assert.match(content, /AGENTS\.md/);
    assert.match(content, /hooks/);
    assert.match(content, /bootstrap-drafts/);
    assert.match(content, /mkdir -p \.atomic-skills/);
  });

  it('project-setup idempotently creates the structural sentinel without touching the ledger', () => {
    install();
    const setup = readAsset('project-setup.md');

    assert.match(setup, /Project setup sentinel.*Setup\s+required/is);
    assert.doesNotMatch(setup, /when `?\.atomic-skills\/?`? does not exist/i);
    assert.match(setup, /If .*PROJECT-STATUS\.md.*is absent/is);
    assert.match(setup, /PROJECT-STATUS\.md.*(?:already exists|preserve)/is);
    assert.match(setup, /manifest\.json.*hooks\/version-check\.sh/is);
    assert.match(setup, /never (?:delete|move|overwrite)/i);
  });

  it('project-setup registers project hooks with a wrapper-level project-dir fallback', () => {
    install();
    const setup = readAsset('project-setup.md');
    const hooksReadme = readAsset('hooks/README.md');
    const combined = `${setup}\n${hooksReadme}`;

    for (const script of ['session-start.sh', 'stop.sh', 'pre-write.sh']) {
      assert.ok(
        setup.includes(`"command": "bash \\"\${CLAUDE_PROJECT_DIR:-$PWD}/.atomic-skills/status/hooks/${script}\\""`),
        `setup must register ${script} with a wrapper-level fallback`,
      );
    }
    assert.ok(
      !combined.includes('"command": "bash \\"$CLAUDE_PROJECT_DIR/.atomic-skills/status/hooks/'),
      'hook docs must not use a bare CLAUDE_PROJECT_DIR path; the wrapper must fall back to $PWD before invoking the script',
    );
    assert.ok(
      combined.includes('"hooks": {'),
      'hook config examples must show the host config top-level hooks object',
    );
  });

  it('project-setup keeps Soft and Strict hook sets distinct', () => {
    install();
    const setup = readAsset('project-setup.md');
    const softStart = setup.indexOf('Option (b), Soft:');
    const strictStart = setup.indexOf('Option (c), Strict:');
    const neverStart = setup.indexOf('Never register hooks as');

    assert.notEqual(softStart, -1, 'setup must label the Soft hook block');
    assert.notEqual(strictStart, -1, 'setup must label the Strict hook block');
    assert.notEqual(neverStart, -1, 'setup must keep the invalid-wrapper warning');

    const softBlock = setup.slice(softStart, strictStart);
    const strictBlock = setup.slice(strictStart, neverStart);
    assert.ok(softBlock.includes('session-start.sh'), 'Soft must register SessionStart');
    assert.ok(softBlock.includes('pre-write.sh'), 'Soft must register PreToolUse');
    assert.ok(!softBlock.includes('stop.sh'), 'Soft must not register Stop');
    assert.ok(strictBlock.includes('stop.sh'), 'Strict must add Stop');
    assert.match(
      setup,
      /Option \(c\).*additionally copies\/registers `stop\.sh` as `Stop`/,
      'Strict-only Stop behavior must be explicit',
    );
  });

  it('project-setup lists skill install paths for every supported host', () => {
    install();
    const setup = readAsset('project-setup.md');

    assert.deepStrictEqual(
      HOST_HOOK_MATRIX.map(({ ideId }) => ideId),
      PUBLIC_IDE_IDS,
      'host matrix must cover every declared public host in order',
    );

    for (const { host, skillPath } of HOST_HOOK_MATRIX) {
      assert.ok(setup.includes(skillPath), `${host} setup must list skill install path: ${skillPath}`);
    }
    assert.ok(
      setup.includes('.gemini/commands/atomic-skills-<skill>.toml'),
      'Gemini command shims remain documented only as a Gemini+Codex effective selection',
    );
  });

  it('project-setup detects Codex before the generic no-hook fallback and documents Codex hooks', () => {
    install();
    const setup = readAsset('project-setup.md');
    const codexDetect = setup.indexOf('`test -d .codex/ || test -d .agents/` → Codex');
    const genericFallback = setup.indexOf('Otherwise → generic IDE');
    const codexHooks = setup.indexOf('Codex: `.codex/hooks.json`');

    assert.notEqual(codexHooks, -1, 'setup must document the Codex hook config path');
    assert.notEqual(codexDetect, -1, 'setup must detect Codex repos via .codex/ or .agents/');
    assert.notEqual(genericFallback, -1, 'setup must document the generic no-hook fallback');
    assert.ok(
      codexDetect < genericFallback,
      'Codex detection must run before the generic no-hook fallback',
    );
  });

  it('project-setup approves hook config only for hosts with a known hook contract', () => {
    install();
    const setup = readAsset('project-setup.md');
    const eligibleStart = setup.indexOf('Run this step only when the detected/selected host has a known project-hook contract:');
    const noopStart = setup.indexOf('For Cursor, Gemini CLI, OpenCode, GitHub Copilot, and generic IDE: no-op for hooks.');

    assert.notEqual(eligibleStart, -1, 'setup must introduce hook eligibility explicitly');
    assert.notEqual(noopStart, -1, 'setup must document no-op hooks for hosts without a contract');

    const approvedHookConfigs = setup.slice(eligibleStart, noopStart);
    for (const { host, hookConfig } of HOST_HOOK_MATRIX) {
      if (hookConfig) {
        assert.match(
          approvedHookConfigs,
          new RegExp(`${escapeRegExp(host)}: \`${escapeRegExp(hookConfig)}\``),
          `${host} must be approved only for ${hookConfig}`,
        );
      } else {
        assert.doesNotMatch(
          approvedHookConfigs,
          new RegExp(escapeRegExp(host)),
          `${host} must not appear in the approved hook config block`,
        );
      }
    }
    assert.doesNotMatch(approvedHookConfigs, new RegExp(escapeRegExp(GENERIC_NO_HOOK_HOST)));

    for (const host of [
      ...HOST_HOOK_MATRIX.filter(({ hookConfig }) => !hookConfig).map(({ host }) => host),
      GENERIC_NO_HOOK_HOST,
    ]) {
      assert.match(setup, new RegExp(`${host}.*no-op|no-op.*${host}`, 'i'), `${host} hook setup must be documented as no-op`);
    }
    assert.doesNotMatch(
      setup,
      /(?:Cursor|Gemini CLI|OpenCode|GitHub Copilot|generic IDE): `\.[^`]*(?:hooks|settings)[^`]*`/,
      'hosts without a hook contract must not be listed as approved hook config targets',
    );
  });

  it('project hook README source and installed copy document the same host contract', () => {
    install();
    const sourceReadme = readAsset('hooks/README.md');
    const installedReadme = readFileSync(
      join(__dirname, '..', '.atomic-skills/status/hooks/README.md'),
      'utf8',
    );

    assert.equal(installedReadme, sourceReadme, 'installed hooks README must match the source asset');
    for (const readme of [sourceReadme, installedReadme]) {
      assert.match(readme, /Skill installation and project-hook setup are separate contracts/);
      for (const { host, hookConfig } of HOST_HOOK_MATRIX) {
        if (hookConfig) {
          assert.match(
            readme,
            new RegExp(`${escapeRegExp(host)}: project-hook setup is supported through merge-only entries in \`${escapeRegExp(hookConfig)}\``),
            `${host} README hook result must point at ${hookConfig}`,
          );
        }
      }
      assert.match(
        readme,
        /Cursor, Gemini CLI, OpenCode, GitHub Copilot, and generic IDE: no-op for hooks/,
      );
      assert.match(readme, /"hooks": \{/, 'README hook JSON must include the top-level hooks object');
      assert.doesNotMatch(
        readme,
        /(?:Cursor|Gemini CLI|OpenCode|GitHub Copilot|generic IDE): `\.[^`]*(?:hooks|settings)[^`]*`/,
        'hosts without a hook contract must not be listed as approved hook config targets',
      );
    }
  });

  // ─── Lazy asset: create-plan (former project-plan bootstrap) ─────────────

  it('project-create-plan documents the Iron Law (NO PLAN WITHOUT NARRATIVE)', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /NO PLAN WITHOUT NARRATIVE/);
  });

  it('project-create-plan documents all 7 stages of the default bootstrap', () => {
    install();
    const content = readAsset('project-create-plan.md');
    for (const stage of [
      'Stage 1 — Validate slug',
      'Stage 2 — DESIGN (brainstorm)',
      'Stage 3 — Plan input source',
      'Stage 4 — Receive markdown plan',
      'Stage 5 — Decompose',
      'Stage 6 — Create Plan + Initiatives',
      'Stage 7 — Activate first phase',
    ]) {
      assert.ok(content.includes(stage), `missing stage: ${stage}`);
    }
  });

  it('project-create-plan collects F0 businessIntent before materializing the active phase', () => {
    install();
    const content = readAsset('project-create-plan.md');
    const stage6Start = content.indexOf('### Stage 6 — Create Plan + Initiatives');
    const stage7Start = content.indexOf('### Stage 7 — Activate first phase');
    assert.notEqual(stage6Start, -1, 'Stage 6 section must exist');
    assert.notEqual(stage7Start, -1, 'Stage 7 section must exist');
    const stage6 = content.slice(stage6Start, stage7Start);
    assert.match(stage6, /Collect the user-written `businessIntent` spine for F0/);
    assert.match(stage6, /businessIntent: <businessIntent>/);
    assert.match(stage6, /scripts\/find-missing-business-intent\.js" \.atomic-skills\/projects\/<project-id>\/<slug>\/plan\.md/);
    assert.doesNotMatch(stage6, /find-missing-business-intent\.js" \.atomic-skills\s/);
    assert.match(stage6, /--business-intent-file "\$BUSINESS_INTENT_FILE"/);
    assert.doesNotMatch(stage6, /--business-intent '<businessIntent-json>'/);
  });

  it('project-create-plan fails closed on an unavailable package runtime', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## Trusted package runtime/);
    assert.match(content, /pkg\.name === "@henryavila\/atomic-skills"/);
    assert.match(content, /missing scripts\/decompose-plan\.js/);
    assert.doesNotMatch(content, /package-root[^\n]*\|\| echo \./);
  });

  it('project-create-plan Stage 6 documents lazy outputs and explicit F0 validation', () => {
    install();
    const content = readAsset('project-create-plan.md');
    const stage6Start = content.indexOf('### Stage 6 — Create Plan + Initiatives');
    const stage7Start = content.indexOf('### Stage 7 — Activate first phase');
    assert.notEqual(stage6Start, -1, 'Stage 6 section must exist');
    assert.notEqual(stage7Start, -1, 'Stage 7 section must exist');
    const stage6 = content.slice(stage6Start, stage7Start);
    assert.match(stage6, /f0-<phase-slug>\.md/);
    assert.match(stage6, /f<N>-<phase-slug>\.source\.json/);
    assert.match(stage6, /only the materialized F0 initiative/);
    assert.match(stage6, /phases\/<f0-phase-file>\.md/);
    assert.doesNotMatch(stage6, /f<N>-<phase-slug>\.md` per phase/);
    assert.doesNotMatch(stage6, /each phase initiative under it/);
    assert.doesNotMatch(stage6, /validate-state\.js" \.atomic-skills\/projects\/<project-id>\/<slug>\/phases\/\s+# per phase/);
  });

  it('project-create-plan adopt flow keeps the same F0 businessIntent and lazy validation contract', () => {
    install();
    const content = readAsset('project-create-plan.md');
    const adoptStart = content.indexOf('## `adopt <file.md>`');
    const gatesStart = content.indexOf('## Code-quality gates');
    assert.notEqual(adoptStart, -1, 'adopt section must exist');
    assert.notEqual(gatesStart, -1, 'code-quality section must exist');
    const adopt = content.slice(adoptStart, gatesStart);
    assert.match(adopt, /collect the same user-written F0 `businessIntent` spine/);
    assert.match(adopt, /businessIntent: <businessIntent>/);
    assert.match(adopt, /scripts\/find-missing-business-intent\.js" \.atomic-skills\/projects\/<project-id>\/<slug>\/plan\.md/);
    assert.doesNotMatch(adopt, /find-missing-business-intent\.js" \.atomic-skills\s/);
    assert.match(adopt, /phases\/<f0-phase-file>\.md/);
    assert.match(adopt, /only the materialized F0 initiative/);
    assert.match(adopt, /source sidecars retained/);
    assert.doesNotMatch(adopt, /each phase initiative to its plan's group/);
  });

  it('project-create-plan persists creation gates for new plan and adopt resume/rollback', () => {
    install();
    const content = readAsset('project-create-plan.md');
    const stage6Start = content.indexOf('### Stage 6 — Create Plan + Initiatives');
    const stage7Start = content.indexOf('### Stage 7 — Activate first phase');
    const stage6 = content.slice(stage6Start, stage7Start);
    const adoptStart = content.indexOf('## `adopt <file.md>`');
    const gatesStart = content.indexOf('## Code-quality gates');
    const adopt = content.slice(adoptStart, gatesStart);

    assert.match(stage6, /Creation gate run record/);
    assert.match(stage6, /\.atomic-skills\/status\/creation-gates\/<project-id>-<slug>\.json/);
    assert.match(stage6, /filesWritten/);
    assert.match(stage6, /before each canonical file write/);
    assert.match(stage6, /append the path to `filesWritten` and persist the creation gate, then write the canonical file/);
    assert.match(stage6, /status: "cancelled"/);
    assert.match(stage6, /status: "rolled-back"/);
    assert.match(stage6, /Do not infer a half-created plan by scanning `\.atomic-skills\/projects\/`/);
    assert.match(adopt, /kind: "adopt"/);
    assert.match(adopt, /resume boundary for `adopt`/);
    assert.match(adopt, /rollback deletes exactly `filesWritten`/);
    assert.match(adopt, /Recording the path before the write makes rollback\/resume safe/);
  });

  it('project lessons commands stay project and plan scoped', () => {
    install();
    const router = readRouter();
    const transitions = readAsset('project-transitions.md');
    const createInitiative = readAsset('project-create-initiative.md');
    const emergence = readAsset('project-emergence.md');
    const materialize = readAsset('project-materialize.md');

    for (const [name, content] of [
      ['router', router],
      ['project-transitions.md', transitions],
      ['project-create-initiative.md', createInitiative],
      ['project-emergence.md', emergence],
      ['project-materialize.md', materialize],
    ]) {
      assert.doesNotMatch(
        content,
        /list-lessons\.js" --phase <(?:id|phase-id)>/,
        `${name} must not use an unscoped list-lessons command`
      );
    }
    assert.match(transitions, /list-lessons\.js" --project <project-id> --plan <parentPlan> --phase <next-phase-id>/);
  });

  it('project-create-plan scopes the Stage 8c receipt gate to the newly materialized plan', () => {
    install();
    const content = readAsset('project-create-plan.md');
    const start = content.indexOf('**Stage 8c — Receipt gate');
    const end = content.indexOf('### Stage 9');
    const stage8c = content.slice(start, end);
    assert.ok(start >= 0 && end > start, 'Stage 8c block must be present');
    assert.match(stage8c, /PLAN_PATH="\.atomic-skills\/projects\/<projectId>\/<planSlug>\/plan\.md"/);
    assert.match(stage8c, /find-unreviewed-plans\.js" "\$PLAN_PATH"/);
    assert.doesNotMatch(stage8c, /find-unreviewed-plans\.js" \.atomic-skills/);
    assert.match(stage8c, /only the newly materialized plan/i);
    assert.match(stage8c, /`project verify`/);
  });

  it('project-create-plan references templates via ASSETS_PATH (no raw skills/shared path)', () => {
    install();
    const content = readAsset('project-create-plan.md');
    // Rendered ASSETS_PATH form, not the raw source path.
    assert.match(content, /plan\.template\.md/);
    assert.match(content, /initiative\.template\.md/);
    assert.ok(
      !content.includes('skills/shared/project-status-assets'),
      'must not reference the raw source asset path'
    );
    assert.ok(
      !content.includes('skills/shared/project-plan-assets'),
      'must not reference the raw source asset path'
    );
  });

  it('project-create-plan documents the Markdown decompose heuristics', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## Markdown decompose/);
    assert.match(content, /first H1.*plan\.title/);
    assert.match(content, /plan\.narrative/);
    assert.match(content, /starts with `princip`/);
    assert.match(content, /starts with `glossar`/);
    assert.match(content, /Princípios invioláveis/);
    assert.match(content, /Sub-fases bullet mode/);
    assert.match(content, /Prose mode/);
    assert.match(content, /Duplicate phase id guard/);
    assert.match(content, /No-phase guard/);
    assert.match(content, /decomposePlan/);
    assert.match(content, /previewDecomposition/);
    assert.match(content, /sample-f0-foundation-repair/);
  });

  it('project-create-plan wires DESIGN to atomic-skills:brainstorm with a PLAN precondition (R-ORCH-07/08/09)', () => {
    install();
    const content = readAsset('project-create-plan.md');
    // DESIGN is owned by brainstorm; the superpowers delegation is removed (R-ORCH-08).
    assert.match(content, /## DESIGN integration \(brainstorm\)/);
    assert.match(content, /atomic-skills:brainstorm/);
    assert.ok(!/superpowers:brainstorm/.test(content), 'must not delegate to superpowers:brainstorm');
    assert.ok(!/superpowers:write-execution-plan/.test(content), 'must not delegate to superpowers:write-execution-plan');
    // PLAN refuses without an approved, lint-clean design.md (R-ORCH-09).
    assert.match(content, /PLAN precondition/);
    assert.match(content, /lint-design\.js/);
    assert.match(content, /HARD-BLOCKS/);
    // superpowers survives only as an optional detect-and-degrade RENT probe (R-SP-27/28).
    assert.match(content, /command -v superpowers/);
    assert.match(content, /RENT probe/);
    assert.match(content, /minimal-source\.template\.md/);
    assert.match(content, /never errors out because superpowers is absent/);
  });

  it('project-create-plan documents the adopt flow in detail', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## `adopt <file\.md>`/);
    assert.match(content, /Validate the input/);
    assert.match(content, /Collision check/);
    assert.match(content, /Preview \+ explicit confirmation/);
    assert.match(content, /materializeDecomposition/);
    assert.match(content, /roll back/);
    assert.match(content, /Failure-mode summary/);
  });

  it('router documents schemaVersion 0.1/0.2 coexistence', () => {
    install();
    assert.match(readRouter(), /schemaVersion` policy/);
    assert.match(readRouter(), /'0\.1'/);
    assert.match(readRouter(), /'0\.2'/);
  });

  // ─── Lazy asset: create-initiative ──────────────────────────────────────

  it('project-create-initiative documents the new-initiative flow', () => {
    install();
    const content = readAsset('project-create-initiative.md');
    assert.match(content, /standalone/);
    assert.match(content, /active plan/);
    assert.match(content, /plan-membership-block/);
    assert.match(content, /initiative\.template\.md/);
  });

  // ─── Lazy asset: discover (former project-plan discover) ─────────────────

  it('project-discover documents the multi-source pipeline (Phases 1a/1b/2/3/4)', () => {
    install();
    const content = readAsset('project-discover.md');
    for (const token of ['discover', '--dry-run', '--commit', '--scope']) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
    assert.match(content, /Phase 1a/);
    assert.match(content, /Phase 1b/);
    for (const cmd of ['git for-each-ref', 'git log --since', 'gh pr list', 'docs/superpowers/plans', 'TODO.md', '.ai/memory']) {
      assert.ok(content.includes(cmd), `missing scan command: ${cmd}`);
    }
    assert.match(content, /topic_hint/);
    assert.match(content, /evidence_quote/);
    assert.match(content, /candidate_completion/);
    for (const token of [
      'Phase 2', 'clusterByExactSlug', 'mergeFuzzySingletons', 'pickCanonicalSlug',
      'Phase 3', 'classifyBucket', 'calculateConfidence',
      'Phase 4', 'draftToInitiative', 'bootstrap-drafts', 'INDEX.md', 'mdprobe',
    ]) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
  });

  it('project-discover uses discover-run.json as the durable commit authority', () => {
    install();
    const content = readAsset('project-discover.md');
    assert.match(content, /strict `discover-run\.json` is the durable run record/);
    assert.match(content, /stable `runId`/);
    assert.match(content, /candidate\.approved === true/);
    assert.match(content, /Do NOT add ad-hoc top-level fields/);
    assert.match(content, /Read `\.atomic-skills\/bootstrap-drafts\/discover-run\.json` first/);
    assert.match(content, /runId.*candidates\[\]/);
    assert.match(content, /copied into the audit log/);
  });

  // ─── Lazy asset: emergence ──────────────────────────────────────────────

  it('project-emergence documents the proposal/ratify/commit pattern + per-rung procedures', () => {
    install();
    const content = readAsset('project-emergence.md');
    assert.match(content, /Proposed mutation:/);
    assert.match(content, /Drafted context/);
    assert.match(content, /never as ratify/);
    for (const cmd of ['park', 'emerge', 'promote', 'new-task', 'new-phase', 'split-phase']) {
      assert.ok(content.includes(cmd), `emergence must document: ${cmd}`);
    }
  });

  it('project-emergence new-phase materializes only after lessons and businessIntent gates', () => {
    install();
    const content = readAsset('project-emergence.md');
    const start = content.indexOf('## `new-phase <id>');
    const end = content.indexOf('## `split-phase <id>`');
    assert.notEqual(start, -1, 'new-phase section must exist');
    assert.notEqual(end, -1, 'split-phase section must exist');
    const block = content.slice(start, end);
    assert.match(block, /phase-start lessons gate/);
    assert.match(block, /list-lessons\.js" --project <project-id> --plan <plan-slug> --phase <phase-id>/);
    assert.match(block, /Collect the user-written `businessIntent` spine/);
    assert.match(block, /businessIntent: <businessIntent>/);
    assert.match(block, /set `businessIntent` on the parent plan descriptor/);
    assert.match(block, /add `businessIntent` to the new initiative frontmatter/);
    assert.match(block, /find-missing-business-intent\.js" \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/plan\.md/);
  });

  // ─── Lazy asset: transitions (verifiers, phase-done, archive, switch) ────

  it('project-transitions documents the daily mutations + transitions', () => {
    install();
    const content = readAsset('project-transitions.md');
    for (const cmd of ['done', 'phase-done', 'phase-reopen', 'detect-scope', 'push', 'pop', 'archive', 'switch']) {
      assert.ok(content.includes(cmd), `transitions must document: ${cmd}`);
    }
    assert.match(content, /Pre-mutation migration check/);
    assert.match(content, /migrateLegacyInitiative/);
    assert.match(content, /Plan archival/i);
    assert.match(content, /Plan switch/i);
    assert.match(content, /propagate/i);
  });

  it('project-transitions requires explicit-path microcommits at task and phase checkpoints', () => {
    install();
    const content = readAsset('project-transitions.md');
    assert.match(content, /Microcommit checkpoints/);
    assert.match(content, /rtk git add <explicit-paths>/);
    assert.match(content, /rtk git commit -m "chore\(project\): checkpoint <plan> <phase> <task-id>"/);
    assert.match(content, /rtk git commit -m "chore\(project\): advance <plan> <phase>"/);
    assert.match(content, /Never use `git add \.` or `git add -A`/);
  });

  it('project lifecycle posterior commands document lifecycle-order guards before mutation', () => {
    install();
    const transitions = readAsset('project-transitions.md');
    const dependencies = readAsset('project-dependencies.md');
    const finalize = readAsset('project-finalize.md');
    const consolidate = readAsset('project-consolidate.md');

    assert.match(transitions, /classifyLifecycleOrder/);
    assert.match(transitions, /before fork-resume, status flips, moves, or teardown offers/);
    assert.match(transitions, /recommendedCommand/);
    assert.match(transitions, /do not resume the parent/);

    assert.match(dependencies, /depend resolve --archived/);
    assert.match(dependencies, /classifyLifecycleOrder/);
    assert.match(dependencies, /archived-never-pr/);
    assert.match(dependencies, /finalize <prerequisite>/);

    assert.match(finalize, /predecessor command/);
    assert.match(finalize, /phase-done/);
    assert.match(consolidate, /non-terminal/);
    assert.match(consolidate, /done <task-id>/);
  });

  it('verifier execution patterns live in verifier-exec.md (single source), project-transitions points to it', () => {
    install();
    // T1.4 extracted the Verifier execution patterns to verifier-exec.md as the
    // single source; project-transitions.md keeps the section heading + a pointer.
    const transitions = readAsset('project-transitions.md');
    assert.match(transitions, /Verifier execution patterns/);
    assert.match(transitions, /verifier-exec\.md/);
    // The canonical executor (per-kind workflows + evidence shape) lives here.
    const content = readAsset('verifier-exec.md');
    assert.match(content, /Verifier execution patterns/);
    assert.match(content, /verify_exit_gate/);
    for (const kind of ['shell', 'manual', 'query', 'test']) {
      assert.ok(content.includes('### `kind: ' + kind + '`'), `must document verifier kind: ${kind}`);
    }
    assert.match(content, /evidence:/);
    assert.match(content, /verifierKind/);
    assert.match(content, /verifiedAt/);
    assert.match(content, /outputSummary/);
    assert.match(content, /Per-task verifiers/);
  });

  it('uses camelCase fields, no legacy snake_case in canonical state contexts', () => {
    install();
    const blob = readRouter() + readAsset('project-transitions.md') + readAsset('project-view.md') + readAsset('project-emergence.md');
    for (const legacy of ['initiative_id', 'scope_paths', 'opened_at', 'surfaced_at', 'from_frame']) {
      assert.ok(!blob.includes(legacy), `must not reference legacy field: ${legacy}`);
    }
    assert.ok(blob.includes('lastUpdated'));
    assert.ok(blob.includes('nextAction'));
    assert.ok(blob.includes('openedAt'));
    assert.ok(blob.includes('surfacedAt'));
    assert.ok(blob.includes('fromFrame'));
  });

  it('project-transitions makes pop and reconcile transactional at their write boundaries', () => {
    install();
    const content = readAsset('project-transitions.md');
    const popStart = content.indexOf('### `pop [--resolve|--park|--emerge]`');
    const doneStart = content.indexOf('## `done <task-id>`');
    const pop = content.slice(popStart, doneStart);
    const reconcileStart = content.indexOf('## `reconcile`');
    const phaseStart = content.indexOf('## `phase-done`');
    const reconcile = content.slice(reconcileStart, phaseStart);

    assert.match(pop, /Transactional pop boundary/);
    assert.match(pop, /ONLY after the chosen destination reports `applied`/);
    assert.match(pop, /frame <N> remains on the stack/);
    assert.match(reconcile, /Fresh-read write token/);
    assert.match(reconcile, /re-read `candidate\.initiativePath` from disk/);
    assert.match(reconcile, /Never write back a parsed snapshot captured before the prompt/);
  });

  it('reconcile Still open uses schema-supported anchors without becoming close authority', () => {
    install();
    const content = readAsset('project-transitions.md');
    const reconcileStart = content.indexOf('## `reconcile`');
    const phaseStart = content.indexOf('## `phase-done`');
    const reconcile = content.slice(reconcileStart, phaseStart);

    assert.match(reconcile, /task candidate.*task's `lastUpdated`/s);
    assert.match(reconcile, /criterion candidate.*initiative's top-level `lastUpdated`/s);
    assert.match(reconcile, /ExitCriterion.*does not support\s+`lastUpdated`/s);
    assert.match(reconcile, /`detect-completion` remains pure read-only/);
    assert.match(reconcile, /`done` remains the only task closure\s+authority/);
  });

  it('project-finalize requires an explicit slug and project-consolidate records resume state', () => {
    install();
    const router = readRouter();
    const finalize = readAsset('project-finalize.md');
    const consolidate = readAsset('project-consolidate.md');

    assert.match(router, /project finalize <slug>/);
    assert.match(router, /\| `finalize <slug>` \|/);
    assert.match(finalize, /finalize` requires the operator to pass the target as\s+`finalize <slug>`/);
    assert.match(finalize, /A bare `finalize` stops before `scripts\/finalize-plan-scope\.js`/);
    assert.match(finalize, /explicit slug is\s+the resume-safe transaction key/);

    assert.match(consolidate, /\.atomic-skills\/status\/consolidate-run\.json/);
    assert.match(consolidate, /`runId`, `base`, ordered `branches`, `candidates\[\]`/);
    assert.match(consolidate, /`status: "blocked"`/);
    assert.match(consolidate, /--resume/);
    assert.match(consolidate, /refuses mismatched/);
  });

  // ─── Lazy asset: migrate / re-bootstrap ─────────────────────────────────

  it('project-migrate documents migrate + re-bootstrap', () => {
    install();
    const content = readAsset('project-migrate.md');
    assert.match(content, /## `migrate <slug>`/);
    assert.match(content, /## `re-bootstrap <slug>`/);
    assert.match(content, /Shared target resolver/);
    assert.match(content, /projects\/\*\/\*\/phases\/\*\.md/);
    assert.match(content, /Only when there is no nested match, use legacy `\.atomic-skills\/initiatives\/<slug>\.md`/);
    assert.match(content, /<resolved-path>/);
    assert.match(content, /migrateLegacyInitiative/);
    assert.match(content, /isMigratedPlaceholder/);
    assert.match(content, /Pasted-edit canonical format/);
  });

  it('project-dependencies requires project targeting when nested resolution is ambiguous', () => {
    install();
    const content = readAsset('project-dependencies.md');
    assert.match(content, /--project <id>/);
    assert.match(content, /more than one nested project is a possible target/);
    assert.match(content, /rerun with `--project <id>`/);
    assert.match(content, /Do not write/);
    assert.match(content, /legacy flat `\.atomic-skills\/plans\/<slug>\.md` layout/);
  });

  // ─── Lazy asset: drift / codex review ───────────────────────────────────

  it('project-drift documents scope-creep / why / re-ratify / codex review tracking', () => {
    install();
    const content = readAsset('project-drift.md');
    assert.match(content, /## `scope-creep`/);
    assert.match(content, /## `why <id>`/);
    assert.match(content, /## `re-ratify <id>`/);
    assert.match(content, /Codex review tracking/);
    assert.match(content, /last-review\.json/);
    assert.match(content, /review-due/);
  });

  // ─── Asset shipping ─────────────────────────────────────────────────────

  it('project assets ship the templates (minimal-source, plan, initiative, bootstrap-*)', () => {
    install();
    for (const name of [
      'minimal-source.template.md', 'plan.template.md', 'initiative.template.md',
      'bootstrap-draft.template.md', 'bootstrap-archived.template.md', 'bootstrap-index.template.md',
      'PROJECT-STATUS.md.template.md', 'CLAUDE.md-gate.template.md', 'AGENTS.md.template.md',
    ]) {
      assert.ok(existsSync(join(tempDir, ASSET(name))), `expected asset: ${name}`);
    }
  });

  it('bootstrap-draft template ships with required markers (3-level camelCase)', () => {
    install();
    const content = readAsset('bootstrap-draft.template.md');
    for (const marker of [
      'REPLACE_CANONICAL_SLUG', 'REPLACE_PROPOSED_AT', 'REPLACE_PROPOSED_BUCKET',
      'REPLACE_STARTED_ISO_TIMESTAMP', 'REPLACE_LAST_UPDATED', 'REPLACE_BRANCH',
      'REPLACE_PLAN_LINK', 'REPLACE_TITLE', 'REPLACE_NEXT_ACTION', 'REPLACE_GOAL',
      'REPLACE_RATIONALE', 'REPLACE_CONFIDENCE', 'REPLACE_SLUG_MATCH_TYPE',
      'REPLACE_CONTEXT_PARAGRAPHS', 'REPLACE_EVIDENCE_BLOCK',
    ]) {
      assert.ok(content.includes(marker), `missing marker: ${marker}`);
    }
    assert.ok(content.includes("schemaVersion: '0.1'"));
    assert.ok(!content.includes('initiative_id:'), 'legacy snake_case field must be gone');
  });

  it('minimal-source template has REPLACE markers + a phase H2 + exit_gate', () => {
    install();
    const asset = readAsset('minimal-source.template.md');
    assert.match(asset, /REPLACE_PLAN_TITLE/);
    assert.match(asset, /^## F0 —/m);
    assert.match(asset, /exit_gate:/);
  });
});
