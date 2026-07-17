# Auditoria adversarial — installer atomic-skills

**Date:** 2026-07-17  
**Branch context:** post modules-removal (`758b42c`) + GREENFIELD adopt fix (`131a345`)  
**Method:** explore agent (read-only) — `src/*` install path + `@henryavila/minimalist-installer` pin  
**Follow-up plan:** [installer-hardening-p0-p1.md](../plans/installer-hardening-p0-p1.md)  
**Related prior audit:** [installer-audit-2026-07-10.md](./installer-audit-2026-07-10.md)

**Escopo:** install/update/uninstall em `src/*`, runtime layers, e `@henryavila/minimalist-installer` (lock/receipt pin; package declares `0.1.0`).  
**Método:** leitura de código + cruzamento com testes/docs. Sem mutação de `~`.

---

## Executive summary

- **Saúde geral:** o flip para journal + reconciler 3-hash + path-nofollow + round-trip content-aware melhorou muito o caminho feliz. Vários C/H da auditoria de 2026-07-10 (Codex→Claude tools, auto-update Codex-only, `already-desired`, status por hash, setup sentinel do `project`) **já foram endereçados**.
- **Risco #1 (crítico):** falha no meio do Driver deixa `transaction: incomplete` com **journal de ownership velho** (effects anteriores), enquanto o disco pode já ter o file-set novo. Install **e** uninstall falham fechados; **não há CLI de recovery**.
- **Risco #2 (crítico/major):** o Driver **reconstrói o journal só com effects planejados** e **não reverte** effects que sumiram do plano (auto-update / jsonMerge ao encolher IDEs). Residue de hooks + settings.
- **Risco #3 (major):** shrink que remove `grok` **não** desregistra host plugin nem isolation TOML; runtime global `package-root` continua last-writer-wins sem reelection.
- **Risco #4 (major):** `adoptPreexistingDesiredFiles` elimina `GREENFIELD_CONFLICT` adotando **qualquer** conteúdo em paths desejados e depois **reescreve** (P3 enfraquecido em expand IDE / leftovers).
- **Ops/UX:** SIGINT interativo é mentiroso e potencialmente reentrante; contagem de uninstall é tamanho do `files{}`; dual `writeManifest` (local não-atômico vs engine atomic/no-follow).

---

## Findings (por severidade)

### F-001 — Incomplete transaction: journal stale + bricks install/uninstall

- **Severity:** critical
- **Title:** Falha mid-install grava marker incomplete com ownership antigo; recovery só manual
- **Evidence:**
  - `node_modules/@henryavila/minimalist-installer/src/driver.js:62-93` — grava incomplete com `prior` effects, zera `effects` **só em memória**, aplica effects sem flush intermediário, complete só no fim.
  - `.../recovery.js:53-63` — `assertNoIncompleteTransaction` em install **e** uninstall.
  - `tests/release-fault-matrix.test.js:195-200` — recovery de teste = `rm -rf` do `.atomic-skills` (produto sem comando).
- **Claim:** após crash/erro no effect N>1, disco ≠ journal; retry e uninstall recusam; operador precisa editar/apagar manifest.
- **Impact:** install “meio aplicado” irrecuperável pela CLI; residual de skills/hooks sem uninstaller oficial.
- **Recommendation:** (upstream) journalar cada effect após apply **ou** preflight+staging+commit; flush do beforeState aplicado sob incomplete; (consumer) `install --repair` / `uninstall --force-incomplete` usando `describeRecovery` + replay do que for seguro.
- **Confidence:** high
- **Owner:** both

### F-002 — Effects removidos do plan não são revertidos (IDE shrink / auto-update)

- **Severity:** critical
- **Title:** Update que remove hosts capable deixa hooks/settings órfãos
- **Evidence:**
  - `driver.js:73-103` — journal final = **apenas** effects do `plan` atual; sem revert de types/ids ausentes.
  - `src/runtime-layers/auto-update.js:96-98` — zero capable hosts → `return []` (não emite `stageRuntimeArtifacts`/`jsonMerge`).
  - `tests/auto-update-host-matrix.test.js` — cobre install fresco Codex-only; **não** claude→codex update.
- **Claim:** `ides: [claude-code]` → depois `ides: [codex]` deixa `version-check.sh` + SessionStart em `.claude/settings.json` (e/ou hook Grok) **fora** do journal; uninstall posterior não os remove.
- **Impact:** residue permanente, hooks de update em hosts não selecionados, paridade install↔uninstall quebrada no eixo update.
- **Recommendation:** no Driver (preferível) ou no consumer: diff prior vs planned effects e `revert` dos dropados antes de reescrever o journal; teste obrigatório claude→codex e claude+grok→cursor.
- **Confidence:** high
- **Owner:** both (kernel ideal; workaround em atomic-skills possível)

### F-003 — Shrink away from Grok não limpa host registry / isolation

- **Severity:** major
- **Title:** Fora-do-journal Grok só roda no uninstall se `manifest.ides` ainda contém `grok`
- **Evidence:**
  - `src/install.js:563-603` — `syncGrokPluginHostAfterInstall` no-op se `!wantsGrokPluginHost(ides)`.
  - `src/uninstall.js:126-142` — unregister/isolation condicionados a `wantsGrokPluginHost(manifest.ides)` **já atualizado**.
  - Nenhum teste de “install com grok → reinstall sem grok → host limpo”.
- **Claim:** remover Grok da seleção deixa `grok plugin` registrado e `[skills].ignore` no `~/.grok/config.toml`.
- **Impact:** menu Grok com plugin fantasma; isolation residual afeta skill discovery; estado externo não versionado no journal.
- **Recommendation:** se `prior.ides` tinha grok e `next` não, chamar `unregisterGrokPluginHost` + `revertGrokAgentsIsolation` (com refcount) **antes** de reescrever o manifest.
- **Confidence:** high
- **Owner:** atomic-skills

### F-004 — `adoptPreexistingDesiredFiles` clobbera conteúdo unowned em paths desejados

- **Severity:** major
- **Title:** GREENFIELD_CONFLICT contornado com rewrite silencioso (P3 seletivo)
- **Evidence:**
  - `src/adopt-preexisting-desired.js:18-22,66-71` — grava `installedHash = hash(current)` para paths desired existentes e não journalados.
  - `reconciler.js:66-83` — `current === installed` → rewrite desired.
  - `tests/install.test.js` + `tests/adopt-preexisting-desired.test.js` — assertam reescrita do stale leftover; não testam “user custom skill no namespace”.
- **Claim:** qualquer ficheiro em destino de skill (incl. edit local ou alien no namespace) é tratado como “nosso” e sobrescrito sem prompt.
- **Impact:** perda de conteúdo local no expand IDE; tradeoff consciente vs reliability, mas remove a única safety rail greenfield.
- **Recommendation:** adotar só se hash ∈ histórico package **ou** frontmatter atomic-skills safelist; senão prompt/`--force-adopt` / manter GREENFIELD. Logar `adopted` na UI.
- **Confidence:** high
- **Owner:** atomic-skills

### F-005 — Runtime global `package-root` last-writer-wins; registry versionado nunca preenchido no write path

- **Severity:** major
- **Title:** Multi-owner / multi-versão ainda elege runtime pelo último install
- **Evidence:**
  - `src/install.js` — cada install sobrescreve `~/.atomic-skills/package-root`; `registerInstall` só garante `basePath` (owners novos `{ basePath }`).
  - `src/runtime-observe.js` — **lê** `packageRoot`/`fingerprint` versionados e elege, mas writers não populam.
  - `src/uninstall.js` — reclaim só no last owner; **sem** reelection/restage do runtime do surviving owner.
- **Claim:** project-scope antigo ou npx cache pode fixar `package-root` para checkout errado enquanto user install novo “sobrevive”.
- **Impact:** scripts/hooks resolvem schemas/deps da versão errada; fantasma no registry impede reclaim (só observado em `status`, não podado).
- **Recommendation:** writers gravam `{basePath, packageRoot, version, fingerprint}`; on unregister restage do selected live owner; prune ghosts sob lock com confirmação.
- **Confidence:** high
- **Owner:** atomic-skills

### F-006 — Dual manifest I/O: local `writeFileSync` vs engine atomic/no-follow

- **Severity:** major
- **Title:** adopt + patch pós-install contornam path-safety do engine
- **Evidence:**
  - `src/manifest.js:14-20` — `writeFileSync` plain.
  - `node_modules/@henryavila/minimalist-installer/src/manifest.js` — `atomicWriteJsonNoFollow`.
  - `adopt-preexisting-desired.js` e `install.js` usam o local; `migrate-legacy-install.js` usa o do engine.
- **Claim:** escrita do ledger mais sensível (ownership adopt + metadata) não é atómica nem no-follow; API dual confunde.
- **Impact:** manifest torn/parcial sob crash; inconsistência com o contrato de path-safety.
- **Recommendation:** apagar `src/manifest.js` write path ou reexportar o do package com `MANIFEST_DIR='.atomic-skills'`; todo write via engine.
- **Confidence:** high
- **Owner:** atomic-skills

### F-007 — `stageRuntimeArtifacts` sem no-follow / fora do path-safety

- **Severity:** major
- **Title:** Effect custom de runtime usa `existsSync`/`copyFileSync`/`rmSync` plain
- **Evidence:** `src/runtime-layers/effects/stage-runtime-artifacts.js` — lexical `resolveWithinBase` only; sem `O_NOFOLLOW`.
- **Claim:** symlink em leaf/intermediário sob base pode fazer copy/rm seguir link (especialmente em update com ownership prior).
- **Impact:** escape/corrupção fora do base em ambientes hostis multi-user (menor em laptop single-user).
- **Recommendation:** reimplementar com `writeFileNoFollow` / openat path-safety do engine, ou mover staging de hook para reconcile+chmod effect upstream.
- **Confidence:** medium-high
- **Owner:** both

### F-008 — SIGINT handler interativo: false cleanup + reentrância

- **Severity:** major
- **Title:** Ctrl+C promete “no files kept” e pode re-disparar o handler
- **Evidence:**
  - `src/install.js` — `onFileWritten` só no **fim** de `installSkills`; durante Driver `writtenFiles=[]`.
  - `cleanup` chama `process.kill(process.pid, 'SIGINT')` com listener ainda ativo → reentrada.
- **Claim:** cancelamento mid-install não reverte journal/files e a mensagem é falsa; risco de stack overflow.
- **Impact:** estado partial + UX enganosa; pior se incomplete marker (F-001).
- **Recommendation:** remover SIGINT “fake”; se manter, `removeListener` + `uninstall`/replay do journal incomplete; `process.exit(1)` sem re-signal.
- **Confidence:** high
- **Owner:** atomic-skills

### F-009 — Caminhos interactive vs `--yes` para runtime registry

- **Severity:** minor–major
- **Title:** `--yes` usa lock único; interativo separa stage e register
- **Evidence:**
  - `--yes`: `publishRuntimeAndRegister`.
  - interactive: `installRuntimeArtifacts(); registerInstall(basePath)` — dois locks sequenciais.
- **Claim:** janela entre stage e register; comportamento divergente.
- **Impact:** race rare com installs paralelos; inconsistência de código.
- **Recommendation:** sempre `publishRuntimeAndRegister`.
- **Confidence:** high
- **Owner:** atomic-skills

### F-010 — Uninstall reporta `Object.keys(manifest.files).length`, não deletes reais

- **Severity:** minor
- **Title:** “N files removed” mente quando P3 preserva edits
- **Evidence:** `src/uninstall.js` vs reconciler revert que só unlink se hash bate.
- **Impact:** operador acredita em limpeza completa com residue legítimo.
- **Recommendation:** contar unlinks efetivos do replay ou reportar `removed/preserved`.
- **Confidence:** high
- **Owner:** atomic-skills

### F-011 — `createAideckRuntimeProvider` morto; runtime global ainda imperativo

- **Severity:** minor
- **Title:** Dual implementation aideck runtime (provider não wired)
- **Evidence:** `src/runtime-layers/aideck.js` vs `buildInstaller` só Skills+AutoUpdate; staging real em `installRuntimeArtifacts`.
- **Impact:** drift futuro entre provider e imperativo; complexidade pós-modules removal.
- **Recommendation:** wire no journal **ou** delete o provider; documentar explicitamente o outside-journal.
- **Confidence:** high
- **Owner:** atomic-skills

### F-012 — Locks do Driver vs locks do consumer em roots diferentes

- **Severity:** minor
- **Title:** Engine default `~/.minimalist-installer/locks`; runtime `~/.atomic-skills/locks`
- **Evidence:** engine `lock.js` DEFAULT_LOCK_ROOT; `src/runtime-locks.js`; `buildInstaller` não passa `lockRoot`.
- **Claim:** serialização de journal e registry não compartilha lock root.
- **Impact:** concurrent multi-process races edge-case entre journal complete e register.
- **Recommendation:** passar `lockRoot: join(homedir(),'.atomic-skills','locks')` + resourceIdentities de registry no defineInstaller.
- **Confidence:** medium
- **Owner:** atomic-skills

### F-013 — `uninstall --yes` com user+project defaults para `user` só

- **Severity:** minor
- **Title:** Ambiguidade de scope silenciosa em CI
- **Evidence:** `src/uninstall.js`.
- **Impact:** project install residual se script assume “tudo”.
- **Recommendation:** com ambos e `--yes` sem `--project`, exigir flag ou uninstall ambos com log explícito.
- **Confidence:** high
- **Owner:** atomic-skills

### F-014 — `update.test.js` ainda simula orphan removal manual

- **Severity:** minor (smell / gap de confiança)
- **Title:** Teste de update reimplementa lógica legada em vez de assertar o Driver
- **Evidence:** `tests/update.test.js` — loop manual pós-`installSkills`.
- **Claim:** não prova que o reconciler remove orphans sozinho (pode mascarar regressão).
- **Recommendation:** assertar ausência de paths antigos **antes** do loop; apagar simulação.
- **Confidence:** high
- **Owner:** atomic-skills

---

## Test gaps

| Scenario | Expected | Current coverage | Priority |
|---|---|---|---|
| Fail effect N (jsonMerge/stage) mid-update → inspect disk vs journal | Incomplete + recoverable path; retry/uninstall defined | Fault matrix only on bare engine + boom effect; **no** atomic-skills `installSkills` path; recovery = rm tree | P0 |
| claude(+grok) → codex-only update | Zero hooks Claude/Grok; settings SessionStart removido | Fresh codex-only only | P0 |
| install grok → reinstall without grok | Host unregister + isolation refcount | Host register tests only | P0 |
| Incomplete marker: install **and** uninstall blocked; operator message | CLI documents recovery | Engine throws only | P0 |
| adopt + user-edited skill at desired path | Preserve or prompt | Only “stale leftover rewrite” | P1 |
| SIGINT during interactive install | Honest state / no reentrancy | Untested | P1 |
| Multi-owner package-root election after uninstall of last writer | Surviving owner restaged | Observe-only; no write path metadata | P1 |
| Ghost owner prune | Refcount honest | status warns; no auto-prune | P1 |
| stageRuntimeArtifacts + leaf symlink | Refuse like reconcile | Only engine file-set symlink test | P1 |
| Interactive vs `--yes` runtime lock parity | Same atomic publish+register | Untested divergence | P2 |
| Uninstall count vs preserved P3 files | Accurate numbers | Untested | P2 |
| `update.test.js` orphan without manual loop | Driver removes unmodified orphans | Manual simulation | P2 |
| Concurrent install same basePath | Serialize journal+registry | Registry concurrency only sequential | P2 |
| Windows path / spaces in home | shellQuote + path-nofollow | Partial multiplatform contract tests | P2 |

---

## Improvements backlog (full)

### P0
1. Recovery CLI + journalize-per-effect (or real rollback) for incomplete TX (**F-001**).
2. Revert dropped effects on plan shrink — auto-update/jsonMerge (**F-002**).
3. Grok host/isolation cleanup on IDE shrink (**F-003**).
4. E2E tests: late-effect fail → repair → uninstall byte-baseline on **full** `install()` path.

### P1
5. Harden adopt (safelist / prompt / `--force-adopt`) (**F-004**).
6. Versioned registry writes + restage package-root on last-writer leave (**F-005**).
7. Single atomic/no-follow manifest writer (**F-006**).
8. Path-safety em `stageRuntimeArtifacts` (**F-007**).
9. Fix/remove SIGINT handler (**F-008**).
10. Unify interactive runtime publish with `publishRuntimeAndRegister` (**F-009**).

### P2 (out of plan scope — keep as backlog)
11. Uninstall metrics honest (**F-010**).
12. Delete or wire `createAideckRuntimeProvider` (**F-011**).
13. Align lock roots (**F-012**).
14. Strict multi-scope uninstall under `--yes` (**F-013**).
15. Rewrite `update.test.js` against Driver only (**F-014**).
16. Publish npm version do minimalist-installer >0.1.0 alinhado ao git pin (receipt vs declared version).

---

## What is solid

- **Reconciler 3-hash** com `already-desired` / keep-local / P3 no-proof-no-delete.
- **Round-trip content-aware** user + all-public-IDEs (`tests/install-uninstall-roundtrip.test.js`).
- **Path-nofollow multiplatform** no engine + testes de data-safety (symlink leaf).
- **Legacy → journal migration** com unmanaged sem delete (`migrate-legacy-install.js`).
- **Auto-update capability matrix** (Codex-only não toca Claude) + `version-check.sh` scope-aware `--project`.
- **Host tool profiles** por IDE em `config.js`.
- **Status hash-verify** (`status.js` + `status-verify.js`).
- **project setup sentinel** distingue ledger installer de lifecycle.
- **Shared assets recursion** + collision throw em `computeSkillsFileSet`.
- **Registry fail-closed** em JSON corrupto; locks em `registerInstall`/`unregisterAndMaybeReclaimRuntime`.
- **Install/uninstall parity enforcer** como gate estrutural (ainda não cobre outside-journal shrink/host).

---

## Notas de regressão vs auditoria 2026-07-10

| Achado antigo | Estado em 2026-07-17 |
|---|---|
| C1 non-transactional + already-desired | **Parcial:** already-desired OK; incomplete fail-closed mas recovery/journal stale = F-001 |
| C2 project sentinel = dir | **Corrigido** no skill |
| C3 shared assets omitidos | **Melhorado** (walk recursive + standalone files) |
| H1 tool profile Claude | **Corrigido** (`HOST_TOOL_PROFILES`) |
| H4 auto-update Claude-only | **Corrigido** para fresh; **residue no shrink** = F-002 |
| H5 status falso verde | **Corrigido** (hash verify) |
| H2/H3/H6 runtime/registry | **Ainda aberto** (F-005); observe melhorou, write path não |

---

## Conclusão

O installer está **operacional no happy path** e bem armado com testes de parity, mas os bugs restantes são exatamente os que geram tickets recorrentes: **partial apply + recovery**, **update/shrink multi-IDE residual**, **adopt vs GREENFIELD**, e **runtime/host fora do journal**. Priorizar F-001–F-003 desbloqueia confiabilidade operacional; P1 endurece multi-owner e path safety.

**Plano de implementação:** [docs/plans/installer-hardening-p0-p1.md](../plans/installer-hardening-p0-p1.md)
