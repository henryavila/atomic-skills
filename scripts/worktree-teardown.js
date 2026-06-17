/**
 * worktree-teardown.js — read-only teardown safety decisions for plan branches.
 *
 * A branch may be removed by later wiring only after ancestry proves it has
 * reached a resolved base ref. This module only decides; it never mutates git.
 */
import { execSync } from 'node:child_process';
import { resolveIntegrationRef } from './integration-ref.js';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

// A read-only git adapter. Tests inject a fake.
const defaultGit = {
  refExists(ref) {
    try {
      execSync(`git rev-parse --verify --quiet ${shellQuote(ref)}`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  },

  isAncestor(branch, base) {
    try {
      execSync(`git merge-base --is-ancestor ${shellQuote(branch)} ${shellQuote(base)}`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  },

  revParse(ref) {
    try {
      return execSync(`git rev-parse --verify ${shellQuote(ref)}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  },
};

// A read-only gh adapter. The production wiring (resolving the recorded PR
// identity and calling `gh pr view`) is completed by `project finalize` (F3);
// the default here is a deliberate fail-CLOSED stub — with no real adapter
// injected every decision blocks as `gh-unauthenticated`, never `safe`.
const defaultGh = {
  prView() {
    return { authenticated: false };
  },
};

/** Resolve the preferred base ref for teardown ancestry checks, or null. */
export function resolveBaseRef({ routingConfig, git = defaultGit } = {}) {
  const { ref, configured } = resolveIntegrationRef(routingConfig);
  if (configured === false) return null;

  const remoteRef = `origin/${ref}`;
  if (git.refExists(remoteRef)) return { integrationRef: ref, baseRef: remoteRef };
  if (git.refExists(ref)) return { integrationRef: ref, baseRef: ref };
  return null;
}

/** Return a plain decision object describing whether branch teardown is safe. */
export function isTeardownSafe({
  branch,
  baseRef,
  integrationRef,
  prIdentity,
  git = defaultGit,
  gh = defaultGh,
} = {}) {
  const blocked = (reason) => ({ safe: false, outcome: 'blocked', reason });

  if (!branch) return { safe: false, outcome: 'nothing-to-remove' };
  if (!baseRef || !integrationRef) return blocked('indeterminate-base');
  if (!prIdentity) return blocked('pr-identity-missing');

  // The gh lookup is the one external call in this decision layer; a throw
  // (CLI absent, auth expired, network, malformed identity) must fail SAFE as a
  // block — never crash a function contracted to always return a decision object.
  let live;
  try {
    live = gh.prView(prIdentity);
  } catch {
    return blocked('gh-lookup-failed');
  }
  if (!live) return blocked('pr-identity-ambiguous');
  if (live.authenticated === false) return blocked('gh-unauthenticated');
  if (live.ambiguous === true) return blocked('pr-identity-ambiguous');
  if (live.state !== 'MERGED' || !live.mergedAt) return blocked('not-merged');
  if (live.baseRefName !== integrationRef) return blocked('base-ref-mismatch');

  const headRefOid = live.headRefOid;
  if (!headRefOid) return blocked('head-ref-missing');

  const branchHead = git.revParse(branch);
  if (branchHead && branchHead === headRefOid) {
    return {
      safe: true,
      outcome: 'safe',
      baseRef,
      integrationRef,
      headRefOid,
      via: 'squash-head-match',
    };
  }

  if (git.isAncestor(branch, baseRef)) {
    return { safe: true, outcome: 'safe', baseRef, integrationRef, via: 'ancestor' };
  }

  return blocked('residue-beyond-head');
}
