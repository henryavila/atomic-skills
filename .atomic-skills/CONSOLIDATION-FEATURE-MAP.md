# Mapa de Consolidação — base para análise por feature

> **Snapshot:** 2026-06-22. Sete planos foram consolidados em `main` (`ef74259`, via **PR #25**); `develop` foi forkada de `main` (idêntica) e é o ref de integração (`integrationRef: develop` em `.atomic-skills/status/routing.json`).
>
> **As tasks/fases de cada plano foram preservadas (consolidadas)** em `.atomic-skills/projects/atomic-skills/<slug>/` na `main`/`develop` — elas são a **BASE** para a análise por feature (a rodar em sessões frescas, uma por feature, fora desta sessão).

## Como usar este mapa

Para cada feature, a linha **Base (tasks/docs)** aponta o `plan.md` (frontmatter com fases + tasks + exit-gates + evidências de verificação), o `design.md` (quando existe), e os arquivos de review em `.atomic-skills/reviews/`. A análise de cada feature deve **ler essa base** — ela é o registro canônico do propósito, do que foi feito, e da validação. Apagar o ponteiro da branch **não** afeta nada disso (o trabalho está na história da `main`, não no rótulo da branch).

---

## Features consolidadas (todas na `main` via #25)

### 1. worktree-lifecycle-finalization
- **Branch:** `plan/worktree-lifecycle-finalization` (tip `f25060d`)
- **Propósito:** fechar o ciclo de vida da worktree-do-plano sob o pivô Git Flow do operador — cada plano forka `plan/<slug>`+worktree na criação (= feature), vai PR→`develop` via `project finalize` dedicado, com teardown squash-safe, detecção de colisão cross-WT, backstop read-only no `project verify`, e dedup de review em duas camadas.
- **Entregou (F0–F8, todas done, reviewGate passed — maioria mode=both):** F0 always-fork na criação; F1 `integrationRef` configurável; F2 teardown squash-safe (liveness `gh` + veto `headRefOid`); F3 `project finalize` (push + PR→develop); F4 colisão cross-WT (gate determinístico + agentes advisory read-only); F5 coupling de `.atomic-skills/` (focus.json git-ignore + merge=union); F6 backstop 9º check no `verify`; F7 dedup de review (ledger append-only); F8 finalize plan-aware (branch ≠ plano).
- **Status:** merged via #25. ⚠️ `plan.md` ainda `status: active / currentPhase: F8` apesar de tudo done — **lag de state-file**, candidato a flip `archived`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/` + reviews `.atomic-skills/reviews/2026-06-1*-wlf-*.md`
- **Análise:** _pendente_

### 2. plan-fork
- **Branch:** `plan/plan-fork` (tip `c87b82d`)
- **Propósito:** degrau 7.5 de emergência — forkar uma fase grande de um plano em rodada num plano-filho, com link pai/filho bidirecional; pai pausa (pause) ou roda em paralelo (parallel) e retoma na fase-âncora. Aditivo e reversível (distinto de `supersedes`).
- **Entregou (F0–F5, done):** F0 link sidecar + cycle detection; F1 verbo `fork-plan` + degrau 7.5 residente; F2 protocolo de state cross-worktree paralelo; F3 loop de resume determinístico (pause/parallel); F4 hierarquia pai/filho no focus-resolver; F5 doc KB + migração do link sidecar→INLINE no plan.md. F2–F5 review mode=both.
- **Status:** merged via #25. Plano `status: done`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/plan-fork/`
- **Análise:** _pendente_

### 3. design-brief (2 planos)
- **Branch:** `plan/design-brief` (tip `5492724`)
- **Propósito:** skill `design-brief` — (a) catálogo app-map "source-of-truth" (eixo AI: audience/access/purpose/status/provenance, divergência arbitrada pelo operador, nunca reconciliação silenciosa); (b) rework do modelo de autoridade do briefing (layer-is-authority, code-não-vincula, evidence-tagged, validado por regen cego do briefing Lekto).
- **Entregou:** `design-brief-source-of-truth` (archived, F0/F1/F2 done) + `design-brief-briefing-rework` (archived, F0/F1 done).
- **Status:** merged via **PR #23** (mergedAt 2026-06-20). Ambos planos `archived`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/design-brief-source-of-truth/` e `.../design-brief-briefing-rework/`
- **Análise:** _pendente_

### 4. fix-aideck-dashboard
- **Branch:** `plan/fix-aideck-dashboard` (tip `011012e`)
- **Propósito:** consertar o dashboard aiDeck "errado/misturado". Causa-raiz (verificada contra o source do aiDeck, não o manifest): mismatch de **topologia de navegação** — o design quer nav project-centric (Panorama + PROJETOS), o cliente Vue do aiDeck só tinha consumer-centric.
- **Entregou (F0–F3, done):** F0 auditoria 3D (widgets/grammar/shell); F1 modo de shell project-centric nomeado (`nav.style:'projects'`) — **código vive em `../aideck` @ `2b54987`**; F2 manifest realinhado ao design; F3 guardrail de CI (widget-registry vendorizado, RED-fail em widget desconhecido). Gates visuais **deferred** (owner valida pós-merge).
- **Status:** merged via #25. Plano `status: done`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/fix-aideck-dashboard/`. ⚠️ shell em repo separado `../aideck` (não afetado por apagar esta branch).
- **Análise:** _pendente_

### 5. reversible-installer
- **Branch:** `plan/reversible-installer` (tip `31f9e9f`)
- **Propósito:** extrair o installer do atomic-skills num engine genérico reversível (uninstall = replay reverso de journal de efeitos tipados + reconcile-to-empty); paridade install/uninstall por construção.
- **Entregou (F0–F3, done):** F0 kernel de efeitos + journal + reconciler 3-hash; F1 efeitos json-merge/refcount/legacy-prune + matriz adversarial. **PIVÔ package-first:** engine extraído pro pacote npm separado (hoje **`@henryavila/minimalist-installer`**, repo próprio); F2 virou pointer; F3 atomic-skills consome via dependência + remove a cópia in-repo + prova paridade (round-trip 9/9). G-2 deferred (2 falhas pré-existentes de dashboard-bundle).
- **Status:** merged via #25. Plano `status: done`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/reversible-installer/` (inclui `PROPOSAL-f2-f3-package-first.md`). ⚠️ engine no pacote npm separado.
- **Análise:** _pendente_

### 6. deadline-burnup-forecast
- **Branch:** `plan/deadline-burnup-forecast` (tip `04dd96f`)
- **Propósito:** burn-up ponderado deadline-aware (Earned Value / SPI): evento imutável de conclusão a cada done/phase-done/reconcile, peso por task, série earned-vs-planned contra deadline, render no aiDeck.
- **Entregou (F0–F5, done):** F0 `completions.jsonl` append-only + evento validado; F1 auditor forward-only de `closedAt`; F2 peso por task; F3 série earned-vs-planned + deadline + recompute; F4 calibração + hardening; F5 render no aiDeck.
- **Status:** merged via #25. Plano `status: done`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/` + reviews
- **Análise:** _pendente_

### 7. skills-restructuring
- **Branch:** `plan/skills-restructuring` (tip `5e54974`)
- **Propósito:** sweep de consistência + reestruturação token-economy da arquitetura de skills (single-source-of-truth, lazy-load), + feature `project review`, + skill `design-brief`.
- **Entregou (F0–F6, archived):** F0 pente-fino de consistência; F1–F3 token economy (router+driver slim, conteúdo→lazy assets; project.md/implement.md <22KB); F4 `project review` + cross-ref; F5 skill `design-brief`; F6 focus.json no-silent-drift.
- **Status:** merged via #25. Plano `status: archived`.
- **Base (tasks/docs):** `.atomic-skills/projects/atomic-skills/skills-restructuring/`
- **Análise:** _pendente_

---

## Branches de montagem / não-landadas

| Branch | O que é | Status | Apagar? |
|---|---|---|---|
| `consolidate/all-plans` | merge-train dos 7 planos → main + reparo do revert #24 | **PR #25 MERGED** (`ef74259`) | ✅ seguro (label só) |
| `consolidate/v2` | 2ª tentativa (octopus dos 7 + merge=union base); duplicata do #25 | **PR #26 CLOSED** (não-mergeado); conteúdo equivalente na main | ⚠️ na prática sim — 3 SHAs únicos (`e49ad0d`,`8dcb557`,`c0f1342`), conteúdo-equivalente na main; **sua decisão** |
| `feat/consolidate-skill` | a **tool `project consolidate`** (driver merge-train ≥2 worktrees): `scripts/consolidate.mjs`, `scripts/consolidation-resolve.js` + 15 testes, `project-consolidate.md`, wiring no router | **NÃO mergeado, sem PR, ausente da main** | ❌ **NÃO apagar — única cópia da tool; landar antes** |

---

## Veredito de limpeza de branches

- **Seguro apagar** (0 commits únicos, contido na `main`; trabalho + docs + PR preservados): `plan/worktree-lifecycle-finalization`, `plan/plan-fork`, `plan/design-brief`, `plan/fix-aideck-dashboard`, `plan/reversible-installer`, `plan/deadline-burnup-forecast`, `plan/skills-restructuring`, `consolidate/all-plans`.
- **Sua decisão:** `consolidate/v2` (redundante; só perde SHAs literais).
- **NÃO apagar antes de landar:** `feat/consolidate-skill` (a tool `project consolidate` não está em lugar nenhum além da branch).

## Pendências relacionadas (não bloqueiam a análise)
1. **WLF state-lag:** `worktree-lifecycle-finalization/plan.md` está `active/F8` apesar de tudo done — candidato a flip `archived` na `main`.
2. **Landar `feat/consolidate-skill`** (PR → `develop`) para preservar a tool `project consolidate` antes de qualquer limpeza.
3. **Dependências cross-repo** (preservam-se sozinhas, não no atomic-skills): shell aiDeck em `../aideck`; pacote `@henryavila/minimalist-installer`.
