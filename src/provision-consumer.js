/**
 * aiDeck consumer provisioning (ONE shared consumer, Q10 model).
 *
 * The aiDeck v0.1 runtime keys CONSUMERS by `manifest.id` (consumer-registry
 * scans ~/.aideck/consumers/<dir>/manifest.yaml) and keys PROJECTS separately by
 * projectId (project-registry). A consumer's `root: project` dataSources resolve
 * per-project via /api/consumers/:id/projects/:projectId/data/:ds.
 *
 * So there is exactly ONE atomic-skills consumer — id `atomic-skills`,
 * mcpNamespace `atomic_skills`, title `Atomic Skills` — and every consuming repo
 * is registered as a *project* (the skill POSTs /api/projects/register, or
 * `aideck up` does it on launch). The dashboard scopes by the `:projectId` route
 * param. This replaces the former one-consumer-per-projectId stamping: with N
 * repos sharing one consumer, per-project ids would fragment the MCP namespace
 * and the consumer registry for no benefit (the project layer already scopes).
 *
 * Provisioning is therefore identity-free: copy the shipped template verbatim
 * into ~/.aideck/consumers/atomic-skills/. Idempotent + self-healing (fresh copy
 * each call). aiDeck never writes the repo's state — the Iron Law holds.
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

const HERE = dirname(fileURLToPath(import.meta.url));

// The single, canonical consumer identity (must match the shipped template's
// top-level id/mcpNamespace/title — re-stamped below so a drifted template can
// never deploy a consumer the skill's AIDECK_CONSUMER won't resolve).
export const CONSUMER_ID = 'atomic-skills';
export const CONSUMER_MCP_NAMESPACE = 'atomic_skills';
export const CONSUMER_TITLE = 'Atomic Skills';

/** Rewrite a top-level (column-0) `key:` line, leaving nested/indented keys + comments intact. */
function stampTopLevel(yaml, key, value) {
  const re = new RegExp(`^${key}:[ \\t].*$`, 'm');
  return yaml.replace(re, `${key}: ${value}`);
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

/**
 * Provision (idempotent) the single shared atomic-skills consumer.
 *
 * @param {object} [opts]
 * @param {string} [opts.templateDir]   shipped template dir (default: defaultTemplateDir())
 * @param {string} [opts.consumersDir]  aiDeck consumers root (default: ~/.aideck/consumers)
 * @returns {{ consumerId: string, dir: string, title: string, mcpNamespace: string }}
 */
export function provisionConsumer(opts = {}) {
  const templateDir = opts.templateDir ?? defaultTemplateDir();
  const consumersDir = opts.consumersDir ?? join(homedir(), '.aideck', 'consumers');

  const tmplManifest = join(templateDir, 'manifest.yaml');
  if (!existsSync(tmplManifest)) {
    throw new Error(`provisionConsumer: template manifest not found at ${tmplManifest}`);
  }

  // Fresh copy each time → idempotent and self-healing if a prior copy drifted.
  const dir = join(consumersDir, CONSUMER_ID);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(templateDir, dir, { recursive: true });

  // Re-stamp the canonical identity (defensive: pins the deployed consumer to the
  // exported constants regardless of template drift). No per-project values.
  let manifest = readFileSync(tmplManifest, 'utf8');
  manifest = stampTopLevel(manifest, 'id', CONSUMER_ID);
  manifest = stampTopLevel(manifest, 'mcpNamespace', CONSUMER_MCP_NAMESPACE);
  manifest = stampTopLevel(manifest, 'title', `'${CONSUMER_TITLE}'`);
  writeFileSync(join(dir, 'manifest.yaml'), manifest, 'utf8');

  return { consumerId: CONSUMER_ID, dir, title: CONSUMER_TITLE, mcpNamespace: CONSUMER_MCP_NAMESPACE };
}

// CLI: `node provision-consumer.js` — used by the project skill's `status`
// ensure-aideck flow. Prints the fixed consumer identity so the caller can set
// AIDECK_CONSUMER from it. Project registration (rootDir → projectId) is a
// separate runtime step (POST /api/projects/register), not this module's job.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const r = provisionConsumer();
    process.stdout.write(`CONSUMER_ID=${r.consumerId}\nCONSUMER_TITLE=${r.title}\nCONSUMER_NS=${r.mcpNamespace}\n`);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
