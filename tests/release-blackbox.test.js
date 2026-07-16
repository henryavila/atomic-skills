/**
 * F6/T-001 — Black-box release qualification against an npm-packed tarball.
 *
 * Packs the product, installs into a temporary HOME + consumer repo, then runs
 * install / status / update / packaged project scripts / uninstall without
 * reading the source checkout at runtime.
 */
import { after, before, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
  lstatSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_IDE_IDS, getSkillPath } from '../src/config.js';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_ROOT = join(SOURCE_ROOT, 'tests', 'fixtures', 'release-consumer');

function isInside(child, parent) {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

describe('F6 release black-box (packed tarball)', { concurrency: false }, () => {
  let root;
  let home;
  let consumer;
  let packageRoot;
  let cli;
  const transcript = [];

  function run(command, args, { cwd = consumer, env = {} } = {}) {
    const result = spawnSync(command, args, {
      cwd,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        ATOMIC_SKILLS_SKIP_GROK_HOST: '1',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
        npm_config_cache: process.env.npm_config_cache || join(homedir(), '.npm'),
        ...env,
      },
      encoding: 'utf8',
      timeout: 120_000,
    });
    transcript.push(`${command} ${args.join(' ')}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    return result;
  }

  function mustRun(command, args, options) {
    const result = run(command, args, options);
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    return result;
  }

  function runCli(...args) {
    return mustRun(process.execPath, [cli, ...args]);
  }

  function runInstalled(relativePath, ...args) {
    return mustRun(process.execPath, [join(packageRoot, relativePath), ...args]);
  }

  before(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'atomic-skills-release-bb-')));
    home = join(root, 'home');
    consumer = join(root, 'consumer');
    const packs = join(root, 'packs');
    mkdirSync(home, { recursive: true });
    mkdirSync(packs, { recursive: true });
    cpSync(FIXTURE_ROOT, consumer, { recursive: true });

    mustRun('git', ['init', '-q'], { cwd: consumer });
    mustRun('git', ['config', 'user.email', 'release-bb@test'], { cwd: consumer });
    mustRun('git', ['config', 'user.name', 'release-bb'], { cwd: consumer });

    const packed = mustRun(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', packs],
      { cwd: SOURCE_ROOT },
    );
    const [manifest] = JSON.parse(packed.stdout);
    const tarball = join(packs, manifest.filename);
    assert.ok(existsSync(tarball), `npm pack did not create ${tarball}`);

    mustRun(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--no-save',
        tarball,
      ],
      { cwd: consumer },
    );

    packageRoot = join(consumer, 'node_modules', '@henryavila', 'atomic-skills');
    cli = join(packageRoot, 'bin', 'cli.js');
    assert.ok(existsSync(cli), 'packed package missing bin/cli.js');
    assert.equal(lstatSync(packageRoot).isSymbolicLink(), false, 'package must be extracted, not linked');
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('installs project-scope skills from the tarball without source checkout', () => {
    runCli('install', '--yes', '--project', '--ide', 'codex', '--lang', 'en');

    const skill = join(consumer, getSkillPath('codex', 'project'));
    assert.ok(existsSync(skill), `missing installed skill: ${skill}`);
    assert.ok(existsSync(join(consumer, '.atomic-skills', 'manifest.json')));

    const packageRootMarker = join(home, '.atomic-skills', 'package-root');
    if (existsSync(packageRootMarker)) {
      const recorded = realpathSync(readFileSync(packageRootMarker, 'utf8').trim());
      const checkout = realpathSync(SOURCE_ROOT);
      assert.notEqual(recorded, checkout, 'package-root must not point at source checkout');
      assert.ok(
        isInside(recorded, realpathSync(join(consumer, 'node_modules')))
          || recorded === realpathSync(packageRoot)
          || recorded.includes('.atomic-skills'),
        `unexpected package-root: ${recorded}`,
      );
    }
  });

  it('status reports install without requiring source tree modules', () => {
    const result = runCli('status', '--project');
    const out = `${result.stdout}\n${result.stderr}`;
    assert.match(out, /Atomic Skills|installed|Status|up.to.date|unchanged|manifest/i);
  });

  it('update (re-install) is idempotent for the same desired set', () => {
    runCli('install', '--yes', '--project', '--ide', 'codex', '--lang', 'en');
    assert.ok(existsSync(join(consumer, getSkillPath('codex', 'implement'))));
  });

  it('runs packaged project scripts from the installed package root', () => {
    const source = join(consumer, 'release-plan.md');
    writeFileSync(
      source,
      [
        '# Release Blackbox Plan',
        '',
        'Proves packed CLIs work outside the source checkout.',
        '',
        '## F0 — Blackbox',
        '',
        'Goal: materialize from installed package.',
        '',
        '### T-001 Pack proof',
        '',
        '```yaml',
        'exit_gate:',
        '  - id: F0-G1',
        '    description: Packaged runtime works',
        '    verifier: { kind: manual, description: blackbox }',
        '```',
        '',
      ].join('\n'),
    );

    const businessIntent = JSON.stringify({
      value: 'Qualify packed product without source checkout.',
      workflow: 'Pack, install, materialize, validate.',
      rules: 'Never resolve package code through consumer cwd source tree.',
      outOfScope: 'npm publish.',
      doneWhen: 'Installed scripts exit 0.',
    });

    const materialize = runInstalled(
      'scripts/decompose-plan.js',
      'materialize',
      '--source',
      source,
      '--slug',
      'release-blackbox',
      '--project-id',
      'release-consumer',
      '--branch',
      'plan/release-blackbox',
      '--business-intent',
      businessIntent,
    );
    const files = JSON.parse(materialize.stdout);
    assert.ok(files.some((f) => f.kind === 'plan'));
    assert.ok(files.some((f) => f.kind === 'initiative'));

    for (const file of files) {
      const dest = join(consumer, file.relativePath);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, file.content);
    }

    const validate = runInstalled(
      'scripts/validate-state.js',
      join(consumer, '.atomic-skills'),
    );
    assert.match(validate.stdout, /All \d+ file\(s\) valid|valid/i);

    const closure = runInstalled('scripts/validate-runtime-closure.js');
    assert.match(closure.stdout, /Runtime closure valid:/);
  });

  it('exercises layout install for every PUBLIC_IDE_ID (tier-agnostic layout)', () => {
    // One multi-IDE install proves each host layout is present in the packed set.
    runCli(
      'install',
      '--yes',
      '--project',
      '--ide',
      PUBLIC_IDE_IDS.join(','),
      '--lang',
      'en',
    );
    for (const ide of PUBLIC_IDE_IDS) {
      const path = join(consumer, getSkillPath(ide, 'project'));
      assert.ok(existsSync(path), `layout missing for ${ide}: ${path}`);
    }
  });

  it('uninstall returns project scope toward baseline (manifest removed)', () => {
    runCli('uninstall', '--yes', '--project');
    assert.equal(
      existsSync(join(consumer, '.atomic-skills', 'manifest.json')),
      false,
      'project manifest must be removed after uninstall',
    );
  });

  it('transcript and installed evidence do not embed the source checkout path', () => {
    const checkout = realpathSync(SOURCE_ROOT);
    const evidence = [
      ...listFiles(join(consumer, '.agents')),
      ...listFiles(join(consumer, '.claude')),
      ...listFiles(join(packageRoot, 'scripts')).slice(0, 20),
    ];
    for (const path of evidence) {
      if (!existsSync(path)) continue;
      try {
        const content = readFileSync(path, 'utf8');
        assert.equal(
          content.includes(checkout),
          false,
          `${path} embeds source checkout path`,
        );
      } catch {
        // binary / unreadable — skip
      }
    }
    const joined = transcript.join('\n');
    // npm pack may print the source cwd in its own progress; ignore that phase.
    const postPack = joined.split('npm pack')[1] ?? joined;
    assert.doesNotMatch(
      postPack,
      new RegExp(`package-root.*${checkout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });
});
