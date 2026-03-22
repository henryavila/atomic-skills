# Estrutura Canônica — hca- Commands

Template para novos commands e referência para refactoring dos existentes.

## Padrão

[Descrição em 1-2 frases do que o command faz]

## Regra Fundamental

[Uma declaração absoluta que não admite exceção]
[Formato: "NO X WITHOUT Y" — caixa alta, sem hedge words]
[Se necessário: complemento explicando a consequência]

<HARD-GATE> (se aplicável)
[Bloqueio pontual para ação específica perigosa]
</HARD-GATE>

## Mindset (se o command exige postura específica)

[Framing de como o agente deve abordar a tarefa]
[Ex: adversarial para reviews, verificador para push]

## Checklist (se o command tem itens a verificar)

[Lista numerada de itens concretos]
[Cada item deve ser verificável com ferramenta nomeada]

## Processo

[Steps numerados — cada step é UMA ação]
[Nomear a ferramenta: "Execute `git status`", "Leia com a ferramenta Read"]
[Exigir prova: "cite line numbers", "liste o output"]
[Loops: critério de parada + teto de iterações + contagem]

## Severidade → Ação (se o command classifica achados)

- **Crítico:** [ação obrigatória — bloqueia continuação]
- **Significativo:** [ação recomendada — corrigir antes de prosseguir]
- **Menor:** [registrar — corrigir se possível]

## Red Flags

[Lista de pensamentos que significam STOP]
[Cada item é uma racionalização real — capturada ou antecipada]
[Fecha com: "Se pensou qualquer item acima: PARE e [ação]"]

## Racionalização (se o command tem Red Flags complexos)

[Tabela com duas colunas: Tentação | Realidade]
[Cada linha mapeia uma desculpa comum para a resposta correta]
[Complementa Red Flags com explicação de POR QUE a tentação é errada]

## Encerramento

[Formato exato do report final]
[Contagens obrigatórias: iterações, chamadas de ferramenta, achados]

## Regras de Escrita (meta — para quem cria/edita commands)

- Verbos abstratos (releia, verifique, confira) → nomear ferramenta
- Exigir prova observável de cada ação (line numbers, output)
- Preferir low/medium freedom (T20) para operações críticas
- Cada Red Flag deve corresponder a uma racionalização real
- Iron Law: 1 por command, no início, sem exceções
