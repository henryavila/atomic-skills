# Decisões de Arquitetura

## Padrão de memória: `.ai/memory/`
- Local canônico da memória é sempre `.ai/memory/` dentro do repo (versionada no git)
- `~/.claude/projects/{path-encoded}/memory/` é apenas um symlink apontando para `.ai/memory/`
- Path encoding: `/home/henry/projeto` → `-home-henry-projeto`

## Prefixo `hca-` nos comandos
- Todos os comandos pessoais usam prefixo `hca-` (iniciais do Henry)
- Motivo: evitar colisão com comandos de projeto e facilitar filtragem ao digitar `/hca-`

## `_bmad/_memory/` é exceção
- Diretório `_bmad/_memory/` contém memória do módulo BMAD (agentes/sidecars), não da aplicação
- O comando `hca-init-memory` deve ignorar automaticamente este diretório

## Organização de memória é contextual
- Não usar template fixo de arquivos — o Claude decide conforme o domínio do projeto
- Único arquivo obrigatório: `MEMORY.md` como índice
- Se já existe estrutura, preservar; se é blob, separar por afinidade

## Padronizar sempre
- Mesmo projetos com estrutura customizada (ex: CRCMG com `98-Base-Conhecimento/agente/`)
  devem ser migrados para `.ai/memory/`
- O init-memory detecta referências antigas e atualiza arquivos operacionais
