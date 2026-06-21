# review-code — app-map-conflict-arbitration F0 (schema 0.3 + validador)

- **Quando:** 2026-06-16T19:39:09Z
- **Escopo:** diff de código da fase F0, `ea6100f..c17e519` (4 arquivos: `meta/schemas/app-map.schema.json`, `src/app-map/validate.js`, `test/app-map/schema.test.js`, `test/app-map/validate.test.js`)
- **Modo:** local (sealed envelope via agente em contexto limpo, sem intent)
- **Gatilho:** gate obrigatório de `phase-done` (F0)

## Counts

- blocker: 0 · critical: 0 · major: 1 · minor: 0 (1 nit + 1 minor descartados pelo bar)
- (o agente rotulou o achado como "critical"; reclassificado para **major** na triagem — é lacuna de cobertura de teste, não bug de código em produção; o mecanismo de gating foi analisado e está correto.)

## Achados

| # | Severidade | Arquivo | Achado | Disposição |
|---|-----------|---------|--------|-----------|
| 1 | major (test-coverage) | `test/app-map/schema.test.js` | O gating por-versão era testado só numa direção (0.3 rejeita slots legacy); faltava a direção reversa — que um catálogo 0.1/0.2 carregando `witnesses[]` é REJEITADO pelo `additionalProperties:false` do `conflict` legacy. | **Corrigido** — teste `app-map schema rejects the 0.3 witnesses field on a 0.1/0.2 conflict` (loop 0.1+0.2) adicionado; passa (rejeição confirmada via keyword `additionalProperties`). Commit `431165e`. |

**Descartados (abaixo do bar):**
- `src/app-map/validate.js` checagem `typeof resolution !== 'object'` aceitaria arrays — mas a linha seguinte `'choice' in resolution` retorna early para arrays (não têm a chave `choice`). Comportamento correto, sem input que falhe → DROP.
- `test/app-map/validate.test.js` chama `validateAppMap` duas vezes na mesma asserção (uma p/ valor, outra p/ mensagem) — nit cosmético → DROP.

## Verificação pós-fix

- `node --test test/app-map/schema.test.js` → tests 10, pass 10, fail 0
- `node --test test/app-map/*.test.js` (suite completa) → tests 60, pass 60, fail 0
- F0-G1 gate `node --test test/app-map/schema.test.js test/app-map/validate.test.js` → tests 16, pass 16, fail 0

## Self-review against code-quality gates

- **G1 read-before-claim:** o agente leu os 4 arquivos no contexto limpo; o fix cita o mecanismo exato (`conflict.additionalProperties:false` rejeita `witnesses`) confirmado por execução.
- **G2 soft-language:** descrição do fix e commit escaneados — 0 ocorrências de should/probably/may.
- **G3 anti-tautology:** o novo teste falharia se a base `conflicts.items` tivesse ficado permissiva (`{type:object}`) sem o branch legacy re-aplicar o `$ref` — i.e. a mutação que o quebra é remover/afrouxar o branch 0.1/0.2. Não-tautológico.
- **G4 fixture realism:** o fixture é um catálogo app-map sintético cuja forma é definida pelo próprio schema (não há instância externa a amostrar — catálogos são gerados por código); espelha os fixtures existentes do arquivo.
- **G7 anti-premature-abstraction:** nenhum helper novo introduzido.

**Status final:** Código aprovado (1 major corrigido + verificado).
