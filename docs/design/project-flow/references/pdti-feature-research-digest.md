# Research digest — sugestao-necessidade-pdti

## Scope (from Interview)

- GETIN cria **sugestão** de necessidade de PDTI para qualquer área.
- Líder da área recebe **e-mail** com conteúdo no corpo + botão Validar.
- Página **Livewire** (não Nova): ver, editar rápido, aceitar/recusar.
- Reutilizar `App\Models\Commissions\ItRequestsPdti`.
- Fora de escopo: Filament agora, validação em Nova, fluxo de comitê, mobile/push.

## Findings

- **Model + tests** (`tests/Unit/RequestAndMeetingPDTI/ItRequestsPdtiTest.php`, model `app/Models/Commissions/ItRequestsPdti.php`): statuses 1–9; conteúdo `problem`/`description`/`justify`/`type_id`/`strategic_objectives`/`cost`; **sem** `area_id`/origem; boot `creating` força `user_id = auth()->id()`.

- **Schema** (`database/migrations/2023_05_08_164338_new_features_to_manage_pdti.php`): tabela `it_requests_pdtis` amarra `user_id` + conteúdo; área **não** na linha — área do fluxo atual vem de `user->areas`. Sugestão GETIN→área exige `area_id` (ou equivalente).

- **Permissions invertidas** (`app/Services/PermissionsOfRequestPdtiService.php`): AcceptOrRefuse só **gerente GETIN** em pedidos 1/5/6 — invertido vs feature (líder valida sugestão). Não reusar a Action Nova no papel do líder.

- **AcceptOrRefuse** (`app/Nova/Actions/AcceptOrRefuseRequestToPdtiAction.php`): accept→status 2 + diretoria via `user->areas->first()`; decline→3; review→4. Links de e-mail = detail **Nova**, não Livewire. Convert Need usa `user->getMainArea()` (`ConvertItRequestIntoPdtiNeedAction`).

- **Policy** (`app/Models/Commissions/Policies/ItRequestsPdtiPolicy.php`): `create()` sempre `false`; `view()` sempre `true`; `update` se owner ou `action`. Create GETIN e Livewire do líder exigem abilities novas.

- **Área / líder** (`app/Models/Institutional/Area.php`): `ID_GETIN = 20`; `getManager()` = primeiro pivot manager (sem multi-manager estável).

- **Notifications PDTI** (`app/Notifications/*Request*Pdti*`, `AllowCreateRequestForPdtiNotification.php`): `TrackableNotification` + `->action(...)` Nova. Corpo `->line(...)` plain — Trix HTML em description/justify precisa strip no mail.

- **Livewire full-page** (`routes/web/features/lgpd.php`, `app/Livewire/Lgpd/Mailing/*`): component class na rota + layout `components.default-pages.livewire`; auth ou token próprio — **sem** `temporarySignedRoute` no fluxo interno típico.

- **Observer** (`app/Observers/ItRequestsPdtiObserver.php`): updated + status 4 + requester → força 5 e notifica GETIN; `creating` vazio (**sem** e-mail no create).

- **Design tree:** `projects/arch-legacy/sugestao-necessidade-pdti/design.md` (decisões pós-review).

## Open risks / seams

1. **Semântica de `user_id`**: criador GETIN vs dono da necessidade na área — se boot sempre grava o criador, após aceite o “solicitante” pode continuar sendo GETIN (export, reabertura, e-mails de diretoria usam `$itRequestsPdti->user`).
2. **Área-alvo ausente no schema**: sem `area_id` (ou equivalente), não dá para endereçar o líder nem listar sugestões por área.
3. **Status novo vs flag de origem**: reusar `STATUS_NEW_REQUEST` sem origem mistura fila GETIN (validar pedidos da área) com fila da área (validar sugestões GETIN).
4. **Policy `create: false`**: criação GETIN precisa de regra explícita (role/área GETIN), não só UI.
5. **Aceite da sugestão vs “aceite GETIN”**: `STATUS_ACCEPTED_REQUEST` hoje significa “aceita pela GETIN”; se o líder “aceita” a sugestão, o significado do status 2 colide — provável necessidade de status/transição dedicada ou mapeamento pós-aceite para o fluxo normal (ex. vira solicitação da área em estado X).
6. **Observer status 4→5**: isolar estados de sugestão evita loop/notificação errada.
7. **Criação GETIN**: Interview não exige Filament; criação pode ser Nova action/resource ou fluxo mínimo — fora da Livewire do líder.

## Decision forks for debate

| # | Fork | Opções |
|---|------|--------|
| A | Modelo de dados | (A1) Estender `ItRequestsPdti` com `area_id` + origem/status sugestão · (A2) Model/tabela paralela espelhando conteúdo · (A3) Só status novo sem `area_id` (inferir de outro jeito) |
| B | Após aceite do líder | (B1) Vira solicitação normal (status/dono da área) · (B2) Status terminal “sugestão aceita” e outro fluxo cria a solicitação · (B3) Já nasce “aceita GETIN” e vai à diretoria |
| C | Auth da página Livewire | (C1) `auth` + policy “manager da área-alvo” · (C2) Token expirável no registro (padrão mailing) · (C3) Signed URL Laravel |
| D | Criação GETIN nesta entrega | (D1) Nova (resource/action) · (D2) Só factory/comando/admin · (D3) Livewire também para GETIN |
