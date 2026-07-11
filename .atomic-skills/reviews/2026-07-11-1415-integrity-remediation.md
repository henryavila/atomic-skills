---
date: 2026-07-11T14:15:53-03:00
topic: integrity-remediation
artifact: /Volumes/External/code/.worktrees/atomic-skills-integrity-remediation/.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.144.1
final_verdict: reject (all findings resolved post-review)
counts_final: {blocker: 0, critical: 2, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation

## Pass 1 (blind)

---
verdict: reject
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary

A ordem executa e encerra F1–F3 usando justamente o lifecycle não idempotente que F4 pretende corrigir, permitindo evidência e estado inconsistentes antes da remediação. O desenho de confinamento também não cobre troca concorrente de symlinks entre validação e escrita.

Além disso, o domínio dos locks compartilhados está indefinido, somente Gemini recebe verificação explícita em CLI real, e o gate final não possui inventário executável que prove a cobertura de todos os findings declarados.

## Findings

### F-001 [critical] ordering — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:402-420

**Evidence:**
```md
- **F0** — destrava o executor, fecha runtime closure e setup estrutural (4 tasks, 2 gates).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F0).
- **F2** — separa hosts e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F2).
- **F4** — centraliza invariantes e transações de lifecycle (8 tasks, 3 gates; depende de F3).
- **F5** — corrige Gemini, Windows e identidade de dashboard (6 tasks, 3 gates; depende de F4).
- **F6** — qualifica o tarball e fecha as auditorias (5 tasks, 2 gates; depende de F5).

verified_by: `node scripts/validate-state.js
.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md` e preview
confirmado pelo usuário.

## 4. Bootstrap e fronteira multi-repositório

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
```

**Claim:** F1–F3 dependem do executor e dos comandos de fechamento antes de F4 corrigir preflight, commit guard, idempotência e materialização, portanto essas fases podem ser encerradas com o estado inconsistente que o próprio plano reconhece apenas mais tarde.

**Impact:** Uma falha ou retry durante F1–F3 pode duplicar eventos, preservar evidence stale, fechar a fase no SHA errado ou divergir plan/initiative; isso pode bloquear F4 ou fazê-lo operar sobre histórico já corrompido.

**Recommendation:** Mover para antes de F1 uma fase bootstrap com preflight, commit guard, fechamento idempotente e materialização recuperável; depois validar e reconciliar o fechamento de F0 antes de liberar o executor canônico.

**Confidence:** high

---

### F-002 [critical] security — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:118-130

**Evidence:**
```yaml
        - id: F1-G1
          description: Installer v2 impede escrita ou remoção fora do realpath autorizado
            e preserva qualquer conteúdo sem ownership provado. FAILS when
            symlink, greenfield ou runtime editado perde bytes.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006
              --worktree ../minimalist-installer-integrity-remediation
              --require-remote && (cd ../minimalist-installer-integrity-remediation
              && npm test) && node --test tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
            expectExitCode: 0
```

**Claim:** O plano exige validação por `realpath`, mas não exige confinamento resistente a TOCTOU nem teste que troque um componente por symlink entre a validação e a mutação, permitindo que um path validado passe a apontar para fora da raiz.

**Impact:** Um processo concorrente pode redirecionar write, rename, prune ou rollback para arquivos externos depois do check, causando sobrescrita ou remoção fora da raiz autorizada apesar de F1-G1 passar.

**Recommendation:** Especificar primitivas de mutação ancoradas em diretório sem seguir symlinks ou revalidação segura imediatamente antes de cada efeito, e adicionar fault tests que troquem cada componente de path durante write, rename, prune e rollback.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:108-142

**Evidence:**
```yaml
    goal: Entregar em worktree upstream dedicada e integrar no consumer um journal
      versionado, atomic persistence, locks, ownership por hash e recovery
      conservador para install, update e uninstall.
```

```yaml
        - id: F1-G2
          description: Concorrência e crash produzem commit completo, rollback explícito
            comprovável ou bloqueio inspecionável. FAILS when manifest, registry
            ou runtime divergem sem journal v2, inspect e recovery determinístico.
          status: pending
          verifier:
            kind: shell
            command: (cd ../minimalist-installer-integrity-remediation && node
              --test test/inspect-rollback.test.js) && node --test
              tests/installer-fault-injection.test.js tests/runtime-refcount.test.js
              tests/runtime-registry-recovery.test.js
              tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
```

**Claim:** O plano não define a identidade, granularidade ou ordem dos locks quando instalações em roots diferentes compartilham registry e runtime, portanto locks por projeto podem não serializar mutações do mesmo recurso global.

**Impact:** Instalações concorrentes user-scope e project-scope podem perder owners/refcounts, eleger owners diferentes ou remover um runtime ainda utilizado mesmo que testes concorrentes sobre uma única raiz passem.

**Recommendation:** Definir locks por recurso canônico compartilhado, estabelecer ordem global quando uma transação adquire múltiplos locks e exigir testes multiprocesso cruzando roots, scopes e versões de runtime.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:280-329

**Evidence:**
```yaml
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
            expectExitCode: 0
```

```yaml
        - id: F6-G1
          description: Black-box e fault matrix passam contra o tarball sem checkout
            fonte. FAILS when qualquer host, scope, crash ou retry deixa estado
            parcial ou depende do repo.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-fault-matrix.test.js
            expectExitCode: 0
```

**Claim:** Apenas Gemini possui requisito explícito de discovery e invocation pelo CLI suportado, enquanto o gate multi-host permite que os demais hosts sejam qualificados somente por um teste Node sem obrigação de executar seu comportamento público.

**Impact:** Claude, Codex, Cursor, OpenCode ou GitHub Copilot podem receber artifacts que renderizam corretamente, mas não são descobertos ou invocados pelo host real, produzindo uma declaração de suporte baseada apenas em fixtures.

**Recommendation:** Definir para cada host um probe público obrigatório com versão registrada e operações discovery/load/invoke; para hosts sem automação executável, limitar explicitamente o resultado a compatibilidade de layout, sem qualificá-lo como suporte de host.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:102-104

**Evidence:**
```yaml
      doneWhen: Todos os findings formais e adicionais possuem verifiers verdes;
        black-box, fault matrix, Linux/macOS/Windows, Gemini CLI, full suite,
        docs e skill validation passam.
```

```yaml
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior. FAILS when um finding permanece reproduzível,
            a instalação diverge ou o receipt/job não pertence ao candidato.
          status: pending
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
```

**Claim:** O critério exige verifier verde para todo finding, mas o comando final não valida um inventário enumerado de findings contra testes, reproduções e evidências, de modo que findings omitidos da suíte não fazem o gate falhar.

**Impact:** Uma auditoria pode ser marcada como encerrada com findings sem reproducer ou verifier, desde que os testes existentes e os quatro jobs declarados estejam verdes.

**Recommendation:** Criar um manifesto canônico com cada ID de finding, origem, reproducer, verifier e SHA de resolução, e adicionar ao F6-G2 um verificador que rejeite IDs ausentes, duplicados, sem teste executado ou sem evidência pertencente ao candidateSha.

**Confidence:** high

## Questions (non-findings)

- Nenhuma.

## Out of scope

- Publicação de pacote, tag ou release.
- Fork permanente do minimalist-installer.
- Inferência de ownership legado baseada somente em path.

## Pass 2 (informed)

---
verdict: reject
counts: {blocker: 0, critical: 2, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary

O plano usa materialização e fechamento não recuperáveis para concluir F0–F3 antes de corrigir esses mecanismos em F4. O confinamento por `realpath` continua vulnerável a troca concorrente de symlinks, e os locks não abrangem explicitamente recursos globais compartilhados entre roots.

A qualificação ainda pode declarar suporte de hosts sem invocação pelo host real, não valida mecanicamente a resolução de cada finding e não exige cobertura das duas famílias de Node publicamente suportadas. As restrições de materialização lazy, paridade install/uninstall, ownership do journal e abstração de ferramentas não invalidam os findings mantidos; a matriz incompleta de Node emerge diretamente do runtime declarado.

## Findings

### F-001 [critical] ordering — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:402-420

**Evidence:**
```md
- **F0** — destrava o executor, fecha runtime closure e setup estrutural (4 tasks, 2 gates).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F0).
- **F2** — separa hosts e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F2).
- **F4** — centraliza invariantes e transações de lifecycle (8 tasks, 3 gates; depende de F3).

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
```

**Claim:** F0–F3 são materializadas e encerradas pelo lifecycle atual antes de F4 entregar preflight, commit guard, fechamento idempotente e materialização recuperável.

**Impact:** Uma falha ou retry pode duplicar eventos, persistir evidence stale, fechar uma fase no SHA incorreto ou divergir plan e initiative antes que F4 seja alcançada; como F1–F6 são lazy, até materializar F1 depende do mecanismo ainda não corrigido.

**Recommendation:** Antecipar preflight, commit guard, fechamento idempotente e materialização recuperável para o bootstrap anterior a F1, incluindo reconciliação verificável do fechamento de F0 antes de materializar F1.

**Confidence:** high

---

### F-002 [critical] security — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:118-130

**Evidence:**
```yaml
        - id: F1-G1
          description: Installer v2 impede escrita ou remoção fora do realpath autorizado
            e preserva qualquer conteúdo sem ownership provado. FAILS when
            symlink, greenfield ou runtime editado perde bytes.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006
              --worktree ../minimalist-installer-integrity-remediation
              --require-remote && (cd ../minimalist-installer-integrity-remediation
              && npm test) && node --test tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
```

**Claim:** O gate valida confinamento por `realpath`, mas não exige uma mutação resistente a TOCTOU nem troca concorrente de componentes por symlinks entre validação e efeito.

**Impact:** Um processo concorrente pode redirecionar write, rename, prune ou rollback para fora da raiz após o check, causando sobrescrita ou remoção de arquivos externos enquanto F1-G1 permanece verde.

**Recommendation:** Exigir operações ancoradas em directory handles que recusem symlinks, ou revalidação equivalente vinculada à mutação, e adicionar testes que troquem componentes durante write, rename, prune e rollback.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:108-142

**Evidence:**
```yaml
    goal: Entregar em worktree upstream dedicada e integrar no consumer um journal
      versionado, atomic persistence, locks, ownership por hash e recovery
      conservador para install, update e uninstall.
```

```yaml
        - id: F1-G2
          description: Concorrência e crash produzem commit completo, rollback explícito
            comprovável ou bloqueio inspecionável. FAILS when manifest, registry
            ou runtime divergem sem journal v2, inspect e recovery determinístico.
```

**Claim:** O plano não define identidade, granularidade ou ordem dos locks quando roots diferentes compartilham registry e runtime globais.

**Impact:** Instalações concorrentes em user-scope e project-scope podem perder owners ou refcounts, eleger owners incompatíveis ou remover runtime ainda utilizado, mesmo que concorrência dentro de uma única raiz esteja serializada.

**Recommendation:** Definir locks por recurso canônico compartilhado, estabelecer uma ordem global de aquisição e testar processos concorrentes cruzando roots, scopes e versões de runtime.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:280-329

**Evidence:**
```yaml
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
```

```yaml
        - id: F6-G1
          description: Black-box e fault matrix passam contra o tarball sem checkout
            fonte. FAILS when qualquer host, scope, crash ou retry deixa estado
            parcial ou depende do repo.
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-fault-matrix.test.js
```

**Claim:** Apenas Gemini exige explicitamente discovery e invocation pelo CLI real; o gate genérico permite qualificar os demais hosts por testes Node do layout ou adapter.

**Impact:** Claude, Codex, Cursor, OpenCode ou GitHub Copilot podem receber arquivos renderizados corretamente, mas não descobertos ou invocáveis pelo host, violando a proibição de sustentar suporte somente em snapshots gerados.

**Recommendation:** Exigir para cada host um probe público versionado que execute discovery, load e invoke no host real; quando isso não for automatizável, limitar o resultado à compatibilidade de layout e não declarar suporte do host.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:102-104

**Evidence:**
```yaml
      doneWhen: Todos os findings formais e adicionais possuem verifiers verdes;
        black-box, fault matrix, Linux/macOS/Windows, Gemini CLI, full suite,
        docs e skill validation passam.
```

```yaml
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior. FAILS when um finding permanece reproduzível,
            a instalação diverge ou o receipt/job não pertence ao candidato.
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
```

**Claim:** O gate declara todos os findings resolvidos sem validar um inventário enumerado que associe cada ID a reproducer, verifier executado e candidateSha.

**Impact:** Findings omitidos da suíte ou dos relatórios podem permanecer reproduzíveis enquanto todos os comandos listados retornam zero e a auditoria é marcada como encerrada.

**Recommendation:** Criar um manifesto canônico de findings e adicionar ao F6-G2 um verificador que rejeite IDs ausentes, duplicados, sem reproducer, sem execução verde ou associados a outro SHA.

**Confidence:** high

---

### F-006 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:331-344

**Evidence:**
```yaml
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior.
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
```

**Claim:** A matriz final verifica sistemas operacionais e Gemini, mas não exige jobs distintos para os runtimes suportados `22.18.x` e `>=24.11.0`.

**Impact:** O candidato pode passar somente em uma família de Node e ainda ser qualificado para todo o intervalo declarado, deixando incompatibilidades de módulo, resolução ou APIs na outra família sem detecção.

**Recommendation:** Tornar obrigatórios no receipt jobs para Node 22.18.x e Node 24.11.x ou superior, executar os contratos críticos em ambos e fazer `verify-ci-candidate.js` rejeitar qualquer combinação ausente ou executada em versão fora do intervalo.

**Confidence:** high

## Questions (non-findings)

- Nenhuma.

## Out of scope

- Publicação de pacote, tag ou release.
- Fork permanente do minimalist-installer.
- Inferência de ownership legado baseada somente em path.
- Redesign da interface aiDeck.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- F-006-final [major] coverage — emerged: o runtime externo declarado suporta duas famílias de Node, mas o gate de CI exige apenas dimensões de sistema operacional e Gemini.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- No permanent fork of minimalist-installer.
- No general database, distributed transaction protocol, or background recovery daemon.
- No ownership inference for legacy artifacts from path alone.
- No unrelated product features or aiDeck UI redesign.
- No host-support claim based only on generated-file snapshots.
- No atomic-skills package, tag, or release publication in this plan.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: /Volumes/External/code/.worktrees/atomic-skills-integrity-remediation/.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md

---BEGIN ARTIFACT---
---
schemaVersion: "0.1"
slug: integrity-remediation
title: Remediação integral de segurança, lifecycle e distribuição
version: "1.0"
status: active
started: 2026-07-10T20:07:37.544Z
lastUpdated: 2026-07-10T20:48:55Z
branch: plan/integrity-remediation
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Integridade antes de compatibilidade
    body: conteúdo sem ownership provado nunca é sobrescrito ou apagado; estado
      ambíguo falha fechado.
  - id: P2
    title: Uma autoridade por contrato
    body: o engine upstream governa filesystem e journal; validate-state governa
      invariantes estruturais; adapters governam hosts.
  - id: P3
    title: Evidência observável
    body: suporte, conclusão e recovery são aceitos somente por testes do
      comportamento público.
  - id: P4
    title: Migração conservadora
    body: formatos antigos permanecem legíveis até um commit novo ser comprovado;
      dados ambíguos viram unmanaged.
  - id: P5
    title: Fatias recuperáveis
    body: cada fase termina em estado instalável, validado e reversível.
  - id: P6
    title: Fonte e instalação não divergem
    body: toda dependência runtime citada por uma skill entra no file-set e na
      superfície publicada.
glossary:
  - term: Journal v2
    definition: Protocolo versionado com transaction id, stable effect id, hashes,
      ownership e estado de commit.
  - term: Unmanaged
    definition: Artefato cuja propriedade não foi provada e que
      install/update/uninstall preservam.
  - term: Runtime closure
    definition: Conjunto completo de scripts, assets, schemas e referências
      necessárias para uma skill instalada executar fora deste checkout.
  - term: Preflight
    definition: Validação pura executada antes de verifiers, eventos ou writes de
      uma transição.
  - term: Commit guard
    definition: Releitura final que rejeita estado stale ou contraditório antes de
      gravar fechamento.
  - term: Host contract
    definition: Layout, ferramentas, argumentos, hooks e comportamento observável
      suportados por uma IDE/CLI.
phases:
  - id: F0
    slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
    title: Runtime autocontido e setup confiável
    goal: Destravar a admissão SPEC do próprio executor, fazer toda skill instalada
      resolver scripts, dependências e assets pelo package root confiável e
      distinguir ledger do installer de um projeto configurado.
    summary: Destrava o executor SPEC, fecha a runtime closure e distingue ledger de setup.
    dependsOn: []
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Admissão SPEC, runtime closure e resolução por package root
            passam em consumidor sem checkout fonte. FAILS when `implement`
            exige `Files` ou qualquer referência instalada resolve fora do
            tarball/para código homônimo do consumidor.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/consumer-runtime-resolution.test.js
              tests/runtime-closure.test.js tests/consumer-install-e2e.test.js
              tests/implement-ready-contract.test.js
            expectExitCode: 0
        - id: F0-G2
          description: Project-scope install não mascara ausência de setup canônico. FAILS
            when a pasta do ledger basta para pular setup.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js
              tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
    status: active
    businessIntent:
      value: Eliminar dependências do checkout fonte e impedir que o ledger do
        installer mascare setup ausente, criando uma base confiável para toda a
        remediação.
      workflow: Fechar runtime closure e setup estrutural; depois entregar segurança
        do installer, contratos de host, caminho SPEC-implement, lifecycle
        transacional, Gemini/portabilidade e qualificação de release.
      rules: Nenhuma mutação sem ownership provado; uma autoridade por contrato;
        reprodução vermelha antes de cada correção; execução em consumidor sem
        checkout fonte; falha fechada diante de ambiguidade.
      outOfScope: Fork permanente do installer, banco transacional genérico, redesign
        da interface aiDeck, features não relacionadas e publicação da release.
      doneWhen: Todos os findings formais e adicionais possuem verifiers verdes;
        black-box, fault matrix, Linux/macOS/Windows, Gemini CLI, full suite,
        docs e skill validation passam.
  - id: F1
    slug: integrity-remediation-f1-installer-v2-e-protecao-de-dados
    title: Installer v2 e proteção de dados
    goal: Entregar em worktree upstream dedicada e integrar no consumer um journal
      versionado, atomic persistence, locks, ownership por hash e recovery
      conservador para install, update e uninstall.
    summary: Torna install, update e uninstall serializados, conservadores e recuperáveis.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Installer v2 impede escrita ou remoção fora do realpath autorizado
            e preserva qualquer conteúdo sem ownership provado. FAILS when
            symlink, greenfield ou runtime editado perde bytes.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006
              --worktree ../minimalist-installer-integrity-remediation
              --require-remote && (cd ../minimalist-installer-integrity-remediation
              && npm test) && node --test tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Concorrência e crash produzem commit completo, rollback explícito
            comprovável ou bloqueio inspecionável. FAILS when manifest, registry
            ou runtime divergem sem journal v2, inspect e recovery determinístico.
          status: pending
          verifier:
            kind: shell
            command: (cd ../minimalist-installer-integrity-remediation && node
              --test test/inspect-rollback.test.js) && node --test
              tests/installer-fault-injection.test.js tests/runtime-refcount.test.js
              tests/runtime-registry-recovery.test.js
              tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
            expectExitCode: 0
    status: pending
    externalImports:
      - kind: url
        path: https://github.com/henryavila/minimalist-installer
        label: Repositório upstream do engine de instalação
        inside_repo: false
      - kind: repo-path
        path: package-lock.json
        label: Tarball 0.1.0 e integridade do baseline instalado
        inside_repo: true
  - id: F2
    slug: integrity-remediation-f2-contratos-de-host-runtime-e-observabil
    title: Contratos de host, runtime e observabilidade
    goal: Remover fallbacks silenciosos entre IDEs, tornar hooks scope-aware e fazer
      status/install relatarem o estado real de skills, assets, runtime e
      conflitos.
    summary: Separa contratos de host e expõe hashes, owners e runtime reais.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Cada host público renderiza ferramentas e hooks apenas do próprio
            contrato. FAILS when tokens Claude ou config Claude aparecem fora do
            host Claude.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/host-profile-contract.test.js
              tests/auto-update-host-matrix.test.js
            expectExitCode: 0
        - id: F2-G2
          description: Status e install observam hashes, decisões e runtime real. FAILS
            when stale, modified, preserved ou runtime mismatch aparece como
            up-to-date.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/status-verify.test.js
              tests/status-runtime-owners.test.js tests/runtime-multiversion.test.js
              tests/runtime-registry-recovery.test.js
            expectExitCode: 0
    status: pending
  - id: F3
    slug: integrity-remediation-f3-caminho-spec-para-implement-e-isolamen
    title: Caminho SPEC para implement e isolamento de execução
    goal: Fazer tasks admitidas pelo SPEC chegarem a `implement` com targets e
      exclusões corretos, resolver o plano solicitado antes dos gates e executar
      cada writer na worktree certa.
    summary: Leva o SPEC materializado ao implement na worktree e no escopo corretos.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: SPEC materializado chega a implement com outputs como targets e
            scopeBoundary como exclusões. FAILS when `Files` é exigido ou uma
            exclusão vira allowlist.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/implement-ready-contract.test.js
              tests/project-implement-e2e.test.js
            expectExitCode: 0
        - id: F3-G2
          description: Argumento explícito seleciona plan, branch e worktree antes de
            qualquer gate ou write. FAILS when a árvore chamadora governa outro
            plano.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/worktree-plan-routing.test.js
            expectExitCode: 0
    status: pending
  - id: F4
    slug: integrity-remediation-f4-autoridade-de-estado-e-transicoes-recu
    title: Autoridade de estado e transições recuperáveis
    goal: Fazer validator, transition helpers e comandos de fechamento
      compartilharem invariantes estritas e gravarem estado, evidence, eventos,
      handoff e materialização de forma idempotente.
    summary: Centraliza invariantes e torna fechamento, eventos e materialização idempotentes.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F4-G1
          description: Validator rejeita identidades, DAGs, IDs e estados terminais
            contraditórios e preserva descriptor lazy válido. FAILS when qualquer
            fixture inválido retorna exit 0 ou descriptor-only pending é rejeitado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/validate-state-integrity.test.js
              tests/state-integrity-migration.test.js
              tests/transition-integrity.test.js
            expectExitCode: 0
        - id: F4-G2
          description: Task e phase close são idempotentes e não deixam writes, eventos ou
            evidence stale. FAILS when retry duplica analytics ou review muda
            HEAD sem rerun.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-done-transaction.test.js
              tests/done-transaction.test.js
              tests/append-completion-actuals.test.js
            expectExitCode: 0
        - id: F4-G3
          description: Materialize e dispatch-log sobrevivem fault injection sem estado
            parcial ou formato híbrido. FAILS when plan/initiative divergem ou
            log deixa de ser NDJSON puro.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-materialization/materialize-transaction.test.js
              tests/append-completion-dispatchlog.test.js
            expectExitCode: 0
    status: pending
  - id: F5
    slug: integrity-remediation-f5-gemini-portabilidade-e-identidade-de-d
    title: Gemini, portabilidade e identidade de dashboard
    goal: Tornar os contratos Gemini observáveis no CLI real, remover suposições
      POSIX e registrar o projectId canônico em worktrees.
    summary: Valida Gemini no CLI real e remove suposições POSIX e de basename.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
            expectExitCode: 0
        - id: F5-G2
          description: Validator e normalizer classificam paths Windows e POSIX com o
            mesmo contrato. FAILS when path.win32 retorna kind ou projectId
            incorreto.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/windows-path-contract.test.js
              tests/validate-state.test.js tests/normalize.test.js
            expectExitCode: 0
        - id: F5-G3
          description: Dashboard registra o projectId canônico com JSON válido em qualquer
            worktree. FAILS when basename ou caracteres do root alteram a
            identidade.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-registration.test.js
            expectExitCode: 0
    status: pending
  - id: F6
    slug: integrity-remediation-f6-qualificacao-de-release-e-fechamento-d
    title: Qualificação de release e fechamento das auditorias
    goal: Exercitar o produto empacotado em hosts, scopes, sistemas e falhas reais e
      impedir release enquanto qualquer finding permanecer reproduzível.
    summary: Qualifica o tarball sob hosts, sistemas, concorrência e fault injection.
    dependsOn:
      - F5
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F6-G1
          description: Black-box e fault matrix passam contra o tarball sem checkout
            fonte. FAILS when qualquer host, scope, crash ou retry deixa estado
            parcial ou depende do repo.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-fault-matrix.test.js
            expectExitCode: 0
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior. FAILS when um finding permanece reproduzível,
            a instalação diverge ou o receipt/job não pertence ao candidato.
          status: pending
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
            expectExitCode: 0
    status: pending
references:
  - kind: repo-path
    path: docs/audits/installer-audit-2026-07-10.md
    label: Auditoria do installer
    inside_repo: true
  - kind: repo-path
    path: docs/audits/project-implement-audit-2026-07-10.md
    label: Auditoria de project e implement
    inside_repo: true
  - kind: repo-path
    path: projects/atomic-skills/integrity-remediation/design.md
    label: Design aprovado da remediação
    inside_repo: true
---

# Remediação integral de segurança, lifecycle e distribuição

## 1. Context

Este plano transforma todos os achados das auditorias de 2026-07-10 em
contratos executáveis. A ordem confirmada é intencional: primeiro destravar o
executor e tornar as skills instaladas autocontidas; depois impedir perda de
dados no installer; tornar hosts, runtime e status observáveis; restaurar o
caminho `SPEC -> estado -> implement`; tornar fechamento e analytics
transacionais; e terminar com Gemini, portabilidade e qualificação de release
em ambientes consumidores reais.

F0 é um bootstrap técnico anterior às ondas do design. A observabilidade de F2
foi colocada antes do lifecycle porque os E2E de F3 precisam distinguir o
runtime realmente carregado e o host efetivo. Essa decomposição refinada foi
confirmada pelo usuário no preview do plano.

verified_by: `docs/audits/installer-audit-2026-07-10.md:1-484`,
`docs/audits/project-implement-audit-2026-07-10.md:1-417` e
`projects/atomic-skills/integrity-remediation/design.md:1-303`.

## 2. Inviolable principles

- **P1 Integridade antes de compatibilidade** — conteúdo sem ownership provado
  nunca é sobrescrito ou apagado; estado ambíguo falha fechado.
- **P2 Uma autoridade por contrato** — o engine upstream governa filesystem e
  journal; `validate-state` governa invariantes; adapters governam hosts.
- **P3 Evidência observável** — suporte, conclusão e recovery são aceitos somente
  por testes do comportamento público.
- **P4 Migração conservadora** — formatos antigos permanecem legíveis até um
  commit novo ser comprovado; dados ambíguos viram `unmanaged`.
- **P5 Fatias recuperáveis** — cada fase termina em estado instalável, validado e
  reversível.
- **P6 Fonte e instalação não divergem** — toda dependência runtime citada por
  uma skill entra no file-set e na superfície publicada.

verified_by: direção ratificada e criticada em
`projects/atomic-skills/integrity-remediation/design.md:12-20,128-171`.

## 3. Phase tree

- **F0** — destrava o executor, fecha runtime closure e setup estrutural (4 tasks, 2 gates).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F0).
- **F2** — separa hosts e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F2).
- **F4** — centraliza invariantes e transações de lifecycle (8 tasks, 3 gates; depende de F3).
- **F5** — corrige Gemini, Windows e identidade de dashboard (6 tasks, 3 gates; depende de F4).
- **F6** — qualifica o tarball e fecha as auditorias (5 tasks, 2 gates; depende de F5).

verified_by: `node scripts/validate-state.js
.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md` e preview
confirmado pelo usuário.

## 4. Bootstrap e fronteira multi-repositório

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
- **F1 usa duas unidades de commit.** Mudanças genéricas do engine são
  microcommits na worktree upstream
  `../minimalist-installer-integrity-remediation`, branch
  `codex/integrity-remediation-v2`. O plano pai nunca tenta stagear paths do
  repositório irmão: F1/T-002..T-004 rodam por TDD direto nessa worktree,
  recebem a tag `external-repo` e fecham no plano pai somente depois que cada
  SHA e comando executado entra em um receipt versionado no consumer.
- **O baseline é content-addressed.** O tarball 0.1.0 e sua integridade vêm de
  `package-lock.json`; T-001 precisa provar uma correspondência única com o
  commit-base upstream. Ausência de correspondência bloqueia a fase, em vez de
  usar o HEAD atual.
- **Push é um gate externo explícito.** F1/T-006 pede autorização imediatamente
  antes de publicar a branch upstream; não cria tag, pacote npm nem release. O
  consumer fixa o SHA completo alcançável pela branch aprovada.
- **F6 congela o candidato antes da evidência.** T-005 cria o commit candidato,
  pede autorização para push, espera todos os jobs e só então grava
  `release-candidate-ci.json` com candidateSha, run IDs e URLs. O gate aceita
  commits posteriores apenas em relatórios e `.atomic-skills/`; qualquer diff de
  produto depois do candidateSha invalida o receipt e exige nova matriz.

verified_by: `skills/core/implement.md:51-77`, `package-lock.json:748-755` e
`projects/atomic-skills/integrity-remediation/design.md:22-92`.

## 5. Mapa de cobertura

- **Installer:** C1 → F1/T-001..T-006; C2 → F0/T-003; C3 → F0/T-001,
  F0/T-002 e F0/T-004; H1 → F2/T-001; H2/H3/H6 → F1/T-005 e F2/T-004;
  H4 → F2/T-002; H5 → F2/T-003; M1/M2/M3 → F0/T-002; M4 → F1/T-006.
- **Project/implement:** C1 → F0/T-001 e F0/T-004; C2 → F0/T-001 e
  F3/T-001; C3 → F4/T-003; H1/H9 → F3/T-002; H2 → F4/T-004; H3 →
  F4/T-005; H4 → F3/T-003 e F4/T-005; H5 → F0/T-004; H6 → F4/T-007;
  H7 → F4/T-006; H8 → F3/T-003; H10 → F0/T-001; M1/M3/M4/M5/M6/M8 →
  F3/T-004; M2/M7 → F4/T-008; M9 → F5/T-006.
- **Achados adversariais adicionais:** terminalidade com sibling aberto e ciclos
  → F4/T-002; identidade plan/phase/initiative, gate pendente em fase terminal
  e IDs duplicados → F4/T-001. A ausência de initiative continua válida apenas
  para descriptor `pending`, `subPhaseCount: 0`, com sidecar lazy correspondente.

verified_by: `docs/audits/installer-audit-2026-07-10.md:43-397`,
`docs/audits/project-implement-audit-2026-07-10.md:32-330`,
`src/transition.js:67-134`, `scripts/validate-state.js:398-605`,
`scripts/lint-source.js:178-324` e `src/decompose.js:444-709`.

## Self-review against code-quality gates

- **G1 read-before-claim**: 10 claims de comportamento atual possuem excerpts no
  design aprovado; as 38 tasks descrevem trabalho futuro e ligam cada causa a
  um intervalo numérico de relatório/source. Nenhuma claim é inferida apenas
  pelo nome de um arquivo.
- **G2 soft-language**: varredura planejada sobre body, `nextAction`, tasks e gates;
  0 ocorrências da ban list aceitas na versão final.
- **G6 reference-or-strike**: 38/38 descrições de task carregam `verified_by:`
  com `file:line`; os três grupos de assertions da narrativa possuem
  `verified_by:` numérico/comando e os 16 critérios de saída carregam verifier
  determinístico.
- **G10 gate-must-be-able-to-fail**: 16 exit criteria possuem verifier
  determinístico e uma condição explícita `FAILS when`; critérios sem red
  observável: none.

## Reviews

- internal: 16 findings applied @ b2a845a (2026-07-10T20:48:55Z)


---INITIATIVE DETAIL (context only)---

---INITIATIVE F0: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel (file: .atomic-skills/projects/atomic-skills/integrity-remediation/phases/f0-runtime-autocontido-e-setup-confiavel.md)---
Tasks: T-001 Destravar o executor e expor CLIs estáveis | T-002 Fechar o grafo de assets e detectar colisões | T-003 Tornar o sentinel de setup estrutural | T-004 Provar execução fora do checkout fonte
Exit gates: F0-G1 Admissão SPEC, runtime closure e resolução por package root passam em consumidor | F0-G2 Project-scope install não mascara ausência de setup canônico. FAILS when a pasta
Scope: not declared
---END INITIATIVE F0---
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- No permanent fork of minimalist-installer.
- No general database, distributed transaction protocol, or background recovery daemon.
- No ownership inference for legacy artifacts from path alone.
- No unrelated product features or aiDeck UI redesign.
- No host-support claim based only on generated-file snapshots.
- No atomic-skills package, tag, or release publication in this plan.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: /Volumes/External/code/.worktrees/atomic-skills-integrity-remediation/.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md

---BEGIN ARTIFACT---
---
schemaVersion: "0.1"
slug: integrity-remediation
title: Remediação integral de segurança, lifecycle e distribuição
version: "1.0"
status: active
started: 2026-07-10T20:07:37.544Z
lastUpdated: 2026-07-10T20:48:55Z
branch: plan/integrity-remediation
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Integridade antes de compatibilidade
    body: conteúdo sem ownership provado nunca é sobrescrito ou apagado; estado
      ambíguo falha fechado.
  - id: P2
    title: Uma autoridade por contrato
    body: o engine upstream governa filesystem e journal; validate-state governa
      invariantes estruturais; adapters governam hosts.
  - id: P3
    title: Evidência observável
    body: suporte, conclusão e recovery são aceitos somente por testes do
      comportamento público.
  - id: P4
    title: Migração conservadora
    body: formatos antigos permanecem legíveis até um commit novo ser comprovado;
      dados ambíguos viram unmanaged.
  - id: P5
    title: Fatias recuperáveis
    body: cada fase termina em estado instalável, validado e reversível.
  - id: P6
    title: Fonte e instalação não divergem
    body: toda dependência runtime citada por uma skill entra no file-set e na
      superfície publicada.
glossary:
  - term: Journal v2
    definition: Protocolo versionado com transaction id, stable effect id, hashes,
      ownership e estado de commit.
  - term: Unmanaged
    definition: Artefato cuja propriedade não foi provada e que
      install/update/uninstall preservam.
  - term: Runtime closure
    definition: Conjunto completo de scripts, assets, schemas e referências
      necessárias para uma skill instalada executar fora deste checkout.
  - term: Preflight
    definition: Validação pura executada antes de verifiers, eventos ou writes de
      uma transição.
  - term: Commit guard
    definition: Releitura final que rejeita estado stale ou contraditório antes de
      gravar fechamento.
  - term: Host contract
    definition: Layout, ferramentas, argumentos, hooks e comportamento observável
      suportados por uma IDE/CLI.
phases:
  - id: F0
    slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
    title: Runtime autocontido e setup confiável
    goal: Destravar a admissão SPEC do próprio executor, fazer toda skill instalada
      resolver scripts, dependências e assets pelo package root confiável e
      distinguir ledger do installer de um projeto configurado.
    summary: Destrava o executor SPEC, fecha a runtime closure e distingue ledger de setup.
    dependsOn: []
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Admissão SPEC, runtime closure e resolução por package root
            passam em consumidor sem checkout fonte. FAILS when `implement`
            exige `Files` ou qualquer referência instalada resolve fora do
            tarball/para código homônimo do consumidor.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/consumer-runtime-resolution.test.js
              tests/runtime-closure.test.js tests/consumer-install-e2e.test.js
              tests/implement-ready-contract.test.js
            expectExitCode: 0
        - id: F0-G2
          description: Project-scope install não mascara ausência de setup canônico. FAILS
            when a pasta do ledger basta para pular setup.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js
              tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
    status: active
    businessIntent:
      value: Eliminar dependências do checkout fonte e impedir que o ledger do
        installer mascare setup ausente, criando uma base confiável para toda a
        remediação.
      workflow: Fechar runtime closure e setup estrutural; depois entregar segurança
        do installer, contratos de host, caminho SPEC-implement, lifecycle
        transacional, Gemini/portabilidade e qualificação de release.
      rules: Nenhuma mutação sem ownership provado; uma autoridade por contrato;
        reprodução vermelha antes de cada correção; execução em consumidor sem
        checkout fonte; falha fechada diante de ambiguidade.
      outOfScope: Fork permanente do installer, banco transacional genérico, redesign
        da interface aiDeck, features não relacionadas e publicação da release.
      doneWhen: Todos os findings formais e adicionais possuem verifiers verdes;
        black-box, fault matrix, Linux/macOS/Windows, Gemini CLI, full suite,
        docs e skill validation passam.
  - id: F1
    slug: integrity-remediation-f1-installer-v2-e-protecao-de-dados
    title: Installer v2 e proteção de dados
    goal: Entregar em worktree upstream dedicada e integrar no consumer um journal
      versionado, atomic persistence, locks, ownership por hash e recovery
      conservador para install, update e uninstall.
    summary: Torna install, update e uninstall serializados, conservadores e recuperáveis.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Installer v2 impede escrita ou remoção fora do realpath autorizado
            e preserva qualquer conteúdo sem ownership provado. FAILS when
            symlink, greenfield ou runtime editado perde bytes.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006
              --worktree ../minimalist-installer-integrity-remediation
              --require-remote && (cd ../minimalist-installer-integrity-remediation
              && npm test) && node --test tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Concorrência e crash produzem commit completo, rollback explícito
            comprovável ou bloqueio inspecionável. FAILS when manifest, registry
            ou runtime divergem sem journal v2, inspect e recovery determinístico.
          status: pending
          verifier:
            kind: shell
            command: (cd ../minimalist-installer-integrity-remediation && node
              --test test/inspect-rollback.test.js) && node --test
              tests/installer-fault-injection.test.js tests/runtime-refcount.test.js
              tests/runtime-registry-recovery.test.js
              tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
            expectExitCode: 0
    status: pending
    externalImports:
      - kind: url
        path: https://github.com/henryavila/minimalist-installer
        label: Repositório upstream do engine de instalação
        inside_repo: false
      - kind: repo-path
        path: package-lock.json
        label: Tarball 0.1.0 e integridade do baseline instalado
        inside_repo: true
  - id: F2
    slug: integrity-remediation-f2-contratos-de-host-runtime-e-observabil
    title: Contratos de host, runtime e observabilidade
    goal: Remover fallbacks silenciosos entre IDEs, tornar hooks scope-aware e fazer
      status/install relatarem o estado real de skills, assets, runtime e
      conflitos.
    summary: Separa contratos de host e expõe hashes, owners e runtime reais.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Cada host público renderiza ferramentas e hooks apenas do próprio
            contrato. FAILS when tokens Claude ou config Claude aparecem fora do
            host Claude.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/host-profile-contract.test.js
              tests/auto-update-host-matrix.test.js
            expectExitCode: 0
        - id: F2-G2
          description: Status e install observam hashes, decisões e runtime real. FAILS
            when stale, modified, preserved ou runtime mismatch aparece como
            up-to-date.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/status-verify.test.js
              tests/status-runtime-owners.test.js tests/runtime-multiversion.test.js
              tests/runtime-registry-recovery.test.js
            expectExitCode: 0
    status: pending
  - id: F3
    slug: integrity-remediation-f3-caminho-spec-para-implement-e-isolamen
    title: Caminho SPEC para implement e isolamento de execução
    goal: Fazer tasks admitidas pelo SPEC chegarem a `implement` com targets e
      exclusões corretos, resolver o plano solicitado antes dos gates e executar
      cada writer na worktree certa.
    summary: Leva o SPEC materializado ao implement na worktree e no escopo corretos.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: SPEC materializado chega a implement com outputs como targets e
            scopeBoundary como exclusões. FAILS when `Files` é exigido ou uma
            exclusão vira allowlist.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/implement-ready-contract.test.js
              tests/project-implement-e2e.test.js
            expectExitCode: 0
        - id: F3-G2
          description: Argumento explícito seleciona plan, branch e worktree antes de
            qualquer gate ou write. FAILS when a árvore chamadora governa outro
            plano.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/worktree-plan-routing.test.js
            expectExitCode: 0
    status: pending
  - id: F4
    slug: integrity-remediation-f4-autoridade-de-estado-e-transicoes-recu
    title: Autoridade de estado e transições recuperáveis
    goal: Fazer validator, transition helpers e comandos de fechamento
      compartilharem invariantes estritas e gravarem estado, evidence, eventos,
      handoff e materialização de forma idempotente.
    summary: Centraliza invariantes e torna fechamento, eventos e materialização idempotentes.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F4-G1
          description: Validator rejeita identidades, DAGs, IDs e estados terminais
            contraditórios e preserva descriptor lazy válido. FAILS when qualquer
            fixture inválido retorna exit 0 ou descriptor-only pending é rejeitado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/validate-state-integrity.test.js
              tests/state-integrity-migration.test.js
              tests/transition-integrity.test.js
            expectExitCode: 0
        - id: F4-G2
          description: Task e phase close são idempotentes e não deixam writes, eventos ou
            evidence stale. FAILS when retry duplica analytics ou review muda
            HEAD sem rerun.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-done-transaction.test.js
              tests/done-transaction.test.js
              tests/append-completion-actuals.test.js
            expectExitCode: 0
        - id: F4-G3
          description: Materialize e dispatch-log sobrevivem fault injection sem estado
            parcial ou formato híbrido. FAILS when plan/initiative divergem ou
            log deixa de ser NDJSON puro.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-materialization/materialize-transaction.test.js
              tests/append-completion-dispatchlog.test.js
            expectExitCode: 0
    status: pending
  - id: F5
    slug: integrity-remediation-f5-gemini-portabilidade-e-identidade-de-d
    title: Gemini, portabilidade e identidade de dashboard
    goal: Tornar os contratos Gemini observáveis no CLI real, remover suposições
      POSIX e registrar o projectId canônico em worktrees.
    summary: Valida Gemini no CLI real e remove suposições POSIX e de basename.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
            expectExitCode: 0
        - id: F5-G2
          description: Validator e normalizer classificam paths Windows e POSIX com o
            mesmo contrato. FAILS when path.win32 retorna kind ou projectId
            incorreto.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/windows-path-contract.test.js
              tests/validate-state.test.js tests/normalize.test.js
            expectExitCode: 0
        - id: F5-G3
          description: Dashboard registra o projectId canônico com JSON válido em qualquer
            worktree. FAILS when basename ou caracteres do root alteram a
            identidade.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-registration.test.js
            expectExitCode: 0
    status: pending
  - id: F6
    slug: integrity-remediation-f6-qualificacao-de-release-e-fechamento-d
    title: Qualificação de release e fechamento das auditorias
    goal: Exercitar o produto empacotado em hosts, scopes, sistemas e falhas reais e
      impedir release enquanto qualquer finding permanecer reproduzível.
    summary: Qualifica o tarball sob hosts, sistemas, concorrência e fault injection.
    dependsOn:
      - F5
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F6-G1
          description: Black-box e fault matrix passam contra o tarball sem checkout
            fonte. FAILS when qualquer host, scope, crash ou retry deixa estado
            parcial ou depende do repo.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-fault-matrix.test.js
            expectExitCode: 0
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior. FAILS when um finding permanece reproduzível,
            a instalação diverge ou o receipt/job não pertence ao candidato.
          status: pending
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
            expectExitCode: 0
    status: pending
references:
  - kind: repo-path
    path: docs/audits/installer-audit-2026-07-10.md
    label: Auditoria do installer
    inside_repo: true
  - kind: repo-path
    path: docs/audits/project-implement-audit-2026-07-10.md
    label: Auditoria de project e implement
    inside_repo: true
  - kind: repo-path
    path: projects/atomic-skills/integrity-remediation/design.md
    label: Design aprovado da remediação
    inside_repo: true
---

# Remediação integral de segurança, lifecycle e distribuição

## 1. Context

Este plano transforma todos os achados das auditorias de 2026-07-10 em
contratos executáveis. A ordem confirmada é intencional: primeiro destravar o
executor e tornar as skills instaladas autocontidas; depois impedir perda de
dados no installer; tornar hosts, runtime e status observáveis; restaurar o
caminho `SPEC -> estado -> implement`; tornar fechamento e analytics
transacionais; e terminar com Gemini, portabilidade e qualificação de release
em ambientes consumidores reais.

F0 é um bootstrap técnico anterior às ondas do design. A observabilidade de F2
foi colocada antes do lifecycle porque os E2E de F3 precisam distinguir o
runtime realmente carregado e o host efetivo. Essa decomposição refinada foi
confirmada pelo usuário no preview do plano.

verified_by: `docs/audits/installer-audit-2026-07-10.md:1-484`,
`docs/audits/project-implement-audit-2026-07-10.md:1-417` e
`projects/atomic-skills/integrity-remediation/design.md:1-303`.

## 2. Inviolable principles

- **P1 Integridade antes de compatibilidade** — conteúdo sem ownership provado
  nunca é sobrescrito ou apagado; estado ambíguo falha fechado.
- **P2 Uma autoridade por contrato** — o engine upstream governa filesystem e
  journal; `validate-state` governa invariantes; adapters governam hosts.
- **P3 Evidência observável** — suporte, conclusão e recovery são aceitos somente
  por testes do comportamento público.
- **P4 Migração conservadora** — formatos antigos permanecem legíveis até um
  commit novo ser comprovado; dados ambíguos viram `unmanaged`.
- **P5 Fatias recuperáveis** — cada fase termina em estado instalável, validado e
  reversível.
- **P6 Fonte e instalação não divergem** — toda dependência runtime citada por
  uma skill entra no file-set e na superfície publicada.

verified_by: direção ratificada e criticada em
`projects/atomic-skills/integrity-remediation/design.md:12-20,128-171`.

## 3. Phase tree

- **F0** — destrava o executor, fecha runtime closure e setup estrutural (4 tasks, 2 gates).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F0).
- **F2** — separa hosts e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F2).
- **F4** — centraliza invariantes e transações de lifecycle (8 tasks, 3 gates; depende de F3).
- **F5** — corrige Gemini, Windows e identidade de dashboard (6 tasks, 3 gates; depende de F4).
- **F6** — qualifica o tarball e fecha as auditorias (5 tasks, 2 gates; depende de F5).

verified_by: `node scripts/validate-state.js
.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md` e preview
confirmado pelo usuário.

## 4. Bootstrap e fronteira multi-repositório

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
- **F1 usa duas unidades de commit.** Mudanças genéricas do engine são
  microcommits na worktree upstream
  `../minimalist-installer-integrity-remediation`, branch
  `codex/integrity-remediation-v2`. O plano pai nunca tenta stagear paths do
  repositório irmão: F1/T-002..T-004 rodam por TDD direto nessa worktree,
  recebem a tag `external-repo` e fecham no plano pai somente depois que cada
  SHA e comando executado entra em um receipt versionado no consumer.
- **O baseline é content-addressed.** O tarball 0.1.0 e sua integridade vêm de
  `package-lock.json`; T-001 precisa provar uma correspondência única com o
  commit-base upstream. Ausência de correspondência bloqueia a fase, em vez de
  usar o HEAD atual.
- **Push é um gate externo explícito.** F1/T-006 pede autorização imediatamente
  antes de publicar a branch upstream; não cria tag, pacote npm nem release. O
  consumer fixa o SHA completo alcançável pela branch aprovada.
- **F6 congela o candidato antes da evidência.** T-005 cria o commit candidato,
  pede autorização para push, espera todos os jobs e só então grava
  `release-candidate-ci.json` com candidateSha, run IDs e URLs. O gate aceita
  commits posteriores apenas em relatórios e `.atomic-skills/`; qualquer diff de
  produto depois do candidateSha invalida o receipt e exige nova matriz.

verified_by: `skills/core/implement.md:51-77`, `package-lock.json:748-755` e
`projects/atomic-skills/integrity-remediation/design.md:22-92`.

## 5. Mapa de cobertura

- **Installer:** C1 → F1/T-001..T-006; C2 → F0/T-003; C3 → F0/T-001,
  F0/T-002 e F0/T-004; H1 → F2/T-001; H2/H3/H6 → F1/T-005 e F2/T-004;
  H4 → F2/T-002; H5 → F2/T-003; M1/M2/M3 → F0/T-002; M4 → F1/T-006.
- **Project/implement:** C1 → F0/T-001 e F0/T-004; C2 → F0/T-001 e
  F3/T-001; C3 → F4/T-003; H1/H9 → F3/T-002; H2 → F4/T-004; H3 →
  F4/T-005; H4 → F3/T-003 e F4/T-005; H5 → F0/T-004; H6 → F4/T-007;
  H7 → F4/T-006; H8 → F3/T-003; H10 → F0/T-001; M1/M3/M4/M5/M6/M8 →
  F3/T-004; M2/M7 → F4/T-008; M9 → F5/T-006.
- **Achados adversariais adicionais:** terminalidade com sibling aberto e ciclos
  → F4/T-002; identidade plan/phase/initiative, gate pendente em fase terminal
  e IDs duplicados → F4/T-001. A ausência de initiative continua válida apenas
  para descriptor `pending`, `subPhaseCount: 0`, com sidecar lazy correspondente.

verified_by: `docs/audits/installer-audit-2026-07-10.md:43-397`,
`docs/audits/project-implement-audit-2026-07-10.md:32-330`,
`src/transition.js:67-134`, `scripts/validate-state.js:398-605`,
`scripts/lint-source.js:178-324` e `src/decompose.js:444-709`.

## Self-review against code-quality gates

- **G1 read-before-claim**: 10 claims de comportamento atual possuem excerpts no
  design aprovado; as 38 tasks descrevem trabalho futuro e ligam cada causa a
  um intervalo numérico de relatório/source. Nenhuma claim é inferida apenas
  pelo nome de um arquivo.
- **G2 soft-language**: varredura planejada sobre body, `nextAction`, tasks e gates;
  0 ocorrências da ban list aceitas na versão final.
- **G6 reference-or-strike**: 38/38 descrições de task carregam `verified_by:`
  com `file:line`; os três grupos de assertions da narrativa possuem
  `verified_by:` numérico/comando e os 16 critérios de saída carregam verifier
  determinístico.
- **G10 gate-must-be-able-to-fail**: 16 exit criteria possuem verifier
  determinístico e uma condição explícita `FAILS when`; critérios sem red
  observável: none.

## Reviews

- internal: 16 findings applied @ b2a845a (2026-07-10T20:48:55Z)


---INITIATIVE DETAIL (context only)---

---INITIATIVE F0: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel (file: .atomic-skills/projects/atomic-skills/integrity-remediation/phases/f0-runtime-autocontido-e-setup-confiavel.md)---
Tasks: T-001 Destravar o executor e expor CLIs estáveis | T-002 Fechar o grafo de assets e detectar colisões | T-003 Tornar o sentinel de setup estrutural | T-004 Provar execução fora do checkout fonte
Exit gates: F0-G1 Admissão SPEC, runtime closure e resolução por package root passam em consumidor | F0-G2 Project-scope install não mascara ausência de setup canônico. FAILS when a pasta
Scope: not declared
---END INITIATIVE F0---
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Supported Node runtime is `^22.18.0 || >=24.11.0` (verify: `package.json:85-87`).
- Skill Markdown files must use the declared tool-template variables and `{{ARG_VAR}}`, not hardcoded tool names or `$ARGUMENTS` (verify: `AGENTS.md:14-22`).
- Every persistent installer mutation must have an uninstall reversal; the allowlist is empty and byte-for-byte roundtrip is test-enforced (verify: `CLAUDE.md:27-46`).
- Plan materialization is intentionally lazy: creation materializes only F0; F1..N remain descriptor/source sidecars until `project materialize` (verify: `CLAUDE.md:21-25` and the six `.source.json` files beside F0).
- `atomic-skills` consumes the installer engine through the package dependency; journal reversal is owned by the engine, not duplicated in consumer uninstall code (verify: `CLAUDE.md:58-70`).
- The repository requires a red test before implementation and fresh command evidence before any green claim (verify: `CLAUDE.md:53-57`).

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: reject
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary

A ordem executa e encerra F1–F3 usando justamente o lifecycle não idempotente que F4 pretende corrigir, permitindo evidência e estado inconsistentes antes da remediação. O desenho de confinamento também não cobre troca concorrente de symlinks entre validação e escrita.

Além disso, o domínio dos locks compartilhados está indefinido, somente Gemini recebe verificação explícita em CLI real, e o gate final não possui inventário executável que prove a cobertura de todos os findings declarados.

## Findings

### F-001 [critical] ordering — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:402-420

**Evidence:**
```md
- **F0** — destrava o executor, fecha runtime closure e setup estrutural (4 tasks, 2 gates).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F0).
- **F2** — separa hosts e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F2).
- **F4** — centraliza invariantes e transações de lifecycle (8 tasks, 3 gates; depende de F3).
- **F5** — corrige Gemini, Windows e identidade de dashboard (6 tasks, 3 gates; depende de F4).
- **F6** — qualifica o tarball e fecha as auditorias (5 tasks, 2 gates; depende de F5).

verified_by: `node scripts/validate-state.js
.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md` e preview
confirmado pelo usuário.

## 4. Bootstrap e fronteira multi-repositório

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
```

**Claim:** F1–F3 dependem do executor e dos comandos de fechamento antes de F4 corrigir preflight, commit guard, idempotência e materialização, portanto essas fases podem ser encerradas com o estado inconsistente que o próprio plano reconhece apenas mais tarde.

**Impact:** Uma falha ou retry durante F1–F3 pode duplicar eventos, preservar evidence stale, fechar a fase no SHA errado ou divergir plan/initiative; isso pode bloquear F4 ou fazê-lo operar sobre histórico já corrompido.

**Recommendation:** Mover para antes de F1 uma fase bootstrap com preflight, commit guard, fechamento idempotente e materialização recuperável; depois validar e reconciliar o fechamento de F0 antes de liberar o executor canônico.

**Confidence:** high

---

### F-002 [critical] security — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:118-130

**Evidence:**
```yaml
        - id: F1-G1
          description: Installer v2 impede escrita ou remoção fora do realpath autorizado
            e preserva qualquer conteúdo sem ownership provado. FAILS when
            symlink, greenfield ou runtime editado perde bytes.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006
              --worktree ../minimalist-installer-integrity-remediation
              --require-remote && (cd ../minimalist-installer-integrity-remediation
              && npm test) && node --test tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
            expectExitCode: 0
```

**Claim:** O plano exige validação por `realpath`, mas não exige confinamento resistente a TOCTOU nem teste que troque um componente por symlink entre a validação e a mutação, permitindo que um path validado passe a apontar para fora da raiz.

**Impact:** Um processo concorrente pode redirecionar write, rename, prune ou rollback para arquivos externos depois do check, causando sobrescrita ou remoção fora da raiz autorizada apesar de F1-G1 passar.

**Recommendation:** Especificar primitivas de mutação ancoradas em diretório sem seguir symlinks ou revalidação segura imediatamente antes de cada efeito, e adicionar fault tests que troquem cada componente de path durante write, rename, prune e rollback.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:108-142

**Evidence:**
```yaml
    goal: Entregar em worktree upstream dedicada e integrar no consumer um journal
      versionado, atomic persistence, locks, ownership por hash e recovery
      conservador para install, update e uninstall.
```

```yaml
        - id: F1-G2
          description: Concorrência e crash produzem commit completo, rollback explícito
            comprovável ou bloqueio inspecionável. FAILS when manifest, registry
            ou runtime divergem sem journal v2, inspect e recovery determinístico.
          status: pending
          verifier:
            kind: shell
            command: (cd ../minimalist-installer-integrity-remediation && node
              --test test/inspect-rollback.test.js) && node --test
              tests/installer-fault-injection.test.js tests/runtime-refcount.test.js
              tests/runtime-registry-recovery.test.js
              tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
```

**Claim:** O plano não define a identidade, granularidade ou ordem dos locks quando instalações em roots diferentes compartilham registry e runtime, portanto locks por projeto podem não serializar mutações do mesmo recurso global.

**Impact:** Instalações concorrentes user-scope e project-scope podem perder owners/refcounts, eleger owners diferentes ou remover um runtime ainda utilizado mesmo que testes concorrentes sobre uma única raiz passem.

**Recommendation:** Definir locks por recurso canônico compartilhado, estabelecer ordem global quando uma transação adquire múltiplos locks e exigir testes multiprocesso cruzando roots, scopes e versões de runtime.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:280-329

**Evidence:**
```yaml
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
            expectExitCode: 0
```

```yaml
        - id: F6-G1
          description: Black-box e fault matrix passam contra o tarball sem checkout
            fonte. FAILS when qualquer host, scope, crash ou retry deixa estado
            parcial ou depende do repo.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-fault-matrix.test.js
            expectExitCode: 0
```

**Claim:** Apenas Gemini possui requisito explícito de discovery e invocation pelo CLI suportado, enquanto o gate multi-host permite que os demais hosts sejam qualificados somente por um teste Node sem obrigação de executar seu comportamento público.

**Impact:** Claude, Codex, Cursor, OpenCode ou GitHub Copilot podem receber artifacts que renderizam corretamente, mas não são descobertos ou invocados pelo host real, produzindo uma declaração de suporte baseada apenas em fixtures.

**Recommendation:** Definir para cada host um probe público obrigatório com versão registrada e operações discovery/load/invoke; para hosts sem automação executável, limitar explicitamente o resultado a compatibilidade de layout, sem qualificá-lo como suporte de host.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/integrity-remediation/plan.md:102-104

**Evidence:**
```yaml
      doneWhen: Todos os findings formais e adicionais possuem verifiers verdes;
        black-box, fault matrix, Linux/macOS/Windows, Gemini CLI, full suite,
        docs e skill validation passam.
```

```yaml
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade e receipt dos
            jobs Linux/macOS/Windows/Gemini ficam verdes no candidateSha sem diff
            de produto posterior. FAILS when um finding permanece reproduzível,
            a instalação diverge ou o receipt/job não pertence ao candidato.
          status: pending
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json
              --require linux,macos,windows,gemini
```

**Claim:** O critério exige verifier verde para todo finding, mas o comando final não valida um inventário enumerado de findings contra testes, reproduções e evidências, de modo que findings omitidos da suíte não fazem o gate falhar.

**Impact:** Uma auditoria pode ser marcada como encerrada com findings sem reproducer ou verifier, desde que os testes existentes e os quatro jobs declarados estejam verdes.

**Recommendation:** Criar um manifesto canônico com cada ID de finding, origem, reproducer, verifier e SHA de resolução, e adicionar ao F6-G2 um verificador que rejeite IDs ausentes, duplicados, sem teste executado ou sem evidência pertencente ao candidateSha.

**Confidence:** high

## Questions (non-findings)

- Nenhuma.

## Out of scope

- Publicação de pacote, tag ou release.
- Fork permanente do minimalist-installer.
- Inferência de ownership legado baseada somente em path.
---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.
```

</details>

## Self-review against code-quality gates

- G1 read-before-claim: 10 current-code claims use pasted excerpts in the approved design; task causes use numeric file:line evidence; 0 name-only inferences.
- G2 soft-language: ban-list grep across plan, F0 initiative, and six sidecars found 0 occurrences.
- G6 reference-or-strike: 43 assertion groups counted (38 task descriptions + 5 plan-body groups); 43 carry verified_by/file:line or a deterministic command, 0 unverified, 0 bare.
- Initiative-depth: discovered 1/7 materialized initiatives; F1-F6 are intentional descriptor/source sidecars under the lazy-materialization contract. F0 gate-task alignment: 2 gates checked, 2 covered, 0 uncovered.

## Fixes applied in this session

<!-- Append-only. Triagem step adds lines here as user approves/skips. -->

- **2026-07-11 (author triage — user approved “Aplicar todos”):** all 6 final findings were applied to the plan, F0 initiative and lazy phase sidecars. Verdict `reject → resolved`.
  - **F-001 [critical] applied** — execution DAG changed to `F0 → F4 → F3 → F1 → F2 → F5 → F6`; F0/T-005 bootstraps recoverable F4 materialization; F4/T-003 removes defer/skip/status-edit bypass; F4/T-006 reconciles F0 descriptor/initiative/sidecars/creation-gate plus gate evidence, completion events and close SHA, and F3 activation rechecks the receipt.
  - **F-002 [critical] applied** — F1/T-001..T-003 and F1-G1 require no-follow/directory-handle-equivalent mutation, reject check-then-use fallback and deterministically swap every path component, including write/prune/rollback leafs and both source/destination leafs of temp→rename, after the last safety decision and before the kernel effect.
  - **F-003 [major] applied** — F1 defines source-qualified canonical lock identities, one user-scoped cross-root lock namespace, bytewise total acquisition order, deduplication, reverse release and no late acquisition; tests cross roots, user/project scopes and runtime fingerprints.
  - **F-004 [major] applied** — F2 declares a canonical `operational|layout-only` tier for every public host; only a versioned real-CLI receipt with discovery/load/invoke qualifies `operational`, while F6 forbids fixtures or skips from making that claim.
  - **F-005 [major] applied** — F6 creates a source-qualified exact-set findings manifest covering both audits and F-001..F-006, with owner task, reproducer, executed verifier, evidence digest/job and one candidateSha; the final gate rejects omissions, duplicates, stale evidence or SHA mismatch.
  - **F-006 [major] applied** — F6 requires the Cartesian CI matrix Linux/macOS/Windows × Node 22.18.x/Node >=24.11.0, records observed `process.version` and rejects absent, inferred, skipped or out-of-range runtime axes.
  - **Post-fix validation:** plan and F0 pass `validate-state`; all six JSON sidecars parse; descriptor/initiative/sidecar goals and 16 gates mirror exactly; 39/39 tasks carry numeric `verified_by`, verifier and outputs; business-intent/summary/task-summary/weight/signal/title detectors and the soft-language ban list are clean; a fresh transition simulation proves the non-numeric DAG. Three independent adversarial rechecks returned PASS for F-001, F-002/F-003 and F-004/F-005/F-006.
