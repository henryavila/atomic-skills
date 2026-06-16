---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f1-reconstrucao-artefato-e-codigo
title: Reconstrução (justapor + confirmação-por-divergência)
goal: gerar o catálogo coletando candidatos de código + artefatos, justapondo
  sem reconciliar no silêncio; operador arbitra só o delta; persistência como
  memória-de-decisão (evidenceHash por-página).
status: pending
branch: plan/design-brief
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-16T13:41:08Z
nextAction: "Start T-001: Recall de fontes (open-world) em src/app-map/sources.js"
parentPlan: design-brief-source-of-truth
phaseId: F1
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-16T13:41:08Z
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
  - id: T-002
    title: Code-scan framework-agnóstico
    status: pending
    lastUpdated: 2026-06-16T13:41:08Z
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
  - id: T-003
    title: Justaposição e cômputo do delta
    status: pending
    lastUpdated: 2026-06-16T13:41:08Z
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
  - id: T-004
    title: Confirmação-por-divergência (anti-fadiga)
    status: pending
    lastUpdated: 2026-06-16T13:41:08Z
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
  - id: T-005
    title: Persistência (schema 0.2) e evidenceHash por-página
    status: pending
    lastUpdated: 2026-06-16T13:41:08Z
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

> **PARADA NO IMPLEMENT (2026-06-16) — defeito de design encontrado; F1 volta ao DESIGN.**
> Ao orientar a execução das tasks T-001…T-004, o gate F1 (spec-readiness) detectou que os
> mecanismos diferidos "→ PLAN" (roots/precedência de fontes, discovery de código, fingerprint)
> nunca foram fixados, e o operador trouxe 3 críticas que **falsificam premissas do design**.
> Um debate de 4 vozes (`atomic-skills:debate`) confirmou um **defeito de design** na abordagem
> "reconciliar fontes-artefato contra código automaticamente". As tasks T-001…T-004 estão
> **INVALIDADAS** por este re-design (não execute nenhuma como está).

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
- **Narrative:** F1 teve defeito de design corrigido (Revisão 2, critic **Approved**) e foi
  **re-decomposta** no PLAN: T-001…T-004 antigas substituídas por **5 tasks novas** SPEC-admitidas
  (No-Placeholders + SPEC gate `EXIT=0`), summaries validados pelo operador. A fase está `pending`
  (não-ativada); pronta para o IMPLEMENT.
- **Decision log:** direção = justapor + confirmação-por-divergência (operador arbitra só o delta),
  precedência automática cortada, greenfield = caso-limite, `evidenceHash` por-página (unifica
  staleness + fingerprint), bump schema `0.1`→`0.2`. Operador sempre presente; re-execução essencial.
  Defaults load-bearing (roots/recall, code-scan globs, join-key exata, evidenceHash sha256) fixados
  e aprovados.
- **Single nextAction:** ativar a F1 e começar o IMPLEMENT por **T-001 — Recall de fontes** em
  `src/app-map/sources.js` (Mode 2/Codex elegível: spec-ready + verifier determinístico). Ordem
  natural: T-001 → T-002 → T-003 → T-004 → T-005.
- **Verbatim state:** F1 re-decomposta — 5 tasks, exit-gate verifier `node --test test/app-map/sources.test.js test/app-map/code-scan.test.js test/app-map/diverge.test.js test/app-map/confirm.test.js test/app-map/persist.test.js`. `validate-state` da iniciativa → `✓ valid`. SPEC gate (`node scripts/lint-source.js … --spec`) → `EXIT=0`. Nenhum arquivo `src/app-map/{sources,code-scan,diverge,confirm,persist}.js` existe ainda (a implementar).
- **Uncommitted changes:** re-decompose ainda **não commitado** — `plan.md` (descritor F1) + este arquivo de fase modificados. Ver `git status` da sessão.
