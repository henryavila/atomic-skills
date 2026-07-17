# Installer path-safety multiplataforma

## Sintoma (2026-07-16)

`node bin/cli.js install` / “Atualizar com configuração atual” no **macOS**
explodia com:

```text
PathSafetyError: No-follow mutations require /proc/self/fd (Linux).
Refusing permissive fallback.
code: 'UNSUPPORTED_PLATFORM'
```

Stack típica: `atomicWriteJsonNoFollow` → `writeManifest` → `Driver.install`.
Checkout macOS costuma aparecer como `/Volumes/External/...` no stack.

## Root cause

O engine `@henryavila/minimalist-installer` (integrity remediation) passou a
exigir mutações no-follow via `/proc/self/fd` (só Linux). Sem fallback, macOS
e Windows falhavam closed na primeira escrita de manifest.

## Fix (upstream + pin consumer)

- **path-nofollow**: walk com `O_NOFOLLOW` em cada componente quando não há
  mount fd-relative (`/proc/self/fd` ou `/dev/fd` com probe OK).
- Effects usam `entryPath()` — nunca hardcodar `/proc/self/fd` fora de
  `path-safety.js`.
- Consumer pin (git SHA, sem npm publish do engine nesta trilha): ver
  `package.json` → `@henryavila/minimalist-installer` e
  `docs/audits/minimalist-installer-upstream-receipt.json`.

Env de teste/CI: `MINIMALIST_INSTALLER_PATH_BACKEND=path` força o backend
portátil mesmo em Linux (simula macOS no CI Ubuntu).

## Enforcers

Ver `padroes-testing.md` § Multiplataforma: `tests/multiplatform-contract.test.js`,
job CI `multiplatform-path-nofollow`, suite upstream `test/multiplatform-backends.test.js`.
