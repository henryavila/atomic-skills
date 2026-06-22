---
schemaVersion: "0.2"
slug: skills-restructuring-f6-focus-json-auto-refresh
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-F6-1
    statement: >-
      O flag "installer-created" (settingsCreated/settingsLocalCreated em
      src/install.js) era computado fresco de `!fileExisted` a cada install, então um
      re-install (update path) o rebaixava true→false e o uninstall deixava o settings
      file vazio (`{}`) como resíduo — quebrando a paridade byte-a-byte. O round-trip
      test (o enforcer da HARD RULE) só exercia install→uninstall único, então nunca
      pegou o update path. Em paralelo, uma reversão assimétrica em escopo
      (installProjectStatusHooks project-only, removeProjectStatusHooks incondicional)
      podia corromper o settings.local.json do próprio usuário num user-scope uninstall.
    corrective: >-
      Quando um install grava um flag "eu-criei-isto" para guiar sua reversão, torne o
      flag sticky entre re-installs (OR-in do valor do manifest prévio, nunca demote
      true→false) e faça a reversão simétrica ao install no MESMO escopo/condição
      (project-only install ⇒ project-only uninstall). O teste de paridade/round-trip
      deve cobrir o re-apply path (install→install→uninstall) E a preservação de um
      arquivo pré-existente do usuário — não só o first-apply→uninstall. Heurística
      geral: um invariante de round-trip que só testa o primeiro apply é cego ao
      caminho mais comum (o re-apply); teste a reaplicação.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-16-1650-skills-restructuring-f6.md (findings #1–#3);
      fixes em src/install.js (sticky flags) + src/uninstall.js (scope-gate) + 3 testes
      novos em tests/install-uninstall-roundtrip.test.js, commit 3a4faf2.
    createdAt: 2026-06-16T16:50:35Z
    validatedAt: 2026-06-16T16:50:35Z
---

# Lessons — F6 focus.json não drifta silenciosamente (skills-restructuring)

Destilada no phase-done da F6 a partir de sinal real: 4 findings do review local
(`review-code --mode=local` sobre `d4414fc..HEAD`) — o pattern do flag installer-created
tinha uma armadilha de re-install (resíduo no update path) que o round-trip test não cobria,
e a reversão era assimétrica em escopo. Todos os 4 corrigidos via TDD nesta fase (RED antes do
fix). Ratificada pelo operador. `scope: reusable` + `status: open` é disposta no início de cada
fase futura via `node scripts/list-lessons.js --phase <id>` — relevante para qualquer mexida
futura no installer (a HARD RULE de paridade install↔uninstall vale para todo o repo).
