#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';

import { collectTargets, parseFrontmatter } from './validate-state.js';

const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const projectIdOf = (value) => text(value?.__projectId) ?? '__legacy';

function migrationError(code, message, context = {}) {
  return { code, message, ...context };
}

export function planStateIntegrityMigration(planFrontmatters, initiativeFrontmatters) {
  const plans = [...planFrontmatters.values()].filter(Boolean);
  const changes = [];
  const errors = [];

  for (const [key, initiative] of initiativeFrontmatters) {
    const missingParent = !text(initiative?.parentPlan);
    const missingPhase = !text(initiative?.phaseId);
    if (!missingParent && !missingPhase) continue;
    const candidates = [];
    for (const plan of plans) {
      if (projectIdOf(plan) !== projectIdOf(initiative)) continue;
      if (text(initiative.parentPlan) && text(initiative.parentPlan) !== text(plan.slug)) continue;
      for (const phase of Array.isArray(plan.phases) ? plan.phases : []) {
        if (text(initiative.phaseId) && text(initiative.phaseId) !== text(phase?.id)) continue;
        if (text(initiative.slug) !== text(phase?.slug)) continue;
        candidates.push({ plan, phase });
      }
    }
    if (candidates.length !== 1) {
      errors.push(migrationError(
        candidates.length === 0 ? 'unresolved-initiative-identity' : 'ambiguous-initiative-identity',
        `initiative ${initiative?.slug ?? key} has ${candidates.length} identity candidate(s)`,
        { key, projectId: projectIdOf(initiative), initiativeSlug: initiative?.slug ?? null },
      ));
      continue;
    }
    const [{ plan, phase }] = candidates;
    changes.push({
      key,
      initiative,
      patch: {
        ...(missingParent ? { parentPlan: plan.slug } : {}),
        ...(missingPhase ? { phaseId: phase.id } : {}),
      },
    });
  }
  return { changes, errors };
}

function projectIdFromPath(filePath) {
  const parts = resolve(filePath).split('/');
  const index = parts.lastIndexOf('projects');
  return index >= 0 && parts[index + 1] ? parts[index + 1] : '__legacy';
}

function kindFromFile(filePath) {
  const parts = resolve(filePath).split('/');
  if (basename(filePath) === 'plan.md' && parts.includes('projects')) return 'plan';
  if (parts.includes('plans')) return 'plan';
  if (parts.includes('phases') || parts.includes('initiatives')) return 'initiative';
  return null;
}

function nextBackupPath(filePath) {
  let suffix = 0;
  while (true) {
    const candidate = `${filePath}.bak${suffix === 0 ? '' : `.${suffix}`}`;
    if (!existsSync(candidate)) return candidate;
    suffix += 1;
  }
}

function render(frontmatter, body) {
  return `---\n${stringifyYaml(frontmatter)}---\n${body ? `\n${body}` : ''}`;
}

function runCli(argv) {
  const apply = argv.includes('--apply');
  const root = argv.find((arg) => !arg.startsWith('--')) ?? '.atomic-skills';
  const plans = new Map();
  const initiatives = new Map();
  const paths = new Map();

  for (const filePath of collectTargets([root])) {
    const kind = kindFromFile(filePath);
    if (kind !== 'plan' && kind !== 'initiative') continue;
    const raw = readFileSync(filePath, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (parsed.error) throw new Error(`${filePath}: ${parsed.error}`);
    const frontmatter = { ...parsed.frontmatter, __projectId: projectIdFromPath(filePath) };
    const key = `${frontmatter.__projectId}/${frontmatter.slug}`;
    if (kind === 'plan') plans.set(key, frontmatter);
    else initiatives.set(key, frontmatter);
    paths.set(key, { filePath, raw, body: parsed.body });
  }

  const result = planStateIntegrityMigration(plans, initiatives);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`[${error.code}] ${error.message}`);
    return 1;
  }
  console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: ${result.changes.length} change(s)`);
  for (const change of result.changes) {
    const source = paths.get(change.key);
    if (!source) throw new Error(`missing source path for ${change.key}`);
    console.log(`${source.filePath}: ${JSON.stringify(change.patch)}`);
    if (!apply) continue;
    const backupPath = nextBackupPath(source.filePath);
    copyFileSync(source.filePath, backupPath);
    const migrated = { ...change.initiative, ...change.patch };
    delete migrated.__projectId;
    writeFileSync(source.filePath, render(migrated, source.body));
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`migrate-state-integrity: ${error.message}`);
    process.exitCode = 2;
  }
}
