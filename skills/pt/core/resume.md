Investigue o contexto deste projeto e gere um prompt de handoff para uma sessão limpa.

## Regra Fundamental

NO HANDOFF WITHOUT COMPLETE CONTEXT.
Não gere o prompt de handoff sem antes ter investigado TODAS as fontes de
contexto listadas no passo 1. Cada fonte ignorada é contexto perdido.

## Processo

### 1. Investigar contexto

Execute CADA item abaixo e registre os achados. Não pule nenhum.

{{#if modules.memory}}
**Memória do projeto:**
- Execute `ls {{memory_path}}` — liste todos os arquivos
- Leia `{{memory_path}}MEMORY.md` com a {{READ_TOOL}}
- Se existem arquivos de memória relevantes, leia-os com {{READ_TOOL}}
{{/if}}

**Estado do git:**
- Execute `git branch --show-current` — branch atual
- Execute `git log --oneline -15` — atividade recente
- Execute `git status` — trabalho não-commitado
- Execute `git stash list` — stashes pendentes
- Execute `git diff --stat` — mudanças unstaged (resumo)

**Trabalho em progresso:**
- Execute `ls docs/plans/ 2>/dev/null` — planos existentes
- Execute `ls docs/ 2>/dev/null` — specs, brainstorms, artefatos
- Execute `{{GREP_TOOL}} -rn "TODO\|FIXME\|HACK" . --include="*.*" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -20` — TODOs no código

**Frameworks e ferramentas:**
- Leia o arquivo de instruções do projeto (ex: `CLAUDE.md`) com {{READ_TOOL}} para entender o contexto

**Regras e skills do projeto:**
- Execute `ls .claude/rules/ 2>/dev/null` — rules path-scoped (carregadas sob demanda)
- Execute `ls .claude/skills/ 2>/dev/null | head -20` — skills custom instalados
- Se existem rules, leia os nomes para entender quais domínios têm regras específicas

### 2. Apresentar resumo

Organize os achados em formato estruturado:

> **Projeto:** [nome do diretório]
> **Branch:** [branch atual] | **Último commit:** [mensagem]
>
> **Estado:**
> - [Trabalho não-commitado: sim/não — quais arquivos]
> - [Stashes: quantidade]
> - [Planos existentes: listar]
>
{{#if modules.memory}}
> **Memória relevante:**
> - [Resumo dos pontos-chave da memória]
>
{{/if}}
> O que você quer fazer a seguir?
> A) Continuar trabalho em progresso [descrever]
> B) Começar algo novo
> C) Outro: [descrever]

Aguarde a resposta do usuário.

### 3. Gerar prompt de handoff

Com base na escolha do usuário, gere um prompt autocontido que inclua:

**Estrutura do prompt gerado:**
```
Contexto do projeto:
- [1-3 frases sobre o que é o projeto, extraídas das instruções/memória]
- Branch atual: [branch]
- [estado do trabalho: limpo / em progresso]

{{#if modules.memory}}
Memória relevante:
- [Apenas os pontos da memória que são relevantes para a tarefa escolhida]
{{/if}}

Tarefa:
- [O que o usuário quer fazer, conforme respondido no passo 2]
- [Se continuar trabalho: onde parou, quais arquivos, qual o próximo passo]
- [Se novo: o que precisa ser feito]

Referências:
- [Paths de arquivos que o agente deve ler para ter contexto]

Regras do projeto (carregadas automaticamente):
- [Listar .claude/rules/*.md relevantes para a tarefa, com seus paths: triggers]
```

**Regras para o prompt gerado:**
- Incluir APENAS informação necessária para a tarefa escolhida
{{#if modules.memory}}
- Não incluir toda a memória — filtrar por relevância
{{/if}}
- Incluir paths concretos para que o agente da próxima sessão possa ler
- O prompt deve ser copiável — sem formatação que dependa de contexto

Apresente o prompt em um bloco de código para fácil cópia:

> Prompt de handoff gerado. Cole numa nova sessão:
> ```
> [prompt aqui]
> ```

### 4. Verificar o prompt gerado

Releia o prompt gerado e verifique que:
- Não referencia "esta sessão" ou contexto que só existe aqui
- Inclui paths concretos de arquivos (não referências vagas)
- A tarefa está clara para um agente sem nenhum contexto prévio
{{#if modules.memory}}
- Não inclui memória irrelevante para a tarefa escolhida
{{/if}}

Se algo faltar: ajuste (max 1 iteração de correção).

## Red Flags

- "Não preciso ler a memória, o git log é suficiente"
- "Vou pular a verificação de frameworks, é só código"
- "Vou incluir tudo no prompt — mais contexto é melhor"
- "O prompt pode ser vago, o agente descobre o resto"
- "Não preciso esperar o usuário escolher, já sei o que ele quer"

Se pensou qualquer item acima: PARE. Execute o passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Mais contexto é sempre melhor" | Contexto demais polui — filtre por relevância para a tarefa |
| "Já sei o que o usuário quer" | Você não sabe — pergunte e aguarde |
| "O git log basta como contexto" | Git mostra o quê mudou, não o porquê nem o que falta |
| "Não preciso verificar o prompt, acabei de gerar" | Prompts auto-referenciais são invisíveis para quem escreve |

## Encerramento

Reporte:
- Fontes investigadas: [quantidade e quais]
- Chamadas de ferramenta executadas: [N] ({{READ_TOOL}}: X, {{BASH_TOOL}}: Y)
- Prompt gerado: [sim/não, tamanho aproximado em linhas]
- Tarefa selecionada: [resumo da escolha do usuário]
