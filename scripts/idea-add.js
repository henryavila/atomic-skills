#!/usr/bin/env node
/**
 * Append a raw project idea to `.atomic-skills/projects/<project-id>/ideas.md`.
 *
 * CLI:
 *   node scripts/idea-add.js [<root>] --title <t> --desc <d>
 *        [--scope <s>] [--context <c>] [--project-id <id>]
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADER_BODY = '> Inbox de ideias cruas. Capture com `/atomic-skills:project idea`; promova com `idea promote <n>`. Não edite os ids.';

const hasText = (v) => typeof v === 'string' && v.length > 0;

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function projectDirs(root) {
  const projectsDir = join(root, '.atomic-skills', 'projects');
  if (!isDir(projectsDir)) return [];
  return readDirNames(projectsDir).filter((name) => isDir(join(projectsDir, name))).sort();
}

function readDirNames(path) {
  try {
    return statSync(path).isDirectory() ? readdirSync(path) : [];
  } catch {
    return [];
  }
}

function resolveProjectId(root, explicitProjectId) {
  if (hasText(explicitProjectId)) return explicitProjectId;

  const dirs = projectDirs(root);
  if (dirs.length === 1) return dirs[0];
  if (dirs.length > 1) {
    throw new Error(`Multiple project directories exist (${dirs.join(', ')}); pass --project-id.`);
  }
  return basename(root);
}

function currentBranch(root) {
  try {
    const out = execFileSync('git', ['branch', '--show-current'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || '-';
  } catch (err) {
    const out = typeof err.stdout === 'string' ? err.stdout.trim() : '';
    if (err.code === 'EPERM' && err.status === 0 && out) return out;
    return '-';
  }
}

function nextId(existing) {
  let max = 0;
  for (const match of existing.matchAll(/^## #(\d+)\b/gm)) {
    max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function header(projectId) {
  return `# 💡 Ideas — ${projectId}\n\n${HEADER_BODY}\n\n`;
}

function record(id, opts, branch) {
  const date = new Date().toISOString().slice(0, 10);
  let meta = `${date} · branch:${branch} · status:pending`;
  if (opts.scope != null) meta += ` · scope:${opts.scope}`;
  if (opts.context != null) meta += ` · context:${opts.context}`;
  return `## #${id} · ${opts.title}\n\`${meta}\`\n\n${opts.desc}\n`;
}

export function ideaAdd(root, opts = {}) {
  const dir = resolve(root || process.cwd());
  if (!hasText(opts.title)) throw new Error('Missing required --title.');
  if (!hasText(opts.desc)) throw new Error('Missing required --desc.');

  const projectId = resolveProjectId(dir, opts.projectId);
  const file = join(dir, '.atomic-skills', 'projects', projectId, 'ideas.md');
  mkdirSync(join(dir, '.atomic-skills', 'projects', projectId), { recursive: true });

  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const id = nextId(existing);
  const entry = record(id, opts, currentBranch(dir));
  if (existing.length === 0) {
    writeFileSync(file, `${header(projectId)}${entry}`);
  } else {
    const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    appendFileSync(file, `${separator}${entry}`);
  }

  return { id, file };
}

function parseArgs(argv) {
  const opts = { root: null, title: null, desc: null, scope: null, context: null, projectId: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: idea-add.js [<root>] --title <t> --desc <d> [--scope <s>] [--context <c>] [--project-id <id>]');
      process.exit(0);
    } else if (arg === '--title') {
      opts.title = valueAfter(rest, ++i, arg);
    } else if (arg === '--desc') {
      opts.desc = valueAfter(rest, ++i, arg);
    } else if (arg === '--scope') {
      opts.scope = valueAfter(rest, ++i, arg);
    } else if (arg === '--context') {
      opts.context = valueAfter(rest, ++i, arg);
    } else if (arg === '--project-id') {
      opts.projectId = valueAfter(rest, ++i, arg);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown arg: ${arg}`);
    } else if (opts.root == null) {
      opts.root = arg;
    } else {
      throw new Error(`Unexpected arg: ${arg}`);
    }
  }
  return opts;
}

function valueAfter(args, index, flag) {
  const value = args[index];
  if (value == null || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args;
  try {
    args = parseArgs(process.argv);
    const result = ideaAdd(args.root || process.cwd(), args);
    console.log(`#${result.id} → ${relative(resolve(args.root || process.cwd()), result.file)}`);
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}
