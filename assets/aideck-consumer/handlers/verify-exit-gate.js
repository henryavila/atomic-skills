import { appendIntent, findInitiative, findPlan, gatesFor, phaseGatesFor } from './_lib.js'

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
  // `projectId` (the resolved entity's) is carried into the intent target so the
  // consumer applies it to the right `projects/<projectId>/…` subtree.
  let gates
  let projectId
  if (initiativeSlug) {
    const initiative = findInitiative(data, initiativeSlug, args.projectId)
    gates = gatesFor(data, initiative)
    projectId = initiative.projectId
  } else if (planSlug && phaseId) {
    const plan = findPlan(data, planSlug, args.projectId)
    gates = phaseGatesFor(data, plan, phaseId)
    if (gates.length === 0) throw new Error(`phase ${phaseId} not found in plan ${planSlug}`)
    projectId = plan.projectId
  } else {
    throw new Error('provide either initiativeSlug, or planSlug + phaseId')
  }

  const criterion = gates.find((c) => c.id === criterionId)
  if (!criterion) throw new Error(`criterion ${criterionId} not found`)

  const { intentId, recordedAt } = await appendIntent(files, {
    operation: 'verify_exit_gate',
    target: { projectId, initiativeSlug, planSlug, phaseId, criterionId },
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
