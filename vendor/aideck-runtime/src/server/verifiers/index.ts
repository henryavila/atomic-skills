import type { ErrorResponse } from '../../schemas/common.js'
import type { ExitCriterionVerifier } from '../../schemas/project-status.js'
import { type Result, err, ok } from '../../schemas/validators/index.js'
import { runShellVerifier } from './shell.js'

export interface VerifierOutcome {
  passed: boolean
  evidence?: string
  verifierOutput?: string
  durationMs?: number
}

export interface RunVerifierOptions {
  cwd?: string
  timeoutMs?: number
}

export async function runVerifier(
  verifier: ExitCriterionVerifier | undefined,
  opts: RunVerifierOptions = {}
): Promise<Result<VerifierOutcome, ErrorResponse>> {
  if (!verifier) {
    return err({
      code: 'precondition_failed',
      message: 'criterion has no verifier — supply explicit `result` to record a manual outcome'
    })
  }
  switch (verifier.kind) {
    case 'shell': {
      const r = await runShellVerifier({
        command: verifier.command,
        expectExitCode: verifier.expectExitCode,
        cwd: opts.cwd,
        timeoutMs: opts.timeoutMs
      })
      const evidence = (r.stdout || r.stderr).slice(0, 4096)
      return ok({
        passed: r.passed,
        evidence,
        verifierOutput: r.timedOut
          ? `[timeout after ${r.durationMs}ms]`
          : `exitCode=${r.exitCode}`,
        durationMs: r.durationMs
      })
    }
    case 'manual':
      return err({
        code: 'precondition_failed',
        message: 'manual verifier requires explicit `result` argument (met | deferred | pending)',
        suggestion: `verifier description: ${verifier.description}`
      })
    case 'query':
    case 'test':
      return err({
        code: 'precondition_failed',
        message: `verifier kind "${verifier.kind}" not yet implemented (v0.2)`,
        suggestion: 'Use a shell or manual verifier in v0.1'
      })
  }
}
