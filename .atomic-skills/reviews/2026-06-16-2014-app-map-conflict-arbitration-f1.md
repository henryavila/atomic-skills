# review-code — app-map-conflict-arbitration F1 (produtor + mirror + prosa)

- **Quando:** 2026-06-16T20:14:47Z
- **Escopo:** diff de código da fase F1, `8683c8c..HEAD` (5 arquivos: `src/app-map/reconstruct.js`, `src/app-map/persist.js`, `skills/core/design-brief.md`, `test/app-map/reconstruct.test.js`, `test/app-map/persist.test.js`)
- **Modo:** both (local sealed-envelope → codex cross-model na mesma captura byte-idêntica)
- **Gatilho:** gate obrigatório de `phase-done` (F1)

## Counts

- **Local (clean-context agent):** 0 findings (6 checklist itens ok).
- **Codex blind (gpt-5-codex):** 0B/0C/**1maj**/0m/0n — F-001.
- **Codex informed:** 0B/0C/**2maj**/0m/0n — F-001 (maintained) + F-002 (new). Framing Δ: +1 (constraints expuseram F-002).

## Achados (codex, ambos corrigidos)

| # | Severidade | Arquivo | Achado | Disposição |
|---|-----------|---------|--------|-----------|
| F-001 | major (data-integrity) | `src/app-map/persist.js` mirrorMarkdown | `witness.value`/`witness.source` são permissivos no schema 0.3 (objeto/array); a coerção template-string `${w.value}` renderizava `[object Object]`, escondendo valor/proveniência do operador (P1). Alcançável via `persistReconstruction({pages})` (páginas resolvidas injetadas pelo agente). | **Corrigido** — `renderField()` (string as-is, não-string via JSON determinístico) + teste com value objeto/array e source objeto. |
| F-002 | major (correctness) | `src/app-map/persist.js` mirrorMarkdown | Um conflito RESOLVIDO (objeto `resolution.choice`) ainda era contado em "unresolved conflicts: N" e a testemunha escolhida não aparecia — o `.md` contradiz o JSON após arbitragem. | **Corrigido** — `conflictResolved()` particiona pending/resolved; "unresolved" conta só pendentes; conflito resolvido renderiza `resolved conflict — <field>: <choice.value> (from <choice.source>)`. Teste novo. |

**Local pass (disjunto):** 0 findings — o agente de contexto-limpo verificou null-source/empty-sources/sort-determinism e confirmou que a validação emit-time gateia witnesses malformadas; não pegou F-001/F-002 (valor empírico do cross-model: o codex achou 2 disjuntos que o mesmo-modelo não viu).

## Verificação pós-fix

- `node --test test/app-map/persist.test.js` → tests 8, pass 8, fail 0
- `node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js` (gate F1-G1) → tests 18, pass 18, fail 0
- `node --test test/app-map/*.test.js` (suite completa) → tests 64, pass 64, fail 0

## Self-review against code-quality gates

- **G1 read-before-claim:** li o mirrorMarkdown atual antes de corrigir; os fixes citam o mecanismo (coerção template-string; contagem indiscriminada) confirmado por execução.
- **G2 soft-language:** descrições dos fixes e commit escaneadas — 0 ocorrências da ban-list.
- **G3 anti-tautology:** F-001 test falha se o mirror coage (`doesNotMatch /\[object Object\]/`); F-002 test falha se conflito resolvido for contado como unresolved — ambas as mutações inversas quebram os asserts.
- **G4 fixture realism:** fixtures são catálogos app-map sintéticos cuja forma é o próprio schema 0.3 (sem instância externa a amostrar); a estrutura objeto/array exercita exatamente o que o schema permissivo admite.
- **G7 anti-premature-abstraction:** `renderField`/`conflictResolved` são 2 helpers usados em múltiplos sites do mirror (witness + choice; pending + resolved) — não abstração especulativa.

**Status final:** Código aprovado (2 major cross-model corrigidos + verificados).
