/**
 * Confirmação-por-divergência (anti-fadiga). Apresenta SÓ o delta ao operador
 * (T-003 já separou o auto-aceito), com orçamento de perguntas escalado por
 * risco, e grava a arbitragem no resultado — NUNCA nos artefatos.
 *
 * A interação concreta usa {{ASK_USER_QUESTION_TOOL}}; aqui a função `ask` é
 * injetada para manter o verifier determinístico. `ask` recebe uma pergunta e
 * devolve a escolha do operador:
 *   - { type: 'item', risk, key, item }            → { choice, blind? }
 *   - { type: 'batch', risk, items: [{key,...}] }  → { resolutions: [{key, choice, blind?}] }
 * `choice === 'defer'` adia explicitamente (o pending só persiste assim — D9).
 *
 * Invariantes (scopeBoundary T-004): pergunta só o delta, nunca o auto-aceito;
 * nunca auto-resolve; grava a resolução só no catálogo (este resultado), jamais
 * nos artefatos.
 */

// Risco alto = explícito e individual (acesso/autorização + identidade ambígua).
// O resto é baixo-impacto → uma pergunta em lote (default aceito quando seguro).
function isHighRisk(item) {
  if (item.kind === 'field-conflict') return item.field === 'accessTier';
  if (item.kind === 'existence') return item.existence === 'possible-alias';
  return false;
}

function keyOf(item) {
  return item.kind === 'field-conflict' ? `${item.pageId}:${item.field}` : `${item.pageId}:existence`;
}

function applyResolution(page, item, answer, { resolvedBy, now }) {
  const deferred = answer.choice === 'defer';
  const resolution = deferred
    ? { status: 'pending', resolvedBy, resolvedAt: now }
    : { resolvedBy, resolvedAt: now, choice: answer.choice };

  if (item.kind === 'field-conflict') {
    const fieldAgg = page.fields[item.field];
    fieldAgg.resolution = resolution;
    if (!deferred) {
      fieldAgg.value = answer.choice;
      fieldAgg.status = 'resolved';
    }
  } else {
    page.existenceResolution = resolution;
  }
  return { deferred, blind: answer.blind === true };
}

export function confirmDivergences({ pages, delta }, { ask, resolvedBy = 'operator', now } = {}) {
  const resolvedAt = now ?? new Date().toISOString();
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const keyed = delta.map((item) => ({ ...item, key: keyOf(item) }));

  const high = keyed.filter(isHighRisk);
  const low = keyed.filter((item) => !isHighRisk(item));

  const answers = new Map();
  for (const item of high) {
    const answer = ask({ type: 'item', risk: 'high', key: item.key, item });
    // Mesma invariante de saída (D9) do caminho em lote: uma resposta ausente
    // do operador é uma página não-confirmada-e-não-perguntada — falha clara,
    // não um TypeError opaco depois de já ter mutado páginas.
    if (!answer) throw new Error(`resolution missing for delta item '${item.key}'`);
    answers.set(item.key, answer);
  }
  if (low.length > 0) {
    const batch = ask({ type: 'batch', risk: 'low', items: low });
    const byKey = new Map((batch.resolutions ?? []).map((r) => [r.key, r]));
    for (const item of low) {
      const answer = byKey.get(item.key);
      // Invariante de saída (D9): cada item do delta DEVE ter sido endereçado —
      // um item do lote sem resposta seria uma página não-confirmada-e-não-
      // perguntada, exatamente o que o gate proíbe.
      if (!answer) throw new Error(`batch resolution missing for delta item '${item.key}'`);
      answers.set(item.key, answer);
    }
  }

  const resolvedKeys = [];
  const deferred = [];
  let totalConfirmations = 0;
  let blindConfirmations = 0;

  for (const item of keyed) {
    const answer = answers.get(item.key);
    const outcome = applyResolution(pageById.get(item.pageId), item, answer, { resolvedBy, now: resolvedAt });
    if (outcome.deferred) {
      deferred.push(item.key);
    } else {
      resolvedKeys.push(item.key);
      totalConfirmations += 1;
      if (outcome.blind) blindConfirmations += 1;
    }
  }

  const blindConfirmationRate = totalConfirmations === 0 ? 0 : blindConfirmations / totalConfirmations;

  return {
    pages,
    delta: keyed,
    resolvedKeys,
    deferred,
    metrics: { totalConfirmations, blindConfirmations, blindConfirmationRate },
  };
}
