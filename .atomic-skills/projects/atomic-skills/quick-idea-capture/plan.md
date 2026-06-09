---
schemaVersion: "0.1"
slug: quick-idea-capture
title: Quick Idea Capture
version: "1.0"
status: active
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T20:35:00Z
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Captura barata acima de tudo
    body: o caminho "Só salvar" não gasta tokens de análise; é append determinístico
      via script, com o modelo apenas coletando título e descrição.
  - id: P2
    title: Disciplina na saída, não na entrada
    body: ideias cruas entram sem ratify; o bloco context/ratify é exigido só na
      promoção, ao entrar no modelo de iniciativa.
  - id: P3
    title: Um lugar só, legível por humano
    body: ideias vivem em um único `ideas.md` markdown, scannável e editável à mão;
      nada de jsonl máquina-a-máquina.
  - id: P4
    title: Não poluir o controle do projeto
    body: ideias ficam fora do modelo plan/initiative até serem promovidas; não
      viram iniciativas soltas no dashboard.
  - id: P5
    title: Reuso da máquina existente
    body: promoção roteia pela emergence ladder; não reinventa classificação nem
      ratify.
glossary:
  - term: ideas.md
    definition: inbox markdown único por projeto que guarda ideias cruas, cada uma
      com uma meta line (id, data, branch, status).
  - term: captura
    definition: ato de registrar uma ideia; fork de dois modos, Analisar ou Só salvar.
  - term: promoção
    definition: passo separado que move uma ideia do inbox para o modelo de
      iniciativa via emergence ladder.
phases:
  - id: F0
    slug: quick-idea-capture-f0-captura-barata-mvp-do-inbox
    title: Captura barata (MVP do inbox)
    goal: Entregar a captura end-to-end — script determinístico de append, o detail
      file com o fork de dois modos e o `idea list`, mais o wiring no router e a
      paridade de install — sem tocar no modelo plan/initiative.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F0-G1
          description: Captura funciona end-to-end — idea-add.js cria e atualiza o
            ideas.md e a suíte do script passa.
          status: met
          metAt: 2026-06-09T20:35:00Z
          verifier:
            kind: shell
            command: node --test tests/idea-add.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-09T20:35:00Z
            passed: true
            exitCode: 0
            outputSummary: "Final tree: tests 9, pass 9, fail 0."
        - id: F0-G2
          description: Validação de skills e compatibilidade cross-agent verdes para o
            novo detail file project-idea.md (sem nomes de ferramenta fixos).
          status: met
          metAt: 2026-06-09T20:35:00Z
          verifier:
            kind: shell
            command: npm run validate-skills && node --test tests/compatibility.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-09T20:35:00Z
            passed: true
            exitCode: 0
            outputSummary: "Final tree: validate-skills ✓ 14 skills; compatibility 84/84."
        - id: F0-G3
          description: idea e idea list alcançáveis pela dispatch table do router e
            paridade de install/uninstall do novo asset garantida.
          status: met
          metAt: 2026-06-09T20:35:00Z
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js && grep -q
              'project-idea.md' skills/core/project.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-09T20:35:00Z
            passed: true
            exitCode: 0
            outputSummary: "Final tree: roundtrip 4/4; grep project-idea.md exit 0."
    status: done
    summary: "O inbox barato: script de append, detail file com o fork Analisar/Só
      salvar, idea list, wiring e paridade de install."
  - id: F1
    slug: quick-idea-capture-f1-promocao-via-emergence-ladder
    title: Promoção via emergence ladder
    goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela
      emergence ladder com ratify e marca a ideia como triaged, sem reinventar
      classificação.
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Promoção converte uma ideia em task ou iniciativa via ladder e
            marca a ideia triaged; a suíte de idea-mark passa.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/idea-mark.test.js
            expectExitCode: 0
        - id: F1-G2
          description: idea promote extrai a ideia do inbox, roteia pela emergence ladder
            com ratify e materializa/encaminha a task ou iniciativa; fixture
            prova extração e handoff.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/idea-promote.test.js
            expectExitCode: 0
    status: active
    summary: "O verbo idea promote: extrai a ideia e roteia pela emergence ladder
      com ratify, marcando-a como triaged."
references: []
planActive: true
planTitle: Quick Idea Capture
---

# Quick Idea Capture

## 1. Context

Register a project idea in seconds, near-zero token, without it becoming a loose tracked initiative. Capture is a two-mode fork (Analisar / Só salvar) writing to a single human-readable `ideas.md`; promotion into real work is always a separate, ratify-gated step that reuses the emergence ladder. F0 ships the cheap inbox; F1 adds promotion.

## 2. Inviolable principles

- **P1 Captura barata acima de tudo** — o caminho "Só salvar" não gasta tokens de análise; é append determinístico via script, com o modelo apenas coletando título e descrição.
- **P2 Disciplina na saída, não na entrada** — ideias cruas entram sem ratify; o bloco context/ratify é exigido só na promoção, ao entrar no modelo de iniciativa.
- **P3 Um lugar só, legível por humano** — ideias vivem em um único `ideas.md` markdown, scannável e editável à mão; nada de jsonl máquina-a-máquina.
- **P4 Não poluir o controle do projeto** — ideias ficam fora do modelo plan/initiative até serem promovidas; não viram iniciativas soltas no dashboard.
- **P5 Reuso da máquina existente** — promoção roteia pela emergence ladder; não reinventa classificação nem ratify.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## 4. Contrato de captura (resolve codex F-002)

Os dois modos compartilham o mesmo destino e o mesmo script de escrita — divergem só na quantidade de análise antes de gravar. **Nenhum dos modos promove**, e **F0 muta apenas `ideas.md`** (nunca toca em `plan.md`, iniciativas ou schemas).

| Aspecto | `Só salvar` | `Analisar` |
|---|---|---|
| Coleta | título + descrição | título + descrição |
| Análise | nenhuma | leve: lê `PROJECT-STATUS.md` + memória, faz 1–3 perguntas de esclarecimento (não scan profundo) |
| Escrita | `node scripts/idea-add.js --title … --desc …` | mesmo script + flags opcionais `--scope` / `--context` com o resultado refinado |
| Campos extra no registro | nenhum | `scope` e/ou `context` (quando a análise os produz) |
| Promove? | não | não |
| Tokens | ~0 (só shell-out) | só os da análise+perguntas, sob demanda |

O modo `Analisar` **persiste** o resultado **dentro do `ideas.md`** (nos campos opcionais da meta line / corpo), nunca num arquivo lateral. A diferença observável entre os modos é apenas a presença de `scope`/`context` no registro — a forma do registro é idêntica (§5).

## 5. Gramática do `ideas.md` (resolve codex F-003)

Contrato único que `idea-add.js`, `idea list`, `idea-mark.js` e `idea promote` DEVEM respeitar. Um registro:

```markdown
## #<N> · <título>
`<data> · branch:<branch> · status:<status>`[ · scope:<scope>][ · context:<context>]

<descrição — corpo livre, pode ter múltiplas linhas, sem cabeçalhos `##>`
```

- **`<N>` (id):** inteiro incremental ≥ 1. `idea-add.js` lê o maior `## #<N>` existente e soma 1; arquivo vazio/ausente começa em 1. Ids nunca são reusados (mesmo após `triaged`).
- **`<data>`:** data UTC `YYYY-MM-DD` (do `date -u`).
- **`<branch>`:** `git branch --show-current` no momento da captura (string vazia → `branch:-`).
- **`<status>`:** enum fechado — `pending` (default na captura) ou `triaged→<destino>` (após promoção, escrito por `idea-mark.js`; `<destino>` = id da task/iniciativa criada). Nenhum outro valor é válido.
- **`scope` / `context`:** opcionais, presentes só no modo `Analisar`.
- **Duplicidade:** ids são únicos por construção (max+1). Se o parser encontrar dois `## #<N>` iguais (edição manual), `idea-mark`/`promote` operam sobre a **primeira** ocorrência e emitem aviso não-fatal.
- **Malformado:** uma seção `## #<N>` sem a meta-line é tolerada na leitura (`idea list` mostra `status:?`); operações de mutação (`idea-mark`) sobre ela falham com exit ≠ 0 e mensagem clara em vez de adivinhar.
- **Cabeçalho do arquivo:** título `# 💡 Ideas — <project-id>` + linha-guia; criado uma vez por `idea-add.js`, nunca duplicado em appends.

Os testes de `idea-add.js` (T-001) e `idea list`/`idea-mark` (T-002/F1-T-002) cobrem id-increment, enum de status, e os casos duplicado/malformado acima.

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A para a maior parte — o plano descreve trabalho novo (scripts e detail file inexistentes). As referências a código existente (`project-emergence.md`, `scripts/*.js` zero-token, roundtrip test) apontam para arquivos reais no repo, verificados durante a investigação do design.
- **G2 soft-language**: scan da ban list (pt+en) sobre plano + iniciativas → 0 ocorrências.
- **G6 reference-or-strike**: toda exit-criterion carrega um `verifier:` determinístico (`kind shell`/`test`); nenhuma asserção solta.

## Reviews

- Internal (Stage 8a): inline, 2026-06-09 — G2 clean, verifiers determinísticos, dependência F1→F0 correta, schema válido. Zero findings major+.
- Codex (Stage 8b): two-pass sealed envelope (gpt-5-codex), 2026-06-09 — `needs_changes`, blind 4 major → final 5 major (0 blocker/critical; +1 emergido, 0 dropped). **Todos os 5 findings aplicados** (gates F0-G2/G3 + F1-G2, contrato §4, gramática §5). Arquivo: `.atomic-skills/reviews/2026-06-09-1851-quick-idea-capture-codex.md`.
