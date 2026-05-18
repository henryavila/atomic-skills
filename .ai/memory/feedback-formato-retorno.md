---
name: feedback-formato-retorno
description: Para skills interativas (consumo humano + Claude), preferir markdown estruturado + frontmatter YAML mínimo a JSON Schema puro. JSON Schema é para pipeline programático.
type: feedback
---

# Formato de retorno: markdown > JSON para skills interativas

**Regra:** Em skills onde o consumidor primário é humano + Claude conversacional, retornar **markdown estruturado com frontmatter YAML mínimo**, não JSON puro.

**Why:** Em 2026-05-15 trouxe recomendação de JSON Schema (via `--output-schema` do Codex CLI) para skill de cross-model review, baseado em pesquisa que otimizava para "LLM-as-judge alimentando dashboard CI". O usuário questionou: "pq nao um md estruturado?" — e estava certo. Razões:
- Findings com snippets de código ficam ilegíveis em JSON (escape de `"`, `\n`)
- Claude lê markdown nativamente, sem parse
- JSON inválido quebra tudo; markdown degrada gracioso
- Convenção já existente do projeto: `review-plan-internal` retorna tabela markdown
- Edição manual e diff em git são triviais em MD, impraticáveis em JSON

**How to apply:**
1. Para skills interativas (uso humano em IDE): markdown + frontmatter YAML mínimo (`verdict`, `counts`) para os campos que precisam de gate programático. Corpo em markdown rico.
2. Para skills que alimentam pipeline/CI: JSON Schema com `--output-schema` continua a escolha certa.
3. Critério de decisão: **quem é o consumidor primário?** Humano/LLM → markdown; código → JSON.
4. Validação suave: regex simples para presença de headers obrigatórios + parse YAML do frontmatter. Sem `ajv`, sem `--output-schema`.

**Related:**
- [[feedback-prompts]] — Agentes seguem checklists e diagramas, não prosa. Headers fixos em markdown são checklists para o reviewer LLM.
