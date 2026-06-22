# plan-fork — protocolo de estado do modo `parallel` (cross-worktree)

Spec do degrau 7.5 (`fork-plan … --mode parallel`), fase **F2** do plano `plan-fork`.
Decisões load-bearing ratificadas pelo usuário em 2026-06-19 (3 escolhas one-way-door,
abaixo). Escopo: **só o modo `parallel`** — o `pause` (F1) não muda.

> Estado de implementação: este documento é a SPEC (T-001). A resolução canônica + o
> writeback com concorrência otimista são a T-002 (`src/parallel-state.js` +
> `tests/parallel-state.test.js`). A oferta de retomada que consome o
> `pendingWriteback` é a F3.

## 1. Problema

`.atomic-skills/` é **tracked em git** (CLAUDE.md: a árvore de tracking é versionada,
não ignorada). Cada worktree vive numa branch própria (`git worktree list` mostra 7
worktrees, cada uma em `plan/<slug>`), então **cada worktree tem sua própria cópia
working-tree de `.atomic-skills/`** na sua branch.

No modo `parallel`, o pai `P` roda `active` na sua worktree (branch `plan/P`) e o filho
`C` roda `active` numa worktree própria (branch `plan/C`). Quando o filho precisa
escrever de volta no estado do pai (o elo `spawnedPlans`, e na F3 a retomada do pai),
ele edita um estado que tem **duas cópias git-tracked divergentes** — a do pai (na
worktree do pai) e a cópia stale que o filho herdou ao branchar. Sem um protocolo, dois
writers (pai na worktree A, filho na worktree B) sobrescrevem um ao outro: **lost
update**.

Distinto do `pause`, que é single-tree (o pai pausa na mesma worktree) e não tem
concorrência.

## 2. Decisão 1 — Dono do estado canônico: a worktree do PRÓPRIO pai

O estado **canônico** do pai é o que vive na **worktree do pai** (branch `plan/P`), não
no checkout primário (que pode estar numa branch não-relacionada) nem num local fora de
git. O filho resolve a worktree do pai e escreve LÁ.

### Resolução canônica (determinística)

Dado o filho (que conhece `spawnedFrom.plan = <parent-slug>` no seu próprio sidecar):

1. Ler o `branch:` do plano-pai. Fonte: o `plan.md` do pai. Mas o filho só tem a cópia
   stale do pai — o `branch:` é estável (não muda no fork), então a cópia stale serve
   para descobrir a branch. (Se ausente/`null`, abortar com erro claro: parallel exige
   o pai numa worktree nomeada — ver §8.)
2. `git worktree list --porcelain` → parsear os pares `worktree <path>` / `branch
   refs/heads/<name>`. Achar a entrada cujo `branch` == `refs/heads/<parent-branch>`.
   Seu `<path>` é a **worktree do pai**.
3. O arquivo canônico do estado do pai é
   `<parent-worktree-path>/.atomic-skills/projects/<project-id>/<parent-slug>/plan.md`
   (e, para o elo, `<…>/<parent-slug>/links.json`). Resolver nested-first com fallback
   flat, como o resto do skill.

Falhas de resolução (branch do pai não bate nenhuma worktree; pai sem `branch:`; mais de
uma worktree na mesma branch) **abortam sem escrever** e surfaceiam o motivo — nunca
adivinham um alvo.

## 3. Decisão 2 — Token de revisão: content-hash (compare-and-swap)

O token de concorrência otimista é o **sha256 dos bytes do arquivo-alvo canônico**. Sem
mudança de schema no `plan.md` (um campo novo no topo do Plan `.strict` derruba o card no
aiDeck 0.1.0 — [[aideck-plan-fork-contract]]), sem dependência de git (vale para um
working-tree dirty), e uniforme para `plan.md` E `links.json`.

- **Leitura por revisão:** ao ler o estado canônico do pai (tempo T0), o filho captura
  `token0 = sha256(bytes_T0)` junto com o conteúdo.
- **Não** vai um `stateRev` no `plan.md` (campo novo `.strict` quebraria o aiDeck). Não
  é git blob sha (o blob do índice não reflete o working-tree dirty da worktree do pai).

## 4. Escrita atômica com CAS

A janela otimista é entre a leitura do filho (T0, quando ele computa a edição) e o commit
(T1). Pessimista seria travar durante todo o "think time"; otimista trava só o
check-and-write final.

Procedimento do writeback (no arquivo canônico da worktree do pai):

1. **Adquirir um lock advisory curto** no diretório do plano do pai:
   `<parent-plan-dir>/.links.lock` criado com `O_EXCL` (open exclusivo) ou `mkdirSync`
   (falha se já existe). Espera-curta-com-retry limitado; se não obter em N ms, tratar
   como conflito (§5) — outro writer está ativo. O lock serializa só o check-and-write,
   não o think time.
2. **Re-ler** os bytes atuais do arquivo canônico → `token1 = sha256(bytes_T1)`.
3. **Predicado de conflito (§5).** Se `token1 != token0` → conflito → liberar o lock,
   ir para §6 (abort + pending-writeback). Nada é escrito.
4. Se `token1 == token0`: aplicar a mutação em memória sobre `bytes_T1` (== `bytes_T0`),
   escrever **atomicamente**: gravar num arquivo temporário no MESMO diretório
   (`<file>.tmp-<pid>`) e `rename()` por cima (rename é atômico no mesmo filesystem
   POSIX — sem estado meio-escrito visível).
5. **Liberar o lock** (`unlink`/`rmdir`), sempre — inclusive nos caminhos de erro
   (try/finally).

A combinação lock-curto + content-hash CAS fecha a janela TOCTOU: o lock serializa o
re-read/compare/write; o hash detecta uma escrita concorrente que aconteceu ANTES de o
filho pegar o lock (entre T0 e a aquisição).

## 5. Predicado de conflito (exato)

> **Conflito ⇔ `sha256(bytes_atuais_do_canônico_no_commit) != token0_capturado_na_leitura`.**

Isto é, o arquivo canônico do pai mudou entre a leitura do filho (T0) e o seu commit
(T1) — o pai (na sua worktree) ou outro filho escreveu nesse meio. Um match
(`token1 == token0`) prova que ninguém escreveu desde T0 → o write do filho não causa
lost update. Falha em adquirir o lock dentro do limite é tratada como conflito
(presunção conservadora: há um writer ativo).

## 6. Abort + recuperação (pending-writeback durável)

No conflito, o filho **NÃO força** e **NÃO finaliza** (não arquiva, não conclui). Em vez
disso:

1. Grava um marcador durável `pendingWriteback` no **sidecar do PRÓPRIO filho**
   (`links.json` da worktree do filho — não cross-worktree, sem concorrência):
   ```jsonc
   "pendingWriteback": {
     "target": "parent-plan",                 // ou "parent-sidecar"
     "parent": "<parent-slug>",
     "op": "addSpawnedPlan",                  // a mutação pretendida, declarativa
     "args": { "phaseId": "<from>", "childSlug": "<child-slug>" },
     "readToken": "<token0 sha256>",          // contra o que foi lido
     "detectedAt": "<ISO8601>",
     "reason": "parent canonical state changed since read (token mismatch)"
   }
   ```
   A `op`+`args` são **declarativas** (não um patch de bytes), então a retentativa re-lê
   o canônico FRESCO e re-aplica a operação semântica — nunca re-aplica bytes stale.
2. Surfaceia ao usuário: "estado do pai `<P>` mudou desde a leitura; writeback adiado —
   rode a retomada de novo para retentar contra o estado fresco do pai."
3. O filho permanece num estado que NÃO finaliza até o writeback ter sucesso. A oferta de
   retomada (F3) consome o `pendingWriteback`: re-resolve o canônico, re-lê (novo
   `token0`), re-aplica a `op`, e re-tenta o CAS de §4. Sucesso → remove o
   `pendingWriteback`. Conflito de novo → o marcador persiste (idempotente; não
   duplica).

Isto casa com a F3 (D4: writeback-falho → `pending-resume` durável; o filho não finaliza
até a recuperação) e satisfaz "abort sem lost update".

## 7. Verificação a partir das duas worktrees

O elo é verificável dos dois lados após um writeback bem-sucedido:

- **Do pai** (worktree do pai): `getSpawnedPlans(<parent-plan-dir>)` →
  `{ <from>: [<child-slug>, …] }` contém o filho.
- **Do filho** (worktree do filho): `getSpawnedFrom(<child-plan-dir>)` →
  `{ plan: <parent-slug>, phaseId: <from>, mode: "parallel", … }`.
- **Sem pendência:** nenhum dos sidecares carrega um `pendingWriteback` não-resolvido. Um
  `pendingWriteback` presente = o elo ainda não convergiu; a verificação reporta
  pendente, não OK.

O teste de concorrência (T-002) simula: duas escritas no canônico do pai com o mesmo
`token0` — a primeira passa (CAS match), a segunda detecta `token1 != token0` e roteia
para `pendingWriteback`, provando ausência de lost update.

## 8. Escopo e guardas

- **Só `parallel`.** O `pause` (F1) é single-tree e não toca este protocolo.
- **Pré-condições do parallel** (a F1 hoje REJEITA `parallel` até esta F2 existir): o pai
  precisa ter `branch:` não-nulo (uma worktree nomeada); senão abortar. O filho nasce na
  sua própria worktree (`git worktree add -b plan/<child> …`), reusando
  `worktree-isolation.md`.
- **Mudança de schema (T-002, design-brief L-002):** se `pendingWriteback` entrar no
  `links.schema.json`, constranger os campos enumeráveis (`target`, `op`) com enum e
  adicionar um teste negativo. `pendingWriteback` vive só no sidecar (não no `plan.md`
  `.strict`), então não afeta o contrato aiDeck.
- **Fork é intra-project**; toda resolução é dentro de `projects/<project-id>/`.

## 9. Referências

- Elo + helpers F0: `src/links-sidecar.js` (`getSpawnedPlans`, `getSpawnedFrom`,
  `addSpawnedPlan`, `readLinks`/`writeLinks`), `src/spawn-graph.js`.
- Procedure do verbo: `skills/shared/project-assets/project-emergence.md` → `fork-plan`.
- Isolamento de worktree: `skills/shared/worktree-isolation.md`.
- Contrato aiDeck 0.1.0: campos novos no topo do Plan `.strict` derrubam o card — por isso
  token = content-hash e `pendingWriteback` no sidecar, não no `plan.md`.
