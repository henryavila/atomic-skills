# Pesquisa: qualidade de plano antes do código + prevenção de anti-patterns

> Pesquisa de landscape que fundamenta (e contrasta contra) o `design.md` desta
> iniciativa (`phase-materialization`). Gerada por deep-research harness em
> 2026-06-28. Fontes majoritariamente primárias; claims adversarialmente
> verificados (3-voto, mata com 2/3 refutações).

## Metodologia / estatísticas

- 5 ângulos de busca · 25 fontes fetched · 123 claims extraídos · 25 verificados
- **20 confirmados, 5 refutados** · 107 chamadas de agente
- Caveats explícitos na seção própria (especialmente: SDD é doutrina, não prova
  empírica; self-correction tem limites).

**Caveats de metodologia (adicionados pela Revisão adversarial 2026-06-28):**
- **Default-CONFIRM.** A verificação precisava de 2/3 refutações para *matar* uma
  claim — o ônus caía sobre a refutação. Para um relatório usado para *adicionar
  escopo* a um design, o default honesto seria default-doubt. Sob default-doubt,
  os 2 vote-splits 2-1 (Rust out-of-scope, Amazon TAM) **caem**, e "20
  confirmados" recua para ~10–12.
- **Quórum reduzido por 429.** Durante a verificação, 2 agentes votantes
  falharam com rate-limit (429). O nº de 107 chamadas é matematicamente
  inconsistente com 3-voto × 25 claims + 5 buscas + 25 fetches — logo painéis
  rodaram com quórum reduzido (algumas claims decididas por 1 voto, zero
  cross-check adversarial).
- **Cliff 123→25.** Só 25 das 123 claims extraídas foram verificadas; as 98
  restantes não têm flag de quais são load-bearing. Criticamente, a
  **claim-âncora do veredito (Rolling Wave dissolve a tensão lazy) NÃO estava
  entre as 25 verificadas** — é inferida.

## Os 4 mecanismos recorrentes da prática madura

1. **Non-goals/scope-boundary canônico e quase universal** (Google, Rust,
   HashiCorp). Google distingue *non-goals* de *negated goals* — não é "o sistema
   não deve travar"; é algo que poderia ser goal mas foi deliberadamente
   excluído (ex.: "ACID compliance"). Rust divide em 3 buckets: resolver-no-RFC /
   resolver-na-implementação / explicitamente-out-of-scope-futuro.
2. **Gates de negócio deliberadamente SEPARADOS dos gates estruturais/editoriais.**
   Amazon PR/FAQ enumera 7 perguntas de revisão — **das quais ~4–5 são
   nitidamente de negócio** (cliente definido? problema definido? solução
   endereça o problema? clientes mudariam de comportamento? melhor/mais barato/
   mais rápido?), **1 é híbrida** (TAM/payback — viabilidade de negócio) e **1 é
   de viabilidade técnica/legal** (constraints/resources/technical/legal). A
   *dominância* de perguntas de negócio é real; a frase "6/7 são de negócio" era
   uma sobre-leitura e foi corrigida (ver Revisão adversarial abaixo). KEP separa
   *approvers* (humanos com autoridade) de *editors* (só correções editoriais) e
   **bloqueia provisional→implementable** até aprovação substantiva.
3. **Trade-offs + alternativas descartadas capturados NO artefato.** Google chama
   "Alternatives considered" de "uma das seções mais importantes" (confirmado
   verbatim); **HashiCorp *sugere*** (campo explicitamente **opcional**, verbo
   *"should try"*, não "must") "Abandoned Ideas" **com o porquê** do descarte;
   PEP inclui "Rationale". *(Correção: este relatório dizia antes "HashiCorp
   exige" — falso; a fonte marca como Optional.)*
4. **"Constituição" de qualidade (GitHub SDD).** Princípios arquiteturais
   imutáveis operacionalizados como **"Phase -1: Pre-Implementation Gates"**
   (checklists check/exit), descritos como *"compile-time checks for architectural
   principles"*. Responde direto à preocupação de código sem anti-pattern.

## Contraste contra o design interno (D1–D7)

### Onde o design ACERTA (validado)

| Mecanismo nosso | Validado por |
|---|---|
| D3/D4 — gate de negócio separado do gate de código + hard-block determinístico | Amazon PR/FAQ (gate de negócio) + KEP (aprovação bloqueia avanço) + Zimmermann (DoD arquitetural = 5 critérios falsificáveis, estilo exit-0/1) |
| Coexistir businessIntent (negócio) + SPEC gate (técnico) no mesmo fluxo | KEP combina feature-tracking + PRD + design doc num só arquivo incremental |
| Crítico independente no fluxo de design | Reflexion/Self-Refine (NeurIPS 2023) + padrão producer-critic; Huang et al. ICLR 2024 reforça: crítico EXTERNO > self-critique |
| D1 — materialização lazy | **Rolling Wave Planning (PMI/PMBOK)** + Progressive Elaboration — validam lazy como prática madura de GP, não anti-pattern |

### A tensão "lazy vs upfront" — dissolve-se SÓ PARCIALMENTE (corrigido)

*(Correção da Revisão adversarial: este relatório afirmava antes que a tensão
"se dissolve" via Rolling Wave. Exagero — é argumento por analogia, não prova, e
carrega um erro de categoria parcial.)*

Rolling Wave Planning (PMI) e Progressive Elaboration (PMBOK) são prática madura
de GP, e **validam a decomposição lazy no nível inter-fase**: a fase N+1 é
detalhada com o aprendizado da fase N (é o que o design faz via o gate de
lessons, `project-create-initiative.md:32`). Mas a analogia **para de valer
dentro de uma fase**: Rolling Wave é um PM humano re-planejando continuamente à
medida que chega informação; o design faz **decomposição diferida** — decompõe a
fase UMA VEZ na ativação e depois a congela, sem re-elaboração progressiva do que
já foi materializado. Logo a tensão real (planejamento upfront captura intenção
que a decomposição diferida pode perder **dentro** da fase) **permanece**, e é o
que R5 tenta (imperfeitamente) endereçar.

**Conclusão corrigida:** D1 é razoável e não é risco — decomposição diferida com
aprendizado inter-fase é prática sã. Mas "a tensão se dissolve" era falso; o
honesto é "dissolve-se inter-fase, permanece intra-fase". Esta claim-âncora do
veredito **não estava entre as 25 verificadas** pela pesquisa (ver Caveats de
metodologia).

## GAPS concretos a endereçar no design

1. **`[NEEDS CLARIFICATION]` em vez de a IA adivinhar (SDD).** Em vez de a IA
   *preencher* o `businessIntent` (reintroduz "a IA escolhe errado"), ela deve
   *marcar incertezas* e perguntar. Hoje D3 prevê "perguntas canônicas + cauda
   derivada" — falta explicitar que campos incertos viram marcadores abertos, não
   preenchimento plausível.
2. **Falta non-goals de primeira classe.** Non-goals é o campo **mais universal**
   (3 fontes independentes). O `outOfScope` existe, mas merece (a) virar campo
   obrigatório separado e (b) carregar a distinção "não é negated-goal" do Google.
3. **Falta captura de trade-offs/alternativas descartadas POR FASE.** O `design.md`
   as tem no nível do design, mas o `businessIntent` por fase não. Google/HashiCorp
   tratam isso como prevenção nº 1 de decisão errada.
4. **`value` deve exigir MÚLTIPLOS casos de uso concretos**, não resumo genérico
   (Rust: "several specific use cases"). E distinguir **valor de negócio vs valor
   de cliente** (Opportunity Solution Tree — Torres: produtos amados são
   desligados se não geram valor de negócio). O schema já tem campo `audience` —
   usar.
5. **Gate único vs contínuo.** SDD: *"not as a one-time gate, but as an ongoing
   refinement"*. O D6 dispara só na ativação + implement. Recomendação: re-validar
   o businessIntent em **eventos adicionais** (task mudou de escopo; crítico
   apontou problema; scope-creep detectado).
6. **(código sem anti-pattern) Falta a "constituição" de qualidade.** O plano deve
   **referenciar um catálogo de anti-patterns/standards operacionalizado como gates
   verificáveis pré-implementação** (SDD Phase -1). O SPEC gate valida *a task*
   (Files/verifier), mas não carrega um catálogo de anti-patterns. Hoje os
   anti-patterns vivem espalhados (CLAUDE.md, `.claude/rules/`,
   `implement-antipatterns.md`) — não consolidados como uma "constituição" que o
   gate consulta.
7. **Separar AC (story-level) de DoD (universal).** (AltexSoft.) O `doneWhen` é
   AC-like (por fase); falta um **DoD técnico universal** no nível do projeto (barra
   de qualidade que toda fase herda) — hoje implícito.

### Anti-pattern de plano que a pesquisa nomeia (e que o design mitiga)

"**Delivering Y instead of X**" (age-of-product): PO espera X, devs entregam Y —
atribuído a *backlog muito granular, ausência de Why/What, critérios de aceite
errados, devs sem contato com usuário*. É literalmente o gap original. O
`businessIntent` mitiga o "no Why/What"; a constituição (gap #6) mitiga o resto.

## Recomendações concretas

| # | Mudança | Origem |
|---|---|---|
| R1 | `businessIntent` → IA **marca** `[NEEDS CLARIFICATION]`, não preenche plausível | SDD |
| R2 | `outOfScope` vira campo **obrigatório separado** + distinção non-goal vs negated-goal | Google/Rust/HashiCorp |
| R3 | Adicionar `alternatives` (trade-offs/abandoned) por fase | Google/HashiCorp |
| R4 | `value` exige **≥2 casos de uso concretos** + distinguir business vs customer value | Rust / OST |
| R5 | Re-validação **contínua** em eventos de mudança, não só ativação | SDD |
| R6 | Consolidar anti-patterns num **catálogo "constituição"** que o gate de implementação consulta (SDD Phase -1) | GitHub SDD |
| R7 | DoD **técnico universal** no nível do projeto, herdado por toda fase | AltexSoft / Arch-DoD |

## Veredito (REBAIXADO pela Revisão adversarial 2026-06-28)

O núcleo do design (gate de negócio separado + hard-block determinístico +
coexistência negócio/técnico + decomposição diferida + crítico externo) é
**plausível e alinhado à doutrina madura — NÃO validado empiricamente**. A versão
anterior deste relatório dizia "validado pela prática madura"; isso era
aggregation over-reach sobre confirmações parciais (5 dos 5 pilares do veredito
têm qualificação fraca: gate de negócio em margem 2-1; hard-block KEP numa claim
refutada; lazy numa claim-âncora não-verificada + analogia; crítico externo
transferred de benchmarks de raciocínio fechado).

Os 7 itens (R1–R7) são **adições plausíveis**, não invalidações — mas 4 delas
estão esticadas ou mal aterrissadas (ver Revisão adversarial: R1 redundante, R3
escopo-errado, R5/R6 sem mecanismo) e foram **re-escalonadas**. A pesquisa também
**deixou de trazer 2 achados de design que superam em valor qualquer R**: (a)
**proof-of-work** contra rubber-stamp/sycophancy — "usuário valida" é
validation-theatre sem obrigação de *escrever* o valor; (b) **zero evidência
empírica de ROI** do gate exato proposto → tratar como hipótese instrumentável.

## Caveats honestos

- **SDD é doutrina, não prova empírica**: há críticas reais ("Reinvented
  Waterfall", reports de código pior, spec drift cumulativo, Discussion #1671). As
  claims sobre SDD descrevem o que a metodologia *proclama*, não o que *entrega*.
  → Não tratar SDD como prova de que funciona; usar só os mecanismos
  transplantáveis (marcadores, constituição, separação de nível).
- **Self-correction tem limites**: Self-Refine ~20% é média com alta variância
  (5–40%); Huang et al. (ICLR 2024, "LLMs Cannot Self-Correct Reasoning Yet")
  mostra que self-correction falha sem feedback externo. → Reforça que **crítico
  independente externo (que já temos) é mais robusto** que auto-validação.
  *(Adendo da Revisão adversarial: regime-mismatch — Self-Refine/Huang medem
  raciocínio fechado com ground-truth (GSM8K/CommonsenseQA); a conclusão "crítico
  externo > self-critique" é consistente com a intuição para design, mas NÃO é
  prova direta, pois crítica de design é espaço aberto com ground-truth difuso.)*
- **Claims com vote split** (Rust out-of-scope 2-1, Amazon TAM 2-1) sobreviveram
  mas com 1 dissidente — interpretar com cuidado.
- **5 claims refutadas** (transparência): Amazon "meses upfront" (overreach, 1-2);
  KEP "precisely defined schema" (0-3); PEP "Motivation must justify inadequacy"
  (1-2); PEP "Rejected Ideas required" (0-3 — na verdade PEP não exige); PR/FAQ
  "must articulate out-of-scope" (1-2). Isso indica que **nem todo processo maduro
  exige todos os campos**; PEP é mais permissivo que Rust/Google.

## Fontes (qualidade · ângulo)

Primárias: [Google design docs](https://www.industrialempathy.com/posts/design-docs-at-google/) · [Amazon PR/FAQ](https://workingbackwards.com/resources/working-backwards-pr-faq/) · [Rust RFC template](https://github.com/rust-lang/rfcs/blob/master/0000-template.md) · [Kubernetes KEP](https://github.com/kubernetes/enhancements/blob/master/keps/sig-architecture/0000-kep-process/README.md) · [HashiCorp RFC template](https://www.hashicorp.com/en/how-hashicorp-works/articles/rfc-template) · [GitHub Spec Kit / SDD](https://github.com/github/spec-kit/blob/main/spec-driven.md) · [Reflexion (NeurIPS'23)](https://arxiv.org/abs/2303.11366) · [Self-Refine (NeurIPS'23)](https://arxiv.org/abs/2303.17651) · [INVEST (Bill Wake)](https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/) · [BDD (Dan North)](https://dannorth.net/blog/introducing-bdd/) · [Rolling Wave (PMI)](https://www.pmi.org/learning/library/rolling-wave-approach-project-management-10514) · [ADR — Nygard](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md) · [Architectural DoD (Zimmermann)](https://ozimmer.ch/practices/2020/05/22/ADDefinitionOfDone.html)

Secundárias/blog: [GitHub blog — spec-driven dev](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) · [Microsoft — spec-kit](https://developer.microsoft.com/blog/spec-driven-development-spec-kit) · [Producer-critic pattern](https://agentic-design.ai/patterns/reflection/producer-critic) · [Opportunity Solution Tree (Torres)](https://www.producttalk.org/opportunity-solution-trees/) · [AC vs DoD (AltexSoft)](https://www.altexsoft.com/blog/acceptance-criteria-definition-of-done/) · [Sprint anti-patterns](https://age-of-product.com/sprint-anti-patterns-2/) · [Progressive elaboration (PMBOK)](https://www.projectmanagement.com/wikis/295452/progressive-elaboration)

## Revisão adversarial (2026-06-28)

Antes de dobrar R1–R7 num design, a pesquisa e seu uso foram submetidos a **4
críticos independentes e hostéis** (fact-check de fontes, auditoria de
metodologia, crítica de uso/super- reliance, crítica de completude). Achados que
mudaram este documento:

**Correções factuais (já aplicadas acima):**
- **HashiCorp "exige Abandoned Ideas" → FALSO.** A seção é "(Optional)", verbo
  *"should try"*. R3 perdeu 1 de suas 2 fontes citadas.
- **Amazon "6/7 de negócio" → exagero.** São ~4–5 de negócio, 1 híbrida, 1 de
  viabilidade técnica.
- **"Tensão lazy se dissolve" → dissolve-se só inter-fase.** Design faz
  decomposição diferida (congela), não Rolling Wave (re-planeja continuamente).
  Erro de categoria parcial. E esta claim-âncora **não estava entre as 25
  verificadas**.
- **Self-Refine/Huang → regime-mismatch.** Conclusões de benchmarks de raciocínio
  fechado, não prova direta para crítica de design.

**R1–R7 re-escalonados:**
| R | Antes | Depois |
|---|---|---|
| R2 | non-goals obrigatório | **segura como-está** (3 fontes, fiel) |
| R7 | DoD universal | **segura, exigindo falsificabilidade exit 0/1** (Zimmermann) |
| R4 | value ≥2 use-cases + business/customer | **meia**: manter business/customer (OST); **descartar "≥2"** (nº importado do Rust sem justificativa) |
| R1 | marcador `[NEEDS CLARIFICATION]` (SDD) | **re-ground**: mecanismo sadio mas redundante c/ D3; citar elicitação de requisitos, não SDD (domínio errado) |
| R3 | alternatives por fase | **re-escopo**: nível do **plano** (já existe), não por fase (granularidade errada) |
| R5 | re-validação contínua | **encolher forte**: demanda detecção de eventos sem mecanismo → 1–2 eventos concretos ou default-off |
| R6 | constituição de anti-patterns | **quebrar em 2**: curadoria do catálogo = iniciativa separada; hookup do gate = dependente |

**2 achados de design que a pesquisa ERROU em trazer (valem mais que as R):**
1. **Proof-of-work contra rubber-stamp/sycophancy.** "Usuário valida
   businessIntent" é o caso-arquetípico de validation-theatre: humanos
   rubber-stampam saída plausível de IA que não autoraram; sycophancy é
   quantificada (~50% mais servis). → O gate precisa forçar o usuário a
   **escrever** o valor, não aprovar. Sem isso, eficácia potencial ~0.
2. **Gate-como-hipótese instrumentável.** Não há evidência empírica (a favor ou
   contra) de que um gate de business-intent IA-preenchido + humano-validado
   reduza rework. → Instrumentar para medir antes de tratá-lo como hard-block
   universal. Tratá-lo como verdade não-verificada é importar doutrina.

**Veredito net:** o núcleo D1–D7 é sólido e não precisa desta pesquisa para
subsistir; R2/R7 adotam-se como-está; R4 adota-se meia; R1/R3/R5/R6 re-escopam-se;
e **2 novas decisões** (proof-of-work, gate-hipótese) são incorporadas ao design.
O "VALIDADO" torna-se "plausível, doutrina-alinhado, empiricamente não-provado".
