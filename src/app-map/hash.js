import { createHash } from 'node:crypto';

/**
 * evidenceHash por-página (T-005, D5'). sha256 do conteúdo NORMALIZADO da
 * evidência que fundou o fato da página (código + doc). Normalizado = canônico
 * (chaves ordenadas recursivamente), de modo que a ordem de chaves/serialização
 * não muda o hash — só uma mudança real na evidência muda o hash.
 *
 * Na re-execução, comparar este hash por página suprime a re-pergunta de páginas
 * cuja evidência não mudou (anti-fadiga — D9) e coloca no delta as que mudaram.
 */

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function computeEvidenceHash(evidence) {
  const json = JSON.stringify(canonicalize(evidence ?? null));
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}
