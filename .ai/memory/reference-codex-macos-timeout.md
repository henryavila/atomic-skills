---
name: reference-codex-macos-timeout
description: Canonical Codex invocation usa `timeout` (GNU coreutils) que não vem no macOS. Usar `perl -e 'alarm N; exec @ARGV'` como wrapper.
metadata:
  type: reference
---

# Codex CLI no macOS: `timeout` não existe, usar `perl alarm` como wrapper

**Onde:** `skills/shared/codex-bridge-assets/invocation-canonical.txt` usa `timeout <N> codex ...` na invocação canônica. No macOS sem coreutils instalado, o comando falha com `command not found: timeout` (exit 127).

**Sintomas:** ao invocar review-plan-with-codex ou review-code-with-codex em uma máquina sem coreutils:
- `which gtimeout` → not found
- `brew list coreutils` → No such keg
- Codex nunca executa, output file nunca é criado, mensagem genérica de exit 127

**Workaround validado (2026-05-21):**

```bash
perl -e 'alarm 600; exec @ARGV' codex -a never exec \
  -c model_reasoning_effort=high \
  --sandbox read-only \
  --skip-git-repo-check \
  --ephemeral \
  -o <OUTPUT_PATH> \
  - < <BRIEFING_PATH> \
  2>/dev/null
```

`perl` está em `/usr/bin/perl` em todo macOS (sistema). `alarm` envia SIGALRM ao próprio processo após N segundos; `exec @ARGV` substitui o processo perl pelo comando alvo, preservando o alarm. Exit code é o do comando filho (não 124 como `timeout` faria — adapte detecção de timeout para checar se output file existe + SIGALRM signal).

**Como aplicar:** em qualquer skill que invoque codex via Bash em ambiente macOS, substituir `timeout N codex ...` por `perl -e 'alarm N; exec @ARGV' codex ...` ou checar `which timeout` upfront e bifurcar.

**Próximo passo natural:** atualizar `invocation-canonical.txt` para detectar plataforma (Bash `$(uname)` + `command -v timeout || command -v gtimeout`) ou padronizar no wrapper perl que funciona universalmente. Não foi feito nesta sessão porque o pedido era usar a skill, não corrigi-la.

**Related:**
- [[feedback-framing-llm-judge]] — princípios de cross-model review (a invocação canônica é parte desse fluxo)
