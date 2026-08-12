# Design — Sugestão de necessidade de PDTI

## Interview

| Campo | Conteúdo ratificado |
|-------|---------------------|
| **Problema** | A GETIN precisa **sugerir** uma necessidade de PDTI a qualquer área. Hoje o fluxo de `ItRequestsPdti` parte da área; não há caminho “GETIN propõe → líder valida” com e-mail e tela leve. |
| **In-scope** | (1) Conceito de **sugestão** reutilizando `ItRequestsPdti`; (2) GETIN cria a sugestão para qualquer área; (3) e-mail ao líder com **conteúdo no corpo** + botão Validar; (4) página **Livewire** (não Nova) com ver, editar rápido, aceitar/recusar; (5) base no model existente. |
| **Out-of-scope** | Migração Livewire→Filament agora; validação do líder em tela Nova; fluxo de comitê/reunião/consolidação além do aceite/recusa; app mobile / push; correção de bugs pré-existentes do funil (ex. e-mail de diretor no AcceptOrRefuse); reabrir `Policy::create` genérico. |
| **Done-when (design)** | O que é sugestão; encaixe em `ItRequestsPdti` (status/campos/origem); quem cria/recebe; contrato e-mail + link; UX mínima Livewire; non-goals; matriz status×origin×actions. |
| **Stakes** | Schema/semântica em `ItRequestsPdti` (status/origem/area); ownership transfer; uso de `area_id` no funil pós-aceite; auth da Livewire. |
| **Fontes** | Model, policy, actions Nova, observer, notifications PDTI, Livewire full-page, `Area::getManager`, job de comissão. |

## Context

O fluxo atual trata `ItRequestsPdti` como **solicitação da área** avaliada pela GETIN (`AcceptOrRefuseRequestToPdtiAction` só para gerente GETIN). A feature inverte o primeiro passo: a GETIN **propõe** e o líder da área **adota ou recusa**, sem obrigar o líder a operar o Nova.

verified_by:

- `app/Services/PermissionsOfRequestPdtiService.php` — AcceptOrRefuse só se `authUserIsGetinManager` (id === gerente da área GETIN).
- `app/Models/Commissions/ItRequestsPdti.php` — boot `creating` força `user_id = auth()->user()->id`; sem `area_id`/`origin`.
- `app/Models/Commissions/Policies/ItRequestsPdtiPolicy.php` — `create()` retorna sempre `false`; `view()` retorna sempre `true`.
- `app/Observers/ItRequestsPdtiObserver.php` — em `updated`, se auth === `user_id` e status === 4 e `count_reopened == 0`, força status 5 e notifica GETIN; `creating` vazio (sem e-mail no create).
- `app/Nova/Resources/Commissions/ItRequestsPdtiResource.php` — `fields()` retorna `[]`; description/justify como Trix no detail; filter defaults só status 1–7.
- `app/Nova/Actions/AcceptOrRefuseRequestToPdtiAction.php` / `ConvertItRequestIntoPdtiNeedAction.php` — diretoria/Need usam `user->areas->first()` / `user->getMainArea()`, não coluna de área no pedido.

## Decisions

### 1. Uma entidade, dois origins

Continuar em `ItRequestsPdti`. Coluna `origin` (**string**, backed enum PHP `user_request` | `getin_suggestion`, default `user_request`) e `area_id` (FK nullable). Não criar model/tabela paralela.

- **Legacy backfill:** `origin = user_request`; `area_id = null` (fluxo normal continua com área do `user` quando `area_id` null).
- **Sugestão:** `area_id` **obrigatório** na create (`origin = getin_suggestion`); validação Nova + model.
- **Pós-aceite (load-bearing):** qualquer resolução de área do pedido **prefere `area_id`** quando preenchido; fallback a `user->areas->first()` / `getMainArea()` **somente** se `area_id` null (legado). Call sites a ajustar nesta entrega (mínimo):
  - `AcceptOrRefuseRequestToPdtiAction` (diretores a notificar)
  - `ConvertItRequestIntoPdtiNeedAction` (sync de áreas na Need)
  - helpers/e-mails do funil que leem `requester->areas->first()` no contexto do pedido (lista no plano a partir de grep)

### 2. Status de sugestão separados

- `STATUS_SUGGESTION_PENDING = 10` — “Sugestão GETIN pendente da área”
- `STATUS_SUGGESTION_REFUSED = 11` — “Sugestão GETIN recusada pela área”

**Não** reutilizar `STATUS_ACCEPTED_REQUEST` (2 = “aceita pela GETIN”). verified_by: `ItRequestsPdti::statusList()`.

Labels em `statusList()`; defaults do filtro Nova: **10 = true** (fila visível), **11 = false**; status 1–7 defaults inalterados. Index/export: expor `origin` e área-alvo quando úteis à GETIN.

### 3. Create da sugestão (ownership + created_by)

**No create (único momento de gravação de auditoria GETIN):**

| Campo | Valor |
|-------|--------|
| `origin` | `getin_suggestion` |
| `area_id` | área escolhida (required) |
| `status` | `10` |
| `created_by` | `auth()->id()` do criador GETIN (**write-once**; proibir update em model/Livewire/Nova) |
| `user_id` | mesmo criador GETIN até o aceite |

**Pré-condições de create (falha com erro claro):**

- Área tem **exatamente um** manager (`getManager()` não null; se a coleção tiver >1 flag manager, falhar — `getManager()` hoje devolve o primeiro sem ordem estável; verified_by: `Area::getManager`).
- Não há fallback para `getResponsible()` / diretor nesta entrega (sem manager = sem sugestão).

**Boot `user_id` (regra única):** no `creating`, setar `user_id = auth()->id()` **somente se** `user_id` ainda estiver vazio. Create de sugestão e job de comissão podem setar explicitamente antes do save; auth presente continua cobrindo o happy path. Documentar/testar impacto em `ExportCommissionRequestToItRequestJob`.

### 4. Aceite = adoção

**Somente se** `status === 10` e auth é manager de `area_id` (policy `respondToSuggestion`).

No accept:

1. `user_id` → `Area::find(area_id)->getManager()->id` (mesmo destinatário do e-mail)
2. `status` → `STATUS_NEW_REQUEST` (1)
3. `origin` **permanece** `getin_suggestion` (auditoria)
4. **Não** alterar `created_by`
5. **Não** setar status 2

Após aceite o funil normal aplica-se (GETIN valida com AcceptOrRefuse quando status 1/5/6 etc.). Como `origin` continua `getin_suggestion`, **guards de service NÃO usam só origin** para desligar AcceptOrRefuse (ver matriz §8).

### 5. Recusa

**Somente se** `status === 10` e auth manager da `area_id`.

- `status` → `11`
- `suggestion_refuse_reason` (text nullable; UX opcional)
- Notificar: **`created_by`** e, se distinto, **gerente GETIN** (`Area::ID_GETIN->getManager()`)
- 11 é **terminal** nesta entrega (sem reabrir)

### 6. Idempotência e transições

| Transição | Permitida? |
|-----------|------------|
| 10 → 1 (accept) | sim, uma vez |
| 10 → 11 (refuse) | sim, uma vez |
| 11 → * | não (403/422) |
| 1+ com origin getin_suggestion → accept/refuse Livewire | não |
| Double accept/refuse | resposta idempotente 422/mensagem; sem regravar ownership |

Livewire e policy: se status ≠ 10, mutações recusam.

### 7. Edição e leitura Livewire

**Authorize leitura e mutação:** mesma ability `respondToSuggestion` (manager da `area_id` **e** status === 10). Não confiar em `view()` global true. Rota com id do model (hash_id opcional no plano se já houver padrão; senão id + policy).

**Campos editáveis (lista fechada)** enquanto status 10:

- `problem`, `description`, `justify`, `type_id`, `strategic_objectives`, `cost`

**Imutáveis após create:** `area_id`, `origin`, `created_by`, `user_id` (só muda no accept), `status` (só accept/refuse).

**Correção GETIN pós-envio:** **out of scope** nesta entrega (resource create/update Nova não existe de fato — `fields()` vazio). GETIN recria ou espera recusa; sem action “editar sugestão” no MVP.

### 8. Matriz status × origin × actions

| status | origin | AcceptOrRefuse GETIN (Nova) | Livewire líder | Observer 4→5 |
|--------|--------|-----------------------------|----------------|--------------|
| 10 | getin_suggestion | **não** | ver/editar/accept/refuse | n/a (status ≠ 4) |
| 11 | getin_suggestion | **não** | **não** (só mensagem se link antigo) | n/a |
| 1, 5, 6, … | getin_suggestion | **igual** a `user_request` (mesmas regras de status) | **não** | **igual** ao fluxo normal (não filtrar por origin) |
| * | user_request | atual | **não** | atual |

- **Observer:** early-return só se status ∈ {10, 11} se necessário; **não** silenciar por `origin` após adoção (senão quebra revisão 4→5 legítima).
- **PermissionsOfRequestPdtiService:** bloquear AcceptOrRefuse apenas quando status ∈ {10, 11}; **não** `if origin === getin_suggestion return null`.
- **Notify no create:** **N/A** — observer `creating`/`created` não enviam e-mail hoje. Não inventar “silenciar create”. verified_by: `ItRequestsPdtiObserver`.

### 9. Quem cria (`createSuggestion`)

Ability `createSuggestion`: **somente gerente GETIN** (`auth()->id() === Area::find(ID_GETIN)->getManager()->id`), alinhado a AcceptOrRefuse. verified_by: `PermissionsOfRequestPdtiService::authUserIsGetinManager`.

`Policy::create` genérico permanece `false`. Superfície: **Nova Action** dedicada no resource (não reabrir create genérico do resource; `fields()` continua vazio para create form padrão).

### 10. Contrato create (Nova Action)

Campos da action (obrigatório / opcional):

| Campo | Required |
|-------|----------|
| `area_id` | sim |
| `problem` | sim |
| `description` | sim |
| `justify` | sim |
| `strategic_objectives` | sim (min 1 id — coluna JSON not null no schema) |
| `type_id` | opcional |
| `cost` | opcional |

Forçados no handle: `origin`, `status=10`, `created_by`, `user_id`. Extend `$fillable` / escrita explícita para `area_id`, `origin`, `created_by`, `suggestion_refuse_reason`, `type_id` conforme model atual.

### 11. E-mail da sugestão

- Notification trackable (padrão `TrackableNotification` / `TrackableNotificationMailMessage`).
- Destinatário: `getManager()` da `area_id` (já validado no create).
- Corpo: área, quem sugeriu (GETIN / nome do `created_by`), **`problem` completo**, **descrição e justificativa em plain text** (`strip_tags` + limite de caracteres — campos são Trix HTML no Nova; verified_by: `ItRequestsPdtiResource` Trix).
- CTA **Validar** → rota Livewire full-page nomeada (não detail Nova).

### 12. Auth da página Livewire

**Decisão:** rota com middleware **`auth`** + authorize `respondToSuggestion` no mount. **Sem** `temporarySignedRoute` como auth (não há padrão de signed+auth no domínio PDTI; grep do repo não mostra `temporarySignedRoute` em fluxos internos). verified_by: rotas LGPD usam `auth` ou token próprio (`routes/web/features/lgpd.php`), não signed Laravel.

- E-mail CTA: URL da rota Livewire; se guest, login e **redirect intended** de volta à mesma URL.
- Mutações: sessão + policy + status 10.
- Expiração de “oferta”: não há token; se já 11 ou 1, página mostra estado final (somente leitura / mensagem).

### 13. Delete / reopen pós-adoção

- **Delete** com `origin = getin_suggestion` e status 1: **proibido** para o líder (policy); GETIN manager pode soft-delete se o produto já permitir delete admin — default: **mesmo que delete genérico atual só owner NEW**, restringir: owner **não** apaga se `origin = getin_suggestion` (preserva rastro GETIN). GETIN manager: permitir delete se já existir padrão admin; senão deixar só soft-delete operacional fora do MVP e documentar.
- **Reopen** (status 3): regras atuais do owner; líder vira owner após accept — comportamento herdado do funil; sem mudança além de ownership.

### 14. Bugs pré-existentes do funil

E-mail de diretor no AcceptOrRefuse que usa e-mail do requester no loop, e avaliação de diretoria GETIN vs área, **não** são desta entrega. Nota: aceite de sugestão multiplica casos (líder como `user`); ticket paralelo se stakes altos.

## Chosen approach

**Estender `ItRequestsPdti` + Nova Action (GETIN manager) + Livewire (líder) + e-mail decisório.**

```
Gerente GETIN (Nova Action) cria sugestão
  → origin=getin_suggestion, area_id, status=10
  → created_by + user_id = criador; write-once created_by
  → valida 1 manager na área
  → e-mail manager (problem + strip description/justify + CTA Livewire auth)

Líder (auth + respondToSuggestion)
  → mount: 403 se não manager ou status≠10 (exceto mensagem se 1/11)
  → edita lista fechada de campos
  → Aceitar: user_id→manager, status=1; area_id permanece; funil normal com area_id preferido
  → Recusar: status=11, motivo opcional; notifica created_by + manager GETIN

GETIN depois valida status=1 via AcceptOrRefuse (origin não bloqueia)
```

### Peças

| Peça | Onde |
|------|------|
| Migration | `area_id` nullable FK; `origin` string default `user_request`; `created_by` FK users; `suggestion_refuse_reason` text nullable; backfill origin |
| Model | constants 10/11; enum origin; relations `area()`, `createdBy()`; boot user_id se vazio; fillable/casts; helper `resolveArea()` preferindo `area_id` |
| Funil call sites | AcceptOrRefuse directors; ConvertItRequest areas; grep `areas->first` / `getMainArea` no domínio do pedido |
| Policy | `createSuggestion` (GETIN manager); `respondToSuggestion` (manager da area_id + status 10, null-safe); restringir delete se origin suggestion; `create` continua false |
| Nova | Action “Sugerir necessidade PDTI” + authorize; labels/filter 10/11; statusList |
| Notification create | `PdtiSuggestionToAreaNotification` |
| Notification refuse | `PdtiSuggestionRefusedNotification` → created_by (+ manager GETIN se ≠) |
| Livewire | full-page + `components.default-pages.livewire`; accept/refuse/save content |
| Routes | feature route file + `auth` middleware |
| Tests | create preconditions; policy; e-mail strip; accept ownership+status; refuse notify; double accept; AcceptOrRefuse ainda disponível após accept; observer 4→5 pós-adoção; area_id preferido nos call sites; job comissão user_id |

## Rejected alternatives

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| Model/tabela paralela | Dobra UI/export/histórico; Interview exige reuso |
| Só status sem `area_id` | GETIN criador não define área-alvo |
| Aceite = status 2 | Semântica GETIN; contamina filtros/export/diretoria |
| Aceite = status terminal “sugestão aceita” | Quebra funil |
| Token/signed sozinho para mutar | Sem identidade; forward de e-mail |
| signed URL como auth primária | Sem padrão no repo; frágil com login redirect |
| Guard AcceptOrRefuse por `origin` | Quebra validação GETIN pós-adoção |
| Qualquer membro GETIN cria | Divergente de AcceptOrRefuse (só manager) |
| Livewire criação GETIN / Filament agora | Fora do caminho crítico |
| Reusar `AcceptOrRefuseRequestToPdtiAction` para o líder | Papel invertido |
| Fallback getResponsible no create | Escopo; pin explicit “sem manager = sem sugestão” |
| Correção GETIN via Nova no MVP | Resource sem fields de update real |

## Non-goals

- Migrar Livewire → Filament nesta entrega.
- Tela Nova de validação do líder.
- Comitê / consolidação / conversão além do funil após status 1 (exceto ajuste de call sites de **área** listados).
- Mobile / push.
- Reabrir `Policy::create` genérico.
- Corrigir bugs pré-existentes de e-mail de diretor no AcceptOrRefuse.
- Multi-manager por área (falha no create).
- Reabrir sugestão recusada (status 11).

## Open questions

Nenhuma decisão de produto em aberto. Implementação segue a matriz e contratos acima.

| # | Fechado | Valor |
|---|---------|-------|
| 1 | `created_by` | Sempre no **create**; imutável; accept não grava |
| 2 | `user_id` no create | Criador GETIN |
| 3 | `user_id` no accept | Manager da `area_id` |
| 4 | Boot `user_id` | Só se vazio |
| 5 | `createSuggestion` ator | **Só gerente GETIN** |
| 6 | Superfície create | **Nova Action** |
| 7 | Auth Livewire | **`auth` + policy**; sem signed como auth |
| 8 | E-mail HTML | strip_tags + limite; problem completo |
| 9 | area_id pós-aceite | **Preferir `area_id`** nos call sites do funil |
| 10 | AcceptOrRefuse pós-aceite | Por **status**, não por origin |
| 11 | Notify create | N/A (não existe) |
| 12 | Multi-manager | Create falha |
| 13 | Delete origin suggestion em status 1 | Líder **não** apaga |
| 14 | Filter defaults | 10=true, 11=false |
| 15 | origin storage | string + enum PHP |
| 16 | Campos editáveis líder | problem, description, justify, type_id, strategic_objectives, cost |

## Blast radius

| Decisão | Reversibilidade | Contenção |
|---------|-----------------|-----------|
| Migration area_id / origin / created_by / suggestion_refuse_reason | Médio | default origin user_request; area_id null legado |
| Status 10–11 + statusList + filter defaults | Médio | não renumerar 1–9; 10 default visible |
| Boot user_id “só se vazio” | Médio | testes job comissão + create normal + suggestion |
| Call sites funil preferem area_id | Médio | só paths do pedido PDTI; fallback null = legado |
| Policy delete / createSuggestion / respondToSuggestion | Baixo | testes policy |
| Nova Action create | Baixo | create resource continua false |
| Livewire auth | Baixo | middleware auth + 403 |

## Review disposition (independent review 2026-08-11)

Findings do revisor independente (`needs_changes`) endereçados neste doc: F-001…F-023. Premissas falsas removidas (notify create; verified_by signed/lgpd). Veredito alvo pós-fix: design implementável sem “/” load-bearing.

## Self-review against code-quality gates

- **G1 read-before-claim**: claims de código com verified_by e paths lidos no review ground-truth; premissas falsas (notify create, signed lgpd) riscadas.
- **G2 soft-language**: “/” e “demais de negócio” removidos das decisões load-bearing; listas fechadas.
- **G6 reference-or-strike**: código existente com verified_by; decisões de design sem claim de código existente.
