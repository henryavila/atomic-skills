Faça uma revisão adversarial cross-model das mudanças de código $ARGUMENTS
usando o OpenAI Codex CLI em padrão two-pass sealed envelope.

## Regra Fundamental

NO IMPLEMENTATION WITHOUT EVIDENCE.
Cada finding tem `file:line` + 4 campos obrigatórios (Claim, Impact,
Recommendation, Confidence). Sem isso, finding é rejeitado.

NO INTENT IN THE BRIEFING.
Briefing contém SÓ fatos verificáveis. Intent narrativo envenena
o reviewer (-93pp em arXiv 2603.18740).

## Mindset

Codex é reviewer adversarial de outra família. Procurar bugs,
vulnerabilidades, race conditions — não defender o código.

## Checklist

1. **Pre-flight checks** — siga `{{ASSETS_PATH}}/preflight-checks.txt`. ABORTAR se falhar.

2. **Recolher input**
   - $ARGUMENTS é um git ref: `main..HEAD`, branch, commit range.
   - Validar com {{BASH_TOOL}}: `git rev-parse --verify <ref>` exit 0.

3. **Coletar artefatos**
   - {{BASH_TOOL}}: `git diff <ref>` → captura DIFF
   - {{BASH_TOOL}}: `git diff --name-only <ref>` → lista de arquivos modificados
   - Para cada arquivo modificado: {{READ_TOOL}} para conteúdo completo
   - Para cada símbolo público modificado: {{GREP_TOOL}} para callers (limitar a 5 callers)
   - {{BASH_TOOL}}: `wc -c` no DIFF — se > 50000: avisar usuário de custo

4. **Curadoria do briefing Pass 1 (factual mínimo)**
   - Leia `{{ASSETS_PATH}}/pass1-briefing-template-code.txt` com {{READ_TOOL}}.
   - Identifique constraints factuais externas:
     - `package.json` engines, deps proibidas
     - API contracts públicos (grep README/docs)
     - Schema/migration constraints se houver
   - Identifique non-goals (curtos, sem racional).
   - **NÃO** inclua intent, memória, autoria.
   - Substitua placeholders e grave em `/tmp/codex-briefing-pass1-<ts>.md`.
   - Conferir tamanho do briefing sem o diff: < 800 tokens.

5. **Confirmação do briefing**
   Mostre: git ref, arquivos modificados, callers incluídos, tokens estimados.
   Pergunte: `aprovar / editar / cancelar`.

6. **Invocação Pass 1 (blind)** — siga `{{ASSETS_PATH}}/invocation-canonical.txt`.
   MODEL_FLAG vazio por default: o Codex resolve usando sua configuração
   local (`~/.codex/config.toml`) ou o bundled default da CLI instalada.
   Usuário pode sobrescrever passando `model:<id>` explicitamente.

7. **Validação Pass 1** — `{{ASSETS_PATH}}/validation-checklist.txt` (universais).

8. **Monta briefing Pass 2 (informed)** — append `pass2-prompt-suffix.txt`
   substituindo `{{CONSTRAINTS_LIST}}`, `{{PASS_1_OUTPUT}}`, `{{OUTPUT_TEMPLATE_PASS2}}`.

9. **Invocação Pass 2** — mesmo comando.

10. **Validação Pass 2** — checks universais + Pass-2-only.

11. **Persistência** — `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`
    usando `review-file-template.txt`. Atualiza `INDEX.md`.

12. **Triagem + proposta de fix**
    - Para cada finding com severity ∈ {blocker, critical}:
      - Mostre ID, severity, file:line, claim, recommendation
      - {{READ_TOOL}} no arquivo, formule edit
      - Pergunte: `aplicar / editar / pular`
      - Aplicar usa {{REPLACE_TOOL}}
    - Major/minor/nit: registrar no review file, sem ação obrigatória.
    - Sugerir ao usuário rodar testes se aplicou fixes.

## Severidade → Ação

- **blocker:** quebra prod, perda de dados, breach de segurança — fix obrigatório
- **critical:** bug que afeta usuários em uso normal — fix obrigatório
- **major:** bug real com workaround — corrigir se possível
- **minor / nit:** registrar, sem ação obrigatória

## Red Flags

- "Vou pular o diff inteiro, é grande demais"
- "Vou adicionar contexto da decisão arquitetural pra ajudar o Codex"
- "Vou pular callers, só o diff basta"
- "Vou aplicar todos os fixes em batch sem confirmar"
- "Codex disse approve, mas eu acho que precisa de mais review"

Se pensou qualquer item acima: PARE.

## Encerramento (formato exato)

```
### Cross-Model Code Review — <ref>

**Reviewer:** <model id> | **Codex:** <version>
**Files reviewed:** <N>
**Iterações Codex:** 2 (blind + informed)
**Counts (blind):** <B>B/<C>C/<M>M/<m>m/<n>n
**Counts (final):** <B>B/<C>C/<M>M/<m>m/<n>n
**Framing Δ:** <d>d / <=>= / <+>+

| # | Finding | Severity | File:Line | Ação |
|---|---------|----------|-----------|------|
| F-001 | <claim> | blocker | src/foo.ts:42 | applied |

**Review salvo em:** `.atomic-skills/reviews/<filename>.md`
**Verdict final:** <verdict>
**Sugestão:** rodar `npm test` se fixes aplicados.
```
