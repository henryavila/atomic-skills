---
date: 2026-06-15T15:43:33-03:00
topic: design-brief-source-of-truth
artifact: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 1, critical: 2, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 1, critical: 2, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — design-brief-source-of-truth

> Mode: both (local self-loop → codex sealed envelope). Cross-ref: cited source files. Pre-flight: --allow-dirty (subject is the untracked design.md; artifact inlined in sealed briefing).

## Local phase fix log (audit trail)
- F-L1 [minor] D5 greenfield-fallback caveat — applied inline (design.md D5 "Nota").
- F-L2 [nit] Open question (e) plan-slug committed-by-location — applied inline.
- Local verdict: approve_with_nits (0 critical/blocker).

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 1, critical: 2, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
O plano ainda não é implementável sem decisões adicionais. O problema central é que ele declara comportamento por página, mas define sinais globais ou pendentes para regimes, staleness, persistência e resolução de conflitos. Isso cria caminhos onde o `design-brief` continuará caindo no comportamento atual justamente no caso greenfield que o plano pretende corrigir.

As maiores falhas são contradições internas e dependências não definidas: o consumidor lê um catálogo que pode não existir, a detecção de stale é obrigatória mas aberta, e decisões do operador são gravadas sem mecanismo estável de reaplicação. Implementar agora exigiria que o engenheiro escolhesse sem contrato.

## Findings

### F-001 [blocker] Contradiction — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:74-79

**Evidence:**
```md
- **D6 — Regime por-página, não por-projeto.** Um app em dev é misto (`/login` built, `/dashboard`
  artefato-only). `regime = greenfield ⟺ routes == []`. Esse campo comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro.
```

**Claim:** O plano diz que `regime` é por página, mas define `greenfield` por `routes == []`, que é um sinal global do app e não distingue `/login` built de `/dashboard` artefato-only.

**Impact:** Em apps mistos, qualquer rota existente torna `routes != []`; páginas planejadas sem código serão tratadas como brownfield, levando o R2 a minerar valores do código inexistente ou irrelevante e a silenciar exatamente o caso que o plano diz cobrir.

**Recommendation:** Redefinir `regime` por linha do catálogo usando evidência por página, por exemplo `codeEvidencePresent`/`artifactEvidencePresent` ou `existence/status`, e remover `routes == []` como critério para páginas individuais.

**Confidence:** high

---

### F-002 [critical] Ordering — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:67-72

**Evidence:**
```md
- **D5 — Persistir o catálogo como artefato versionado + checagem de staleness.** O `design-brief`
  Step 2 passa a **ler o catálogo** no lugar do route-Glob, e **cai de volta** pro Glob ao vivo
  quando o catálogo está **ausente OU defasado** (backward-compatible).
```

**Claim:** O plano não define uma ordem obrigatória em que a fase de reconstrução gere ou atualize o catálogo antes do Step 2 consumi-lo.

**Impact:** Em greenfield, catálogo ausente ou defasado cai no Glob ao vivo, que o próprio plano identifica como retorno vazio; a execução continua podendo produzir ledger vazio sem pergunta ao operador.

**Recommendation:** Tornar a reconstrução uma etapa obrigatória antes do Step 2 quando o catálogo estiver ausente ou stale, e limitar o fallback Glob-only a execução legada explicitamente opt-in.

**Confidence:** high

---

### F-003 [critical] Dependency break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:131-136

**Evidence:**
```md
- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração.
- (b) **Persistência:** JSON (consumo por máquina, `node -e`) + espelho `.md` legível, ou `.md`
  único? Afeta como o `design-brief` lê.
- (c) **Staleness:** mtime/commit-count vs hash de (rotas + artefatos) — qual sinal dispara o
  fallback pro Glob ao vivo.
```

**Claim:** O plano deixa em aberto mecanismos que D5 e D7 tratam como requisitos de execução: persistência legível por máquina, staleness e fingerprint de resolução.

**Impact:** Dois implementadores podem escolher formatos e sinais incompatíveis; `design-brief` pode não conseguir ler o catálogo, detectar stale de forma confiável, ou preservar decisões do operador entre regenerações.

**Recommendation:** Fechar antes do handoff: escolher formato único canônico, definir metadados de input hash para staleness, e definir fingerprint por conflito com os campos de evidência usados para reaplicar resolução.

**Confidence:** high

---

### F-004 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:99-107

**Evidence:**
```md
Contrato estável que o
`design-brief` consome = **5 campos** por página (`id/label/purpose`, `audience`, `accessTier`,
`status`, `regime`); `conflicts[]/provenance/aliases` são advisory.
```

**Claim:** O contrato estável não é um schema implementável porque agrupa `id/label/purpose` como um campo, enquanto D4 os apresenta como campos separados e D3 exige proveniência por linha.

**Impact:** Validação e consumo podem divergir: um implementador pode produzir 5 chaves, outro 7 ou mais, e o `design-brief` pode ignorar `provenance` mesmo quando ela é necessária para reconciliar fontes.

**Recommendation:** Substituir o “contrato de 5 campos” por um schema explícito com propriedades, tipos, obrigatoriedade, nullability e quais campos advisory ainda precisam ser preservados.

**Confidence:** high

---

### F-005 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:60-62

**Evidence:**
```md
- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página: `id/label` ·
  `audience {public|private|minor|visitor}` · `accessTier` · `purpose` (uma linha) · `status` ·
  `provenance`.
```

**Claim:** `audience {public|private|minor|visitor}` mistura visibilidade/acesso com tipo de usuário, enquanto `accessTier` já existe para acesso.

**Impact:** Uma página pública para visitantes menores, ou privada para responsáveis por menores, não pode ser representada sem conflito artificial; a lógica de `audience/accessTier == null` para perguntar ao operador será acionada de forma inconsistente.

**Recommendation:** Separar os eixos: mover `public|private` para `accessTier` ou `visibility`, manter `audience` como papéis/segmentos de usuário, e representar `minor` como flag ou segmento independente.

**Confidence:** medium

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:100 — Qual é o caminho e nome exato do arquivo de catálogo dentro de `.atomic-skills/projects/<project-id>/`?
- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:121 — O novo catálogo será validado por `validate-state` ou por um validador próprio integrado a `validate-skills`/testes?

## Out of scope

- Não revisei alternativas rejeitadas como propostas novas.
- Não avaliei estilo, nomes ou formatação.
- Não propus criar a skill `app-map`.
- Não propus mutação de artefatos humanos.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 1, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
O plano continua não implementável sem decisões adicionais. As restrições externas não invalidam os achados cegos; elas reforçam que o catálogo persistido precisa ter contrato e validação explícitos, porque o repositório valida skills e estado durável por schema.

O risco central permanece: o plano tenta corrigir uma falha greenfield, mas mantém fallback que reproduz a falha, define regime por página com sinal global, e deixa formato/staleness/fingerprint como perguntas abertas apesar de serem mecanismos necessários para execução.

## Findings

### F-001 [blocker] Contradiction — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:74-79

**Evidence:**
```md
- **D6 — Regime por-página, não por-projeto.** Um app em dev é misto (`/login` built, `/dashboard`
  artefato-only). `regime = greenfield ⟺ routes == []`. Esse campo comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro. O bloco "Modelo de interação" continua saindo com
  valores concretos — só a *fonte* muda de código para operador.
```

**Claim:** O plano declara `regime` como atributo por página, mas define `greenfield` por `routes == []`, que é um sinal global do app.

**Impact:** Em apps mistos, qualquer rota existente força `routes != []`; páginas planejadas sem código podem ser tratadas como brownfield, levando o R2 a minerar valores do código inexistente ou irrelevante.

**Recommendation:** Redefinir `regime` por linha do catálogo usando evidência por página, como `codeEvidencePresent` e `artifactEvidencePresent`, e remover `routes == []` como critério para páginas individuais.

**Confidence:** high

---

### F-002 [critical] Ordering — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:67-72

**Evidence:**
```md
- **D5 — Persistir o catálogo como artefato versionado + checagem de staleness.** O `design-brief`
  Step 2 passa a **ler o catálogo** no lugar do route-Glob, e **cai de volta** pro Glob ao vivo
  quando o catálogo está **ausente OU defasado** (backward-compatible). A persistência é o que dá
  valor cross-execução e o que torna a extração futura barata. **Nota:** o fallback route-Glob é
  rede **só para brownfield** — em greenfield (sem rotas) ele volta vazio (a falha de hoje); quem
  fecha o greenfield é **rodar o passo de reconstrução**, não o fallback.
```

**Claim:** O plano não define uma ordem obrigatória em que a fase de reconstrução gere ou atualize o catálogo antes do Step 2 consumi-lo.

**Impact:** Em greenfield, catálogo ausente ou stale cai no Glob ao vivo, que o próprio plano identifica como retorno vazio; a execução ainda pode produzir ledger vazio sem perguntar ao operador.

**Recommendation:** Tornar a reconstrução etapa obrigatória antes do Step 2 quando o catálogo estiver ausente ou stale, e limitar o fallback Glob-only a modo legado explicitamente opt-in.

**Confidence:** high

---

### F-003 [critical] Dependency break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:131-136

**Evidence:**
```md
- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração.
- (b) **Persistência:** JSON (consumo por máquina, `node -e`) + espelho `.md` legível, ou `.md`
  único? Afeta como o `design-brief` lê.
- (c) **Staleness:** mtime/commit-count vs hash de (rotas + artefatos) — qual sinal dispara o
  fallback pro Glob ao vivo.
```

**Claim:** O plano deixa em aberto mecanismos que D5 e D7 exigem para execução: persistência legível por máquina, staleness e fingerprint de resolução.

**Impact:** Dois implementadores podem escolher formatos e sinais incompatíveis; o `design-brief` pode não conseguir ler o catálogo, detectar stale de forma confiável, ou preservar decisões do operador entre regenerações.

**Recommendation:** Fechar antes do handoff: escolher formato canônico, definir metadados de input hash para staleness, e definir fingerprint por conflito com os campos de evidência usados para reaplicar resolução.

**Confidence:** high

---

### F-004 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:99-107

**Evidence:**
```md
Contrato estável que o
`design-brief` consome = **5 campos** por página (`id/label/purpose`, `audience`, `accessTier`,
`status`, `regime`); `conflicts[]/provenance/aliases` são advisory.
```

**Claim:** O contrato estável não é um schema implementável porque agrupa `id/label/purpose` como um campo, enquanto D4 os apresenta como campos separados e D3 exige proveniência por linha.

**Impact:** Validação e consumo podem divergir: um implementador pode produzir 5 chaves, outro 7 ou mais, e o `design-brief` pode ignorar `provenance` mesmo quando ela é necessária para reconciliar fontes.

**Recommendation:** Substituir o “contrato de 5 campos” por um schema explícito com propriedades, tipos, obrigatoriedade, nullability e quais campos advisory precisam ser preservados.

**Confidence:** high

---

### F-005 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:60-62

**Evidence:**
```md
- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página: `id/label` ·
  `audience {public|private|minor|visitor}` · `accessTier` · `purpose` (uma linha) · `status` ·
  `provenance`.
```

**Claim:** `audience {public|private|minor|visitor}` mistura visibilidade/acesso com tipo de usuário, enquanto `accessTier` já existe para acesso.

**Impact:** Uma página pública para visitantes menores, ou privada para responsáveis por menores, não pode ser representada sem conflito artificial; a lógica de `audience/accessTier == null` para perguntar ao operador será acionada de forma inconsistente.

**Recommendation:** Separar os eixos: mover `public|private` para `accessTier` ou `visibility`, manter `audience` como papéis/segmentos de usuário, e representar `minor` como flag ou segmento independente.

**Confidence:** medium

---

### F-006 [major] Dependency break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:119-122

**Evidence:**
```md
- **Expensive-to-reverse (porta de mão única) — o FORMATO do catálogo.** `design-brief` depende dele
  e a futura `app-map` o herda. Contenção: versionar via `schemaVersion`; congelar os **5 campos**
  do contrato estável; tratar o resto como advisory; validar por schema como o repo já faz para
  state (`verified_by: scripts/validate-state.js` no package.json).
```

**Claim:** O plano promete validação por schema, mas não define o schema, o caminho do schema, nem a integração com `validate-state` para o novo catálogo persistido em `.atomic-skills/projects/<project-id>/`.

**Impact:** O catálogo pode escapar da validação obrigatória de estado durável ou quebrar `npm run validate-state` quando o arquivo for adicionado sem schema correspondente.

**Recommendation:** Adicionar ao plano o arquivo de schema exato em `meta/schemas/`, o padrão de caminho do catálogo, e a alteração necessária em `scripts/validate-state.js` ou no mecanismo existente de descoberta de schemas.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:100 — Qual é o caminho e nome exato do arquivo de catálogo dentro de `.atomic-skills/projects/<project-id>/`?
- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:131 — Resoluções anteriores serão invalidadas por mudança de qualquer evidência ou apenas por mudança no campo conflitado?

## Out of scope

- Non-goals listados: não redesenhar anti-contamination, não criar `app-map`, não mutar artefatos humanos, não colocar interação/forma visual no catálogo.
- Estilo, naming e formatação que não afetam implementação.
- Alternativas rejeitadas como propostas novas.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [blocker] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [critical] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- F-006-final [major] Dependency break — emerged: the external constraint that durable state under `.atomic-skills/` is validated by `validate-state` makes the missing schema path and validation integration a concrete implementation break.
## Self-review against code-quality gates (review-plan)
- G1 read-before-claim: grep for unsourced existing-code claims → 0 (each carries verified_by; 1 unverified-ausência marker on "no ledger-write step").
- G2 soft-language: ban-list grep → 0 real (only the self-review block lists the ban words, L160-162).
- G6 reference-or-strike: existing-code claims carry verified_by; net-new design decisions marked as decisions; 1 unverified.
- Initiative-depth: 0/0 phases (design doc, no `phases:` frontmatter) — checks 14–20 N/A.

## Briefings used
<details><summary>Pass 1 briefing (sealed, factual)</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming. The artifact is in Portuguese; review its substance.

## Non-goals (factual, no rationale)

- Não redesenha o anti-contamination; toca o design-brief só no Step 2 e no R2.
- Não cria a skill app-map agora.
- Não muta artefatos humanos (read-only).
- O catálogo não descreve interação nem forma visual.

## External constraints (verifiable)

- Repo is Node ESM ("type": "module" in package.json) with an "engines" field.
- HARD RULE: every persistent mutation the installer makes must have a matching
  reversal in the uninstaller (enforced by tests/install-uninstall-roundtrip.test.js).
- Skills are schema-validated (npm run validate-skills); state files via validate-state.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md

---BEGIN ARTIFACT---
# design-brief — reconstrução da fonte-de-verdade (superfície de páginas), pronta para extração

Adiciona ao `design-brief` uma **fase de reconstrução da superfície de páginas** que cruza
**artefatos + código** (sempre ambos), trata inconsistências sem escolher vencedor no silêncio,
e emite um **catálogo de arquitetura-de-informação (IA) design-agnóstico** que o próprio
`design-brief` consome. Desenhada como passo isolado + formato de artefato standalone, para que
a promoção a uma futura skill `app-map` seja extração quase mecânica — sem pagar o custo de skill
pública agora. Decisão ratificada pelo operador após painel `brainstorm` (3 vozes + contrária).

## Context

Gatilho real: ao usar `design-brief` num app externo que passou por muitos pivôs, o operador não
tinha um mapa claro de quais páginas existem nem para quem servem. A causa está no escopo da fonte
atual da skill. O Step 2 do `design-brief` reconstrói a superfície **só do código**:

> ### 2. Screen inventory + coverage ledger (§7 — no screen left out)
> Use {{GLOB_TOOL}}/{{GREP_TOOL}} to enumerate the app's routes/views/screens and build a
> **coverage ledger** (each screen → classified / pending).
— `verified_by: skills/core/design-brief.md:39-44`

Num app **em desenvolvimento** ainda não há rotas, então esse scan retorna vazio e o coverage
ledger nasce vazio — falha **silenciosa**. A verdade, nesse estágio, está espalhada nos artefatos
(brainstorms, design docs, plano do `project`, memória), não no código. O `design-brief` já declara
artefatos+intenção como entrada (`verified_by: skills/core/design-brief.md:31-37`), mas o passo de
inventário não os usa, e não persiste o ledger — ele é um passo de build transitório que desaparece
no fim da execução (`unverified: ausência — não há passo de escrita do ledger em design-brief.md`).

## Decisions

- **D1 — Não criar a skill `app-map` agora; enriquecer o `design-brief` in-place, desenhado para
  extração.** Há **1** consumidor real em disco (o próprio `design-brief`). Critério que **este
  design adota** (decisão, não regra citada): promover a skill standalone só com **≥2 consumidores
  reais, não hipotéticos** — coerente com o framing "atomic skills" e com a parity HARD RULE como
  custo *enforced* (`verified_by: CLAUDE.md` cobre só esses dois, não a régua numérica). O custo de
  skill nova é real e *enforced*: entrada em `meta/catalog.yaml`,
  scaffolding `scripts/new-skill.js`, doc gerado, `validate-skills`, paridade testada em
  `tests/install-uninstall-roundtrip.test.js` e `tests/new-skill.test.js`
  (`verified_by: meta/catalog.yaml, scripts/new-skill.js, tests/new-skill.test.js,
  tests/install-uninstall-roundtrip.test.js`). **Gatilho de promoção** para skill standalone:
  quando um **2º consumidor real** ler o catálogo — `brainstorm` B0 carregando-o em vez de
  re-varrer (`verified_by: skills/core/brainstorm.md:28`), ou uma auditoria de acesso
  público/privado/menor.

- **D2 — Fonte = artefatos + código, SEMPRE ambos; reconciliar, nunca escolher no silêncio.**
  Greenfield (`routes == []`) → o artefato é a fonte única. Brownfield → cruza as duas fontes e
  **trata a divergência como produto**: mostra os dois lados com **proveniência** e devolve a
  decisão ao operador via {{ASK_USER_QUESTION_TOOL}}. Resolver no silêncio (pegar o código "porque
  roda" ou o brainstorm "porque é a intenção") terceiriza um palpite — o anti-padrão que o
  `design-brief` já combate (`verified_by: docs/design/design-brief-three-layer-briefing.md:51-59`).

- **D3 — Reconciliação em DOIS eixos ortogonais (não um enum plano de 4 estados).** Uma linha de
  página carrega: (a) **existência** `{confirmed | artefact-only | code-only | possible-alias}`;
  (b) **`conflicts[]`** por-campo, cada um com `{field, artefactValue, codeValue, evidence,
  resolution: pending|resolved}`; (c) **`status`** de ciclo `{built | planned | drifted |
  abandoned}`. O caso load-bearing que o enum plano não representa: a página existe **nas duas**
  fontes (existência `confirmed`) mas elas **discordam no público** (brainstorm diz "visitante",
  código a põe atrás de auth) — isso é `conflict` **de campo**, não de existência. Proveniência é
  **campo** em toda linha, não um estado.

- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página: `id/label` ·
  `audience {public|private|minor|visitor}` · `accessTier` · `purpose` (uma linha) · `status` ·
  `provenance`. Nomear widget, descrever cor/espaçamento (camada 1) ou ditar ritmo/gesto (camada 2)
  é proibido — é a Iron Law anti-contaminação projetada uma camada **acima** das três
  (`verified_by: skills/core/design-brief.md:11`; tabela de 3 camadas
  `verified_by: skills/shared/design-brief-assets/anti-contamination.md:10-14`).

- **D5 — Persistir o catálogo como artefato versionado + checagem de staleness.** O `design-brief`
  Step 2 passa a **ler o catálogo** no lugar do route-Glob, e **cai de volta** pro Glob ao vivo
  quando o catálogo está **ausente OU defasado** (backward-compatible). A persistência é o que dá
  valor cross-execução e o que torna a extração futura barata. **Nota:** o fallback route-Glob é
  rede **só para brownfield** — em greenfield (sem rotas) ele volta vazio (a falha de hoje); quem
  fecha o greenfield é **rodar o passo de reconstrução**, não o fallback.

- **D6 — Regime por-página, não por-projeto.** Um app em dev é misto (`/login` built, `/dashboard`
  artefato-only). `regime = greenfield ⟺ routes == []`. Esse campo comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro. O bloco "Modelo de interação" continua saindo com
  valores concretos — só a *fonte* muda de código para operador.

- **D7 — A fase é read-only sobre os artefatos humanos.** Resolver um conflito grava a escolha
  **no catálogo**, não de volta no brainstorm/plano. Mutar artefatos autorais a partir de um passo
  de leitura é scope creep e exigiria o ratify gate do `project` — fora de escopo. (Mecanismo exato
  de supressão de conflito já respondido → Open questions.)

## Chosen approach

Abordagens pesadas no painel:

1. **Skill `app-map` standalone agora** (Integration realist, Lifecycle architect) — emite um
   arquivo que `design-brief` e futuros consumidores leem. Rejeitada **por timing**: 2º consumidor
   é hipotético hoje; custo público enforced; extração-depois é barata.
2. **Prove-in-place, pronto para extrair** *(escolhida)* — corrige o bug greenfield, adiciona as
   colunas de IA, **persiste** o catálogo e isola o passo + o formato, de modo que promover a
   `app-map` seja quase mecânico.
3. **Mínimo: só consertar greenfield no Step 2** — rejeitada na ratificação: conserta a falha mas
   joga fora a persistência (o que dá valor e barateia a extração).

**Como (#2):** o passo novo vive como uma fase explícita do `design-brief` (Step 0 / Step 2
enriquecido), produzindo um catálogo persistido em `.atomic-skills/projects/<project-id>/` (árvore
versionada, não ignorada — `verified_by: CLAUDE.md` install-parity). Contrato estável que o
`design-brief` consome = **5 campos** por página (`id/label/purpose`, `audience`, `accessTier`,
`status`, `regime`); `conflicts[]/provenance/aliases` são advisory. `audience/accessTier` em `null`
(conflito não resolvido) é o gatilho de "parar e perguntar" que a §1 do `design-brief` já manda
(`verified_by: skills/core/design-brief.md:31-37`). A **costura de extração**: passo isolado +
formato standalone + contrato de 5 campos versionado por `schemaVersion` — promover a skill é mover
o passo e registrar o consumidor, sem reescrever semântica.

## Non-goals

- Não redesenha o coração anti-contaminação; toca o `design-brief` só no Step 2 (ler catálogo) e no
  R2 (switch mine→ask). As camadas 2/3 ficam como estão.
- Não cria a skill `app-map` agora (só a deixa extraível).
- Não muta artefatos humanos (brainstorms/plano) — read-only (D7).
- O catálogo não descreve interação nem forma visual (D4).

## Blast radius

- **Expensive-to-reverse (porta de mão única) — o FORMATO do catálogo.** `design-brief` depende dele
  e a futura `app-map` o herda. Contenção: versionar via `schemaVersion`; congelar os **5 campos**
  do contrato estável; tratar o resto como advisory; validar por schema como o repo já faz para
  state (`verified_by: scripts/validate-state.js` no package.json).
- **Médio — mudar o Step 2** (de Glob-only para ler-catálogo). Toca um caminho existente do
  `design-brief`. Contenção: fallback backward-compatible — ausente **ou** stale → route-Glob ao
  vivo; o comportamento atual sobrevive quando não há catálogo.
- **Baixo — aditivos:** colunas de IA, regime por-página, e a costura de extração não alteram
  caminhos existentes.

## Open questions

- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração.
- (b) **Persistência:** JSON (consumo por máquina, `node -e`) + espelho `.md` legível, ou `.md`
  único? Afeta como o `design-brief` lê.
- (c) **Staleness:** mtime/commit-count vs hash de (rotas + artefatos) — qual sinal dispara o
  fallback pro Glob ao vivo.
- (d) **Alias / rotas dinâmicas:** limiar de fuzzy-merge (logical-page como chave de join, não a
  URL) e como apresentar `possible-alias` ao operador.
- (e) **plan-slug** — o doc já vive em `design-brief-source-of-truth/` (slug comprometido pela
  localização); confirmar se mantém ou renomeia antes do handoff pro PLAN.

## Rejected alternatives

- **A — Skill `app-map` standalone agora.** Dissidência preservada verbatim:
  > *Integration realist:* "one skill, one contract, two consumers… a standalone skill that emits a
  > file lets design-brief (and a future a11y/SEO/routing audit) consume the same artefact."
  > *Lifecycle architect:* folding "means the contamination firewall now has to also police a second,
  > differently-shaped artefact… One skill, one Iron Law."
  Rejeitada por timing (D1), não por mérito do end-state.
- **C — Subcomando do `project` (`project map`).** Rejeitada: `project` é gramática git-style sobre
  **estado mutável** de trabalho, e `new` expõe só file-entities (plan|initiative); um scan read-only
  de IA inverte a direção de dados e não cabe (`verified_by: skills/core/project.md` grammar §).
- **Enum plano de 4 estados.** Rejeitado: confunde dois eixos ortogonais; não representa "existe nas
  duas fontes, discorda no campo X" (ver D3).

---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: decision X says A, decision Y says non-A
2. **Coverage gaps**: a stated requirement or constraint has no corresponding decision
3. **Dependency breaks**: a decision references a mechanism/artifact no decision defines
4. **Ordering bugs**: a decision depends on something established only later
5. **Ambiguity**: a decision vague enough that two engineers would implement it differently
6. **Viability**: a decision technically infeasible or carrying severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.

---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. Substance only. If verdict is approve, say so in one sentence and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — be specific, not abstract>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002 ...)

## Questions (non-findings)

- <file>:<line> — <question to author>

## Out of scope

- <item>

## Format rules

- IDs must match regex `F-\d{3}`. Severity enum: blocker|critical|major|minor|nit. Confidence enum: high|medium|low.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```
</details>

<details><summary>Pass 2 briefing (informed)</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming. The artifact is in Portuguese; review its substance.

## Non-goals (factual, no rationale)

- Não redesenha o anti-contamination; toca o design-brief só no Step 2 e no R2.
- Não cria a skill app-map agora.
- Não muta artefatos humanos (read-only).
- O catálogo não descreve interação nem forma visual.

## External constraints (verifiable)

- Repo is Node ESM ("type": "module" in package.json) with an "engines" field.
- HARD RULE: every persistent mutation the installer makes must have a matching
  reversal in the uninstaller (enforced by tests/install-uninstall-roundtrip.test.js).
- Skills are schema-validated (npm run validate-skills); state files via validate-state.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md

---BEGIN ARTIFACT---
# design-brief — reconstrução da fonte-de-verdade (superfície de páginas), pronta para extração

Adiciona ao `design-brief` uma **fase de reconstrução da superfície de páginas** que cruza
**artefatos + código** (sempre ambos), trata inconsistências sem escolher vencedor no silêncio,
e emite um **catálogo de arquitetura-de-informação (IA) design-agnóstico** que o próprio
`design-brief` consome. Desenhada como passo isolado + formato de artefato standalone, para que
a promoção a uma futura skill `app-map` seja extração quase mecânica — sem pagar o custo de skill
pública agora. Decisão ratificada pelo operador após painel `brainstorm` (3 vozes + contrária).

## Context

Gatilho real: ao usar `design-brief` num app externo que passou por muitos pivôs, o operador não
tinha um mapa claro de quais páginas existem nem para quem servem. A causa está no escopo da fonte
atual da skill. O Step 2 do `design-brief` reconstrói a superfície **só do código**:

> ### 2. Screen inventory + coverage ledger (§7 — no screen left out)
> Use {{GLOB_TOOL}}/{{GREP_TOOL}} to enumerate the app's routes/views/screens and build a
> **coverage ledger** (each screen → classified / pending).
— `verified_by: skills/core/design-brief.md:39-44`

Num app **em desenvolvimento** ainda não há rotas, então esse scan retorna vazio e o coverage
ledger nasce vazio — falha **silenciosa**. A verdade, nesse estágio, está espalhada nos artefatos
(brainstorms, design docs, plano do `project`, memória), não no código. O `design-brief` já declara
artefatos+intenção como entrada (`verified_by: skills/core/design-brief.md:31-37`), mas o passo de
inventário não os usa, e não persiste o ledger — ele é um passo de build transitório que desaparece
no fim da execução (`unverified: ausência — não há passo de escrita do ledger em design-brief.md`).

## Decisions

- **D1 — Não criar a skill `app-map` agora; enriquecer o `design-brief` in-place, desenhado para
  extração.** Há **1** consumidor real em disco (o próprio `design-brief`). Critério que **este
  design adota** (decisão, não regra citada): promover a skill standalone só com **≥2 consumidores
  reais, não hipotéticos** — coerente com o framing "atomic skills" e com a parity HARD RULE como
  custo *enforced* (`verified_by: CLAUDE.md` cobre só esses dois, não a régua numérica). O custo de
  skill nova é real e *enforced*: entrada em `meta/catalog.yaml`,
  scaffolding `scripts/new-skill.js`, doc gerado, `validate-skills`, paridade testada em
  `tests/install-uninstall-roundtrip.test.js` e `tests/new-skill.test.js`
  (`verified_by: meta/catalog.yaml, scripts/new-skill.js, tests/new-skill.test.js,
  tests/install-uninstall-roundtrip.test.js`). **Gatilho de promoção** para skill standalone:
  quando um **2º consumidor real** ler o catálogo — `brainstorm` B0 carregando-o em vez de
  re-varrer (`verified_by: skills/core/brainstorm.md:28`), ou uma auditoria de acesso
  público/privado/menor.

- **D2 — Fonte = artefatos + código, SEMPRE ambos; reconciliar, nunca escolher no silêncio.**
  Greenfield (`routes == []`) → o artefato é a fonte única. Brownfield → cruza as duas fontes e
  **trata a divergência como produto**: mostra os dois lados com **proveniência** e devolve a
  decisão ao operador via {{ASK_USER_QUESTION_TOOL}}. Resolver no silêncio (pegar o código "porque
  roda" ou o brainstorm "porque é a intenção") terceiriza um palpite — o anti-padrão que o
  `design-brief` já combate (`verified_by: docs/design/design-brief-three-layer-briefing.md:51-59`).

- **D3 — Reconciliação em DOIS eixos ortogonais (não um enum plano de 4 estados).** Uma linha de
  página carrega: (a) **existência** `{confirmed | artefact-only | code-only | possible-alias}`;
  (b) **`conflicts[]`** por-campo, cada um com `{field, artefactValue, codeValue, evidence,
  resolution: pending|resolved}`; (c) **`status`** de ciclo `{built | planned | drifted |
  abandoned}`. O caso load-bearing que o enum plano não representa: a página existe **nas duas**
  fontes (existência `confirmed`) mas elas **discordam no público** (brainstorm diz "visitante",
  código a põe atrás de auth) — isso é `conflict` **de campo**, não de existência. Proveniência é
  **campo** em toda linha, não um estado.

- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página: `id/label` ·
  `audience {public|private|minor|visitor}` · `accessTier` · `purpose` (uma linha) · `status` ·
  `provenance`. Nomear widget, descrever cor/espaçamento (camada 1) ou ditar ritmo/gesto (camada 2)
  é proibido — é a Iron Law anti-contaminação projetada uma camada **acima** das três
  (`verified_by: skills/core/design-brief.md:11`; tabela de 3 camadas
  `verified_by: skills/shared/design-brief-assets/anti-contamination.md:10-14`).

- **D5 — Persistir o catálogo como artefato versionado + checagem de staleness.** O `design-brief`
  Step 2 passa a **ler o catálogo** no lugar do route-Glob, e **cai de volta** pro Glob ao vivo
  quando o catálogo está **ausente OU defasado** (backward-compatible). A persistência é o que dá
  valor cross-execução e o que torna a extração futura barata. **Nota:** o fallback route-Glob é
  rede **só para brownfield** — em greenfield (sem rotas) ele volta vazio (a falha de hoje); quem
  fecha o greenfield é **rodar o passo de reconstrução**, não o fallback.

- **D6 — Regime por-página, não por-projeto.** Um app em dev é misto (`/login` built, `/dashboard`
  artefato-only). `regime = greenfield ⟺ routes == []`. Esse campo comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro. O bloco "Modelo de interação" continua saindo com
  valores concretos — só a *fonte* muda de código para operador.

- **D7 — A fase é read-only sobre os artefatos humanos.** Resolver um conflito grava a escolha
  **no catálogo**, não de volta no brainstorm/plano. Mutar artefatos autorais a partir de um passo
  de leitura é scope creep e exigiria o ratify gate do `project` — fora de escopo. (Mecanismo exato
  de supressão de conflito já respondido → Open questions.)

## Chosen approach

Abordagens pesadas no painel:

1. **Skill `app-map` standalone agora** (Integration realist, Lifecycle architect) — emite um
   arquivo que `design-brief` e futuros consumidores leem. Rejeitada **por timing**: 2º consumidor
   é hipotético hoje; custo público enforced; extração-depois é barata.
2. **Prove-in-place, pronto para extrair** *(escolhida)* — corrige o bug greenfield, adiciona as
   colunas de IA, **persiste** o catálogo e isola o passo + o formato, de modo que promover a
   `app-map` seja quase mecânico.
3. **Mínimo: só consertar greenfield no Step 2** — rejeitada na ratificação: conserta a falha mas
   joga fora a persistência (o que dá valor e barateia a extração).

**Como (#2):** o passo novo vive como uma fase explícita do `design-brief` (Step 0 / Step 2
enriquecido), produzindo um catálogo persistido em `.atomic-skills/projects/<project-id>/` (árvore
versionada, não ignorada — `verified_by: CLAUDE.md` install-parity). Contrato estável que o
`design-brief` consome = **5 campos** por página (`id/label/purpose`, `audience`, `accessTier`,
`status`, `regime`); `conflicts[]/provenance/aliases` são advisory. `audience/accessTier` em `null`
(conflito não resolvido) é o gatilho de "parar e perguntar" que a §1 do `design-brief` já manda
(`verified_by: skills/core/design-brief.md:31-37`). A **costura de extração**: passo isolado +
formato standalone + contrato de 5 campos versionado por `schemaVersion` — promover a skill é mover
o passo e registrar o consumidor, sem reescrever semântica.

## Non-goals

- Não redesenha o coração anti-contaminação; toca o `design-brief` só no Step 2 (ler catálogo) e no
  R2 (switch mine→ask). As camadas 2/3 ficam como estão.
- Não cria a skill `app-map` agora (só a deixa extraível).
- Não muta artefatos humanos (brainstorms/plano) — read-only (D7).
- O catálogo não descreve interação nem forma visual (D4).

## Blast radius

- **Expensive-to-reverse (porta de mão única) — o FORMATO do catálogo.** `design-brief` depende dele
  e a futura `app-map` o herda. Contenção: versionar via `schemaVersion`; congelar os **5 campos**
  do contrato estável; tratar o resto como advisory; validar por schema como o repo já faz para
  state (`verified_by: scripts/validate-state.js` no package.json).
- **Médio — mudar o Step 2** (de Glob-only para ler-catálogo). Toca um caminho existente do
  `design-brief`. Contenção: fallback backward-compatible — ausente **ou** stale → route-Glob ao
  vivo; o comportamento atual sobrevive quando não há catálogo.
- **Baixo — aditivos:** colunas de IA, regime por-página, e a costura de extração não alteram
  caminhos existentes.

## Open questions

- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração.
- (b) **Persistência:** JSON (consumo por máquina, `node -e`) + espelho `.md` legível, ou `.md`
  único? Afeta como o `design-brief` lê.
- (c) **Staleness:** mtime/commit-count vs hash de (rotas + artefatos) — qual sinal dispara o
  fallback pro Glob ao vivo.
- (d) **Alias / rotas dinâmicas:** limiar de fuzzy-merge (logical-page como chave de join, não a
  URL) e como apresentar `possible-alias` ao operador.
- (e) **plan-slug** — o doc já vive em `design-brief-source-of-truth/` (slug comprometido pela
  localização); confirmar se mantém ou renomeia antes do handoff pro PLAN.

## Rejected alternatives

- **A — Skill `app-map` standalone agora.** Dissidência preservada verbatim:
  > *Integration realist:* "one skill, one contract, two consumers… a standalone skill that emits a
  > file lets design-brief (and a future a11y/SEO/routing audit) consume the same artefact."
  > *Lifecycle architect:* folding "means the contamination firewall now has to also police a second,
  > differently-shaped artefact… One skill, one Iron Law."
  Rejeitada por timing (D1), não por mérito do end-state.
- **C — Subcomando do `project` (`project map`).** Rejeitada: `project` é gramática git-style sobre
  **estado mutável** de trabalho, e `new` expõe só file-entities (plan|initiative); um scan read-only
  de IA inverte a direção de dados e não cabe (`verified_by: skills/core/project.md` grammar §).
- **Enum plano de 4 estados.** Rejeitado: confunde dois eixos ortogonais; não representa "existe nas
  duas fontes, discorda no campo X" (ver D3).

---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: decision X says A, decision Y says non-A
2. **Coverage gaps**: a stated requirement or constraint has no corresponding decision
3. **Dependency breaks**: a decision references a mechanism/artifact no decision defines
4. **Ordering bugs**: a decision depends on something established only later
5. **Ambiguity**: a decision vague enough that two engineers would implement it differently
6. **Viability**: a decision technically infeasible or carrying severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.

---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. Substance only. If verdict is approve, say so in one sentence and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — be specific, not abstract>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002 ...)

## Questions (non-findings)

- <file>:<line> — <question to author>

## Out of scope

- <item>

## Format rules

- IDs must match regex `F-\d{3}`. Severity enum: blocker|critical|major|minor|nit. Confidence enum: high|medium|low.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Repo is Node ESM ("type": "module" in package.json) and declares an "engines" field. Verify: grep '"type"' '"engines"' package.json.
- HARD RULE: every persistent mutation the installer makes must have a matching reversal in the uninstaller, enforced by tests/install-uninstall-roundtrip.test.js. Verify: CLAUDE.md section "Install / Uninstall parity".
- Skills are schema-validated by `npm run validate-skills`; durable state files under .atomic-skills/ are validated by `npm run validate-state` (against JSON Schemas in meta/schemas/). Verify: package.json scripts + meta/schemas/.

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 1, critical: 2, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
O plano ainda não é implementável sem decisões adicionais. O problema central é que ele declara comportamento por página, mas define sinais globais ou pendentes para regimes, staleness, persistência e resolução de conflitos. Isso cria caminhos onde o `design-brief` continuará caindo no comportamento atual justamente no caso greenfield que o plano pretende corrigir.

As maiores falhas são contradições internas e dependências não definidas: o consumidor lê um catálogo que pode não existir, a detecção de stale é obrigatória mas aberta, e decisões do operador são gravadas sem mecanismo estável de reaplicação. Implementar agora exigiria que o engenheiro escolhesse sem contrato.

## Findings

### F-001 [blocker] Contradiction — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:74-79

**Evidence:**
```md
- **D6 — Regime por-página, não por-projeto.** Um app em dev é misto (`/login` built, `/dashboard`
  artefato-only). `regime = greenfield ⟺ routes == []`. Esse campo comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro.
```

**Claim:** O plano diz que `regime` é por página, mas define `greenfield` por `routes == []`, que é um sinal global do app e não distingue `/login` built de `/dashboard` artefato-only.

**Impact:** Em apps mistos, qualquer rota existente torna `routes != []`; páginas planejadas sem código serão tratadas como brownfield, levando o R2 a minerar valores do código inexistente ou irrelevante e a silenciar exatamente o caso que o plano diz cobrir.

**Recommendation:** Redefinir `regime` por linha do catálogo usando evidência por página, por exemplo `codeEvidencePresent`/`artifactEvidencePresent` ou `existence/status`, e remover `routes == []` como critério para páginas individuais.

**Confidence:** high

---

### F-002 [critical] Ordering — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:67-72

**Evidence:**
```md
- **D5 — Persistir o catálogo como artefato versionado + checagem de staleness.** O `design-brief`
  Step 2 passa a **ler o catálogo** no lugar do route-Glob, e **cai de volta** pro Glob ao vivo
  quando o catálogo está **ausente OU defasado** (backward-compatible).
```

**Claim:** O plano não define uma ordem obrigatória em que a fase de reconstrução gere ou atualize o catálogo antes do Step 2 consumi-lo.

**Impact:** Em greenfield, catálogo ausente ou defasado cai no Glob ao vivo, que o próprio plano identifica como retorno vazio; a execução continua podendo produzir ledger vazio sem pergunta ao operador.

**Recommendation:** Tornar a reconstrução uma etapa obrigatória antes do Step 2 quando o catálogo estiver ausente ou stale, e limitar o fallback Glob-only a execução legada explicitamente opt-in.

**Confidence:** high

---

### F-003 [critical] Dependency break — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:131-136

**Evidence:**
```md
- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração.
- (b) **Persistência:** JSON (consumo por máquina, `node -e`) + espelho `.md` legível, ou `.md`
  único? Afeta como o `design-brief` lê.
- (c) **Staleness:** mtime/commit-count vs hash de (rotas + artefatos) — qual sinal dispara o
  fallback pro Glob ao vivo.
```

**Claim:** O plano deixa em aberto mecanismos que D5 e D7 tratam como requisitos de execução: persistência legível por máquina, staleness e fingerprint de resolução.

**Impact:** Dois implementadores podem escolher formatos e sinais incompatíveis; `design-brief` pode não conseguir ler o catálogo, detectar stale de forma confiável, ou preservar decisões do operador entre regenerações.

**Recommendation:** Fechar antes do handoff: escolher formato único canônico, definir metadados de input hash para staleness, e definir fingerprint por conflito com os campos de evidência usados para reaplicar resolução.

**Confidence:** high

---

### F-004 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:99-107

**Evidence:**
```md
Contrato estável que o
`design-brief` consome = **5 campos** por página (`id/label/purpose`, `audience`, `accessTier`,
`status`, `regime`); `conflicts[]/provenance/aliases` são advisory.
```

**Claim:** O contrato estável não é um schema implementável porque agrupa `id/label/purpose` como um campo, enquanto D4 os apresenta como campos separados e D3 exige proveniência por linha.

**Impact:** Validação e consumo podem divergir: um implementador pode produzir 5 chaves, outro 7 ou mais, e o `design-brief` pode ignorar `provenance` mesmo quando ela é necessária para reconciliar fontes.

**Recommendation:** Substituir o “contrato de 5 campos” por um schema explícito com propriedades, tipos, obrigatoriedade, nullability e quais campos advisory ainda precisam ser preservados.

**Confidence:** high

---

### F-005 [major] Ambiguity — .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:60-62

**Evidence:**
```md
- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página: `id/label` ·
  `audience {public|private|minor|visitor}` · `accessTier` · `purpose` (uma linha) · `status` ·
  `provenance`.
```

**Claim:** `audience {public|private|minor|visitor}` mistura visibilidade/acesso com tipo de usuário, enquanto `accessTier` já existe para acesso.

**Impact:** Uma página pública para visitantes menores, ou privada para responsáveis por menores, não pode ser representada sem conflito artificial; a lógica de `audience/accessTier == null` para perguntar ao operador será acionada de forma inconsistente.

**Recommendation:** Separar os eixos: mover `public|private` para `accessTier` ou `visibility`, manter `audience` como papéis/segmentos de usuário, e representar `minor` como flag ou segmento independente.

**Confidence:** medium

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:100 — Qual é o caminho e nome exato do arquivo de catálogo dentro de `.atomic-skills/projects/<project-id>/`?
- .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md:121 — O novo catálogo será validado por `validate-state` ou por um validador próprio integrado a `validate-skills`/testes?

## Out of scope

- Não revisei alternativas rejeitadas como propostas novas.
- Não avaliei estilo, nomes ou formatação.
- Não propus criar a skill `app-map`.
- Não propus mutação de artefatos humanos.
---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - DROP — finding is invalid given a constraint or non-goal
   - MAINTAIN — finding stands, severity unchanged
   - REFINE — finding stands but severity changes
2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).
3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

You MUST respond in this exact structure. No prose before frontmatter.

---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:**
```
<exact snippet>
```

**Claim:** <single sentence>

**Impact:** <concrete consequence>

**Recommendation:** <specific action>

**Confidence:** <high | medium | low>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

- F-XXX-blind [<severity>] <category> — DROPPED: <reason citing the constraint/non-goal>
(If no drops: write `- _(none)_`)

### Maintained

- F-XXX-blind → F-YYY-final [<severity>] — <same | severity changed: was X, now Y>
(If no maintained: write `- _(none)_`)

### Emerged

- F-YYY-final [<severity>] <category> — emerged: <reason citing the constraint that triggered it>
(If no emerged: write `- _(none)_`)

## Pass-2 rules

- Final findings use sequential IDs F-001, F-002, ... (no -final suffix in the Findings section).
- In reconciliation, refer to blind findings with -blind suffix and maintained mappings with → F-XXX-final.
- counts = COUNT OF FINAL findings (post-reconciliation), not blind.
- pass: informed (literal).

Begin reconciliation now.
```
</details>

## Fixes applied in this session
<!-- Append-only. Triage step adds lines as the user approves/skips. -->

### Triage applied (2026-06-15, mode=both, user: apply all 6)
- F-001 [blocker] regime per-page criterion → D6 redefinido por evidência de código da própria página; removido `routes == []` global. APPLIED.
- F-002 [critical] ordering → D5: reconstrução é pré-condição obrigatória do Step 2; route-Glob vira modo legado opt-in. APPLIED.
- F-003 [critical] open exec-deps → formato `app-map.json` decidido agora (D5); (a)/(c) reclassificados como mecanismo de PLAN; (b) marcado RESOLVIDO. APPLIED.
- F-004 [major] "5 campos" → Chosen approach: conjunto de campos separados; JSON Schema completo → PLAN (meta/schemas/app-map.schema.json). APPLIED.
- F-005 [major] audience enum → D4: eixos separados (accessTier=visibilidade public|auth; audience=segmento visitor|minor|...); minor é segmento. APPLIED.
- F-006 [major] schema/validate-state wiring → Blast radius: catálogo validado como state durável; schema em meta/schemas/; fiação exata → PLAN. APPLIED.
- Re-lint --migration: PASS. Note: review-plan applies-and-ends (no codex re-run); a `--mode=codex` re-pass would confirm the blocker/criticals cleared.
