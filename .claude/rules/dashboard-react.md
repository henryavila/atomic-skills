---
globs: src/dashboard/**/*.tsx
---

Ao editar componentes React do dashboard:

1. **Hooks antes de early returns.** Todo `useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`, `useQuery` DEVE ser chamado ANTES de qualquer `return` condicional. React exige a mesma quantidade de hooks na mesma ordem em todo render. Violação causa crash silencioso em produção (error #310). Se precisar de um `useMemo` que depende de dados que podem ser null, use guard interno (`data ? compute(data) : fallback`) em vez de colocar o hook depois de `if (!data) return`.

2. **Defaults estáveis para deps de hooks.** Parâmetros com default `= []` ou `= {}` na destructuring de props criam nova referência a cada render. Se usados como dep de `useEffect`/`useMemo`/`useCallback`, causam loop infinito. Extraia para constante no nível do módulo (`const EMPTY: T[] = []`) e use como default.

Referência completa com exemplos: `docs/kb/code-quality-gates.md` seção G8.
