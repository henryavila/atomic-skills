import { access, cp, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface DemoEnv {
  rootDir: string
  fixturesDir: string
  cleanup(): Promise<void>
}

export class FixturesNotFoundError extends Error {
  constructor(public readonly tried: ReadonlyArray<string>) {
    super(`aideck demo: no fixtures directory found. Tried: ${tried.join(', ')}. Set AIDECK_FIXTURES to override.`)
    this.name = 'FixturesNotFoundError'
  }
}

async function dirExistsWith(path: string, requiredSubdir: string): Promise<boolean> {
  try {
    await access(join(path, requiredSubdir))
    return true
  } catch {
    return false
  }
}

async function resolveFixturesSource(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates: string[] = [
    join(here, '..', '..', 'fixtures'),
    join(here, '..', 'demo', 'fixtures'),
    join(here, 'fixtures'),
    join(process.cwd(), 'fixtures')
  ]
  if (process.env.AIDECK_FIXTURES) candidates.unshift(process.env.AIDECK_FIXTURES)

  // Pick the first candidate that actually contains the expected fixture layout
  // (a `plans` subdirectory). Fail loudly if none does.
  for (const c of candidates) {
    if (await dirExistsWith(c, 'plans')) return c
  }
  throw new FixturesNotFoundError(candidates)
}

async function copyJsonl(src: string, dst: string): Promise<void> {
  try {
    const files = await readdir(src)
    await mkdir(dst, { recursive: true })
    for (const f of files) {
      if (f.endsWith('.jsonl')) {
        await cp(join(src, f), join(dst, f))
      }
    }
  } catch {
    // missing → skip
  }
}

async function copyMarkdownStripDemo(src: string, dst: string): Promise<void> {
  try {
    const files = await readdir(src)
    await mkdir(dst, { recursive: true })
    for (const f of files) {
      if (!f.endsWith('.md')) continue
      const targetName = f.replace(/\.demo\.md$/, '.md')
      await cp(join(src, f), join(dst, targetName))
    }
  } catch {
    // missing → skip
  }
}

export async function seedDemo(): Promise<DemoEnv> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aideck-demo-'))
  const consumerDir = join(rootDir, '.atomic-skills', 'project-status')
  await mkdir(join(consumerDir, 'plans'), { recursive: true })
  await mkdir(join(consumerDir, 'initiatives'), { recursive: true })
  await mkdir(join(consumerDir, 'annotations'), { recursive: true })
  await mkdir(join(consumerDir, 'highlights'), { recursive: true })
  await mkdir(join(consumerDir, 'inbox'), { recursive: true })

  const fixturesDir = await resolveFixturesSource()
  await copyMarkdownStripDemo(join(fixturesDir, 'plans'), join(consumerDir, 'plans'))
  await copyMarkdownStripDemo(join(fixturesDir, 'initiatives'), join(consumerDir, 'initiatives'))
  await copyJsonl(join(fixturesDir, 'annotations'), join(consumerDir, 'annotations'))
  await copyJsonl(join(fixturesDir, 'highlights'), join(consumerDir, 'highlights'))

  // Demo flag file the /api/health endpoint inspects.
  await writeFile(join(rootDir, '.aideck-demo'), 'demo\n')

  return {
    rootDir,
    fixturesDir,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true })
    }
  }
}

// rename re-export reserved for future use.
void rename
