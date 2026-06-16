# Dashboard — propósito e modelo de dados

> Brief para o **design agent**. Este documento descreve **apenas** (1) o **propósito** do
> dashboard e (2) **como os dados existem e se relacionam** (incluindo a hierarquia). Os dados
> reais estão em `fixtures.json`.
>
> **Não** há aqui telas, páginas, "o que cada tela tem", componentes, cor, estilo ou layout —
> isso será **pensado do zero** no design. O brief passa **intenção + dados**; a forma é sua.

## 1. Propósito do dashboard

O **atomic-skills** rastreia o ciclo de vida do trabalho de engenharia (de uma ideia até a
entrega) como estado versionado em arquivos. O dashboard é a **lente de leitura** desse estado:
ele **observa e comunica** onde o trabalho está. Ele **não opera** o trabalho — criar, avançar,
fechar e verificar acontecem fora dele (no terminal); o dashboard nunca muta o estado.

A intenção é responder, sem ruído, às perguntas de quem acompanha o trabalho:

- **Onde estou?** — o que está em foco agora e qual o próximo passo concreto.
- **Estou progredindo?** — o quanto de cada frente já foi feito vs. o que falta.
- **O que me trava?** — o que está suspenso ou bloqueado, e por quê.
- **Qual o panorama?** — o conjunto de frentes em andamento, sem que as já encerradas atrapalhem.

O problema do dashboard atual não é estética — é **clareza**: os níveis de informação se
misturam e a hierarquia do trabalho não se lê com facilidade. O redesign existe para tornar essa
hierarquia legível.

## 2. Como os dados existem e se relacionam (hierarquia)

O estado é uma árvore. Cada nível **contém** o seguinte; relações horizontais (dependência,
bloqueio, foco) cruzam a árvore.

Cardinalidade anotada em cada aresta (1 = exatamente um; N = zero-ou-mais):

```
projeto                          N por instância
└── plano                        projeto 1 → N planos    ← VÁRIOS planos podem estar ativos ao mesmo tempo
    └── fase                     plano 1 → N fases (o roteiro)   ← 1 fase é a currentPhase "em foco"
        └── iniciativa           fase 1 → 1 iniciativa    ← 1:1, ligada por phaseId
            ├── task             iniciativa 1 → N tasks
            ├── exit gate        iniciativa 1 → N exit gates
            ├── stack frame      iniciativa 1 → N frames
            └── parked / emerged iniciativa 1 → N de cada
```

**Cardinalidade explícita (o que é 1, o que é vários):**
- Um **projeto** tem **N planos**; **vários planos ativos** ao mesmo tempo é normal (multi-front —
  nos dados reais, `atomic-skills` tem 4 planos ativos simultâneos).
- Um **plano** tem **N fases** (de 1 a muitas — no real, até 8 fases num plano). O plano aponta
  **exatamente 1** `currentPhase` (a em foco); com `parallelismAllowed`, mais de uma fase pode
  estar com status `active` ao mesmo tempo.
- Uma **fase** tem **exatamente 1 iniciativa** (1:1, por `phaseId`). Não há fase com 2
  iniciativas nem iniciativa servindo 2 fases.
- Uma **iniciativa** tem **N tasks**, **N exit gates**, **N frames de stack**, **N parked** e **N
  emerged** — cada um independentemente (de zero a muitos; no real, até 55 tasks e 9 gates numa
  única iniciativa).

**Fase × iniciativa (1:1, mas papéis distintos):** a **fase** é o *slot no roteiro* do plano
(aparece na lista de fases, com status e dependências); a **iniciativa** é o *corpo executável*
daquela fase (o documento com tasks, gates, decisões, narrativa). Ligam-se por `phaseId`.

**Iniciativa standalone (caso de primeira classe):** uma iniciativa pode existir **sem um plano
"de verdade" por cima** — quando o trabalho não precisa de um roteiro multi-fase. No modelo, isso
é um **plano degenerado de exatamente 1 fase** (plano 1 → 1 fase → 1 iniciativa). É **comum**: nos
dados reais, **9 dos 19 planos têm uma única fase**. Ou seja, o dashboard verá tanto planos
"grandes" (várias fases) quanto frentes de uma fase só — e ambos chegam pela mesma hierarquia.

Além da contenção, estes **relacionamentos** governam a leitura:

- **Foco.** Um plano tem uma **fase atual** (`currentPhase`); um projeto pode ter uma ou mais
  frentes "em foco" ao mesmo tempo.
- **Roteiro com dependências.** As fases de um plano **não são uma lista plana**: cada fase pode
  depender de outras (`dependsOn`), formando uma ordem (um grafo). Há um "passado → presente →
  futuro" entre as fases.
- **Pertencimento.** Toda iniciativa pertence a um plano (`parentPlan`) e realiza uma fase
  (`phaseId`); toda task e todo gate pertencem a uma **iniciativa**.
- **Bloqueio.** Uma task pode estar travada **por** algo (`blockedBy`) — outra task ou uma
  decisão pendente.
- **Backlog lateral.** Uma iniciativa carrega também itens **estacionados** (parked) e
  **emergentes** (emerged) — trabalho reconhecido mas fora do fluxo principal — e uma **pilha**
  de frames de trabalho abertos no momento.

### Status — o eixo que organiza tudo

Cada plano/fase/task tem um **status**, e é por ele que o estado do trabalho se lê:

| status | significado |
|---|---|
| `active` | em curso agora |
| `pending` | na fila, ainda não começou |
| `paused` | suspenso deliberadamente |
| `blocked` | travado por uma dependência (`blockedBy`) |
| `done` | concluído |
| `archived` | encerrado/arquivado |

`done` e `archived` são "**concluídos**": existem, mas não competem com o trabalho vivo — a
intenção é que fiquem **fora do caminho por padrão**, acessíveis quando se quer revê-los.

### Progresso — medidas que cada iniciativa carrega

- **Tasks:** quantas feitas de quantas no total.
- **Exit gates:** quantos satisfeitos de quantos no total. Cada gate tem um tipo de verificação
  (de manual a automática) e, quando satisfeito, uma evidência associada.

### Propriedades do dado

- **Atualiza ao vivo.** Quando o estado muda no disco (alguém fecha uma task, avança uma fase),
  isso se reflete em tempo quase-real (< 200ms) — a leitura pode estar aberta enquanto os números
  mudam sozinhos.
- **Multi-projeto.** Há vários projetos ao mesmo tempo; a densidade varia muito (um projeto com
  muitos planos densos vs. um projeto com um único plano).

## 2-bis. Segundo domínio de dados: o catálogo de skills (a "ajuda")

Além da árvore de estado (projeto→plano→fase→…), o dashboard expõe a **ajuda**: o **catálogo de
skills** disponíveis (o que cada comando faz, quando usar, exemplos). É um domínio **ortogonal** —
uma **lista plana** de skills, **não** ligada à hierarquia de planos; serve para a pessoa
descobrir e entender as ferramentas. Dados reais em `fixtures-help.json` (15 skills).

Cada **skill** carrega:
- `id`, `title`, `emoji`, `oneLiner` (resumo de 1 linha), `summary`, `versionAdded`.
- `when` (quando usar) e `whenNot` (quando não usar) — listas curtas.
- `examples` — comandos de exemplo.
- `related` — skills relacionadas (forma um pequeno grafo entre skills).
- `tags` — rótulos (ex.: `core`, `quality`, `review`, `planning`).
- `args` e, em alguns casos, `subcommands` — uma skill pode ter **muitos** subcomandos
  agrupados (ex.: `project` tem **25** subcomandos em grupos como *View*, *Create*, *Stack
  frames*, *Backlog*, *Tasks & phases*, *Lifecycle*). Esse é o caso de borda denso da ajuda.

Cardinalidade: o catálogo tem **N skills**; cada skill tem **N** itens em `when`/`whenNot`/
`examples`/`related`/`tags`, e **N** subcomandos/args (de 0 a muitos — `project` é o extremo).

## 3. Textura real (use `fixtures.json` + `fixtures-help.json` — dados reais, não sintéticos)

`fixtures.json` traz o estado real de **3 projetos** (`atomic-skills`, `arch`, `lekto`):
**19 planos, 43 fases, 231 tasks**. A textura importa (brevidade, densidade e os casos de borda
são dado de design):

- **Distribuição de status — planos:** 8 `archived`, 6 `active`, 5 `paused` (a maioria já
  encerrada; os concluídos são o caso comum, não a exceção).
- **Fases:** 32 `pending`, 5 `active`, 4 `done`, 2 `paused`.
- **Tasks:** 200 `pending`, 31 `done`.
- **Cardinalidade:** `atomic-skills` = 13 planos / 21 fases (denso, overflow real); `arch` = 5
  planos / 19 fases; `lekto` = 1 plano / 3 fases (frente pequena). E há `dispatch-test` — um
  projeto **sem dados** (o caso de estado vazio).
- **Casos de borda reais:** títulos longos com pontuação (ex.: *"Mode 2 — make Codex the default
  implementer (Opus plans, Codex executes)"*); planos sem nenhuma fase ativa (só arquivadas);
  fases com "próxima ação" de uma a duas frases longas; conteúdo curto que deve permanecer curto.

## 4. Contexto técnico (mínimo, não é restrição de design)

O dashboard é renderizado pelo cliente declarativo do aiDeck; **componentes podem ser criados**
conforme o design pedir. Os dados chegam por uma API de leitura (por projeto) com atualização ao
vivo. Nada disso restringe a forma — desenhe livremente; a forma será expressa em componentes
depois.
