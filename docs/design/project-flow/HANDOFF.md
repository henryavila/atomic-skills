# HANDOFF — Project Flow

**Ler este arquivo primeiro.** É o cold-start da próxima sessão. Não use o prompt de 17 arquivos.

| Campo | Valor |
|-------|--------|
| **Status** | Design **ratificado** (2026-08-12, duas sessões Grok). Código **ainda não existe**. Próxima sessão = **PR1**. |
| **Modo** | Cascata PR1 → PR5. Começar na **PR1**. Não implementar outras PRs na mesma sessão a menos que o operador peça. |
| **Repo** | `/home/henry/atomic-skills` only. Não editar arch-legacy / worktrees de feature. |
| **Não fazer** | git commit / push / PR no GitHub a menos que o operador peça. |

---

## Decisões do operador (travadas — não reabrir)

1. **Process-map é lixo. Descarte completo.** Não dual-read de produto. Não “melhorar cards”. Não journey-as-cards. O modelo que substitui é o grafo do protótipo (sequence / decision xor / end + projeções Sequência + Fluxo + Estados).
2. **Obrigação = hard-gate inicial do `implement`, não stage de criação.** Sem o artefato é **impossível** implementar **qualquer plano** (AS multi-phase, AS 1-phase, foreign). Ad-hoc sem plan file = N/A. `reviews` / `ready` **não** bloqueiam sem flow. Stage `process-map` morre; **não** nasce um stage `flow` inescapável no `new plan`.
3. **Validação é o comando `project flow` (manual, a qualquer momento).** Show + AskUserQuestion + `buildFlowRatification` (`ratifiedAt` + `ratifiedGraphSha`). Chat “ok” não conta. O `implement` **não** roda a cerimônia — só checa o detector. Classe ground-truth (Q8-A): sem receipt extra, sem re-Ask no implement.
4. **Day-2 em qualquer momento da vida do plano:** gerar / atualizar / exibir / ratify / `--check`. HTML nunca é SoT. Mudou o grafo → re-render; se já havia `ratifiedAt`, re-ratify.
5. **Editável** = agente reescreve `flow.json` no loop “Ajustar” + re-render. **Não** editor visual no browser (non-goal).
6. **Cascata = PR1 na próxima sessão.** Design + overrides desta sessão já estão no disco.
7. Protótipo já **provou** plan → grafo + visual (sessão que gerou a tela). Aqui productizamos no monorepo, genérico, sem domínio PDTI no core.

Glossário: o design chama os recortes de **PR1–PR5**. Não inventar “FATIA”.

---

## O que a próxima sessão implementa (só PR1)

**Title:** `feat(flow): schema 1.0 + core validator + dogfood fixture`

Criar:

- `meta/schemas/flow.schema.json`
- `scripts/lib/validate-flow.js` — AJV + regras de grafo (padrão `src/app-map/validate.js`, **não** o hand-roll de `validateProcessMap`)
- `tests/validate-flow.test.js`
- Dogfood envelopado: `docs/design/project-flow/dogfood/fluxo-sugestao.json` hoje é `version: 2` com `entry`/`nodes` no topo — precisa `schemaVersion: "1.0"` + lifecycle + aninhar grafo em `graph`
- Segunda fixture mínima (2 actors, 1 xor, **sem** status 10/1/11)

Done-when PR1:

- AJV + regras core passam no dogfood envelopado
- Fixture mínima passa
- Casos de erro: next quebrado, xor 1 branch, actor inválido
- Domínio PDTI **não** aparece no validator
- Sem skill, sem stage, sem HTML, sem Iron Law, sem detector

**Padrão AJV do repo:** `src/app-map/validate.js` (`ajv/dist/2020.js`).  
`process-map.schema.json` **nunca é compilado**; `validateProcessMap` reimplementa o schema na mão — **não copiar**.

---

## Cold-start PR1 (só estes arquivos)

Ler nesta ordem. Não abrir o HTML de 1139 linhas. Não abrir `pdti-feature-design.md` como spec.

1. Este `HANDOFF.md`
2. `design.md` — D1, D2, schema mínimo, PR1 (não precisa reler PR2–PR5 para implementar PR1)
3. `analysis/01-impl-audit.md` — o que é genérico vs o que é domínio (proibido no core)
4. `dogfood/fluxo-sugestao.json` — fixture a envelopar (não é schema 1.0 ainda)
5. `src/app-map/validate.js` — padrão a copiar
6. `test/app-map/schema.test.js` **ou** `tests/routing-schema.test.js` — estilo de teste AJV
7. `meta/schemas/process-map.schema.json` — só convenção `$id` / draft 2020-12 / `additionalProperties` (não o modelo de cards)
8. `references/README.md` — PDTI é instância, não regra

Opcional se `journey` entrar no schema como objeto **opcional não usado**: `scripts/lib/render-process-map.js` linhas 12–18 e 68–169 (lint dual-copy). **Não** é superfície de produto.

**Não ler para PR1:** `fluxo-completo.html`, `fluxos-*.html`, `project.md` inteiro, `stage-process-map.md`, `render-process-map.js` CLI, `find-missing-process-map.js`, `pdti-feature-*.md` completo, KB `process-map.md`.

---

## Cascata (depois da PR1 — outras sessões)

| PR | Entrega | Não é |
|----|---------|--------|
| **PR1** | schema + validate + 2 fixtures | UI / skill / gates |
| **PR2** | `render-flow.js` extraído do dogfood HTML (builders + Mermaid pin + content-sha) | skill |
| **PR3** | `project flow` day-2 + detector. Alias `process` **só** chama flow. **Tira** `process-map` de `CREATION_STAGES` (`summaries` → `reviews`). Remap mid-creation `process-map` → `reviews`. Sem stage `flow` inescapável. | manter process-map vivo; bloquear ready |
| **PR4** | **implement HARD no entry** (Step 1, junto do ground-truth) + verify backstop; KB `flow.md`; **apagar** write path process-map. Iron Law: **NO IMPLEMENT WITHOUT VALIDATED FLOW**. Planos velhos: primeiro `project flow` (comando) drafta + ratifica. | dual-read; gate em ready |
| **PR5** | limpeza `docs/fluxo-*` no arch-legacy | não nesta sessão sem pedido |

Iron Law **texto** (`CLAUDE.md`, `project.md`) **só muda na PR4**. PR3 já tira o stage (comportamento de criação). Até a PR3 o repo ainda exige process-map de fato.

---

## Contrato de produto (fim de linha)

Paths:

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.json   # L1 SoT
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.html   # HTML gerado (nunca map.html)
```

Loop:

1. Agente drafta grafo a partir de design/source/`businessIntent` — **nunca** `phases[]` → nós (P2). Pode ser no `new plan` (opcional) ou no primeiro `project flow`.
2. Script + schema validam (core genérico).
3. Humano corre **`project flow`**: vê Sequência + Fluxo (+ Estados se houver) e ratifica → artefato (`ratifiedAt` + `ratifiedGraphSha` + graph válido + `flow.html` sha).
4. `implement` no entry corre o detector **em qualquer plano** (AS ou foreign). Sem artefato → **REFUSE**. Com artefato → pode codar/spawn.
5. Day-2: gerar / atualizar / exibir / re-ratify a qualquer momento.

`journey` (cards / dual-copy do process-map) **não é produto**. Schema 1.0 pode omitir ou deixar opcional sem UI. Não reimplementar HTML de cards. O viewer gerado é `flow.html`, nunca `map.html`.

---

## Mapa desta pasta

```
docs/design/project-flow/
  HANDOFF.md                 ← você está aqui
  design.md                  ← decisões + PR plan
  research-digest.md         ← evidência + achados da crítica de prompt
  migration.md               ← descarte process-map + limpeza arch-legacy
  analysis/                  ← notas de sessão (não spec; 02 dual-read está SUPERSEDED)
  dogfood/                   ← fixture + HTML a extrair na PR2
  references/                ← paths AS + PDTI só para decodificar a fixture
```

---

## Anti-padrões

- Prompt “leia 17 arquivos e implemente o produto”.
- Copiar `validateProcessMap` ou `validateModel` do HTML (3 decisões / D1 / status 10).
- Marcar `journey`/`graph`/`states` todos `required` (mata grafo-only e states-opcional). **Graph ratificado é a obrigação de implement** (PR4); no schema, `graph` é a camada de produto. Na PR1 o schema expressa as camadas; o gate de **implement** é PR4. `ready` sem flow é legal.
- Chamar o HTML de `map.html` / “process map”. Viewer gerado = `flow/flow.html`.
- Dual-read `process.yaml` **ou** `flow.json` como estado permanente.
- Inventar grafo a partir de `phases[]`.
- Editor visual no browser.
- Fills/níveis de `alt`, AND-gateway, BPMN export.
- Continuar o viewer no arch-legacy.
- Editar só `~/.grok/plugins/atomic-skills` — runtime é o monorepo.

---

## Verificação PR1 (antes de declarar done)

```bash
node --test tests/validate-flow.test.js
# ou o comando equivalente do package.json se registrar
```

Mostrar: paths criados, 1 caso ok, 1 caso fail. Não claim done sem rodar o teste.

---

## Origem

- Protótipo: worktree arch-legacy `sugestao-necessidade-pdti` (copiado em `dogfood/`).
- Sessão 2026-08-12 manhã: handoff + design draft + analyses.
- Sessão 2026-08-12 noite (esta): crítica do prompt abusivo; operador descartou process-map; cascata adiada para depois do reboot.
