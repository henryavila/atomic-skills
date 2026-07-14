---
schemaVersion: "0.1"
slug: integrity-remediation-f4-autoridade-de-estado-e-transicoes-recu
title: Autoridade de estado e transições recuperáveis
goal: Reconciliar o bootstrap F0 e fazer validator, transition helpers e
  comandos de fechamento compartilharem invariantes estritas e gravarem estado,
  evidence, eventos, handoff e materialização de forma idempotente.
summary: Reconcilia F0 e torna fechamento, eventos e materialização idempotentes.
status: active
branch: plan/integrity-remediation
started: 2026-07-14T19:36:31Z
startedCommit: 67bd6e4a9d63b748321e51565e570514290a81a1
lastUpdated: 2026-07-14T20:02:12Z
nextAction: Run `done T-005` after making task close, completion event and handoff idempotent.
parentPlan: integrity-remediation
phaseId: F4
businessIntent:
  value: Impedir estado parcial, obsoleto ou contraditório e tornar transições
    críticas recuperáveis sem intervenção manual.
  workflow: Validar estado, fechar tasks e fases, emitir completion events,
    reconciliar o bootstrap F0 e materializar sucessoras.
  rules: Uma autoridade por mutação; nenhuma transição terminal com task ou gate
    aberto; evidence e review ancorados ao SHA; retries idempotentes;
    ambiguidade falha fechado.
  outOfScope: Installer upstream, contratos de host, Gemini, qualificação de
    release e qualquer push, PR ou publicação externa.
  doneWhen: Os oito tasks e F4-G1..G3 passam com fault injection, receipt F0
    atual, fechamento idempotente e ativação de F3 protegida contra bypass.
tasksDone: 4
tasksTotal: 8
gatesMet: 0
gatesTotal: 3
weightDone: 12
weightTotal: 24
exitGates:
  - id: F4-G1
    description: Validator rejeita identidades, DAGs, IDs e estados terminais
      contraditórios e preserva descriptor lazy válido. FAILS when qualquer
      fixture inválido retorna exit 0 ou descriptor-only pending é rejeitado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/validate-state-integrity.test.js
        tests/state-integrity-migration.test.js
        tests/transition-integrity.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/validate-state-integrity.test.js tests/st…"
  - id: F4-G2
    description: Task e phase close são idempotentes e não deixam writes, eventos ou
      evidence stale. FAILS when retry duplica analytics ou review muda HEAD sem
      rerun.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-done-transaction.test.js
        tests/done-transaction.test.js tests/append-completion-actuals.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/phase-done-transaction.test.js tests/done…"
  - id: F4-G3
    description: Materialize e dispatch-log sobrevivem fault injection, e a
      reconciliação F0 é não deferível e exigida também ao ativar F3. FAILS when
      plan/initiative divergem, log deixa de ser NDJSON, defer/skip fecha F4,
      completion/evidence/closeSha de F0 ficam fora do receipt ou F3 ativa com
      receipt stale.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-materialization/materialize-transaction.test.js
        tests/phase-materialization/materialize-history-reconcile.test.js
        tests/phase-materialization/materialize-successor-barrier.test.js
        tests/lifecycle-gate-bypass.test.js
        tests/append-completion-dispatchlog.test.js && node
        scripts/materialize-state.js --check-history-receipt
        docs/audits/integrity-remediation-f0-reconciliation.json
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/phase-materialization/materialize-transac…"
stack:
  - id: 1
    title: Autoridade de estado e transições recuperáveis
    type: task
    openedAt: 2026-07-14T19:36:31Z
tasks:
  - id: T-001
    title: Centralizar identidade, terminalidade e unicidade
    summary: Unifica invariantes de identidade, terminalidade e IDs com migração
      conservadora.
    weight: 4
    description: "Criar uma autoridade pura para join por project-plan-phase, status
      terminal e IDs únicos; preservar descriptor lazy válido e fornecer
      diagnóstico/migração conservadora com error codes estáveis para shapes
      legados. verified_by: `scripts/validate-state.js:398-605`,
      `scripts/lint-source.js:178-324`, `src/decompose.js:444-709`,
      `meta/schemas/plan.schema.json:202-262` e
      `projects/atomic-skills/integrity-remediation/design.md:210-224`."
    status: done
    lastUpdated: 2026-07-14T19:43:49Z
    closedAt: 2026-07-14T19:43:49Z
    scopeBoundary:
      - não ligar initiative apenas por slug, não exigir initiative de
        descriptor lazy válido, não tolerar gate pending em fase terminal, não
        aceitar IDs duplicados e não coagir estado legado contraditório
    acceptance:
      - descriptor-only pending com sidecar passa;
        materialized/active/paused/done sem initiative, identity mismatch, slug
        collision, IDs duplicados e done com gate pending retornam error codes
        estáveis; o corpus legacy roda em dry-run e `--apply` migra apenas
        shapes não ambíguos com backup byte a byte
    verifier:
      kind: shell
      command: node --test tests/validate-state.test.js tests/lint-source.test.js
        tests/decompose.test.js tests/validate-state-integrity.test.js
        tests/state-integrity-migration.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T19:43:49Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 221 tests, 18 suites, 221 pass, 0 fail;
        validate-state full tree: 167 files, 26 plans cross-validated"
    outputs:
      - kind: file
        path: src/state-invariants.js
      - kind: file
        path: scripts/validate-state.js
      - kind: file
        path: scripts/lint-source.js
      - kind: file
        path: src/decompose.js
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: meta/schemas/initiative.schema.json
      - kind: file
        path: tests/validate-state.test.js
      - kind: file
        path: tests/lint-source.test.js
      - kind: file
        path: tests/decompose.test.js
      - kind: file
        path: tests/validate-state-integrity.test.js
      - kind: file
        path: scripts/migrate-state-integrity.js
      - kind: file
        path: tests/state-integrity-migration.test.js
  - id: T-002
    title: Separar complete, ready e blocked no grafo
    summary: Distingue grafo completo, pronto e bloqueado sem ordenar fases pelo ID.
    weight: 2
    description: "Validar DAG, self dependency e ciclos e retornar plan completion
      somente quando todas as fases forem terminais. verified_by:
      `src/transition.js:67-79,90-103,127-134`."
    status: done
    lastUpdated: 2026-07-14T19:47:50Z
    closedAt: 2026-07-14T19:47:50Z
    scopeBoundary:
      - não converter zero eligible em plan-done e não avançar com dependência
        desconhecida, cíclica ou contraditória
    acceptance:
      - active sibling, paused phase e pending cycle retornam blocked/open;
        self-loop e ciclos de dois/três nós falham; apenas todas terminalizadas
        retornam complete
      - o DAG linear não numérico F0→F4→F3→F1→F2→F5→F6 elege exatamente uma fase
        por vez na ordem de dependsOn, nunca por ordenação do ID
    verifier:
      kind: shell
      command: node --test tests/transition.test.js tests/transition-integrity.test.js
        tests/validate-state.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T19:47:50Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 109 tests, 3 suites, 109 pass, 0 fail;
        non-numeric DAG advanced F0→F4→F3→F1→F2→F5→F6"
    outputs:
      - kind: file
        path: src/transition.js
      - kind: file
        path: src/state-invariants.js
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: tests/transition.test.js
      - kind: file
        path: tests/transition-integrity.test.js
      - kind: file
        path: tests/validate-state.test.js
  - id: T-003
    title: Dividir phase-done em preflight e commit guard sem bypass
    summary: Separa preflight e commit guard e elimina bypass terminal de gates.
    weight: 4
    description: "Executar preflight puro antes de gates/review e commit guard após
      evidence/lessons, removendo o bulk-close de tasks abertas e qualquer
      avanço por defer/skip de exit gate. Gate pending, failed, declined ou sem
      evidence atual mantém a fase aberta/pausável e produz zero transição
      terminal. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:107-137`,
      `skills/shared/project-assets/project-transitions.md:164-210`,
      `scripts/lifecycle-order-guard.js:236-289` e
      `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:232-257`\
      ."
    status: done
    lastUpdated: 2026-07-14T19:54:55Z
    closedAt: 2026-07-14T19:54:55Z
    scopeBoundary:
      - não rodar gate verifier, review, evento, archive ou write quando task
        está aberta e não exigir review completo no preflight inicial
      - não oferecer defer/skip como transição terminal; a única saída sem gate
        verde é deixar a fase active ou paused
    acceptance:
      - preflight valida identity/DAG/tasks e permite produção de evidence;
        commit exige todos os gates passed, review/lessons e fingerprint atual;
        task aberta resulta em zero writes/events/commits
      - tentativas de defer, skip, status edit e chamada direta do advance com
        F4-G3 pending/failed geram zero close write/event, não tornam F4
        terminal e não materializam F3
    verifier:
      kind: shell
      command: node --test tests/lifecycle-order-guard.test.js
        tests/lifecycle-gate-bypass.test.js tests/transition-emits.test.js
        tests/phase-done-transaction.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T19:54:55Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 36 pass, 0 fail; expanded project
        contract 110 pass, 0 fail; validate-state 167 files, 26 plans"
    outputs:
      - kind: file
        path: scripts/lifecycle-order-guard.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/lifecycle-order-guard.test.js
      - kind: file
        path: tests/transition-emits.test.js
      - kind: file
        path: tests/phase-done-transaction.test.js
      - kind: file
        path: tests/lifecycle-gate-bypass.test.js
  - id: T-004
    title: Ancorar gates e review ao HEAD fechado
    summary: Ancora evidence e review ao commit exato que será fechado.
    weight: 2
    description: "Gravar SHA verificável em evidence/reviewGate e rerodar exit gates
      quando review aplica fixes ou muda HEAD. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:154-164` e
      `scripts/validate-state.js:484-506`."
    status: done
    lastUpdated: 2026-07-14T20:02:12Z
    closedAt: 2026-07-14T20:02:12Z
    scopeBoundary:
      - não aceitar string arbitrária como SHA e não reutilizar evidence
        anterior a um commit de review
    acceptance:
      - passed review exige SHA existente, mode e reviewFile coerentes; gate
        evidence carrega verifiedCommit; mudança de HEAD invalida e reroda
        verifiers antes do commit guard
    verifier:
      kind: shell
      command: node --test tests/validate-state.test.js
        tests/phase-done-transaction.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T20:02:12Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 95 pass, 0 fail; expanded lifecycle
        suite 119 pass, 0 fail; validate-state 167 files, 26 plans"
    outputs:
      - kind: file
        path: meta/schemas/common.schema.json
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: scripts/validate-state.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/verifier-exec.md
      - kind: file
        path: tests/validate-state.test.js
      - kind: file
        path: tests/phase-done-transaction.test.js
  - id: T-005
    title: Tornar done, evento e handoff idempotentes
    summary: Torna fechamento, evento e handoff uma operação idempotente e recuperável.
    weight: 4
    description: "Persistir close state, evidence, nextAction/handoff e completion
      event sob uma idempotency key e um recovery boundary único. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:165-185`."
    status: pending
    lastUpdated: 2026-07-14T19:36:31Z
    scopeBoundary:
      - não append evento antes de state durável e não criar segundo close
        commit para corrigir handoff
    acceptance:
      - retry do mesmo close gera um evento lógico e rollup igual a um, failure
        marker permite resume, e o checkpoint contém status, evidence,
        nextAction e handoff com worktree limpa
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js
        tests/emit-on-transition.test.js tests/done-transaction.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: scripts/append-completion.js
      - kind: file
        path: scripts/emit-consumer-state.js
      - kind: file
        path: meta/schemas/completion-event.schema.json
      - kind: file
        path: tests/append-completion.test.js
      - kind: file
        path: tests/emit-on-transition.test.js
      - kind: file
        path: tests/done-transaction.test.js
  - id: T-006
    title: Consolidar materialização e reconciliar o bootstrap F0
    summary: Reconcilia F0 e consolida materialização sob uma única autoridade
      transacional.
    weight: 5
    description: "Ampliar a única autoridade `scripts/materialize-state.js` criada
      em F0/T-005 para todos os fault points, recovery por creation-gate e
      reconciliação conservadora; gerar um receipt versionado da projeção F0
      incluindo gate evidence, completion events e close SHA, e fazer a
      ativação/materialização de F3 reler esse receipt e o fechamento não
      deferido de F4. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:219-229` e
      `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:232-257`\
      ."
    status: pending
    lastUpdated: 2026-07-14T19:36:31Z
    scopeBoundary:
      - não criar um segundo writer/reconciler; bootstrap, hardening, recovery e
        check do receipt usam scripts/materialize-state.js
      - não reparar estado ambíguo e não hashear o plan.md inteiro; o digest
        cobre descriptor F0, initiative F0, sidecars esperados, creation-gate,
        gate evidence, completion events e close SHA
    acceptance:
      - fault injection em cada boundary converge para estado anterior ou par
        completo usando marker idempotente
      - reconcile classifica F0 como consistent, repairable ou ambiguous;
        duplicate completion event/evidence stale só é reparável quando a
        logical close identity e o close SHA fornecem correspondência única,
        ambiguous falha sem writes e repairable mantém backup byte a byte
      - o receipt registra digest canônico da projeção F0, hashes antes/depois,
        ids/digests de evidence e completion events, closeSha, reconciledCommit
        e creation-gate; alteração posterior invalida o check
      - F4-G3 não aceita defer/skip e bloqueia phase-done sem receipt atual;
        materializar/ativar F3 exige receipt válido, F4 terminal por commit
        guard e closeSha coerente, portanto F3 e a fase destrutiva F1 não
        iniciam por bypass
    verifier:
      kind: shell
      command: node --test tests/phase-materialization/materialize-verb.test.js
        tests/phase-materialization/materialize-transaction.test.js
        tests/phase-materialization/materialize-history-reconcile.test.js
        tests/phase-materialization/materialize-successor-barrier.test.js
        tests/lifecycle-gate-bypass.test.js && node scripts/materialize-state.js
        --check-history-receipt
        docs/audits/integrity-remediation-f0-reconciliation.json
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: scripts/materialize-state.js
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/phase-materialization/materialize-verb.test.js
      - kind: file
        path: tests/phase-materialization/materialize-transaction.test.js
      - kind: file
        path: tests/phase-materialization/materialize-history-reconcile.test.js
      - kind: file
        path: tests/phase-materialization/materialize-successor-barrier.test.js
      - kind: file
        path: docs/audits/integrity-remediation-f0-reconciliation.json
  - id: T-007
    title: Unificar dispatch-log em NDJSON
    summary: Padroniza dispatch-log como NDJSON validado e observável.
    weight: 2
    description: "Usar um writer/parser de linha único, validar cada record e
      recuperar actuals sem anexar array JSON ao log. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:203-218`."
    status: pending
    lastUpdated: 2026-07-14T19:36:31Z
    scopeBoundary:
      - não parsear o arquivo inteiro como array e não ignorar silenciosamente
        linha inválida
    acceptance:
      - log contém somente objetos NDJSON, corrupção identifica número da linha,
        e attempts/duration/escalations conhecidos chegam ao completion event
    verifier:
      kind: shell
      command: node --test tests/append-completion-dispatchlog.test.js
        tests/append-completion-actuals.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/mode2-codex-lane.md
      - kind: file
        path: scripts/append-completion.js
      - kind: file
        path: scripts/dispatch-log.js
      - kind: file
        path: tests/append-completion-dispatchlog.test.js
      - kind: file
        path: tests/append-completion-actuals.test.js
  - id: T-008
    title: Corrigir reconcile e nomenclatura de closure
    summary: Preserva schema no reconcile e mantém done como autoridade única de
      closure.
    weight: 1
    description: "Manter ExitCriterion strict ao reconhecer `Still open` e
      documentar reconcile como único mutation path disparado por detection
      drift, preservando done como closure authority. verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:274-281,311-315`."
    status: pending
    lastUpdated: 2026-07-14T19:36:31Z
    scopeBoundary:
      - não gravar `lastUpdated` em ExitCriterion e não criar uma terceira
        autoridade de fechamento
    acceptance:
      - Still open atualiza somente anchor suportado sem invalidar schema,
        candidato não reaparece imediatamente e docs distinguem
        detection-trigger de closure authority
    verifier:
      kind: shell
      command: node --test tests/detect-completion.test.js tests/project.test.js
        tests/validate-state.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: scripts/detect-completion.js
      - kind: file
        path: meta/schemas/common.schema.json
      - kind: file
        path: tests/detect-completion.test.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/validate-state.test.js
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Autoridade de estado e transições recuperáveis**.

## Decisions

- **2026-07-14 — gate de lessons:** L-002, L-003 e L-004 foram aplicadas sob a
  delegação do usuário. F4 deve provar ownership antes de cleanup, publicar
  candidatos semanticamente completos sob expected-before e manter um único
  formato/authority para logs, rollups e transições.
- **2026-07-14 — ratificação da materialização:** o business intent, os oito
  summaries, pesos 4/2/4/2/4/5/2/1 e o `nextAction` foram ratificados pela
  alternativa conservadora: maior peso para invariantes, commit guard,
  idempotência e reconciliação F0; menor peso para correções localizadas. A
  transação plan+initiative publicou o par com `startedCommit: 67bd6e4`.
- **2026-07-14 — autoridade e escopo:** F4 não cria um segundo reconciler, não
  admite defer/skip terminal, não altera installer/hosts/Gemini/release e não
  executa push, PR ou publicação externa.
- **2026-07-14 — T-001:** o hardening estrito é forward-only por plano via
  `stateIntegrityHardening.enforcedFrom`; assim o corpus legado continua
  legível e diagnosticável, enquanto este plano falha em identidades explícitas
  conflitantes, IDs duplicados, estado materializado sem initiative e
  terminalidade aberta. A migração só preenche `parentPlan`/`phaseId` quando há
  uma correspondência única e cria backup byte-idêntico antes de `--apply`.
- **2026-07-14 — T-002:** `proposeAdvance` agora retorna `plan-done` somente
  quando todas as fases são terminais. Zero elegíveis com fase active, paused,
  dependência desconhecida/self/cíclica retorna `blocked` com códigos estáveis;
  a ordem vem exclusivamente de `dependsOn`, nunca do ID numérico.
- **2026-07-14 — T-003:** `phase-done` foi dividido em preflight puro e commit
  guard com fresh-read. O preflight bloqueia identity/DAG/task aberta antes de
  qualquer efeito; o commit guard só aceita gates `met` com evidence passando,
  review `passed` no HEAD atual, worktree limpa e lessons respondidas. Não há
  defer/skip terminal nem bulk-close: cada task fecha e emite no fluxo `done`, e
  `phase-done` emite apenas o agregado da fase.
- **2026-07-14 — T-004:** planos hardened agora exigem SHA git completo e
  existente, `reviewGate.mode`, receipt local coerente e
  `evidence.verifiedCommit` igual ao HEAD revisado nos dois espelhos do gate.
  Evidence, receipt e lessons permanecem candidatos em memória até o commit de
  fechamento, evitando referência circular ao SHA do próprio commit; qualquer
  fix de review que mova HEAD invalida os gates e força sua reexecução.

## Links

_(plan doc, external refs)_
