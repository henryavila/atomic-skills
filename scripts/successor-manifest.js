import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PATH_FIELDS = ['planPath', 'initiativePath'];
const IDENTITY_FIELDS = ['phaseId'];
const HASH_FIELDS = ['planHash', 'initiativeHash'];

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => (
      value[key] === undefined ? [] : [[key, canonicalize(value[key])]]
    )));
  }
  return value;
}

export function normalizeSuccessorManifest(input, { nullable = true } = {}) {
  if (input == null && nullable) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('successor manifest must be an object');
  }
  for (const field of [...IDENTITY_FIELDS, ...PATH_FIELDS]) {
    if (!hasText(input[field])) throw new TypeError(`successor.${field} is required`);
  }
  for (const field of HASH_FIELDS) {
    if (typeof input[field] !== 'string' || !/^[0-9a-f]{64}$/.test(input[field])) {
      throw new TypeError(`successor.${field} must be a lowercase sha256 digest`);
    }
  }
  return structuredClone(input);
}

export function successorManifestDigest(input) {
  const successor = normalizeSuccessorManifest(input, { nullable: false });
  return createHash('sha256').update(JSON.stringify(canonicalize(successor))).digest('hex');
}

export function successorPublicationEvidence(input, { txId = null } = {}) {
  const successor = normalizeSuccessorManifest(input, { nullable: false });
  return {
    status: 'complete',
    successor,
    successorDigest: successorManifestDigest(successor),
    txId,
  };
}

function confinedLiveFile(root, input, label) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('successor publication repository root is required');
  }
  if (!hasText(input) || isAbsolute(input)) {
    throw new Error(`${label} must be a relative repository path`);
  }
  const canonicalRoot = realpathSync(resolve(root));
  const target = resolve(canonicalRoot, input);
  const rel = relative(canonicalRoot, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} escapes the repository root`);
  }
  let current = canonicalRoot;
  for (const component of rel.split(sep).filter(Boolean)) {
    current = resolve(current, component);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label} traverses a symbolic link`);
  }
  const stat = lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} is not a real regular file`);
  }
  return target;
}

export function assertSuccessorPublicationEvidence(result, expected, { root } = {}) {
  const successor = normalizeSuccessorManifest(expected, { nullable: false });
  const evidence = result?.publication;
  if (!evidence || evidence.status !== 'complete'
      || !isDeepStrictEqual(evidence.successor, successor)
      || evidence.successorDigest !== successorManifestDigest(successor)) {
    throw new Error('effects.materializeSuccessor did not return authenticated successor publication evidence');
  }
  try {
    const planPath = confinedLiveFile(root, successor.planPath, 'successor publication planPath');
    const initiativePath = confinedLiveFile(
      root,
      successor.initiativePath,
      'successor publication initiativePath',
    );
    const planHash = createHash('sha256').update(readFileSync(planPath)).digest('hex');
    const initiativeHash = createHash('sha256').update(readFileSync(initiativePath)).digest('hex');
    if (planHash !== successor.planHash || initiativeHash !== successor.initiativeHash) {
      throw new Error('live successor bytes do not match the persisted manifest');
    }
  } catch (error) {
    throw new Error(
      `effects.materializeSuccessor did not return authenticated successor publication evidence: ${error.message}`,
    );
  }
  return structuredClone(evidence);
}
