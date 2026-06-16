/**
 * worktree-teardown.js — read-only teardown safety decisions for plan branches.
 *
 * A branch may be removed by later wiring only after ancestry proves it has
 * reached a resolved base ref. This module only decides; it never mutates git.
 */
import { execSync } from 'node:child_process';

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
};

/** Resolve the preferred base ref for teardown ancestry checks, or null. */
export function resolveBaseRef({ git = defaultGit } = {}) {
  if (git.refExists('origin/main')) return 'origin/main';
  if (git.refExists('main')) return 'main';
  return null;
}

/** Return a plain decision object describing whether branch teardown is safe. */
export function isTeardownSafe({ branch, baseRef, git = defaultGit } = {}) {
  if (!branch) return { safe: false, outcome: 'nothing-to-remove' };
  if (!baseRef) return { safe: false, outcome: 'blocked', reason: 'indeterminate-base' };

  const ancestor = git.isAncestor(branch, baseRef);
  if (!ancestor) return { safe: false, outcome: 'blocked', reason: 'not-integrated' };
  return { safe: true, outcome: 'safe', baseRef };
}
