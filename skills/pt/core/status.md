Rastreie o andamento do workstream atual com evidências concretas.

## Regra Fundamental

NO STATUS WITHOUT EVIDENCE.
Não trate inferência como verdade. Se algo não estiver confirmado, diga isso
explicitamente e mostre a evidência usada.

## Processo

### 1. Resolver contexto

- Leia `docs/superpowers/status/_map.yml`, se existir.
- Leia `docs/superpowers/status/index.md` e o arquivo detalhado do workstream, se existirem.
- Identifique workstreams candidatos.

### 2. Resolver o workstream

- Trabalhe com um workstream por vez.
- Se houver ambiguidade real entre candidatos plausíveis, pergunte qual workstream o usuário quer inspecionar.
- Se houver um workstream dominante com evidência suficiente, siga direto.

### 3. Descobrir artefatos e coletar evidências

- Use `_map.yml` primeiro e heurísticas só como fallback.
- Não assuma paths fixos para design, spec ou plano.
- Ao resolver identidade e mapeamento, use esta precedência:
  1. correção explícita do usuário nesta sessão
  2. `_map.yml`
  3. arquivo canônico do workstream
  4. `index.md`
  5. heurísticas
- Ao resolver estado do workstream, use esta precedência:
  1. correção explícita do usuário nesta sessão
  2. arquivo canônico do workstream
  3. `index.md`
  4. estado provisório derivado de evidências
  5. heurísticas
- Colete evidências em git, diff, testes, revisões, validações e artefatos do projeto.

### 4. Classificar o estado

- Use estas etapas canônicas:
  - `Design`
  - `Especificação`
  - `Planejamento`
  - `Implementação`
  - `Verificação`
  - `Finalização`
- Mantenha `estado` e `confiança` separados.
- Estados visíveis no relatório:
  - `não começou`
  - `em andamento`
  - `bloqueado`
  - `concluído`
  - `ignorado`
  - `não se aplica`
- Classes de confiança:
  - `confirmed`
  - `inferred`
  - `unknown`
- Conte `reviews` por etapa separadamente de `verificações`.
- Não deixe conclusão inferida e não confirmada aumentar o progresso estrutural.

### 5. Tratar inferências pendentes

- Mostre uma inferência por vez.
- Liste a hipótese e as evidências concretas.
- Peça ao usuário para `confirmar`, `rejeitar` ou `adiar`.
- Se o usuário rejeitar uma inferência, corrija o estado canônico e `_map.yml` quando o erro for de mapeamento.

### 6. Oferecer persistência canônica

- Se a execução melhorar materialmente a clareza, ofereça atualizar:
  - `docs/superpowers/status/index.md`
  - `docs/superpowers/status/<workstream>.md`
  - `docs/superpowers/status/_map.yml`, quando regras de descoberta precisarem ser corrigidas
- Não force escrita em leituras comuns sem mudança de entendimento canônico.

### 7. Emitir o relatório final

Formate o relatório para leitura rápida em CLI:

- Primeira linha: nome do workstream em caixa alta, sem rótulo.
- Depois:
  - `Repo: ...`
  - `Data: ...`
- Use títulos de bloco em caixa alta. Se o cliente suportar ANSI de forma visível, você pode colorir apenas os títulos. O relatório precisa continuar legível sem cor.
- Dentro de cada bloco, inicie os campos com letra maiúscula.
- Nunca use IDs internos como `Task 1` na visão principal. Sempre traduza para ações humanas concretas.

Ordem dos blocos:

1. `RESUMO`
2. `INFERÊNCIA PENDENTE`, só quando existir
3. `PIPELINE`
4. `FEITO`
5. `EM ANDAMENTO`
6. `PRÓXIMOS`
7. `BLOQUEIOS`
8. `VERIFICAÇÕES POR ETAPA`
9. `EVIDÊNCIAS`, só quando houver ambiguidade, conflito ou inferência relevante

### 8. Formato do RESUMO

Use exatamente estes campos:

- `Objetivo`
- `Agora`
- `Etapa atual`
- `Já foi feito`
- `Ainda falta`
- `Próxima ação`

Mantenha `Já foi feito` e `Ainda falta` curtos e densos. Não transforme o resumo em changelog.

### 9. Formato do PIPELINE

- Mostre sempre as 6 etapas canônicas.
- Use colunas fixas e alinhadas, próprias para terminal.
- Cada linha deve mostrar:
  - etapa
  - estado
  - total de reviews
  - resumo curto
  - próxima ação
- A etapa atual deve ter destaque mais forte, com prefixo visual. Se houver cor visível, ela pode ter cor também.
- Etapas futuras devem aparecer de forma mais discreta.
- `etapa`, `estado` e `reviews` não quebram.
- `resumo curto` e `próxima ação` podem continuar em linha abaixo.
- Quando houver continuação, alinhe a nova linha à esquerda da própria coluna para não parecer layout quebrado.

Exemplo de direção:

```text
PIPELINE
> Design         concluído     reviews: 1   formato definido              -
> Especificação  concluído     reviews: 2   spec aprovada                 -
* Planejamento   em andamento  reviews: 3   plano revisado                salvar versão final
  Implementação  não começou   reviews: 0   metadata e prompts pendentes  registrar skill no catálogo
```

### 10. Formato de VERIFICAÇÕES POR ETAPA

Use um bloco separado, com uma linha por etapa:

```text
VERIFICAÇÕES POR ETAPA
- Design: 0
- Especificação: 1
- Planejamento: 0
- Implementação: 3
- Verificação: 2
- Finalização: 0
```

## Red Flags

- "O arquivo existe, então está concluído"
- "O plano fala uma coisa, mas vou chutar o resto"
- "Posso mostrar `Task 1` no relatório, o usuário entende"
- "Vou esconder a ambiguidade para o relatório parecer limpo"
- "Cor já resolve a legibilidade"

Se pensou qualquer item acima: PARE. Corrija a estrutura do relatório.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Mais detalhe sempre ajuda" | Detalhe sem hierarquia destrói o scan |
| "O pipeline pode carregar tudo" | Pipeline serve para etapa; tarefas concretas ficam fora dele |
| "Se eu inferi com boa confiança, já posso assumir" | Não. Mostre a evidência e peça aprovação |
| "Tabela bonita basta" | Sem estrutura boa, a tabela só organiza a confusão |

## Encerramento

Reporte no fim:
- Workstream analisado
- Fontes usadas
- Inferências pendentes: [quantidade]
- Persistência atualizada: [sim/não, quais arquivos]
