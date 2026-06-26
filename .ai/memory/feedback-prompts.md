# Feedback — Escrita de Prompts

## Instruções vagas são ignoradas
Regras como "itere até não haver mais erros" sem estrutura explícita levam o Claude a fazer uma passada só e parar.
**Why:** Observado ao rodar hca-review-plan-internal — o Claude admitiu que não iterou.
**How to apply:** Sempre estruturar processos repetitivos como loops explícitos com:
1. Passo de execução
2. Passo de verificação (releitura do resultado)
3. Critério de parada claro ("se não encontrou nada novo, pare")
4. Exigir reporte de quantas iterações foram feitas (força o comportamento)

## Para garantir ações específicas da IA, nomeie a ferramenta e exija prova
O agente interpreta instruções em termos de *resultado* ("releia o plano") como operações mentais, não ações reais. Dizer "releia" não garante uma chamada de Read. Dizer "verifique" não garante um grep.
**Why:** Observado em 2026-03-21 — dois usos do hca-review-plan-internal mostraram que o agente reportava "3 iterações" mas admitia que eram lineares, sem releitura real do arquivo. Corrigido nomeando a ferramenta + exigindo evidência (line numbers). Confirmado que funcionou após a correção.
**How to apply:** Quando o prompt precisa que a IA execute uma ação concreta (não apenas "pense sobre"):
1. **Nomeie a ferramenta:** "usando a ferramenta Read" em vez de "releia"
2. **Exija prova observável:** "cite line numbers" / "mostre o output" — se não executou, não tem o que citar
3. **Peça contagem de chamadas:** "quantas chamadas Read foram feitas" — força consciência sobre o comportamento real
4. Verbos abstratos (releia, verifique, confira, valide) são interpretados como operações mentais. Verbos concretos + nome da ferramenta são interpretados como ações.

## Agentes seguem checklists e diagramas, não prosa
Instruções escritas em prosa narrativa (parágrafos, seções descritivas) são menos seguidas do que checklists numerados e diagramas de fluxo (graphviz dot).
**Why:** Descoberto no superpowers v5.0.5 — o brainstorming skill tinha a etapa "spec review loop" documentada na prosa ("After the Design") mas faltava no checklist e no diagrama dot. O resultado: agentes pulavam a etapa sistematicamente. Foi corrigido adicionando a etapa ao checklist (item 7/9) e ao grafo dot, e só então passou a funcionar.
**How to apply:** Ao escrever skills/commands, toda etapa que PRECISA ser executada deve estar em:
1. **Checklist numerado** (a fonte primária que o agente segue)
2. **Diagrama de fluxo** (se aplicável — reforço visual da sequência)
3. Prosa pode complementar com contexto e explicação, mas NUNCA ser o único lugar onde uma etapa obrigatória está definida

## Checkpoint recuperável exige commit, não só handoff
Quando o usuário pede rastreabilidade, "snapshot" em skill de execução precisa significar microcommit por caminhos explícitos. Um handoff que apenas lista arquivos sujos vira relato de acidente: a próxima sessão ainda precisa inferir o que é próprio da task, o que é state update e o que é sujeira alheia.
**Why:** Em 2026-06-25, o fluxo `implement`/`project-transitions` fechava task/fase e escrevia `.atomic-skills/`, mas aceitava "Uncommitted changes" como snapshot. O usuário apontou que isso quebrou rastreamento e pediu microcommits automáticos. A correção foi transformar microcommit em Iron Law/checklist: commit da implementação após verifier PASS, `done`, commit separado do estado, e phase-boundary commits no `phase-done`.
**How to apply:** Para workflows de execução:
1. Defina o checkpoint no checklist como `git add <paths explícitos>` + `git commit`, não como "salvar handoff".
2. Proíba `git add .` / `git add -A` no ponto de maior tentação.
3. Separe commit de implementação do commit de `.atomic-skills/`/estado para permitir bisect e auditoria.
4. Se existirem arquivos sujos fora do escopo, deixe-os unstaged e reporte; não use o checkpoint para varrer sujeira alheia.
