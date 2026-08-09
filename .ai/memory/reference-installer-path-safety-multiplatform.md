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
exigir mutações no-follow via `/proc/self/fd` (só Linux). O fallback posterior
`path-nofollow` resolveu macOS, mas ainda exigia `fs.constants.O_NOFOLLOW`.
Node não expõe `O_NOFOLLOW` nem `O_DIRECTORY` no Windows; portanto o engine
continuava falhando closed na primeira escrita de manifest. O CI Windows só
rodava contratos `path.win32` e excluía deliberadamente o installer real.

## Fix (upstream + pin consumer)

- **path-nofollow**: walk com `O_NOFOLLOW` em cada componente quando não há
  mount fd-relative (`/proc/self/fd` ou `/dev/fd` com probe OK).
- Effects usam `entryPath()` — nunca hardcodar `/proc/self/fd` fora de
  `path-safety.js`.
- Consumer pin (git SHA, sem npm publish do engine nesta trilha): ver
  `package.json` → `@henryavila/minimalist-installer` e
  `docs/audits/minimalist-installer-upstream-receipt.json`.
- **Windows compatibility wrapper**: `src/minimalist-installer-platform.js`
  fornece flags de valor zero ausentes apenas no win32; `src/minimalist-installer.js`
  rejeita symlink/junction em todos os destinos planejados/journalizados antes
  de delegar ao backend path-based. Imports de produção nunca usam o pacote cru.
- CI `windows-path-contracts` roda o teste da plataforma e o round-trip real de
  install/uninstall em `windows-latest`.

Env de teste/CI: `MINIMALIST_INSTALLER_PATH_BACKEND=path` força o backend
portátil mesmo em Linux (simula macOS no CI Ubuntu).

## Enforcers

Ver `padroes-testing.md` § Multiplataforma: `tests/multiplatform-contract.test.js`,
job CI `multiplatform-path-nofollow`, suite upstream `test/multiplatform-backends.test.js`.
