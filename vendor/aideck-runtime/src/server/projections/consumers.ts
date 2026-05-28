import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicSkillsRoot } from '../writers/paths.js'

export interface ConsumerDescriptor {
  id: string
  title: string
  rootPath: string
  schemaVersion: '0.1'
  state: 'active' | 'empty' | 'error'
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

export async function listConsumers(rootDir: string): Promise<ConsumerDescriptor[]> {
  const root = atomicSkillsRoot(rootDir)
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const out: ConsumerDescriptor[] = []
  for (const id of entries.sort()) {
    if (id.startsWith('.')) continue
    const rootPath = join(root, id)
    let state: ConsumerDescriptor['state']
    try {
      const s = await stat(rootPath)
      if (!s.isDirectory()) continue
      const sub = await readdir(rootPath)
      const hasContent = sub.some((d) => d === 'plans' || d === 'initiatives')
      state = hasContent ? 'active' : 'empty'
    } catch {
      state = 'error'
    }
    out.push({
      id,
      title: capitalize(id.replace(/[-_]/g, ' ')),
      rootPath,
      schemaVersion: '0.1',
      state
    })
  }
  return out
}
