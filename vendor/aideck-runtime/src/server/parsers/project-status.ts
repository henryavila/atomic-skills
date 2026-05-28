import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import type { ErrorResponse } from '../../schemas/common.js'
import type { Initiative, Plan } from '../../schemas/project-status.js'
import {
  type Result,
  err,
  parseInitiative,
  parsePlan
} from '../../schemas/validators/index.js'
import { splitFrontmatter } from './frontmatter.js'

interface ParsedFrontmatter {
  frontmatter: unknown
  body: string
}

async function readAndSplit(path: string): Promise<Result<ParsedFrontmatter, ErrorResponse>> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (cause) {
    return err({
      code: 'io_error',
      message: `failed to read file: ${path}`,
      details: { cause: String(cause) }
    })
  }

  const split = splitFrontmatter(raw)
  if (!split) {
    return err({
      code: 'invalid_input',
      message: `No frontmatter in file: ${path}`,
      suggestion: 'Add YAML frontmatter delimited by --- at top of file'
    })
  }

  let frontmatter: unknown
  try {
    frontmatter = parseYaml(split.frontmatter)
  } catch (cause) {
    return err({
      code: 'invalid_input',
      message: `YAML syntax error in ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      suggestion: 'Fix YAML syntax in frontmatter block'
    })
  }

  return { ok: true, value: { frontmatter, body: split.body } }
}

export async function parsePlanFile(path: string): Promise<Result<Plan, ErrorResponse>> {
  const split = await readAndSplit(path)
  if (!split.ok) return split

  const fm = split.value.frontmatter
  if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
    return err({
      code: 'invalid_input',
      message: `Plan frontmatter must be a YAML object in ${path}`,
      suggestion: 'Top-level frontmatter must be a mapping (key: value), not a scalar or list'
    })
  }

  const combined = { ...(fm as Record<string, unknown>), narrative: split.value.body }
  return parsePlan(combined, { entity: 'plan', slug: pickString(combined, 'slug') })
}

export async function parseInitiativeFile(path: string): Promise<Result<Initiative, ErrorResponse>> {
  const split = await readAndSplit(path)
  if (!split.ok) return split

  const fm = split.value.frontmatter
  if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
    return err({
      code: 'invalid_input',
      message: `Initiative frontmatter must be a YAML object in ${path}`,
      suggestion: 'Top-level frontmatter must be a mapping (key: value), not a scalar or list'
    })
  }

  const combined = { ...(fm as Record<string, unknown>), body: split.value.body }
  return parseInitiative(combined, { entity: 'initiative', slug: pickString(combined, 'slug') })
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}
