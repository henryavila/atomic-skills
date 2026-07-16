#!/usr/bin/env node
/**
 * migrate-layout.js — the flat → nested LAYOUT cut-over (R-MIG-20 / D7).
 *
 * Moves the legacy flat state layout
 *     <root>/plans/<slug>.md
 *     <root>/initiatives/<slug>.md
 * into the nested project layout (Decision #9 / R-ORCH-25)
 *     <root>/projects/<projectId>/<planSlug>/plan.md
 *     <root>/projects/<projectId>/<planSlug>/phases/f<N>-*.md
 * with standalone (orphan) initiatives wrapped into degenerate 1-phase plans.
 *
 * This is the deterministic, idempotent, COPY-VERIFY-DELETE transform the design
 * mandates for D7 — NOT an agent improvising file moves (01 §5). The pure move
 * planner lives in src/migrate.js:planLayoutMigration; this CLI is the I/O shell:
 *   1. read flat units from disk,
 *   2. plan the moves (pure),
 *   3. WRITE the nested copies,
 *   4. VERIFY them with the authoritative scripts/validate-state.js (subprocess),
 *   5. only on GREEN, DELETE the flat originals.
 * A verify failure aborts BEFORE any delete — the flat tree is left untouched.
 *
 * Because `.atomic-skills/` is gitignored (not git-restorable), the caller
 * (project-migrate.md / the D7 cut-over) MUST take a tar snapshot first.
 *
 * Usage:
 *   node scripts/migrate-layout.js [--root <dir>] [--project-id <id>] [--apply] [--json]
 *     --root         state dir (default $ATOMIC_SKILLS_DIR or `.atomic-skills`)
 *     --project-id   destination projects/<id>/ folder (inferred if omitted)
 *     --apply        perform the copy-verify-delete (default: dry-run preview)
 *     --json         machine-readable output
 */

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync,
  existsSync, statSync, rmSync,
} from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stringify as yamlStringify } from 'yaml';
import { parseFrontmatter } from './validate-state.js';
import { planLayoutMigration } from '../src/migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_STATE = join(__dirname, 'validate-state.js');

function parseArgs(argv) {
  const opts = { root: process.env.ATOMIC_SKILLS_DIR || '.atomic-skills', projectId: null, apply: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '--project-id') opts.projectId = argv[++i];
    else if (a.startsWith('--root=')) opts.root = a.slice('--root='.length);
    else if (a.startsWith('--project-id=')) opts.projectId = a.slice('--project-id='.length);
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

/**
 * Read every direct-child *.md under <root>/<sub> as a parsed unit.
 * Returns { units, aborts, skips }:
 *   - aborts: fatal preconditions (e.g. a non-empty archive/) — halt unconditionally.
 *   - skips:  files dropped because they don't parse / have no slug. A skipped flat
 *     file means the planner can't see the full reference graph, so an --apply MUST
 *     refuse (fail-closed) — never silently leave a referenced unit behind.
 */
function readUnits(rootAbs, sub) {
  const dir = join(rootAbs, sub);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { units: [], aborts: [], skips: [] };
  const units = [];
  const aborts = [];
  const skips = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (!statSync(p).isFile()) {
      // An `archive/` (or any) non-empty subdir is out of this migration's
      // scope — refuse to silently leave data behind.
      if (entry === 'archive' && statSync(p).isDirectory() && readdirSync(p).some((f) => f.endsWith('.md'))) {
        aborts.push(`${sub}/archive contains .md files — archive migration is out of scope (Inc7). Move them aside (in your snapshot) and re-run, or wait for Inc7.`);
      }
      continue;
    }
    if (!entry.endsWith('.md')) continue;
    const raw = readFileSync(p, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (parsed.error || !parsed.frontmatter) { skips.push(`${sub}/${entry}: ${parsed.error || 'no frontmatter'}`); continue; }
    const slug = parsed.frontmatter.slug;
    if (!slug) { skips.push(`${sub}/${entry}: frontmatter has no slug`); continue; }
    units.push({ slug, frontmatter: parsed.frontmatter, body: parsed.body, raw, sourceRel: `${sub}/${entry}` });
  }
  return { units, aborts, skips };
}

/**
 * Scan projects/<id>/<slug>/ for files that are NOT the canonical plan.md and
 * NOT under phases/ — i.e. pre-existing nested layout anomalies. Returns:
 *   - orphans:  legacy single-file `projects/<projectId>/<slug>/initiative.md`
 *     under the TARGET project → ingested as orphan units (wrapped into a 1-phase
 *     plan IN PLACE, then the initiative.md is deleted).
 *   - blockers: anything else (a bare initiative.md under a DIFFERENT project, or
 *     any other unrecognized top-level entity file) → refuse to cut over so the
 *     file is never silently stranded / invisible to validate-state + verify.
 * `source.md` (gitignored draft) and the `reviews/` subdir are recognized non-entity
 * artifacts and ignored.
 */
function readNestedStrays(rootAbs, projectId) {
  const orphans = [];
  const blockers = [];
  const projectsDir = join(rootAbs, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return { orphans, blockers };
  for (const id of readdirSync(projectsDir).sort()) {
    const idPath = join(projectsDir, id);
    if (!statSync(idPath).isDirectory()) continue;
    for (const slug of readdirSync(idPath).sort()) {
      const slugPath = join(idPath, slug);
      if (!statSync(slugPath).isDirectory()) continue;
      for (const entry of readdirSync(slugPath).sort()) {
        const p = join(slugPath, entry);
        if (!statSync(p).isFile() || !entry.endsWith('.md')) continue; // phases/, reviews/ are dirs
        if (entry === 'plan.md' || entry === 'source.md') continue;     // canonical / gitignored draft
        const rel = `projects/${id}/${slug}/${entry}`;
        if (entry !== 'initiative.md') { blockers.push(`unrecognized nested entity file ${rel} — not plan.md/phases/*; resolve before migrating`); continue; }
        if (id !== projectId) { blockers.push(`nested initiative.md ${rel} is under a different project than --project-id '${projectId}' — cross-project migration is out of scope; pass the matching --project-id or resolve it`); continue; }
        const parsed = parseFrontmatter(readFileSync(p, 'utf8'));
        if (parsed.error || !parsed.frontmatter) { blockers.push(`nested ${rel} does not parse: ${parsed.error || 'no frontmatter'}`); continue; }
        const fmSlug = parsed.frontmatter.slug;
        if (fmSlug && fmSlug !== slug) { blockers.push(`nested ${rel} has frontmatter slug '${fmSlug}' ≠ folder '${slug}'; resolve the mismatch (slugs are identity) before migrating`); continue; }
        // Ingest as an orphan unit; slug = folder name (placement authority).
        orphans.push({ slug, frontmatter: parsed.frontmatter, body: parsed.body, raw: parsed.body, sourceRel: rel });
      }
    }
  }
  return { orphans, blockers };
}

/**
 * Collect the frontmatter slugs of phase initiatives ALREADY present in the nested
 * tree (projects/<id>/<slug>/phases/*.md). Used so the planner's phase-coverage
 * check treats an already-migrated phase as covered during a recovery re-run (its
 * flat original may be gone). Read-only.
 */
function existingNestedPhaseSlugs(rootAbs) {
  const slugs = new Set();
  const projectsDir = join(rootAbs, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return slugs;
  for (const id of readdirSync(projectsDir)) {
    const idPath = join(projectsDir, id);
    if (!statSync(idPath).isDirectory()) continue;
    for (const slug of readdirSync(idPath)) {
      const phasesDir = join(idPath, slug, 'phases');
      if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) continue;
      for (const entry of readdirSync(phasesDir)) {
        const p = join(phasesDir, entry);
        if (!entry.endsWith('.md') || !statSync(p).isFile()) continue;
        const parsed = parseFrontmatter(readFileSync(p, 'utf8'));
        if (parsed.frontmatter && parsed.frontmatter.slug) slugs.add(parsed.frontmatter.slug);
      }
    }
  }
  return slugs;
}

/**
 * Resolve the destination project folder. Deterministic, and refuses to guess in
 * ambiguous state rather than silently retarget (which could split one project
 * across two folders). Returns null when it cannot safely infer.
 */
function inferProjectId(rootAbs) {
  const projectsDir = join(rootAbs, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    const dirs = readdirSync(projectsDir).filter((d) => statSync(join(projectsDir, d)).isDirectory());
    if (dirs.length === 1) return dirs[0];      // the established recovery case
    if (dirs.length >= 2) return null;          // ambiguous — caller must pass --project-id
  }
  return basename(dirname(rootAbs));            // first-ever migration: the repo folder name
}

/** Assemble the file content for one planned output. */
function assembleContent(rootAbs, out) {
  if (out.verbatim) return readFileSync(join(rootAbs, out.sourceRel), 'utf8');
  const body = String(out.body ?? '').replace(/^\n+/, '').replace(/\n*$/, '');
  return `---\n${yamlStringify(out.frontmatter)}---\n\n${body}\n`;
}

function log(json, human, obj) {
  if (json) process.stdout.write(JSON.stringify(obj) + '\n');
  else process.stdout.write(human + '\n');
}

/** A delete target is a "plan source" if it lives in plans/ or is a plan.md. */
function isPlanSource(rel) {
  return rel === 'plans' || rel.startsWith('plans/') || rel.endsWith('/plan.md') || rel === 'plan.md';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rootAbs = resolve(opts.root);
  if (!existsSync(rootAbs) || !statSync(rootAbs).isDirectory()) {
    console.error(`ERROR: state root not found or not a directory: ${rootAbs}`);
    process.exit(2);
  }

  // Resolve the destination project deterministically; refuse to guess if ambiguous.
  const projectId = opts.projectId || inferProjectId(rootAbs);
  if (!projectId) {
    console.error(`ERROR: cannot infer --project-id: projects/ holds multiple folders. Re-running without an explicit --project-id risks splitting one project across folders. Pass --project-id <id> (the folder your prior run targeted).`);
    process.exit(2);
  }

  const planRead = readUnits(rootAbs, 'plans');
  const initRead = readUnits(rootAbs, 'initiatives');
  const nested = readNestedStrays(rootAbs, projectId);

  // Hard aborts (non-empty archive) halt unconditionally, even in dry-run.
  const hardAborts = [...planRead.aborts, ...initRead.aborts];
  if (hardAborts.length) {
    for (const a of hardAborts) console.error(`ABORT: ${a}`);
    process.exit(2);
  }

  let plan;
  try {
    plan = planLayoutMigration(
      { plans: planRead.units, initiatives: [...initRead.units, ...nested.orphans] },
      { projectId, nowIso: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), existingPhaseSlugs: existingNestedPhaseSlugs(rootAbs) },
    );
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  const warnings = [...plan.warnings];
  // Blockers make an --apply UNSAFE. A skipped flat file (parse error / no slug)
  // means the planner could not see the full reference graph → fail-closed.
  const skipBlockers = [...planRead.skips, ...initRead.skips].map((s) => `flat file skipped (parse/no-slug): ${s} — cannot safely migrate a tree with an unreadable unit`);
  const blockers = [...skipBlockers, ...nested.blockers, ...plan.blockers];

  if (plan.outputs.length === 0 && blockers.length === 0) {
    log(opts.json, `Nothing to migrate — no flat plans/initiatives under ${rootAbs} (already nested?).`,
      { migrated: false, reason: 'no-flat-units', root: rootAbs, projectId, warnings });
    process.exit(0);
  }

  // ── PREVIEW ──
  const summary = {
    root: rootAbs,
    projectId,
    apply: opts.apply,
    outputs: plan.outputs.map((o) => ({ from: o.sourceRel || '(synthesized)', to: o.relPath, kind: o.kind, slug: o.slug })),
    deletes: plan.deletes,
    orphans: plan.orphans,
    warnings,
    blockers,
  };
  if (!opts.json) {
    process.stdout.write(`\nLayout migration plan  (root=${rootAbs}, projectId=${projectId}, mode=${opts.apply ? 'APPLY' : 'dry-run'})\n\n`);
    for (const o of summary.outputs) process.stdout.write(`  ${o.from}  →  ${o.to}  [${o.kind}]\n`);
    if (plan.orphans.length) process.stdout.write(`\n  orphans wrapped as 1-phase plans: ${plan.orphans.join(', ')}\n`);
    if (warnings.length) { process.stdout.write('\n  warnings:\n'); for (const w of warnings) process.stdout.write(`    - ${w}\n`); }
    if (blockers.length) { process.stdout.write('\n  BLOCKERS (must resolve before --apply):\n'); for (const b of blockers) process.stdout.write(`    ✖ ${b}\n`); }
  }

  if (!opts.apply) {
    log(opts.json, `\nDry-run only — no files written.${blockers.length ? ` ${blockers.length} blocker(s) would prevent --apply.` : ' Re-run with --apply to perform the copy-verify-delete.'}`, { ...summary, migrated: false });
    process.exit(0);
  }

  // ── FAIL-CLOSED GATE ── under --apply, refuse if anything is unaccounted for.
  // The cut-over is irreversible on gitignored state, so a partial/incomplete
  // migration is never acceptable: halt BEFORE writing or deleting anything.
  if (blockers.length) {
    console.error(`\n✖ REFUSING TO APPLY — ${blockers.length} blocker(s) make the cut-over unsafe (nothing written, nothing deleted):`);
    for (const b of blockers) console.error(`    ✖ ${b}`);
    process.exit(2);
  }

  // ── COPY ── write every nested output first; flat originals stay untouched.
  const writtenAbs = [];
  for (const out of plan.outputs) {
    const destAbs = join(rootAbs, out.relPath);
    mkdirSync(dirname(destAbs), { recursive: true });
    writeFileSync(destAbs, assembleContent(rootAbs, out));
    writtenAbs.push(destAbs);
  }

  // ── VERIFY ── validate nested files we just wrote PLUS any pre-existing
  // phases/ siblings under those plans (recovery: a prior partial run may have
  // already nested some phases whose flat originals are gone). Without those
  // siblings, crossValidate flags done/active phases as missing-initiative even
  // though the initiative is already correctly nested on disk. Authoritative:
  // the same scripts/validate-state.js the whole system (husky, `project verify`) uses.
  const verifyAbs = new Set(writtenAbs);
  for (const out of plan.outputs) {
    if (out.kind !== 'plan') continue;
    const phasesDir = join(rootAbs, dirname(out.relPath), 'phases');
    if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) continue;
    for (const entry of readdirSync(phasesDir)) {
      if (!entry.endsWith('.md')) continue;
      const phaseAbs = join(phasesDir, entry);
      if (statSync(phaseAbs).isFile()) verifyAbs.add(phaseAbs);
    }
  }
  try {
    execFileSync('node', [VALIDATE_STATE, ...verifyAbs], { stdio: opts.json ? 'pipe' : 'inherit' });
  } catch {
    console.error(`\n✖ VERIFY FAILED — the migrated nested tree did not validate. Flat originals were NOT deleted; the nested copies remain for inspection. Roll back from your tar snapshot if needed, then re-run after fixing.`);
    process.exit(1);
  }

  // ── DELETE ── only now remove the flat originals. Order matters for crash
  // recovery: delete phase/initiative sources BEFORE their parent plan source, so
  // a crash mid-delete can never leave a plan gone with its phases still flat
  // (which a recovery re-plan would mis-wrap as standalone orphans).
  const orderedDeletes = [...plan.deletes].sort((a, b) => (isPlanSource(a) ? 1 : 0) - (isPlanSource(b) ? 1 : 0));
  for (const rel of orderedDeletes) {
    const p = join(rootAbs, rel);
    if (existsSync(p)) rmSync(p);
  }
  // Prune now-empty flat dirs (archive children first, then the parents).
  for (const sub of ['plans/archive', 'initiatives/archive', 'plans', 'initiatives']) {
    const d = join(rootAbs, sub);
    try {
      if (existsSync(d) && statSync(d).isDirectory() && readdirSync(d).length === 0) rmSync(d, { recursive: true });
    } catch { /* leave anything non-empty */ }
  }

  // ── FINAL CONFIRM ── re-validate the whole root now that flat is gone.
  let finalOk = true;
  try {
    execFileSync('node', [VALIDATE_STATE, rootAbs], { stdio: opts.json ? 'pipe' : 'inherit' });
  } catch {
    finalOk = false;
  }

  log(opts.json,
    finalOk
      ? `\n✓ Migrated ${plan.outputs.length} file(s) into projects/${projectId}/ and removed ${plan.deletes.length} flat original(s). Full-tree validate-state GREEN.`
      : `\n✖ PARTIAL — wrote ${writtenAbs.length} file(s) and deleted ${plan.deletes.length} original(s), but the post-delete full-tree validate-state did NOT pass. Inspect immediately and roll back from your tar snapshot if needed.`,
    { ...summary, migrated: finalOk, written: writtenAbs.length, deleted: plan.deletes.length, finalValidateOk: finalOk });
  process.exit(finalOk ? 0 : 1);
}

main();
