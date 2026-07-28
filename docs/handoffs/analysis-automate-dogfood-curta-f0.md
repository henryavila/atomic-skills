# Análise: Dogfood `executionMode: automate` (curta / multi-model-capacity F0)

**Fonte:** `docs/handoffs/automate-dogfood-curta-f0.md`  
**Cruzado com:** schema canônico (PR #38), `src/maestro-cursor.js` (`MAX_REDISPATCH = 2`), branch `backup/local-lessons-schema-0c9f7288`, docs do maestro.  
**Data da análise:** 27/jul/2026

---

## Veredito em uma frase

O handoff é **alto valor**: expõe que o automate *fecha fases de verdade*, mas o teto de re-dispatch e várias APIs/docs ainda tratam o host como um operador cuidadoso em vez de um executor falível sob pressão de gates.

---

## 1. O que o report prova

| Afirmação do handoff | Status no repo (hoje) | Implicação |
|---|---|---|
| Commit acidental no `develop` foi descartado | Confirmado: HEAD = `9a6a865b`; backup branch ainda existe | Incidente contido; só falta limpar a branch |
| Schema `lessonsState`/`lessonsPath` canônico no PR #38 | Confirmado em `meta/schemas/plan.schema.json` | Defeito §2 **fechado** |
| Backup tem extra `lessonsVerifiedAt` | Confirmado no tip da backup branch | Decisão real, não ruído |
| `MAX_REDISPATCH = 2` | Confirmado em `src/maestro-cursor.js:66` | Teto baixo vs. cadeia real de gates |
| 9 atritos de API/doc/lifecycle | Coerentes com o contrato pure-maestro | Backlog de polish pós-dogfood |

**O valor principal não é o bug de schema** (já morto). É a **cadeia empírica** da F0: 5 rotas de default silencioso, 4 delas só descobertas por gates *posteriores* — e isso colide de frente com um contador de re-dispatch que conta “rounds de código”, não “thrash”.

---

## 2. Ranking de severidade (para o produto automate)

### P0 — Design / política (bloqueia honestidade do modo)

**§4 — Teto de re-dispatch superado 4× com override manual**

- Sintoma: limite que *sempre* cede vira fricção + log, não política.
- Causa estrutural: gates posteriores (evaluation → re-eval → phase review) **devem** poder gerar trabalho novo *depois* de tasks `done`. O teto não distingue:
  - **retry do mesmo achado** (thrash — o que se quer cortar)
  - **disposição nova de gate posterior** (progresso legítimo)
- Impacto: sob pure-maestro, o host vira operador de contador (`redispatchCount: 1` na mão). Isso viola o espírito “host-thin / fail-closed com rastro”.

**Recomendação (minha, com preferência):** opção **2** do handoff, depois evoluir para **1** se o volume justificar.

1. **Curto prazo — opção 2 (first-class override):**  
   `operatorOverrides: [{ at, reason, gate, priorCount }]` no cursor. Teto permanece 2 *sem* override; cada superação é stamp + decision-log, não mutação ad-hoc do contador. Auditável, barato, alinhado ao que o dogfood já fez 4 vezes.
2. **Médio prazo — opção 1 (contar por causa):**  
   Só se o override virar rotina em várias fases (evidência: ≥2 planos). Mais honesto semanticamente, mais difícil de implementar sem o host mentir sobre “mesmo achado”.
3. **Opção 3 (teto por disposição):**  
   Atrai, mas multiplica contadores e confunde o operador (“2 por disposition × N gates”). Deixar de lado por ora.

**Não recomendo** “deixar como está”: o handoff já demonstrou que o estado atual treina o host a contornar o teto.

---

### P1 — Bugs / contratos que mentem (falsos positivos / silêncio perigoso)

| # | Item | Por que é P1 | Fix mínimo |
|---|---|---|---|
| **3.1** | `appendDecision` retorna `{ok:false}` e o host reportou sucesso | Mentira ao operador sobre estado durável — pior classe de falha em automate | Preferir **throw por default** + `tryAppendDecision`; no mínimo validar `r.ok` no asset do maestro e documentar a forma-objeto `{ statusRoot, projectId, planSlug, phaseId }` |
| **3.2** | `parseClaimReport` só aceita `tasks[]` | Writer brief inventa `claims[]` → null → hard fail | Uma linha no maestro: *“array key is `tasks`”* + alias `claims` se barato |
| **3.8** | Sucessor `active` sob automate vs. “não materializar” | Doc genérico vs. regra automate se contradizem; host faz o errado “seguindo o manual” | Em `project-transitions.md`: sob automate, avanço = **só ponteiro** `currentPhase`; fase fica `pending` até materialize |
| **3.9** | `validate-state` não varre archive / não aceita plan dir como doc manda | Pós-`phase-done`, validação parcial grita órfão; comando documentado quebra | Doc ou código: ou varre `phases/archive/`, ou o doc diz os paths exatos a passar |

**3.1 é o único P1 que eu trataria como bug de produto, não só de docs.** Falso “appended” em decision log destrói a premissa de auditoria do automate.

---

### P2 — Assimetrias e DX (não bloqueiam, custam tempo)

| # | Item | Nota |
|---|---|---|
| **3.3** | `reviewReceipt` no gate, rejeitado no schema | Mesma classe do lessons bug — schema/gate drift; contorno `--complex-receipts` existe; fechar no próximo plano de polish |
| **3.4** | Sem CLI para lessons (só `--complex-receipts`) | Assimétrico; com schema ok é nicety |
| **3.5** | `parentPlan`/`phaseId` no topo, não derivados de `initiative` | API pedante; derivar com fallback é win fácil e reduz erros de host |
| **3.6** | Dual-leg paths distintos | Gate **correto**; só falta documentar “não aponte os dois pro consolidado” |
| **3.7** | `external-both` aceito em phase review | Comportamento mais forte que `both` parece certo; **alinhar o texto** do maestro (não o gate) |

---

### P3 — Processo / hygiene

| # | Item | Recomendação |
|---|---|---|
| **§1.5** | Hard rule “repositório terceiro” | **Adotar.** Incidente real, barato de codificar no `implement-automate-maestro.md`. A autorização foi no *quê*, não no *onde* — isso vai repetir (skills em atomic-skills enquanto o plano é no curta). |
| **§1.4** | Branch `backup/local-lessons-schema-0c9f7288` | Ver §3 abaixo |
| **§2 acoplamento** | Gate + docs + schema divergiram | Vale um teste de lifecycle reachability (plano mínimo automate → stamp lessons → `canRunPhaseDone`), não só shape validation |

---

## 3. Decisões abertas — recomendações concretas

O handoff lista 5 decisões. Respostas sugeridas:

### 1. `lessonsVerifiedAt` — incorporar ou apagar branch?

**Apagar a branch, não incorporar agora** — a menos que o gate *já* leia esse timestamp.

- Canônico tem `lessonsState` + `lessonsPath` + `noneReason`. Isso fecha o honesty gate (“answered”).
- `lessonsVerifiedAt` é audit metadata (quando o operador ratificou). Útil, mas:
  - não desbloqueia nada que o gate peça hoje;
  - adiciona um campo opcional sem enforcement (risco de schema drift de novo se alguém começar a exigir e o schema esquecer);
  - o decision-log / stamp de decision-review já carrega tempo de ratificação em outros pontos.

Se quiser o campo depois: PR pequeno, schema + opcional no `buildLessonsState`, **sem** tornar required no gate até ter um consumidor real.

**Ação:** `git branch -D backup/local-lessons-schema-0c9f7288` (ou deixar arquivada no remoto se já pushou — local-only, pode deletar).

### 2. Hard rule repositório terceiro?

**Sim.** Texto do §1.5 está pronto para colar. Complemento sugerido: em dogfood cross-repo, o host declara no decision-log `tooling-gap` **antes** de editar, e nunca `git commit` fora da plan-branch do plano ativo sem AskUserQuestion com o path do repo no prompt.

### 3. `appendDecision` — throw ou só documentar?

**Throw por default** (breaking para callers internos — varrer `src/` e skills; se a superfície for só host/scripts, barato).

Se houver callers que dependem de `{ok:false}` (ex. batch), expor `tryAppendDecision` e migrar. Documentar sozinho **não basta**: o dogfood mostrou que sob carga o host ignora `r.ok`.

Mínimo aceitável se throw for grande demais nesta sprint: wrapper no asset do maestro que **falha a sessão** se `!r.ok`, + exemplo de locator objeto.

### 4. Alinhar `project-transitions.md` (§3.8 / §3.9)?

**Sim, prioridade alta de docs.** Custa pouco e evita o próximo host marcar F1 `active` de novo.

Para §3.9: ou implementa scan de `phases/archive/` no `validate-state`, ou corrige a doc para:

```text
validate-state plan.md phases/archive/fN-*.md
```

Preferência: **corrigir o comando** para aceitar o plan directory e incluir archive — o texto em `:270` já promete isso.

### 5. Teto de re-dispatch?

Ver P0 acima → **opção 2 first-class overrides**, teto 2 permanece como default sem override.

---

## 4. O que o dogfood ensina sobre a cadeia de gates

### A cadeia funciona (argumento a favor)

F0 fechou 5 rotas de default silencioso; 4 só após evaluation / re-eval / phase review. Isso **não** é falha do design — é o design entregando o que o unit test não vê. O handoff §5 está certo: o custo dos overrides *é* o preço da profundidade.

### O modelo de contagem não acompanha (argumento a favor de redesign)

A tabela do §4 é a peça mais importante do documento:

```
per-task review → redispatch 1–2
API death → (infra)
scope expand → override 1
evaluation major → override 2
re-eval Protocol → override 3
phase external-both → override 4
```

Padrão: **cada camada de prova vê uma classe de erro que a anterior não tinha permissão de ver** (herança, fonte única, ledger exemption). Contar isso no mesmo bucket que “fix agent falhou no mesmo bug” é category error.

### Meta-lição de processo

O incidente §1 e o atrito §3.1 compartilham a mesma falha de forma:

> APIs e autorizações que prometem efeito (commit, append) sem amarrar **destino** / **sucesso observável**.

Hard rules de maestro deveriam ser escritas contra *efeitos colaterais e mentiras de estado*, não só contra editar product source.

---

## 5. Backlog sugerido (ordem de ataque)

Assumindo que o destino é o plano `automate-default-and-operator-gates` (já arquivado) ou um follow-up de polish:

| Ordem | Trabalho | Tipo | Esforço |
|---|---|---|---|
| 1 | Hard rule repositório terceiro no maestro | docs | S |
| 2 | Doc: sucessor sob automate = pointer only; dual-leg paths distintos; claim array key `tasks`; external-both vs both | docs | S |
| 3 | `appendDecision` fail-loud (throw ou host wrapper hard-stop) | code | M |
| 4 | First-class `operatorOverrides` no cursor + gate que rejeita redispatch >2 sem override stamp | code | M |
| 5 | `validate-state` plan-dir + archive scan | code | M |
| 6 | Derivar `parentPlan`/`phaseId` de initiative; alias `claims` | code | S |
| 7 | Schema/gate align `reviewReceipt` (ou banir do objeto task e só aceitar via file) | code | M |
| 8 | Teste lifecycle: min plan automate → lessons stamp → `canRunPhaseDone` | test | M |
| 9 | Apagar backup branch | hygiene | S |
| 10 | (Opcional) `lessonsVerifiedAt` se surgir consumidor | schema | S |

Itens 1–2 + 9 podem ir num PR de docs/hygiene no mesmo dia. 3–5 são o miolo de “automate dogfood follow-up”.

---

## 6. Qualidade do handoff em si

**Pontos fortes**

- Evidência verbatim (erros de gate, grep de schema, reflog) — reproduzível.
- Separação clara incidente / defeito / atrito / design question.
- Não pede reabrir o schema bug; foca no residual.
- Honestidade sobre erro do agente (`appendDecision` não checado, commit no develop).

**Lacunas / o que eu pediria a mais num handoff v2**

1. **Duração / custo:** quantas sessões, quantos tokens, quantas horas wall-clock da F0? Sem isso é difícil calibrar se 4 overrides são “caro demais”.
2. **Patches mínimos propostos:** o §3 descreve bem, mas não traz diffs esqueleto (1–5 linhas) — atrasa a priorização.
3. **Escopo de callers de `appendDecision`:** quantos call sites quebrariam com throw? Sem isso a decisão 3 fica teórica.
4. **Estado do curta:** o handoff é para atomic-skills, mas a F0 vive no curta — um link/path do `plan.md` / decision log do curta fecharia o ciclo de prova.

Nada disso invalida o documento; são upgrades se virar input de plano.

---

## 7. Resumo executivo para o Henry

1. **Incidente contido** — zero residue no `develop`; apague a backup branch (ou extraia `lessonsVerifiedAt` só se quiser o campo *sem* gate obrigatório).
2. **O bug de schema já morreu no PR #38** — não reabrir.
3. **O achado que importa é §4:** teto de re-dispatch não mede thrash; mede rounds de código em uma pipeline multi-gate. Preferência: overrides de primeira classe no cursor.
4. **Único atrito P1 “de mentira de estado”:** `appendDecision` silencioso — fail-loud.
5. **Docs baratas com alto ROI:** sucessor automate, dual-leg paths, key `tasks`, hard rule cross-repo, validate-state paths.
6. **A cadeia de gates pagou a conta:** 4/5 defaults silenciosos só saíram em layers posteriores — argumenta *a favor* de manter evaluation + phase review, e *contra* afrouxar o automate para “fechar mais rápido”.

---

## 8. Próximo passo sugerido

Se quiser ação imediata neste repo (atomic-skills):

1. Decidir as 5 questões do §6 do handoff (esta análise recomenda: apagar branch / sim hard rule / throw ou hard-stop / alinhar docs / opção 2 no teto).
2. Abrir um plano curto de polish (`automate-dogfood-followups`) com itens 1–5 do backlog §5, ou enfileirar no próximo plano de discipline do automate.
3. Não misturar isso com trabalho do curta: se o curta ainda está em `awaiting-operator-advance` pós-F0, o advance é decisão de operador no *outro* repo.
