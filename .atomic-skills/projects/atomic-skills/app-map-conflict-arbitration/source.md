# app-map: descritor de conflito rico + canal de arbitragem

Source de decomposição (SPEC) deste plano — materializa o interior por-tarefa
(Files / scopeBoundary / acceptance / verifier) que admite cada tarefa ao
implement (R-ORCH-23). Derivado do `design.md` aprovado (Decisões D1–D6 + Blast
radius) e validado por `node scripts/lint-source.js source.md --spec` → EXIT 0.

## Inviolable principles

- **P1 Nunca escolher no silêncio** — toda testemunha de um conflito é preservada com sua proveniência; nenhuma é descartada por limite de formato.
- **P2 Proveniência derivada-na-origem** — `kind` (code|artefact) é computado pelo produtor com a regra canônica (a source casa o path do codeEvidence), nunca afirmado independentemente nem re-derivado por consumidor.
- **P3 Aditivo e versionado** — o bump 0.2→0.3 entra como ramo condicional; catálogos 0.1/0.2 seguem lendo válidos.
- **P4 Arbitragem no agente** — a resolução acontece no agente design-brief via ASK_USER_QUESTION_TOOL chamando persistReconstruction; o CLI não persiste decisão.

## Glossary

- **witness (testemunha)** — uma afirmação de valor para um campo de página, com sua fonte (source) e a natureza dela (kind: code|artefact).
- **conflict** — um campo de página com 2 ou mais testemunhas discordantes, arbitrado pelo operador.

## F0 — Contrato: schema 0.3 + descritor witnesses

Goal: Estabelecer o contrato 0.3 do conflito — o descritor `witnesses[]` no schema + a regra de integridade no validador — validável emit-time, antes de qualquer produtor ou consumidor emitir a forma nova.

### T-001 Schema 0.3 — conflict vira witnesses[]

- Files: meta/schemas/app-map.schema.json, test/app-map/schema.test.js
- scopeBoundary: não tocar src/app-map/validate.js (a regra de integridade é T-002); não tocar src/app-map/reconstruct.js nem src/app-map/persist.js (produtor/consumidores são F1); não migrar dados; o ramo condicional 0.1/0.2 permanece intacto (porta de direção única — 0.1/0.2 leem válidos).
- acceptance: (1) o enum de `schemaVersion` aceita `"0.3"` e mantém `"0.1"`/`"0.2"`; (2) um catálogo 0.3 com `conflicts[].witnesses` array de `{value, source, kind}` e N maior ou igual a 2 (inclui N igual a 3) valida; (3) um conflito 0.3 que ainda carrega `artefactValue`/`codeValue` é REJEITADO (slots removidos no ramo 0.3, additionalProperties false); (4) `kind` fora de `{code, artefact}` é REJEITADO pelo schema; (5) catálogos 0.1 e 0.2 existentes seguem válidos sob o ramo condicional aditivo.
- verifier: kind shell — `node --test test/app-map/schema.test.js` (expectExitCode 0)
- RED→GREEN: primeiro escreve em test/app-map/schema.test.js os casos "0.3 witnesses valida + slots proibidos rejeitados + kind inválido rejeitado + 0.1/0.2 ainda válidos" (RED); depois adiciona o ramo `if schemaVersion == 0.3` + o `$def` de conflito 0.3 ao schema (GREEN).

### T-002 Validador — integridade de witnesses + resolution.choice

- Files: src/app-map/validate.js, test/app-map/validate.test.js
- scopeBoundary: não alterar o schema JSON (forma é T-001); não tocar produtor/consumidores (F1); manter `duplicatePageIdErrors` e a API pública `validateAppMap`/`assertValidAppMap` intactas — só adicionar uma regra pós-schema nova no mesmo estilo, sem novos campos de schema.
- acceptance: (1) uma função de erro pós-schema (estilo `duplicatePageIdErrors`) reforça que `resolution.choice`, quando `resolution` é objeto 0.3, referencia uma testemunha existente por value+source; (2) um conflito 0.3 cujo `resolution.choice` NÃO casa nenhuma testemunha produz erro e `valid` vira false; (3) um conflito 0.3 cujo `choice` casa uma testemunha (value+source) é aceito; (4) a regra só se aplica a conflitos 0.3 com witnesses — catálogos 0.1/0.2 não regridem e os testes existentes seguem verdes; (5) `validateAppMap`/`assertValidAppMap` mantêm assinatura e a mensagem de erro formatada legível.
- verifier: kind shell — `node --test test/app-map/validate.test.js` (expectExitCode 0)
- RED→GREEN: test/app-map/validate.test.js ganha o caso "choice sem testemunha correspondente em witnesses → erro `valid:false`" (RED); depois adiciona `resolutionChoiceErrors(catalog)` ao validate.js, agregado em `validateAppMap` ao lado de `duplicatePageIdErrors` (GREEN).

```yaml
exit_gate:
  - id: F0-G1
    description: O schema 0.3 valida o descritor witnesses, rejeita slots proibidos e kind inválido, e mantém 0.1/0.2 válidos; o validador reforça a integridade resolution.choice em witnesses.
    verifier: { kind: shell, command: "node --test test/app-map/schema.test.js test/app-map/validate.test.js", expectExitCode: 0 }
```

## F1 — Produtor, consumidores e prosa

Goal: O produtor emite witnesses[] com kind derivado-na-origem e resolution por valor+source; o mirror .md lista as N testemunhas; a prosa do §2 do design-brief deixa de prometer um --persist que persiste arbitragem; a cobertura inclui o caso N maior ou igual a 3.

### T-001 Produtor — conflictForField emite witnesses[] e catálogo 0.3

- Files: src/app-map/reconstruct.js, src/app-map/persist.js, test/app-map/reconstruct.test.js
- scopeBoundary: não alterar o schema (F0 fechou o contrato); não tocar src/app-map/validate.js; não mudar o motor de divergência (`fieldSources`/agregação já entrega todas as sources — o bug era só na gravação em `conflictForField`); `buildCatalog` passa a emitir schemaVersion 0.3 mas não muda os outros campos de página.
- acceptance: (1) `conflictForField` retorna `{field, witnesses, evidence, resolution}` com `witnesses` array de `{value, source, kind}` cobrindo TODAS as sources do agregado (nenhuma descartada — N igual a 3 admin/registered/guardian preservado); (2) `kind` de cada testemunha é derivado-na-origem (source.path casa page.codeEvidence.path → `code`; senão `artefact`), nunca afirmado independentemente; (3) os slots `artefactValue`/`codeValue` deixam de ser emitidos; (4) `resolution` permanece `'pending'` na emissão e `resolution.choice` (quando resolvido) referencia uma testemunha por value+source, não por índice; (5) `buildCatalog` emite `schemaVersion: "0.3"` e o catálogo resultante passa `assertValidAppMap`.
- verifier: kind shell — `node --test test/app-map/reconstruct.test.js` (expectExitCode 0)
- RED→GREEN: reconstruct.test.js ganha o caso "página com 3 testemunhas discordantes → 3 witnesses preservadas, kind derivado, sem artefactValue/codeValue, catálogo 0.3 válido" (RED); depois reescreve `conflictForField`/`conflictsForPage` para emitir witnesses[] e `buildCatalog` para 0.3 (GREEN).

### T-002 Consumidores — mirror .md das N testemunhas + prosa §2

- Files: src/app-map/persist.js, test/app-map/persist.test.js, skills/core/design-brief.md
- scopeBoundary: não alterar o produtor `conflictForField` (T-001) nem o schema/validador; o mirror é só leitura/formatação do catálogo; a edição da prosa limita-se ao §2 de design-brief.md (linhas 44–46) — não reabre §4/R2 nem a anti-contaminação; não adicionar canal CLI `--resolved` (fora de escopo, D6).
- acceptance: (1) `mirrorMarkdown` lista, por conflito, as N testemunhas (value + source + kind) em vez de só `unresolved conflicts: N`; (2) um catálogo 0.3 com um conflito de 3 testemunhas produz um mirror que cita as 3; (3) a prosa do §2 de design-brief.md deixa de prometer que `--persist` persiste arbitragem — esclarece que a arbitragem é aplicada programaticamente (o agente passa as páginas resolvidas a persistReconstruction) e `--persist` é re-emissão não-interativa (D6); (4) a string `--persist` não aparece mais como o passo que grava a decisão do operador no §2; (5) os testes de persist 0.1/0.2 existentes seguem verdes.
- verifier: kind shell — `node --test test/app-map/persist.test.js` (expectExitCode 0)
- RED→GREEN: persist.test.js ganha o caso "mirror de conflito 0.3 lista as 3 testemunhas com kind" (RED); depois ajusta `mirrorMarkdown` para iterar witnesses (GREEN); a correção de prosa do §2 é verificada por leitura (a ausência da promessa `--persist`-persiste-decisão) e não regride o teste.

```yaml
exit_gate:
  - id: F1-G1
    description: A reconstrução end-to-end emite witnesses 0.3 com N maior ou igual a 3 preservado e validável; o mirror lista as testemunhas; a prosa do §2 reflete a arbitragem programático-only.
    verifier: { kind: shell, command: "node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js", expectExitCode: 0 }
```
