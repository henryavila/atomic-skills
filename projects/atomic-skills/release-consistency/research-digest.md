# Research digest — release-consistency

## Scope (from Interview)

- **Problema:** agentes falham em higiene de histórico (push direto na default branch) e em semver/release no GitHub; npm, quando existe, deve seguir o padrão stage+2FA.
- **In-scope:** integrar no Atomic Skills; default branch (`main`|`master`) só via PR; conventional commits unificados com `save-and-push`; path GH Release (+ chooser); npm opcional via Action em stage.
- **Out-of-scope:** publish npm direto; projeto/produto separado; inventar bump sem chooser.
- **Fontes no repo AS:** `skills/core/save-and-push.md`, `meta/catalog.yaml`, `.github/workflows/publish.yml`, `CHANGELOG.md`, installer/`reconcileFileSet`, review default-branch helpers.
- **Fonte externa (Interview, não web):** padrão Titan em `../titan-chordpro-ui` (`scripts/semver-bump.ts`, `scripts/release.ts`, `.grok/skills/release/SKILL.md`, `.github/workflows/publish.yml` com `npm stage publish`).

## Findings

- **`meta/catalog.yaml` (`product.what_is_not`):** o produto declara explicitamente que **não** é “A replacement for your IDE, model, or git workflow”. Qualquer skill de PR-only + release tensiona esse boundary; o design precisa ou (a) reescrever `what_is_not` de forma cirúrgica, ou (b) enquadrar a mudança como disciplina de agente (Iron Law) sem reivindicar ownership do git do usuário.
- **`skills/core/save-and-push.md` (HARD-GATE L8–12):** hoje, em `main`/`master`, a skill **pergunta** “push directly to main or create branch + PR?” — não recusa. Também já exige prefixes convencionais (`feat`, `fix`, `docs`, `refactor`) no passo de commit. Unificar = endurecer este HARD-GATE para **recusar push na default branch** e obrigar branch + PR; detectar default branch além de hardcode `main`/`master` (repos usam um ou outro).
- **Default branch já aparece em review assets:** `skills/shared/local-review-assets/diff-capture.md` resolve base via `git symbolic-ref refs/remotes/origin/HEAD` e cai para `main`/`master`. Padrão reutilizável para “qual é a branch protegida”, em vez de só listar dois nomes.
- **Não há skill `release` no catálogo core** (`skills/core/` lista fix, hunt, implement, project, save-and-push, review-*, etc.). Release do próprio AS é operacional: `CHANGELOG.md` Keep a Changelog + SemVer declarado; `.github/workflows/publish.yml` dispara em `release: types: [published]` e roda `npm publish --provenance --access public` (OIDC) — **publish direto**, não stage.
- **Contraste Titan (fonte Interview):** Titan recusa inventar bump; `classifyBump` usa commits + seções Unreleased; baseline = npm latest; `--ship` = tag + `gh release create`; Action faz `npm stage publish`; humano `stage approve` com 2FA. AS precisará **migrar o próprio** `publish.yml` no dogfood se a skill mandar “stage para todos”.
- **Installer não scaffolda o repo consumidor:** efeitos de install são journal (`reconcileFileSet` de skills/assets no host, runtime sob `~/.atomic-skills/`, merges de settings). Não há efeito “escrever `.github/workflows/publish.yml` / `scripts/semver-bump.*` dentro do git working tree do usuário”. Implicação de design: templates de Action/chooser ou (1) vivem como assets da skill e a skill **instrui** cópia/adopção no repo, ou (2) o AS ganha um comando/scaffold novo (escopo de install/parity maior). Para v1, (1) é o seam existente.
- **`plan-branch-policy.js`:** branches `plan/<slug>` são bookkeeping de plano AS, não feature branches de produto. Não confundir com a política “trabalho de produto → PR para default branch”.
- **PR no ecossistema AS hoje:** `implement-foreign-plan.md` menciona `gh pr create` opcional; `parallel-dispatch` proíbe broadcast/`gh pr create` nos workers. Não há skill canônica “abrir PR e não mergear local na default”.

## Open risks / seams

- **Boundary de produto:** endurecer git workflow vs `what_is_not` — precisa decisão explícita no design.
- **Detecção da default branch:** `main`|`master` hardcoded em `save-and-push` é insuficiente; alinhar com `origin/HEAD` como em `diff-capture.md`.
- **Dual-mode npm:** sem `package.json` / sem intent npm → só GH Release; com npm → Action stage-only. Skill e templates não podem assumir registry.
- **Dogfood AS:** migrar `publish.yml` de `npm publish` → `npm stage publish` é mudança de processo do mantenedor (2FA approve vira passo obrigatório).
- **Onde mora o chooser:** código determinístico (padrão Titan) vs só prompt. Interview pede que a IA não escolha versão — o design deve preferir script/asset determinístico + skill que se recusa a adivinhar.
- **Unificação save-and-push ↔ release:** uma cadeia (commit convencional → push em feature branch → PR → merge → release/ship) vs duas skills soltas que divergem.
