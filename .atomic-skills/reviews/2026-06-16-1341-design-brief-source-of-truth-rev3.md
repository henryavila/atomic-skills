# DESIGN review — design-brief-source-of-truth (Revisão 2 / rev3)

- **When:** 2026-06-16T13:41:08Z
- **Artifact:** `.atomic-skills/projects/atomic-skills/design-brief-source-of-truth/design.md`
- **Driver:** defeito de design encontrado no IMPLEMENT (gate F1 spec-readiness + 3 críticas do
  operador) → debate de 4 vozes (`atomic-skills:debate`, 2 rounds) → re-design (Revisão 2).
- **Gate:** critic per `skills/shared/debate-assets/critic.md`, Tier 1 (same-provider fresh subagent,
  no actor-context). Ceiling 3 rounds.

## Outcome: APPROVED (round 2)

| Round | verdict | blocker | critical | major | minor | nit | collapse |
|---|---|---|---|---|---|---|---|
| 1 | needs_changes | 0 | 0 | 1 | 1 | 0 | Issues-Found |
| 2 | approve_with_nits | 0 | 0 | 0 | 1 | 1 | **Approved** |

## Round 1 findings (addressed)

- **F-001 [major] internal-contradiction** — D3' dizia `existence`/`conflicts` transitórios e NÃO
  gravados, enquanto §Chosen approach + schema F0 (`existence`/`conflicts` `required` em `$defs/page`)
  os persistem. **Fix:** D3' reescrita — persiste-se o RESULTADO (existence + conflicts-como-arbitragem-
  resolvida + provenance); o que não persiste é a ontologia de 4 estados de confiança. Alinhado ao
  schema F0.
- **F-002 [minor] schema-mismatch** — `inputsHash` (top-level, `0.1`) vs `evidenceHash` por-página de
  D5', com `0.1` tratado como congelado. **Fix:** declarado bump `schemaVersion 0.1`→`0.2` no PLAN em
  D5', §Chosen approach e §Blast radius; congelamento vale a partir de `0.2`.

## Round 2 findings (addressed — não-bloqueantes)

- **F-001 [minor] accuracy/G1** — D3' atribuía `resolution`-objeto + `evidenceHash` ao "que o schema
  F0 já exige", mas `0.1` tem `resolution` como enum `pending|resolved` e não tem `evidenceHash`.
  **Fix:** D3' separa o que `0.1` já tem do que o bump `0.2` introduz (resolution→objeto + evidenceHash).
- **F-002 [nit] consistency** — Open q (b) citava "D5" (substituída por D5'). **Fix:** corrigido para
  "D5'".

## Round 2 open questions (carregar ao PLAN, não-bloqueantes)

- Garantir que a validação na emissão use o MESMO `app-map.schema.json`/`validateAppMap` da F0 (não
  uma cópia divergente).
- Critério de "delta" do `evidenceHash`: normalizar mudanças de código não-semânticas (refactor sem
  mudança de IA) para não recriar fadiga de confirmação.

## Evidence integrity

Critic conferiu todas as refs `verified_by` (design-brief.md:11/:31-37/:39-44/:53-66;
anti-contamination.md:10-14; three-layer-briefing.md:51-59; brainstorm.md:28) + schema F0 +
integração `validate-state.js` (importa `validateAppMap` de `src/app-map/validate.js`) — todas reais.
