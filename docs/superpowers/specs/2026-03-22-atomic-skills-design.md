# Atomic Skills — Design Spec

**"Cada skill é um átomo: autocontido, indivisível, pronto para agir."**
*Stop rewriting prompts.*

## 1. Problema

Prompts otimizados para workflows de desenvolvimento são longos demais para digitar manualmente. Hoje existem como slash commands do Claude Code (`/hca-*`), mas são inacessíveis em outras IDEs. Cada IDE tem seu próprio formato e mecanismo de invocação.

## 2. Solução

**Atomic Skills** — pacote npm que instala prompts otimizados no formato nativo de cada IDE suportada.

- Instalação: `npx @henryavila/atomic-skills install`
- Desinstalação: `npx @henryavila/atomic-skills uninstall`
- Atualização: `npx @henryavila/atomic-skills install` (re-run)

## 3. Identidade

| Item | Valor |
|------|-------|
| Nome | Atomic Skills |
| Pacote npm | `atomic-skills` |
| Prefixo dos skills | `as-` |
| Tagline | *Stop rewriting prompts.* |
| Conceito | Cada skill é um átomo — autocontido, indivisível, pronto para agir |

### Vocabulário do projeto

| Termo | Significado |
|-------|------------|
| Átomo | Um skill — unidade mínima funcional |
| Isótopos | Mesmo skill, adaptado para cada IDE (mesmo núcleo, invólucro diferente) |

## 4. IDEs suportadas

| IDE | Diretório | Formato | Invocação | Documentação |
|-----|-----------|---------|-----------|--------------|
| Claude Code | `.claude/skills/as-*/SKILL.md` | Markdown + YAML frontmatter | `/as-nome` | [Skills docs](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/as-*/SKILL.md` | Markdown + YAML frontmatter | `/as-nome` | [Agent Skills](https://cursor.com/docs/context/skills) |
| Gemini CLI | `.gemini/commands/as-*.toml` | TOML | `/as-nome` | [Custom commands](https://geminicli.com/docs/cli/custom-commands/) |
| Codex | `.agents/skills/as-*/SKILL.md` | Markdown + YAML frontmatter | `$as-nome` | [Agent Skills](https://developers.openai.com/codex/skills) |
| OpenCode | `.opencode/skills/as-*/SKILL.md` | Markdown + YAML frontmatter | `/as-nome` | [Skills docs](https://opencode.ai/docs/skills/) |
| GitHub Copilot | `.github/skills/as-*/SKILL.md` | Markdown + YAML frontmatter | `/as-nome` | [Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) |

### Formato dos arquivos gerados

**Markdown (Claude Code, Cursor, Codex, OpenCode, GitHub Copilot):**
```markdown
---
name: as-fix
description: 'Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior.'
---

[conteúdo do prompt]
```

**TOML (Gemini CLI):**
```toml
description = "Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior."
prompt = """
[conteúdo do prompt]
"""
```

**Nota:** O frontmatter (`name`, `description`) é sempre em inglês para compatibilidade com auto-detect de todas as IDEs. O corpo do prompt segue o idioma escolhido na instalação.

## 5. Internacionalização (i18n)

O instalador pergunta o idioma na primeira etapa. Os prompts são mantidos em diretórios separados por idioma.

### Estrutura de idiomas no pacote

```
skills/
├── pt/
│   ├── core/
│   │   ├── fix.md
│   │   ├── resume.md
│   │   └── ...
│   └── modules/
│       └── memory/
│           └── init-memory.md
└── en/
    ├── core/
    │   ├── fix.md
    │   ├── resume.md
    │   └── ...
    └── modules/
        └── memory/
            └── init-memory.md
```

### Regras de i18n

- **Frontmatter** (`name`, `description`): sempre em inglês — as IDEs usam o `description` para auto-detect e matching semântico
- **Corpo do prompt**: no idioma escolhido pelo usuário
- **CLI do instalador**: no idioma escolhido pelo usuário
- **v1**: Português (BR) e English
- Novos idiomas podem ser adicionados em versões futuras (basta criar diretório + traduções)
- **Fallback**: se um skill não existe no idioma escolhido (ex: tradução incompleta), usa a versão `en/` com aviso no terminal. `en/` é sempre a fonte canônica

## 6. Arquitetura do pacote

```
atomic-skills/
├── package.json
├── bin/
│   └── cli.js                       # Entry point do CLI
├── src/
│   ├── install.js                   # Lógica de instalação
│   ├── uninstall.js                 # Lógica de desinstalação
│   ├── manifest.js                  # Leitura/escrita do manifest
│   ├── hash.js                      # Cálculo de hashes (sha256)
│   ├── render.js                    # Renderização por IDE (string replacement)
│   └── prompts.js                   # Prompts interativos (inquirer)
├── skills/
│   ├── modules/
│   │   └── memory/
│   │       └── module.yaml              # Bilíngue — metadados do módulo para CLI
│   ├── pt/
│   │   ├── core/
│   │   │   ├── fix.md
│   │   │   ├── resume.md
│   │   │   ├── save-and-push.md
│   │   │   ├── review-plan-internal.md
│   │   │   └── review-plan-vs-artifacts.md
│   │   └── modules/
│   │       └── memory/
│   │           └── init-memory.md
│   └── en/
│       ├── core/
│       │   ├── fix.md
│       │   ├── resume.md
│       │   ├── save-and-push.md
│       │   ├── review-plan-internal.md
│       │   └── review-plan-vs-artifacts.md
│       └── modules/
│           └── memory/
│               └── init-memory.md
├── meta/
│   └── skills.yaml                  # Metadados de cada skill (name, description em inglês)
└── README.md
```

### Fluxo de dados entre arquivos de metadados

- **`meta/skills.yaml`** → fornece `name` e `description` em inglês para o **frontmatter** dos arquivos gerados (SKILL.md e .toml)
- **`module.yaml`** → fornece `display_name` e `description` bilíngues para o **CLI interativo** (texto que o usuário vê no terminal durante a instalação)

### meta/skills.yaml — Metadados compartilhados

```yaml
core:
  fix:
    name: as-fix
    description: "Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior."
  resume:
    name: as-resume
    description: "Investigate project context and generate a handoff prompt for a clean session."
  save-and-push:
    name: as-save-and-push
    description: "Review conversation, save learnings to memory, commit and push work."
  review-plan-internal:
    name: as-review-plan-internal
    description: "Adversarial review of an implementation plan for gaps and risks."
  review-plan-vs-artifacts:
    name: as-review-plan-vs-artifacts
    description: "Adversarial review comparing plan against actual generated artifacts."

modules:
  memory:
    init-memory:
      name: as-init-memory
      description: "Initialize persistent memory structure for cross-session context."
```

### Módulo — module.yaml

```yaml
name: memory
display_name:
  pt: Memória
  en: Memory
description:
  pt: |
    Sistema de memória persistente entre sessões.
    O agente salva aprendizados, decisões e feedback entre conversas,
    mantendo contexto entre sessões diferentes.
  en: |
    Persistent memory system across sessions.
    The agent saves learnings, decisions and feedback between conversations,
    maintaining context across different sessions.
variables:
  memory_path:
    description:
      pt: Diretório da memória
      en: Memory directory
    default: .ai/memory/
```

## 7. Fluxo do instalador

### 7.1. Primeira instalação

```
$ npx @henryavila/atomic-skills install

  ⚛ Atomic Skills — Stop rewriting prompts.

  Language / Idioma:
  ◉ Português (BR)
  ◯ English

  Quais IDEs você usa?
  ◉ Claude Code
  ◉ Cursor
  ◯ Gemini CLI
  ◯ Codex
  ◯ OpenCode
  ◯ GitHub Copilot

  ─── Módulos opcionais ───

  📦 Memória
  Sistema de memória persistente entre sessões.
  O agente salva aprendizados, decisões e feedback entre conversas,
  mantendo contexto entre sessões diferentes.

    1) Instalar com padrão (.ai/memory/)
    2) Escolher diretório customizado
    3) Não instalar

  > 1

  Instalando...
  ✓ .claude/skills/as-fix/SKILL.md
  ✓ .claude/skills/as-resume/SKILL.md
  ✓ .claude/skills/as-save-and-push/SKILL.md
  ✓ .claude/skills/as-review-plan-internal/SKILL.md
  ✓ .claude/skills/as-review-plan-vs-artifacts/SKILL.md
  ✓ .claude/skills/as-init-memory/SKILL.md
  ✓ .cursor/skills/as-fix/SKILL.md
  ✓ .cursor/skills/as-resume/SKILL.md
  ✓ .cursor/skills/as-save-and-push/SKILL.md
  ✓ .cursor/skills/as-review-plan-internal/SKILL.md
  ✓ .cursor/skills/as-review-plan-vs-artifacts/SKILL.md
  ✓ .cursor/skills/as-init-memory/SKILL.md
  ✓ .atomic-skills/ adicionado ao .gitignore

  ⚛ 6 skills instalados para 2 IDEs (12 arquivos).
```

### 7.2. Atualização (re-run)

```
$ npx @henryavila/atomic-skills install

  ⚛ Atomic Skills — Stop rewriting prompts.

  Configuração anterior encontrada (.atomic-skills/manifest.json).
  Idioma: pt | IDEs: Claude Code, Cursor | Módulos: Memória (.ai/memory/)

  Usar mesma configuração? (s/n)
  > s

  Atualizando...

  ⚠ .claude/skills/as-fix/SKILL.md foi modificado localmente.
    1) Sobrescrever (perder mudanças locais)
    2) Manter versão local
    3) Ver diff

  > 3

  [diff mostrado]

  > 1

  ✓ 12 arquivos atualizados.
  ⚛ Atualização completa. v1.0.0 → v1.1.0
```

Se o usuário responde `n` em "Usar mesma configuração?", o fluxo volta para a seleção de idioma/IDEs/módulos, permitindo adicionar ou remover IDEs e módulos.

**Remoção de IDEs/módulos no re-install:** se o usuário desseleciona uma IDE ou módulo que estava instalado, o instalador remove os arquivos correspondentes e atualiza o manifest. Core skills são re-renderizados sem os blocos condicionais dos módulos removidos.

### 7.3. Desinstalação

```
$ npx @henryavila/atomic-skills uninstall

  ⚛ Removendo Atomic Skills...

  Remover arquivos gerados? (s/n) s

  ✓ 12 arquivos removidos.
  ✓ .atomic-skills/manifest.json removido.
  ℹ Entrada .atomic-skills/ mantida no .gitignore (segurança).

  ⚛ Desinstalação completa.
```

**Nota:** a entrada `.atomic-skills/` no `.gitignore` é mantida após uninstall para evitar commit acidental de arquivos remanescentes.

## 8. Manifest

O instalador gera `.atomic-skills/manifest.json` na raiz do projeto.
Na primeira instalação, o instalador adiciona `.atomic-skills/` ao `.gitignore` automaticamente (se não estiver presente).

```json
{
  "version": "1.0.0",
  "language": "pt",
  "installed_at": "2026-03-22T14:30:00Z",
  "updated_at": "2026-03-22T14:30:00Z",
  "ides": ["claude-code", "cursor"],
  "modules": {
    "memory": {
      "installed": true,
      "config": {
        "memory_path": ".ai/memory/"
      }
    }
  },
  "files": {
    ".claude/skills/as-fix/SKILL.md": {
      "installed_hash": "sha256:a1b2c3d4...",
      "source": "core/fix"
    },
    ".claude/skills/as-resume/SKILL.md": {
      "installed_hash": "sha256:e5f6g7h8...",
      "source": "core/resume"
    }
  }
}
```

### Lógica de detecção de modificação local

Na atualização, para cada arquivo no manifest:

1. Renderizar o novo conteúdo do skill (da nova versão do pacote) → `new_hash`
2. Ler o hash no manifest → `installed_hash` (o que foi gravado na última instalação)
3. Calcular hash do arquivo em disco → `current_hash`

| `current_hash` == `installed_hash`? | `installed_hash` == `new_hash`? | Ação |
|-------------------------------------|--------------------------------|------|
| Sim | Sim | Nada a fazer (arquivo não mudou em nenhum lado) |
| Sim | Não | Sobrescrever silenciosamente (sem edição local, conteúdo novo) |
| Não | Sim | Nada a fazer (editado localmente mas pacote não mudou) |
| Não | Não | **Conflito** — perguntar ao usuário (sobrescrever / manter / diff) |

O `installed_hash` no manifest só é atualizado quando o arquivo é efetivamente escrito (casos 2 e 4-sobrescrever). Quando o arquivo é mantido (caso 3, caso 4-manter), o hash não muda.

A versão exibida no final (ex: `v1.0.0 → v1.1.0`) vem do `version` no `package.json` do pacote npm.

## 9. Variáveis injetadas

Quando um módulo define variáveis (como `memory_path`), o instalador faz substituição em todos os skills que referenciam essa variável.

**Exemplo:** se o usuário escolhe `.context/mem/` como diretório de memória:

```
# No skill fonte (skills/pt/modules/memory/init-memory.md):
Crie a estrutura em `{{memory_path}}` com MEMORY.md como índice.

# No arquivo gerado:
Crie a estrutura em `.context/mem/` com MEMORY.md como índice.
```

A substituição acontece em **todos** os skills (core e módulos) que referenciam `{{memory_path}}`.

### Referências condicionais entre skills

Alguns skills referenciam skills de módulos opcionais. Essas referências usam blocos condicionais:

```markdown
{{#if modules.memory}}
Se `{{memory_path}}` não existir, rode `as-init-memory` primeiro.
{{/if}}
```

Se o módulo memory não foi instalado, o bloco inteiro é removido do skill gerado.

### Sintaxe de template suportada (v1)

O renderizador usa substituição de string simples, **não** um template engine. Sintaxe suportada:

| Sintaxe | Função | Exemplo |
|---------|--------|---------|
| `{{var}}` | Substituição de variável | `{{memory_path}}` → `.ai/memory/` |
| `{{#if modules.X}}...{{/if}}` | Bloco condicional (1 nível, sem nesting) | Remove bloco se módulo X não instalado |

**Limitações explícitas:**
- Sem `{{#else}}` — se precisar de lógica alternativa, usar dois blocos `{{#if}}`
- Sem nesting de condicionais
- Linhas vazias deixadas por blocos removidos são stripadas automaticamente

## 10. Adaptação dos skills existentes

Os 6 commands `hca-*` restantes serão adaptados para `as-*` (o 7º, `hca-refactor-prompt`, é removido do v1 — ver nota abaixo):

| Atual (hca-) | Novo (as-) | Tipo |
|--------------|------------|------|
| hca-fix | as-fix | Core |
| hca-resume | as-resume | Core |
| hca-save-and-push | as-save-and-push | Core |
| hca-review-plan-internal | as-review-plan-internal | Core |
| hca-review-plan-vs-artifacts | as-review-plan-vs-artifacts | Core |
| hca-init-memory | as-init-memory | Módulo: Memory |

**Nota:** `hca-refactor-prompt` é removido do v1. É um meta-command que depende de KB específica (`docs/kb/mapa-tecnicas.md`, `docs/kb/estrutura-canonica-commands.md`). Pode retornar como módulo futuro com KB bundled.

### Adaptações necessárias nos prompts:

1. **Remover referências a `hca-`**: todas as menções a `/hca-*` dentro dos prompts viram referências genéricas ao nome do skill (ex: "rode `as-init-memory`" em vez de "rode `/hca-init-memory`"). Evitar prefixo de invocação (`/` ou `$`) no corpo do prompt, pois a sintaxe varia entre IDEs
2. **Parametrizar `memory_path`**: referências hardcoded a `.ai/memory/` viram `{{memory_path}}`
3. **Condicionar referências ao módulo memory**: usar `{{#if modules.memory}}` para referências a `as-init-memory` e `{{memory_path}}`
4. **Remover dependências do setup pessoal**: referências a `nexus.yaml`, estrutura específica do autor, etc.
5. **Manter as técnicas (T01-T23)**: Iron Laws, HARD-GATEs, Red Flags, Racionalização — tudo permanece intacto
6. **Traduzir para inglês**: criar versões `en/` de cada skill
7. **Remover lógica platform-specific do init-memory**: o skill atual usa symlinks (`ln -s`) e paths do Claude Code (`~/.claude/projects/`). A versão `as-init-memory` deve criar o diretório de memória e MEMORY.md de forma genérica, sem assumir IDE ou OS específico

## 11. Decisões técnicas

### 11.1. Dependências mínimas
O pacote npm deve funcionar com `npx` sem instalar nada globalmente. A única dependência de runtime é `inquirer` (ou alternativa leve como `prompts`) para a UI interativa. Sem template engine — a renderização usa string replacement simples (`{{var}}` → valor, `{{#if}}...{{/if}}` → condicional).

### 11.2. Cross-platform
- O instalador é Node.js puro — funciona em Linux, macOS e Windows sem WSL
- Sem shell scripts, sem symlinks, sem dependência de bash
- Paths usam `path.join()` (nunca hardcoded com `/`)

### 11.3. Idempotência
- Rodar `npx @henryavila/atomic-skills install` múltiplas vezes é seguro
- O manifest garante que o estado é rastreável
- Lógica de 3 hashes determina ação correta (ver seção 8)

### 11.4. Sem side-effects fora do projeto
- O instalador só escreve dentro do diretório do projeto (cwd)
- Não modifica diretórios globais (`~/.claude/`, `~/.cursor/`, etc.)
- Cada projeto tem sua própria instalação
- Única exceção: adiciona `.atomic-skills/` ao `.gitignore` se não presente

### 11.5. Tratamento de erros
- Sem permissão de escrita → mensagem clara e saída
- Ctrl+C durante instalação → o instalador mantém uma lista em memória dos arquivos criados nesta execução; no handler de SIGINT, remove esses arquivos e não salva o manifest (instalação é atômica — ou completa ou não deixa rastros)
- Arquivo conflitante já existe (não gerado pelo Atomic Skills) → avisa e pede confirmação antes de sobrescrever

## 12. Fora do escopo (v1)

- Instalação global (skills disponíveis em todos os projetos)
- CLI para criar novos skills (`atomic-skills create`)
- Marketplace / registry de skills da comunidade
- Suporte a IDEs além das 6 listadas
- Versionamento por skill individual (todos seguem a versão do pacote)
- `--dry-run` e `--non-interactive` flags (podem ser adicionados em v2)
- Idiomas além de pt/en
- Módulo `refactor-prompt` (depende de KB bundled — avaliar em v2)
