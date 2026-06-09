# Quick Idea Capture

Register a project idea in seconds, near-zero token, without it becoming a loose tracked initiative. Capture is a two-mode fork (Analisar / Só salvar) writing to a single human-readable `ideas.md`; promotion into real work is always a separate, ratify-gated step that reuses the emergence ladder. F0 ships the cheap inbox; F1 adds promotion.

## Inviolable principles

- **P1 Captura barata acima de tudo** — o caminho "Só salvar" não gasta tokens de análise; é append determinístico via script, com o modelo apenas coletando título e descrição.
- **P2 Disciplina na saída, não na entrada** — ideias cruas entram sem ratify; o bloco context/ratify é exigido só na promoção, ao entrar no modelo de iniciativa.
- **P3 Um lugar só, legível por humano** — ideias vivem em um único `ideas.md` markdown, scannável e editável à mão; nada de jsonl máquina-a-máquina.
- **P4 Não poluir o controle do projeto** — ideias ficam fora do modelo plan/initiative até serem promovidas; não viram iniciativas soltas no dashboard.
- **P5 Reuso da máquina existente** — promoção roteia pela emergence ladder; não reinventa classificação nem ratify.

## Glossary

- **ideas.md** — inbox markdown único por projeto que guarda ideias cruas, cada uma com uma meta line (id, data, branch, status).
- **captura** — ato de registrar uma ideia; fork de dois modos, Analisar ou Só salvar.
- **promoção** — passo separado que move uma ideia do inbox para o modelo de iniciativa via emergence ladder.

## F0 — Captura barata (MVP do inbox)

Goal: Entregar a captura end-to-end — script determinístico de append, o detail file com o fork de dois modos e o `idea list`, mais o wiring no router e a paridade de install — sem tocar no modelo plan/initiative.

### T-001 idea-add.js — append determinístico ao ideas.md

- Files: scripts/idea-add.js, tests/idea-add.test.js
- scopeBoundary: não modificar src/decompose.js, src/install.js, meta/schemas, nem o dashboard; não implementar o verbo promote.
- acceptance: it cria ideas.md com cabeçalho quando o arquivo não existe; it atribui id incremental a partir do maior "## #N" existente, começando em 1 num arquivo vazio; it grava a meta line com data UTC, branch e status pending; it grava título e descrição na seção e anexa scope e context quando passados por flag; it não duplica o cabeçalho em appends subsequentes.
- verifier: { kind: test, runner: "node --test", pattern: "tests/idea-add.test.js" }
- RED→GREEN: escrever tests/idea-add.test.js cobrindo arquivo ausente, incremento de id e a meta line; ver falhar; implementar scripts/idea-add.js até passar.

### T-002 project-idea.md — fork de captura mais idea list

- Files: skills/shared/project-assets/project-idea.md
- scopeBoundary: não documentar promote, que pertence a F1; não editar o router skills/core/project.md, que é a T-003; não usar nomes de ferramenta fixos.
- acceptance: it descreve o fork de dois modos com a primeira pergunta Analisar ou Só salvar; it no modo Só salvar coleta título e descrição e invoca node scripts/idea-add.js; it no modo Analisar faz análise leve e perguntas antes de chamar idea-add.js com scope e context; it documenta idea list como leitura compacta do ideas.md; it usa as variáveis de ferramenta abstratas em vez de nomes fixos.
- verifier: { kind: shell, command: "grep -q 'idea-add.js' skills/shared/project-assets/project-idea.md && grep -qi 'idea list' skills/shared/project-assets/project-idea.md && ! grep -nE 'Bash tool|Read tool|Write tool|Grep tool' skills/shared/project-assets/project-idea.md", expectExitCode: 0 }
- RED→GREEN: validar via npm run validate-skills e os greps do verifier; ajustar o arquivo até passar.

### T-003 Router wiring mais paridade de install

- Files: skills/core/project.md, src/install.js, src/uninstall.js
- scopeBoundary: não implementar promote; não criar painel no dashboard; não alterar schemas de estado.
- acceptance: it adiciona idea e idea list à grammar do router e uma linha na dispatch table apontando para project-idea.md; it adiciona ao no-args summary uma linha IDEAS que conta ideias pending de forma zero-token e fail-open; it garante que project-idea.md é instalado e removido com o roundtrip de paridade verde.
- verifier: { kind: shell, command: "grep -q 'project-idea.md' skills/core/project.md && node --test tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }
- RED→GREEN: rodar o roundtrip test, ver falhar pela ausência do novo asset na paridade, ajustar install e uninstall até passar.

```yaml
exit_gate:
  - id: F0-G1
    description: Captura funciona end-to-end — idea-add.js cria e atualiza o ideas.md e a suíte do script passa.
    verifier: { kind: shell, command: "node --test tests/idea-add.test.js", expectExitCode: 0 }
  - id: F0-G2
    description: Validação de skills verde com o novo detail file project-idea.md.
    verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
```

## F1 — Promoção via emergence ladder

Goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela emergence ladder com ratify e marca a ideia como triaged, sem reinventar classificação.

### T-001 idea promote — procedimento mais wiring

- Files: skills/shared/project-assets/project-idea.md, skills/core/project.md
- scopeBoundary: não alterar a lógica da emergence ladder em project-emergence.md, apenas referenciá-la; não tocar em scripts/idea-add.js.
- acceptance: it documenta idea promote N que extrai a ideia N do ideas.md; it roteia pela emergence ladder em project-emergence.md preservando o ratify gate; it adiciona idea promote à grammar e à dispatch table do router.
- verifier: { kind: shell, command: "grep -qi 'idea promote' skills/core/project.md && grep -qi 'promote' skills/shared/project-assets/project-idea.md", expectExitCode: 0 }
- RED→GREEN: rodar os greps do verifier, ver falhar, escrever o procedimento e o wiring até passar.

### T-002 idea-mark.js — transição de status para triaged

- Files: scripts/idea-mark.js, tests/idea-mark.test.js
- scopeBoundary: não apagar a ideia, apenas reescrever o status na meta line; não tocar nos arquivos de iniciativa materializados.
- acceptance: it reescreve status pending para status triaged com o destino na meta line da ideia N; it preserva o restante do ideas.md inalterado; it sai com código não-zero quando a ideia N não existe.
- verifier: { kind: test, runner: "node --test", pattern: "tests/idea-mark.test.js" }
- RED→GREEN: escrever tests/idea-mark.test.js cobrindo a reescrita e o caso de ideia inexistente; ver falhar; implementar scripts/idea-mark.js até passar.

```yaml
exit_gate:
  - id: F1-G1
    description: Promoção converte uma ideia em task ou iniciativa via ladder e marca a ideia triaged; a suíte de idea-mark passa.
    verifier: { kind: shell, command: "node --test tests/idea-mark.test.js", expectExitCode: 0 }
```
