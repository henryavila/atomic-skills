# Handoff de design — redesign do dashboard atomic-skills

Brief para o **design agent** repensar o dashboard **do zero**. Ele entrega **apenas** o
**propósito** do dashboard e **como os dados existem e se relacionam** (a hierarquia), mais
**dados reais** para dar contexto.

**Deliberadamente fora deste brief:** telas, páginas, "o que cada tela tem", arranjo, cor,
estilo, espaçamento, layout. Tudo isso é **decisão do design** — pensado do zero. O brief passa
**intenção + dados + o formato de saída**; a forma é do design.

## Fluxo

1. O design agent lê **propósito + dados** e desenha as telas **do zero**.
2. Sabendo o **formato de saída** (no que o desenho será compilado), ele desenha algo expressável
   — usando as peças disponíveis **ou propondo novas**.
3. **Nós** pegamos o design aprovado e **geramos o manifest YAML** (páginas/seções/widgets
   ligados aos dados) que monta o dashboard de fato.

## Conteúdo

| Arquivo | O que é |
|---|---|
| `dashboard-purpose-and-data-model.md` | O **propósito** do dashboard (as perguntas que ele responde) e o **modelo de dados**: a hierarquia projeto → plano → fase → **iniciativa** → task/gate (fase = slot do roteiro; iniciativa = corpo executável, 1:1 por `phaseId`), os status, os relacionamentos (foco, dependência, bloqueio, pertencimento), as **cardinalidades** (o que é 1 vs N) e o caso **standalone**. |
| `manifest-output-format.md` | **No que o design vira:** a gramática do manifest (página → seção → widget ligado a um dado) e o **catálogo de peças disponíveis (extensível)**. Não é o layout atual — é só o *idioma de saída*, para o desenho ser gerável. |
| `fixtures.json` | **Dados reais** de 3 projetos (`atomic-skills`, `arch`, `lekto`): 19 planos / 43 fases / 231 tasks, com a textura real (distribuição de status, títulos longos, projeto vazio, casos de borda). |
| `fixtures-help.json` | **Dados reais** do catálogo de **ajuda** (15 skills, fonte `meta/catalog.yaml`): id/título/oneLiner/quando-usar/exemplos/related/tags + subcomandos (o `project` tem 25). É o segundo domínio de dados, ortogonal à árvore de estado. |

## Proveniência dos fixtures

Extraídos ao vivo do estado real em `/home/henry/{atomic-skills,arch,lekto}/.atomic-skills/
projects/` (frontmatter dos `plan.md` e `phases/*.md`). Sem PII; sem dados sintéticos.
`dispatch-test` é um projeto **sem dados** — o caso de estado vazio.
