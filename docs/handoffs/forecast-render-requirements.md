# Handoff → Render do Deadline Burn-up Forecast (F5): substrato VERIFICADO + dependência de integração

**De:** plano `deadline-burnup-forecast` (F0–F4 — instrumentação de tracking — DONE+merged nesta branch; F5 — render — `pending`).
**Para:** quem trabalha na branch `plan/fix-aideck-dashboard` (redesign do dashboard) **e** quem for implementar o F5.
**Data:** 2026-06-19 (revisado — esta versão substitui a 1ª, cuja premissa estava desatualizada).

> **STATUS — premissa corrigida (verificado 2026-06-19).** A 1ª versão deste handoff pedia ao redesign para "confirmar/construir" um line-chart multi-série + stat no DS. **Isso já existe.** O dashboard hoje é **100% manifest-driven**, renderizado pelo **cliente Vue do aiDeck** — o cliente React próprio (`src/dashboard/`) foi **REMOVIDO** (commit `38cf2a9`, já no ancestral comum das duas branches). **Conclusão: o redesign NÃO precisa construir nenhuma peça de render para o F5.** O verdadeiro gate do F5 é de **integração de branch** (§7), não de implementação no lado do dashboard.

---

## 0. TL;DR

- **Para o redesign do dashboard (`fix-aideck-dashboard`):** você não tem trabalho de render a fazer pelo F5. Os widgets existem. O único pedido é **manter estável a convenção de scoping por-plano** e **não remover** os dataSources/página que o F5 adicionar depois (§6).
- **Para quem implementa o F5:** o F5 é uma tarefa **puramente de manifest + emitter**. O substrato (widgets, contrato de dados, gramática de binding, scoping) está todo verificado abaixo. A única pré-condição externa é **ter o manifest redesenhado como base** (nav.style:projects + registry + guardrail), que hoje vive em `plan/fix-aideck-dashboard` e ainda não foi integrado nesta branch (§7).

---

## 1. Arquitetura de render (VERIFICADA)

- **Manifest-driven.** O aiDeck embute um renderer Vue genérico que itera `pages[] → sections[]/widgets[]` do manifest e mapeia cada `widget:` para um componente Vue embutido — `../aideck/src/client/components/WidgetRenderer.vue:87-131` (`widgetMap`), resolvido em `:201`, com fallback "Unknown widget" em `:33-35`.
- **Cliente React removido.** `src/dashboard/` não existe mais (commit `38cf2a9` "remove the dead React dashboard; render via aiDeck v2 client"). O `src/serve.js:6-10` aponta o aiDeck para o cliente Vue staged via `--static-dir`. Há um `dist/dashboard/` residual git-ignorado (bundle React velho) — **ignore**, não é o que serve.
- **`widget` no schema é STRING LIVRE** (`../aideck/src/manifest-schema.ts:188` → `z.string().min(1)`), não um enum. O false-green ("declarei um widget que não existe → renderiza placeholder") é fechado por um guardrail no lado do consumer: `tests/aideck-manifest-widget-registry.test.js` + o registry vendorizado `meta/aideck-widget-registry.json` (regen via `npm run build:aideck-widget-registry`). **Ambos estão na branch `fix-aideck-dashboard`, ainda NÃO nesta branch.**
- **aiDeck versão:** local `@henryavila/aideck@0.1.2` (não publicado; npm tem `0.1.1`). O manifest vincula ao **engine SOURCE/v2.1** (com `source.agg/where/scope` + widgets novos). O pacote npm `0.1.0/0.1.1` é pré-v2.1 — **valide o F5 contra o registry vendorizado (source), não contra o npm**.

## 2. Widgets confirmados para o F5 (existem no runtime publicado)

| necessidade do F5 | widget | evidência |
|---|---|---|
| burn-up planejado vs real (≥3 séries) | **`line-chart`** (multi-série) | `WidgetRenderer.vue:115`; `LineChartWidget.vue:85-89` (`config.series: string[]` → multi-linha + legenda) |
| número-manchete do SPI | **`stat`** | `WidgetRenderer.vue:125` (`StatWidget`) |
| SPI alternativo (mostrador) | **`gauge`** | demo `../aideck/src/demo/consumer/manifest.yaml:152` (`valueField`, `max`) |

O `design.md` do plano já fixou isso (`design.md:28-29,77`: "line-chart, stat, gauge existem no runtime publicado").

## 3. Gramática exata de binding (verbatim da fonte do aiDeck)

**`line-chart`** — `../aideck/src/client/components/widgets/LineChartWidget.vue:71-88`:
- `source` = array de records (props.source). **Vincula um dataSource de array bruto inteiro** — o aiDeck v0.1 **não tem motor de agregação de série** (read-time agg só faz count/ratio). Por isso a série tem de ser **pré-computada** (é o que o emitter faz, §4).
- `config.xField` (default `'x'`) — campo do eixo X.
- `config.series: string[]` — lista de y-fields → **uma linha por campo, com legenda quando > 1** (`:85-89`, legenda `:57-58`). Sem `series`, usa `config.yField` (default `'y'`) como única linha.
- Outros: `config.title`, `config.area`, `config.height`, `config.width`, `config.live`.

Exemplo real (demo aiDeck, `src/demo/consumer/manifest.yaml:140-143`):
```yaml
- widget: line-chart
  colSpan: 6
  source: { ref: timeseries }
  config: { xField: 'x', yField: 'y', width: 500, height: 250 }
```

**Binding proposto para o F5 (burn-up, 3 séries):**
```yaml
- widget: line-chart
  colSpan: 8
  source: { ref: burnup, param: { match: [projectId, { field: planSlug, param: slug }] } }
  config:
    xField: 'date'
    series: ['plannedValue', 'earnedCount', 'earnedProxy']
    title: 'Burn-up (planejado vs ganho)'
    area: false
```

**SPI** — preferir `gauge` (grammar de escalar confirmada via demo: `config: { valueField: 'value', max: 100 }`) ou `stat`:
```yaml
- widget: gauge
  colSpan: 2
  source: { ref: spi, filter: { planSlug: <slug> }, param: { match: [projectId, { field: planSlug, param: slug }] } }
  config: { valueField: 'spiProxy', label: 'SPI (proxy)', max: 2 }
```
> ⚠️ **Confirmar no F5:** a gramática de valor escalar do `stat` (`valueField` vs `value` vs `agg`) lendo `../aideck/src/client/components/widgets/StatWidget.vue` — a demo usa `stat` com `agg: count/ratio`, não com valueField direto. O `gauge` tem `valueField` claro (demo) e é o caminho seguro para um escalar pré-computado.

## 4. Contrato de dados (VERIFICADO) — `burnup.json` / `spi.json`

Emitidos por `scripts/emit-consumer-state.js` (`buildSeries` `:403`, `writeState` `:509`) — **na branch `deadline-burnup-forecast` (F0–F4 done)**. Já gravam ambos; **não reconstruir**.

| dataSource | path | formato | root |
|---|---|---|---|
| `burnup` | `.atomic-skills/.aideck/state/burnup.json` | JSON array | project |
| `spi` | `.atomic-skills/.aideck/state/spi.json` | JSON array | project |

**`burnup`** (série diária DENSA: 1 record por dia-UTC de `started` até `now`, com o ganho acumulado carregado adiante em dias sem conclusão — para o chart renderar uma curva contínua, não só pontos isolados; schema `meta/schemas/aideck-state.schema.json:241-253`):
- `projectId` string · `planSlug` string · `date` string `YYYY-MM-DD` (eixo X)
- `plannedValue` number|null — linha planejada `weightTotal * clamp01((diaInício − started)/(deadline − started))`; **null sem janela planejada**
- `earnedCount` number — ganho acumulado por contagem (1 por task done; só `event==='task-done'`, `phase-done` excluído)
- `earnedProxy` number — ganho acumulado ponderado por complexidade

**`spi`** (1 record por plano; schema `:254-268`):
- `projectId`, `planSlug`, `asOf` (ISO), `started` string|null, `deadline` string|null
- `weightTotal` number, `tasksTotal` number
- `spiProxy` number|null = `earnedProxyNow / plannedProxyNow`
- `spiCount` number|null = `earnedCountNow / plannedCountNow`

**Null (exato):** `plannedValue` é null sse `!(started finito ∧ deadline finito ∧ deadline > started)`. `spiProxy/spiCount` são null sem janela planejada (sem deadline) OU antes de `started`; **reportam de `started` em diante, INCLUSIVE após o deadline** (aí `plannedProxyNow/plannedCountNow` clampam a `weightTotal/tasksTotal`, então um plano atrasado mostra SPI = ganho/planejado-total < 1 em vez de apagar). O render **tem de tolerar null** (linha planejada ausente/plana, SPI "—").

> ⚠️ **Pré-requisito de DADO (não é tarefa do dashboard):** sem `plan.deadline` no frontmatter, `plannedValue`/`spiProxy`/`spiCount` são null. **Este plano vai declarar seu próprio `deadline` antes do F5** — senão o gráfico não tem linha planejada nem SPI para comparar.

**Shape do dataSource a adicionar no manifest (verbatim, igual aos existentes — `manifest.yaml:26-40`):**
```yaml
  - { id: burnup, path: '.atomic-skills/.aideck/state/burnup.json', format: json, root: project }
  - { id: spi,    path: '.atomic-skills/.aideck/state/spi.json',    format: json, root: project }
```
Hoje `burnup`/`spi` **NÃO** estão no manifest (grep = 0); o F5 os adiciona.

## 5. Scoping por-plano (VERIFICADO)

- Nav redesenhado: `nav.style: projects` (project-centric: Panorama + lista de PROJETOS). dataSources `root: project` resolvem via `GET /api/consumers/atomic-skills/projects/<projectId>/data/<ds>`.
- Filtro para o plano selecionado: `source.param.match`, p.ex. `param: { match: [projectId, { field: planSlug, param: slug }] }` (padrão das páginas de plano/fase do manifest redesenhado).
- A página "Ritmo" entra como uma nova `pages[]` (uma aba/rota por-plano) **ou** como uma seção dobrada na página de plano existente. Decisão de layout fica no F5.

## 6. O que o F5 vai adicionar (escopo do F5 — NÃO é trabalho do dashboard)

1. Dois `dataSources` (`burnup`, `spi` — §4).
2. Uma página/seção "Ritmo": `line-chart` (3 séries de `burnup`) + `gauge`/`stat` de `spi.spiProxy` (+ informativo de `spiCount`).
- **scopeBoundary:** edita só `assets/aideck-consumer/manifest.yaml`; **published widgets only** (nada fora do registry); não altera outras páginas/dataSources.
- **Verifier (gate G-1 do F5):** `node --test tests/aideck-consumer-manifest.test.js`.

## 7. A dependência REAL (a decisão de integração) — o que destrava o F5

O F5 **não pode** ser construído sobre o manifest VELHO desta branch (`nav.style: tabs`, sem registry, sem guardrail) — seria clobberado quando o redesign chegar. O F5 precisa do **manifest redesenhado como base**. Estado verificado:

- **`plan/fix-aideck-dashboard`** tem (8 commits à frente desta branch): `16e7e91` (manifest realinhado, `nav.style:projects`), `a8e17fe` (guardrail de registry), `meta/aideck-widget-registry.json`, F2/F3 da branch done.
- **Esta branch (`deadline-burnup-forecast`)** tem: React já removido (ancestral comum) + o emitter `buildSeries` (F0–F4). **Falta:** o manifest redesenhado, o registry e o guardrail.

**Caminho recomendado:** integrar o redesign (merge `plan/fix-aideck-dashboard` → `plan/deadline-burnup-forecast`, ou ambos via `main`/branch de integração) **e então** implementar o F5 aqui — onde convivem o manifest redesenhado E o emitter. Só depois disso o T-001 do F5 sai do bloqueio.

**Único pedido ao redesign:** ao finalizar/regenerar o manifest, manter estáveis as convenções de scoping (`param.match`) e a lista de `dataSources`; quando o F5 adicionar `burnup`/`spi` + a página Ritmo, não removê-los num regen futuro.

## 8. Pointers (verbatim)

- F5 SPEC: `.atomic-skills/projects/atomic-skills/deadline-burnup-forecast/source.md` (§F5) + `phases/f5-render-no-aideck-depende-do-redesig.md`.
- Emitter: `scripts/emit-consumer-state.js` (`buildSeries`); schema: `meta/schemas/aideck-state.schema.json` (`$defs/burnup` `:241`, `$defs/spi` `:254`).
- aiDeck render: `../aideck/src/client/components/WidgetRenderer.vue`, `.../widgets/LineChartWidget.vue`, `.../widgets/StatWidget.vue`; demo `../aideck/src/demo/consumer/manifest.yaml`.
- Guardrail+registry (na branch dashboard): `tests/aideck-manifest-widget-registry.test.js`, `meta/aideck-widget-registry.json`.
- F5 verifier: `node --test tests/aideck-consumer-manifest.test.js`.
