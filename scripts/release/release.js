#!/usr/bin/env node
/**
 * Release planner/applier. Chooses the next semver; does not guess patch.
 *
 *   node scripts/release/release.js              plan (stdout)
 *   node scripts/release/release.js --json       plan as JSON
 *   node scripts/release/release.js --apply      bump package.json + CHANGELOG.md (when present)
 *   node scripts/release/release.js --notes      print GH notes for package.json version
 *   node scripts/release/release.js --ship       tag + push + GitHub Release (tree must be clean)
 *   node scripts/release/release.js --ship --no-npm
 *     GH-only opt-out when package is public but stage Action is intentionally unused
 *
 * npm publish is NOT done here. GitHub Release triggers OIDC stage; a human
 * approves with 2FA on the npmjs.com UI (Staged packages tab) — not CLI.
 * --ship refuses: kind=none, default branch, and npm-in-scope without stage Action
 * (unless --no-npm).
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
import {
  executablePublishKinds,
  isStageOnly,
  assertNoRegistryPublish,
} from './release-workflow.js';

const RELEASE_BIN =
  'node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js"';

const RELEASE_USAGE = [
  'Usage: node scripts/release/release.js [--json] [--apply] [--notes] [--ship] [--no-npm] [--dry-run] [--root <dir>]',
  'plan prints next version; --apply rewrites package.json (+ CHANGELOG when present);',
  '--ship tags + gh release (refuses kind=none, default branch, and npm-without-stage unless --no-npm).',
].join('\n') + '\n';

/**
 * @typedef {object} ReleaseFixtures
 * @property {string} [defaultBranch]
 * @property {string} [currentBranch]
 * @property {string[]} [commits]
 * @property {string[]} [gitTags]
 * @property {string[]} [githubReleases]
 * @property {string[]} [npmVersions]
 * @property {string | null} [npmLatest]
 * @property {string | null} [since]
 * @property {string} [remoteUrl]
 * @property {boolean} [dirty]
 */

/**
 * @typedef {object} ReleaseContext
 * @property {string} root
 * @property {(cmd: string, argv: string[], opts?: {allowFail?: boolean}) => string} sh
 * @property {(name: string, field: string) => unknown} npmJson
 * @property {() => Date} now
 * @property {(path: string, enc?: string) => string} readFile
 * @property {(path: string, data: string) => void} writeFile
 * @property {(path: string) => boolean} exists
 * @property {boolean} skipRemote
 * @property {ReleaseFixtures} fixtures
 * @property {string} pkgPath
 * @property {string} changelogPath
 * @property {string} publishWorkflow
 */

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

function isNpmInScope(pkg, noNpm = false) {
  if (noNpm) return false;
  return Boolean(pkg) && pkg.private !== true;
}

/** @param {ReleaseContext} ctx */
function publishKinds(ctx) {
  if (!ctx.exists(ctx.publishWorkflow)) return null;
  return executablePublishKinds(ctx.readFile(ctx.publishWorkflow));
}

/**
 * Stage Action is adopted when an executable `run` step runs
 * `npm stage publish` and no executable step runs `npm publish`
 * (flags may precede the subcommand). A workflow name or comment
 * that merely contains the words is not adoption.
 *
 * @param {ReleaseContext} ctx
 */
function isStageActionAdopted(ctx) {
  const kinds = publishKinds(ctx);
  return Boolean(kinds) && isStageOnly(kinds);
}

/** @param {ReleaseContext} ctx */
function assertNoRegistryWorkflow(ctx) {
  const kinds = publishKinds(ctx);
  if (kinds) assertNoRegistryPublish(kinds);
}

/** @param {ReleaseContext} ctx */
function resolveDefaultBranch(ctx) {
  if (ctx.fixtures.defaultBranch) return ctx.fixtures.defaultBranch;
  const ref = ctx.sh('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { allowFail: true });
  const prefix = 'refs/remotes/origin/';
  if (ref && ref.startsWith(prefix)) {
    const name = ref.slice(prefix.length).trim();
    if (name) return name;
  }
  for (const name of ['main', 'master']) {
    const local = ctx.sh('git', ['rev-parse', '--verify', `refs/heads/${name}`], { allowFail: true });
    const remote = ctx.sh('git', ['rev-parse', '--verify', `refs/remotes/origin/${name}`], { allowFail: true });
    if (local || remote) return name;
  }
  return null;
}

/** @param {ReleaseContext} ctx */
function currentBranch(ctx) {
  if (ctx.fixtures.currentBranch) return ctx.fixtures.currentBranch;
  return ctx.sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
}

/** Dual-mode D4: refuse ship that would imply npm without stage Action. */
function assertDistributionGate(ctx, pkg, { noNpm = false } = {}) {
  if (!isNpmInScope(pkg, noNpm)) {
    assertNoRegistryWorkflow(ctx);
    return { npmInScope: false, stageAdopted: false };
  }
  const stageAdopted = isStageActionAdopted(ctx);
  if (stageAdopted) return { npmInScope: true, stageAdopted: true };
  throw new Error(
    'npm is in scope but stage Action is missing or not stage-only. Refuse ship. Adopt skills/shared/release-assets/templates/publish-stage.yml (see adopt.md) or pass --no-npm for GH-only.',
  );
}

/** @param {ReleaseContext} ctx */
function assertNotDefaultBranch(ctx) {
  const branch = currentBranch(ctx);
  const def = resolveDefaultBranch(ctx);
  if (!def) {
    throw new Error(
      'could not resolve default branch (origin/HEAD, main, or master); refusing to ship',
    );
  }
  if (branch === def) {
    throw new Error(
      `refusing to ship from default branch (${def}); cut the release from a work branch`,
    );
  }
  return branch;
}

/** @param {ReleaseContext} ctx */
function gitCommitsSince(ctx, rev) {
  if (ctx.fixtures.commits) return [...ctx.fixtures.commits];
  const range = rev ? `${rev}..HEAD` : 'HEAD';
  const out = ctx.sh('git', ['log', range, '--pretty=format:%B%x1e'], { allowFail: true });
  if (!out) return [];
  return out
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** @param {ReleaseContext} ctx */
function findBumpCommit(ctx, version) {
  const out = ctx.sh(
    'git',
    ['log', '-1', '--format=%H', '-S', `"version": "${version}"`, '--', 'package.json'],
    { allowFail: true },
  );
  return out || null;
}

function onlyStable(list) {
  const out = [];
  for (const version of list) {
    if (!version) continue;
    try {
      out.push(parseVersion(version).raw);
    } catch {
      // Drop prerelease and non-semver names before compare/sort.
    }
  }
  return out;
}

function newestChangelogVersion(changelog) {
  const found = [];
  for (const match of changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)) {
    found.push(match[1]);
  }
  return maxVersion(found);
}

function unreleasedEmpty(section) {
  return Object.values(section).every((items) => items.length === 0);
}

function chooseBaseline(pkgVersion, npmLatest, tags, ghTags) {
  if (npmLatest && cmpVersion(pkgVersion, npmLatest) > 0) return npmLatest;
  if (npmLatest) return npmLatest;
  const released = maxVersion([...tags, ...ghTags]);
  if (released && cmpVersion(pkgVersion, released) > 0) return released;
  if (released) return released;
  return pkgVersion;
}

/** @param {ReleaseContext} ctx */
function collectReleaseTags(ctx) {
  let tags = [];
  let ghTags = [];
  if (ctx.skipRemote) {
    tags = ctx.fixtures.gitTags ? [...ctx.fixtures.gitTags] : [];
    ghTags = ctx.fixtures.githubReleases ? [...ctx.fixtures.githubReleases] : [];
  } else {
    tags = ctx.sh('git', ['tag', '-l', 'v*'], { allowFail: true })
      .split('\n')
      .map((t) => t.replace(/^v/, ''))
      .filter(Boolean);

    const ghOut = ctx.sh('gh', ['release', 'list', '--json', 'tagName', '-L', '50'], { allowFail: true });
    if (ghOut) {
      try {
        ghTags = JSON.parse(ghOut).map((r) => String(r.tagName).replace(/^v/, ''));
      } catch {
        ghTags = [];
      }
    }
  }
  return { tags: onlyStable(tags), ghTags: onlyStable(ghTags) };
}

/** @param {ReleaseContext} ctx */
function loadPackageFacts(ctx, { hasPackage, hasChangelog, changelog, tags, ghTags }) {
  if (hasPackage) {
    const pkg = JSON.parse(ctx.readFile(ctx.pkgPath));
    return { pkg, pkgVersion: parseVersion(pkg.version).raw };
  }
  const released = maxVersion([...tags, ...ghTags]);
  const noted = hasChangelog ? newestChangelogVersion(changelog) : null;
  let pkgVersion;
  if (noted && (!released || cmpVersion(noted, released) > 0)) pkgVersion = noted;
  else pkgVersion = released || '0.0.0';
  const remote = ctx.fixtures.remoteUrl
    || (ctx.skipRemote ? '' : ctx.sh('git', ['remote', 'get-url', 'origin'], { allowFail: true }));
  const repoUrl = String(remote || '').replace(/\.git$/, '');
  const name = repoUrl ? repoUrl.split('/').pop() : 'repository';
  const pkg = {
    name,
    version: pkgVersion,
    private: true,
    repository: { type: 'git', url: repoUrl },
  };
  return { pkg, pkgVersion };
}

/** @param {ReleaseContext} ctx */
function resolveNpmFacts(ctx, pkg, noNpm) {
  const npmInScope = isNpmInScope(pkg, noNpm);
  let npmVersions = [];
  let npmLatest = null;
  if (npmInScope && ctx.skipRemote) {
    npmVersions = onlyStable(ctx.fixtures.npmVersions ? [...ctx.fixtures.npmVersions] : []);
    if (ctx.fixtures.npmLatest) npmLatest = onlyStable([ctx.fixtures.npmLatest])[0] ?? null;
    else npmLatest = npmVersions.length ? maxVersion(npmVersions) : null;
  } else if (npmInScope) {
    const npmVersionsRaw = ctx.npmJson(pkg.name, 'versions');
    const rawList = Array.isArray(npmVersionsRaw)
      ? npmVersionsRaw.map(String)
      : npmVersionsRaw
        ? [String(npmVersionsRaw)]
        : [];
    npmVersions = onlyStable(rawList);
    npmLatest = npmVersions.length ? maxVersion(npmVersions) : null;
  }
  return { npmInScope, npmVersions, npmLatest };
}

function assertPackageNotBehindNpm(pkgVersion, npmLatest) {
  if (npmLatest && cmpVersion(pkgVersion, npmLatest) < 0) {
    throw new Error(
      `package.json ${pkgVersion} is behind npm ${npmLatest}. Pull/sync before releasing.`,
    );
  }
}

/** @param {ReleaseContext} ctx */
function resolveSince(ctx, { baseline, pkgVersion, tags }) {
  if (Object.hasOwn(ctx.fixtures, 'since')) return ctx.fixtures.since;
  if (tags.includes(baseline)) return `v${baseline}`;
  if (!ctx.skipRemote && baseline !== pkgVersion) return findBumpCommit(ctx, baseline);
  return null;
}

function resolveUnreleased(changelog, { hasChangelog, pkgVersion, baseline }) {
  let unreleased = hasChangelog ? parseUnreleased(changelog) : emptyUnreleased();
  if (hasChangelog && unreleasedEmpty(unreleased) && cmpVersion(pkgVersion, baseline) > 0) {
    const notes = extractReleaseNotes(changelog, pkgVersion);
    if (notes) unreleased = parseUnreleased(`## [Unreleased]\n${notes}\n`);
  }
  return unreleased;
}

function buildWarnings({ npmLatest, ghTags, alreadyBumped, pkgVersion, plan }) {
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
  return warnings;
}

/** @param {ReleaseContext} ctx */
function collectRelease(ctx, { noNpm = false } = {}) {
  const hasPackage = ctx.exists(ctx.pkgPath);
  const hasChangelog = ctx.exists(ctx.changelogPath);
  const changelog = hasChangelog ? ctx.readFile(ctx.changelogPath) : '';

  const { tags, ghTags } = collectReleaseTags(ctx);
  const { pkg, pkgVersion } = loadPackageFacts(ctx, {
    hasPackage,
    hasChangelog,
    changelog,
    tags,
    ghTags,
  });
  const { npmVersions, npmLatest } = resolveNpmFacts(ctx, pkg, noNpm);

  assertPackageNotBehindNpm(pkgVersion, npmLatest);

  const alreadyBumped = npmLatest ? cmpVersion(pkgVersion, npmLatest) > 0 : false;
  const baseline = chooseBaseline(pkgVersion, npmLatest, tags, ghTags);
  const since = resolveSince(ctx, { baseline, pkgVersion, tags });
  const commits = gitCommitsSince(ctx, since);
  const unreleased = resolveUnreleased(changelog, { hasChangelog, pkgVersion, baseline });
  const plan = classifyBump({ current: baseline, commits, unreleased });
  const repoUrl = githubRepoUrl(pkg);
  const warnings = buildWarnings({ npmLatest, ghTags, alreadyBumped, pkgVersion, plan });

  return {
    name: pkg.name,
    packageVersion: pkgVersion,
    npmLatest,
    npmVersions,
    gitTags: [...tags].sort(cmpVersion),
    githubReleases: [...ghTags].sort(cmpVersion),
    baseline,
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

function formatPlanHeader(facts) {
  const { plan } = facts;
  return [
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
}

function formatWarnings(warnings) {
  if (!warnings.length) return [];
  const lines = ['', '  warnings:'];
  for (const w of warnings) lines.push(`    ! ${w}`);
  return lines;
}

/** @param {ReleaseContext} ctx */
function formatNextSteps(ctx, facts, noNpm) {
  if (facts.plan.kind === 'none') return ['', '  nothing to release.'];
  const npmInScope = isNpmInScope(facts.pkg, noNpm);
  const stageAdopted = isStageActionAdopted(ctx);
  const lines = ['', '  next steps:', `    ${RELEASE_BIN} --root "$PWD" --apply`];
  if (npmInScope && !stageAdopted) {
    lines.push(
      '    REFUSE ship — npm in scope but stage Action is missing or not stage-only.',
      '    adopt skills/shared/release-assets/templates/publish-stage.yml (see adopt.md)',
      '    or pass --no-npm for GH-only',
    );
  } else {
    lines.push(
      `    ${RELEASE_BIN} --root "$PWD" --ship${noNpm ? ' --no-npm' : ''}`,
    );
    if (npmInScope && stageAdopted) {
      lines.push(
        `    human (UI): https://www.npmjs.com/package/${facts.name}?activeTab=versions`,
      );
    }
  }
  return lines;
}

/** @param {ReleaseContext} ctx */
function printPlan(ctx, facts, { noNpm = false } = {}) {
  return [
    ...formatPlanHeader(facts),
    ...formatWarnings(facts.warnings),
    ...formatNextSteps(ctx, facts, noNpm),
  ].join('\n');
}

/** @param {ReleaseContext} ctx */
function applyRelease(ctx, facts) {
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

  const date = todayISO(ctx.now());
  if (!ctx.exists(ctx.pkgPath) && !facts.hasChangelog) {
    throw new Error('no package.json and no CHANGELOG.md; cannot record the release version');
  }

  if (facts.hasChangelog) {
    const changelog = rewriteChangelog(facts.changelog, {
      next: plan.next,
      date,
      repoUrl: facts.repoUrl,
    });
    ctx.writeFile(ctx.changelogPath, changelog);
  }

  if (ctx.exists(ctx.pkgPath)) {
    const pkg = { ...facts.pkg, version: plan.next };
    ctx.writeFile(ctx.pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return { version: plan.next, date, changelogRewritten: facts.hasChangelog };
}

/** @param {ReleaseContext} ctx */
function assertCleanTree(ctx) {
  if (ctx.skipRemote && ctx.fixtures.dirty === false) return;
  if (ctx.skipRemote && ctx.fixtures.dirty === true) {
    throw new Error('working tree not clean:\n M package.json');
  }
  const status = ctx.sh('git', ['status', '--porcelain']);
  if (status) {
    throw new Error(`working tree not clean:\n${status}`);
  }
}

/** Validate every ship precondition, in the order the CLI has always used. */
function assertShippable(ctx, facts, noNpm) {
  if (facts.plan.kind === 'none') {
    throw new Error('nothing to ship (kind=none) — refuse inventing a release');
  }

  const version = parseVersion(facts.packageVersion).raw;
  if (facts.plan.next !== version) {
    throw new Error(
      `refusing to ship ${version}; classifier wants ${facts.plan.next}. Run --apply before --ship.`,
    );
  }

  const distribution = assertDistributionGate(ctx, facts.pkg, { noNpm });
  const branch = assertNotDefaultBranch(ctx);
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
  return { version, branch, distribution };
}

function resolveReleaseNotes(facts, version) {
  if (!facts.hasChangelog) return `Release ${version}`;
  const notes = extractReleaseNotes(facts.changelog, version);
  if (!notes.trim()) {
    throw new Error(`CHANGELOG.md has no ## [${version}] body. Run --apply first.`);
  }
  return notes;
}

/** @param {ReleaseContext} ctx */
function publishTag(ctx, { tag, version, branch, notes }) {
  const head = ctx.sh('git', ['rev-parse', 'HEAD']);
  const local = ctx.sh('git', ['rev-parse', '--verify', `${tag}^{commit}`], { allowFail: true });
  if (local && local !== head) {
    throw new Error(`tag ${tag} points at ${local}, not HEAD ${head}`);
  }
  const remoteText = ctx.sh('git', ['ls-remote', '--tags', 'origin', tag], { allowFail: true });
  const remoteLines = remoteText
    ? remoteText.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  const peeled = remoteLines.find((line) => line.endsWith('^{}')) || remoteLines[0];
  const remoteCommit = peeled ? peeled.split('\t')[0] : null;
  if (remoteCommit && remoteCommit !== head) {
    throw new Error(`tag ${tag} points at ${remoteCommit}, not HEAD ${head}`);
  }
  if (!local) {
    ctx.sh('git', ['tag', '-a', tag, '-m', `Version ${version}`]);
  }

  ctx.sh('git', ['push', 'origin', branch]);
  ctx.sh('git', ['push', 'origin', tag]);
  ctx.sh('gh', ['release', 'create', tag, '--title', tag, '--notes', notes]);
}

/** @param {ReleaseContext} ctx */
function shipRelease(ctx, facts, { dryRun = false, noNpm = false } = {}) {
  const { version, branch, distribution } = assertShippable(ctx, facts, noNpm);
  const notes = resolveReleaseNotes(facts, version);
  const tag = `v${version}`;

  if (dryRun) {
    return { tag, notes, dryRun: true, branch, distribution };
  }

  assertCleanTree(ctx);
  publishTag(ctx, { tag, version, branch, notes });

  return { tag, notes, branch, distribution };
}

function parseCommandFlags(args) {
  return {
    json: args.has('--json'),
    apply: args.has('--apply'),
    notes: args.has('--notes'),
    ship: args.has('--ship'),
    dry: args.has('--dry-run') || args.has('-n'),
    noNpm: args.has('--no-npm'),
  };
}

function runNotes(facts, io) {
  const v = facts.packageVersion;
  const notes = facts.hasChangelog ? extractReleaseNotes(facts.changelog, v) : '';
  if (!notes) {
    io.stderr.write(`no notes for ${v} — Unreleased not applied yet?\n`);
    return 1;
  }
  io.stdout.write(notes + '\n');
  return 0;
}

/** @param {ReleaseContext} ctx */
function formatApplied(ctx, facts, applied, noNpm) {
  const lines = [`package.json → ${applied.version}`];
  if (applied.changelogRewritten) {
    lines.push(`CHANGELOG.md → ## [${applied.version}] - ${applied.date}`);
  }
  const npmInScope = isNpmInScope(facts.pkg, noNpm);
  const stageAdopted = isStageActionAdopted(ctx);
  if (npmInScope && !stageAdopted) {
    lines.push(
      'next: commit on a work branch; refuse --ship until stage Action is adopted (or pass --no-npm)',
    );
  } else {
    lines.push(
      `next: commit on a work branch, then ${RELEASE_BIN} --root "$PWD" --ship${noNpm ? ' --no-npm' : ''}`,
    );
  }
  return lines.join('\n');
}

/** @param {ReleaseContext} ctx */
function runApply(ctx, facts, wants, io) {
  if (wants.dry) {
    io.stdout.write(`dry-run: would bump ${facts.packageVersion} → ${facts.plan.next}\n`);
    return 0;
  }
  const applied = applyRelease(ctx, facts);
  io.stderr.write(`applied ${applied.version} (${applied.date})\n`);
  if (wants.json) {
    io.stdout.write(JSON.stringify({ ...facts.plan, applied }, null, 2) + '\n');
  } else {
    io.stdout.write(formatApplied(ctx, facts, applied, wants.noNpm) + '\n');
  }
  return 0;
}

/** @param {ReleaseContext} ctx */
function runShip(ctx, facts, wants, io) {
  if (wants.dry) {
    const preview = shipRelease(ctx, facts, { dryRun: true, noNpm: wants.noNpm });
    io.stdout.write(`dry-run: would tag+release v${facts.packageVersion}\n`);
    if (preview.distribution?.npmInScope && preview.distribution?.stageAdopted) {
      io.stdout.write(
        `next (human, 2FA — npm UI only):\n  https://www.npmjs.com/package/${facts.name}?activeTab=versions\n`,
      );
    }
    return 0;
  }
  const result = shipRelease(ctx, facts, { noNpm: wants.noNpm });
  io.stdout.write(`shipped ${result.tag}\n${facts.repoUrl}/releases/tag/${result.tag}\n`);
  if (result.distribution?.npmInScope && result.distribution?.stageAdopted) {
    io.stdout.write(
      `\nNext (human, 2FA — npm UI only):\n  https://www.npmjs.com/package/${facts.name}?activeTab=versions\n`,
    );
  }
  return 0;
}

/** @param {ReleaseContext} ctx */
function runPlan(ctx, facts, wants, io) {
  if (wants.json) io.stdout.write(JSON.stringify(facts.plan, null, 2) + '\n');
  else io.stdout.write(printPlan(ctx, facts, { noNpm: wants.noNpm }) + '\n');
  return facts.plan.kind === 'none' ? 2 : 0;
}

/** @param {ReleaseContext} ctx */
function runRelease(ctx, argv = process.argv.slice(2), io = process) {
  const { args } = parseArgs(argv);
  if (args.has('-h') || args.has('--help')) {
    io.stdout.write(RELEASE_USAGE);
    return 0;
  }
  const wants = parseCommandFlags(args);
  const facts = collectRelease(ctx, { noNpm: wants.noNpm });

  if (wants.notes) return runNotes(facts, io);
  if (wants.apply) return runApply(ctx, facts, wants, io);
  if (wants.ship) return runShip(ctx, facts, wants, io);
  return runPlan(ctx, facts, wants, io);
}

/**
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {(cmd: string, argv: string[], opts?: {allowFail?: boolean}) => string} [options.sh]
 * @param {(name: string, field: string) => unknown} [options.npmJson]
 * @param {() => Date} [options.now]
 * @param {(path: string, enc?: string) => string} [options.readFile]
 * @param {(path: string, data: string) => void} [options.writeFile]
 * @param {(path: string) => boolean} [options.exists]
 * @param {boolean} [options.skipRemote] skip npm/gh/git network probes (unit tests)
 * @param {ReleaseFixtures} [options.fixtures] override remote facts when skipRemote
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

  /** @type {ReleaseContext} */
  const ctx = {
    root,
    sh,
    npmJson,
    now,
    readFile,
    writeFile,
    exists,
    skipRemote,
    fixtures,
    pkgPath: join(root, 'package.json'),
    changelogPath: join(root, 'CHANGELOG.md'),
    publishWorkflow: join(root, '.github/workflows/publish.yml'),
  };

  return {
    collect: collectRelease.bind(null, ctx),
    apply: applyRelease.bind(null, ctx),
    ship: shipRelease.bind(null, ctx),
    printPlan: printPlan.bind(null, ctx),
    run: runRelease.bind(null, ctx),
    PKG_PATH: ctx.pkgPath,
    CHANGELOG_PATH: ctx.changelogPath,
  };
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
