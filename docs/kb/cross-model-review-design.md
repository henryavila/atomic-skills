# Cross-Model Review — Design Principles

## When to use

Use `review-plan --mode=codex` (or `--mode=both`) or `review-code --mode=codex` (or `--mode=both`) when:
- Plan/spec is large or architecturally significant
- Code change is in a critical path (auth, data, infra)
- You want a second opinion from a different model family (mitigates self-preference bias)

Use `review-plan --mode=local` or `review-code --mode=local` (same-model self-loop) when:
- Quick sanity check
- Codex CLI not available
- Iterating fast

Default (no `--mode=` flag, interactive TTY): the Step 0 mode picker
runs and defaults to `both` — local first then codex on the cleaned
artifact / same captured diff, with the sealed envelope preserved.

## Core principles

### 1. Cross-family is the point
- Claude reviewing Claude has documented self-preference bias (arXiv 2410.21819, 2508.06709, 2509.26464)
- GPT (via Codex CLI) is family-different — independent vector of bias
- Same-model review remains useful but is a complement, not a replacement

### 2. Briefing is factual, NOT narrative
- Intent narrative envenena o reviewer em até -93pp de detecção (arXiv 2603.18740)
- Briefing contém: anti-framing directive + constraints externas verificáveis + non-goals + out-of-scope
- Briefing NÃO contém: intent steelman, memória curada, autoria

### 3. Two-pass sealed envelope is always on
- Pass 1: blind, sem constraints
- Pass 2: revela constraints, Codex reconcilia
- Delta blind→informed = sinal empírico de framing
- Custo: ~1.8x tokens, 2x latência — aceitável para cross-model review

### 4. Output is markdown, not JSON
- Findings com snippets de código ficam ilegíveis em JSON
- Claude lê markdown nativamente
- Frontmatter YAML mínimo para parse programático (verdict, counts, framing_delta)

### 5. Codex resolves the model
- Skill NÃO passa `--model` por default; Codex usa o recommended dele
- `codex update` atualiza modelos disponíveis
- Override via flag explícita ou `codex debug models` para listar

## Anti-patterns

- Adicionar "## Why we chose this approach" no briefing
- Injetar memória curada do projeto para "ajudar" o Codex
- Passar arquivos grandes sem necessidade (context rot)
- Pular o pre-flight check porque "Codex está instalado, eu sei"
- Aceitar verdict do Codex sem revisar findings

## References

- Spec: `docs/superpowers/specs/2026-05-16-cross-model-review-design.md`
- Plan: `docs/superpowers/plans/2026-05-17-cross-model-review.md`
- Memory: `.ai/memory/feedback-framing-llm-judge.md`
- Memory: `.ai/memory/feedback-formato-retorno.md`
