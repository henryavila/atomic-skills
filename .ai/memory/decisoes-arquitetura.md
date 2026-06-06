# Decisões de Arquitetura

## Evolução do projeto: hca- → Atomic Skills (as-)
- Projeto começou como `hca-` commands (iniciais do Henry) para Claude Code
- Em 2026-03-22, aprovado design, implementado e publicado como **@henryavila/atomic-skills** no npm
- Princípios: **Small. Specific. Capable.**
- Novo prefixo: `as-` | Instalação: `npx @henryavila/atomic-skills install`
- Repo renomeado para `henryavila/atomic-skills`
- CI: GitHub Actions publica no npm automaticamente via tags (`npm version patch && git push --tags`)
- Spec em `docs/superpowers/specs/2026-03-22-atomic-skills-design.md`
- Plano em `docs/superpowers/plans/2026-03-22-atomic-skills.md`
- Os `hca-` commands continuam em `claude/commands/` como fonte original

## Uso do CLI publicado vs checkout local
- Em macOS, rodar `npx @henryavila/atomic-skills install` dentro do próprio checkout
  `/Volumes/External/code/atomic-skills` pode falhar com `sh: atomic-skills: command not found`
  porque o npm resolve o pacote local de mesmo nome antes do pacote publicado.
- Para testar/instalar a versão publicada a partir de dentro do repo, usar:
  `npm exec --yes --package @henryavila/atomic-skills@latest -- atomic-skills install ...`
- Para instalação de usuário, preferir rodar de fora do repo com versão explícita:
  `npx -y @henryavila/atomic-skills@latest install --yes --ide codex --lang pt`
- Para executar o CLI do checkout fonte, primeiro instalar dependências com `npm install`;
  caso contrário comandos que importam dependências como `picocolors` falham.

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

## Scripts de runtime DEVEM estar em package.json `files`
- Skill bodies chamam helpers determinísticos via `node scripts/<x>.js` em runtime
  (ex: `find-missing-summaries`, `compute-rollups`, `reconcile-focus`, `detect-completion`,
  `find-signalless-tasks`, `lint-*`, `validate-state`).
- **Gotcha (corrigido 2026-06-05):** `scripts/` NÃO estava no array `files` do package.json,
  então NENHUM desses `node scripts/...` era publicado — todos faziam no-op silencioso para
  consumidores instalados (só funcionavam no repo dogfood, onde `$PWD/scripts/` existe).
- Resolução de path em runtime é 3-vias (mesmo padrão de `src/normalize.js`):
  `$PWD/scripts/...` → `$(npm root -g)/@henryavila/atomic-skills/scripts/...` → `$HOME/.atomic-skills/scripts/...`.
  Só a 1ª (dogfood) e a 2ª (npm global, traz `node_modules` com `yaml`/`ajv`) resolvem hoje;
  `~/.atomic-skills/` (install runtime) só recebe `src/`, não `scripts/`.
- Ao adicionar um script chamado por skill body: garantir que ele só importa de `./` ou `../src/`
  (ambos publicados) e confirmar `npm pack --dry-run` lista o arquivo. `files` é manifest de
  publicação — não toca `install.js`, então não afeta o contrato de paridade install/uninstall.

## Completion reconciler: sinal de detecção ≠ autoridade de fechamento
- Detector determinístico (`scripts/detect-completion.js`) classifica "feito no código, aberto no estado"
  por evidência de DELIVERABLE MUDADO: `output-exists` (path em `outputs[].path` existe + commit/mtime
  após o anchor) ou `commit-ref` (commit após anchor citando o id exato OU tocando um `outputs[].path`).
- A presença de um `verifier:` NUNCA é sinal de detecção (ele é escrito ANTES do trabalho — é o
  mecanismo de FECHAMENTO, usado no `reconcile`). Prosa `acceptance[]` nunca é parseada (falso-positivo).
- Detecção é read-only + fail-open; só `reconcile` muta, e é verifier-aware (GATE-R2: entrada com
  verifier `shell/test/query` só fecha com evidência de run real; sem verifier → ack manual).
- Hooks (`session-start`/`stop`) delegam o candidate-finding ao detector compartilhado e permanecem
  fail-open (sem detector/node/jq → emite nada, nunca bloqueia a sessão).
