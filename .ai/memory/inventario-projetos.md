# Inventário de Padrões de Memória nos Projetos do Henry

Levantamento feito em 2026-03-21. Serve como referência para migração com `hca-init-memory`.

## Já no padrão `.ai/memory/`
- `bmad-modules` — 17 arquivos, estrutura rica
- `arch` — menor, com guidelines e MCP separados em `.ai/`

## Padrão próprio (precisa migrar)
- `nexus` — usa `.memory/` (8 arquivos, symlink já existe)
- `mnemo` — usa `.claude/memory/` (symlink já existe)
- `sda-v2` — usa `docs/claude-memory/` (10 arquivos) + memória centralizada (8 arquivos)
- `CRCMG` — usa `98-Base-Conhecimento/agente/` (4 arquivos: MEMORIA.md, instrucoes.md, preferencias.md, pendencias-limpeza.md)

## Sem memória local (só centralizada)
- `codeguard` — 6 arquivos em `~/.claude/projects/`
- `Dragon Heir` — 7 arquivos em `~/.claude/projects/`

## BMAD (ignorar na migração)
- `codeguard`, `sda-v2`, `nexus`, `mnemo` — todos têm `_bmad/_memory/` (sidecars de agentes)
