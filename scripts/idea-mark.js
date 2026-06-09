#!/usr/bin/env node
/**
 * Extract or mark one project idea in `.atomic-skills/projects/<project-id>/ideas.md`.
 *
 * CLI:
 *   node scripts/idea-mark.js [<root>] --id <n> (--dest <target> | --extract)
 *        [--project-id <id>]
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

function ideasPath(root, opts = {}) {
  const dir = resolve(root || process.cwd());
  const projectId = resolveProjectId(dir, opts.projectId);
  return join(dir, '.atomic-skills', 'projects', projectId, 'ideas.md');
}

function readIdeas(root, opts = {}) {
  const file = ideasPath(root, opts);
  if (!existsSync(file)) throw new Error(`ideas.md not found: ${file}`);
  return { file, text: readFileSync(file, 'utf8') };
}

function positiveInteger(value, label) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${label} must be a positive integer.`);
  return n;
}

function findLineEnd(text, start) {
  const nl = text.indexOf('\n', start);
  return nl === -1 ? text.length : nl;
}

function lineBreakEnd(text, lineEnd) {
  return lineEnd < text.length ? lineEnd + 1 : lineEnd;
}

function findRecords(text, id) {
  const wanted = positiveInteger(id, 'id');
  const headings = [];
  for (const match of text.matchAll(/^## #(\d+) · ([^\n]*)$/gm)) {
    headings.push({
      id: Number(match[1]),
      title: match[2].replace(/\r$/, ''),
      start: match.index,
      headingEnd: match.index + match[0].length,
    });
  }

  const records = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading.id !== wanted) continue;
    const headingLineEnd = findLineEnd(text, heading.start);
    const metaStart = lineBreakEnd(text, headingLineEnd);
    const metaEnd = findLineEnd(text, metaStart);
    const bodyStart = lineBreakEnd(text, metaEnd);
    const end = i + 1 < headings.length ? headings[i + 1].start : text.length;
    records.push({
      ...heading,
      metaStart,
      metaEnd,
      metaLine: text.slice(metaStart, metaEnd).replace(/\r$/, ''),
      bodyStart,
      end,
    });
  }

  return records;
}

function parseMeta(line, id) {
  if (!line.startsWith('`') || !line.endsWith('`')) {
    throw malformedMetaError(id);
  }

  const inner = line.slice(1, -1);
  const parts = inner.split(' · ');
  if (parts.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    throw malformedMetaError(id);
  }
  if (!parts[1].startsWith('branch:') || !parts[2].startsWith('status:')) {
    throw malformedMetaError(id);
  }

  const status = parts[2].slice('status:'.length);
  if (status !== 'pending' && !status.startsWith('triaged→')) {
    throw malformedMetaError(id);
  }

  const meta = {
    date: parts[0],
    branch: parts[1].slice('branch:'.length),
    status,
  };
  for (const part of parts.slice(3)) {
    if (part.startsWith('scope:')) {
      meta.scope = part.slice('scope:'.length);
    } else if (part.startsWith('context:')) {
      meta.context = part.slice('context:'.length);
    } else {
      throw malformedMetaError(id);
    }
  }
  return meta;
}

function malformedMetaError(id) {
  return new Error(`Malformed idea #${id}: meta line missing or unparseable.`);
}

function selectedRecord(text, id, opts = {}) {
  const records = findRecords(text, id);
  if (records.length === 0) throw new Error(`Idea id #${id} not found.`);
  if (records.length > 1) warn(opts, `Warning: duplicate id #${id}; using first occurrence.`);
  const record = records[0];
  const meta = parseMeta(record.metaLine, id);
  return { record, meta };
}

function warn(opts, message) {
  if (typeof opts.onWarning === 'function') {
    opts.onWarning(message);
  } else {
    console.error(message);
  }
}

export function extractIdea(root, n, opts = {}) {
  const id = positiveInteger(n, 'id');
  const { text } = readIdeas(root, opts);
  const { record, meta } = selectedRecord(text, id, opts);
  const desc = text.slice(record.bodyStart, record.end).trim();
  const idea = {
    id,
    title: record.title,
    date: meta.date,
    branch: meta.branch,
    status: meta.status,
  };
  if (Object.hasOwn(meta, 'scope')) idea.scope = meta.scope;
  if (Object.hasOwn(meta, 'context')) idea.context = meta.context;
  idea.desc = desc;
  return idea;
}

export function markTriaged(root, n, dest, opts = {}) {
  const id = positiveInteger(n, 'id');
  if (!hasText(dest)) throw new Error('Missing required --dest.');

  const { file, text } = readIdeas(root, opts);
  const { record, meta } = selectedRecord(text, id, opts);
  if (meta.status.startsWith('triaged→')) {
    throw new Error(`Idea #${id} is already ${meta.status}.`);
  }

  const statusStart = record.metaStart + record.metaLine.indexOf('status:pending');
  const statusEnd = statusStart + 'status:pending'.length;
  const updated = `${text.slice(0, statusStart)}status:triaged→${dest}${text.slice(statusEnd)}`;
  writeFileSync(file, updated);
  return { id, dest, file };
}

function parseArgs(argv) {
  const opts = { root: null, id: null, dest: null, extract: false, projectId: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: idea-mark.js [<root>] --id <n> (--dest <target> | --extract) [--project-id <id>]');
      process.exit(0);
    } else if (arg === '--id') {
      opts.id = valueAfter(rest, ++i, arg);
    } else if (arg === '--dest') {
      opts.dest = valueAfter(rest, ++i, arg);
    } else if (arg === '--extract') {
      opts.extract = true;
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

  if (opts.id == null) throw new Error('Missing required --id.');
  opts.id = positiveInteger(opts.id, 'id');
  if ((opts.dest != null && opts.extract) || (opts.dest == null && !opts.extract)) {
    throw new Error('Pass exactly one of --dest <target> or --extract.');
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
    if (args.extract) {
      console.log(JSON.stringify(extractIdea(args.root || process.cwd(), args.id, args)));
    } else {
      const result = markTriaged(args.root || process.cwd(), args.id, args.dest, args);
      console.log(`#${result.id} → triaged→${result.dest} (${relative(resolve(args.root || process.cwd()), result.file)})`);
    }
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}
