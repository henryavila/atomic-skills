# Economia de tokens — todas as skills (2026-06-15)

> Companheiro: `docs/audits/project-implement-audit-2026-06-15.md` (router `project` + `implement`, já detalhados lá).
> Este relatório cobre as 12 skills restantes e funde os ganhos transversais com os dois da referência.

## Sumário

**Economia total estimada: ~21.700 tokens** de corpo residente (12 skills aqui = ~15.320 tok + `project` ~3.450 + `implement` ~2.955 = ~6.405 de referência).

Das 14 skills no escopo total:

- **9 têm desperdício real e acionável** — `review-code` (3.050), `review-plan` (2.700), `hunt` (1.640), `parallel-dispatch` (1.640), `fix` (1.430), `verify-claim` (1.190), `brainstorm` (1.180), `debate` (1.180), `init-memory` (560), `parallel-dispatch-audit` (560) — mais os dois de referência (`project` 3.450, `implement` 2.955).
- **3 já estão enxutas / quase enxutas** — `prompt` (~110 tok, cosmético), `save-and-push` (~0–80 tok, cosmético), e `parallel-dispatch-audit` é o caso-limite (moderadamente enxuto, ~560 tok).

**O achado nº1 é o imposto Red Flags/Rationalization.** Ele aparece em **11 das 14 skills** e soma **~5.715 tok** recuperáveis — a maior alavanca transversal única do repositório. Em quase todas, as duas tabelas reafirmam o MESMO conjunto de ~7-8 regras 1:1 (cada linha de Rationalization tem uma gêmea em Red Flags), e frequentemente uma terceira vez no Iron Law/Mindset/Process. O gatilho de reconhecimento (a frase-tentação) é a parte load-bearing que deve permanecer residente; a coluna "Reality"/refutação é o que se re-paga a cada turno sem necessidade.

A segunda maior alavanca é a **duplicação cross-skill do envelope codex** entre `review-code` + `review-plan` + `implement` (~3.265 tok somados), onde os assets-folha já estão corretamente single-sourced em `skills/shared/codex-bridge-assets/`, mas a narrativa do procedimento de 11-12 passos está copiada quase byte-a-byte nos dois corpos de review.

---

## Ranking de ganhos

| Skill | Tokens do corpo | Economia est. | Maior alavanca |
|---|---:|---:|---|
| **project** (ref.) | ~6.680 | **~3.450** | resident-bloat do router: schema-ref + rollups/summaries + cq-gates → lazy |
| **review-code** | 6.281 | **3.050** | blocos mode/branch-gated (local XOR codex; scope XOR ref) residentes em todo modo → lazy |
| **implement** (ref.) | ~6.750 | **2.955** | Red Flags/Rationalization (~2.955) + contrato Mode-2 duplicado (~1.465) |
| **review-plan** | 7.733 | **2.700** | sub-flow codex de 11 passos branch-only + near-dup com review-code |
| **hunt** | 4.174 | **1.640** | Phase 0 directory-triage residente em todo hunt de arquivo único → lazy |
| **parallel-dispatch** | 3.860 | **1.640** | templates emit-time (Phase 3 prompt + Phase 4 plan-file) residentes → lazy |
| **fix** | 3.576 | **1.430** | Red Flags ↔ Rationalization ↔ Phase-3g triplicam as mesmas regras |
| **verify-claim** | 2.734 | **1.190** | Rationalization quase-total duplicata + step-4 re-spec do executor shared |
| **brainstorm** | 3.681 | **1.180** | Red Flags + Rationalization = as mesmas 8 regras duas vezes (37% do corpo) |
| **debate** | 4.113 | **1.180** | gate-mode (--gate) residente em toda invocação não-gate → lazy |
| **parallel-dispatch-audit** | 3.012 | **560** | Rationalization 1:1 com Red Flags + campos do report enumerados 3x |
| **init-memory** | 2.149 | **560** | Step 5 Connect + Critical Context branch-only → lazy |
| **prompt** | 1.108 | **110** | já enxuta (único item: Step 5 opcional, não vale o indireto) |
| **save-and-push** | 1.188 | **80** | já enxuta (único item: micro-tighten cosmético — NÃO fazer) |
| **TOTAL** | | **~21.700** | |

---

## Padrões transversais (fixes GLOBAIS — um fix limpa N skills)

### Padrão 1 — O imposto Red Flags/Rationalization (a maior alavanca única)

- **Skills afetadas (11):** brainstorm (700), fix (545+320), hunt (300), parallel-dispatch (280), parallel-dispatch-audit (250), review-code (350), review-plan (450), verify-claim (530), debate (110+320), init-memory (130), + `implement` (~2.955, referência).
- **Total somado:** **~5.715 tok** (sem `implement`) / **~8.670 tok** incluindo `implement`.
- **Diagnóstico:** em quase toda skill, `## Red Flags` e `## Rationalization` enumeram o MESMO conjunto de regras. A correspondência é 1:1 — cada linha de Rationalization (`Temptation | Reality`) tem uma gêmea verbatim na lista de Red Flags. Exemplos concretos verificados: `fix.md:144` "I already know what it is" ↔ `fix.md:191` "The cause is obvious"; `verify-claim.md:72` "Green with testsCollected:0" ↔ `verify-claim.md:88` "exit 0 with 0 tests collected is a vacuous pass" (a regra do 0-count aparece **5 vezes**: L29, L36, L72, L78, L88); `debate.md` role-play→converges aparece 5x (Iron Law + HARD-GATE + Why-this-matters + Red Flag + Rationalization). O gatilho de reconhecimento (a frase-tentação na coluna esquerda) é load-bearing — deve disparar ambientalmente da conversa. A coluna "Reality"/refutação é a parte recuperável.
- **UM fix compartilhado:** estabelecer **uma convenção de repositório**: cada skill mantém SÓ a lista `## Red Flags` de gatilhos one-liner residente (a parte ambiente), e a tabela `## Rationalization` é (a) **deletada** quando cada linha apenas reafirma um Red Flag + uma regra de Process já residente, ou (b) movida para um **asset lazy de anti-padrões** por skill (`<skill>-assets/rationalizations.md`) com um ponteiro de 1 linha, lido só quando uma tentação é de fato sentida. NUNCA remover os gatilhos one-liner. Aplicar a mesma receita às 11 skills de uma só passada.

### Padrão 2 — Envelope codex / Mode-2 / anti-framing duplicado entre os reviews vs. single-sources shared

- **Skills afetadas (3):** review-code (700), review-plan (1.100), + `implement` Mode-2 contract (~1.465, referência).
- **Total somado:** **~1.800 tok** (review-code + review-plan) / **~3.265 tok** incluindo o contrato Mode-2 de `implement`.
- **Diagnóstico — duas duplicações DISTINTAS, não as confunda:**
  1. **Sub-flow de review codex (review-code ↔ review-plan):** `review-code.md:307-381` e `review-plan.md:331-441` são o MESMO procedimento de 11-12 passos (pre-flight → curate Pass 1 → briefing confirm → Pass 1 blind invocation → Pass 1 validation → Pass 2 suffix → Pass 2 invocation → Pass 2 validation → persistence → triage), abrindo ambos com a frase idêntica "uses canonical assets in skills/shared/codex-bridge-assets/" (confirmado: `review-code.md:309`). Os assets-folha (preflight-checks.txt, invocation-canonical.txt, validation-checklist.txt, anti-framing-directive.txt, templates) JÁ estão corretamente single-sourced sob `skills/shared/codex-bridge-assets/` (12 arquivos confirmados) e referenciados via `{{ASSETS_PATH}}`. O que NÃO está single-sourced é a **prosa-wrapper dos 11-12 passos**.
  2. **Contrato Mode-2 de `implement`:** é a EXECUTION lane (Opus planeja / Codex codifica) de `skills/shared/mode2-codex-lane.md`, conceito DIFERENTE do REVIEW lane dos dois reviews. `review-code`/`review-plan` NÃO duplicam mode2-codex-lane.md — não confundir.
- **UM fix compartilhado:** extrair o esqueleto comum de orquestração (os passos byte-idênticos: pre-flight, invocation, ambas validations, persistence, triage) para um novo asset `skills/shared/codex-bridge-assets/envelope-orchestration.md`. Deixar em cada review só os deltas artefato-específicos (review-code: `CAPTURED_DIFF` + `pass1-briefing-template-code.txt` + smoke-test diff byte-idêntico; review-plan: `plan_path` + `pass1-briefing-template-plan.txt` + construção do composite-artifact de initiative). O sub-flow só roda em modo `codex`/`both`, então o esqueleto vira leitura lazy uma-vez-por-run-codex em vez de residente nos DOIS corpos a cada turno. Para `implement`, o fix Mode-2 (já no companion) é independente: referenciar `mode2-codex-lane.md` em vez de inline.

### Padrão 3 — Verifier-execution patterns re-derivados inline apesar do ponteiro ao single-source

- **Skills afetadas (1 confirmada):** verify-claim (320). (`implement` também consome o executor; já tratado no companion.)
- **Total somado:** **~320 tok**.
- **Diagnóstico:** `verify-claim.md:28` diz corretamente "Follow the canonical Verifier execution patterns in project-transitions.md — the one shared executor; do not re-implement or diverge from it." e então `verify-claim.md:29` (~770 chars) **re-implementa esse exato spec inline**: a regra PASS por-kind (shell=`exitCode==expectExitCode`; test=`exit0 AND testsCollected>0`) e o detalhe de parse "vitest/jest/node all exit 0 on empty selection" — tudo já verbatim em `project-transitions.md:187/:224`. Mesma classe da dup Mode-2.
- **UM fix compartilhado:** **regra de repositório** — quando um corpo já cita um single-source pelo nome, ele NÃO pode re-derivar o conteúdo desse source na linha seguinte; colapsar ao verdict-shape + ponteiro. Aplicar a verify-claim:29 (e auditar qualquer outra skill que cite project-transitions.md / code-quality-gates.md e depois reafirme o conteúdo).

### Padrão 4 — Gates code-quality (G1-G7) parafraseados inline contra o single-source que pede injeção por referência

- **Skills afetadas (4):** brainstorm (110), hunt (240), fix (230, parcial via self-review template), review-code (400).
- **Total somado:** **~980 tok**.
- **Diagnóstico:** `docs/kb/code-quality-gates.md:5` prescreve explicitamente o oposto: "Skills inject the rules they care about by reference (e.g. See G3 + G4 in docs/kb/code-quality-gates.md). Update this file once and the propagation is automatic." Mesmo assim, brainstorm (L86-88), hunt (L298-320), fix (L161-185, com lista de gates enumerada DUAS vezes — defs + template self-review) e review-code (L389-415) parafraseiam G1/G2/G3/G4/G6/G7 inline. brainstorm cita o source DUAS linhas acima (L84) e ainda re-descreve cada gate.
- **UM fix compartilhado:** substituir as paráfrases de regra por o one-liner que o próprio gates.md prescreve ("Bound by G1/G3/G4 in docs/kb/code-quality-gates.md — read them before writing assertions"), mantendo só o framing skill-específico e o bloco de self-review onde ele realmente molda a saída. Remove drift-risk do single-source.

### Padrão 5 — Templates/scaffolds emit-time residentes (pagos a cada turno, usados uma vez no fim)

- **Skills afetadas (3):** parallel-dispatch (1.000 — Phase 3 prompt skeleton + Phase 4 plan-file template), parallel-dispatch-audit (200 — report fields 3x), review-plan (250 — Closing template) + review-code (Closing near-idêntico).
- **Total somado:** **~1.450 tok**.
- **Diagnóstico:** scaffolds de WRITE-time (skeleton de prompt, template de plan-file, template de Closing summary) não são gatilhos ambiente — disparam uma vez, no momento de emitir o artefato — mas são re-pagos residentes a cada turno. Em parallel-dispatch são ~4.620 chars (~1.155 tok) de puro scaffold. O report de parallel-dispatch-audit lista os mesmos campos 3 vezes (Phase 5 template + Phase 6 chat summary + Closing Report; este último totalmente subsumido por Phase 6).
- **UM fix compartilhado:** mover scaffolds emit-time para assets lazy (`<skill>-assets/templates.md`), com ponteiro de 1 linha no passo de emissão; o modelo lê no momento exato em que precisa do literal. Para reports enumerados 3x, eleger UMA spec canônica (a chat-summary) e deletar as redundantes.

### Padrão 6 — worktree-isolation: ponteiro AUSENTE (gap de wiring, não bloat)

- **Skills afetadas (1):** parallel-dispatch (custo de token ~0 — ADICIONA ponteiro).
- **Total somado:** **~0 tok** (correção de correção, não economia).
- **Diagnóstico:** `parallel-dispatch.md:212-220` enumera exatamente a classe de colisão (lockfiles, build dirs, root config) que `skills/shared/worktree-isolation.md:70` declara existir para resolver ("offer a per-agent worktree when dispatched tasks share a lockfile, build dir, or root config"), mas o corpo só oferece "serialize or accept the collision risk" e nunca nomeia o helper. NÃO há prosa de worktree-isolation inlinada em nenhuma skill (grep confirmou zero hits em parallel-dispatch, debate, hunt, fix).
- **UM fix compartilhado:** adicionar a terceira opção de remédio em `parallel-dispatch.md:220` ("or give the colliding tasks a per-agent worktree — skills/shared/worktree-isolation.md"). Behavior-preserving, custo near-zero.

### Padrão 7 — debug-techniques re-derivado inline (raro)

- **Skills afetadas (1):** fix (110 — boundary instrumentation paragraph).
- **Total somado:** **~110 tok**.
- **Diagnóstico:** `fix.md:47` cita `debug-techniques.md §2` e então re-deriva o mecanismo in/out-boundary + a regra "remove before commit" que já está verbatim em §2 (L25, L31). Bom notar: hunt, parallel-dispatch, debate, verify-claim NÃO inlinam debug-techniques (grep = zero). É um caso isolado, não sistêmico.
- **UM fix compartilhado:** reduzir a L47 ao gatilho + regra de uma linha + ponteiro; deixar §2 carregar o how-to.

---

## Achados por skill

### Já enxutas (uma linha cada — sem ação)

- **prompt** — já enxuta, ~1.108 tok, sem ação. As duas seções `## Red Flags` operam em camadas diferentes (uma é placeholder de template no OUTPUT em L72-83; a outra é gatilho ambiente em L112-130) — não é duplicação. Único item: Step 5 opcional (~110 tok) troca indireto por um invariante load-bearing de isolamento de subagent — NÃO vale.
- **save-and-push** — já enxuta, ~1.188 tok, sem ação. Tem Red Flags mas NÃO tem Rationalization (já é a forma-alvo: 9 gatilhos one-liner + uma refutação coletiva). Zero referências a shared-assets; procedimento linear single-mode. Único item: micro-tighten cosmético de ~80 tok que se RECOMENDA NÃO fazer (a redundância é load-bearing sob pressão).

### Com desperdício (detalhe)

**review-code (3.050 tok) — body 6.281**
- Blocos mode-gated residentes em TODO modo (~800): Local review agent (L245-305, modes local/both) e Codex sub-flow (L307-381, modes codex/both) — um run `--mode=local` paga ~875 tok do bloco codex que nunca usa, e vice-versa. → mover para `local-review-assets/` e o `codex-review-subflow.md` shared.
- Contrato de captura de diff com dois branches mutuamente exclusivos residentes (~800): Scope resolution (L64-101, keyword/empty) XOR Ref validation (L103-159, ref explícito; o maior bloco contíguo do corpo, ~1.014 tok). O próprio corpo diz a exclusividade (L95 "skip ref-validation steps 1-3 and 5"). → mover ambos branches para `local-review-assets/diff-capture.md`.
- Sub-flow codex near-dup com review-plan (~700) — ver Padrão 2.
- Red Flags + Rationalization triplicam Iron Law/Mindset (~350) — ver Padrão 1.
- Gates G1-G7 + self-review residentes mas só usados no triage/fix (~400) — ver Padrão 4.

**review-plan (2.700 tok) — body 7.733**
- Sub-flow codex de 11 passos (L331-441, ~1.506 tok) branch-only (só roda em `codex`/`both`; o default `local` forçado por project-plan/project-status nunca o toca) E near-dup com review-code (L307-380) (~1.100) — ver Padrão 2.
- Step 0c initiative-discovery (L145-204) + checks 14-20 (L271-305) + composite-artifact (L360-380) branch-only (~900): para planos standalone/flat ou `--no-initiatives`, ~1.500 tok nunca exercitados. → `project-assets/plan-initiative-depth.md`. Manter residente só o gate "Skip if --no-initiatives" + o HARD-GATE de initiative (L193-204, never-edit ambiente).
- Red Flags (18 bullets) + Rationalization (17 rows) reafirmam as mesmas disciplinas (~450) — ver Padrão 1.
- Closing summary template verboso (L528-560, ~418 tok), renderizado uma vez no fim (~250) — ver Padrão 5.

**hunt (1.640 tok) — body 4.174**
- Phase 0 directory-triage (L30-115, ~1.006 tok) + Phase 7 consolidated report (L268-296) são resident-bloat no caso comum single-file/function (o próprio Iron Law L8-9 declara o escopo canônico "one class or one public function") (~900). → `hunt-assets/directory-triage.md` com ponteiro de 2 linhas em L30.
- Red Flags + Rationalization reafirmam ~7 regras duas vezes (tautologia uma 3ª via HARD-GATE) (~300) — ver Padrão 1.
- Gates G1/G3/G4 parafraseados em vez de injetados por referência (~240) — ver Padrão 4.
- Convention-detection duplicada entre Phase 0d (L81-86) e Phase 5 (L198-204) (~120). → definir uma vez na Phase 5 residente.

**parallel-dispatch (1.640 tok) — body 3.860**
- Phase 3 prompt skeleton (L143-175) + Phase 4 plan-file template (L190-266) = ~4.620 chars (~1.155 tok) de scaffold emit-time residente (~1.000) — ver Padrão 5. → `parallel-dispatch-assets/templates.md`.
- Red Flags + Rationalization (L294-325) duplicam ~7 regras 1:1, várias também restated nas Phases (git add -A aparece 4x: L163, L168, L300, L317) (~280) — ver Padrão 1.
- Shared-state warnings (L212-220): ponteiro AUSENTE para worktree-isolation (~0) — ver Padrão 6.

**fix (1.430 tok) — body 3.576**
- Red Flags (L142-159) + Rationalization (L187-203) near-1:1 (~545) — ver Padrão 1.
- Phase 3g circuit-breaker prose over-explica e é restated nas duas tabelas (L122-130 prose + L154 RF + L200-201 Rat) (~320). → comprimir Phase 3g à regra + def do counter + alvo de escalação; mover o argumento "reset-the-counter dodge" para debug-techniques.md §3.
- Self-review template re-enumera os gates G1-G7 como fill-in block (L172-185) já definidos em L161-170 (~230) — ver Padrão 4.
- Boundary-instrumentation paragraph re-deriva debug-techniques §2 (L47) (~110) — ver Padrão 7.

**verify-claim (1.190 tok) — body 2.734**
- Red Flags + Rationalization reafirmam 8 regras já em Mindset/Iron Law/gate-function (cobertura tripla-a-quíntupla; 0-count aparece 5x) (~530) — ver Padrão 1. → deletar a tabela Rationalization inteira (cada linha duplica um RF ou clause do gate-function); manter os gatilhos one-liner.
- Gate-function step 4 re-deriva a PASS rule + 3 false-greens já no project-transitions.md que o step 3 aponta (L28 aponta, L29 re-implementa) (~320) — ver Padrão 3.
- Claim→evidence table sobrepõe parcialmente as regras em prosa; mmost load-bearing — trim menor da recap L43 + linha "task is done" (~120).
- Self-review checkpoint (L49-67): residente apropriado (gate ambiente) — NÃO mover.

**brainstorm (1.180 tok) — body 3.681**
- Red Flags (L102-116) + Rationalization (L118-131) = as mesmas 8 regras duas vezes = 37% do corpo (~700) — ver Padrão 1. → colapsar numa tabela única trigger-led.
- G1/G2/G6 restated inline apesar de citar gates.md duas linhas acima (L84 cita, L86-88 re-descreve) (~110) — ver Padrão 4.
- Mindset (L16-22) re-afirma a rationale que B0/B2/B4 já carregam (~130) — judgment-call, manter se maintainers valorizam orientação.

**debate (1.180 tok) — body 4.113**
- Gate-mode block (L222-274, ~667 tok) residente mas só dispara sob `--gate` opt-in (~600) — ver Padrão 5 (variante: bloco mode-gated, não template). → `debate-assets/gate-mode.md`, ponteiro de 3 linhas. É a skill MAIS LIMPA no eixo cross-skill-dup (inlina NENHUM shared single-source — grep mode2/codex-bridge/worktree/debug = zero).
- "Why this matters" (L36-43) é motivação redundante do spawn-don't-roleplay já no Iron Law (~110) — deletar.
- Red Flags + Rationalization + overlap entre as duas tabelas (L295-324) (~320) — ver Padrão 1.
- "Where this fits" (L276-286) duplica os handoff targets já no Synthesis Handoff bullet (L213-216) (~150).

**init-memory (560 tok) — body 2.149**
- Step 5 Connect (L111-155) + Critical Context (L12-33) branch-only/reference, ~2.478 chars residentes mas exercitados uma vez no fim (~430). → split router + `_assets/connect-claude-code.md`. Médio-esforço: módulo é flat, sem scaffold de asset ainda. Zero cross-skill dup (grep mode2/codex/worktree = zero; autoMemoryDirectory só aparece aqui).
- Red Flags + Rationalization: 3 rows overlap (~130) — ver Padrão 1 (overlap parcial, só ~14% do corpo).

**parallel-dispatch-audit (560 tok) — body 3.012**
- Rationalization Table 1:1 com Red Flags (refutação é o único net-new) (~250) — ver Padrão 1.
- Campos do report enumerados 3x: Phase 5 template + Phase 6 chat summary + `## Closing Report` (Closing totalmente subsumido por Phase 6) (~200) — ver Padrão 5. → deletar Closing Report.
- Phase 4 memory-consolidation block residente mas só aplica quando o batch teve memory task (~110). → ponteiro + asset lazy.
- Degraded-mode/active-batch restatements (L5/L46-54/L12-14/L77-78): falsa-economia, NÃO mexer (gate ambiente + reference correto).

---

## Plano priorizado

### Fase A — fixes globais transversais (maior alavanca: um fix limpa N skills)

1. **Padrão 1 — desmontar o imposto Red Flags/Rationalization (~5.715 tok em 11 skills, +2.955 com implement).** UMA passada de repositório: manter só os gatilhos one-liner de Red Flags residentes; deletar/lazy-ar a tabela Rationalization quando ela só reafirma RF + Process. Maior ROI absoluto do repo. Em `verify-claim` e `brainstorm` é deleção quase-total da segunda tabela.
2. **Padrão 2 — extrair `codex-bridge-assets/envelope-orchestration.md` (~1.800 tok em review-code + review-plan).** Single-source o esqueleto de 11-12 passos; deixar só os deltas artefato-específicos. Limpa as DUAS maiores skills de uma vez.
3. **Padrão 5 — scaffolds emit-time → assets lazy (~1.450 tok em 3 skills).** templates.md por skill + deletar reports enumerados em duplicata.
4. **Padrão 4 — gates G1-G7 por referência, não paráfrase (~980 tok em 4 skills).** Aplicar o one-liner que gates.md já prescreve; remove drift-risk.
5. **Padrão 3 — colapsar re-derivações de single-source citado (~320 tok, verify-claim:29).** + regra de repo: corpo que cita um source não re-deriva seu conteúdo.
6. **Padrão 7 — fix.md:47 boundary → ponteiro (~110 tok).** Isolado.
7. **Padrão 6 — adicionar ponteiro worktree em parallel-dispatch:220 (~0 tok, correção de wiring).**

### Fase B — movimentos per-skill restantes (após os globais)

- **review-code / review-plan:** mover blocos mode-gated (local/codex) e branches de diff-capture / initiative-depth para assets lazy (carrega só o branch que roda). ~1.700 tok combinados além do Padrão 2.
- **hunt:** Phase 0 directory-triage → `hunt-assets/directory-triage.md` (~900); unificar convention-detection (~120).
- **parallel-dispatch:** Phase 3+4 templates → asset (~1.000, dentro do Padrão 5).
- **debate:** gate-mode → asset (~600); deletar "Why this matters" (~110); colapsar "Where this fits" (~150).
- **init-memory:** introduzir scaffold router+asset e mover Step 5 + Critical Context (~430) — médio-esforço.
- **parallel-dispatch-audit:** deletar `## Closing Report` (~200); Phase 4 memory → lazy (~110).

---

## O que NÃO fazer (falsa economia)

1. **NÃO otimizar skills pequenas já enxutas.** `prompt` (~1.108 tok) e `save-and-push` (~1.188 tok) não têm dup de Rationalization, nem shared-asset inlinado, nem branches mode-gated. O único item de cada (Step 5 opcional; micro-tighten do grouping) troca indireto por invariantes load-bearing ou aceita perder redundância útil sob pressão. **Deixar intactas.** Não inventar trabalho.
2. **NÃO mover gatilhos ambiente para lazy.** Iron Laws, HARD-GATEs, Mindset, e os one-liner de Red Flags devem disparar da conversa a cada turno. Eles são a parte residente CORRETA. Em toda recomendação acima, só a coluna de refutação/o branch não-tomado/o scaffold emit-time saem — nunca o gatilho.
3. **NÃO recolapsar lazy de volta para residente.** O envelope codex já delega os assets-folha corretamente (12 arquivos em codex-bridge-assets/); brainstorm referencia critic.md/code-quality-gates.md por ponteiro; review-plan delega o envelope mechanics. Esses padrões já-corretos devem ser preservados e estendidos, não revertidos.
4. **NÃO trocar script determinístico por raciocínio LLM.** O shape-detection do diff (triple-dot, SINGLE-vs-RANGE), o base-picker, o algoritmo de initiative-discovery, e o executor de verifier são determinísticos — ao mover para lazy, mover o ALGORITMO intacto, não substituí-lo por "o modelo decide". O ganho é onde o detalhe é pago, não o que ele faz.
5. **Casos deliberadamente deixados intactos** (examinados e descartados): parallel-dispatch-audit degraded-mode/active-batch (gate ambiente + reference correto, est. 0); verify-claim self-review checkpoint (gate ambiente, est. 0); prompt as duas `## Red Flags` (camadas diferentes, não dup); brainstorm Mindset (judgment-call, baixo valor mas pode aidar orientação).
