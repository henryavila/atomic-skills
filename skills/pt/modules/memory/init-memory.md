Padronize a memória deste projeto para `{{memory_path}}` (canônica, versionada no git).

Anuncie ao iniciar: "Vou padronizar a memória deste projeto para `{{memory_path}}`."

## Regra Fundamental

NO DELETION WITHOUT CONFIRMED BACKUP.
Diretórios originais de memória só podem ser removidos APÓS confirmar que
TODOS os arquivos foram copiados com sucesso para `{{memory_path}}`.
Confirmar = executar `ls` em ambos os diretórios e comparar.

## Processo

### 1. Detectar memória existente

Escaneie o projeto executando `ls` e `find` nos locais conhecidos:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- Qualquer outro diretório referenciado nas instruções do projeto como memória

Execute `grep -r "memory\|memória" CLAUDE.md AGENTS.md 2>/dev/null` para
encontrar referências não-óbvias.

Se encontrar diretórios não-previstos, liste e pergunte ao usuário.

### 2. Apresentar achados e pedir confirmação

Liste o que encontrou com origem, quantidade de arquivos, e tamanho total.

Apresente como Structured Options:

> Encontrei memória em:
> 1. `.memory/` (8 arquivos, 12KB)
> 2. `docs/memory/` (3 arquivos, 4KB)
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
A remoção só acontece no passo 7, após TODA a validação.
Se o usuário pedir para remover agora: explique que a validação
garante segurança e a remoção vem no final.
</HARD-GATE>

### 4. Organizar conteúdo

- **Já tem estrutura** (múltiplos arquivos temáticos): preserve como está
- **Sem memória nenhuma**: crie `{{memory_path}}MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Nomes descritivos conforme o domínio.
  Único obrigatório: `MEMORY.md` como índice.

### 5. Atualizar instruções do projeto

- Se o arquivo de instruções do projeto NÃO existir: crie com seção de memória
- Se JÁ existir: adicione ou atualize a seção de memória

Conteúdo mínimo da seção:
```
## Memória
Consulte `{{memory_path}}MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.
```

### 6. Atualizar referências quebradas

Execute `grep -r` nos paths antigos de memória pelo projeto inteiro.

- **Arquivos operacionais** (instruções do projeto, configs de agentes):
  atualize as referências para `{{memory_path}}`
- **Docs históricos** (plans, designs, specs): liste as referências
  mas NÃO altere sem perguntar — são registros históricos

### 7. Validação e cleanup

Verifique executando cada comando (não apenas "verifique"):

- Execute `ls {{memory_path}}` — deve mostrar os arquivos migrados
- Execute `ls {{memory_path}}MEMORY.md` — deve existir
- Verifique que as instruções do projeto referenciam `{{memory_path}}`

Se TUDO passou: agora remova os diretórios originais (os que foram migrados).
Para cada diretório a remover, liste o path completo e peça confirmação:

> Remover diretório original `.memory/`? (arquivos já estão em `{{memory_path}}`)
> Digite "remover" para confirmar.

## Encerramento

Apresente relatório:
- Arquivos migrados: [quantidade] de [origem(s)]
- Instruções do projeto: [criado/atualizado]
- Referências atualizadas: [quais arquivos]
- Diretórios removidos: [quais]
- Problemas encontrados: [se houver]

## Red Flags

- "Vou remover o diretório original antes de validar"
- "O conteúdo provavelmente foi copiado, não preciso testar"
- "As instruções do projeto já devem ter a referência, não preciso verificar"
- "Vou editar um doc histórico para atualizar o path"
- "Esse diretório de memória não-previsto provavelmente não é importante"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
