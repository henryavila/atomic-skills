# Sample Plan — sda-v2 Shape

This fixture mirrors the real `docs/superpowers/plans/v3-redesign/00-master.md`
shape from the sda-v2 repo: PT section names, numbered H2 prefix, H3-based
principles, markdown-table glossary, bullet tasks under `### Sub-fases (menu)`,
bold-prefix `**Goal:**` and `**Exit gate da fase:**`. Used to lock in the
C.T-005 heuristics introduced after the Phase C codex review smoke test
showed the original heuristics missed every section in the real file.

## Sumário

(Structural meta-section that should be skipped — surfaces a warning.)

## 1. Contexto: por que v3?

Free-form narrative. Should be skipped.

## 2. Princípios invioláveis

### 2.1 Fonte da verdade são os 2 dumps

Os dumps são a única fonte autoritativa. O DB local é descartável.

### 2.2 Determinismo total — zero IA em runtime

Todas as transformações são scripts idempotentes. Nenhuma chamada LLM no caminho crítico.

### 2.3 Gate de saída por sub-fase

Cada sub-fase tem critério mensurável de fechamento.

## 5. Glossário

| Termo | Significado |
|---|---|
| **Tenant song** | Música cadastrada por uma igreja (`tenant_id NOT NULL`) |
| **Collection song** | Música compartilhada (`tenant_id IS NULL`) |
| **Exit gate** | Critério verificável que fecha uma sub-fase |

---

## F0 — Foundation Repair (Dados)

**Goal:** Resolver os dados antes de qualquer UI; restaurar infra local; matcher determinístico; 0 duplicatas medidas.

**Dependências:** Nenhuma.

**Exit gate da fase:** Tag git `core-v2` criada; pipeline reproduzível end-to-end; 0 duplicatas; smoke `/musicas` ok.

### Sub-fases (menu)

- **F0.T-001 — Restore local infra.** Composer install, .env, PostgreSQL.
- **F0.T-002 — Pipeline dumps → PostgreSQL.** Script reproduzível.
- **F0.T-003 — Unificação do modelo Álbum.** Migration + audit.

## F1 — Filament Backend Redesign

**Goal:** Redesenhar 100% do Filament 5; portar features legacy.

**Exit gate da fase:** Todas Resources passam UI Gate; cadastro de tenant via UI.

### Sub-fases (menu)

- **F1.T-001 — Pre-work: importar framework do /arch.** Adaptar v4→v5.
- **F1.T-002 — Music domain (8 Resources).** Song, Artist, Album, Theme.

## F8 — Pre-launch + Deploy

**Goal:** Validar end-to-end, provisionar produção, deploy.

**Exit gate da fase:** Tenant rodando em produção; smoke aprovado.

### Sub-fases (menu)

- **F8.T-001 — Provision production.** Server + DB + secrets.

## 16. Fontes e referências

Structural meta-section (skipped).
