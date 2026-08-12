# Sugestão de necessidade de PDTI

Permitir que a GETIN proponha uma necessidade de PDTI a qualquer área e que o líder valide por e-mail + página Livewire (ver, editar, aceitar ou recusar), reutilizando `ItRequestsPdti` com origem e status dedicados, sem validação do líder no Nova e sem Filament nesta entrega.

## Principles

- **P1 Uma entidade, dois origins** — Continuar em `ItRequestsPdti` com `origin` (`user_request` | `getin_suggestion`) e `area_id`; sem model paralelo.
- **P2 Status de sugestão separados** — Status 10 (pendente) e 11 (recusada); aceite do líder vira `STATUS_NEW_REQUEST` (1), nunca status 2 (aceite GETIN).
- **P3 Aceite = adoção com ownership** — No create grava `created_by` (write-once) e `user_id` do criador GETIN; no aceite transfere `user_id` ao manager da `area_id`; `origin` permanece `getin_suggestion`.
- **P4 area_id manda no funil** — Com `area_id` preenchido, call sites do funil preferem essa área (não `user->areas->first()`).
- **P5 Validação do líder só Livewire** — Zero reuso de `AcceptOrRefuseRequestToPdtiAction` no papel do líder; create GETIN só via Nova Action e gerente GETIN.
- **P6 Auth com sessão** — Livewire com middleware `auth` + policy; mutações e leitura da sugestão pendente exigem manager da área.

## Glossary

- **Sugestão GETIN** — Registro `ItRequestsPdti` com `origin=getin_suggestion` e status 10 ou 11.
- **Adoção** — Aceite do líder: status 1 + `user_id` do manager da área-alvo.
- **created_by** — Usuário GETIN que criou a sugestão; imutável após create.
- **respondToSuggestion** — Ability de leitura e mutação Livewire (manager da `area_id` + status 10).

## F0 — Fundação schema model policy

Goal: Persistência e regras de domínio da sugestão (colunas, constants, boot, policies, labels de status) sem UI de create/validação ainda.

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: Migration aplica origin, area_id, created_by, suggestion_refuse_reason e status 10/11 no model com labels.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFoundationTest.php"
        expectExitCode: 0
    - id: G-2
      description: Policy createSuggestion só gerente GETIN; respondToSuggestion só manager da area_id com status 10; create genérico continua false.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionPolicyTest.php"
        expectExitCode: 0
```

### T-001 Migration e model de sugestão

Adicionar colunas e constants de sugestão no model, boot de user_id só se vazio, relations e helper de área preferindo area_id.

- Files: database/migrations/*_add_suggestion_fields_to_it_requests_pdtis.php, app/Models/Commissions/ItRequestsPdti.php, tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFoundationTest.php
- scopeBoundary: Não criar resource Nova create genérico; não enviar e-mail; não alterar AcceptOrRefuse; não criar Livewire.
- acceptance: origin default user_request em legado; area_id nullable legado e required logic para getin_suggestion; constants STATUS_SUGGESTION_PENDING=10 e STATUS_SUGGESTION_REFUSED=11 em statusList; created_by write-once documentado no model; boot não sobrescreve user_id pré-setado; resolveArea prefere area_id.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFoundationTest.php", expectExitCode: 0 }
- RED→GREEN: testes de foundation falham sem migration/constants; passam após model+migration.

### T-002 Policies createSuggestion e respondToSuggestion

Estender policy com abilities de create (só gerente GETIN) e respond (manager da area + status 10, null-safe); restringir delete do líder em origin getin_suggestion status 1; create genérico permanece false.

- Files: app/Models/Commissions/Policies/ItRequestsPdtiPolicy.php, tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionPolicyTest.php
- scopeBoundary: Não alterar AcceptOrRefuse action; não alterar viewAny global além do necessário; não abrir create genérico true.
- acceptance: create continua false; createSuggestion true só para gerente GETIN; respondToSuggestion true só manager da area_id com status 10; respond false se status 1 ou 11 ou manager errado; líder não delete origin getin_suggestion em status 1.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionPolicyTest.php", expectExitCode: 0 }
- RED→GREEN: policy tests falham sem abilities; passam com regras do design.

## F1 — Create GETIN e e-mail

Goal: Gerente GETIN cria sugestão via Nova Action e o manager da área recebe e-mail com conteúdo plain e CTA para a Livewire.

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: Action cria registro origin getin_suggestion status 10 com created_by e user_id do criador e area_id; falha sem manager único.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/SuggestPdtiNeedActionTest.php"
        expectExitCode: 0
    - id: G-2
      description: Notification envia plain text strip de description/justify e action URL da rota Livewire auth.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionNotificationTest.php"
        expectExitCode: 0
```

### T-001 Nova Action Sugerir necessidade PDTI

Implementar action no resource com campos area_id, problem, description, justify, strategic_objectives (min 1), type_id e cost opcionais; authorize createSuggestion; handle grava origin, status 10, created_by, user_id; falha se area sem exatamente um manager.

- Files: app/Nova/Actions/SuggestPdtiNeedAction.php, app/Nova/Resources/Commissions/ItRequestsPdtiResource.php, tests/Unit/RequestAndMeetingPDTI/SuggestPdtiNeedActionTest.php
- scopeBoundary: Não reabrir fields() de create genérico do resource; não implementar AcceptOrRefuse para líder; não mutar status 2 no create.
- acceptance: action exige campos obrigatórios; grava origin getin_suggestion status 10; created_by e user_id = auth; falha se getManager null ou ambíguo multi-manager; resource registra action para quem passa createSuggestion.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/SuggestPdtiNeedActionTest.php", expectExitCode: 0 }
- RED→GREEN: action test falha sem handle; passa com create + preconditions.

### T-002 Notification e statusList filter

Criar notification de sugestão com strip_tags e limite; registrar labels 10/11; default filter 10=true 11=false; disparar e-mail ao manager no create da action.

- Files: app/Notifications/PdtiSuggestionToAreaNotification.php, app/Nova/Resources/Commissions/ItRequestsPdtiResource.php, app/Models/Commissions/ItRequestsPdti.php, tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionNotificationTest.php
- scopeBoundary: Não apontar CTA para detail Nova; não usar temporarySignedRoute como auth; não alterar textos de outras notifications PDTI.
- acceptance: mail contém problem; description e justify sem tags HTML; action URL nomeada da Livewire; statusList tem 10 e 11; filter default inclui 10 e exclui 11.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionNotificationTest.php", expectExitCode: 0 }
- RED→GREEN: notification test falha sem strip/URL; passa com notification correta.

## F2 — Livewire do líder

Goal: Página Livewire autenticada para o manager ver, editar conteúdo, aceitar (adoção) ou recusar a sugestão pendente.

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: Manager da area_id com status 10 aceita e obtém user_id do manager status 1 origin inalterado created_by inalterado.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php"
        expectExitCode: 0
    - id: G-2
      description: Recusa grava status 11 e notifica created_by e gerente GETIN se distinto; double accept/refuse rejeitado.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php"
        expectExitCode: 0
```

### T-001 Componente Livewire e rota auth

Criar full-page Livewire com layout default-pages.livewire, rota auth, mount authorize respondToSuggestion; edição da lista fechada de campos; accept e refuse monotônicos.

- Files: app/Livewire/Pdti/RespondToPdtiSuggestion.php, resources/views/livewire/pdti/respond-to-pdti-suggestion.blade.php, routes/web/features/pdti.php, routes/web/web.php, tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php
- scopeBoundary: Não criar UI Nova de validação do líder; não reusar AcceptOrRefuseRequestToPdtiAction; não alterar origin no accept; não setar status 2.
- acceptance: 403 se não manager ou status diferente de 10 nas mutações; accept move user_id para manager e status 1; refuse status 11 com suggestion_refuse_reason opcional; campos editáveis só problem description justify type_id strategic_objectives cost; double accept/refuse não regrava ownership.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php", expectExitCode: 0 }
- RED→GREEN: Livewire tests falham sem component; passam com accept/refuse/edit.

### T-002 Notification de recusa

Notificar created_by e gerente GETIN (se distinto) ao recusar, com área problema e motivo opcional.

- Files: app/Notifications/PdtiSuggestionRefusedNotification.php, app/Livewire/Pdti/RespondToPdtiSuggestion.php, tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php
- scopeBoundary: Não notificar diretoria no refuse da sugestão; não reabrir status 11.
- acceptance: refuse dispara notificação para created_by; se created_by diferente do manager GETIN, ambos recebem; body inclui area e problem.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/PdtiSuggestionLivewireTest.php", expectExitCode: 0 }
- RED→GREEN: assert Notification::fake no refuse.

## F3 — Funil area_id e regressão

Goal: Call sites do funil preferem area_id; AcceptOrRefuse e observer respeitam a matriz; job de comissão e regressões cobertos.

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: AcceptOrRefuse e ConvertItRequest usam area_id quando preenchido; AcceptOrRefuse disponível em status 1 com origin getin_suggestion.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php"
        expectExitCode: 0
    - id: G-2
      description: Observer 4→5 continua após adoção; boot user_id não quebra job de comissão; status 10/11 não disparam AcceptOrRefuse GETIN.
      status: pending
      verifier:
        kind: shell
        command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php"
        expectExitCode: 0
```

### T-001 Preferir area_id nos call sites

Ajustar AcceptOrRefuse (diretores), ConvertItRequestIntoPdtiNeedAction e PermissionsOfRequestPdtiService para matriz status 10/11 vs funil normal com area_id.

- Files: app/Nova/Actions/AcceptOrRefuseRequestToPdtiAction.php, app/Nova/Actions/ConvertItRequestIntoPdtiNeedAction.php, app/Services/PermissionsOfRequestPdtiService.php, app/Models/Commissions/ItRequestsPdti.php, tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php
- scopeBoundary: Não corrigir bug pré-existente de e-mail do diretor no loop AcceptOrRefuse além do necessário para area_id; não alterar fluxo de comitê; não filtrar AcceptOrRefuse por origin.
- acceptance: com area_id setado, diretoria/Need usam essa área; AcceptOrRefuse action disponível para gerente GETIN em status 1 origin getin_suggestion; action indisponível em status 10 e 11; helper resolveArea centralizado.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php", expectExitCode: 0 }
- RED→GREEN: funnel tests falham com areas->first only; passam com preferência area_id.

### T-002 Observer e job comissão

Garantir observer 4→5 após adoção; early-return apenas status 10/11 se preciso; boot user_id se vazio não quebra ExportCommissionRequestToItRequestJob.

- Files: app/Observers/ItRequestsPdtiObserver.php, app/Jobs/ExportCommissionRequestToItRequestJob.php, tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php
- scopeBoundary: Não silenciar observer por origin após status 1; não inventar notify no create.
- acceptance: pedido adotado em status 4 com auth=user_id transita para 5; update de conteúdo em status 10 não força 5; job de comissão ainda grava user_id esperado nos testes existentes ou no funnel test.
- verifier: { kind: shell, command: "./vendor/bin/pest tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiSuggestionFunnelTest.php", expectExitCode: 0 }
- RED→GREEN: regressão observer e job coberta no funnel suite.
