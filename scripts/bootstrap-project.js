import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  isDirectExecution,
  resolveConsumerPath,
  resolvePackagePath,
} from '../src/runtime-paths.js'

function option(args, name, { required = false } = {}) {
  const index = args.indexOf(name)
  if (index === -1) {
    if (required) throw new Error(`missing required option ${name}`)
    return null
  }
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`option ${name} requires a value`)
  return value
}

async function loadBootstrapModule() {
  return import(pathToFileURL(resolvePackagePath('src', 'bootstrap.js')).href)
}

export async function runBootstrapProject(args, io = console) {
  const [command, ...options] = args
  if (command !== 'cluster') throw new Error('expected command cluster')

  const signalsPath = resolveConsumerPath(option(options, '--signals', { required: true }))
  let signals
  try {
    signals = JSON.parse(readFileSync(signalsPath, 'utf8'))
  } catch (error) {
    throw new Error(`--signals must point to valid JSON: ${error.message}`)
  }
  if (!Array.isArray(signals)) throw new Error('--signals JSON must be an array')

  const {
    clusterByExactSlug,
    mergeFuzzySingletons,
    pickCanonicalSlug,
  } = await loadBootstrapModule()
  const { clusters, unmatched } = clusterByExactSlug(signals)
  const merged = mergeFuzzySingletons(clusters, unmatched)
  const output = {
    clusters: merged.clusters.map((cluster) => ({
      ...cluster,
      canonical: pickCanonicalSlug(cluster),
    })),
    remainingOrphans: merged.remainingOrphans,
  }
  io.log(JSON.stringify(output, null, 2))
  return output
}

if (isDirectExecution(import.meta.url)) {
  runBootstrapProject(process.argv.slice(2)).catch((error) => {
    console.error(`bootstrap-project: ${error.message}`)
    process.exitCode = 1
  })
}
