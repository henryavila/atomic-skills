# Research digest — Project Flow

**Escopo:** monorepo `/home/henry/atomic-skills` + dogfood copiado de arch-legacy plan `sugestao-necessidade-pdti`.  
**Método:** repo-only (sem web). Sessão 2026-08-12.

---

## Achados úteis (≥3 + paths)

### 1. Process map é produto real, modelo fraco para branching

- **Path:** `meta/schemas/process-map.schema.json`, `scripts/lib/render-process-map.js`, `docs/kb/process-map.md`
- Stages + dual copy + edges; HTML = `ol.pm-flow` **linear** — `edges` validados e não usados no layout.
- Iron Laws P1–P5: criação inescapável, show-before-ratify, não derivar de phases[].

### 2. Scripts vivem no package-root, não só no plugin

- **Path:** `~/.atomic-skills/package-root` → `/home/henry/atomic-skills`
- `scripts/render-process-map.js`, `scripts/find-missing-process-map.js`
- Plugin Grok (`~/.grok/plugins/atomic-skills`) espelha skills/_assets; **sem** pasta scripts completa no mirror.

### 3. Detector forte na criação, fraco no day-2

- Stage `process-map` + `find-missing-process-map --strict-html` no bootstrap.
- `project-verify` / `implement` **não** chamam o detector de process-map (KB over-claims).

### 4. Dogfood graph é o modelo alvo

- **Path (agora):** `docs/design/project-flow/dogfood/fluxo-sugestao.json`
- types: sequence | decision | end; messages; xor branches; effects; states.transitions.via
- Viewer: `dogfood/fluxo-completo.html` — três builders Mermaid + pan/zoom + validateModel

### 5. Domain coupling no validateModel do protótipo

- Exige 3 decisões; ids D1, D_edit, D2; when lider_aceita/recusa; status 1/11/10; fetch `fluxo-sugestao.json`
- **Path:** trechos em `dogfood/fluxo-completo.html` função `validateModel`

### 6. Coexistência no plano PDTI prova insuficiência do map

- `dogfood/process.yaml` (4 main + optional) vs grafo com 3 XORs e sequences
- Stage `lider-decide` colapsa D_edit + D2 + sequences

### 7. Commits recentes AS

- `7dd53c50` feat process map L1/L2 mandatory  
- `01bc2967` fix show process map before ratify  

---

## Implicações para o design

- Reusar **pipeline** (pure lib + CLI + content-sha), não o **schema de stage cards**.
- Productizar dogfood **depois** de strip de domínio.
- Fechar buraco verify/implement no mesmo esforço que o detector flow.
- AJV canônico do repo = `src/app-map/validate.js`. Process-map **não** compila o próprio schema.

---

## Sessão 2026-08-12 noite — crítica de prompt + ratificação

**Método:** 4 agentes explore (design, analyses, process-map impl, skills/dogfood) + painel Della/Flynn/Priya/Aria.

### Achados

8. **`fluxo-sugestao.json` não é schema 1.0.** Top-level `flowId`/`version: 2`/`entry`/`nodes`. PR1 = envelopar (`schemaVersion`, lifecycle, `graph{entry,nodes}`).
9. **`validateProcessMap` nunca chama Ajv.** `process-map.schema.json` não é compilado em lugar nenhum. Copiar process-map como “validate” reproduz o débito.
10. **Prompt de 17 arquivos é abuso.** Cold-start listado ≈ 4240 linhas / 191 KB; PR1 precisa de ~8 arquivos. HTML 1139 linhas e `pdti-feature-design.md` contaminam o core.
11. **“FATIA” não existe no design.** Recortes canônicos = PR1–PR5.
12. **Dogfood HTML `validateModel` é o anti-exemplo** (3 decisões, D1/D_edit/D2, status 10/1/11). Extrair só builders na PR2.

### Ratificação do operador (mesma sessão)

- Process-map: **descarte completo**. Sem dual-read, sem cards, sem journey como ready.
- Obrigação (sessão noite): graph + show-before-ratify antes de `reviews`/`ready`.
- Day-2: gerar/atualizar/exibir a qualquer momento.
- Editável = JSON + loop Ajustar. Sem editor no browser.
- Implementação: **cascata**, sessão seguinte (reboot). Esta sessão só persistiu docs.

### Override do operador (sessão seguinte, mesmo dia)

- Dentes **não** ficam no fim do `new plan`. Ficam no **entry do `implement`**: automático, inicial, não-skippável.
- Sem o artefato (graph válido + `ratifiedAt` + HTML sha) é impossível implementar.
- Validação humana = comando `project flow` (manual, qualquer momento). Implement só checa o detector — não roda show+ratify.
- `ready` sem flow é legal. Stage `process-map` morre; não nasce stage `flow` inescapável.
