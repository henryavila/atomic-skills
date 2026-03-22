# Decisões de Arquitetura

## Evolução do projeto: hca- → Atomic Skills (as-)
- Projeto começou como `hca-` commands (iniciais do Henry) para Claude Code
- Em 2026-03-22, aprovado design para **Atomic Skills** — pacote npm multi-IDE
- Novo prefixo: `as-` | Instalação: `npx atomic-skills install`
- Spec completa em `docs/superpowers/specs/2026-03-22-atomic-skills-design.md`
- Os `hca-` commands continuam existindo em `claude/commands/` como fonte original

## Padrão de memória: `.ai/memory/`
- Local canônico da memória é sempre `.ai/memory/` dentro do repo (versionada no git)
- `~/.claude/projects/{path-encoded}/memory/` é apenas um symlink apontando para `.ai/memory/`
- Path encoding: `/home/henry/projeto` → `-home-henry-projeto`

## `_bmad/_memory/` é exceção
- Diretório `_bmad/_memory/` contém memória do módulo BMAD (agentes/sidecars), não da aplicação
- O comando `hca-init-memory` deve ignorar automaticamente este diretório

## Organização de memória é contextual
- Não usar template fixo de arquivos — o Claude decide conforme o domínio do projeto
- Único arquivo obrigatório: `MEMORY.md` como índice
- Se já existe estrutura, preservar; se é blob, separar por afinidade

## Antes de criar novo command, verificar se superpowers já cobre
- Confirmado em 2026-03-22: hca-start-feature descartado (superpowers já faz setup de dev),
  hca-debug descartado (superpowers:systematic-debugging já tem as 4 fases + TDD)
- commands devem existir quando: (a) o superpowers não cobre, ou (b) o workflow
  encadeia múltiplas skills de forma específica (ex: hca-fix = debugging + TDD)

## Todo conhecimento sobre skills vai para a KB
- Aprendizados sobre design, comportamento e bugs de skills/prompts devem ser registrados em `docs/kb/`
- Aprendizados sobre como o agente interpreta prompts → `.ai/memory/feedback-prompts.md`
- Técnicas catalogadas do superpowers → `docs/kb/analise-superpowers-v5.0.5.md`
- Templates reutilizáveis → `docs/kb/templates-reutilizaveis.md`
- Mapeamento técnicas ↔ commands → `docs/kb/mapa-tecnicas.md`
- Planos de implementação concluídos → `docs/kb/archive/` (histórico, não consultar)
- Motivo: este repo É sobre skills/commands — o conhecimento sobre como escrevê-los bem é o ativo mais valioso

## Padronizar sempre
- Mesmo projetos com estrutura customizada (ex: CRCMG com `98-Base-Conhecimento/agente/`)
  devem ser migrados para `.ai/memory/`
- O init-memory detecta referências antigas e atualiza arquivos operacionais
