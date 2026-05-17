# Test Plan — intentional gaps

This plan is a fixture for Phase 3/4 integration tests. It contains
known defects that an adversarial reviewer SHOULD detect.

## Task A
Create file `src/foo.ts` exporting function `bar(x: number): string`.

## Task B
Import `bar` from `src/buzz.ts` and use it in `src/qux.ts`.

(Gap: `bar` is defined in `src/foo.ts`, Task B imports from `src/buzz.ts` — broken dependency.)

## Task C
Refactor `bar` to return `Promise<string>`.

(Gap: Task C contradicts Task A signature; consumers from Task B will break.)

## Task D
Add tests.

(Gap: Ambiguous — what tests, for what?)
