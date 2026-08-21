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
exigir mutações no-follow via `/proc/self/fd` (só Linux). O fallback
`path-nofollow` resolveu macOS, mas ainda exigia `fs.constants.O_NOFOLLOW`.
Node não exporta `O_NOFOLLOW` nem `O_DIRECTORY` no Windows. Polyfill dessas
flags com valor `0` faz todo `open` seguir junction — não é path-nofollow.

## Fix (upstream + pin consumer)

- **path-nofollow**: walk com `O_NOFOLLOW` em cada componente quando não há
  mount fd-relative (`/proc/self/fd` ou `/dev/fd` com probe OK).
- **windows-noreparse**: no win32 sem flag de kernel, `lstat` recusa
  `isSymbolicLink()` em cada open (dentro do lock), depois abre com flags
  que existem. Nunca `O_NOFOLLOW=0`.
- Effects usam `entryPath()` / `openDirNoFollow` — nunca hardcodar
  `/proc/self/fd` fora de `path-safety.js`.
- Consumer pin (git SHA, sem npm publish do engine nesta trilha): ver
  `package.json` → `@henryavila/minimalist-installer` e
  `docs/audits/minimalist-installer-upstream-receipt.json`.
- Testes de user-scope isolam `USERPROFILE` + `HOME` (`tests/helpers/isolate-homedir.js`).
- CI `windows-path-contracts` roda junction real + install/uninstall round-trip.

Env de teste/CI: `MINIMALIST_INSTALLER_PATH_BACKEND=path` força o backend
portátil (path-nofollow no Unix, windows-noreparse no win32).

## Windows stale node_modules (2026-08-14)

Sintoma idêntico a UNSUPPORTED_PLATFORM no Grok/Windows mesmo com pin
`12c7884…` (SHA que **já** tem `windows-noreparse` no GitHub). Causa: cópia
local de `node_modules/@henryavila/minimalist-installer` desatualizada
(~598 linhas sem o backend; GitHub ~1255). npm `--force` sozinho pode
reportar "up to date" porque o lock aponta o SHA certo.

**Recovery:** apagar o pacote e reinstalar:

```text
rm -rf node_modules/@henryavila/minimalist-installer
npm install @henryavila/minimalist-installer@github:henryavila/minimalist-installer#<pin>
```

Verificar: `getPathSafetyBackend()` → `{ kind: 'windows-noreparse' }` no win32.
Node 22.x no Windows **não** exporta `fs.constants.O_NOFOLLOW` nem
`O_DIRECTORY` — isso é esperado; o backend lstat cobre o caso.

## Enforcers

Ver `padroes-testing.md` § Multiplataforma: `tests/multiplatform-contract.test.js`,
job CI `multiplatform-path-nofollow`, suite upstream `test/multiplatform-backends.test.js`.
