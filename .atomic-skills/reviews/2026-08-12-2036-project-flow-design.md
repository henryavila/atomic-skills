---
date: 2026-08-12T20:36:49Z
topic: project-flow-design
artifact: docs/design/project-flow/design.md
skill: review-plan
reviewer: grok-4.6
provider: local
provider_version: ""
same_family_remap: false
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 2, major: 5, minor: 2, nit: 0}
counts_blind: {}
framing_delta: {}
schema_version: "1.1"
external_leg: aborted
external_abort_reason: "Working tree dirty (Codex #8404). No --allow-dirty. Codex CLI present (0.145.0)."
---

# Review — project-flow-design

**Mode:** both (local → Codex default). Picker recusado; default da skill.
**Alvo:** `docs/design/project-flow/design.md` (não é plan.md materializado; sem `## Reviews` no arquivo).
**Perna externa:** ABORT — árvore suja; sem `--allow-dirty`.

## Local fix log

Aplicado no design/HANDOFF nesta sessão (não no briefing externo):

- D1: `actors[]` na raiz (dogfood), não dentro de `graph`.
- Chosen approach: tirou “stage” do padrão de produto.
- D6: ratify via `project flow`, não stage de criação.
- D7: `process.yaml` não cumpre detector (não “P1”).
- Surface + PR1: path canônico `scripts/lib/validate-flow.js` + `tests/validate-flow.test.js`.
- PR3 touches: `CREATION_STAGES`, testes, stage-7/8/9, adopt; remap mid-creation `process-map` → `reviews`.
- PR4 touches: `assert-automate-gate` JS, antipatterns; texto P1 só na PR4.
- Q5 morta com journey. Q6–Q8 escaladas.
- D4/D1: `states` só se a chave existir (Q7 default).
- Blast radius: remap, não skip ilegal.
- HANDOFF: PR3 remap; Iron Law texto = PR4.

## Findings remaining (escalated)

### C1 — Q6 scope do gate (critical)

`implement` roda em 1-phase e foreign. D4 diz “multi-phase qualquer”. PR4 sem default silencioso.

### C2 — Q8 artefato não prova AskUserQuestion (critical)

`ratifiedAt` + sha são forjáveis em disco. Mesma classe do ground-truth, ou receipt extra?

### M1–M5 applied (see fix log)

CREATION_STAGES omitido; actors vs graph; leftovers de stage; PR1 path ambíguo; stage-8 precondition.

### m1 G6

Design não usa `verified_by:` / `unverified:` nas asserções.

### m2 HANDOFF Origem

Ainda descreve só a sessão noite; override do implement-gate não está no bloco Origem.

## Self-review against code-quality gates

- G1 read-before-claim: ran grep/list_dir nos paths citados; premissas de existência confirmadas (`src/app-map/validate.js`, `scripts/creation-gates.js:38-49`, `tests/creation-gates.test.js:32-44`, `stage-8.md:8`, dogfood `actors` raiz L6–11 + `entry` topo L11). 0 phantoms nos arquivos que o plano *lê*. Arquivos que o plano *cria* (validate-flow, flow.schema) ausentes — esperado.
- G2 soft-language: ban-list EN 0 hits. PT “pode” em D4/D7 é permissão de produto, não hedge.
- G6 reference-or-strike: 0 `verified_by:` / `unverified:` no design (bare assertions). Finding m1.
- Initiative-depth: N/A (sem `phases:` no frontmatter).
- Ground-truth: N/A — arquivo não materializado. Flow E não correu.
