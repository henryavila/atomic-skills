# Session handoff — `automate-default-and-operator-gates`

> **Continue from here.** Documento de retomada (não é design de produto).  
> Atualizado: 2026-07-25 · sessão bootstrap + F4 ratificada · **zero código de F0 ainda**.

---

## 0. Cold start (copiar)

```bash
cd /Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates
git status -sb
git rev-parse --short HEAD   # esperado: 18a3d403 (ou mais recente se pushou)
git branch --show-current    # plan/automate-default-and-operator-gates

# sanity do plano
node scripts/validate-state.js \
  .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/plan.md \
  .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/phases/f0-automate-as-default-mode.md
```

**Single nextAction (produto skill):**

```text
Implement F0 T-001: flip isAutomateActive default true + tests
```

Comando típico de execução:

```bash
# Na worktree acima
# Mode 1 (host codes) se estiver construindo a skill em si:
implement automate-default-and-operator-gates --mode=1
# ou pure-maestro (dogfood do próprio default — circular até F0 landar):
# implement automate-default-and-operator-gates
```

**Recomendação:** F0 do plano *é* “automate default” — implementar em **Mode 1** (`--mode=1`) evita dependência circular (default ainda é Mode 1 no código atual).

---

## 1. Onde você está

| Campo | Valor |
|-------|--------|
| Worktree | `/Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates` |
| Branch | `plan/automate-default-and-operator-gates` |
| HEAD (handoff) | `18a3d403` — `feat(project): add F4 receipt authenticity and close-path integrity` |
| Main tree | `/Volumes/External/code/atomic-skills` (branch `develop` — **não** tem o plano commitado; trabalhe na worktree) |
| Plan | `.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/plan.md` |
| Design | `…/design.md` (critic approve_with_nits + F4 amendment) |
| Source | `…/source.md` + `docs/plans/automate-default-and-operator-gates.md` |
| `currentPhase` | **F0** (`active`) |
| Initiative F0 | `phases/f0-automate-as-default-mode.md` (materializada) |
| F1–F4 | **descriptor-only** (`.source.json`); materialize quando for a fase |
| PR / remote | **não** pushado neste handoff — `git push -u origin plan/automate-default-and-operator-gates` se quiser backup remoto |
| Lease writer | não aplicável (ainda sem implement automate neste plano) |

---

## 2. O que já foi feito (esta trilha)

1. Dump dogfood Lekto analisado (nota C) — falhas skill, não produto.
2. Plano bootstrapado: F0–F3 (default / decision package / intent-vs-delivered / dogfood).
3. §1b **Contraste intenção × previsão × pressupostos** no plan body.
4. Pesquisa dual-agent (implement gaps + project integrity).
5. Operador validou escopo F4 → **ratify** new-phase.
6. **F4** inserida: authenticity dual-leg + disposition + statusRoot + phase-done mirror.

### Commits na branch (ordem)

```
18a3d403 feat(project): add F4 receipt authenticity and close-path integrity
4079e55e docs(plan): espelhar contraste no source e docs/plans
c09b572e docs(plan): contraste intenção × previsão × pressupostos
62cfef4b chore(project): bootstrap plan automate-default-and-operator-gates
```

---

## 3. Fase tree e status

| Fase | Status | Materialização | Conteúdo |
|------|--------|----------------|----------|
| **F0** | **active** | initiative `.md` | Automate default (`isAutomateActive`) + prosa |
| F1 | pending | `.source.json` | Decision package + read-before-PASS |
| F2 | pending | `.source.json` | Plan-end `intentVsDelivered` |
| F3 | pending | `.source.json` | Dogfood checklist F0–F2 |
| F4 | pending | `.source.json` | Receipt authenticity + close-path integrity |

### F0 tasks (fazer agora)

| Task | Título | Outputs | Verifier |
|------|--------|---------|----------|
| **T-001** | Flip isAutomateActive and parse default | `src/implement-mode.js`, `tests/implement-mode.test.js` | `node --test tests/implement-mode.test.js` |
| **T-002** | Skill prose and antipatterns for automate default | implement.md, maestro, antipatterns, kb | `rg` default / Mode 1 / --mode=1 |

**Gates F0:** F0-G1 testes; F0-G2 prosa.

**BI F0 (spine):** value = automate default + Mode 1 escape; rules = host-thin, no auto-merge, session default alimenta gates; outOfScope = F1–F4.

---

## 4. F4 (para não re-discutir)

Ratificado 2026-07-25. Sidecar: `phases/f4-receipt-auth.source.json`.

| Task | Resumo |
|------|--------|
| T-001 | Dual-leg review authenticity (floor médio: dual path, min size, non-binary) |
| T-002 | Evaluation content floor |
| T-003 | Major disposition → token operator (decline ≠ accept) |
| T-004 | decisionLog statusRoot normalize |
| T-005 | Phase-done mirror exitGates + ban hand-edit |

**Fora de F4:** Playwright pós-merge, claims durable, session-break, phase-done-apply completo, auto-merge.

---

## 5. Decisões de design load-bearing (não reabrir sem re-ratify)

1. **Automate default** reverte P1 antigo “opt-in only”.
2. **Session default = gates durable** (critic F-001): `{no CLI, no stamp}` deve fail-closed nos gates.
3. **read-before-PASS** (F1): package apresentado antes do token PASS.
4. **intentVsDelivered** (F2): plan-end não é só “diff clean”.
5. **F4 floor médio** authenticity (não parser full codex).
6. Implementar F0 preferencialmente com **`--mode=1`** até o default landar.

Ler: `design.md` + `plan.md` §1b.

---

## 6. O que NÃO fazer no cold start

1. Não reabrir F0–F4 como “novo plano” — já materializado.
2. Não implementar F1–F4 antes de F0 (ordem serial dependsOn).
3. Não `materialize F1` sem F0 done (a menos que operador mude ordem).
4. Não merge/archive do plano sem implement completo.
5. Não editar product apps (Lekto) — este plano é **atomic-skills** only.
6. Não assumir que `develop` tem estes commits — só a worktree/branch do plano.

---

## 7. Checklist de retomada

```
[ ] cd worktree; git status clean; HEAD ok
[ ] Ler plan.md §1b + F0 BI + T-001/T-002
[ ] Ler design.md Decisions 1–9 + F4 amendment
[ ] implement F0 (recomendado --mode=1) ou TDD manual T-001
[ ] node --test tests/implement-mode.test.js  → green
[ ] prosa T-002 + F0-G2 rg
[ ] phase-done F0 só após gates + review policy do plano
[ ] depois: materialize F1 → … → F4
[ ] opcional: git push -u origin plan/automate-default-and-operator-gates
```

---

## 8. Artefatos úteis

| Path | Uso |
|------|-----|
| `plan.md` | Estado canônico + §1b contraste |
| `design.md` | Decisions + blast radius |
| `phases/f0-automate-as-default-mode.md` | Tasks F0 |
| `phases/f4-receipt-auth.source.json` | Tasks F4 (lazy) |
| `docs/plans/automate-default-and-operator-gates.md` | Source SPEC |
| Dump dogfood (contexto) | `lekto/.../execution-dumps/2026-07-24-implement-automate-session.md` |

---

## 9. Prompt de cold-start (colar na próxima sessão)

```text
Continuar plan automate-default-and-operator-gates na worktree
/Volumes/External/code/atomic-skills/.worktrees/automate-default-and-operator-gates

Ler SESSION-HANDOFF.md e plan.md. currentPhase=F0.
Implementar T-001/T-002 (automate default) com --mode=1 se pure-maestro circular.
Não reabrir F4 escopo. Não misturar com Lekto product.
```

---

*Handoff sem código de implementação. Próxima sessão: F0 T-001.*
