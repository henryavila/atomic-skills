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

- Reusar **pipeline** process-map, não o **schema de stage cards** como grafo.
- Productizar dogfood **depois** de strip de domínio.
- Fechar buraco verify/implement no mesmo esforço que o detector flow.
