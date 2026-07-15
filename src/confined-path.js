import {
  lstatSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

function pathEscapesRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

function validatePart(part) {
  if (typeof part !== 'string' || part.length === 0 || part === '.' || part === '..'
      || part.includes('/') || part.includes('\\') || isAbsolute(part)) {
    throw new TypeError(`confined path component is invalid: ${JSON.stringify(part)}`);
  }
}

function canonicalRoot(root) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('repository root is required');
  const requested = resolve(root);
  const stat = lstatSync(requested);
  if (!stat.isDirectory()) throw new Error(`repository root is not a directory: ${requested}`);
  return realpathSync(requested);
}

function confinedDirectoryFromRoot(root, parts, create) {
  for (const part of parts) validatePart(part);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const candidate = join(current, part);
    let stat;
    try {
      stat = lstatSync(candidate);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      if (!create) return join(current, ...parts.slice(index));
      try {
        mkdirSync(candidate, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== 'EEXIST') throw mkdirError;
      }
      stat = lstatSync(candidate);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`confined path contains a symbolic link or non-directory: ${candidate}`);
    }
    current = realpathSync(candidate);
    if (pathEscapesRoot(root, current)) {
      throw new Error(`confined path escapes repository root: ${candidate}`);
    }
  }
  return current;
}

export function confinedRepositoryDirectory(root, parts, { create = false } = {}) {
  if (!Array.isArray(parts)) throw new TypeError('confined directory parts must be an array');
  return confinedDirectoryFromRoot(canonicalRoot(root), parts, create);
}

export function confinedRepositoryFile(root, directoryParts, filename, { createParents = false } = {}) {
  validatePart(filename);
  const canonical = canonicalRoot(root);
  const directory = confinedDirectoryFromRoot(canonical, directoryParts, createParents);
  const path = join(directory, filename);
  if (pathEscapesRoot(canonical, path)) throw new Error(`confined file escapes repository root: ${path}`);
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`confined file is a symbolic link: ${path}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return path;
}
