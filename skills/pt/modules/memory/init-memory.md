Padronize a memória deste projeto para `{{memory_path}}` (canônica, versionada no git).

Anuncie ao iniciar: "Vou padronizar a memória deste projeto para `{{memory_path}}`."

## Regra Fundamental

NO DELETION WITHOUT CONFIRMED BACKUP.
Diretórios originais de memória só podem ser removidos APÓS confirmar que
TODOS os arquivos foram copiados com sucesso para `{{memory_path}}`.
Confirmar = executar `ls` em ambos os diretórios e comparar.

## Contexto Crítico — Como o Claude Code lê memória

O Claude Code carrega auto-memory de `~/.claude/projects/{project_dir}/memory/MEMORY.md` por padrão,
onde `{project_dir}` é o path do projeto com `/` substituído por `-`
(ex: `/home/user/myapp` → `-home-user-myapp`).

Mover arquivos para `{{memory_path}}` NÃO faz o Claude lê-los automaticamente.
Duas formas de conectar:

**Caminho A — `autoMemoryDirectory` (recomendado):**
Configurar path absoluto em `.claude/settings.local.json` ou `~/.claude/settings.json`.
NÃO aceita path relativo. NÃO aceita project settings (`.claude/settings.json`).

**Caminho B — Redirect (fallback):**
Criar `MEMORY.md` no diretório default que aponte para `{{memory_path}}`.
Frágil — novos arquivos ficam invisíveis se o redirect não for atualizado.

## Limites do MEMORY.md

- Apenas as primeiras **200 linhas** (ou 25KB) são carregadas no startup
- Topic files são lidos sob demanda
- Conteúdo além da linha 200 é **silenciosamente truncado**

## Processo

### 1. Detectar memória existente e resolver paths

Resolva o path do auto-memory deste projeto:
```bash
PROJECT_DIR=$(pwd | sed 's|/|-|g; s|^-||')
AUTO_MEMORY_DIR="$HOME/.claude/projects/-${PROJECT_DIR}/memory"
echo "Auto-memory default: $AUTO_MEMORY_DIR"
ls "$AUTO_MEMORY_DIR" 2>/dev/null
```

Resolva o path absoluto da memória canônica:
```bash
CANONICAL_PATH=$(realpath {{memory_path}} 2>/dev/null || echo "$(pwd)/{{memory_path}}")
echo "Memória canônica: $CANONICAL_PATH"
```

Escaneie locais conhecidos:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- `$AUTO_MEMORY_DIR` — auto-memory padrão (pode ter conteúdo)

Busque referências e configurações existentes:
```bash
grep -r "memory\|memória\|autoMemoryDirectory" CLAUDE.md AGENTS.md .claude/settings*.json ~/.claude/settings.json 2>/dev/null
```

Se encontrar diretórios não-previstos, liste e pergunte ao usuário.

### 2. Apresentar achados e pedir confirmação

**Se nenhuma memória foi encontrada em nenhum local:**
Informe o usuário e pule direto para o passo 4 (criar memória do zero).

**Se encontrou memória:** liste com origem, quantidade de arquivos, e tamanho total.

Apresente como Structured Options:

> Encontrei memória em:
> 1. `.memory/` (8 arquivos, 12KB)
> 2. `$AUTO_MEMORY_DIR` (3 arquivos, 4KB) — auto-memory do Claude Code
>
> Opções:
> A) Migrar tudo para `{{memory_path}}`
> B) Selecionar quais migrar
> C) Cancelar

Aguarde resposta antes de prosseguir.

### 3. Migrar arquivos

- Crie `{{memory_path}}` se não existir
- Copie os arquivos aprovados para `{{memory_path}}`
- Se houver múltiplos `MEMORY.md`, mescle num único índice
- Execute `ls` no destino para confirmar que todos os arquivos chegaram

<HARD-GATE>
NÃO remova os diretórios originais ainda.
A remoção só acontece no passo 8, após TODA a validação.
Se o usuário pedir para remover agora: explique que a validação
garante segurança e a remoção vem no final.
</HARD-GATE>

### 4. Organizar conteúdo

- **Já tem estrutura** (múltiplos arquivos temáticos): preserve como está
- **Sem memória nenhuma**: crie `{{memory_path}}MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Nomes descritivos conforme o domínio.
  Único obrigatório: `MEMORY.md` como índice.

Verifique que `MEMORY.md` tem **menos de 200 linhas**. Se passou, mova conteúdo
detalhado para topic files e deixe apenas links no índice.

### 5. Conectar ao Claude Code

Detecte o IDE em uso verificando a existência de `.claude/`, `.cursor/`, `.gemini/`, etc.

**Se Claude Code (`.claude/` existe):**

Verifique se `autoMemoryDirectory` já está configurado:
```bash
grep -r "autoMemoryDirectory" .claude/settings*.json ~/.claude/settings.json 2>/dev/null
```

**Se encontrou configuração existente:**
Verifique se aponta para `$CANONICAL_PATH`.
- Se já aponta para `$CANONICAL_PATH`: reporte "autoMemoryDirectory já configurado corretamente" e pule para o passo 6.
- Se aponta para outro diretório (ex: o antigo `.memory/`): ofereça atualizar para `$CANONICAL_PATH`.

**Se NÃO configurado**, apresente:

> O Claude Code lê memória de `$AUTO_MEMORY_DIR` por padrão.
> Para ler de `{{memory_path}}` diretamente, preciso configurar `autoMemoryDirectory`.
>
> A) Configurar em `.claude/settings.local.json` (recomendado)
> B) Criar redirect manual no diretório padrão (frágil)
> C) Pular — configurar depois

**Se opção A:**
Se `.claude/settings.local.json` não existir, crie-o.
Adicione `"autoMemoryDirectory": "$CANONICAL_PATH"` ao JSON.
Exemplo final:
```json
{
  "autoMemoryDirectory": "/home/user/myapp/.ai/memory"
}
```

**Se opção B:**
Crie `$AUTO_MEMORY_DIR/MEMORY.md` com este conteúdo:
```markdown
# Auto Memory - Redirect
A memória deste projeto está em `{{memory_path}}` dentro do repositório.
Leia `{{memory_path}}MEMORY.md` para contexto geral.
Salve novos aprendizados em `{{memory_path}}`, não aqui.
```

**Se outro IDE:** pule este passo.

### 6. Atualizar instruções do projeto

- Se o arquivo de instruções do projeto NÃO existir: crie com seção de memória
- Se JÁ existir E `autoMemoryDirectory` foi configurado (passo 5A):
  NÃO adicione instrução de memória — o Claude já lê automaticamente.
  Cada linha no CLAUDE.md custa tokens em TODA sessão.
- Se JÁ existir E usando redirect (passo 5B) ou outro IDE:
  Adicione o mínimo:
  ```
  ## Memória
  Consulte `{{memory_path}}MEMORY.md` antes de implementar.
  Atualize a memória ao aprender algo relevante para sessões futuras.
  ```

### 7. Atualizar referências quebradas

Execute `grep -r` nos paths antigos de memória pelo projeto inteiro.

- **Arquivos operacionais** (instruções do projeto, configs de agentes):
  atualize as referências para `{{memory_path}}`
- **Docs históricos** (plans, designs, specs): liste as referências
  mas NÃO altere sem perguntar — são registros históricos

### 8. Validação e cleanup

Verifique executando cada comando (não apenas "verifique"):

- Execute `ls {{memory_path}}` — deve mostrar os arquivos migrados
- Execute `wc -l {{memory_path}}MEMORY.md` — deve ser < 200 linhas
- Verifique a conexão com o Claude Code:
  - Se autoMemoryDirectory: `grep autoMemoryDirectory .claude/settings*.json ~/.claude/settings.json`
  - Se redirect: `cat "$AUTO_MEMORY_DIR/MEMORY.md" 2>/dev/null | head -5`
- Verifique que as instruções do projeto NÃO têm instrução redundante de memória
  (se autoMemoryDirectory foi configurado)

Se TUDO passou: remova os diretórios originais (os que foram migrados).
Para cada diretório a remover, liste o path completo e peça confirmação:

> Remover diretório original `.memory/`? (arquivos já estão em `{{memory_path}}`)
> Digite "remover" para confirmar.

## Encerramento

Apresente relatório:
- Arquivos migrados: [quantidade] de [origem(s)]
- MEMORY.md: [linhas] (limite: 200)
- Conexão Claude Code: [autoMemoryDirectory / redirect / não configurado]
- Instruções do projeto: [criado/atualizado/não necessário]
- Referências atualizadas: [quais arquivos]
- Diretórios removidos: [quais]
- Problemas encontrados: [se houver]

## Red Flags

- "Vou remover o diretório original antes de validar"
- "O conteúdo provavelmente foi copiado, não preciso testar"
- "As instruções do projeto já devem ter a referência, não preciso verificar"
- "Vou editar um doc histórico para atualizar o path"
- "Esse diretório de memória não-previsto provavelmente não é importante"
- "Não preciso verificar o autoMemoryDirectory, o Claude vai encontrar"
- "Vou adicionar instrução de memória no CLAUDE.md mesmo com autoMemoryDirectory configurado"
- "O settings.local.json já deve existir, não preciso verificar"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "O Claude lê .ai/memory/ por padrão" | NÃO lê. Precisa de autoMemoryDirectory ou redirect |
| "Path relativo funciona no autoMemoryDirectory" | Apenas path absoluto. Execute `realpath` para obter |
| "Vou criar settings.local.json sem verificar se existe" | Se já existe, adicionar chave. Se não, criar. Verificar sempre |
| "O redirect é bom o suficiente" | Redirect quebra quando novos arquivos são criados. autoMemoryDirectory é definitivo |
| "200 linhas é muito, não vou chegar nisso" | Projetos ativos chegam rápido. Verificar e prevenir agora |
