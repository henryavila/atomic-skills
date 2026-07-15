const FULL_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REVIEW_RANGE = /^((?:[0-9a-f]{40}|[0-9a-f]{64}))\.{2,3}((?:[0-9a-f]{40}|[0-9a-f]{64}))$/;

export function reviewArtifactTip(artifact) {
  if (typeof artifact !== 'string') return null;
  const value = artifact.trim();
  if (FULL_GIT_OID.test(value)) return value;
  const match = value.match(REVIEW_RANGE);
  return match && match[1].length === match[2].length ? match[2] : null;
}
