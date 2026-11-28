import { readFileSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, sep as PATH_SEP } from 'node:path';
import { SKILL_NAMESPACE, LEGACY_NAMESPACE_PATHS } from './config.js';

/**
 * Names that have historically been atomic-skills artifacts and are safe to
 * delete from legacy paths. F-002 (codex review 2026-05-24): without this
 * safelist, `--yes` cleanup would silently delete ANY file at a legacy
 * namespace path, including user-owned custom skills the user happened to
 * place under our namespace. Frontmatter-based safelist preserves those.
 *
 * Add removed skill names here when consolidating (so post-removal cleanups
 * still recognize the artifact as ours). Pre-1.x `as-` prefix is included.
 */
const HISTORICAL_ATOMIC_SKILLS_NAMES = new Set([
  // Removed in v2.0.0 consolidation
  'review-plan-internal', 'review-plan-vs-artifacts',
  'review-plan-with-codex', 'review-code-with-codex',
  // Removed in v2.0.0 consolidation (project-status + project-plan → project)
  'project-status', 'project-plan',
  // Removed: plan lifecycle and the implement driver
  'project', 'implement',
  // Pre-1.x prefix (original `as-` form, deprecated)
  'as-fix', 'as-hunt', 'as-prompt', 'as-save-and-push', 'as-init-memory',
  // Namespace root SKILL.md
  SKILL_NAMESPACE,
]);

/**
 * F-002 (review): inspect frontmatter for an atomic-skills signature.
 * Returns true if the file's first frontmatter block has a `name:` field
 * that matches a known atomic-skills name (current catalog or historical).
 * Files without atomic-skills shape are preserved during legacy cleanup.
 */
export function isAtomicSkillsArtifact(filePath, knownCurrentNames) {
  let head;
  try {
    head = readFileSync(filePath, 'utf8').slice(0, 4096);
  } catch {
    // Unreadable file → conservative: preserve.
    return false;
  }
  if (!head.startsWith('---\n')) return false;
  const end = head.indexOf('\n---\n', 4);
  if (end < 0) return false;
  const fm = head.slice(4, end);
  const m = fm.match(/^name:\s*['"]?([a-z][a-z0-9-]*)['"]?\s*$/m);
  if (!m) return false;
  const name = m[1];
  return knownCurrentNames.has(name) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(name);
}

/**
 * P1-A: package leftover at a desired path under our namespace.
 * Command files often lack `name:` (only `description:`) so isAtomicSkillsArtifact
 * alone misses them. Eligible when:
 *   - path is under the atomic-skills namespace segment, AND
 *   - content starts with YAML frontmatter, AND
 *   - basename (or parent dir for SKILL.md) matches a known/historical skill name.
 *
 * Foreign user files without frontmatter or with unrelated basenames stay unmanaged.
 *
 * @param {string} filePath absolute path
 * @param {string} relPath relative desired path
 * @param {Set<string>} knownCurrentNames
 * @returns {boolean}
 */
export function isAtomicSkillsNamespaceLeftover(filePath, relPath, knownCurrentNames) {
  if (typeof relPath !== 'string' || !relPath.includes(SKILL_NAMESPACE)) return false;
  let head;
  try {
    head = readFileSync(filePath, 'utf8').slice(0, 256);
  } catch {
    return false;
  }
  if (!head.startsWith('---\n') && !head.startsWith('---\r\n')) return false;
  const base = basename(relPath);
  const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  if (stem === 'SKILL') {
    const parent = basename(dirname(relPath));
    return knownCurrentNames.has(parent) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(parent);
  }
  // Namespace root or asset paths are package-owned when frontmatter-shaped.
  if (stem === SKILL_NAMESPACE || stem.startsWith('_') || relPath.includes('/_assets/')) {
    return true;
  }
  return knownCurrentNames.has(stem) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(stem);
}

/**
 * Scan obsolete install paths (see LEGACY_NAMESPACE_PATHS) for any file
 * still living under the atomic-skills namespace. These are invisible to
 * the manifest-based orphan detector because they predate the current
 * IDE_CONFIG. Returns [{path, legacyRoot, reason, safe}].
 *
 * `safe: true` means the file's frontmatter identifies it as a known
 * atomic-skills artifact (current or historical). `safe: false` means
 * the file is at the legacy path but does not look like an atomic-skills
 * artifact — likely user-owned, preserve it.
 */
export function findLegacyOrphans(basePath, knownCurrentNames = new Set()) {
  const found = [];
  for (const { dir, reason, prefixed } of LEGACY_NAMESPACE_PATHS) {
    const parentDir = join(basePath, dir);
    if (!existsSync(parentDir)) continue;

    // 1. Nested namespace root: <dir>/atomic-skills/...
    const nsRoot = join(parentDir, SKILL_NAMESPACE);
    if (existsSync(nsRoot)) {
      const walk = (cur) => {
        for (const entry of readdirSync(cur, { withFileTypes: true })) {
          const full = join(cur, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile()) {
            const safe = isAtomicSkillsArtifact(full, knownCurrentNames);
            found.push({ path: full, legacyRoot: nsRoot, reason, safe });
          }
        }
      };
      walk(nsRoot);
    }

    // 2. Prefixed sibling entries: <dir>/atomic-skills-* (e.g. legacy Gemini CLI skills/commands)
    if (prefixed) {
      try {
        for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
          if (entry.name === SKILL_NAMESPACE) continue;
          if (entry.name.startsWith(`${SKILL_NAMESPACE}-`)) {
            const full = join(parentDir, entry.name);
            if (entry.isDirectory()) {
              const walk = (cur) => {
                for (const sub of readdirSync(cur, { withFileTypes: true })) {
                  const subFull = join(cur, sub.name);
                  if (sub.isDirectory()) walk(subFull);
                  else if (sub.isFile()) {
                    const safe = isAtomicSkillsArtifact(subFull, knownCurrentNames);
                    found.push({ path: subFull, legacyRoot: full, reason, safe });
                  }
                }
              };
              walk(full);
            } else if (entry.isFile()) {
              const safe = isAtomicSkillsArtifact(full, knownCurrentNames);
              found.push({ path: full, legacyRoot: full, reason, safe });
            }
          }
        }
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
  }
  return found;
}

/**
 * Delete each legacy-orphan file, then walk back up removing empty parents
 * until (and including) the namespace root. Never touches dirs above the
 * namespace root (e.g. .claude/skills/ itself may be co-owned with other
 * tools and is left in place).
 */
export function removeLegacyOrphans(basePath, orphans) {
  const nsRootsSeen = new Set();
  for (const { path: full, legacyRoot } of orphans) {
    try {
      unlinkSync(full);
    } catch (err) {
      // E1 (review 2026-05-24): surface deletion failures so the user knows
      // the cleanup was partial. Skip the parent walkback on failure too.
      console.warn(`[atomic-skills] could not remove legacy orphan ${full}: ${err.message}`);
      continue;
    }
    nsRootsSeen.add(legacyRoot);
    let parent = dirname(full);
    // L1 (review 2026-05-24): path-aware boundary check. A bare `startsWith`
    // would match `<legacyRoot>-sibling/...` directories with a common prefix.
    // Walk up only inside the namespace root (and stop AT the root).
    const legacyRootWithSep = legacyRoot + PATH_SEP;
    while (parent !== legacyRoot && parent.startsWith(legacyRootWithSep)) {
      try {
        if (readdirSync(parent).length === 0) {
          rmdirSync(parent);
          parent = dirname(parent);
        } else break;
      } catch { break; }
    }
  }
  // Try to remove each namespace root if it's now empty (siblings may have
  // been emptied by this call); the parent legacy dir is intentionally left.
  for (const nsRoot of nsRootsSeen) {
    try {
      if (readdirSync(nsRoot).length === 0) rmdirSync(nsRoot);
    } catch { /* Best-effort prune; a sibling or race may keep the root. */ }
  }
}
