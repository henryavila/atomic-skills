/**
 * Agrupa itens por uma chave derivada. Compartilhado por diverge (candidatos
 * doc/código) e reconstruct (candidatos doc por página).
 */
export function groupByKey(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
