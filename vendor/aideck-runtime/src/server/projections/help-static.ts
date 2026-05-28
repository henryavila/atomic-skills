export interface SkillCard {
  name: string
  title: string
  purpose: string
  whenToUse: string[]
  whenNotToUse: string[]
  examples: string[]
  related: string[]
  activeInRepo: boolean
}

/**
 * Static fallback used when no atomic-skills directory is linked.
 * Updated manually; see docs/help-source.md (TBD) for the rationale.
 */
export const STATIC_SKILL_CARDS: ReadonlyArray<Omit<SkillCard, 'activeInRepo'>> = [
  {
    name: 'project-status',
    title: 'Project status',
    purpose: 'Track plan + initiative state and the stack of frames in flight.',
    whenToUse: [
      'Starting or resuming work on an initiative',
      'Pushing/popping a research/discussion frame',
      'Marking a task done or parked'
    ],
    whenNotToUse: ['Quick one-off scripts with no follow-up'],
    examples: ['/project-status push F4 schema migration'],
    related: ['parallel-dispatch', 'fix']
  },
  {
    name: 'fix',
    title: 'Root-cause + TDD fix',
    purpose: 'Diagnose then write a failing test before applying a fix.',
    whenToUse: ['Bug found in code', 'Unexpected behavior'],
    whenNotToUse: ['Pure refactors with no observable bug'],
    examples: ['/fix Login fails when user has uppercase email'],
    related: ['hunt']
  },
  {
    name: 'parallel-dispatch',
    title: 'Parallel dispatch',
    purpose: 'Fan out N independent tasks with verified scope isolation.',
    whenToUse: ['User brings a list of independent tasks'],
    whenNotToUse: ['Single linear task'],
    examples: ['/parallel-dispatch from todo.md'],
    related: ['parallel-dispatch-audit']
  }
]
