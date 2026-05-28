import { existsSync } from 'node:fs'
import { atomicSkillsRoot } from '../writers/paths.js'
import { type SkillCard, STATIC_SKILL_CARDS } from './help-static.js'

export type { SkillCard }

export function projectHelp(rootDir: string): SkillCard[] {
  const root = atomicSkillsRoot(rootDir)
  return STATIC_SKILL_CARDS.map((card) => ({
    ...card,
    activeInRepo: existsSync(`${root}/${card.name}`)
  }))
}
