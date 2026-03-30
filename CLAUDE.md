# Atomic Skills

Repositório de skills otimizados para AI IDEs.
Skills usam o prefixo `as-` e ficam em `skills/`.

## Memória

Consulte `.ai/memory/MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.

## Compatibilidade entre Agentes

Para manter compatibilidade entre Claude Code, Gemini CLI e outros:

1. **Abstração de Ferramentas**: NUNCA use nomes de ferramentas fixos como `Bash` ou `Read tool` nos arquivos `.md` de skills. Use as variáveis globais:
   - `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`.
2. **Argumentos**: Use `{{ARG_VAR}}` em vez de `$ARGUMENTS`.
3. **Renderização Condicional**: Use `{{#if ide.gemini}}` ou `{{#if ide.claude-code}}` para instruções específicas.
4. **Guia Completo**: Veja `docs/kb/gemini-cli-compatibility.md`.
