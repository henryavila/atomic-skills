---
schemaVersion: "0.1"
slug: sugestao-necessidade-pdti
title: Sugestão de necessidade de PDTI
version: "1.0"
status: active
started: 2026-08-11T20:34:22.135Z
lastUpdated: 2026-08-12T01:21:48.643Z
branch: plan/sugestao-necessidade-pdti
executionMode: automate
currentPhase: F3
parallelismAllowed: false
principles:
  - id: P1
    title: Uma entidade, dois origins
    body: Continuar em `ItRequestsPdti` com `origin` (`user_request` | `getin_suggestion`) e `area_id`; sem model paralelo.
  - id: P2
    title: Status de sugestão separados
    body: Status 10 (pendente) e 11 (recusada); aceite do líder vira `STATUS_NEW_REQUEST` (1), nunca status 2 (aceite GETIN).
  - id: P3
    title: Aceite = adoção com ownership
    body: No create grava `created_by` (write-once) e `user_id` do criador GETIN; no aceite transfere `user_id` ao manager da `area_id`; `origin` permanece `getin_suggestion`.
  - id: P4
    title: area_id manda no funil
    body: Com `area_id` preenchido, call sites do funil preferem essa área (não `user->areas->first()`).
  - id: P5
    title: Validação do líder só Livewire
    body: Zero reuso de `AcceptOrRefuseRequestToPdtiAction` no papel do líder; create GETIN só via Nova Action e gerente GETIN.
  - id: P6
    title: Auth com sessão
    body: Livewire com middleware `auth` + policy; mutações e leitura da sugestão pendente exigem manager da área.
glossary:
  - term: Sugestão GETIN
    definition: Registro `ItRequestsPdti` com `origin=getin_suggestion` e status 10 ou 11.
  - term: Adoção
    definition: "Aceite do líder: status 1 + `user_id` do manager da área-alvo."
  - term: created_by
    definition: Usuário GETIN que criou a sugestão; imutável após create.
  - term: respondToSuggestion
    definition: Ability de leitura e mutação Livewire (manager da `area_id` + status 10).
phases:
  - id: F0
    slug: sugestao-necessidade-pdti-f0-fundacao-schema-model-policy
    title: Fundação schema model policy
    goal: Persistência e regras de domínio da sugestão (colunas, constants, boot, policies, labels de status) sem UI de create/validação ainda.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Migration aplica origin, area_id, created_by, suggestion_refuse_reason e status 10/11 no model com labels.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFoundationTest.php
            expectExitCode: 0
          metAt: 2026-08-12T00:41:30.892Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-12T00:41:30.892Z
            verifiedCommit: f704c409772e0fcc580da4b6797128d57b64cbdd
            passed: true
            exitCode: 0
            testsCollected: 10
            outputSummary: "Tests: 10 deprecated (23 assertions) exit 0"
        - id: G-2
          description: Policy createSuggestion só gerente GETIN; respondToSuggestion só manager da area_id com status 10; create genérico continua false.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionPolicyTest.php
            expectExitCode: 0
          metAt: 2026-08-12T00:41:30.892Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-12T00:41:30.892Z
            verifiedCommit: f704c409772e0fcc580da4b6797128d57b64cbdd
            passed: true
            exitCode: 0
            testsCollected: 8
            outputSummary: "Tests: 8 deprecated (13 assertions) exit 0"
    status: done
    businessIntent:
      value: A GETIN propõe necessidade de PDTI a qualquer área; o líder adota ou recusa sem operar o Nova.
      workflow: "Gerente GETIN cria sugestão via Nova Action → e-mail ao manager da área com conteúdo plain + CTA → Livewire autenticada (ver, editar conteúdo, aceitar ou recusar) → aceite: status NEW_REQUEST e ownership no líder; recusa: status 11 e notifica GETIN."
      rules: origin getin_suggestion + area_id; status 10/11; created_by no create (write-once); aceite não usa status 2; createSuggestion só gerente GETIN; respondToSuggestion = manager da area_id + status 10; funil prefere area_id; AcceptOrRefuse por status, não por origin.
      outOfScope: Filament nesta entrega; validação do líder no Nova; comitê/consolidação além do funil; mobile/push; reabrir Policy create genérico; corrigir bugs pré-existentes de e-mail de diretor; multi-manager; reabrir status 11.
      doneWhen: Pest foundation e policy passam (exit 0); migration aplica origin/area_id/created_by/suggestion_refuse_reason; model expõe status 10/11 em statusList; createSuggestion e respondToSuggestion comportam-se conforme G-1/G-2 desta fase.
    summary: Schema, model e policies da sugestão PDTI, sem UI.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/evaluation-sugestao-necessidade-pdti-F0-20260812.md
      verifiedAt: 2026-08-12T00:33:07.532Z
      at: f704c409772e0fcc580da4b6797128d57b64cbdd
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: f704c409772e0fcc580da4b6797128d57b64cbdd
      verifiedAt: 2026-08-12T00:39:44.781Z
      reviewFile: .atomic-skills/reviews/2026-08-12-f0-both.md
      localReceiptPath: .atomic-skills/reviews/2026-08-12-f0-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-12-f0-grok.md
      legs:
        - provider: local
          path: .atomic-skills/reviews/2026-08-12-f0-local.md
        - provider: grok
          path: .atomic-skills/reviews/2026-08-12-f0-grok.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-12T00:39:44.781Z
      packagePresentedAt: 2026-08-12T00:39:44.781Z
      packagePath: .atomic-skills/reviews/decision-package-F0-20260812.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-sugestao-necessidade-pdti-F0-20260812.md
      verdict: CLOSED
      verifiedAt: 2026-08-12T00:39:44.781Z
  - id: F1
    slug: sugestao-necessidade-pdti-f1-create-getin-e-e-mail
    title: Create GETIN e e-mail
    goal: Gerente GETIN cria sugestão via Nova Action e o manager da área recebe e-mail com conteúdo plain e CTA para a Livewire.
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Action cria registro origin getin_suggestion status 10 com created_by e user_id do criador e area_id; falha sem manager único.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/SuggestPdtiNeedActionTest.php
            expectExitCode: 0
          metAt: 2026-08-12T00:57:32.795Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-12T00:57:32.795Z
            verifiedCommit: e424497635ecf7bc4cfa81c49303cb0386865c52
            passed: true
            exitCode: 0
            testsCollected: 6
            outputSummary: SuggestPdtiNeedActionTest exit 0
        - id: G-2
          description: Notification envia plain text (strip de description/justify) e CTA com URL nomeada pdti.suggestion.respond (rota mínima pode ser registrada em F1; Livewire full-page em F2).
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionNotificationTest.php
            expectExitCode: 0
          metAt: 2026-08-12T00:57:32.795Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-12T00:57:32.795Z
            verifiedCommit: e424497635ecf7bc4cfa81c49303cb0386865c52
            passed: true
            exitCode: 0
            testsCollected: 6
            outputSummary: PdtiSuggestionNotificationTest exit 0
    status: done
    summary: Gerente GETIN cria sugestão via Nova Action e o manager da área recebe e-mail com conteúdo plain e CTA para a Livewire.
    businessIntent:
      value: Gerente GETIN cria sugestão de necessidade PDTI para qualquer área e o manager da área recebe e-mail plain com CTA para validar na Livewire.
      workflow: Gerente GETIN abre Nova Action no resource → preenche area/problem/description/justify/objectives → Action grava origin getin_suggestion status 10 created_by/user_id → notification plain-text + CTA pdti.suggestion.respond ao manager único da área.
      rules: createSuggestion só gerente GETIN; area sem exatamente um manager falha; origin getin_suggestion status 10; created_by e user_id do criador; notification strip HTML description/justify; CTA rota nomeada pdti.suggestion.respond; statusList/filter 10/11; sem AcceptOrRefuse no papel do líder; sem temporarySignedRoute.
      outOfScope: Livewire full-page (F2); funil area_id (F3); Filament; reabrir fields() create genérico; multi-manager fallback; temporarySignedRoute auth.
      doneWhen: SuggestPdtiNeedActionTest e PdtiSuggestionNotificationTest pest exit 0; action grava campos e falha sem manager único; notification plain + CTA; filter default 10 true 11 false.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/evaluation-sugestao-necessidade-pdti-F1-20260812.md
      verifiedAt: 2026-08-12T00:57:32.795Z
      at: e424497635ecf7bc4cfa81c49303cb0386865c52
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: e424497635ecf7bc4cfa81c49303cb0386865c52
      verifiedAt: 2026-08-12T00:57:32.795Z
      reviewFile: .atomic-skills/reviews/2026-08-12-f1-both.md
      localReceiptPath: .atomic-skills/reviews/2026-08-12-f1-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-12-f1-grok.md
      legs:
        - provider: local
          path: .atomic-skills/reviews/2026-08-12-f1-local.md
        - provider: grok
          path: .atomic-skills/reviews/2026-08-12-f1-grok.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-12T00:57:32.795Z
      packagePresentedAt: 2026-08-12T00:57:32.795Z
      packagePath: .atomic-skills/reviews/decision-package-F1-20260812.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-sugestao-necessidade-pdti-F1-20260812.md
      verdict: CLOSED
      verifiedAt: 2026-08-12T00:57:32.795Z
  - id: F2
    slug: sugestao-necessidade-pdti-f2-livewire-do-lider
    title: Livewire do líder
    goal: Página Livewire autenticada para o manager ver, editar conteúdo, aceitar (adoção) ou recusar a sugestão pendente.
    dependsOn:
      - F1
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Manager da area_id com status 10 aceita e obtém user_id do manager status 1 origin inalterado created_by inalterado.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php
            expectExitCode: 0
          metAt: 2026-08-12T01:09:00.210Z
          evidence: &a1
            verifierKind: shell
            verifiedAt: 2026-08-12T01:09:00.210Z
            verifiedCommit: 4d6fc3461a249bd6dd45712fb93b5f431cec0e58
            passed: true
            exitCode: 0
            testsCollected: 16
            outputSummary: PdtiSuggestionLivewireTest 16 tests exit 0
        - id: G-2
          description: Recusa grava status 11 e notifica created_by e gerente GETIN se distinto; double accept/refuse rejeitado.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php
            expectExitCode: 0
          metAt: 2026-08-12T01:09:00.210Z
          evidence: *a1
    status: done
    summary: Página Livewire autenticada para o manager ver, editar conteúdo, aceitar (adoção) ou recusar a sugestão pendente.
    businessIntent:
      value: Manager da área valida sugestão GETIN em página Livewire autenticada (ver, editar, aceitar ou recusar) sem usar Nova.
      workflow: Manager abre rota pdti.suggestion.respond autenticada → vê sugestão status 10 → edita conteúdo permitido → aceita (status 1 + user_id manager, origin/created_by intactos) ou recusa (status 11 + notifica GETIN).
      rules: auth + respondToSuggestion; mutações só status 10 e manager da area_id; accept não usa status 2 nem AcceptOrRefuse; refuse notifica created_by e gerente GETIN se distinto; double accept/refuse rejeitado; campos editáveis fechados.
      outOfScope: UI Nova para líder; funil area_id (F3); Filament; reabrir status 11; temporarySignedRoute.
      doneWhen: PdtiSuggestionLivewireTest pest exit 0 para accept ownership e refuse notification + double action reject.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/evaluation-sugestao-necessidade-pdti-F2-20260812.md
      verifiedAt: 2026-08-12T01:09:00.210Z
      at: 4d6fc3461a249bd6dd45712fb93b5f431cec0e58
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: 4d6fc3461a249bd6dd45712fb93b5f431cec0e58
      verifiedAt: 2026-08-12T01:09:00.210Z
      reviewFile: .atomic-skills/reviews/2026-08-12-f2-both.md
      localReceiptPath: .atomic-skills/reviews/2026-08-12-f2-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-12-f2-grok.md
      legs:
        - provider: local
          path: .atomic-skills/reviews/2026-08-12-f2-local.md
        - provider: grok
          path: .atomic-skills/reviews/2026-08-12-f2-grok.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-12T01:09:00.210Z
      packagePresentedAt: 2026-08-12T01:09:00.210Z
      packagePath: .atomic-skills/reviews/decision-package-F2-20260812.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-sugestao-necessidade-pdti-F2-20260812.md
      verdict: CLOSED
      verifiedAt: 2026-08-12T01:09:00.210Z
  - id: F3
    slug: sugestao-necessidade-pdti-f3-funil-area-id-e-regressao
    title: Funil area_id e regressão
    goal: Call sites do funil preferem area_id; AcceptOrRefuse e observer respeitam a matriz; job de comissão e regressões cobertos.
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: AcceptOrRefuse e ConvertItRequest usam area_id quando preenchido; AcceptOrRefuse disponível em status 1 com origin getin_suggestion.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php
            expectExitCode: 0
          metAt: 2026-08-12T01:21:48.643Z
          evidence: &a2
            verifierKind: shell
            verifiedAt: 2026-08-12T01:21:48.643Z
            verifiedCommit: 090f453ba36f3267fd227f178e0c491f43c45c9c
            passed: true
            exitCode: 0
            testsCollected: 9
            outputSummary: FunnelTest 9 tests exit 0
        - id: G-2
          description: Observer 4→5 continua após adoção; boot user_id não quebra job de comissão; status 10/11 não disparam AcceptOrRefuse GETIN.
          status: met
          verifier:
            kind: shell
            command: ./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php
            expectExitCode: 0
          metAt: 2026-08-12T01:21:48.643Z
          evidence: *a2
    status: done
    summary: Call sites do funil preferem area_id; AcceptOrRefuse e observer respeitam a matriz; job de comissão e regressões cobertos.
    businessIntent:
      value: Após adoção, funil PDTI prefere area_id da sugestão e AcceptOrRefuse/observer/job de comissão permanecem corretos.
      workflow: Pedido adotado status 1 com area_id → AcceptOrRefuse GETIN e ConvertItRequest usam area_id → observer 4→5 funciona → job comissão não quebra com boot user_id condicional.
      rules: Prefer area_id quando preenchido; AcceptOrRefuse por status não origin; indisponível em 10/11; disponível em 1 com origin getin_suggestion; observer não força 5 em status 10; boot user_id só se vazio.
      outOfScope: Corrigir bug e-mail diretor pré-existente além de area_id; Filament; comitê.
      doneWhen: ItRequestsPdtiSuggestionFunnelTest pest exit 0 para G-1 e G-2.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/evaluation-sugestao-necessidade-pdti-F3-20260812.md
      verifiedAt: 2026-08-12T01:21:48.643Z
      at: 090f453ba36f3267fd227f178e0c491f43c45c9c
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: 090f453ba36f3267fd227f178e0c491f43c45c9c
      verifiedAt: 2026-08-12T01:21:48.643Z
      reviewFile: .atomic-skills/reviews/2026-08-12-f3-both.md
      localReceiptPath: .atomic-skills/reviews/2026-08-12-f3-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-08-12-f3-grok.md
      legs:
        - provider: local
          path: .atomic-skills/reviews/2026-08-12-f3-local.md
        - provider: grok
          path: .atomic-skills/reviews/2026-08-12-f3-grok.md
    decisionReview:
      status: passed
      verifiedAt: 2026-08-12T01:21:48.643Z
      packagePresentedAt: 2026-08-12T01:21:48.643Z
      packagePath: .atomic-skills/reviews/decision-package-F3-20260812.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-sugestao-necessidade-pdti-F3-20260812.md
      verdict: CLOSED
      verifiedAt: 2026-08-12T01:21:48.643Z
references: []
planActive: true
planTitle: Sugestão de necessidade de PDTI
---
# Sugestão de necessidade de PDTI

## 1. Context

Permitir que a GETIN proponha uma necessidade de PDTI a qualquer área e que o líder valide por e-mail + página Livewire (ver, editar, aceitar ou recusar), reutilizando `ItRequestsPdti` com origem e status dedicados, sem validação do líder no Nova e sem Filament nesta entrega.

## 2. Inviolable principles

- **P1 Uma entidade, dois origins** — Continuar em `ItRequestsPdti` com `origin` (`user_request` | `getin_suggestion`) e `area_id`; sem model paralelo.
- **P2 Status de sugestão separados** — Status 10 (pendente) e 11 (recusada); aceite do líder vira `STATUS_NEW_REQUEST` (1), nunca status 2 (aceite GETIN).
- **P3 Aceite = adoção com ownership** — No create grava `created_by` (write-once) e `user_id` do criador GETIN; no aceite transfere `user_id` ao manager da `area_id`; `origin` permanece `getin_suggestion`.
- **P4 area_id manda no funil** — Com `area_id` preenchido, call sites do funil preferem essa área (não `user->areas->first()`).
- **P5 Validação do líder só Livewire** — Zero reuso de `AcceptOrRefuseRequestToPdtiAction` no papel do líder; create GETIN só via Nova Action e gerente GETIN.
- **P6 Auth com sessão** — Livewire com middleware `auth` + policy; mutações e leitura da sugestão pendente exigem manager da área.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_


## Self-review against code-quality gates

- **G1 read-before-claim**: claims sobre código existente ancorados no design.md / research-digest (status 2, policy create false, AcceptOrRefuse GETIN-only, boot user_id, observer 4→5).
- **G2 soft-language**: 0 hedges load-bearing no source materializado.
- **G6 reference-or-strike**: decisões novas sem claim de código; premissas de repo no design com verified_by.
- **G10 gate-must-be-able-to-fail**: exit gates com verifiers pest determinísticos (exit ≠ 0 = FAIL).

## Reviews

- internal: 4 finding(s) applied (F1 route/F2 order; F0 doneWhen scope; labels overlap noted; glob outputs noted) @ a0ad99d27 (2026-08-11T20:51:19Z)
- ground-truth: complete-with-findings | mode=ground-truth | fp=ef548fee3f01 | premises=18 | impacts=12 @ 3b5fc4686 (2026-08-12T00:04:30Z)

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** app/Models/Commissions, app/Models/Commissions/Policies, app/Models/Institutional/Area.php, app/Models/User.php, app/Nova/Actions/*Pdti*, app/Nova/Actions/ItRequests, app/Nova/Resources/Commissions/ItRequestsPdtiResource.php, app/Nova/Menus/MainMenu.php, app/Observers/ItRequestsPdtiObserver.php, app/Notifications/*Pdti* + TrackableNotification, app/Services/PermissionsOfRequestPdtiService.php, app/Jobs/ExportCommissionRequestToItRequestJob.php, app/Livewire (lgpd layout pattern), routes/web/web.php + features/lgpd.php, database/migrations/2023_05_08_*, tests/Unit/RequestAndMeetingPDTI, config/livewire.php, config/scout.php, resources/views/components/default-pages → ~35 files
**Commit:** 3b5fc4686
**At:** 2026-08-12T00:43:58.358Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | `App\Models\Commissions\ItRequestsPdti` exists | ok | `app/Models/Commissions/ItRequestsPdti.php:23` class defined |
| 2 | boot `creating` forces `user_id = auth()->user()->id` (always) | ok | `ItRequestsPdti.php:160-162` unconditional assign |
| 3 | Statuses 1–9 only; no status 10/11 yet | ok | `ItRequestsPdti.php:28-44`, `statusList()` 133-141 |
| 4 | No `area_id` / `origin` / `created_by` / `suggestion_refuse_reason` on model or schema | ok | fillable 54-74; migration `2023_05_08_164338…:43-69` columns user_id+content only |
| 5 | Policy `create()` always false | ok | `ItRequestsPdtiPolicy.php:34-37` |
| 6 | AcceptOrRefuse gated to GETIN manager via service (status 1/5/6) | ok | `PermissionsOfRequestPdtiService.php:29-38,61-64` `authUserIsGetinManager` |
| 7 | AcceptOrRefuse accept path uses `$requester->areas->first()` for directors | ok | `AcceptOrRefuseRequestToPdtiAction.php:70-76` |
| 8 | ConvertItRequest uses `user->getMainArea()` | ok | `ConvertItRequestIntoPdtiNeedAction.php:52` |
| 9 | Observer: updated 4→5 + notify GETIN; creating empty (no create notify) | ok | `ItRequestsPdtiObserver.php:17-20,25-37` |
| 10 | Resource `fields()` empty; description/justify Trix on detail | ok | `ItRequestsPdtiResource.php:102-104,133-136` |
| 11 | Nova status filter defaults 1–7 only (no 10/11) | ok | `ItRequestsPdtiResource.php:160-168` |
| 12 | `Area::ID_GETIN = 20`; `getManager()` first pivot manager (no stable multi-manager) | ok | `Area.php:66,101-109` |
| 13 | Livewire layout `components.default-pages.livewire` exists and is default | ok | `config/livewire.php:43`; blade `resources/views/components/default-pages/livewire.blade.php`; LGPD e.g. `app/Livewire/Lgpd/Mailing/Register.php:106` |
| 14 | `routes/web/web.php` includes feature route files pattern | ok | `routes/web/web.php:86-99` `require __DIR__.'/features/…'` |
| 15 | `ExportCommissionRequestToItRequestJob` exists; does not set `user_id` before save | ok | `ExportCommissionRequestToItRequestJob.php:17,62-71`; dispatched sync `ExportCommissionRequestToItRequestAction.php:30` |
| 16 | Tests dir `tests/Unit/RequestAndMeetingPDTI` exists (PHPUnit class; Pest runner OK) | ok | `tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiTest.php` |
| 17 | PDTI notifications extend `TrackableNotification` + `TrackableNotificationMailMessage` | ok | e.g. `AllowCreateRequestForPdtiNotification.php:11,41`; abstract `app/Notifications/TrackableNotification.php:13` |
| 18 | No `temporarySignedRoute` pattern required/used in app (LGPD uses auth or own token) | ok | repo-wide grep 0 hits; `routes/web/features/lgpd.php` auth/token routes |

Notes A: Outputs the plan **creates** (migration columns, status 10/11, createSuggestion/respondToSuggestion, Suggest action, Livewire, notifications, resolveArea) are not missing-premises. No false existence claims found. Dual-path Nova action registration is Direction B (below), not a false service premise.

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | **Dual area semantics for directors**: AcceptOrRefuse notifies directors of `requester->areas->first()->diretoria`; DirectorEvaluate **service** gates on **GETIN** `diretoria` (`$this->direg = $this->getin->diretoria`), not requester/area_id board | `AcceptOrRefuseRequestToPdtiAction.php:71-76`; `PermissionsOfRequestPdtiService.php:26,50-58` | **direct** — after adoption + area_id preference, who can/does evaluate may diverge from area-alvo board | **gate** F3: prefer area_id only on AcceptOrRefuse director resolution as already planned; **oos** fixing GETIN-vs-area director gate mismatch (pre-existing; design non-goal) |
| 2 | **Nova actions dual path**: when `resourceId` empty, resource always registers AcceptOrRefuse/Reopen/DirectorEvaluate **without** PermissionsOfRequestPdtiService; detail path filters via service | `ItRequestsPdtiResource.php:194-220` | **direct** — SuggestPdtiNeedAction registration must not inherit bulk “always show” pattern; index may show unauthorized actions | **task** F1 T-001: register Suggest with authorize/createSuggestion; document index quirk **accepted** for existing actions |
| 3 | **ConvertItRequest always appended** on detail without status/role gate | `ItRequestsPdtiResource.php:190-192` | **indirect** — still available after status 1 adoption | **accepted** pre-existing; not suggestion-specific |
| 4 | **fillable gap**: no `user_id`, `type_id`, `area_id`, `origin`, `created_by`, `suggestion_refuse_reason`; property set works, mass-assign create drops unlisted keys | `ItRequestsPdti.php:54-74` | **direct** — F0 must extend fillable (or explicit attributes) for new columns; type_id already outside fillable | **task** F0 T-001 |
| 5 | **ExportCommission job never sets `user_id`**; relies on boot+auth (dispatchSync keeps Nova auth) | `ExportCommissionRequestToItRequestJob.php:62-71` | **direct** — F0 boot “only if empty” can leave null/wrong owner if auth missing or wrong actor | **task** F3 T-002 + foundation test: job sets explicit user_id or documents auth dependency |
| 6 | **Observer `updated` re-saves** (`->update()`) and uses bare `auth()->user()->id` (NPE if no auth); hardcodes `Area::find(20)` | `ItRequestsPdtiObserver.php:28-36` | **indirect** — Livewire content save on status 10 must not trip 4→5 (status≠4); null auth risk on queue | **task** F3 early-return 10/11; **accepted** auth NPE pre-existing |
| 7 | **SoftDeletes + Actionable + LogsActivity + HasHashId** via DefaultModelTraits | `ItRequestsPdti.php:25-26`; `DefaultModelTraits.php` | **indirect** — delete policy restriction for origin suggestion interacts with SoftDeletes; hash_id available for routes if desired | **task** F0 policy delete; hash_id **oos**/optional |
| 8 | **Scout config lists ItRequestsPdti** filterableAttributes=$search but model has no Searchable trait | `config/scout.php:259-261` | **indirect** — new fields origin/area not search-indexed unless added later | **oos** |
| 9 | **Menu registration** GETIN keywords for resource | `Nova/Menus/MainMenu.php:264` | **indirect** — no change required for action surface | **accepted** |
| 10 | **Email bug**: AcceptOrRefuse loops directors but `Notification::route('mail', $requester->email)` (not director email); body uses `requester->areas->first()->initials` | `AcceptOrRefuseRequestToPdtiAction.php:78-80`; `SendRequestToDirectionEvaluateItNotification.php:42` | **direct** for area_id prefer on initials/resolution; mail recipient bug **oos** per design | **task** F3 area_id for area display/resolution; **oos** recipient bug |
| 11 | **view() always true** — Livewire must not rely on generic view for pending suggestion | `ItRequestsPdtiPolicy.php:26-28` | **direct** — plan already requires respondToSuggestion for read+mutate | **task** F0/F2 (already planned) |
| 12 | **Filament Pdti panel exists** (Need/Pdti resources) but no ItRequestsPdti Filament surface | `app/Filament/Panels/Pdti`, `FilamentPanels.php` PDTI case | **indirect** — out of scope this delivery | **oos** |

**Counts:** premises=18 (missing=0, false=0); impacts=12 (direct=7, indirect=5)

### Disposition notes (critical/significant → plan alignment)

- **F0 fillable + boot**: treat fillable extension and boot “user_id only if empty” as load-bearing; commission job regression is exit-gate material (already F3 G-2 / foundation tests).
- **F1 action registration**: follow **detail authorize** pattern (`createSuggestion`), not the empty-`resourceId` always-on list.
- **F3 area_id**: call sites confirmed = AcceptOrRefuse director resolution + ConvertItRequest `getMainArea` + notification initials that read `areas->first()`; **do not** silently “fix” DirectorEvaluate GETIN-board gate (oos).
- **No temporarySignedRoute** / **no create notify** premises hold — do not invent signed auth or observer create mail.


## Session handoff
- **Narrative:** F0–F3 implementados sob pure-maestro overnight. Product merges verdes; audits por fase CLOSED; falta validação humana amanhã (userValidatedAt) antes de finalize/archive.
- **Decision log:** overnight-automate-full-run; phase packages ratificados por preauth; decision-review PASS por fase.
- **Single nextAction:** Operador valida implementação e carimba userValidatedAt, então plan-end external-both + finalize.
- **Verbatim state:** branch plan/sugestao-necessidade-pdti; all phases status done; plan status active; no userValidatedAt yet.
- **Uncommitted changes:** F3 close pending commit.

