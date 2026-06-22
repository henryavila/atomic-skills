---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f5-coupling-interim-de-atomic-s
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      O teste da T-001 existia para PROVAR o wiring `.gitattributes` (`merge=union`),
      mas usou `assert.match(out, /merge:\s*union/)` — um substring NÃO-ancorado que
      também aceita `merge=unionized` / `merge=union-custom` (um driver git diferente,
      custom ou ausente), enquanto o git silenciosamente não usa o driver `union`
      built-in e appends concorrentes poderiam conflitar com a suite verde. O review
      local mesmo-modelo declarou o teste explicitamente "sound" (anti-tautologia) e
      MISSOU; o pass Codex cross-model blind pegou como major. 5ª fase consecutiva
      (wlf-f1/f2/f3/f4) em que o cross-model pega a classe que o mesmo-modelo racionaliza.
    corrective: >-
      Quando um teste afirma que um config/atributo/feature-flag resolve para um valor
      ESPECÍFICO, extraia o valor e asserte igualdade EXATA (`strictEqual`), nunca um
      substring/regex não-ancorado: `X` vs `X-suffix` é precisamente o valor
      adjacente-mas-errado que um matcher frouxo libera, tornando o próprio teste-prova
      tautológico (prova menos do que afirma). É a wlf-f4 L-001 ("verifier happy-path
      racionaliza o gap") manifestando um NÍVEL ACIMA — na asserção do próprio TESTE, não
      na implementação. Rodar `review-code --mode=both` sobre o verifier em si, não só
      sobre a implementação: o cross-model é o que pega a asserção frouxa que o autor
      racionaliza. Locus: tests/dispatch-log-merge-union.test.js (extração `mergeAttr`).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no/L-001
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2100-wlf-f5-coupling-ndjson-union.md (codex blind
      F-001 major, local declarou o teste "sound" e missou; informed pass-2 confirmou
      closure, emerged 0); tests/dispatch-log-merge-union.test.js (mergeAttr split + 
      strictEqual('union')); fix commit 9bde0c9
    createdAt: 2026-06-17T21:00:00Z
    validatedAt: 2026-06-17T21:00:00Z
  - id: L-002
    statement: >-
      A SPEC da T-001 (escrita na criação do plano, fases adiante) tinha dois gaps com a
      realidade, visíveis SÓ ao aterrar antes do dispatch: (1) o 1º critério de acceptance
      (`focus.json` no `.gitignore`) já estava satisfeito de uma sessão anterior — trabalho
      pré-feito; (2) o mecanismo central (`merge=union` nos JSONs de `status/*`) era
      INSEGURO para o único arquivo append-only, o `dispatch-log.json`, um array JSON
      pretty-printed que union-merge corromperia (`}` seguido de `{` sem vírgula = JSON
      inválido). Nenhum dos dois era visível só pelo texto da SPEC; ambos vieram de ler o
      `.gitignore` real, a estrutura real dos arquivos, e como o git union-merge se comporta.
    corrective: >-
      Antes de despachar uma task cuja SPEC foi escrita adiantada (sobretudo num plano
      multi-fase, e ESPECIALMENTE a um executor foreign Mode 2, que constrói a SPEC ao pé
      da letra), re-aterre CADA critério de acceptance no repo VIVO: já está satisfeito? o
      mecanismo nomeado realmente faz o que a SPEC supõe nos artefatos reais? Surface um
      mismatch de design (ex: union-on-array corrompe) ao operador como ratify-gate — não
      auto-construa a SPEC literal. Emende SPEC + verifier para casar a realidade ANTES do
      dispatch. Fato técnico reusável: `git merge=union` é lossless SÓ em arquivos
      line-oriented — um log append-only que precisa mergear entre branches tem que ser
      NDJSON (1 registro JSON compacto por linha), nunca um array JSON multi-linha. Locus:
      F5/T-001 SPEC amendment (Decisão 5 → NDJSON), .gitattributes + mode2-codex-lane.md §9.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      commit bbeb0f3 (amend SPEC: focus.json pré-satisfeito + union-on-array corromperia →
      NDJSON); .gitignore (.atomic-skills/focus.json pré-existente); .atomic-skills/status/
      dispatch-log.json convertido array→NDJSON (16 records lossless); .gitattributes
      merge=union; skills/shared/mode2-codex-lane.md §9 NDJSON
    createdAt: 2026-06-17T21:00:00Z
    validatedAt: 2026-06-17T21:00:00Z
---

# Lessons — F5 coupling interim de .atomic-skills/ (worktree-lifecycle-finalization)

Distiladas no phase-done de F5 a partir de sinal real: o grounding pré-dispatch (que
re-escopou a Decisão 5 para NDJSON e achou o `focus.json` já ignorado) + o review-gate
`--mode=both` sobre o diff de código da fase (`.gitattributes` + `mode2-codex-lane.md` §9
+ o teste novo). O pass local (envelope selado, mesmo-modelo) achou 1 minor (extensão
`.json` em conteúdo NDJSON, rename out-of-scope) + 2 nits + 1 nota de traceability; o
Codex blind achou 1 major (`F-001`, asserção de atributo não-ancorada) que o local
declarou "sound"; o informed pass-2 confirmou o fix e não emergiu nada (verdict clean).
Fix aplicado em `9bde0c9`; verdict efetivo needs_changes→all-fixed.

**Validação da decisão `--mode=both` (cross-model), 5ª fase seguida:** o único finding
acionável (`F-001`) foi pego SÓ pelo Codex — o local não só perdeu como afirmou
positivamente que o teste era sound. A L-001 sharpeniza a wlf-f4 L-001: o gap "verifier
happy-path racionaliza" reaparece na asserção do PRÓPRIO teste, não na implementação.

**Grounding como gate:** a L-002 registra que re-aterrar a SPEC no repo vivo antes do
dispatch é o que separou "construir a Decisão 5 literal (corromperia)" de "refiná-la para
NDJSON". Num lane Mode 2 isso é dobrado: o executor não tem latitude para questionar a
SPEC — o aterramento é responsabilidade do orquestrador, pré-dispatch.

**Follow-ups abertos (ratificados, não-bloqueantes):** (a) `dispatch-log.json` carrega
conteúdo NDJSON sob extensão `.json` — o canon de design chama de `.jsonl`; renomear (+
reconciliar refs e o pattern do `.gitattributes`) é uma task futura. (b) o canon
`06-session-boundary-and-telemetry.md` ainda diz que o sidecar é "gitignored" — a Decisão
5 deliberadamente o RASTREIA (union-merge entre worktrees exige tracking); a prosa do
canon precisa de reconciliação.
