#!/usr/bin/env node
/**
 * automate-phase-run.js — Layer 3 host-local runner for pure-maestro Step C.
 *
 * Subcommands:
 *   prepare   — work-order + lease + sibling WT + sealed brief + spawn instructions
 *   validate  — claim-report parse/validate + merge command print
 *
 * Does NOT spawn subagents, call done/phase-done, or nest worktrees under the
 * plan worktree. Never writes lease secrets to disk beyond tokenHash (lease
 * module) — prepare prints secret only to stdout once for host memory.
 *
 * Usage:
 *   node scripts/automate-phase-run.js prepare --plan <slug> --phase <id> [options]
 *   node scripts/automate-phase-run.js validate --plan <slug> --claim-report <path> [options]
 *
 * Options (prepare):
 *   --project <id>
 *   --state-root <path>     default ./.atomic-skills
 *   --status-root <path>    default <state-root>/status
 *   --plan-worktree <path>  default cwd
 *   --repo-root <path>
 *   --initiative <path>     phase initiative markdown (YAML frontmatter)
 *   --worktree-path <path>  override sibling WT path
 *   --writer-branch <name>
 *   --base-ref <sha>
 *   --host-id <id>
 *   --skip-worktree         do not run git worktree add (tests / pre-cut WT)
 *   --claim-report <path>
 *   --sealed-brief <path>
 *   --json                  machine-readable result (secret omitted unless --print-secret)
 *   --print-secret          include lease secret once in JSON/stdout (default text mode prints it)
 *
 * Options (validate):
 *   --claim-report <path>   required
 *   --check-reachability
 *   --reachable-file <path>
 *   --plan-branch <name>
 *   --writer-branch <name>
 *   --worktree-path <path>
 *   --json
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  preparePhaseRun,
  validatePhaseClaims,
  findInitiativePath,
} from '../src/automate-phase-run-lib.js';
import { parseFrontmatter } from './validate-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HELP = `automate-phase-run — Layer 3 host-local prepare/validate (no spawn, no done)

Usage:
  node scripts/automate-phase-run.js prepare --plan <slug> --phase <id> [options]
  node scripts/automate-phase-run.js validate --claim-report <path> [options]
  node scripts/automate-phase-run.js --help

prepare: build work-order, acquire lease, cut sibling worktree, write sealed brief.
validate: validate claim report; print merge commands.

Exit 0 only on ok. Lease secret printed once on prepare (hold in memory; never commit).
`;

/**
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    if (
      a === '--check-reachability' ||
      a === '--skip-worktree' ||
      a === '--json' ||
      a === '--print-secret'
    ) {
      out[flagKey(a.slice(2))] = true;
      continue;
    }
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      out[flagKey(a.slice(2, eq))] = a.slice(eq + 1);
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) {
        out[flagKey(key)] = true;
        continue;
      }
      out[flagKey(key)] = next;
      i++;
      continue;
    }
    if (!out._cmd) {
      out._cmd = a;
    }
  }
  return out;
}

/** @param {string} key */
function flagKey(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Resolve plan.md under state root (nested projects only + flat fallback).
 * @param {string} stateRoot
 * @param {string} planSlug
 * @param {string | null} projectFilter
 */
export function resolvePlanFile(stateRoot, planSlug, projectFilter = null) {
  const raw = String(planSlug || '').trim();
  if (!raw) return { error: 'missing --plan' };
  let wantProject = projectFilter != null ? String(projectFilter).trim() : '';
  let wantSlug = raw;
  if (raw.includes('/')) {
    const parts = raw.split('/').filter(Boolean);
    if (parts.length >= 2) {
      wantProject = wantProject || parts[0];
      wantSlug = parts[parts.length - 1];
    }
  }
  /** @type {Array<{ planFile: string, projectId: string, slug: string, fm: object }>} */
  const matches = [];
  const projectsDir = join(stateRoot, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      if (wantProject && projId !== wantProject) continue;
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const entry of readdirSync(projPath)) {
        const planDir = join(projPath, entry);
        if (!statSync(planDir).isDirectory()) continue;
        const planFile = join(planDir, 'plan.md');
        if (!existsSync(planFile)) continue;
        let fm;
        try {
          const parsed = parseFrontmatter(readFileSync(planFile, 'utf8'));
          if (parsed.error || !parsed.frontmatter) continue;
          fm = parsed.frontmatter;
        } catch {
          continue;
        }
        const slug =
          fm.slug != null && String(fm.slug).trim() !== ''
            ? String(fm.slug).trim()
            : entry;
        if (slug !== wantSlug && entry !== wantSlug) continue;
        matches.push({ planFile, projectId: projId, slug, fm });
      }
    }
  }
  if (matches.length === 0) {
    return { error: `plan not found for slug "${wantSlug}" under ${stateRoot}` };
  }
  if (matches.length > 1 && !wantProject) {
    return {
      error: `ambiguous plan slug "${wantSlug}" — pass --project`,
    };
  }
  return matches[0];
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string }} [opts]
 */
export function runAutomatePhaseRun(argv, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const args = parseArgs(argv);
  if (args.help || !args._cmd) {
    return { ok: true, exitCode: 0, message: HELP };
  }
  const cmd = String(args._cmd).toLowerCase();

  if (cmd === 'prepare') {
    return runPrepare(args, cwd);
  }
  if (cmd === 'validate') {
    return runValidate(args, cwd);
  }
  return {
    ok: false,
    exitCode: 1,
    message: `blocked: unknown subcommand "${cmd}" (use prepare|validate)`,
  };
}

/**
 * @param {Record<string, string | boolean>} args
 * @param {string} cwd
 */
function runPrepare(args, cwd) {
  const planArg = args.plan != null && args.plan !== true ? String(args.plan) : '';
  const phaseId =
    args.phase != null && args.phase !== true
      ? String(args.phase)
      : args.phaseId != null && args.phaseId !== true
        ? String(args.phaseId)
        : '';
  if (!planArg || !phaseId) {
    return {
      ok: false,
      exitCode: 1,
      message: 'blocked: prepare requires --plan <slug> and --phase <id>',
    };
  }

  const stateRoot = resolve(
    cwd,
    args.stateRoot != null && args.stateRoot !== true
      ? String(args.stateRoot)
      : '.atomic-skills',
  );
  const statusRoot = resolve(
    cwd,
    args.statusRoot != null && args.statusRoot !== true
      ? String(args.statusRoot)
      : join(stateRoot, 'status'),
  );
  const planWorktreePath = resolve(
    cwd,
    args.planWorktree != null && args.planWorktree !== true
      ? String(args.planWorktree)
      : cwd,
  );
  const projectFilter =
    args.project != null && args.project !== true ? String(args.project) : null;

  let initiative = null;
  let initiativePath =
    args.initiative != null && args.initiative !== true
      ? resolve(cwd, String(args.initiative))
      : null;
  let projectId = projectFilter;
  let decisionLogPath = null;

  // Load plan + initiative when state root has inventory
  if (existsSync(stateRoot)) {
    const resolved = resolvePlanFile(stateRoot, planArg, projectFilter);
    if (!resolved.error) {
      projectId = resolved.projectId;
      if (!initiativePath) {
        initiativePath = findInitiativePath(
          resolved.planFile,
          resolved.fm,
          phaseId,
        );
      }
      decisionLogPath = join(
        dirname(resolved.planFile),
        'decisions',
        `${phaseId}.jsonl`,
      );
    }
  }

  if (initiativePath && existsSync(initiativePath)) {
    try {
      const parsed = parseFrontmatter(readFileSync(initiativePath, 'utf8'));
      if (!parsed.error && parsed.frontmatter) {
        initiative = parsed.frontmatter;
      }
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: cannot read initiative: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (initiative == null) {
    return {
      ok: false,
      exitCode: 1,
      message:
        'blocked: prepare requires initiative with SPEC-admitted tasks (--initiative path or nested phase under plan)',
    };
  }

  const r = preparePhaseRun({
    statusRoot,
    planSlug:
      typeof initiative.parentPlan === 'string' && initiative.parentPlan.trim()
        ? initiative.parentPlan.trim()
        : planArg.includes('/')
          ? planArg.split('/').filter(Boolean).pop()
          : planArg,
    phaseId,
    hostId:
      args.hostId != null && args.hostId !== true
        ? String(args.hostId)
        : 'host-local',
    planWorktreePath,
    repoRoot:
      args.repoRoot != null && args.repoRoot !== true
        ? resolve(cwd, String(args.repoRoot))
        : null,
    initiative,
    initiativePath,
    projectId,
    decisionLogPath,
    worktreePath:
      args.worktreePath != null && args.worktreePath !== true
        ? resolve(cwd, String(args.worktreePath))
        : null,
    writerBranch:
      args.writerBranch != null && args.writerBranch !== true
        ? String(args.writerBranch)
        : null,
    baseRef:
      args.baseRef != null && args.baseRef !== true ? String(args.baseRef) : null,
    claimReportPath:
      args.claimReport != null && args.claimReport !== true
        ? resolve(cwd, String(args.claimReport))
        : null,
    sealedBriefPath:
      args.sealedBrief != null && args.sealedBrief !== true
        ? resolve(cwd, String(args.sealedBrief))
        : null,
    skipWorktree: args.skipWorktree === true,
  });

  if (!r.ok) return r;

  if (args.json === true) {
    const payload = {
      ok: true,
      ...r.result,
      // omit brief body in json by default (path is enough); keep spawnInstructions
      brief: undefined,
    };
    delete payload.brief;
    if (args.printSecret !== true) {
      delete payload.leaseSecret;
    }
    return {
      ok: true,
      exitCode: 0,
      message: JSON.stringify(payload, null, 2),
      result: r.result,
    };
  }

  const lines = [
    'ok',
    `sealedBriefPath: ${r.result.sealedBriefPath}`,
    `claimReportPath: ${r.result.claimReportPath}`,
    `worktreePath: ${r.result.worktreePath}`,
    `writerBranch: ${r.result.writerBranch}`,
    `baseRef: ${r.result.baseRef}`,
    `leasePath: ${r.result.leasePath}`,
    `leaseSecret: ${r.result.leaseSecret}`,
    '',
    r.result.spawnInstructions,
  ];
  return {
    ok: true,
    exitCode: 0,
    message: lines.join('\n'),
    result: r.result,
  };
}

/**
 * @param {Record<string, string | boolean>} args
 * @param {string} cwd
 */
function runValidate(args, cwd) {
  const claimPath =
    args.claimReport != null && args.claimReport !== true
      ? resolve(cwd, String(args.claimReport))
      : null;
  if (!claimPath) {
    return {
      ok: false,
      exitCode: 1,
      message: 'blocked: validate requires --claim-report <path>',
    };
  }

  /** @type {Set<string> | null} */
  let reachableSet = null;
  if (args.checkReachability === true) {
    const rf =
      args.reachableFile != null && args.reachableFile !== true
        ? resolve(cwd, String(args.reachableFile))
        : null;
    if (!rf || !existsSync(rf)) {
      return {
        ok: false,
        exitCode: 1,
        message:
          'blocked: --check-reachability requires --reachable-file with newline-separated SHAs',
      };
    }
    reachableSet = new Set(
      readFileSync(rf, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    );
  }

  const r = validatePhaseClaims({
    claimReportPath: claimPath,
    checkReachability: args.checkReachability === true,
    reachableSet,
    planBranch:
      args.planBranch != null && args.planBranch !== true
        ? String(args.planBranch)
        : null,
    writerBranch:
      args.writerBranch != null && args.writerBranch !== true
        ? String(args.writerBranch)
        : null,
    worktreePath:
      args.worktreePath != null && args.worktreePath !== true
        ? String(args.worktreePath)
        : null,
    planSlug:
      args.plan != null && args.plan !== true ? String(args.plan) : null,
    phaseId:
      args.phase != null && args.phase !== true ? String(args.phase) : null,
  });

  if (!r.ok) return r;

  if (args.json === true) {
    return {
      ok: true,
      exitCode: 0,
      message: JSON.stringify(
        {
          ok: true,
          claimValidation: r.result.claimValidation,
          mergeCommands: r.result.mergeCommands,
          writerBranch: r.result.writerBranch,
          planBranch: r.result.planBranch,
          worktreePath: r.result.worktreePath,
        },
        null,
        2,
      ),
      result: r.result,
    };
  }

  return {
    ok: true,
    exitCode: 0,
    message: ['ok', '', r.result.mergeCommands].join('\n'),
    result: r.result,
  };
}

function main() {
  const r = runAutomatePhaseRun(process.argv.slice(2), {
    cwd: process.cwd(),
  });
  process.stdout.write(`${r.message}\n`);
  process.exit(r.exitCode);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
