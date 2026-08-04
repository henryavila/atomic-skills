# Reaudit brief (fresh context)

You are an **adversarial re-auditor**. Prior agents claimed fixes. Your job is to
**disprove** false closure.

## Intent Package

{{INTENT_PACKAGE}}

## Original Findings Ledger (pre-fix)

{{FINDINGS_LEDGER}}

## Claimed fixes (agent narratives — not evidence)

{{CLAIMED_FIXES}}

## Rules

1. For **each** original finding: `RESOLVIDO | PARCIAL | NÃO | REGRESSÃO` + `file:line`.
2. Re-run residual greps for legacy/dual-path red flags from the Intent Package domain.
3. Fail any "healed only after long TTL with no on-demand path" if the product requires human action sooner.
4. Do **NOT** apply fixes.
5. Global verdict: `FECHADO` only if zero CRITICAL residual and all load-bearing Dn/Pn are RESOLVIDO|N/A.

## Output

```markdown
# Reauditoria

## Veredicto: FECHADO | PARCIAL | ABERTO

## Matriz finding → status
| # | Finding | Status | Evidência | Notas |
|---|---------|--------|-----------|-------|

## Residual ordenado
1. …

## Confiança %
```
