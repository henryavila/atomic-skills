#!/usr/bin/env node
/**
 * Release planner/applier. Chooses the next semver; does not guess patch.
 *
 *   node scripts/release/release.js              plan (stdout)
 *   node scripts/release/release.js --json       plan as JSON
 *   node scripts/release/release.js --apply      bump package.json + CHANGELOG.md (when present)
 *   node scripts/release/release.js --notes      print GH notes for package.json version
 *   node scripts/release/release.js --ship       tag + push + GitHub Release (tree must be clean)
 *
 * npm publish is NOT done here. GitHub Release triggers OIDC stage; a human
 * approves with 2FA on the npmjs.com UI (Staged packages tab) — not CLI.
 *
 * Optional: --root <dir> to target a repo other than cwd (tests / adopters).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  classifyBump,
  cmpVersion,
  extractReleaseNotes,
  githubRepoUrl,
  maxVersion,
  parseUnreleased,
  parseVersion,
  rewriteChangelog,
  todayISO,
  emptyUnreleased,
} from './semver-bump.js';

function parseArgs(argv) {
  const args = new Set();
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      root = argv[++i];
      continue;
    }
    args.add(a);
  }
  return { args, root };
}

function defaultSh(root) {
  return (cmd, argv, opts = {}) => {
    try {
      return execFileSync(cmd, argv, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (err) {
      if (opts.allowFail) return '';
      throw err;
    }
  };
}

function defaultNpmJson(sh) {
  return (pkgName, field) => {
    const out = sh('npm', ['view', pkgName, field, '--json'], { allowFail: true });
    if (!out) return null;
    try {
      return JSON.parse(out);
    } catch {
      return out;
    }
  };
}

/**
 * @param {object} options
 * @param {string} options.root
 * @param {(cmd: string, argv: string[], opts?: {allowFail?: boolean}) => string} [options.sh]
 * @param {(name: string, field: string) => unknown} [options.npmJson]
 * @param {() => Date} [options.now]
 * @param {(path: string, enc?: string) => string} [options.readFile]
 * @param {(path: string, data: string) => void} [options.writeFile]
 * @param {(path: string) => boolean} [options.exists]
 * @param {boolean} [options.skipRemote] skip npm/gh/git network probes (unit tests)
 * @param {object} [options.fixtures] override remote facts when skipRemote
 */
export function createRelease({
  root,
  sh = defaultSh(root),
  npmJson = defaultNpmJson(sh),
  now = () => new Date(),
  readFile = (p) => readFileSync(p, 'utf8'),
  writeFile = (p, d) => writeFileSync(p, d),
  exists = existsSync,
  skipRemote = false,
  fixtures = {},
} = {}) {
  if (!root) throw new Error('createRelease requires root');

  const PKG_PATH = join(root, 'package.json');
  const CHANGELOG_PATH = join(root, 'CHANGELOG.md');

  function gitCommitsSince(rev) {
    if (fixtures.commits) return [...fixtures.commits];
    const range = rev ? `${rev}..HEAD` : 'HEAD';
    const out = sh('git', ['log', range, '--pretty=format:%s'], { allowFail: true });
    return out ? out.split('\n').filter(Boolean) : [];
  }

  function findBumpCommit(version) {
    const out = sh(
      'git',
      ['log', '-1', '--format=%H', '-S', `"version": "${version}"`, '--', 'package.json'],
      { allowFail: true },
    );
    return out || null;
  }

  function collect() {
    const pkg = JSON.parse(readFile(PKG_PATH));
    const hasChangelog = exists(CHANGELOG_PATH);
    const changelog = hasChangelog ? readFile(CHANGELOG_PATH) : '';
    const unreleased = hasChangelog ? parseUnreleased(changelog) : emptyUnreleased();
    const pkgVersion = parseVersion(pkg.version).raw;

    let npmVersions = [];
    let npmLatest = null;
    if (skipRemote) {
      npmVersions = fixtures.npmVersions ? [...fixtures.npmVersions] : [];
      npmLatest = fixtures.npmLatest ?? (npmVersions.length ? maxVersion(npmVersions) : null);
    } else {
      const npmVersionsRaw = npmJson(pkg.name, 'versions');
      npmVersions = Array.isArray(npmVersionsRaw)
        ? npmVersionsRaw.map(String)
        : npmVersionsRaw
          ? [String(npmVersionsRaw)]
          : [];
      npmLatest = npmVersions.length ? maxVersion(npmVersions) : null;
    }

    let tags = [];
    let ghTags = [];
    if (skipRemote) {
      tags = fixtures.gitTags ? [...fixtures.gitTags] : [];
      ghTags = fixtures.githubReleases ? [...fixtures.githubReleases] : [];
    } else {
      tags = sh('git', ['tag', '-l', 'v*'], { allowFail: true })
        .split('\n')
        .map((t) => t.replace(/^v/, ''))
        .filter((t) => /^\d+\.\d+\.\d+$/.test(t));

      const ghOut = sh('gh', ['release', 'list', '--json', 'tagName', '-L', '50'], { allowFail: true });
      if (ghOut) {
        try {
          ghTags = JSON.parse(ghOut).map((r) => String(r.tagName).replace(/^v/, ''));
        } catch {
          ghTags = [];
        }
      }
    }

    if (npmLatest && cmpVersion(pkgVersion, npmLatest) < 0) {
      throw new Error(
        `package.json ${pkgVersion} is behind npm ${npmLatest}. Pull/sync before releasing.`,
      );
    }

    const alreadyBumped = npmLatest ? cmpVersion(pkgVersion, npmLatest) > 0 : false;
    const current = alreadyBumped && npmLatest ? npmLatest : pkgVersion;

    const tagRef = tags.includes(current) ? `v${current}` : null;
    const bumpCommit = skipRemote ? null : findBumpCommit(current);
    const since = fixtures.since ?? tagRef ?? bumpCommit;
    const commits = gitCommitsSince(since);

    const plan = classifyBump({ current, commits, unreleased });
    const repoUrl = githubRepoUrl(pkg);

    const ghLatest = maxVersion(ghTags);
    const warnings = [];
    if (npmLatest && ghLatest && cmpVersion(npmLatest, ghLatest) > 0) {
      warnings.push(
        `npm is at ${npmLatest} but GitHub latest release is ${ghLatest}. Do not backfill a GH release for ${npmLatest} — that retriggers OIDC stage of a version already on the registry.`,
      );
    }
    if (alreadyBumped) {
      warnings.push(
        `package.json already at ${pkgVersion} (ahead of npm ${npmLatest}). Classifier next from npm baseline is ${plan.next}.`,
      );
      if (pkgVersion !== plan.next) {
        warnings.push(
          `Refusing to keep package.json ${pkgVersion}: classifier wants ${plan.next} (${plan.kind}).`,
        );
      }
    }

    return {
      name: pkg.name,
      packageVersion: pkgVersion,
      npmLatest,
      npmVersions,
      gitTags: [...tags].sort(cmpVersion),
      githubReleases: [...ghTags].sort(cmpVersion),
      baseline: current,
      since: since || '(repo root)',
      commits,
      unreleased,
      plan,
      alreadyBumped,
      repoUrl,
      warnings,
      changelog,
      hasChangelog,
      pkg,
    };
  }

  function printPlan(facts) {
    const { plan } = facts;
    const lines = [
      `${facts.name}`,
      `  package.json : ${facts.packageVersion}`,
      `  npm latest   : ${facts.npmLatest ?? '(unpublished)'}`,
      `  git tags     : ${facts.gitTags.map((v) => 'v' + v).join(', ') || '(none)'}`,
      `  gh releases  : ${facts.githubReleases.map((v) => 'v' + v).join(', ') || '(none)'}`,
      `  baseline     : ${facts.baseline}`,
      `  commits since ${facts.since}: ${facts.commits.length}`,
      '',
      `  bump         : ${plan.kind}`,
      `  next         : ${plan.next}`,
      `  breaking     : ${plan.breaking ? 'yes' : 'no'}`,
      '  reasons:',
      ...(plan.reasons.length ? plan.reasons.map((r) => `    · ${r}`) : ['    · (none)']),
    ];
    if (facts.warnings.length) {
      lines.push('', '  warnings:');
      for (const w of facts.warnings) lines.push(`    ! ${w}`);
    }
    if (plan.kind === 'none') {
      lines.push('', '  nothing to release.');
    } else {
      lines.push(
        '',
        '  next steps:',
        `    node scripts/release/release.js --apply`,
        `    node scripts/release/release.js --ship`,
        `    human (UI): https://www.npmjs.com/package/${facts.name}?activeTab=versions`,
      );
    }
    return lines.join('\n');
  }

  function apply(facts) {
    const { plan } = facts;
    if (plan.kind === 'none') {
      throw new Error('nothing to apply (kind=none)');
    }
    if (facts.packageVersion === plan.next) {
      throw new Error(`package.json already at ${plan.next}. Nothing to apply.`);
    }
    if (facts.alreadyBumped && facts.packageVersion !== plan.next) {
      throw new Error(
        `package.json is ${facts.packageVersion} but classifier wants ${plan.next}. Fix the version by hand or revert the bump.`,
      );
    }
    if (facts.npmLatest && facts.npmLatest === plan.next) {
      throw new Error(`${plan.next} is already on npm. Bump would republish.`);
    }

    const date = todayISO(now());
    if (facts.hasChangelog) {
      const changelog = rewriteChangelog(facts.changelog, {
        next: plan.next,
        date,
        repoUrl: facts.repoUrl,
      });
      writeFile(CHANGELOG_PATH, changelog);
    }

    const pkg = { ...facts.pkg, version: plan.next };
    writeFile(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

    return { version: plan.next, date, changelogRewritten: facts.hasChangelog };
  }

  function assertCleanTree() {
    if (skipRemote && fixtures.dirty === false) return;
    if (skipRemote && fixtures.dirty === true) {
      throw new Error('working tree not clean:\n M package.json');
    }
    const status = sh('git', ['status', '--porcelain']);
    if (status) {
      throw new Error(`working tree not clean:\n${status}`);
    }
  }

  function ship(facts, { dryRun = false } = {}) {
    if (facts.plan.kind === 'none') {
      throw new Error('nothing to ship (kind=none) — refuse inventing a release');
    }

    const version = parseVersion(facts.packageVersion).raw;
    if (facts.npmLatest && facts.npmLatest === version) {
      throw new Error(
        `${version} is already on npm. Creating a GitHub Release would re-stage it. Ship a new version instead.`,
      );
    }
    if (facts.npmVersions.includes(version)) {
      throw new Error(`${version} is already published on npm.`);
    }
    if (facts.githubReleases.includes(version)) {
      throw new Error(`GitHub release v${version} already exists.`);
    }

    let notes = '';
    if (facts.hasChangelog) {
      notes = extractReleaseNotes(facts.changelog, version);
      if (!notes.trim()) {
        throw new Error(`CHANGELOG.md has no ## [${version}] body. Run --apply first.`);
      }
    } else {
      notes = `Release ${version}`;
    }

    if (dryRun) {
      return { tag: `v${version}`, notes, dryRun: true };
    }

    assertCleanTree();

    const tag = `v${version}`;
    const existingTag = sh('git', ['tag', '-l', tag], { allowFail: true });
    if (!existingTag) {
      sh('git', ['tag', '-a', tag, '-m', `Version ${version}`]);
    }

    const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    sh('git', ['push', 'origin', branch]);
    sh('git', ['push', 'origin', tag]);
    sh('gh', ['release', 'create', tag, '--title', tag, '--notes', notes]);

    return { tag, notes };
  }

  function run(argv = process.argv.slice(2), io = process) {
    const { args } = parseArgs(argv);
    const WANT_JSON = args.has('--json');
    const WANT_APPLY = args.has('--apply');
    const WANT_NOTES = args.has('--notes');
    const WANT_SHIP = args.has('--ship');
    const DRY = args.has('--dry-run') || args.has('-n');

    if (args.has('-h') || args.has('--help')) {
      io.stdout.write(
        [
          'Usage: node scripts/release/release.js [--json] [--apply] [--notes] [--ship] [--dry-run] [--root <dir>]',
          'plan prints next version; --apply rewrites package.json (+ CHANGELOG when present);',
          '--ship tags + gh release (refuses kind=none and already-published npm versions).',
        ].join('\n') + '\n',
      );
      return 0;
    }

    const facts = collect();

    if (WANT_NOTES) {
      const v = facts.packageVersion;
      const notes = facts.hasChangelog ? extractReleaseNotes(facts.changelog, v) : '';
      if (!notes) {
        io.stderr.write(`no notes for ${v} — Unreleased not applied yet?\n`);
        return 1;
      }
      io.stdout.write(notes + '\n');
      return 0;
    }

    if (WANT_APPLY) {
      if (DRY) {
        io.stdout.write(`dry-run: would bump ${facts.packageVersion} → ${facts.plan.next}\n`);
        return 0;
      }
      const applied = apply(facts);
      io.stderr.write(`applied ${applied.version} (${applied.date})\n`);
      if (WANT_JSON) {
        io.stdout.write(JSON.stringify({ ...facts.plan, applied }, null, 2) + '\n');
      } else {
        const lines = [`package.json → ${applied.version}`];
        if (applied.changelogRewritten) {
          lines.push(`CHANGELOG.md → ## [${applied.version}] - ${applied.date}`);
        }
        lines.push('next: commit, then node scripts/release/release.js --ship');
        io.stdout.write(lines.join('\n') + '\n');
      }
      return 0;
    }

    if (WANT_SHIP) {
      if (DRY) {
        ship(facts, { dryRun: true });
        io.stdout.write(`dry-run: would tag+release v${facts.packageVersion}\n`);
        return 0;
      }
      const result = ship(facts);
      io.stdout.write(`shipped ${result.tag}\n${facts.repoUrl}/releases/tag/${result.tag}\n`);
      io.stdout.write(
        `\nNext (human, 2FA — npm UI only):\n  https://www.npmjs.com/package/${facts.name}?activeTab=versions\n`,
      );
      return 0;
    }

    if (WANT_JSON) io.stdout.write(JSON.stringify(facts.plan, null, 2) + '\n');
    else io.stdout.write(printPlan(facts) + '\n');

    return facts.plan.kind === 'none' ? 2 : 0;
  }

  return { collect, apply, ship, printPlan, run, PKG_PATH, CHANGELOG_PATH };
}

export function resolveRoot(argv = process.argv.slice(2), fallback = process.cwd()) {
  const { root } = parseArgs(argv);
  return root || fallback;
}

function main() {
  try {
    const root = resolveRoot();
    const cli = createRelease({ root });
    const code = cli.run();
    process.exitCode = code;
  } catch (err) {
    process.stderr.write(String(err?.message || err) + '\n');
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
