# Reestruturação das skills atomic-skills — design

Consolida quatro frentes levantadas por auditoria nesta sessão: (1) pente fino de
consistência das skills `project`+`implement`, (2) economia de tokens da arquitetura
(corpos que recongestionaram a camada resident), (3) a feature `project review` que
faltava (auditar plano/iniciativa materializados), e (4) uma skill nova `design-brief`
que gera os prompts (DS + telas) para o claude.ai/design sem contaminar a decisão
visual. Fontes em disco: `docs/audits/project-implement-audit-2026-06-15.md` e
`docs/audits/token-economy-all-skills-2026-06-15.md`. Para a F5, a spec canônica da
anti-contaminação é `docs/design/design-brief-three-layer-briefing.md` (post-mortem do
dogfooding Lekto, vendorizado verbatim — modelo de 3 camadas + R1–R9 + exemplo-ouro).

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
  auto-detecta código existente + plano `project`, **minerando do código os parâmetros
  comportamentais** (timers/debounces, contagens, comprimentos, modalidade, gatilhos,
  o-que-fica-oculto — R2) e completando lacunas via **auditoria de omissão interativa** (R3)
  com o operador; estratégia = **DS-first + telas
  consomem o DS herdado** (mecanismo confirmado: herança automática, export carrega cópia,
  consume-não-redeclara); **1 template no DS** (não um set — templates compostos pelo DS
  são inferiores aos do projeto consumidor); skill nasce enxuta (corpo fino + assets lazy,
  sem imposto Red Flags/Rationalization).
- **D5 — Anti-contaminação = modelo de 3 camadas + R1–R9 (spec canônica).** Reformula o D5
  anterior (que era só "vocabulário-banido + silêncio sobre o visual") à luz do post-mortem
  Lekto (`docs/design/design-brief-three-layer-briefing.md`): a falha real **não** foi
  prescrever visual demais — foi **estender o silêncio às camadas 2 e 3**. Três camadas, donos
  distintos: (1) **forma visual** (cor, raio, sombra, qual widget, espaçamento, tipografia) →
  designer → **silêncio**; (2) **modelo de interação** (ritmo/tempos, contagens, comprimentos,
  modalidade, gatilhos, reversibilidade, paridade mobile/desktop) → produto → **especificar
  concreto**; (3) **filosofia / quem decide** (humano × sistema, o que fica oculto) → produto →
  **guardrail vinculante**. Consequência: o vocabulário-banido vem **emparelhado** com blocos
  *obrigatórios* de **Modelo de interação** e **Filosofia/guardrails** por tela (R1), descritos
  por atributos de comportamento e nunca por widget (R4); ao des-induzir um rótulo
  **substitui-se pela essência, jamais se deleta** (R7 — a armadilha da sobre-correção).
  Permanecem do D5 anterior: tabela DEFINE/DECIDE, checklist de pré-envio e "requisito visual →
  constraint verificável (WCAG 2.2 mensurável), nunca solução visual". Acrescentam-se a
  **auditoria de omissão por tela** (R3: *"se eu omitir este parâmetro, um agente razoável
  preencheria com algo que contradiz o produto?"* — se sim, declare-o) e o **nomear o
  anti-padrão proibido** nas telas de risco (R6). Spec integral (R1–R9, estrutura obrigatória
  por tela, exemplo-ouro e checklist de aceitação) no briefing vendorizado citado acima — a
  porta a evitar é **abstrair o detalhe load-bearing** ao portá-lo para os assets.
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
- **Não regredir à subespecificação** (a falha do post-mortem): o silêncio vale **só** para a
  camada 1 (forma visual); nunca apagar comportamento ou filosofia "para não induzir". Ao
  des-induzir um widget/gesto, substituir pela essência comportamental (R7); abstrair o
  parâmetro load-bearing ("uma escala curta" no lugar de "~3 níveis; ritmo de segundos; ~8s")
  é a própria falha que a skill existe para evitar (R2). Lekto/FSRS é **só exemplo-ouro** — o
  modelo de 3 camadas e R1–R9 ficam codificados de forma agnóstica.

## Blast radius

- **Alto:** F1 mexe em `project.md`/`implement.md`/`project-transitions.md` — carregados em
  toda invocação. Mitigação: `validate-skills`, `tests/install-uninstall-roundtrip.test.js`,
  e preservação de comportamento por skill (mover, não reescrever a semântica).
- **Médio:** F2/F3 tocam muitas skills com uma receita repetida — risco de aplicação
  inconsistente; mitigação: verifier por skill + detector de regressão de padrão.
- **Baixo:** F0 (doc), F4 (subcomando aditivo), F5 (skill nova) — não alteram caminhos
  existentes.
