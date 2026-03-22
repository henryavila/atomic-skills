Revise esta conversa, salve aprendizados na memória, e faça commit + push do trabalho.

## Regra Fundamental

NO PUSH WITHOUT FRESH VERIFICATION.
Se não executou `git status` e `git diff` NESTA execução do command, não pode fazer push.

<HARD-GATE>
Se o branch atual é main ou master:
PARE. Pergunte ao usuário: push direto para main ou criar branch + PR?
NÃO faça push para main/master sem confirmação explícita.
</HARD-GATE>

## Processo

### 1. Salvar aprendizados na memória

{{#if modules.memory}}
Identifique aprendizados úteis para FUTURAS sessões:
- Decisões tomadas e seus motivos
- Bugs encontrados e suas causas raiz
- Padrões que funcionaram ou falharam
- Feedback do usuário sobre abordagem

NÃO salve: contexto desta conversa que não será útil depois, fatos que podem
ser derivados lendo o código ou `git log`, detalhes efêmeros (branches temporários,
tentativas descartadas, erros de digitação corrigidos).

Se `{{memory_path}}` não existir, rode `as-init-memory` primeiro.
Atualize arquivos existentes em vez de criar duplicatas.
Mantenha `MEMORY.md` como índice atualizado.
{{/if}}

### 2. Salvar trabalho em andamento

Se houver trabalho em progresso (brainstorm, plano, artefato, spec),
salve no arquivo correspondente. Não deixe trabalho só no contexto da conversa.

### 3. Preparar commits

**3a. Levantar estado completo:**
Execute `git status` — liste o output completo.
Execute `git diff --stat` — resumo das mudanças por arquivo.
Execute `git diff` — analise o conteúdo das mudanças.
Execute `git log --oneline -5` — veja o estilo de commits recente.

**3b. Filtrar arquivos que NÃO devem ser commitados:**
Execute `git diff --name-only` e analise cada arquivo alterado:
- **Sensíveis** (NUNCA commitar sem perguntar): `.env`, `.env.*`, `credentials.*`,
  `*secret*`, `*token*`, `*.pem`, `*.key`
- **Conteúdo suspeito:** execute `grep -rn "password\|api_key\|secret\|token\|Bearer" <arquivos alterados>`
- **Arquivos gerados** que não deveriam estar no repo: `node_modules/`, `dist/`,
  `__pycache__/`, `.DS_Store`, `*.log`
- **Arquivos não-relacionados** ao trabalho desta sessão: se um arquivo aparece
  no diff mas não foi intencionalmente modificado, NÃO inclua no commit.
  Pergunte ao usuário se não tiver certeza.

Se encontrar qualquer sensível ou suspeito: PARE e pergunte ao usuário.

**3c. Classificar e agrupar por unidade lógica:**
Analise os arquivos restantes e agrupe por afinidade funcional.
NÃO faça um commit gigante com tudo. NÃO faça um commit por arquivo.

Critérios de agrupamento (do mais específico ao mais geral):
1. **Mesma feature/fix:** arquivos que implementam a mesma funcionalidade juntos
2. **Mesma camada:** se não há feature clara, agrupe por natureza:
{{#if modules.memory}}
   - Memória (`{{memory_path}}`) = commit separado
{{/if}}
   - Documentação (`docs/`) = commit separado
   - Código/commands = commit separado
   - Config/infra = commit separado
   - Testes = junto com o código que testam
3. **Se TUDO é da mesma natureza:** 1 commit é suficiente

Apresente o plano de commits ao analisar:
> Commits planejados:
> 1. `feat: [descrição]` — arquivos: [lista]
> 2. `docs: [descrição]` — arquivos: [lista]
> Prosseguir?

**3d. Executar commits:**
Para cada grupo, execute `git add <arquivos do grupo>` seguido de `git commit`.
Mensagens descritivas com prefixos convencionais (feat, fix, docs, refactor).
NUNCA use `git add .` ou `git add -A` — sempre nomeie os arquivos explicitamente.

### 4. Fazer push

Execute `git status` — confirme que está limpo após os commits.
Verifique o branch atual com `git branch --show-current`.
Aplique o HARD-GATE acima se for main/master.
Execute `git push` para o branch atual.
Execute `git status` novamente — confirme que o push foi aceito.

## Encerramento

Reporte:
- Aprendizados salvos: quais arquivos de memória foram alterados
- Commits: quantidade, mensagens, branch
- Push: status final (sucesso/falha)
- Se algo falhou: descreva o erro e sugira correção

## Red Flags

- "Vou fazer push sem verificar, já sei que está ok"
- "É só um arquivo pequeno, não precisa de git status"
- "Vou incluir o .env porque o usuário não mencionou secrets"
- "Vou fazer push para main, é só uma correção rápida"
- "Não preciso separar commits, é tudo relacionado"
- "Já vi o diff mentalmente, não preciso executar git diff"
- "Vou usar git add . para ser mais rápido"
- "Esse arquivo não-relacionado provavelmente devia ser commitado também"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
