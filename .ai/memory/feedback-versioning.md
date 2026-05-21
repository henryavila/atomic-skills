---
name: feedback-versioning
description: "Don't autonomously decide on version bumps — user releases as minor (1.x.y), not major, even when changes touch schema"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d52206a6-a054-48f1-abd9-0ade1d8c2cdc
---

Em `atomic-skills`, o usuário prefere bumps **minor** (1.8.1 → 1.9.0) mesmo quando as mudanças tocam schema com items em produção. Não decida sozinho que algo é "v2.0.0" só porque há breaking changes técnicos.

**Why:** O HANDOFF.md de uma sessão anterior (4a28f80) e o `common.schema.json` ("Frozen at 0.1 for atomic-skills v2.0.0") declararam autonomamente que o próximo release seria 2.0.0 baseado em mudanças de schema. O usuário corrigiu na sessão 2026-05-21: produção está em 1.8.1, próximo é 1.9.0. O agente tinha inflado a versão sem perguntar.

**How to apply:**
- Antes de commitar mudanças que pareçam "breaking", NÃO escreva versão no commit message nem no schema.
- Antes de rodar `npm version` ou editar `package.json`, perguntar qual bump (patch/minor/major).
- Quando um schema fizer referência textual a uma versão futura (ex.: "Frozen at 0.1 for atomic-skills vX"), perguntar antes de chumbar.
- HANDOFF docs herdados que falam em "v2.0.0" devem ser tratados como sugestão do autor original, não como decisão ratificada — confirmar antes de propagar.

Cross-link: relacionado a [[decisoes-arquitetura]] sobre padrões do projeto.
