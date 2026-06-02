import { appendIntent, findInitiative, findPlan } from './_lib.js'

// Record an intent to set the result of an exit-gate criterion (met | deferred)
// on a plan phase or an initiative. Computes an `allGatesMet` hint from the
// current data + this result. Ported from aideck src/mcp/tools/gates.ts (the
// shell-verifier run itself is performed by the skill's verifier workflow; this
// handler records the accepted/manual result as an intent).
//
// Gate status is pending/met/deferred ONLY (never 'failed'). A failed
// verification leaves the criterion pending — it is recorded via the criterion's
// `evidence` block by the skill workflow, not as a status here.
export default async function handler({ args, data, files }) {
  const { criterionId, result, deferredReason, evidence, by = 'ai' } = args
  const planSlug = args.planSlug
  const phaseId = args.phaseId
  const initiativeSlug = args.initiativeSlug

  // Locate the criterion + collect the initiative's gate set for the hint.
  let gates
  if (initiativeSlug) {
    const initiative = findInitiative(data, initiativeSlug)
    if (!initiative) throw new Error(`initiative not found: ${initiativeSlug}`)
    gates = initiative.exitGates ?? []
  } else if (planSlug && phaseId) {
    const plan = findPlan(data, planSlug)
    if (!plan) throw new Error(`plan not found: ${planSlug}`)
    const phase = (plan.phases ?? []).find((p) => p.id === phaseId)
    if (!phase) throw new Error(`phase ${phaseId} not found in plan ${planSlug}`)
    gates = phase.exitGate?.criteria ?? []
  } else {
    throw new Error('provide either initiativeSlug, or planSlug + phaseId')
  }

  const criterion = gates.find((c) => c.id === criterionId)
  if (!criterion) throw new Error(`criterion ${criterionId} not found`)

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'verify_exit_gate',
    target: { initiativeSlug, planSlug, phaseId, criterionId },
    args: {
      result,
      ...(deferredReason ? { deferredReason } : {}),
      ...(evidence ? { evidence } : {}),
    },
    by,
  })

  // Hint: would all gates be met if this criterion becomes met?
  const others = gates.filter((c) => c.id !== criterionId)
  const allGatesMet = result === 'met' && others.every((c) => c.status === 'met')
  return { accepted: true, intentId, recordedAt, allGatesMet, note: 'Intent recorded; consumer skill applies.' }
}
