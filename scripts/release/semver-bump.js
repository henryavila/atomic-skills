/**
 * Semver chooser for Atomic Skills release flow.
 *
 * Single source of truth for "what bump is this?". Feature = MINOR.
 * Patch is bugfix-only. 0.x breaking stays MINOR (never auto 1.0.0).
 */

const COMMIT_RE =
  /^(feat|fix|perf|refactor|docs|chore|test|ci|style|build)(\([^)]+\))?(!)?:\s+/i;

const SECTION_KEYS = {
  added: 'added',
  changed: 'changed',
  deprecated: 'deprecated',
  removed: 'removed',
  fixed: 'fixed',
  security: 'security',
};

export function emptyUnreleased() {
  return { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] };
}

export function parseUnreleased(changelog) {
  const out = emptyUnreleased();
  const start = changelog.search(/^## \[Unreleased\]\s*$/m);
  if (start < 0) return out;
  const rest = changelog.slice(start);
  const next = rest.search(/^## \[/m);
  const endRel = next > 0 ? rest.slice(0, next).length : rest.length;
  const nl = rest.indexOf('\n');
  const body = rest.slice(nl + 1, endRel);
  const nextVersion = body.search(/^## \[/m);
  const block = nextVersion >= 0 ? body.slice(0, nextVersion) : body;

  let current = null;
  for (const line of block.split('\n')) {
    const heading = line.match(/^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)\s*$/);
    if (heading?.[1]) {
      current = SECTION_KEYS[heading[1].toLowerCase()] ?? null;
      continue;
    }
    if (!current) continue;
    const item = line.match(/^\s*-\s+(.+?)\s*$/);
    if (item?.[1]) out[current].push(item[1]);
  }
  return out;
}

export function parseCommit(subject) {
  const raw = String(subject ?? '').trim();
  if (!raw || /^merge\b/i.test(raw)) return { type: 'merge', breaking: false, raw };
  const m = raw.match(COMMIT_RE);
  if (!m) return { type: 'other', breaking: /breaking change/i.test(raw), raw };
  return {
    type: (m[1] ?? 'other').toLowerCase(),
    breaking: Boolean(m[3]) || /breaking change/i.test(raw),
    raw,
  };
}

export function parseVersion(v) {
  const m = String(v ?? '')
    .trim()
    .replace(/^v/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m?.[1] || !m[2] || !m[3]) throw new Error(`not a semver x.y.z: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: `${m[1]}.${m[2]}.${m[3]}` };
}

export function cmpVersion(a, b) {
  const A = parseVersion(a);
  const B = parseVersion(b);
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  return A.patch - B.patch;
}

export function maxVersion(versions) {
  const parsed = [...versions].filter(Boolean).map((v) => parseVersion(v).raw);
  if (parsed.length === 0) return null;
  parsed.sort(cmpVersion);
  return parsed[parsed.length - 1] ?? null;
}

export function bumpVersion(current, kind) {
  const v = parseVersion(current);
  if (kind === 'none' || kind === 'keep') return v.raw;
  if (kind === 'patch') return `${v.major}.${v.minor}.${v.patch + 1}`;
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
  if (kind === 'major') {
    if (v.major === 0) return `0.${v.minor + 1}.0`;
    return `${v.major + 1}.0.0`;
  }
  throw new Error(`unknown bump kind: ${kind}`);
}

export function classifyBump({
  current,
  commits = [],
  unreleased = emptyUnreleased(),
}) {
  const v = parseVersion(current);
  const parsed = commits.map(parseCommit);
  const reasons = [];

  const feat = parsed.filter((c) => c.type === 'feat');
  const fix = parsed.filter((c) => c.type === 'fix' || c.type === 'perf');
  const breakingCommits = parsed.filter((c) => c.breaking);
  const hasAdded = unreleased.added.length > 0;
  const hasChanged = unreleased.changed.length > 0 || unreleased.deprecated.length > 0;
  const hasRemoved = unreleased.removed.length > 0;
  const hasFixed = unreleased.fixed.length > 0 || unreleased.security.length > 0;
  const breaking = breakingCommits.length > 0 || hasRemoved;

  if (breaking) {
    reasons.push(
      breakingCommits[0]
        ? `breaking commit: ${breakingCommits[0].raw}`
        : `changelog Removed: ${unreleased.removed[0]}`,
    );
  }
  if (feat[0]) reasons.push(`feat: ${feat[0].raw}`);
  if (hasAdded) reasons.push(`changelog Added: ${unreleased.added[0]}`);
  if (hasChanged) {
    reasons.push(
      `changelog ${unreleased.changed.length ? 'Changed' : 'Deprecated'}: ${
        unreleased.changed[0] || unreleased.deprecated[0]
      }`,
    );
  }
  if (fix[0]) reasons.push(`fix: ${fix[0].raw}`);
  if (hasFixed) reasons.push(`changelog Fixed: ${unreleased.fixed[0] || unreleased.security[0]}`);

  let kind = 'none';
  if (breaking) kind = v.major === 0 ? 'minor' : 'major';
  else if (feat.length || hasAdded || hasChanged) kind = 'minor';
  else if (fix.length || hasFixed) kind = 'patch';

  const featureSignal = feat.length > 0 || hasAdded || hasChanged || breaking;
  if (kind === 'patch' && featureSignal) {
    kind = 'minor';
    reasons.unshift('gate: feature signal forbids patch');
  }

  return {
    current: v.raw,
    kind,
    next: bumpVersion(v.raw, kind),
    breaking,
    reasons,
    signals: {
      feat: feat.map((c) => c.raw),
      fix: fix.map((c) => c.raw),
      breaking: breakingCommits.map((c) => c.raw),
      added: unreleased.added,
      changed: unreleased.changed,
      removed: unreleased.removed,
      fixed: unreleased.fixed,
    },
  };
}

export function extractSection(changelog, version) {
  const heading = new RegExp(
    `^## \\[${escapeReg(version)}\\](?:\\s+-\\s+\\d{4}-\\d{2}-\\d{2})?\\s*$`,
    'm',
  );
  const start = changelog.search(heading);
  if (start < 0) return null;
  const from = changelog.slice(start);
  const skip = from.indexOf('\n');
  const after = from.slice(skip + 1);
  const next = after.search(/^## \[|^\[Unreleased\]:|^\[0?\d+\.\d+\.\d+\]:/m);
  return (next >= 0 ? after.slice(0, next) : after).trim();
}

export function extractReleaseNotes(changelog, version) {
  return extractSection(changelog, version) ?? '';
}

export function rewriteChangelog(changelog, { next, date, repoUrl }) {
  const unreleasedHeading = /^## \[Unreleased\]\s*$/m;
  const start = changelog.search(unreleasedHeading);
  if (start < 0) throw new Error('CHANGELOG.md has no ## [Unreleased] heading');

  const afterHeadingIdx = changelog.indexOf('\n', start);
  const afterHeading = afterHeadingIdx >= 0 ? changelog.slice(afterHeadingIdx + 1) : '';
  const nextHeading = afterHeading.search(/^## \[/m);
  const unreleasedBody = (nextHeading >= 0 ? afterHeading.slice(0, nextHeading) : afterHeading).replace(
    /^\n+/,
    '',
  );
  const remainder = nextHeading >= 0 ? afterHeading.slice(nextHeading) : '';
  const prefix = changelog.slice(0, start);

  let out =
    `${prefix}## [Unreleased]\n\n` +
    `## [${next}] - ${date}\n\n` +
    unreleasedBody.replace(/\n+$/, '\n\n') +
    remainder;

  const base = repoUrl.replace(/\.git$/, '');
  const releasesBase = `${base}/releases/tag/v${next}`;
  const compareBase = `${base}/compare/v${next}...HEAD`;

  if (/^\[Unreleased\]:/m.test(out)) {
    out = out.replace(/^\[Unreleased\]:\s+\S+/m, `[Unreleased]: ${compareBase}`);
  } else {
    out = out.replace(/\s*$/, `\n\n[Unreleased]: ${compareBase}\n`);
  }

  const newLink = `[${next}]: ${releasesBase}`;
  if (!new RegExp(`^\\[${escapeReg(next)}\\]:`, 'm').test(out)) {
    if (/^\[Unreleased\]:/m.test(out)) {
      out = out.replace(/^\[Unreleased\]:.*$/m, (line) => `${line}\n${newLink}`);
    } else {
      out = out.replace(/\s*$/, `\n${newLink}\n`);
    }
  }

  return out;
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function githubRepoUrl(pkg) {
  const raw =
    (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) || pkg.homepage || '';
  return String(raw)
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://');
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
