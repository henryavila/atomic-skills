---
name: decisao-skills-en-only
description: Todas as skill bodies são EN-only. PT é só uma preferência de comunicação injetada em runtime — nunca uma fonte de skill separada.
metadata:
  type: feedback
---

Todas as skills em `skills/` ficam **apenas em EN** (`skills/en/...`). Não existem
versões PT da mesma skill, nunca mais. Foi decidido em 2026-05-22.

**Why:** manter dois skill bodies paralelos (EN + PT) explodia o trabalho de
manutenção a cada feature, e gerava drift toda vez que um lado era editado e o
outro esquecido. A linguagem de saída é uma preferência de runtime, não um
fork de conteúdo.

**Como o sistema entrega PT mesmo assim:**

1. `bin/cli.js` aceita `--lang en|pt`; sem flag, `src/detect.js` infere do `$LANG` / locale.
2. `src/ui.js:promptLanguageSelection` pergunta interativamente (`Português (BR)` / `English`).
3. O `language` escolhido vai pro manifest e é passado pro renderer como
   `COMMUNICATION_LANGUAGE`.
4. `src/render.js:71-79` prepende ao topo de cada skill renderizada:
   > `Communicate with the user in <Language>. Translate any English example strings in this skill at runtime; do not output them verbatim.`

Isso significa: o source `.md` da skill fica em EN, mas o agente recebe a
diretiva no topo e traduz na hora de falar com o usuário PT-BR.

**How to apply:**

- NUNCA criar `skills/pt/...`. Se um plano antigo mencionar Phase PT, pular
  com nota — o plano está desatualizado.
- NUNCA hardcodar `> Communicate with the user in English` (ou PT) dentro de
  um skill body — o renderer injeta isso.
- Menções a Portuguese DENTRO de um skill body são OK quando descrevem
  features de parsing (ex: `project-plan.md` reconhece `## Objetivo` e
  `## Princípios` em planos PT-BR) — isso é capacidade do parser, não
  diretiva de UI.
- `meta/catalog.yaml` (catálogo) é EN-only.
- `skills/modules/*/module.yaml` PODE ter chaves `pt:` e `en:` paralelas —
  esses são labels do menu do **instalador**, não do skill body. Continuar
  mantendo ambos os idiomas aqui.

Relacionado: [[decisoes-arquitetura]].
