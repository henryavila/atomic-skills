import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import type {
  CriterionRef,
  ErrorResponse,
  VerifierResult as VerifierResultRecord
} from '../../schemas/common.js'
import { type Result, err, ok } from '../../schemas/validators/index.js'
import type {
  ExitCriterion,
  ExitCriterionVerifier
} from '../../schemas/project-status.js'
import { parseInitiativeFile, parsePlanFile } from '../../server/parsers/project-status.js'
import { runVerifier } from '../../server/verifiers/index.js'
import { appendJsonlLine } from '../../server/writers/jsonl-append.js'
import { consumerRoot, inboxPathFor } from '../../server/writers/paths.js'
import type { RegisteredTool } from '../types.js'

function defineTool<TIn, TOut>(t: RegisteredTool<TIn, TOut>): RegisteredTool {
  return t as unknown as RegisteredTool
}

const verifyInput = z
  .object({
    consumer: z.string(),
    target: z.enum(['phase', 'initiative', 'task']),
    planSlug: z.string().optional(),
    phaseId: z.string().optional(),
    initiativeSlug: z.string().optional(),
    taskId: z.string().optional(),
    criterionId: z.string(),
    result: z.enum(['met', 'pending', 'deferred']).optional(),
    deferredReason: z.string().optional(),
    evidence: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    by: z.enum(['human', 'ai']).default('ai')
  })
  .strict()

interface VerifyOutput {
  result: 'met' | 'pending' | 'deferred'
  verifierRan: boolean
  verifierOutput?: string
  evidence?: string
  allGatesMet: boolean
  verifierResultId: string
}

type VerifyInputResolved = z.input<typeof verifyInput> & { by: 'human' | 'ai' }

async function findCriterion(
  rootDir: string,
  input: VerifyInputResolved
): Promise<Result<{ criterion: ExitCriterion; verifier?: ExitCriterionVerifier; siblings: ExitCriterion[]; criterionRef: CriterionRef }, ErrorResponse>> {
  if (input.target === 'phase') {
    if (!input.planSlug || !input.phaseId) {
      return err({ code: 'invalid_input', message: 'phase target requires planSlug + phaseId' })
    }
    const path = join(consumerRoot(rootDir, input.consumer), 'plans', `${input.planSlug}.md`)
    const r = await parsePlanFile(path)
    if (!r.ok) return r
    const phase = r.value.phases.find((p) => p.id === input.phaseId)
    if (!phase) {
      return err({ code: 'path_not_found', message: `phase ${input.phaseId} not found` })
    }
    const criterion = phase.exitGate.criteria.find((c) => c.id === input.criterionId)
    if (!criterion) {
      return err({ code: 'path_not_found', message: `criterion ${input.criterionId} not found in phase ${phase.id}` })
    }
    return ok({
      criterion,
      verifier: criterion.verifier,
      siblings: phase.exitGate.criteria,
      criterionRef: {
        target: 'phase',
        planSlug: input.planSlug,
        phaseId: input.phaseId,
        criterionId: input.criterionId
      }
    })
  }
  if (!input.initiativeSlug) {
    return err({ code: 'invalid_input', message: 'initiative/task target requires initiativeSlug' })
  }
  const path = join(consumerRoot(rootDir, input.consumer), 'initiatives', `${input.initiativeSlug}.md`)
  const r = await parseInitiativeFile(path)
  if (!r.ok) return r
  if (input.target === 'initiative') {
    const criterion = r.value.exitGates.find((c) => c.id === input.criterionId)
    if (!criterion) {
      return err({ code: 'path_not_found', message: `criterion ${input.criterionId} not found in initiative ${input.initiativeSlug}` })
    }
    return ok({
      criterion,
      verifier: criterion.verifier,
      siblings: r.value.exitGates,
      criterionRef: {
        target: 'initiative',
        initiativeSlug: input.initiativeSlug,
        criterionId: input.criterionId
      }
    })
  }
  // task
  if (!input.taskId) {
    return err({ code: 'invalid_input', message: 'task target requires taskId' })
  }
  const task = r.value.tasks.find((t) => t.id === input.taskId)
  if (!task) {
    return err({ code: 'path_not_found', message: `task ${input.taskId} not found` })
  }
  if (input.criterionId !== 'task') {
    return err({
      code: 'invalid_input',
      message: 'task verifier must be invoked with criterionId="task"',
      suggestion: 'tasks have a single verifier; pass criterionId="task"'
    })
  }
  return ok({
    criterion: { id: 'task', description: task.title, status: task.status === 'done' ? 'met' : 'pending' },
    verifier: task.verifier,
    siblings: [],
    criterionRef: {
      target: 'task',
      initiativeSlug: input.initiativeSlug,
      taskId: input.taskId,
      criterionId: input.criterionId
    }
  })
}

function nextVerifierResultId(): string {
  return `vr-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
}

/**
 * Reads all `verifier_result` records from this consumer's inbox JSONL files
 * and returns the latest `result` per criterionId. Used to compute allGatesMet
 * from canonical + append-only history, not just canonical.
 */
async function readPriorVerifierResults(
  rootDir: string,
  consumer: string
): Promise<Map<string, 'met' | 'pending' | 'deferred'>> {
  const { readdir } = await import('node:fs/promises')
  const dir = join(consumerRoot(rootDir, consumer), 'inbox')
  const latest = new Map<string, { result: 'met' | 'pending' | 'deferred'; ranAt: string }>()
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f))
  } catch {
    return new Map()
  }
  for (const file of files) {
    let raw: string
    try {
      raw = await readFile(file, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue
      try {
        const parsed = JSON.parse(line) as Partial<VerifierResultRecord>
        if (parsed.kind !== 'verifier_result' || !parsed.criterionRef || !parsed.result || !parsed.ranAt) continue
        const key = parsed.criterionRef.criterionId
        const existing = latest.get(key)
        if (!existing || parsed.ranAt > existing.ranAt) {
          latest.set(key, { result: parsed.result, ranAt: parsed.ranAt })
        }
      } catch {
        // skip malformed
      }
    }
  }
  const out = new Map<string, 'met' | 'pending' | 'deferred'>()
  for (const [k, v] of latest) out.set(k, v.result)
  return out
}

export const gateTools: ReadonlyArray<RegisteredTool> = [
  defineTool({
    name: 'aideck_verify_exit_gate',
    description: 'Run (or accept manual) verifier for an exit-gate criterion and append a VerifierResult to inbox/. Never edits entity files.',
    inputSchema: verifyInput,
    async handler(rawInput, ctx): Promise<Result<VerifyOutput, ErrorResponse>> {
      const input: VerifyInputResolved = { ...rawInput, by: rawInput.by ?? 'ai' }
      const located = await findCriterion(ctx.rootDir, input)
      if (!located.ok) return located

      let result: 'met' | 'pending' | 'deferred'
      let verifierRan = false
      let evidence: string | undefined = input.evidence
      let verifierOutput: string | undefined

      if (input.result !== undefined) {
        result = input.result
      } else if (located.value.verifier?.kind === 'shell') {
        const outcome = await runVerifier(located.value.verifier, {
          cwd: ctx.rootDir,
          timeoutMs: input.timeoutMs
        })
        if (!outcome.ok) return outcome
        verifierRan = true
        result = outcome.value.passed ? 'met' : 'pending'
        evidence = outcome.value.evidence ?? evidence
        verifierOutput = outcome.value.verifierOutput
      } else if (located.value.verifier?.kind === 'manual') {
        return err({
          code: 'precondition_failed',
          message: 'manual verifier requires explicit `result` argument',
          suggestion: `verifier description: ${located.value.verifier.description}`
        })
      } else if (located.value.verifier?.kind === 'query' || located.value.verifier?.kind === 'test') {
        return err({
          code: 'precondition_failed',
          message: `verifier kind "${located.value.verifier.kind}" not yet implemented (v0.2)`,
          suggestion: 'Use shell/manual verifier or pass explicit `result`'
        })
      } else {
        return err({
          code: 'precondition_failed',
          message: 'criterion has no verifier — supply explicit `result` to record an outcome'
        })
      }

      if (result === 'deferred' && !input.deferredReason) {
        return err({
          code: 'invalid_input',
          message: 'result="deferred" requires deferredReason'
        })
      }

      const inboxPath = inboxPathFor(consumerRoot(ctx.rootDir, input.consumer))
      const verifierResultId = nextVerifierResultId()
      const record: VerifierResultRecord = {
        schemaVersion: '0.1',
        kind: 'verifier_result',
        verifierResultId,
        criterionRef: located.value.criterionRef,
        result,
        ...(evidence ? { evidence } : {}),
        ...(input.deferredReason ? { deferredReason: input.deferredReason } : {}),
        ...(verifierOutput ? { verifierOutput } : {}),
        ranAt: new Date().toISOString(),
        by: input.by ?? 'ai'
      }
      await appendJsonlLine(inboxPath, record)

      // allGatesMet: combine canonical sibling status with prior inbox verifier_result records.
      const priorResults = await readPriorVerifierResults(ctx.rootDir, input.consumer)
      priorResults.set(input.criterionId, result)
      const allGatesMet = located.value.siblings.length > 0
        ? located.value.siblings.every((c) => {
            const fromInbox = priorResults.get(c.id)
            if (fromInbox !== undefined) return fromInbox === 'met'
            return c.status === 'met'
          })
        : result === 'met'

      return ok({
        result,
        verifierRan,
        ...(verifierOutput ? { verifierOutput } : {}),
        ...(evidence ? { evidence } : {}),
        allGatesMet,
        verifierResultId
      })
    }
  })
]
