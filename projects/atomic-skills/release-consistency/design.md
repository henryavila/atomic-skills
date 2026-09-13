# Design: release-consistency

## Context

Agentes de coding empurram para a default branch, inventam bump semver (feature como patch) e, em pacotes npm, ainda tendem a `npm publish` direto. O Titan (`titan-chordpro-ui`) já tem um padrão que funciona: chooser determinístico + skill que se recusa a adivinhar + GitHub Release + Action em **stage** com approve 2FA humano. O Atomic Skills tem peça parcial — `save-and-push` pergunta antes de push em `main`/`master`, conventional commits no fluxo de commit, e um `publish.yml` próprio que ainda faz **publish direto** — mas não tem skill de release, não detecta default branch via `origin/HEAD`, e o installer não scaffolda o repo consumidor.

Este design fecha o **WHAT/WHY** e a abordagem escolhida para integrar higiene de release/PR **dentro** do Atomic Skills (caminho ratificado), sem virar um produto separado e sem fingir que o installer é gerador de repositório.

## Interview

**Ratificado** na sessão brainstorm `release-consistency` (2026-09-13). Spine HALT + restrições 1–4 + caminho “integrar no Atomic Skills”.

| Campo | Conteúdo |
|-------|----------|
| **Problema** | Agentes falham em (a) histórico limpo na default branch e (b) semver/GitHub Release; quando há npm, o padrão novo exige stage+2FA, não publish direto. |
| **In-scope** | Integrar no AS; default branch (`main`\|`master`, detectar com cuidado) **só via PR**; conventional commits unificados com `save-and-push`; skill/fluxo de GH Release + chooser determinístico; npm opcional via Action stage-only; dogfood do próprio AS após fixture verde; motor (scripts/templates) **dentro** do pacote AS. |
| **Out-of-scope** | Produto/repo separado de release; publish npm direto como path feliz; skill fundida save+release; installer mutando `.github/` do consumer sem opt-in; multi-registry / canary / “AI release notes” como produto. |
| **Done-when (design)** | Este `design.md` lint-clean, critic Approved, operador aprova; handoff para `project new plan release-consistency`. Não é o produto implementado. |
| **Stakes** | Endurecer PR-only muda o comportamento diário de `save-and-push` (breaking de hábito). Migrar `publish.yml` do AS para stage muda o rito de publicação do próprio pacote (approve 2FA vira obrigatório). Templates mal entregues criam drift e residue fora do journal de install. |
| **Fontes** | `skills/core/save-and-push.md`; `meta/catalog.yaml` (`product.what_is` / `what_is_not`); `.github/workflows/publish.yml`; `CHANGELOG.md`; `skills/shared/local-review-assets/diff-capture.md` (default branch); installer/`reconcileFileSet`; research-digest deste plano; referência Titan `scripts/semver-bump.ts`, `scripts/release.ts`, `.grok/skills/release/SKILL.md`, `.github/workflows/publish.yml`. |

Restrições ratificadas após open questions: (1) PR-only na default; (2) stage para todo path npm; (3) sem pacote → só GH; (4) unificar commits com `save-and-push`. Caminho: integrar no AS. Debate: duas skills + templates opt-in + chooser determinístico + reframe `what_is_not`. Dogfood AS: mesmo plano, após fixture. Motor: assets/scripts no AS.

## Decisions

### D1 — Duas skills, um contrato compartilhado

- **`save-and-push`:** endurecer o HARD-GATE. Em default branch → **recusar** push direto (não perguntar “push directly to main?”). Fluxo canônico: criar/usar branch de trabalho → commit → push da branch → **abrir PR** com `gh pr create` quando `gh` estiver autenticado; se `gh` indisponível, parar com instrução explícita (branch já pushed + comando/URL para abrir o PR) — não fazer merge local na default. Auto-merge / merge da PR **fora** desta skill (non-goal). verified_by: hoje pergunta — `skills/core/save-and-push.md` L8–12; research-digest (sem skill canônica de PR hoje).
- **`release` (nova skill core):** cortar versão / notes / tag / GitHub Release; se o repo for pacote npm com Action adotada, o Release dispara stage; humano aprova 2FA. Nunca inventar bump.
- **Unificação:** conventional commits + detecção de default branch vivem em **assets/libs compartilhados** (mesmo espírito de `local-review-assets`), não numa skill fundida. verified_by: debate Priya+Aria; `diff-capture.md` já usa `git symbolic-ref refs/remotes/origin/HEAD`.

### D2 — Default branch = `origin/HEAD`, com fallback `main`\|`master`

A branch protegida não é um nome fixo. Resolver: `git symbolic-ref refs/remotes/origin/HEAD` → basename; se falhar, aceitar `main` ou `master` se existirem (dedupe). Push/PR gates usam esse resultado. verified_by: padrão em `skills/shared/local-review-assets/diff-capture.md`.

### D3 — Chooser determinístico; skill recusa adivinhar

A versão seguinte sai de script (padrão Titan: commits conventional + seções Keep a Changelog `[Unreleased]`; baseline preferencialmente registry quando npm existir, senão última release/tag GH). Feature / Added / Changed → MINOR; só Fixed → PATCH; breaking em 0.x → MINOR (nunca auto-`1.0.0`). A skill **recusa** `--apply`/`ship` se o kind for `none` ou se o humano/IA tentar override sem evidência. verified_by: Interview “IA falha ao definir versão”; Titan `classifyBump`.

### D4 — Dual-mode de distribuição

**Critério “npm no escopo” (mínimo):** existe `package.json` na raiz do repo **e** `private` não é `true` **e** o operador não passou opt-out explícito (flag/config da skill, ex. `--no-npm`). Ausência de `package.json`, ou `private: true`, ou opt-out → trata como **sem npm** (só GH).

| Situação | Path feliz / gate |
|----------|-------------------|
| Sem npm no escopo | GitHub Release (+ tag + notes do CHANGELOG) **somente** |
| npm no escopo **e** Action stage adotada (template pin-check OK) | GH Release → Action **`npm stage publish`** → humano `stage approve` (2FA) |
| npm no escopo **e** Action ausente ou não-stage | **Recusar** `ship` que implicaria publish npm; oferecer materialização `adopt`/`init` do template stage; **não** inventar `npm publish` local. GH Release sem canal npm **só** se o operador confirmar explicitamente “GH-only apesar de pacote público” (opt-out npm para aquele ship) |

Publish direto (`npm publish` no path feliz da Action ou da skill) é **proibido**. verified_by: restrição Interview #2–#3; contraste AS atual `.github/workflows/publish.yml` L28 vs Titan stage; critic F-001.

### D5 — Templates = assets no pacote AS; materialização opt-in

O installer **não** escreve no working tree do consumer (`reconcileFileSet` = skills/host). Templates (`publish.yml` stage, workflow GH-only se necessário, scripts do chooser) vivem versionados sob o pacote AS (ex. `skills/shared/release-assets/`). A skill `release` (ou subcomando explícito tipo `init`/`adopt`) **oferece** materializar no repo com consentimento. O apply **MUST**: (1) dry-run/`--check` com pin/versão do template, (2) mostrar diff, (3) só escrever após consentimento. Uninstall do AS **não** remove arquivos que o operador adotou no repo. verified_by: research-digest seam installer; debate Aria+Flynn; critic F-003.

### D6 — Enforcement executável, não só prosa

Iron Laws / HARD-GATEs na skill **e** scripts/CI com exit non-zero (chooser, checks de “não está na default”, template `--check`). Prompt sem dente = confiança falsa. verified_by: dissent Flynn; skill-authoring pressure-test method.

### D7 — Reframe cirúrgico de `product.what_is_not`

Manter: AS **não** é substituto do git workflow / release platform do time. Acrescentar clareza: skills de persistência e release **impõem gates de agente** (PR-only na default, stage+2FA, chooser) quando o usuário invoca essas skills — disciplina, não ownership do branching model do repo. verified_by: `meta/catalog.yaml` L16–19; debate Priya+Aria.

### D8 — Dogfood do próprio AS: mesmo plano, após fixture

1. Fixture de consumer (repo temporário/fixture de teste) prova: PR-only gate, chooser, template stage, path GH-only.  
2. **Depois** disso, no mesmo plano, migrar `.github/workflows/publish.yml` do Atomic Skills de `npm publish` → `npm stage publish` (+ runbook de approve).  
Não no commit zero; não adiado para “outro produto”. verified_by: ratify B2 (meio-termo Aria; não Priya-slice1-cego; não Flynn-adiar).

### D9 — Motor dentro do Atomic Skills

Scripts do chooser + templates moram no monorepo/pacote `@henryavila/atomic-skills` (port do padrão Titan), não num pacote npm fino separado. O dissent “motor externo” fica em Rejected alternatives. verified_by: ratify B2.

## Chosen approach

**Integrar no Atomic Skills** com fatia estrutural:

1. Shared release/git contract assets (default branch detect, conventional commit helpers).  
2. Harden `save-and-push` → PR-only na default.  
3. Nova skill `release` + scripts chooser (plan / apply / ship) + templates stage e GH-only.  
4. Fixture verde.  
5. Migrar publish do próprio AS para stage.  
6. Catalog + docs (`what_is_not` reframe, skill docs).

Abordagens pesadas no debate e **não** escolhidas: ver Rejected alternatives.

## Rejected alternatives

| Alternativa | Por que caiu |
|-------------|--------------|
| Projeto/produto próprio de release | Usuário escolheu integrar no AS; unificar com `save-and-push` tornaria cross-produto taxação. |
| Skill fundida save+release | Priya/Aria: jobs e momentos de invocação diferentes; monolito de modos. |
| Materializar templates via installer/`reconcileFileSet` | Quebra contrato install (host skills ≠ consumer repo); residue sem parity. |
| Publish npm direto na Action | Restrição Interview #2; padrão 2026 = stage+2FA. |
| Motor em pacote npm fino separado (dissent Flynn) | Ratificado: motor dentro do AS para uma distribuição. |
| Migrar `publish.yml` do AS no commit zero / como aceite cego da fatia 1 | Blast no maintainer antes do contrato fixture. |
| Adiar migração AS para outro plano (Flynn) | Ratificado: mesmo plano, após fixture. |
| Continuar ask-before-push em `save-and-push` | Restrição #1 = só PR; ask deixa o atalho vivo. |

## Non-goals

- Substituir GitHub Flow / branch protection do remoto (a skill disciplina o **agente**; branch protection do GitHub continua recomendada mas fora do escopo de implementação AS).  
- Auto-merge / merge da PR na default (D1 só abre ou instrui a PR).  
- Multi-package monorepo versioning avançado (workspaces) na v1 — se aparecer, estende depois.  
- Geração “criativa” de release notes por LLM como fonte de verdade (notes vêm do CHANGELOG aplicado).  
- Tokens npm de longa duração / Bypass 2FA.  
- Reverter arquivos adotados no consumer no `atomic-skills uninstall`.

## Blast radius

| Porta | Risco | Contenção |
|-------|--------|-----------|
| HARD-GATE PR-only em `save-and-push` | Quebra hábito de quem confirmava “push to main” | Mensagem clara + caminho branch+PR; documentar breaking na CHANGELOG do AS |
| Migração AS → `npm stage publish` | Release do próprio `@henryavila/atomic-skills` exige approve 2FA; regressão = pacote não sobe | Fixture primeiro; runbook; Trusted Publisher “stage only”; rollback do workflow é revert de um YAML |
| Templates no consumer | Drift / YAML antigo com publish direto | Pin/versão no apply; `--check`; skill recusa ship se Action não for stage-only quando npm |
| Falsa confiança prompt-only | Agente ignora Iron Law | Scripts exit non-zero + testes de skill/fixture (D6) |

## Open questions

- Formato exato do subcomando de materialização (`release init` vs offer inline na primeira invocação) — decidir na decomposição do plano; ambos respeitam D5.  
- Escopo monorepo/workspaces na v1: **fora** (Non-goals); reabrir só com consumer real.  
- Se `origin/HEAD` apontar para branch que não é `main`/`master` (ex. `develop` como default): a política PR-only aplica a **essa** default — confirmado por D2; documentar no skill body.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims sobre `save-and-push` L8–12, `catalog.yaml` what_is_not, `publish.yml` L28, `diff-capture.md` origin/HEAD, seam installer no research-digest.  
- G2 soft-language: applied — evitado should/probably/may no corpo de Decisions.  
- G6 reference-or-strike: applied — decisões com verified_by ou restrição Interview/ratify; Titan citado como fonte Interview/referência, não como path versionado neste monorepo.
