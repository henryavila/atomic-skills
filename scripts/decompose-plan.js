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

async function loadDecomposeModule() {
  return import(pathToFileURL(resolvePackagePath('src', 'decompose.js')).href)
}

export async function runDecomposePlan(args, io = console) {
  const [command, ...options] = args
  if (command !== 'preview' && command !== 'materialize') {
    throw new Error('expected command preview or materialize')
  }

  const sourcePath = resolveConsumerPath(option(options, '--source', { required: true }))
  const planSlug = option(options, '--slug', { required: true })
  const markdown = readFileSync(sourcePath, 'utf8')
  const {
    decomposePlan,
    materializeDecomposition,
    previewDecomposition,
  } = await loadDecomposeModule()
  const result = decomposePlan(markdown, { planSlug })

  if (command === 'preview') {
    io.log(previewDecomposition(result))
    io.log('---JSON---')
    io.log(JSON.stringify(result, null, 2))
    return result
  }

  const projectId = option(options, '--project-id', { required: true })
  const branchValue = option(options, '--branch')
  const startedCommit = option(options, '--started-commit')
  const businessIntentRaw = option(options, '--business-intent', { required: true })
  let businessIntent
  try {
    businessIntent = JSON.parse(businessIntentRaw)
  } catch (error) {
    throw new Error(`--business-intent must contain valid JSON: ${error.message}`)
  }
  const branch = branchValue === 'null' ? null : branchValue
  const files = materializeDecomposition(result, {
    planSlug,
    projectId,
    branch,
    startedCommit,
    businessIntent,
  })
  io.log(JSON.stringify(files, null, 2))
  return files
}

if (isDirectExecution(import.meta.url)) {
  runDecomposePlan(process.argv.slice(2)).catch((error) => {
    console.error(`decompose-plan: ${error.message}`)
    process.exitCode = 1
  })
}
