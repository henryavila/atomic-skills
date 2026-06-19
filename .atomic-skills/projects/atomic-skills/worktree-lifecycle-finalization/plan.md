---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization
title: Finalização do ciclo de vida da worktree-do-plano
version: "1.0"
status: active
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-19T16:20:35Z
branch: plan/worktree-lifecycle-finalization
currentPhase: F8
parallelismAllowed: false
principles:
  - id: P1
    title: Todo plano forka sua branch+worktree na CRIAÇÃO (feature desde o
      nascimento)
    body: 'Reverte o default lazy anterior ("solo = `branch: null`, forka só sob
      concorrência"). O mecanismo de fork/stamp/worktree-retroativa é REUSADO
      (`verified_by: scripts/plan-branch-policy.js`;
      `scripts/bind-plan-branch.js` stampBranch; `scripts/emit-focus.js`
      pickFocus intacto) — muda só o gatilho: de condicional-sob-concorrência
      para incondicional-na-criação. Cada feature acumula commits na própria
      branch desde o início, tornando "1 worktree = 1 feature = 1 PR limpo"
      mecanicamente verdadeiro. `emit-focus` NÃO é tocado.'
  - id: P2
    title: Publicar e encerrar são máquinas de estado separadas, ambas
      operator-prompted
    body: "O `project finalize` PUBLICA (push `plan/<slug>` + abre PR
      feature→develop; efeito de rede irreversível-social). O `archive` ENCERRA
      (flipa `status: archived` com zero efeito git, como hoje — `verified_by:
      skills/shared/project-assets/project-transitions.md` archive) e roda
      DEPOIS do merge do PR. Nunca PR cego na `main`. Nada é automático: o
      finalize mostra o diff e o PR proposto antes de agir."
  - id: P3
    title: Nunca remover trabalho não-provado-integrado; squash-safe; em
      indeterminação, BLOQUEIA
    body: 'Os modos de erro são assimétricos: falso-negativo ("não integrado" quando
      está) re-roda; falso-positivo ("integrado" quando não está) deleta
      trabalho não-mergeado, irreversível. A composição segura: liveness via `gh
      pr view` (state==MERGED, mergedAt, baseRefName == ref, captura
      `headRefOid`) + veto local ancorado no `headRefOid` (`git merge-base
      --is-ancestor` OU `HEAD == headRefOid` sob squash). Indeterminação
      BLOQUEIA. Nunca `rm -rf`; nunca `-D`/`--force` por default; `git branch
      -d` é a 2ª guarda nativa.'
  - id: P4
    title: Skills genéricas; agentes advisory são read-only e nunca gateiam; dedup
      falha-para-RE-revisar
    body: "As skills de finalize/colisão rodam em QUALQUER projeto-alvo, sem amarrar
      à stack deste repo. O único gate é determinístico (build+test do projeto
      na árvore mergeada, verify-claim-able); os agentes LLM são ADVISORY,
      READ-ONLY (Iron Law: leitura paraleliza, merge/código serial —
      R-XAGENT-03), self-check nunca self-certify. O dedup de review pula
      superfície só com prova POSITIVA de já-revisada; na dúvida, RE-revisa
      (pular por engano = false-green)."
glossary:
  - term: plan-branch
    definition: branch `plan/<slug>` forkada na criação do plano; sob o pivô É a
      feature-branch que vai a PR→develop.
  - term: integrationRef
    definition: ref de integração configurável (default `develop`), repo-global em
      `routing.json`; nunca per-plano. Onde os PRs de feature entram.
  - term: finalize
    definition: "comando dedicado `project finalize` que PUBLICA: push `plan/<slug>`
      + `gh pr create --base <integrationRef>` + grava a `pr-url` no estado."
  - term: headRefOid
    definition: SHA do head do PR no instante do merge (de `gh pr view`); âncora do
      veto de teardown squash-safe.
  - term: check cross-WT
    definition: "detecção de colisão entre ≥2 worktrees vivas no finalize: gate
      determinístico (build+test do projeto-alvo na árvore mergeada) + workflow
      advisory de agentes LLM read-only escopados ao diff."
  - term: backstop
    definition: 9º check read-only no `project verify` que sinaliza em WARN órfãos
      do modelo PR→develop (worktree viva de feature mergeada; branch de plano
      arquivado nunca PR-ada ou PR aberto e nunca mergeado).
  - term: ledger de review
    definition: conjunto append-only em `last-review.json` de `{commitSha, patchId,
      mode, reviewedAt, reviewFile}`; a memória que evita re-revisar superfície
      já-revisada.
phases:
  - id: F0
    slug: worktree-lifecycle-finalization-f0-always-fork-na-criacao-decis
    title: Always-fork na criação (Decisão 1)
    goal: tornar o fork de `plan/<slug>` + worktree INCONDICIONAL na criação do
      plano (Stage 6), revertendo o default lazy anterior — reusando o mecanismo
      de stamp/worktree e invertendo só o gatilho, sem tocar `emit-focus` nem o
      Step 0.5 do implement.
    dependsOn: []
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "Fork incondicional na criação: solo agora forka plan/<slug>;
            planBranchName intacto; Stage 6 declara fork incondicional; suite
            verde."
          status: met
          metAt: 2026-06-17T12:26:23Z
          verifier:
            kind: test
            runner: node
            pattern: tests/plan-branch-policy.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T12:26:23Z
            exitCode: 0
            testsCollected: 9
            passed: true
            outputSummary: "node --test tests/plan-branch-policy.test.js @ 01c2455:
              tests 9, pass 9, fail 0 (incl. tightened Stage-6 doc-test)."
        - id: G-2
          description: emit-focus permanece intacto (Decisão 1 não o toca) e skills válidos.
          status: met
          metAt: 2026-06-17T12:26:23Z
          verifier:
            kind: shell
            command: node --test tests/focus-digest.test.js && npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T12:26:23Z
            exitCode: 0
            passed: true
            outputSummary: "focus-digest 11/11 (emit-focus intact) && validate-skills:
              All 15 skills valid @ 01c2455."
    status: done
    reviewGate:
      status: passed
      at: 01c2455
      mode: local
      verifiedAt: 2026-06-17T12:26:23Z
    summary: Toda criação de plano forka branch+worktree (always-fork), revertendo o
      default lazy.
  - id: F1
    slug: worktree-lifecycle-finalization-f1-integrationref-configuravel
    title: integrationRef configurável + branch develop (Decisão 2)
    goal: 'introduzir um ref de integração configurável (default `develop`)
      repo-global em `routing.json`, estendendo o schema (que hoje é
      `additionalProperties: false` e descrito como "Mode 2 routing"), e um
      resolvedor que lê o ref, aplica o default e sinaliza ausência para o
      prompt lazy no ponto de consumo (o finalize, F3).'
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Schema aceita integrationRef e rejeita chave desconhecida;
            resolvedor aplica default develop e sinaliza ausência sem assumir;
            suite verde.
          status: met
          metAt: 2026-06-17T13:56:08Z
          verifier:
            kind: test
            runner: node
            pattern: tests/integration-ref.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T13:56:08Z
            exitCode: 0
            testsCollected: 6
            passed: true
            outputSummary: "node --test tests/integration-ref.test.js @ af6c934:
              tests 6, pass 6, fail 0. Resolvedor (T-002) aplica default develop +
              sinaliza not-configured sem assumir; schema (T-001) aceita
              integrationRef e rejeita chave desconhecida."
        - id: G-2
          description: routing.schema.json válido e skills válidos.
          status: met
          metAt: 2026-06-17T13:56:08Z
          verifier:
            kind: shell
            command: node --test tests/routing-schema.test.js && npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T13:56:08Z
            exitCode: 0
            passed: true
            outputSummary: "node --test tests/routing-schema.test.js (tests 4, pass 4)
              && npm run validate-skills (All 15 skills valid) @ af6c934, exit 0."
    status: done
    reviewGate:
      status: passed
      at: 357f49e
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-1414-wlf-f1-integrationref.md
      verifiedAt: 2026-06-17T14:14:34Z
    summary: Ref de integração configurável (default develop) em routing.json, com
      resolvedor e prompt-quando-ausente.
  - id: F2
    slug: worktree-lifecycle-finalization-f2-teardown-seguro-squash-safe
    title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
    goal: revisar o invariante de não-perda em `scripts/worktree-teardown.js` para
      verificar contra o `integrationRef` configurável (não mais `main`),
      compondo liveness via `gh pr view` (state==MERGED, baseRefName correto,
      captura `headRefOid`) com um veto local ancorado no `headRefOid` que é
      seguro sob squash-merge; em indeterminação, BLOQUEIA.
    dependsOn:
      - F1
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Teardown verifica contra integrationRef; liveness+veto headRefOid;
            oráculos A (resíduo pós-squash bloqueia) e B (squash limpo permite);
            indeterminação bloqueia; sem -D/--force/rm -rf; suite verde.
          status: met
          metAt: 2026-06-17T16:51:02Z
          verifier:
            kind: test
            runner: node
            pattern: tests/worktree-teardown.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T16:51:02Z
            exitCode: 0
            testsCollected: 21
            passed: true
            outputSummary: "node --test tests/worktree-teardown.test.js @ 2a69940:
              tests 21, pass 21, fail 0. resolveBaseRef consome resolveIntegrationRef;
              liveness gh (MERGED+baseRefName+headRefOid) + veto squash-safe (HEAD==headRefOid
              OU ancestor; residue-beyond-head BLOQUEIA); indeterminação BLOQUEIA; sem
              -D/--force/rm -rf. Inclui 2 oráculos de squash + G9 mutation-kill + 4 testes
              de hardening do review-gate."
        - id: G-2
          description: Skills válidos após a revisão do invariante.
          status: met
          metAt: 2026-06-17T16:51:02Z
          verifier:
            kind: shell
            command: npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T16:51:02Z
            exitCode: 0
            passed: true
            outputSummary: "npm run validate-skills @ 2a69940: All 15 skills valid
              (schema_version 0.2), exit 0."
    status: done
    reviewGate:
      status: passed
      at: 2a699402346d4884a625a14b02a5e9b109e85f44
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-1651-wlf-f2-teardown.md
      verifiedAt: 2026-06-17T16:51:02Z
    summary: Teardown só remove com integração provada vs integrationRef, seguro sob
      squash.
  - id: F3
    slug: worktree-lifecycle-finalization-f3-project-finalize-dedicado-de
    title: project finalize dedicado (Decisão 3)
    goal: "introduzir o comando operator-prompted `project finalize` que PUBLICA a
      feature: `git push -u origin plan/<slug>` (sem renomear), `gh pr create
      --base <integrationRef> --head plan/<slug> --fill`, e grava a
      `pr-url`/identidade no estado do plano; prompt-quando-ausente do
      `integrationRef` (usar existente OU criar `develop` de `main`); mostra o
      diff e o PR proposto antes de agir; o `archive` continua zero-git e roda
      depois do merge."
    dependsOn:
      - F2
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: project finalize documentado (push+PR→integrationRef+grava pr-url,
            prompt-quando-ausente), router lista o subcomando, archive intocado;
            skills válidos.
          status: met
          metAt: 2026-06-17T18:26:30Z
          verifier:
            kind: shell
            command: grep -q 'project-finalize' skills/core/project.md && grep -qi 'gh pr
              create' skills/shared/project-assets/project-finalize.md && npm
              run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T18:26:30Z
            exitCode: 0
            passed: true
            outputSummary: "grep -q 'project-finalize' project.md + grep -qi 'gh pr
              create' project-finalize.md matched; npm run validate-skills → ✓ All
              15 skills valid (schema_version 0.2), exit 0."
        - id: G-2
          description: O finalize consome o resolvedor de integrationRef (F1) e o
            invariante de teardown (F2) permanece a guarda de remoção.
          status: met
          metAt: 2026-06-17T18:26:30Z
          verifier:
            kind: shell
            command: grep -qi 'integration-ref'
              skills/shared/project-assets/project-finalize.md && npm run
              validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T18:26:30Z
            exitCode: 0
            passed: true
            outputSummary: "grep -qi 'integration-ref' matched in project-finalize.md
              (scripts/integration-ref.js ref); npm run validate-skills → ✓ All 15
              skills valid, exit 0."
    status: done
    reviewGate:
      status: passed
      at: e7913a7
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-1850-wlf-f3-project-finalize.md
      verifiedAt: 2026-06-17T18:52:47Z
    summary: "Comando project finalize: publica a feature via push + PR para o develop."
  - id: F4
    slug: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no
    title: Check de colisão cross-WT no finalize (Decisão 7)
    goal: "adicionar ao finalize uma detecção de colisão entre ≥2 worktrees vivas,
      GENÉRICA (qualquer projeto-alvo): um gate determinístico (detecção dos
      comandos build/test do projeto-alvo + merge especulativo + exit code) como
      token de entrada, e um workflow advisory de agentes LLM read-only (Agente
      A semântico-comportamental + Agente B recurso/contrato) escopados ao diff,
      que nunca gateiam."
    dependsOn:
      - F3
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "Gate determinístico: detecção genérica de comandos, ativa só com
            ≥2 WTs, conflito textual é 1º gate, projeto sem comando é skip
            registrado (não passe silencioso); suite verde."
          status: met
          metAt: 2026-06-17T20:30:00Z
          verifier:
            kind: test
            runner: node
            pattern: tests/cross-wt-gate.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T20:30:00Z
            exitCode: 0
            testsCollected: 22
            passed: true
            outputSummary: "node --test tests/cross-wt-gate.test.js @ cf07d12 (post
              review-gate fixes): tests 22, pass 22, fail 0, exit 0. Inclui
              fail-closed (merge-indeterminate / runner-malformed-result) +
              never-throws (crossWtGate(null)) + OR-guard halves isoladas."
        - id: G-2
          description: Workflow advisory (agentes A/B read-only ao diff, nunca gateiam,
            fallback portátil) documentado no finalize; skills válidos.
          status: met
          metAt: 2026-06-17T20:30:00Z
          verifier:
            kind: shell
            command: grep -qi 'cross-wt-collision'
              skills/shared/project-assets/project-finalize.md && grep -qi
              'advisory' skills/shared/project-assets/project-finalize.md && npm
              run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T20:30:00Z
            exitCode: 0
            passed: true
            outputSummary: "Full chain exit 0 @ cf07d12: grep -qi 'cross-wt-collision'
              (2) && grep -qi 'advisory' (7) em project-finalize.md && npm run
              validate-skills → All 15 skills valid. Step 1.5 documenta o gate
              determinístico (a prova) + agentes advisory A/B."
    status: done
    reviewGate:
      status: passed
      at: cf07d120ad612274defe1e68e0e80f99b59a5257
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-2030-wlf-f4-cross-wt-collision.md
      verifiedAt: 2026-06-17T20:30:00Z
    summary: "No finalize, detecta colisão entre worktrees: gate build/test +
      agentes advisory ao diff."
  - id: F5
    slug: worktree-lifecycle-finalization-f5-coupling-interim-de-atomic-s
    title: Coupling interim de .atomic-skills/ (Decisão 5)
    goal: conter com o mínimo o coupling do tree `.atomic-skills/` entre feature-PRs
      — `focus.json` (estado-de-sessão regenerável) vai para `.gitignore` como
      carve-out explícito ao "tree versionado", e os JSON append-only de
      `status/*` ganham `.gitattributes merge=union`; a partição estrutural fica
      como plano separado.
    dependsOn:
      - F4
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: focus.json ignorado (já satisfeito) + dispatch-log.json em
            NDJSON com merge=union PROVADO (check-attr + union lossless); pontuais
            não-unidos; round-trip install/uninstall verde com focus.json não-rastreado.
          status: met
          metAt: 2026-06-17T21:00:00Z
          verifier:
            kind: shell
            command: grep -q 'focus.json' .gitignore && grep -qi 'merge=union'
              .gitattributes && node --test tests/dispatch-log-merge-union.test.js
              && node --test tests/install-uninstall-roundtrip.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T21:00:00Z
            exitCode: 0
            passed: true
            outputSummary: "Full chain exit 0 @ 9bde0c9: grep focus.json (.gitignore) +
              grep merge=union (.gitattributes) + node --test dispatch-log-merge-union
              (3/3: wired/strictEqual('union'), pointwise-not-union, NDJSON union
              lossless) + round-trip 4/4. git check-attr prova dispatch-log→union,
              last-review→unspecified."
        - id: G-2
          description: Suite e skills válidos após o carve-out.
          status: met
          metAt: 2026-06-17T21:00:00Z
          verifier:
            kind: shell
            command: npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T21:00:00Z
            exitCode: 0
            passed: true
            outputSummary: "npm run validate-skills → All 15 skills valid (schema_version
              0.2), exit 0 @ 9bde0c9 (mode2-codex-lane.md §9 NDJSON edit válido)."
    status: done
    reviewGate:
      status: passed
      at: 9bde0c93b72f990a41bf7d1948d3b7916faea4e9
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-2100-wlf-f5-coupling-ndjson-union.md
      verifiedAt: 2026-06-17T21:00:00Z
    summary: "Contém o coupling de .atomic-skills: focus.json ignorado + status/*
      com merge=union."
  - id: F6
    slug: worktree-lifecycle-finalization-f6-backstop-read-only-no-projec
    title: Backstop read-only no project verify (Decisão 6)
    goal: adicionar um 9º check read-only ao `project verify` (após os 8 atuais) que
      deriva live de `git worktree list --porcelain` + `merge-base` + status do
      plano e sinaliza em WARN os órfãos do modelo PR→develop (worktree viva de
      feature já mergeada; branch de plano arquivado nunca PR-ada ou PR aberto e
      nunca mergeado); o classificador topology-aware auto-ordenador fica
      DEFERIDO.
    dependsOn:
      - F5
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Backstop sinaliza WARN para worktree de feature mergeada e branch
            arquivada não-integrada; read-only, inputs não mutados; suite verde.
          status: met
          metAt: 2026-06-17T21:30:00Z
          verifier:
            kind: test
            runner: node
            pattern: tests/detect-orphan-worktrees.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T21:30:00Z
            exitCode: 0
            testsCollected: 11
            passed: true
            outputSummary: "node --test tests/detect-orphan-worktrees.test.js @ bb3183b
              (merged primary, post review-gate fixes): tests 11, pass 11, fail 0. Função
              pura findOrphanWorktrees (isBranchMerged simétrico A/B) — ambos sinais de
              merge, ambas formas archived, healthy→[], pureza+never-throws
              (frozen/null/throwing-isMerged/malformed), no-matching-plan, duplo-plano
              slug. read-only, inputs não mutados."
        - id: G-2
          description: "project-verify.md lista o check #9 (âncora
            detect-orphan-worktrees) e validate-skills passa."
          status: met
          metAt: 2026-06-17T21:30:00Z
          verifier:
            kind: shell
            command: grep -q 'detect-orphan-worktrees'
              skills/shared/project-assets/project-verify.md && npm run
              validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T21:30:00Z
            exitCode: 0
            passed: true
            outputSummary: "grep -q 'detect-orphan-worktrees' project-verify.md (check #9
              documentado, kinds reais nomeados) && npm run validate-skills → All 15 skills
              valid, exit 0 @ bb3183b."
    status: done
    reviewGate:
      status: passed
      at: bb3183beb80726cf9791cb020270a2657e5cd90f
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-2130-wlf-f6-orphan-worktrees.md
      verifiedAt: 2026-06-17T21:30:00Z
    summary: 9º check read-only no project verify avisa (WARN) órfãos do modelo
      PR→develop.
  - id: F7
    slug: worktree-lifecycle-finalization-f7-dedup-de-review-em-duas-cama
    title: Dedup de review em duas camadas (Decisão 8)
    goal: "eliminar re-review redundante sob worktrees paralelas — Camada A: um
      ledger de superfície unificado (`last-review.json` de ponteiro→conjunto,
      chave SHA+patch-id) que `review-code` e `review-due` leem/gravam por modo;
      Camada B: um run-record do composer `project review`, entregue como
      work-order ao autor da skill (vive em outra branch). Ambos
      falham-para-RE-revisar."
    dependsOn:
      - F6
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Ledger ponteiro→conjunto com migração fail-safe, append,
            alreadyReviewed só com prova positiva, e oráculo de patch-id sob
            squash; suite verde.
          status: met
          metAt: 2026-06-17T23:00:00Z
          verifier:
            kind: test
            runner: node
            pattern: tests/review-ledger.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T23:00:00Z
            exitCode: 0
            testsCollected: 20
            passed: true
            outputSummary: "node --test tests/review-ledger.test.js @ 83d2ee1 (post
              review-gate fixes): tests 20, pass 20, fail 0. readLedger (NDJSON,
              migração fail-safe de pointer/ausente/malformado), recordReview
              (append byte-preservante, union-safe), alreadyReviewed (prova positiva
              só com record completo isValidRecord, never-throws), oráculo patch-id
              sob squash + os fixes adversariais C1-C4."
        - id: G-2
          description: review-code e review-due documentam o dedup (âncora review-dedup,
            fail-para-RE-revisar); work-order ao autor do project review
            presente (Camada B); skills válidos.
          status: met
          metAt: 2026-06-17T23:00:00Z
          verifier:
            kind: shell
            command: grep -qi 'review-dedup' skills/core/review-code.md && grep -qi
              'review-dedup' skills/shared/project-assets/project-drift.md &&
              grep -qi 'project-review-dedup'
              .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/workorders/project-review-dedup.md
              && npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T23:00:00Z
            exitCode: 0
            passed: true
            outputSummary: "grep review-dedup (review-code.md Step 0.5 + project-drift.md)
              + project-review-dedup (workorder Camada B) && validate-skills → All 15
              skills valid, exit 0 @ 83d2ee1. Dedup documentado fail-para-RE-revisar com o
              flip de formato como follow-up coordenado deferido."
    status: done
    reviewGate:
      status: passed
      at: 83d2ee1ef7501fdd08c6577db7716a3cd22cfe18
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-17-2300-wlf-f7-dedup-review-ledger.md
      verifiedAt: 2026-06-17T23:00:00Z
    summary: "Evita re-revisar o já-revisado: ledger de superfície nas pernas +
      run-record do composer."
  - id: F8
    slug: worktree-lifecycle-finalization-f8-finalize-plan-aware-branch
    title: Finalize plan-aware — branch ≠ plano (Decisão 9)
    goal: >-
      tornar o `project finalize` correto quando uma branch/worktree carrega MAIS
      DE UM plano em estágios diferentes: resolver um plano-alvo EXPLÍCITO (nunca
      o default-silencioso do ponteiro focus), exigir o alvo terminal, emitir WARN
      dos planos-irmãos não-arquivados que o merge arrastaria, detectar (advisory)
      regressão de status de plano no merge, e verificar a existência do
      integrationRef antes de publicar (fecha o "develop silencioso"). Skill
      genérica; esta WT é a fonte de verdade do finalize.
    dependsOn:
      - F7
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: >-
            Resolvedor de escopo de plano determinístico
            (scripts/finalize-plan-scope.js): enumera os plan.md da branch,
            classifica alvo/outro-ativo/arquivado-não-mergeado, exige alvo
            terminal, BLOQUEIA alvo≠focus-sem-confirmação, WARN nos irmãos
            não-arquivados; detector de regressão de status advisory;
            puro/never-throws (fail-closed na dúvida); suite verde.
          status: met
          metAt: 2026-06-19T17:40:43Z
          verifier:
            kind: test
            runner: node
            pattern: tests/finalize-plan-scope.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-19T18:05:06Z
            exitCode: 0
            testsCollected: 24
            passed: true
            outputSummary: "node --test tests/finalize-plan-scope.test.js @ 00dd0cd
              (phase-done, pós-review both): tests 24, pass 24, fail 0, exit 0.
              resolveFinalizePlanScope (classifica target/other-active/archived-unmerged,
              terminal=archived|done|active-todas-fases-done com phases NÃO-vazio,
              BLOCK alvo≠focus-sem-confirm, BLOCK slug ambíguo, WARN irmãos não-arquivados)
              + detectPlanStatusRegression (rank active|paused<done<archived; advisory)
              puros/never-throws/fail-closed. Inclui as correções de review L#1/L#2/L#4
              + codex F-001..F-004."
        - id: G-2
          description: >-
            project-finalize.md documenta o guard plan-aware (passo pré-publish:
            seleção EXPLÍCITA do plano-alvo, terminalidade, WARN de irmãos), a
            verificação de existência do integrationRef (inclui source:default),
            e o detect+WARN advisory de regressão de status no merge (reusa a lane
            do F4); skills válidos.
          status: met
          metAt: 2026-06-19T17:40:43Z
          verifier:
            kind: shell
            command: grep -qi 'plan-aware' skills/shared/project-assets/project-finalize.md && grep -qi 'finalize-plan-scope' skills/shared/project-assets/project-finalize.md && npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T18:05:06Z
            exitCode: 0
            passed: true
            outputSummary: "grep -qi 'plan-aware' (2) && grep -qi 'finalize-plan-scope'
              (4) em project-finalize.md && npm run validate-skills → All 15 skills valid,
              exit 0 @ 00dd0cd. Step 1.6 documenta o guard determinístico + Step 1 a
              existence-check do integrationRef em origin (ls-remote/show-ref, cobre
              source:default; F-004 endureceu prompt-when-absent p/ exigir ref em origin)
              + o detect+WARN advisory de regressão (reusa a lane do F4)."
    status: done
    reviewGate:
      status: passed
      at: 00dd0cd
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-19-1803-wlf-f8-finalize-plan-aware.md
      verifiedAt: 2026-06-19T18:05:06Z
    summary: >-
      Finalize correto sob branch multi-plano: alvo explícito + terminal, WARN de
      irmãos e de regressão de status, e integrationRef verificado antes do PR.
references: []
planActive: true
planTitle: Finalização do ciclo de vida da worktree-do-plano
---

# Finalização do ciclo de vida da worktree-do-plano

## 1. Context

Fecha o ciclo de vida da `plan/<slug>` worktree sob o **pivô Git Flow do operador** (precedência humano > IA): cada worktree-de-plano É uma feature → **PR → `develop`** (branch de integração configurável) → futuramente `main`; escopo v1 = só feature→develop. Sob o modelo novo **todo plano forka sua branch+worktree na criação** (elimina a interleaving na raiz), o "finalize" passa a **ativo** num comando dedicado (`project finalize`: push + abre o PR), o teardown verifica integração contra o **ref configurável** e é robusto a squash-merge (liveness `gh` + veto ancorado no `headRefOid`), uma **detecção de colisão cross-WT** roda no finalize (gate determinístico do projeto-alvo + workflow advisory de agentes LLM read-only), o coupling de `.atomic-skills/` é contido com o mínimo (`focus.json` git-ignore + `merge=union`), um **backstop read-only** (9º check no `project verify`) sinaliza órfãos do modelo PR→develop, e um **dedup de review em duas camadas** evita re-revisar superfície já-revisada. Design aprovado: `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md` (Decisões 1–8, critic Approved).

## 2. Inviolable principles

- **P1 Todo plano forka sua branch+worktree na CRIAÇÃO (feature desde o nascimento)** — Reverte o default lazy anterior ("solo = `branch: null`, forka só sob concorrência"). O mecanismo de fork/stamp/worktree-retroativa é REUSADO (`verified_by: scripts/plan-branch-policy.js`; `scripts/bind-plan-branch.js` stampBranch; `scripts/emit-focus.js` pickFocus intacto) — muda só o gatilho: de condicional-sob-concorrência para incondicional-na-criação. Cada feature acumula commits na própria branch desde o início, tornando "1 worktree = 1 feature = 1 PR limpo" mecanicamente verdadeiro. `emit-focus` NÃO é tocado.
- **P2 Publicar e encerrar são máquinas de estado separadas, ambas operator-prompted** — O `project finalize` PUBLICA (push `plan/<slug>` + abre PR feature→develop; efeito de rede irreversível-social). O `archive` ENCERRA (flipa `status: archived` com zero efeito git, como hoje — `verified_by: skills/shared/project-assets/project-transitions.md` archive) e roda DEPOIS do merge do PR. Nunca PR cego na `main`. Nada é automático: o finalize mostra o diff e o PR proposto antes de agir.
- **P3 Nunca remover trabalho não-provado-integrado; squash-safe; em indeterminação, BLOQUEIA** — Os modos de erro são assimétricos: falso-negativo ("não integrado" quando está) re-roda; falso-positivo ("integrado" quando não está) deleta trabalho não-mergeado, irreversível. A composição segura: liveness via `gh pr view` (state==MERGED, mergedAt, baseRefName == ref, captura `headRefOid`) + veto local ancorado no `headRefOid` (`git merge-base --is-ancestor` OU `HEAD == headRefOid` sob squash). Indeterminação BLOQUEIA. Nunca `rm -rf`; nunca `-D`/`--force` por default; `git branch -d` é a 2ª guarda nativa.
- **P4 Skills genéricas; agentes advisory são read-only e nunca gateiam; dedup falha-para-RE-revisar** — As skills de finalize/colisão rodam em QUALQUER projeto-alvo, sem amarrar à stack deste repo. O único gate é determinístico (build+test do projeto na árvore mergeada, verify-claim-able); os agentes LLM são ADVISORY, READ-ONLY (Iron Law: leitura paraleliza, merge/código serial — R-XAGENT-03), self-check nunca self-certify. O dedup de review pula superfície só com prova POSITIVA de já-revisada; na dúvida, RE-revisa (pular por engano = false-green).

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
