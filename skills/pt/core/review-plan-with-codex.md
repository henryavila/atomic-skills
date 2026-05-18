Faça uma revisão adversarial cross-model do plano $ARGUMENTS usando o
OpenAI Codex CLI em padrão two-pass sealed envelope.

## Regra Fundamental

NO IMPLEMENTATION WITHOUT EVIDENCE.
Cada finding do Codex deve ter `file:line` e os 4 campos (Claim, Impact,
Recommendation, Confidence). Findings sem isso são rejeitados.

NO INTENT IN THE BRIEFING.
Briefing enviado ao Codex contém SÓ fatos verificáveis externamente.
Intent narrativo envenena o reviewer em até -93pp de detecção
(arXiv 2603.18740).

## Mindset

Codex é reviewer adversarial de outra família (GPT). Sua tarefa é
encontrar gaps que o Claude perdeu por self-preference bias
(arXiv 2410.21819). NÃO defenda o plano — facilite a crítica.

## Checklist

1. **Pre-flight checks** — siga `{{ASSETS_PATH}}/preflight-checks.txt`.
   ABORTAR se qualquer check falhar.

2. **Recolher input**
   - $ARGUMENTS deve apontar para um arquivo `.md` existente.
   - Validar com {{READ_TOOL}}: o arquivo existe e tem ≥ 10 linhas.

3. **Curadoria do briefing Pass 1 (factual mínimo)**
   - Leia `{{ASSETS_PATH}}/pass1-briefing-template-plan.txt` com {{READ_TOOL}}.
   - Identifique constraints factuais externas do projeto:
     - {{BASH_TOOL}}: `grep -E "engines|peerDependencies" package.json 2>/dev/null || true`
     - {{BASH_TOOL}}: `head -20 CLAUDE.md README.md 2>/dev/null | grep -iE "must|required|forbidden" || true`
     - Constraints técnicas verificáveis (API contracts, deps proibidas, target runtime)
   - Identifique non-goals (do próprio plano se declarados; do projeto se relevante).
   - **NÃO** inclua intent narrativo, NÃO inclua memória curada, NÃO mencione autoria.
   - Substitua placeholders:
     - `{{ANTI_FRAMING_DIRECTIVE}}` ← conteúdo de `{{ASSETS_PATH}}/anti-framing-directive.txt`
     - `{{NON_GOALS_LIST}}` ← bullet list curto sem racional
     - `{{ARTIFACT_PATH}}` ← path do plano
     - `{{ARTIFACT}}` ← conteúdo do plano lido com {{READ_TOOL}}
     - `{{OUTPUT_TEMPLATE_PASS1}}` ← conteúdo de `{{ASSETS_PATH}}/output-template-pass1.txt`
   - Grave em `/tmp/codex-briefing-pass1-<timestamp>.md`.
   - {{BASH_TOOL}}: medir tokens com `wc -c /tmp/codex-briefing-pass1-<ts>.md`.
     Se (size_bytes / 4) > 800 sem o artefato: WARNING ao usuário —
     provável framing residual; pedir aprovação extra.

4. **Confirmação do briefing**
   Mostre ao usuário em formato compacto:
   - Artefato: `<path>` (`<linhas>` linhas)
   - Constraints factuais: `<lista>`
   - Non-goals: `<lista>`
   - Tokens estimados: `<N>`
   Pergunte: `aprovar / editar / cancelar`. Aguarde resposta.
   Se cancelar: abortar.

5. **Invocação Pass 1 (blind)**
   - Leia `{{ASSETS_PATH}}/invocation-canonical.txt`.
   - Execute o comando substituindo:
     - `<BRIEFING_PATH>` = arquivo do passo 3
     - `<OUTPUT_PATH>` = `/tmp/codex-output-pass1-<ts>.md`
     - `<TIMEOUT_SECONDS>` = 600
     - `<MODEL_FLAG>` = vazio (Codex resolve)
   - Capture exit code. Se 124 (timeout): abortar com mensagem. Se outros !=0: abortar.

6. **Validação Pass 1**
   - Siga `{{ASSETS_PATH}}/validation-checklist.txt` (universais 1-9).
   - Falha → 1 retry corretivo. Falha de novo → escala raw.

7. **Monta briefing Pass 2 (informed)**
   - Briefing = briefing Pass 1 (sem `Begin review now.`) + bloco de
     `{{ASSETS_PATH}}/pass2-prompt-suffix.txt` com:
     - `{{CONSTRAINTS_LIST}}` ← constraints factuais identificadas no passo 3
     - `{{PASS_1_OUTPUT}}` ← conteúdo do output do Pass 1
     - `{{OUTPUT_TEMPLATE_PASS2}}` ← conteúdo de `output-template-pass2.txt`
   - Grave em `/tmp/codex-briefing-pass2-<ts>.md`.

8. **Invocação Pass 2 (informed)**
   - Mesmo comando do passo 5, com `<BRIEFING_PATH>` = arquivo do passo 7
     e `<OUTPUT_PATH>` = `/tmp/codex-output-pass2-<ts>.md`.

9. **Validação Pass 2**
   - Checks universais 1-9 + checks específicos Pass 2 (10-13) do
     `{{ASSETS_PATH}}/validation-checklist.txt`.
   - Falha → 1 retry corretivo. Falha de novo → escala raw.

10. **Persistência**
    - {{BASH_TOOL}}: `mkdir -p .atomic-skills/reviews/`
    - Leia `{{ASSETS_PATH}}/review-file-template.txt`.
    - Substitua placeholders.
    - Grave em `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`.
    - Atualize `.atomic-skills/reviews/INDEX.md` (criar se não existir) com
      a linha do template `{{ASSETS_PATH}}/index-row-template.txt`.

11. **Triagem + proposta de fix**
    - Mostre ao usuário 1 linha: `Verdict: <V> | Counts (final): <C> | Framing Δ: <D> | Salvo em <path>`
    - Se `counts_final.blocker == 0 && counts_final.critical == 0`: encerre.
    - Caso contrário, para cada finding com severity ∈ {blocker, critical}:
      - Mostre: ID, severity, file:line, claim, recommendation
      - Leia o arquivo do plano com {{READ_TOOL}} e formule um edit concreto
      - Pergunte: `aplicar / editar / pular`
      - `aplicar`: use {{REPLACE_TOOL}} no arquivo do plano
      - `editar`: receber nova proposta do usuário, validar e aplicar
      - `pular`: registrar "skipped: <razão>" no append do review file

12. **Encerramento**
    Mostre: `N fixes aplicados, M skipped, P registrados (major/minor). Review: <path>`

## Severidade → Ação

- **blocker / critical:** propor fix imediato; bloqueia "tudo aprovado"
- **major / minor / nit:** registrar no review file; sem ação obrigatória

## Red Flags

- "Vou injetar memória do projeto no briefing pra ajudar o Codex"
- "Vou escrever uma intent steelman pro Codex entender melhor"
- "Vou pular o pre-flight, o codex está instalado"
- "Vou pular a confirmação do briefing pra ir mais rápido"
- "Já validei o output mentalmente, sem precisar do checklist"
- "Vou aplicar todos os fixes sem confirmar com usuário"
- "Verdict é needs_changes, mas vou aprovar mesmo assim"

Se pensou qualquer item acima: PARE e volte ao passo que estava pulando.

## Encerramento (formato exato)

```
### Cross-Model Plan Review — <slug>

**Reviewer:** <model id> | **Codex:** <version>
**Iterações Codex:** 2 (blind + informed)
**Counts (blind):** <B>B/<C>C/<M>M/<m>m/<n>n
**Counts (final):** <B>B/<C>C/<M>M/<m>m/<n>n
**Framing Δ:** <d>d / <=>= / <+>+

| # | Finding | Severity | Ação |
|---|---------|----------|------|
| F-001 | <claim> | blocker | applied / skipped / pending |

**Review salvo em:** `.atomic-skills/reviews/<filename>.md`
**Verdict final:** <verdict>
```
