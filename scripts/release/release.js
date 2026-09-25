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

const RELEASE_BIN =
  'node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js"';

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
  const PUBLISH_WORKFLOW = join(root, '.github/workflows/publish.yml');

  function isNpmInScope(pkg, noNpm = false) {
    if (noNpm) return false;
    return Boolean(pkg) && pkg.private !== true;
  }

  function stripYamlComments(text) {
    return text
      .split('\n')
      .map((line) => line.replace(/^\s*#.*$/, ''))
      .join('\n');
  }

  function extractRunScripts(yaml) {
    const scripts = [];
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const header = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
      if (!header) continue;
      const indent = header[1].length;
      const inline = header[2].trim();
      if (inline && inline !== '|' && inline !== '|-' && inline !== '>' && inline !== '>-') {
        scripts.push(inline);
        continue;
      }
      const buf = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() === '') {
          buf.push(line);
          continue;
        }
        const lineIndent = line.match(/^(\s*)/)[1].length;
        if (lineIndent <= indent) break;
        buf.push(line);
      }
      scripts.push(buf.join('\n'));
    }
    return scripts;
  }

  function classifyNpmLine(line) {
    const trimmed = line.replace(/#.*$/, '').trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(?:npx\s+--yes\s+)?npm(?:@[\w.-]+)?\b(.*)$/);
    if (!match) return null;
    const positional = match[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => !token.startsWith('-'));
    if (positional[0] === 'stage' && positional.includes('publish')) return 'stage';
    if (positional.includes('publish')) return 'direct';
    return null;
  }

  function executablePublishKinds(text) {
    const scripts = extractRunScripts(stripYamlComments(text));
    let stage = false;
    let direct = false;
    for (const script of scripts) {
      for (const line of script.split('\n')) {
        const kind = classifyNpmLine(line);
        if (kind === 'stage') stage = true;
        if (kind === 'direct') direct = true;
      }
    }
    return { stage, direct };
  }

  /**
   * Stage Action is adopted when an executable `run` step runs
   * `npm stage publish` and no executable step runs `npm publish`
   * (flags may precede the subcommand). A workflow name or comment
   * that merely contains the words is not adoption.
   */
  function isStageActionAdopted() {
    if (!exists(PUBLISH_WORKFLOW)) return false;
    const kinds = executablePublishKinds(readFile(PUBLISH_WORKFLOW));
    return kinds.stage && !kinds.direct;
  }

  function assertNoRegistryWorkflow() {
    if (!exists(PUBLISH_WORKFLOW)) return;
    const kinds = executablePublishKinds(readFile(PUBLISH_WORKFLOW));
    if (kinds.stage || kinds.direct) {
      throw new Error(
        'publish.yml still runs a registry publish on release. Adopt the gh-only template or remove the workflow before shipping without npm.',
      );
    }
  }

  function resolveDefaultBranch() {
    if (fixtures.defaultBranch) return fixtures.defaultBranch;
    const ref = sh('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { allowFail: true });
    const prefix = 'refs/remotes/origin/';
    if (ref && ref.startsWith(prefix)) {
      const name = ref.slice(prefix.length).trim();
      if (name) return name;
    }
    for (const name of ['main', 'master']) {
      const local = sh('git', ['rev-parse', '--verify', `refs/heads/${name}`], { allowFail: true });
      const remote = sh('git', ['rev-parse', '--verify', `refs/remotes/origin/${name}`], { allowFail: true });
      if (local || remote) return name;
    }
    return null;
  }

  function currentBranch() {
    if (fixtures.currentBranch) return fixtures.currentBranch;
    return sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  }

  /** Dual-mode D4: refuse ship that would imply npm without stage Action. */
  function assertDistributionGate(pkg, { noNpm = false } = {}) {
    if (!isNpmInScope(pkg, noNpm)) {
      assertNoRegistryWorkflow();
      return { npmInScope: false, stageAdopted: false };
    }
    const stageAdopted = isStageActionAdopted();
    if (stageAdopted) return { npmInScope: true, stageAdopted: true };
    throw new Error(
      'npm is in scope but stage Action is missing or not stage-only. Refuse ship. Adopt skills/shared/release-assets/templates/publish-stage.yml (see adopt.md) or pass --no-npm for GH-only.',
    );
  }

  function assertNotDefaultBranch() {
    const branch = currentBranch();
    const def = resolveDefaultBranch();
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

  function gitCommitsSince(rev) {
    if (fixtures.commits) return [...fixtures.commits];
    const range = rev ? `${rev}..HEAD` : 'HEAD';
    const out = sh('git', ['log', range, '--pretty=format:%B%x1e'], { allowFail: true });
    if (!out) return [];
    return out
      .split('\x1e')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function findBumpCommit(version) {
    const out = sh(
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

  function collect({ noNpm = false } = {}) {
    const hasPackage = exists(PKG_PATH);
    const hasChangelog = exists(CHANGELOG_PATH);
    const changelog = hasChangelog ? readFile(CHANGELOG_PATH) : '';

    let tags = [];
    let ghTags = [];
    if (skipRemote) {
      tags = fixtures.gitTags ? [...fixtures.gitTags] : [];
      ghTags = fixtures.githubReleases ? [...fixtures.githubReleases] : [];
    } else {
      tags = sh('git', ['tag', '-l', 'v*'], { allowFail: true })
        .split('\n')
        .map((t) => t.replace(/^v/, ''))
        .filter(Boolean);

      const ghOut = sh('gh', ['release', 'list', '--json', 'tagName', '-L', '50'], { allowFail: true });
      if (ghOut) {
        try {
          ghTags = JSON.parse(ghOut).map((r) => String(r.tagName).replace(/^v/, ''));
        } catch {
          ghTags = [];
        }
      }
    }
    tags = onlyStable(tags);
    ghTags = onlyStable(ghTags);

    let pkg;
    let pkgVersion;
    if (hasPackage) {
      pkg = JSON.parse(readFile(PKG_PATH));
      pkgVersion = parseVersion(pkg.version).raw;
    } else {
      const released = maxVersion([...tags, ...ghTags]);
      const noted = hasChangelog ? newestChangelogVersion(changelog) : null;
      if (noted && (!released || cmpVersion(noted, released) > 0)) pkgVersion = noted;
      else pkgVersion = released || '0.0.0';
      const remote = fixtures.remoteUrl
        || (skipRemote ? '' : sh('git', ['remote', 'get-url', 'origin'], { allowFail: true }));
      const repoUrl = String(remote || '').replace(/\.git$/, '');
      const name = repoUrl ? repoUrl.split('/').pop() : 'repository';
      pkg = {
        name,
        version: pkgVersion,
        private: true,
        repository: { type: 'git', url: repoUrl },
      };
    }

    const npmInScope = isNpmInScope(pkg, noNpm);
    let npmVersions = [];
    let npmLatest = null;
    if (npmInScope && skipRemote) {
      npmVersions = onlyStable(fixtures.npmVersions ? [...fixtures.npmVersions] : []);
      if (fixtures.npmLatest) npmLatest = onlyStable([fixtures.npmLatest])[0] ?? null;
      else npmLatest = npmVersions.length ? maxVersion(npmVersions) : null;
    } else if (npmInScope) {
      const npmVersionsRaw = npmJson(pkg.name, 'versions');
      const rawList = Array.isArray(npmVersionsRaw)
        ? npmVersionsRaw.map(String)
        : npmVersionsRaw
          ? [String(npmVersionsRaw)]
          : [];
      npmVersions = onlyStable(rawList);
      npmLatest = npmVersions.length ? maxVersion(npmVersions) : null;
    }

    if (npmLatest && cmpVersion(pkgVersion, npmLatest) < 0) {
      throw new Error(
        `package.json ${pkgVersion} is behind npm ${npmLatest}. Pull/sync before releasing.`,
      );
    }

    const alreadyBumped = npmLatest ? cmpVersion(pkgVersion, npmLatest) > 0 : false;
    const baseline = chooseBaseline(pkgVersion, npmLatest, tags, ghTags);

    let since;
    if (Object.hasOwn(fixtures, 'since')) since = fixtures.since;
    else if (tags.includes(baseline)) since = `v${baseline}`;
    else if (!skipRemote && baseline !== pkgVersion) since = findBumpCommit(baseline);
    else since = null;

    const commits = gitCommitsSince(since);
    let unreleased = hasChangelog ? parseUnreleased(changelog) : emptyUnreleased();
    if (hasChangelog && unreleasedEmpty(unreleased) && cmpVersion(pkgVersion, baseline) > 0) {
      const notes = extractReleaseNotes(changelog, pkgVersion);
      if (notes) unreleased = parseUnreleased(`## [Unreleased]\n${notes}\n`);
    }

    const plan = classifyBump({ current: baseline, commits, unreleased });
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

  function printPlan(facts, { noNpm = false } = {}) {
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
      const npmInScope = isNpmInScope(facts.pkg, noNpm);
      const stageAdopted = isStageActionAdopted();
      lines.push('', '  next steps:', `    ${RELEASE_BIN} --root "$PWD" --apply`);
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
    if (!exists(PKG_PATH) && !facts.hasChangelog) {
      throw new Error('no package.json and no CHANGELOG.md; cannot record the release version');
    }

    if (facts.hasChangelog) {
      const changelog = rewriteChangelog(facts.changelog, {
        next: plan.next,
        date,
        repoUrl: facts.repoUrl,
      });
      writeFile(CHANGELOG_PATH, changelog);
    }

    if (exists(PKG_PATH)) {
      const pkg = { ...facts.pkg, version: plan.next };
      writeFile(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
    }

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

  function ship(facts, { dryRun = false, noNpm = false } = {}) {
    if (facts.plan.kind === 'none') {
      throw new Error('nothing to ship (kind=none) — refuse inventing a release');
    }

    const version = parseVersion(facts.packageVersion).raw;
    if (facts.plan.next !== version) {
      throw new Error(
        `refusing to ship ${version}; classifier wants ${facts.plan.next}. Run --apply before --ship.`,
      );
    }

    const distribution = assertDistributionGate(facts.pkg, { noNpm });
    const branch = assertNotDefaultBranch();
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
      return { tag: `v${version}`, notes, dryRun: true, branch, distribution };
    }

    assertCleanTree();

    const tag = `v${version}`;
    const head = sh('git', ['rev-parse', 'HEAD']);
    const local = sh('git', ['rev-parse', '--verify', `${tag}^{commit}`], { allowFail: true });
    if (local && local !== head) {
      throw new Error(`tag ${tag} points at ${local}, not HEAD ${head}`);
    }
    const remoteText = sh('git', ['ls-remote', '--tags', 'origin', tag], { allowFail: true });
    const remoteLines = remoteText
      ? remoteText.split('\n').map((line) => line.trim()).filter(Boolean)
      : [];
    const peeled = remoteLines.find((line) => line.endsWith('^{}')) || remoteLines[0];
    const remoteCommit = peeled ? peeled.split('\t')[0] : null;
    if (remoteCommit && remoteCommit !== head) {
      throw new Error(`tag ${tag} points at ${remoteCommit}, not HEAD ${head}`);
    }
    if (!local) {
      sh('git', ['tag', '-a', tag, '-m', `Version ${version}`]);
    }

    sh('git', ['push', 'origin', branch]);
    sh('git', ['push', 'origin', tag]);
    sh('gh', ['release', 'create', tag, '--title', tag, '--notes', notes]);

    return { tag, notes, branch, distribution };
  }

  function run(argv = process.argv.slice(2), io = process) {
    const { args } = parseArgs(argv);
    const WANT_JSON = args.has('--json');
    const WANT_APPLY = args.has('--apply');
    const WANT_NOTES = args.has('--notes');
    const WANT_SHIP = args.has('--ship');
    const DRY = args.has('--dry-run') || args.has('-n');
    const noNpm = args.has('--no-npm');

    if (args.has('-h') || args.has('--help')) {
      io.stdout.write(
        [
          'Usage: node scripts/release/release.js [--json] [--apply] [--notes] [--ship] [--no-npm] [--dry-run] [--root <dir>]',
          'plan prints next version; --apply rewrites package.json (+ CHANGELOG when present);',
          '--ship tags + gh release (refuses kind=none, default branch, and npm-without-stage unless --no-npm).',
        ].join('\n') + '\n',
      );
      return 0;
    }

    const facts = collect({ noNpm });

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
        const npmInScope = isNpmInScope(facts.pkg, noNpm);
        const stageAdopted = isStageActionAdopted();
        if (npmInScope && !stageAdopted) {
          lines.push(
            'next: commit on a work branch; refuse --ship until stage Action is adopted (or pass --no-npm)',
          );
        } else {
          lines.push(
            `next: commit on a work branch, then ${RELEASE_BIN} --root "$PWD" --ship${noNpm ? ' --no-npm' : ''}`,
          );
        }
        io.stdout.write(lines.join('\n') + '\n');
      }
      return 0;
    }

    if (WANT_SHIP) {
      if (DRY) {
        const preview = ship(facts, { dryRun: true, noNpm });
        io.stdout.write(`dry-run: would tag+release v${facts.packageVersion}\n`);
        if (preview.distribution?.npmInScope && preview.distribution?.stageAdopted) {
          io.stdout.write(
            `next (human, 2FA — npm UI only):\n  https://www.npmjs.com/package/${facts.name}?activeTab=versions\n`,
          );
        }
        return 0;
      }
      const result = ship(facts, { noNpm });
      io.stdout.write(`shipped ${result.tag}\n${facts.repoUrl}/releases/tag/${result.tag}\n`);
      if (result.distribution?.npmInScope && result.distribution?.stageAdopted) {
        io.stdout.write(
          `\nNext (human, 2FA — npm UI only):\n  https://www.npmjs.com/package/${facts.name}?activeTab=versions\n`,
        );
      }
      return 0;
    }

    if (WANT_JSON) io.stdout.write(JSON.stringify(facts.plan, null, 2) + '\n');
    else io.stdout.write(printPlan(facts, { noNpm }) + '\n');

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
