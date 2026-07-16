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
lastUpdated: 2026-07-16T07:02:38-03:00
nextAction: Commit the r14 remediation checkpoint, then run the fresh Codex r15 phase review.
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
tasksDone: 8
tasksTotal: 8
gatesMet: 0
gatesTotal: 3
weightDone: 24
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
        --plan .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md
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
    status: done
    lastUpdated: 2026-07-14T20:09:41Z
    closedAt: 2026-07-14T20:09:41Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T20:09:41Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 25 pass, 0 fail; expanded analytics,
        emitter, transition and project suite 129 pass, 0 fail; validate-state
        167 files, 26 plans"
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
        path: scripts/done-transaction.js
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
    status: done
    lastUpdated: 2026-07-14T20:24:09Z
    closedAt: 2026-07-14T20:24:09Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T20:24:09Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 29 pass, 0 fail; expanded
        materialization, lifecycle and fault-injection suite 134 pass, 0 fail;
        receipt check current; validate-state 167 files, 26 plans"
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
    status: done
    lastUpdated: 2026-07-14T20:28:21Z
    closedAt: 2026-07-14T20:28:21Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T20:28:21Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 29 pass, 0 fail; expanded
        completion schema, append and union-merge suite 30 pass, 0 fail;
        canonical dispatch-log check parsed 53 records; validate-state 167
        files, 26 plans"
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
    status: done
    lastUpdated: 2026-07-14T20:32:57Z
    closedAt: 2026-07-14T20:32:57Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T20:32:57Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: exact verifier 177 pass, 0 fail; criterion
        acknowledgement uses initiative anchor, ExitCriterion rejects
        lastUpdated, reconcile docs preserve done authority; validate-state
        167 files, 26 plans"
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
- **2026-07-14 — T-005:** um `closedAt` imutável deriva a chave lógica que une
  task state, evidence, `nextAction`, handoff, refresh, completion event e
  checkpoint. O marker sobrevive a falha após state/event, `ensureCompletion`
  deduplica retries e rejeita colisões, `findCheckpoint` evita segundo commit e
  o consumidor também conta cada chave uma vez como defesa em profundidade.
- **2026-07-14 — T-006:** a projeção histórica F0 é content-addressed por
  descriptor, initiative arquivada, creation-gate, sidecars, evidence,
  completion events e close SHA, sem hashear o plano inteiro. Reparos só
  ocorrem com correspondência única e backup byte-idêntico; ambiguidade não
  escreve. F4-G3 exige o receipt atual no commit guard, e a autoridade de
  materialização exige o close SHA que já contém F4 terminal antes de ativar
  F3, bloqueando transitivamente a fase destrutiva F1.
- **2026-07-14 — T-007:** `scripts/dispatch-log.js` é o único parser/writer do
  ledger Mode 2. O writer valida identity antes de tocar o arquivo e sempre
  anexa um objeto compacto por linha; o reader mantém arrays/híbridos somente
  como compatibilidade de migração. `append-completion` apenas consome essa
  autoridade para derivar attempts, duration e escalations.
- **2026-07-14 — T-008:** `detect-completion` continua read-only e `done`
  continua a única autoridade de fechamento de task. Em `Still open`, task
  avança seu próprio `lastUpdated`; criterion, cujo schema estrito não aceita
  esse campo, avança somente o `lastUpdated` da initiative que o detector já
  usa como anchor, evitando ressinalização sem inventar estado.
- **2026-07-14 — review Codex F4 r1:** os oito majors foram aceitos e corrigidos
  na própria fase. `phase-done` ganhou marker recuperável e commit obrigatório;
  o ledger global ganhou exclusão multiprocesso e tombstone append-only;
  preflight e estado terminal hardened agora exigem identidade e evidence
  completas; e a barreira de F3 vincula receipt F0, review/gates históricos,
  evento canônico de fechamento e `closeSha`. Recovery relê a autorização e
  faz rollback quando ela fica stale. Backups determinísticos rejeitam symlink,
  e schema/writer compartilham o contrato estrito do tombstone. Nenhum finding
  foi deferido; a aprovação exige um novo review Codex no HEAD corrigido.
- **2026-07-14 — review Codex F4 r2:** os doze majors foram aceitos e corrigidos
  na própria fase, sem defer. A task list autoritativa não admite slices
  destacados; toda terminalização passa pela transação recuperável; retry após
  commit relê o marker antes do gate de novo fechamento. Review receipt agora é
  estruturado, approving, mode/artifact-exato e repository-scoped; evidence
  conflitante é ambígua, nunca reescrita. `closedAt` permanece imutável, o lock
  do ledger vincula PID à identidade de início do processo e cobre autorização
  mais publicação do sucessor. Initiative hardened exige identidade explícita,
  gate mirror é bijetivo e duplicatas são erro antes do join. A inferência de
  raiz não-Git foi corrigida para layouts flat e nested após regressão vermelha.
  O receipt r2 permanece `needs_changes`; só um review fresco do novo commit
  pode aprovar F4.
- **2026-07-14 — review Codex F4 r3:** o critical e os treze majors oficiais
  foram aceitos e corrigidos sem defer, junto de cinco defects adicionais
  válidos do audit local/tentativa expirada. Fechamentos agora serializam pela
  identidade autoritativa de task/fase, relêem estado sob lock, autenticam
  checkpoints e persistem bundle/manifesto imutáveis. Gates vêm do descriptor
  único; receipts são vinculados à barrier configurada, ao modo, à ancestry e
  ao `closeSha`; a initiative histórica também precisa estar terminal com
  tasks e mirrors fechados. Recovery finaliza sob o lock do ledger, migration
  rejeita duplicatas, `archived` mantém provenance, symlinks externos falham e
  archive não fecha nem defere trabalho plan-anchored. Decisão adicional do
  self-review: exigir manifesto do sucessor completo (identity/paths/hashes),
  vincular também o `projectId` do phase close aos dois espelhos autoritativos
  e rejeitar contrato CLI parcial. Na integração final, 28 mirrors históricos
  de evidence foram migrados a partir do descriptor autoritativo, e receipts
  legados sem `mode` no frontmatter só podem usar a declaração única e
  não-contraditória do capture manifest versionado no `closeSha`. O receipt r3
  permanece `needs_changes`; um checkpoint novo e review r4 fresco continuam
  obrigatórios.
- **2026-07-14 — review Codex F4 r4:** os cinco majors foram reproduzidos por
  oito regressões vermelhas e corrigidos sem defer. Descriptor materializado
  não-terminal não pode mais resolver para initiative terminal, e initiative
  terminal não aceita novo `done`. Retry de task já fechada reabre recovery no
  estágio state-persisted e só retorna após autenticar ou reparar seu evento e
  checkpoint originais. Reuso de phase terminal relê o review persistido no
  descriptor, o commit e o evento canônico ligados por `closeSha`, além da
  obrigação de sucessor quando presente. A barrier de F3 agora também resolve
  exatamente uma initiative F4 atual em live/archive e confere tasks e mirrors
  antes de usar o histórico. O receipt r4 permanece `needs_changes`; um
  checkpoint novo e review r5 fresco são obrigatórios para aprovar F4.
- **2026-07-14 — review Codex F4 r5:** o critical e os dez majors foram
  reproduzidos e corrigidos sem defer. Evidence de fase agora é um bundle
  candidato autenticado que atualiza os dois mirrors sem permitir drift fora
  de gate/review; recovery descobre um único marker pela identidade lógica e
  preserva o close original mesmo quando o retry muda `closedAt`. Task reuse
  usa evidence, next action e handoff persistidos e reautentica/repara o ledger
  em todos os estágios. O lock publica owner completo por hard link atômico.
  Barrier de sucessor vincula receipt ao path canônico do projeto, e ranges de
  review usam um parser compartilhado para `..`/`...`. A migração aceita paths
  Windows, rejeita IDs duplicados antes de writes e publica o conjunto sob
  manifesto durável com rollback/recovery integral e paths confinados à raiz.
  O ledger só tolera duplicata com um tombstone exato sobre digests ordenados.
  Decisões adicionais do self-review: rejeitar completion malformada no marker,
  ranges com larguras de SHA diferentes e manifesto/backup symlink ou fora da
  raiz. O receipt r5 permanece `needs_changes`; somente r6 fresco no checkpoint
  remediado pode aprovar F4.
- **2026-07-14 — review Codex F4 r6:** o critical e os quatro majors válidos
  foram reproduzidos e corrigidos sem defer. Migração agora rejeita symlink em
  qualquer componente, serializa recovery/publicação sob lock da raiz, relê o
  source sob o lock e autentica backups duráveis por digest. A barrier exige os
  bytes exatos do receipt F0 em `HEAD`, reduz closes F4 apenas por tombstone
  exato e invariants rejeitam initiative junto de descriptor pending. O sexto
  finding informado foi rejeitado: o contrato persistido separa de propósito o
  receipt F0 atual do prerequisite close F4, portanto igualar seus phase IDs
  quebraria a autoridade explícita. Self-review também tornou markers
  crash-durable, impediu emit no-op, reautenticou recovery e resolveu
  reopen/reclose pelo close lógico mais recente. O receipt r6 permanece
  `needs_changes`; somente r7 fresco no checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r7:** o critical e os dois majors informados
  foram reproduzidos e corrigidos sem defer. `phase-done` agora valida e congela
  aggregate actuals no marker antes do commit, usa o mesmo payload no emitter e
  na autenticação e ignora drift do retry. O ledger fsynca arquivo e diretório
  antes de avançar recovery, e `done` deriva dispatch actuals uma vez no bundle
  durável, inclusive para repair depois de drift. O finding cego de ancestry do
  `receipt.closeSha` foi rejeitado porque F0 receipt e F4 close são autoridades
  separadamente autenticadas. Self-review também fechou a corrida macOS
  `EINVAL` durante publicação concorrente do lock guard. O receipt r7 permanece
  `needs_changes`; somente r8 fresco no checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r8:** os quatro majors e o minor informados
  foram reproduzidos e corrigidos sem defer. Fechamentos de task agora persistem
  `completionProvenance` schema-backed por task, com next action, handoff e
  actuals imutáveis; repair sem marker nunca consulta dispatch mais novo nem
  aceita injeção de actuals ausentes. Reuso terminal de phase virou caminho
  somente de autenticação e ignora manifesto de sucessor do caller, pois marker
  removido já prova publicação/clean concluídos. Envelope inválido falha antes
  de produzir evidence. Self-review também restringiu provenance de task a
  attempts/duration/escalations e rejeita actuals exclusivos de phase antes de
  qualquer write. O receipt r8 permanece `needs_changes`; somente r9 fresco no
  checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r9:** os três criticals e quatro majors
  informados foram reproduzidos e corrigidos sem defer. Locks de migration,
  transaction e completion agora compartilham um guard process-owned; stale
  transaction reclaim relê inode/token, e migration não expõe mais a janela
  entre criar o diretório e publicar owner. Paths de ledger/lock/marker são
  confinados componente a componente e rejeitam symlink; fsync de diretório é
  pulado somente no Windows. Projeções aceitam duplicata apenas sob tombstone
  exato, manifest v1 não restaura backup sem digest, e task/phase close usam o
  mesmo lock `phase-state` por initiative. O receipt r9 permanece
  `needs_changes`; somente r10 fresco no checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r10:** três criticals e três majors do review
  informado, mais um critical conservador retido pelo operador, foram
  reproduzidos e corrigidos sem defer. Review autoritativo vem exclusivamente
  do descriptor; `closeSha` prerequisite deve pertencer à ancestry do HEAD que
  autentica o receipt; e task close valida o completion prospectivo antes de
  qualquer write, sem persistir `weightBasis` fora do ledger. Producer,
  projection e reconciliation agora compartilham validação estrita do schema de
  completion. Cada novo componente de diretório confinado é sincronizado no
  parent, e migration manifest v3 autentica backup, bytes de origem e target;
  v1/v2 e bytes concorrentes desconhecidos falham fechado. O alias explícito
  `gpt-5-codex` não estava disponível na conta, então o mesmo briefing selado
  rodou no default efetivamente reportado pelo CLI 0.144.3, `gpt-5.6-sol`, em
  high/read-only. O receipt r10 permanece `needs_changes`; somente r11 fresco
  no checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r11:** os dois criticals cegos foram rejeitados
  pelos limites explícitos de confiança e concorrência; os três majors mantidos
  e os dois majors emergentes foram reproduzidos e corrigidos sem defer.
  Migration agora deriva e segura os locks `phase-state` autoritativos e faz CAS
  imediatamente antes do primeiro publish. Completion e dispatch publicam
  appends como replacement durável completo; history e producer compartilham o
  parser schema-backed; completions ganhou `merge=union` provado por merge Git
  real; e dispatch usa path confinado, lock global e fsync de arquivo+parent.
  Self-review fechou ainda o bypass da API que permitia omitir ou mentir os
  escopos da migration: eles são derivados do target/path. O receipt r11
  permanece `needs_changes`; somente r12 fresco no checkpoint remediado pode
  aprovar F4.
- **2026-07-15 — review Codex F4 r12:** um finding de provenance Git foi
  descartado pelo limite de confiança documentado; os três criticals e dois
  majors mantidos foram reproduzidos e corrigidos sem defer. Recovery de
  migration persiste e segura escopos `phase-state` autenticados, com CAS no
  publish; task e phase close usam gerações autoritativas persistidas sem
  quebrar identidades legacy; reconciliação escolhe digests e tombstones
  estáveis, colapsa cópias equivalentes e preserva closes reais após reopen;
  dispatch lê existência sob o lock; e schema, producer e projections
  compartilham timestamp/task predicates estritos. O self-review fechou ainda
  canonicalização dependente da ordem física, drift dos mirrors de geração,
  normalização tardia de phase close e ancestry de closes equivalentes. O
  schema AIDeck gerado foi atualizado. O receipt r12 permanece
  `needs_changes`; somente r13 fresco no checkpoint remediado pode aprovar F4.
- **2026-07-15 — review Codex F4 r13:** o critical e os cinco majors foram
  reproduzidos e corrigidos sem defer. Phase close agora bloqueia markers de
  task incompletos e autentica geração, idempotency key, evento e peso de cada
  task terminal; repair da mesma task permanece permitido após terminalização,
  sem admitir novo close. O peso vem do estado autoritativo. Reuso terminal e
  successor barrier selecionam a geração espelhada, nunca o maior número ou
  toda a história. Identidades vazias e timestamps semanticamente impossíveis
  falham no parser compartilhado por producer e projections. O self-review
  acrescentou a obrigação de evento exato também para task terminal gerada. O
  receipt r13 permanece `reject` como veredito selado e registra a remediação;
  somente r14 fresco no novo checkpoint pode aprovar F4.
- **2026-07-16 — review Codex F4 r14:** os dois criticals informados foram
  reproduzidos e corrigidos sem defer. Task close, phase close, migration e
  materialização agora compartilham lock por plano com ordem explícita e
  capability inforjável para o uso aninhado; fases paralelas não leem snapshots
  concorrentes e um writer coordenado não é sobrescrito pelo materializador.
  O manifesto sucessor fica ligado aos paths canônicos, identidade e hashes dos
  bytes candidatos, persiste no marker e gera evidence autenticada contra os
  arquivos vivos antes do coordinator avançar. No-op e evidence forjada sem
  publicação preservam recovery. O receipt
  r14 permanece `needs_changes` como veredito selado e registra a remediação;
  somente r15 fresco no novo checkpoint pode aprovar F4.

## Session handoff

- **Narrative:** F4 concluiu T-001..T-008 e remediou todos os findings válidos
  dos reviews r1..r14, além dos hardenings proativos e correções de integração.
  No r14, 2 criticals foram aceitos e corrigidos sob regressões vermelhas. Lock
  por plano e provenance do manifesto sucessor fecham as novas lacunas. Falta o
  review Codex r15 do checkpoint remediado.
- **Decision log:** nenhum finding válido r1..r14 foi deferido. A ordem comum é
  plan-state → phase-state → materialização/completion; reentrada existe apenas
  por capability explícita, ativa e de escopo exato. O manifesto sucessor é
  autoridade somente quando paths, identidade e hashes dos bytes candidatos
  coincidem e o coordinator autentica a publication evidence. O servidor
  AIDeck existente não foi reiniciado; loader, schema e estado canônico passaram.
- **Single nextAction:** Commit the r14 remediation checkpoint, then run the fresh Codex r15 phase review.
- **Verbatim state:** review r14 → blind 0B/2C/1M/0m e informed 0B/2C/0M/0m;
  2 findings aceitos e corrigidos; focused 85/85; exact gates → 42/42 + 72/72 +
  78/78 pass; full repository suite → 1,987 pass, 0 fail, 8 skip; canonical
  AIDeck state → 26 planos válidos; receipt F0 plan-bound → `ok: true` e
  `consistent`.
- **Uncommitted changes:** remediação r14, testes, docs, receipt e decisões F4
  estão prontos para checkpoint e review Codex r15.

## Links

_(plan doc, external refs)_
