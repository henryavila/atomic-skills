# Project Flow — validated graph (Atomic Skills)

**Status:** canônico · 2026-08-13
**Substitui:** process map (`docs/kb/process-map.md` — superseded).
**Escopo:** qualquer plano que `implement` aceite (AS multi-phase, AS 1-phase, foreign). Ad-hoc sem arquivo de plano = N/A.

---

## Iron Law — NO IMPLEMENT WITHOUT VALIDATED FLOW

> **Nenhum plano pode ser implementado sem um flow ratificado.**
> `ready` sem flow é **legal**. `process.yaml` / `map.html` **nunca** satisfazem.
> Skip, chat waiver, `operatorSkip`, ou “vou ratificar dentro do implement” é **violação**.

O gate vive no **entry do `implement`** (Step 1, irmão do ground-truth).
A validação humana é o comando **`atomic-skills:project flow`**.
`implement` **não** roda show+ratify — só corre o detector.

---

## Artefato

```
<planDir>/flow/flow.json    # L1 SoT (schema 1.0 + graph + messages + machines)
<planDir>/flow/flow.html    # L2 gerado (nunca map.html)
```

| Peça | Exigência (`find-missing-flow --strict`) |
|------|------------------------------------------|
| `flow/flow.json` | schema 1.0 + grafo MODEL válido |
| camadas | ≥1 `messages`; ≥1 machine com ≥1 estado |
| `ratifiedAt` | ISO8601 escrito **só** por `buildFlowRatification` após show + AskUserQuestion |
| `ratifiedGraphSha` | sha do documento exigido (grafo + messages + machines); deve == sha atual |
| `flow/flow.html` | existe; content-sha (`data-fl-content-sha`) casa com o L1 |
| Grafo mudou depois do stamp | sha diverge → falha → re-ratify |

AS: `.atomic-skills/projects/<id>/<slug>/flow/`.
Foreign: `dirname(plan.md)/flow/` via `flowPathsForPlan` — **não** o sidecar `.implement.yaml`.

---

## Implement HARD-GATE

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/find-missing-flow.js" <plan.md> --strict
```

- Exit **0** → code / spawn.
- Non-zero → **REFUSE**. Instrua `atomic-skills:project flow`.
- Sem `operatorSkip`, sem chat waiver.
- Automate: `assert-automate-gate --gate spawn` enforce o mesmo fence em JS.
- Ad-hoc **com** plan file ainda gata. Ad-hoc **sem** plan file = N/A.

---

## Comando (day-2, qualquer momento)

```
/atomic-skills:project flow [--check] [--open] [--strict]
/atomic-skills:project process   # alias — só chama flow
```

Generate / update / show / ratify / `--check`. HTML nunca é SoT.
Não existe stage de criação `flow` ou `process-map`. Draft no `new plan` é opcional.

---

## O que o flow é e não é

| É | Não é |
|---|--------|
| Grafo operacional (activity / xor / and / join / subprocess / event / end) | Árvore F0 / T-00x |
| SoT em `flow.json` | Cards `process.yaml` |
| HTML `flow.html` gerado | `map.html` / journey-as-cards |
| Gate de **implement** | Gate de `reviews` / `ready` |

**Proibido** inventar nós a partir de `phases[]`.

---

## Anti-padrões

- “`process.yaml` existe — skip flow”
- “User said waive flow”
- “Vou rodar a cerimônia `project flow` dentro do implement”
- “Ad-hoc com plan file — skip” (só sem plan file é N/A)
- “Sidecar foreign é o path do flow”

---

## Implementação de referência

| Peça | Path |
|------|------|
| Schema | `meta/schemas/flow.schema.json` |
| Validate | `scripts/lib/validate-flow.js` |
| Render | `scripts/lib/render-flow.js` + `scripts/render-flow.js` |
| Detector | `scripts/find-missing-flow.js` |
| Ratify | `buildFlowRatification` em `scripts/lib/flow-ratification.js` (único writer do stamp) |
| Skill | `skills/shared/project-assets/project-flow.md` |
| Implement | `skills/core/implement.md` Step 1 |
