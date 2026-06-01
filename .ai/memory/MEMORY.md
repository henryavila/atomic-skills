# Memória — claude-commands → Atomic Skills

Repositório de skills otimizados para AI IDEs. Originalmente `hca-` commands, evoluiu para **Atomic Skills** (namespace `atomic-skills/` via subdiretório) — pacote npm multi-IDE.

## Arquivos de memória

- [decisoes-arquitetura.md](decisoes-arquitetura.md) — Padrões definidos: `.ai/memory/`, prefixos, exceção BMAD, regras de KB, organização contextual
- [inventario-projetos.md](inventario-projetos.md) — Levantamento dos padrões de memória em cada projeto do Henry (referência para migração)
- [feedback-prompts.md](feedback-prompts.md) — Lições sobre comportamento do agente: checklists > prosa, loops explícitos, ferramentas nomeadas
- [padroes-testing.md](padroes-testing.md) — Static guards para rename/delete; isolar TODAS as fontes externas (não só a óbvia)
- [feedback-formato-retorno.md](feedback-formato-retorno.md) — Skills interativas: markdown + frontmatter YAML > JSON Schema puro. JSON é só para pipeline CI.
- [feedback-framing-llm-judge.md](feedback-framing-llm-judge.md) — LLM-as-judge: cortar intent narrativo e memória curada do briefing (envenena em -93pp). Só fatos verificáveis.
- [kb-skills-reference.md](kb-skills-reference.md) — Ponteiro para Knowledge Base de técnicas em `docs/kb/`
- [feedback-versioning.md](feedback-versioning.md) — Não inflar versão autonomamente; usuário prefere minor (1.x.y) mesmo para mudanças de schema
- [reference-codex-macos-timeout.md](reference-codex-macos-timeout.md) — Canonical Codex invocation usa `timeout` (GNU); no macOS, usar `perl -e 'alarm N; exec @ARGV'` como wrapper
- [decisao-skills-en-only.md](decisao-skills-en-only.md) — Skill bodies são EN-only; PT é diretiva injetada em runtime pelo renderer. Nunca criar `skills/pt/`.
- [project-roadmap-2026-05-22.md](project-roadmap-2026-05-22.md) — 2 planos sequenciais: `plan-review-skills-consolidation.md` PRIMEIRO, `plan-skills-catalog-v0.2.md` depois. Ordem obrigatória.
- [feedback-skill-body-review-rules.md](feedback-skill-body-review-rules.md) — 3 regras pra revisar skill bodies antes de publicar: run code-review-with-codex pós-impl, grep literal tool names em rationale, parse-flags-first em Step 0.
- [reference-readme-generator-contract.md](reference-readme-generator-contract.md) — README gerado de `meta/catalog.yaml` + `src/config.js` via 5 markers; `module_meta` é irmão de `modules` (não reshape); lint de menções pega drift estático. Subcommands aceitam `group` (agrupa `docs/skills/*`; helpview ignora de propósito). `docs/concepts/project-tracking.md` é hand-written (não regenerado) e é a explicação canônica do modelo Plan/Initiative/Phase/Task.
- [feedback-user-facing-copy.md](feedback-user-facing-copy.md) — User-facing copy (one-liners, descriptions) describes the benefit, not internal paths (`.atomic-skills/`); `one_liner` capped 10–80 chars; a skill's diagram lives in that skill's doc section, not floating at README top.
- [reference-aideck-card-failed-to-load.md](reference-aideck-card-failed-to-load.md) — Card "⊘ failed to load" = HTTP 400 de schema, não bundle velho; fix é no dado. 3 classes de drift (gate `status: done`→`met`, campo obrigatório ausente, `references` sem `kind`/com `title`). Validar contra o RUNTIME (`/api/.../state`), não só `validate-state`. Auto-fix: `src/normalize.js` (puro/idempotente, kind-gated) wired em migrate/project-plan/project-status com fallback inline.
