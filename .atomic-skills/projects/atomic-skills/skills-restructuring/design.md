# Reestruturação das skills atomic-skills — design

Consolida quatro frentes levantadas por auditoria nesta sessão: (1) pente fino de
consistência das skills `project`+`implement`, (2) economia de tokens da arquitetura
(corpos que recongestionaram a camada resident), (3) a feature `project review` que
faltava (auditar plano/iniciativa materializados), e (4) uma skill nova `design-brief`
que gera os prompts (DS + telas) para o claude.ai/design sem contaminar a decisão
visual. Fontes em disco: `docs/audits/project-implement-audit-2026-06-15.md` e
`docs/audits/token-economy-all-skills-2026-06-15.md`.

## Contexto

As skills cresceram e dois riscos se materializaram: drift de single-source-of-truth
(contratos reescritos em vários arquivos divergem — ex. cláusula schema-default do
Mode-2 em só uma cópia) e bloat da camada sempre-resident (≈71% do router `project.md`
é bloco resident; 44% do `implement.md` é Red Flags/Rationalization). A auditoria
quantificou ~21.7k tokens recuperáveis sem mudar comportamento. Em paralelo, o fluxo de
design (claude.ai/design) carecia de um gerador de prompts disciplinado, e a `review-plan`
não auditava planos materializados do `project` contra spec/estrutura/código.

## Decisions

- **D1 — Um plano multi-fase de 6 fases (F0–F5).** Pente fino (F0) e economia
  project/implement (F1) separados da economia transversal (F2) e per-skill (F3);
  feature `project review` (F4); skill `design-brief` (F5).
- **D2 — Correções de cheat-sheet (M3/M4/L4) são tasks próprias da F0**, não dependentes
  da P1 (que apenas as *realoca* se rodar). Sobrevivem em qualquer cenário (catch 1).
- **D3 — Dependência cross-fase F3 → F1.** O `verifier-exec.md` compartilhado nasce na
  F1/P4; a F3 (verify-claim aponta pra ele) depende disso (catch 2).
- **D4 — `design-brief`:** saída = prompts markdown (casa com o handoff atual); fonte =
  auto-detecta código existente + plano `project`; estratégia = **DS-first + telas
  consomem o DS herdado** (mecanismo confirmado: herança automática, export carrega cópia,
  consume-não-redeclara); **1 template no DS** (não um set — templates compostos pelo DS
  são inferiores aos do projeto consumidor); skill nasce enxuta (corpo fino + assets lazy,
  sem imposto Red Flags/Rationalization).
- **D5 — Anti-contaminação é o coração da `design-brief`:** preâmbulo de vocabulário-banido
  embutido no brief + tabela DEFINE/DECIDE + checklist de pré-envio; requisito visual vira
  constraint verificável (WCAG 2.2 mensurável), nunca solução visual.
- **D6 — Execução do plano via codex (Mode 2) + review Opus.** Opus planeja+revisa; Codex
  executa tasks spec-ready com verifier determinístico em worktree isolado.

## Chosen approach

Materializar via `atomic-skills:project new plan` com os gates do próprio fluxo
(design.md lint-clean → No-Placeholders → SPEC por-task → validação de summaries →
review). Sequência de execução por risco: começar pela F0 (doc, baixo risco, verifiers
grep), depois F1 (estrutural nos corpos quentes, com `npm run validate-skills` + o teste
de round-trip install/uninstall como rede), depois F2/F3 (transversais e per-skill, uma
receita por padrão aplicada a N skills), e F4/F5 (aditivos — subcomando novo e skill nova,
baixo blast radius). Cada task carrega `Files`/`scopeBoundary`/`acceptance`/`verifier`
determinístico; a maioria das correções tem verifier `kind: shell` (grep) e as novas
skills/assets verificam por `validate-skills` + existência/lint. Cada padrão transversal
é uma receita única aplicada repetidamente, preservando o single-source que a auditoria
elogiou (não inlinar de volta).

## Guardrails (o que NÃO quebrar)

- Preservar GATE-R2 determinístico (não trocar por LLM-judge); não inlinar o executor de
  verifier centralizado; manter gatilhos ambiente (Iron Laws, gates, emergence ladder)
  resident; lazy-load não recolapsa para o corpo.
- Ao tornar conteúdo lazy, mover o **algoritmo determinístico intacto** — nunca substituir
  por "o modelo decide".
- **Não otimizar `prompt` e `save-and-push`** — já enxutas; mexer só piora.
- `design-brief` nunca hardcoda nomes de componentes de um projeto (TabBar/Sidebar do Lekto
  eram referência) — templates por papel/arquétipo, derivados da IA de cada projeto.

## Blast radius

- **Alto:** F1 mexe em `project.md`/`implement.md`/`project-transitions.md` — carregados em
  toda invocação. Mitigação: `validate-skills`, `tests/install-uninstall-roundtrip.test.js`,
  e preservação de comportamento por skill (mover, não reescrever a semântica).
- **Médio:** F2/F3 tocam muitas skills com uma receita repetida — risco de aplicação
  inconsistente; mitigação: verifier por skill + detector de regressão de padrão.
- **Baixo:** F0 (doc), F4 (subcomando aditivo), F5 (skill nova) — não alteram caminhos
  existentes.
