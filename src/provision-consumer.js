/**
 * Per-project aiDeck consumer provisioning.
 *
 * The aiDeck dashboard surfaces `.atomic-skills/` state through a "consumer"
 * (a manifest + schema + handlers under `~/.aideck/consumers/<id>/`). aiDeck
 * keys each consumer by its `manifest.id` (consumer-registry scans the dir and
 * registers `result.value.id`), and the dashboard URL / breadcrumb are that id.
 *
 * The identity a user sees MUST be the project that uses the skill — not a fixed
 * "atomic-skills" / "Project Status". So instead of shipping one global consumer
 * verbatim, we ship a TEMPLATE and stamp a per-project copy lazily (at `status`
 * time, when PWD = the consuming repo and the projectId is concrete): consumer
 * `id` = projectId, `title` = humanized projectId. Running the skill in repo
 * `foo` yields `~/.aideck/consumers/foo/` titled "Foo".
 *
 * This module is the single, replicable mechanism + its regression surface.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A projectId slug ("acme-api") → a human display title ("Acme Api"). */
export function humanizeProjectId(projectId) {
  return String(projectId)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * A projectId → an aiDeck mcpNamespace ([a-z][a-z0-9_]{0,31}). The MCP tool name
 * is `aideck_<mcpNamespace>_<tool>`, so per-project consumers MUST carry distinct
 * namespaces or their tools collide in the shared registry. Derived from the pid
 * (dashes→underscores), letter-prefixed if needed, capped at 32 chars.
 * "atomic-skills" → "atomic_skills" (unchanged from the legacy value).
 *
 * Two distinct ids that share the same first 32 sanitized chars would truncate
 * to the SAME namespace and collide in the shared MCP registry (F-004). When —
 * and only when — truncation is needed, the tail is replaced by a short
 * deterministic hash of the FULL sanitized ns (25 prefix chars + '_' + 6 hex =
 * 32), so long ids stay distinct while short ids keep their exact legacy value.
 */
export function sanitizeMcpNamespace(projectId) {
  let ns = String(projectId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(ns)) ns = `as_${ns}`;
  if (ns.length <= 32) return ns;
  const hash = createHash('sha1').update(ns).digest('hex').slice(0, 6); // [0-9a-f] ⊂ [a-z0-9]
  return `${ns.slice(0, 25)}_${hash}`;
}

/**
 * Rewrite ONLY the top-level (column-0) `id:` and `title:` keys of a consumer
 * manifest, leaving every nested `title:` (page/section/widget) and all comments
 * untouched. Anchored to start-of-line so indented keys never match.
 */
export function stampIdTitle(yaml, id, title) {
  let out = yaml.replace(/^id:[ \t].*$/m, `id: ${id}`);
  out = out.replace(/^title:[ \t].*$/m, `title: '${String(title).replace(/'/g, "''")}'`);
  return out;
}

/** Rewrite the top-level `mcpNamespace:` key (column-0 only). */
export function stampMcpNamespace(yaml, ns) {
  return yaml.replace(/^mcpNamespace:[ \t].*$/m, `mcpNamespace: ${ns}`);
}

/**
 * Set the top-level `rootDir:` key to the consuming repo's absolute path. aiDeck
 * reads this to AUTO-REGISTER the project on every scan (so the consumer→project
 * binding survives a restart without the skill re-registering) and to SCOPE
 * `/api/consumers/<id>/projects` to this project only — never another consumer's.
 * The template carries no `rootDir:` line, so insert one right after the
 * column-0 `id:` line; if a line already exists (re-provision), replace it.
 * Single quotes are YAML-escaped (`'` → `''`), matching stampIdTitle.
 */
export function stampRootDir(yaml, rootDir) {
  const line = `rootDir: '${String(rootDir).replace(/'/g, "''")}'`;
  if (/^rootDir:[ \t].*$/m.test(yaml)) {
    return yaml.replace(/^rootDir:[ \t].*$/m, line);
  }
  return yaml.replace(/^(id:[ \t].*)$/m, `$1\n${line}`);
}

/**
 * Resolve the shipped consumer template directory. Works whether this module is
 * loaded from the package `src/` (sibling `../assets/aideck-consumer`) or from
 * the installed runtime `~/.atomic-skills/src/` (sibling `../aideck-consumer`).
 */
export function defaultTemplateDir() {
  for (const c of [
    join(HERE, '..', 'assets', 'aideck-consumer'),
    join(HERE, '..', 'aideck-consumer'),
  ]) {
    if (existsSync(join(c, 'manifest.yaml'))) return c;
  }
  // Fall back to the package layout even if missing, so the caller gets a clear
  // "template manifest not found at <path>" error pointing at the expected spot.
  return join(HERE, '..', 'assets', 'aideck-consumer');
}

const VALID_PROJECT_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Provision (idempotent) a per-project consumer whose id + title ARE the
 * consuming project. Copies the template, then stamps id/title.
 *
 * @param {string} projectId            normalized repo slug (basename, lowercased)
 * @param {object} [opts]
 * @param {string} [opts.templateDir]   shipped template dir (default: defaultTemplateDir())
 * @param {string} [opts.consumersDir]  aiDeck consumers root (default: ~/.aideck/consumers)
 * @param {string} [opts.title]         override display title (default: humanized projectId)
 * @param {string} [opts.rootDir]       absolute path of the consuming repo; stamped into the
 *                                      manifest so aiDeck auto-registers + scopes its project
 * @returns {{ consumerId: string, dir: string, title: string, mcpNamespace: string, rootDir: string|undefined }}
 */
export function provisionConsumer(projectId, opts = {}) {
  if (typeof projectId !== 'string' || !VALID_PROJECT_ID.test(projectId)) {
    throw new Error(
      `provisionConsumer: invalid projectId ${JSON.stringify(projectId)} (expected slug [a-z0-9-])`,
    );
  }
  const templateDir = opts.templateDir ?? defaultTemplateDir();
  const consumersDir = opts.consumersDir ?? join(homedir(), '.aideck', 'consumers');
  const title = opts.title ?? humanizeProjectId(projectId);

  const tmplManifest = join(templateDir, 'manifest.yaml');
  if (!existsSync(tmplManifest)) {
    throw new Error(`provisionConsumer: template manifest not found at ${tmplManifest}`);
  }

  // Fresh copy each time → idempotent and self-healing if a prior copy drifted.
  const dir = join(consumersDir, projectId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(templateDir, dir, { recursive: true });

  const mcpNamespace = opts.mcpNamespace ?? sanitizeMcpNamespace(projectId);
  let stamped = stampIdTitle(readFileSync(tmplManifest, 'utf8'), projectId, title);
  stamped = stampMcpNamespace(stamped, mcpNamespace);
  // Stamp the bound rootDir so aiDeck auto-registers + scopes this consumer's
  // project (durable consumer→project binding). Absent → a generic consumer.
  if (opts.rootDir) stamped = stampRootDir(stamped, opts.rootDir);
  writeFileSync(join(dir, 'manifest.yaml'), stamped, 'utf8');

  return { consumerId: projectId, dir, title, mcpNamespace, rootDir: opts.rootDir };
}

// CLI: `node provision-consumer.js <projectId> [title]` — used by the project
// skill's `status` ensure-aideck flow. Prints the resolved consumer id so the
// caller can set AIDECK_CONSUMER from it.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , projectId, title] = process.argv;
  try {
    // cwd IS the consuming repo (the skill runs this from the repo root), so it
    // is the rootDir aiDeck binds the project to. Stamping it makes the
    // consumer→project binding durable + scoped (no re-register needed).
    const r = provisionConsumer(projectId, { rootDir: process.cwd(), ...(title ? { title } : {}) });
    process.stdout.write(`CONSUMER_ID=${r.consumerId}\nCONSUMER_TITLE=${r.title}\nCONSUMER_ROOTDIR=${r.rootDir}\n`);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
