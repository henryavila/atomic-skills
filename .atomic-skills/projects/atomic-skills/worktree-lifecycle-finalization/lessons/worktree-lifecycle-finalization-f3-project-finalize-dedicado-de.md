---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f3-project-finalize-dedicado-de
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      Numa doc-procedimento que CONSOME um ref configurável + um resolver cujo
      contrato "assume input schema-válido", o review local (mesmo modelo) perdeu
      DUAS classes de correção que o pass Codex cross-model pegou: (1) a doc parseava
      `routing.json` e chamava `resolveIntegrationRef` sem validar contra
      `routing.schema.json` antes — e o resolver mapeia um valor presente-mas-inválido
      (`""`, `123`, `{}`) para o default `develop` silenciosamente (publica no base
      errado); (2) a doc usava o `integrationRef` bare para o `git diff` LOCAL, mas um
      clone pode ter só `origin/<ref>` (sem ref local), fazendo o diff de preview falhar.
      O blind levantou injeção/F-002; o informed reconciliou para estes dois (emerged
      F-003 = remote-vs-local).
    corrective: >-
      Quando uma procedure consome um resolver puro cujo doc diz "assume schema-valid
      input", a doc do CONSUMIDOR deve documentar validar o input contra esse schema
      ANTES da chamada (abortar em erro de schema), nunca delegar a validação ao
      resolver. E para um ref CONFIGURÁVEL, rastrear DOIS valores — o ref de
      identidade/remoto (`--base` do PR + persistência) e o ref LOCAL resolvido (git
      ops), consumindo `resolveBaseRef` → `{integrationRef, baseRef}`. Rodar
      `review-code --mode=both` em diff de contrato/procedure: o cross-model pega as
      classes own-vs-schema e remote-vs-local que o local mesmo-modelo racionaliza
      (espelha wlf-f1 L-001). Locus: skills/shared/project-assets/project-finalize.md
      Step 1-2.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md (codex blind
      F-002 -> informed F-001 schema-validate; emerged F-003 baseRef-vs-integrationRef);
      skills/shared/project-assets/project-finalize.md Step 1-2; fix commit e7913a7
    createdAt: 2026-06-17T18:52:47Z
    validatedAt: 2026-06-17T18:52:47Z
  - id: L-002
    statement: >-
      Wirar o subcomando `finalize` atualizou a grammar + dispatch table + a lista de
      pre-mutation gates do router (`skills/core/project.md`), mas PERDEU o
      `meta/catalog.yaml` `subcommands:` — o espelho machine-readable que
      `npm run generate-docs` usa para gerar help/docs (README, skills.generated.ts,
      docs/skills). O review de phase-done (codex blind F-005, refinado a major no
      informed) pegou a meia-aplicação. O verifier-grep de G-1 não pegaria: ele casa só
      strings na prosa do router/doc, não a ausência no catálogo.
    corrective: >-
      Ao adicionar um subcomando/verbo, ENUMERAR no SPEC todos os sites-espelho,
      inclusive os NÃO-prosa/machine-readable: router (grammar + dispatch + pre-mutation
      gates em project.md) E `meta/catalog.yaml` `subcommands:` (alimenta generate-docs).
      Adicionar ao acceptance um grep determinístico do novo verbo em `catalog.yaml`
      para o verifier-grep não se satisfazer só com a prosa (recorre wlf-f0 L-002:
      asserção não-vacuosa). Locus: meta/catalog.yaml subcommands list.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f0-always-fork-na-criacao-decis/L-001
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md (codex blind
      F-005 minor -> informed F-004 major); meta/catalog.yaml finalize entry;
      generate-docs regen docs/skills/project.md + skills.generated.ts; fix commit e7913a7
    createdAt: 2026-06-17T18:52:47Z
    validatedAt: 2026-06-17T18:52:47Z
  - id: L-003
    statement: >-
      A doc PRODUTORA (`finalize.md`) gravou a identidade do PR e afirmou que a teardown
      da F2 "consome" a identidade e que o handoff estava fechado — mas o consumidor
      DOCUMENTADO (`project-transitions.md` archive → `isTeardownSafe({branch, baseRef})`)
      não passa `integrationRef` nem `prIdentity`, então retorna `blocked('indeterminate-base')`
      e nunca lê a identidade gravada. Local L#1 e Codex blind F-003 pegaram o overclaim
      (o informed dropou o finding por `transitions.md` estar fora do escopo deste diff,
      mas o gap subjacente é real).
    corrective: >-
      Quando um produtor grava estado para um consumidor DOWNSTREAM cruzando fronteira de
      phase, verificar a assinatura REAL da chamada do consumidor (que campos ele lê)
      ANTES de afirmar que o handoff está fechado. Se o wiring do consumidor mora no
      arquivo de outra phase (fechada/fora do escopo da task), sinalizar como FOLLOW-UP
      ABERTO explícito na doc, nunca alegar closure — e abrir uma task para fechar o
      wiring. Um contrato produtor/consumidor cross-phase precisa das DUAS metades
      wired ou do gap surfaceado. Locus: finalize.md Step 4 vs transitions.md archive.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md (local L#1 /
      codex blind F-003); scripts/worktree-teardown.js:83-84 (indeterminate-base antes
      de pr-identity-missing); finalize.md Step 4 OPEN FOLLOW-UP; fix commit e7913a7
    createdAt: 2026-06-17T18:52:47Z
    validatedAt: 2026-06-17T18:52:47Z
---

# Lessons — F3 project finalize dedicado (worktree-lifecycle-finalization)

Distiladas no phase-done de F3 a partir de sinal real: o review-gate `--mode=both`
sobre o diff de código da fase (`skills/shared/project-assets/project-finalize.md` novo
+ o wiring do router `skills/core/project.md`). O pass local (envelope selado) achou 3
findings (1 critical produtor/consumidor overclaim, 1 major shape de `references[]`, 1
minor persist-antes-de-publicar). O Codex blind achou 1 critical (injeção, DROPADO no
informed sob a constraint de tool argument-vector) + 3 major + 1 minor; o informed
reconciliou para 4 major (2 dropped, 3 maintained, 1 emerged), incl. o emerged
`baseRef`-vs-`integrationRef`. Todos os findings in-scope foram aplicados
(`finalize.md` + `meta/catalog.yaml`), commit `e7913a7`; verdict efetivo
needs_changes→all-fixed.

**Recorrência (sinal de burndown):** L-002 é `recurrenceOf` wlf-f0 L-001 (mudar/wirar
algo referenciado tem sites de ripple além do óbvio) — a lição de ripple ainda não
grudou: o catálogo machine-readable foi o site perdido desta vez. Reforço: enumerar os
sites-espelho NÃO-prosa no SPEC.

**Follow-up aberto ratificado:** o gap da L-003 (archive→isTeardownSafe passar
`integrationRef`+`prIdentity` lendo o `pr-url` gravado) vira uma new-task ratify-gated
numa phase futura — sem isso a teardown bloqueia todo plano em `indeterminate-base`.
