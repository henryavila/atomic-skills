---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f1-reconstrucao-artefato-e-codigo
title: Reconstrução (justapor + confirmação-por-divergência)
goal: gerar o catálogo coletando candidatos de código + artefatos, justapondo
  sem reconciliar no silêncio; operador arbitra só o delta; persistência como
  memória-de-decisão (evidenceHash por-página).
status: active
branch: plan/design-brief
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-16T14:34:21Z
nextAction: Todas as 5 tasks DONE. Rodar phase-done (exit-gate G-1 +
  review-code) para fechar a F1 e avançar para F2.
parentPlan: design-brief-source-of-truth
phaseId: F1
tasksDone: 5
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o catálogo sai com existence, divergências e evidenceHash
      por-página; nenhuma divergência é resolvida no silêncio; os fixtures
      greenfield, envenenado e multi-convenção passam.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/sources.test.js test/app-map/code-scan.test.js
        test/app-map/diverge.test.js test/app-map/confirm.test.js
        test/app-map/persist.test.js
    verifierLabel: "shell: node --test test/app-map/sources.test.js test/app-map/code-…"
stack:
  - id: 1
    title: Reconstrução (artefato e código) e reconciliação
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Recall de fontes (open-world)
    status: done
    closedAt: 2026-06-16T14:16:23Z
    lastUpdated: 2026-06-16T14:16:23Z
    summary: Encontra docs heterogêneos (open-world) e extrai candidatos de
      página/público/acesso com proveniência por campo.
    description: "Encontra docs heterogêneos sem classificar framework e extrai
      candidatos com proveniência por campo (discovery = recall, não
      classificação). Files: src/app-map/sources.js,
      test/app-map/sources.test.js"
    scopeBoundary:
      - read-only; não cruza com código nem escreve catálogo; não muta
        artefatos; precedência só ordena apresentação, nunca resolve
        divergência.
    acceptance:
      - descobre docs em roots configuráveis sem assumir convenção (fixtures
        BMAD, README, atomic-skills e nenhuma-convenção todos produzem
        candidatos)
      - cada candidato carrega proveniência por campo (a fonte que afirmou cada
        campo)
      - candidato = texto que afirma página, público ou acesso
      - nenhuma precedência auto-resolve divergência entre fontes
    verifier:
      kind: shell
      command: node --test test/app-map/sources.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T14:16:23Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/app-map/sources.test.js → tests 4, pass 4, fail
        0, exit 0. As 4 acceptance (recall multi-convenção, proveniência
        por-campo, candidato=página/público/acesso, sem precedência) verdes.
  - id: T-002
    title: Code-scan framework-agnóstico
    status: done
    closedAt: 2026-06-16T14:20:04Z
    lastUpdated: 2026-06-16T14:20:04Z
    summary: Enumera páginas do código de forma framework-agnóstica e deriva regime
      greenfield/brownfield por página.
    description: "Enumera páginas/rotas/views do código por globs
      framework-agnósticos e anexa codeEvidence + regime por página. Files:
      src/app-map/code-scan.js, test/app-map/code-scan.test.js"
    scopeBoundary:
      - read-only; enumera só evidência de código; não cruza com docs nem
        escreve catálogo.
    acceptance:
      - enumera páginas/rotas/views por globs framework-agnósticos
      - cada página carrega codeEvidence (ou ausente = greenfield)
      - regime greenfield/brownfield derivado da própria página, nunca de routes
        vazio global
      - fixture greenfield retorna zero páginas de código sem erro
    verifier:
      kind: shell
      command: node --test test/app-map/code-scan.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T14:20:04Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/app-map/code-scan.test.js → tests 4, pass 4,
        fail 0, exit 0. Enumera Next pages/app-router + Vue view (exclui util),
        codeEvidence+regime por-página, deriveRegime puro, greenfield → [].
  - id: T-003
    title: Justaposição e cômputo do delta
    status: done
    closedAt: 2026-06-16T14:23:46Z
    lastUpdated: 2026-06-16T14:23:46Z
    summary: Justapõe candidatos doc+código e computa o delta de divergências sem
      escolher um lado.
    description: "Junta candidatos doc+código por chave-lógica normalizada exata,
      computa existence + divergências por-campo (o delta); concordância vira
      auto-aceito; nunca escolhe um lado. Files: src/app-map/diverge.js,
      test/app-map/diverge.test.js"
    scopeBoundary:
      - nunca escolhe um lado automaticamente; não pergunta ao operador (isso é
        T-004); não escreve catálogo nem muta fontes.
    acceptance:
      - junta candidatos por chave-lógica normalizada exata (near-miss vira
        existence possible-alias ao operador, nunca auto-unido)
      - produz existence entre confirmed, artefact-only, code-only e
        possible-alias
      - divergência de campo (ex público) vira delta pendente com ambas
        proveniências; concordância vira auto-aceito sem delta
      - fixture envenenado (doc admin-only, código public) produz divergência e
        nunca a linha errada como fato
      - fixture multi-convenção contraditório deixa todos os candidatos no delta
        sem precedência vencer
    verifier:
      kind: shell
      command: node --test test/app-map/diverge.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T14:23:46Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: node --test test/app-map/diverge.test.js → tests 5, pass 5, fail
        0, exit 0. Join exato + near-miss→possible-alias; 4 classes de
        existence; conflito→delta com ambas proveniências (value null);
        agreement auto-aceito; envenenado e multi-convenção sem precedência
        vencer.
  - id: T-004
    title: Confirmação-por-divergência (anti-fadiga)
    status: done
    closedAt: 2026-06-16T14:27:47Z
    lastUpdated: 2026-06-16T14:27:47Z
    summary: Apresenta só o delta ao operador, com orçamento por risco, e grava a
      arbitragem (anti-fadiga).
    description: "Apresenta só o delta ao operador via prompt com orçamento por
      risco e grava a arbitragem; silêncio nunca vira verdade. Files:
      src/app-map/confirm.js, test/app-map/confirm.test.js"
    scopeBoundary:
      - pergunta só o delta, nunca o auto-aceito; nunca auto-resolve; grava
        resolução só no catálogo, jamais nos artefatos.
    acceptance:
      - apresenta só o delta via prompt; orçamento de perguntas escalado por
        risco (acesso/autorização explícito caro, baixo-impacto em lote)
      - arbitragem grava resolvedBy, resolvedAt e choice
      - invariante de saída nenhuma página termina não-confirmada e
        não-perguntada; pending só persiste se o operador adiou explicitamente
      - taxa de confirmação cega instrumentada como métrica de governança
    verifier:
      kind: shell
      command: node --test test/app-map/confirm.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T14:27:47Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/app-map/confirm.test.js → tests 4, pass 4, fail
        0, exit 0. Pergunta só o delta (nunca o auto-aceito); alto-risco
        (accessTier/possible-alias) individual, baixo em lote; arbitragem grava
        resolvedBy/resolvedAt/choice; pending só por defer explícito; taxa de
        confirmação cega instrumentada (1/6). `ask` injetado (DI
        determinística).
  - id: T-005
    title: Persistência (schema 0.2) e evidenceHash por-página
    status: done
    closedAt: 2026-06-16T14:34:21Z
    lastUpdated: 2026-06-16T14:34:21Z
    summary: Persiste o app-map.json 0.2 com evidenceHash por-página; re-run
      pergunta só o delta.
    description: "Grava o catálogo (app-map.json 0.2 + espelho .md) na árvore do
      app-alvo com evidenceHash por-página; re-run compara hashes e emite só o
      delta; valida emit-time reusando validateAppMap da F0. Files:
      src/app-map/persist.js, src/app-map/hash.js,
      meta/schemas/app-map.schema.json, test/app-map/persist.test.js"
    scopeBoundary:
      - grava só o catálogo na árvore do app-alvo; não muta artefatos humanos;
        valida emit-time reusando validateAppMap da F0.
    acceptance:
      - bump schemaVersion 0.1 para 0.2 (resolution vira objeto
        resolvedBy/resolvedAt/choice e evidenceHash por-página required)
      - evidenceHash = sha256 do conteúdo normalizado da evidência (código +
        doc) por página
      - re-execução com evidência inalterada produz zero delta (suprime a
        re-pergunta); evidência mudada coloca a página no delta
      - emit-time valida contra o schema e aborta em catálogo malformado
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T14:34:21Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/app-map/persist.test.js → tests 4, pass 4, fail
        0, exit 0. Bump 0.1→0.2 condicional (evidenceHash por-página required +
        resolution objeto) sem quebrar F0 (31/31 app-map); evidenceHash sha256
        normalizado; re-run zero-delta com evidência inalterada / delta na
        mudada; emit-time aborta malformado sem gravar (reusa validateAppMap da
        F0).
parked: []
emerged: []
summary: Coleta candidatos doc+código, justapõe sem reconciliar, operador
  arbitra o delta, e persiste o catálogo (evidenceHash por-página).
planTitle: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Reconstrução (artefato e código) e reconciliação**.

> **HISTÓRICO (2026-06-16) — F1 voltou ao DESIGN e foi re-decomposta.** As tasks T-001…T-004 da
> v1 ("reconciliar fontes-artefato contra código automaticamente") foram **invalidadas** por um
> debate de 4 vozes (`atomic-skills:debate`) que achou um defeito de design (auto-violação do P2).
> A Revisão 2 do `../design.md` substituiu-as pelas **5 tasks atuais** (justapor + confirmação-por-
> divergência), todas **re-decompostas, SPEC-admitidas e agora IMPLEMENTADAS** (ver `tasks:` +
> evidence). Esta nota é histórica; a verdade operacional está no frontmatter e no Session handoff.

> **IMPLEMENT COMPLETO (2026-06-16) — 5/5 tasks DONE, exit-gate G-1 verde.** `node --test` das 5
> suites → `tests 21, pass 21, fail 0, exit 0`. Aguardando `phase-done` (review-code + advance) —
> opt-in do operador.

## Decisions

- **2026-06-16 — F1 re-aberta no DESIGN.** "Reconciliar automaticamente" auto-viola o P2 (colapsa
  incerteza em fato na persistência) e troca fail-stop (vazio óbvio) por fail-silent-que-propaga
  (catálogo confiantemente errado). Direção corrigida registrada em `../design.md` **Revisão 2**:
  **justapor candidatos + confirmação-por-divergência** (operador arbitra só o DELTA), proveniência
  tri-fonte, **persistência como memória-de-decisão** (justificada pela re-execução iterativa, que o
  operador confirmou essencial), **precedência automática cortada**, anti-fadiga de primeira classe.
- **Invariantes fixados pelo operador:** operador SEMPRE presente na reconstrução (nunca batch/CI);
  re-execução iterativa sobre o mesmo app é essencial.
- **`DESIGN.md` é reservado ao Design System do projeto** — o briefing/prompt do `design-brief` é
  saída gerada em arquivos de handoff próprios; nada disso vai para `DESIGN.md` nem para o doc de
  design da feature.
- **T-001…T-004 invalidadas.** Após `../design.md` passar pelo critic, re-decompor a F1 no PLAN.

## Links

- Doc de design da feature (re-design): `../design.md` (Revisão 2)
- Memória do princípio de precedência: `~/.claude/projects/-home-henry-atomic-skills/memory/precedencia-artefato-humano-vs-ia.md`

## Session handoff
- **Narrative:** F1 `active`, **IMPLEMENT COMPLETO — 5/5 tasks DONE**, cada uma fechada por verifier
  determinístico com evidence `passed:true`. Mode 1 (Opus single-threaded TDD; Codex preterido porque as
  5 tasks são cadeia de dependência com contratos compartilhados + verifier é test autoral). Falta só o
  `phase-done` (exit-gate G-1 + review-code + lessons + advance), que é opt-in do operador.
- **Decision log:** justapor + confirmação-por-divergência (operador arbitra só o delta); precedência
  automática cortada; greenfield = caso-limite. T-001 recall em 3 modos (marcador `Page:` · heading+atributo
  · inline-prosa), só inline usa vocab-scan (evita título→página-fantasma), proveniência por-campo, sem
  merge (P2). T-002 enumera por convenção de path/nome (pages/app-router/views/screens), `deriveRegime`
  puro. T-003 join por chave normalizada exata; near-miss=plural-fold|lev≤1→possible-alias; conflito→delta
  `value:null` com ambas proveniências; agreement(≥2 testemunhas)→auto-aceito. T-004 `ask` injetado (DI);
  alto-risco (accessTier/possible-alias) individual, baixo em lote; métrica de confirmação-cega. T-005
  bump schema `0.1`→`0.2` **condicional** (allOf if schemaVersion=0.2 ⇒ evidenceHash required; resolution
  oneOf string|objeto) — F0 0.1 segue válido; `evidenceHash`=sha256 canônico; `inputsHash` vira roll-up.
  `resolvedAt` inline (não cross-file $ref) porque validate.js da F0 compila só o app-map.schema.json.
- **Single nextAction:** rodar **`phase-done`** (`~/.claude/commands/atomic-skills/_assets/project-transitions.md`):
  re-verifica o exit-gate G-1, roda o review-code gate no diff da fase, distila lessons, e propõe avançar
  `currentPhase` F1→F2. NÃO auto-avançar — opt-in do operador.
- **Verbatim state:** exit-gate G-1 `node --test test/app-map/sources.test.js test/app-map/code-scan.test.js
  test/app-map/diverge.test.js test/app-map/confirm.test.js test/app-map/persist.test.js` → `tests 21,
  pass 21, fail 0, EXIT=0`. Suíte app-map+F0 (8 arquivos) → `tests 31, pass 31`. `compute-rollups` →
  `{"tasksDone":5,"tasksTotal":5}`. `validate-state` da iniciativa → `✓ All 1 file(s) valid`. Falhas do
  `npm test` global (10) são PRÉ-EXISTENTES (confirmado via `git stash` → install.test.js já 5/37 fail):
  `dist/dashboard` não-buildado + frente de relocação `_assets` (39 vs 35) — nenhuma toca app-map.
- **Uncommitted changes:** (nada commitado — regra global: commit só quando o operador pedir) —
  `M .atomic-skills/.../phases/f1-reconstrucao-artefato-e-codigo.md` · `M meta/schemas/app-map.schema.json` ·
  `?? src/app-map/{sources,code-scan,diverge,confirm,hash,persist}.js` ·
  `?? test/app-map/{sources,code-scan,diverge,confirm,persist}.test.js` · `?? test/app-map/fixtures/`.
