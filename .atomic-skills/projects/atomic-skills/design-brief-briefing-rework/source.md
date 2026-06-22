# design-brief — repensar o modelo de autoridade do briefing (anti-congelamento de legado)

Reescreve como o `design-brief` confere autoridade a um valor minerado, para que invariantes de produto
vinculem mas incidentais de implementação legada passem como calibração atual que o agente de design pode
melhorar. Conserto ratificado em `design.md` após painel gate-mode (3 vozes + contrária) e crítico
adversarial Aprovado. Duas fases: F0 reescreve a skill + assets + spec canônico (D3–D9); F1, em sessão
nova, regenera o briefing Lekto e contrasta com o feedback (gate de não-reincidência), resolvendo o fork
diferido D10.

## Princípios invioláveis

- **P1 Único vetor** — o agente de design nunca leu o código antigo; toda contaminação entra pelo prompt gerado, logo o conserto é só na skill, nos assets e no spec, nunca no agente.
- **P2 Filtro-primeiro** — minerar a essência comportamental, nunca a mecânica de implementação (px, axis-lock, debounce-ms, copy literal); a mecânica fica fora do escopo de R2 na origem.
- **P3 Camada-é-autoridade** — camada-3 (filosofia/quem-decide) vincula; camada-2 (interação) é a calibração atual com a banda travada e o valor exato melhorável; sem tag nova por valor.
- **P4 Código não vincula** — presença no código marca o valor como atual/referência; só corroboração de intenção de produto eleva um valor a invariante.
- **P5 Sem regressão** — o band-pin trava as duas falhas: nem silêncio (o valor segue declarado) nem sub-especificação (a banda vincula).
- **P6 Tag por evidência** — a tag explícita por valor é upgrade aditivo decidido pela F1, não cravada agora.

## Glossário

- **Camada 1 / 2 / 3** — forma visual (silêncio) / modelo de interação (especificar) / filosofia-quem-decide (guardrail vinculante).
- **Filtro de mineração** — regra negativa em R2: minera a essência comportamental e descarta a mecânica de implementação.
- **Band-pin** — a banda comportamental (cadência da ordem de segundos) vincula; o valor exato (~8s) é o atual, melhorável dentro da banda.
- **Calibração atual** — valor de camada-2 mostrado como o que o app faz hoje, melhorável pelo agente; oposto de silêncio e de requisito.
- **Gate de não-reincidência** — a F1: regenerar o briefing Lekto com a skill reescrita e contrastar com o feedback via crítico adversarial.

## F0 — Refazer (reescrever o modelo de autoridade)

Goal: aplicar D3–D9 em design-brief.md, nos quatro assets de design-brief-assets e no spec canônico three-layer-briefing.md, sem regredir os invariantes legítimos.

### T-001 Filtro de mineração em R2: minerar essência, nunca mecânica (D3)

- Files: docs/design/design-brief-three-layer-briefing.md, skills/core/design-brief.md
- scopeBoundary: edita só o texto de R2 (mineração) nesses dois arquivos; não toca R8/fixtures, R1, R4, R7, nem o passo de reconstrução app-map (Step 2).
- acceptance: R2 nomeia "minerar a essência comportamental, nunca a mecânica de implementação"; lista px / axis-lock / debounce-ms / copy literal como fora de escopo; traz um exemplo canônico de des-indução de uma constante para a essência.
- verifier: { kind: shell, command: "grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md && grep -qi 'debounce' skills/core/design-brief.md", expectExitCode: 0 }
- RED→GREEN: grep por "axis-lock"/"debounce" falha no spec/skill atuais (a mecânica nunca foi marcada fora-de-escopo); depois do filtro em R2, passa.

### T-002 Preâmbulo R9 reescrito para duas autoridades + band-pin (D4, D5)

- Files: skills/shared/design-brief-assets/screens-prompt.md, docs/design/design-brief-three-layer-briefing.md
- scopeBoundary: edita só o preâmbulo R9 e o §4 "Modelo de interação" no screens-prompt mais o texto de R9 no spec; não toca as outras sete seções por tela nem a regra R4 de vocabulário proibido.
- acceptance: o preâmbulo declara camada-3 vinculante e camada-2 como calibração-atual; o §4 expressa "a banda comportamental vincula, o valor exato é melhorável"; o carimbo único de "tudo vinculante" some.
- verifier: { kind: shell, command: "grep -qi 'calibra' skills/shared/design-brief-assets/screens-prompt.md && grep -qi 'banda' skills/shared/design-brief-assets/screens-prompt.md", expectExitCode: 0 }
- RED→GREEN: grep por "calibra"/"banda" falha no screens-prompt atual (preâmbulo achata tudo em vinculante); depois da reescrita, passa.

### T-003 Código não vincula + invariantes de camada-2 roteados para guardrail R6 (D6, D7)

- Files: docs/design/design-brief-three-layer-briefing.md, skills/shared/design-brief-assets/anti-contamination.md
- scopeBoundary: adiciona a cláusula de proveniência a R2 e a regra de roteamento a R6 e ao §6; não reescreve R1, R4, R7 nem R8.
- acceptance: o spec afirma "presença no código vira atual/referência; invariante exige corroboração de intenção de produto"; documenta "~3 níveis" como guardrail R6, não como referência crua.
- verifier: { kind: shell, command: "grep -qi 'proveni' docs/design/design-brief-three-layer-briefing.md && grep -qi 'corrobora' docs/design/design-brief-three-layer-briefing.md", expectExitCode: 0 }
- RED→GREEN: grep por "proveni"/"corrobora" falha no spec atual; depois da cláusula código-não-vincula, passa.

### T-004 Copy literal para a lane de textura + roteamento em R4 (D8 + Q-D8 do crítico)

- Files: skills/shared/design-brief-assets/fixtures-recipe.md, skills/shared/design-brief-assets/screens-prompt.md
- scopeBoundary: adiciona ao fixtures-recipe uma lane "copy literal como conteúdo real porém mutável" e roteia copy no R4; não reformula a ladder de fontes reais de R8 nem o resto do fixtures-recipe.
- acceptance: o fixtures-recipe ganha uma lane nomeada para copy literal marcada como mutável; o R4 do screens-prompt manda substituir copy literal pelo ato-de-fala e tratá-la como textura.
- verifier: { kind: shell, command: "grep -qi 'copy' skills/shared/design-brief-assets/fixtures-recipe.md && grep -q 'ato-de-fala' skills/shared/design-brief-assets/screens-prompt.md", expectExitCode: 0 }
- RED→GREEN: o fixtures-recipe atual não menciona copy e o screens-prompt não tem "ato-de-fala"; depois do roteamento, ambos passam.

### T-005 Alinhar o §6 checklist e a tabela DEFINE/DECIDE ao novo modelo; validate-skills verde

- Files: skills/shared/design-brief-assets/anti-contamination.md, skills/core/design-brief.md
- scopeBoundary: edita só o §6 checklist e a tabela DEFINE/DECIDE para refletir D3–D8; não altera a tabela de três camadas.
- acceptance: o §6 inclui "nenhuma constante de mecânica ou copy literal emitida como requisito" e "todo valor de camada-2 é calibração-com-banda OU rastreia intenção"; `npm run validate-skills` passa.
- verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
- RED→GREEN: roda validate-skills antes (verde de base) e depois das edições (segue verde, confirmando que nenhuma edição quebrou o schema da skill).

```yaml
exit_gate:
  - id: F0-G1
    description: "design-brief.md, os quatro assets e o spec canonico aplicam D3-D9 e validate-skills passa."
    verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
  - id: F0-G2
    description: "Regressao de autoridade fechada: o filtro de mineracao esta presente e o preambulo expoe duas autoridades."
    verifier: { kind: shell, command: "grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md && grep -qi 'calibra' skills/shared/design-brief-assets/screens-prompt.md", expectExitCode: 0 }
```

## F1 — Validar (regenerar o briefing Lekto + contrastar = gate de não-reincidência)

Goal: em sessão nova, regenerar o briefing do Lekto com a skill reescrita, destilar a rubrica dos padrões transversais do feedback, contrastar via crítico adversarial e resolver o fork diferido D10.

### T-001 Regenerar o briefing Lekto com a skill reescrita (sessão nova)

- Files: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md
- scopeBoundary: roda a skill design-brief contra o app Lekto e grava o briefing regenerado no caminho declarado; não edita a skill nem os assets nesta fase.
- acceptance: o briefing regenerado existe no caminho declarado; cobre as telas citadas no feedback (Revisão, Login, Waitlist, Deck público, Explorar); está em pt-BR.
- verifier: { kind: shell, command: "test -f .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md", expectExitCode: 0 }
- RED→GREEN: o arquivo não existe antes da regeneração; depois de rodar a skill reescrita, existe.

### T-002 Destilar a rubrica de não-reincidência dos padrões transversais do feedback (D9)

- Files: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md
- scopeBoundary: converte cada padrão transversal do feedback num anti-sinal detectável; não roda a skill nem o crítico.
- acceptance: a rubrica lista cada padrão transversal do feedback como item verificável; inclui os quatro contaminantes documentados (limiar de swipe, axis-lock, a copy "Vai!", 3 passos de onboarding) como anti-sinais explícitos.
- verifier: { kind: shell, command: "test -f .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md", expectExitCode: 0 }
- RED→GREEN: o arquivo da rubrica não existe antes; depois da destilação, existe.

### T-003 Crítico adversarial: contrastar briefing regenerado vs feedback (gate)

- Files: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
- scopeBoundary: roda um crítico fresco com o feedback, a rubrica e o briefing regenerado e persiste o veredito; não corrige a skill aqui (correções viram follow-up em T-004).
- acceptance: o veredito existe e classifica cada item da rubrica como ausente ou presente; afirma explicitamente se algum dos quatro contaminantes reaparece; grava o marcador NAO-REINCIDENTE quando nenhum reaparece.
- verifier: { kind: shell, command: "test -f .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md", expectExitCode: 0 }
- RED→GREEN: o veredito não existe antes; depois do contraste, existe e carrega o marcador de reincidência.

### T-004 Resolver o fork diferido D10 (escalar para a tag se houver sobre-vínculo)

- Files: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
- scopeBoundary: registra a resolução de D10 no design.md (questão aberta (a)) com base no veredito da F1; se escalar, abre follow-up; não reescreve as outras decisões.
- acceptance: o design.md registra D10 resolvido (modelo leve basta OU tag necessária) citando o veredito da F1, com o marcador F1-D10-RESOLVED; se a resolução for "tag necessária", há um follow-up emergido.
- verifier: { kind: shell, command: "grep -q 'F1-D10-RESOLVED' .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md", expectExitCode: 0 }
- RED→GREEN: o design.md não contém o marcador F1-D10-RESOLVED antes; depois de registrar a resolução, contém.

```yaml
exit_gate:
  - id: F1-G1
    description: "Briefing Lekto regenerado e contrastado; o veredito de nao-reincidencia existe e nenhum dos quatro contaminantes documentados reaparece como requisito."
    verifier: { kind: shell, command: "grep -q 'NAO-REINCIDENTE' .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md", expectExitCode: 0 }
  - id: F1-G2
    description: "Fork D10 resolvido e registrado no design.md."
    verifier: { kind: shell, command: "grep -q 'F1-D10-RESOLVED' .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md", expectExitCode: 0 }
```
