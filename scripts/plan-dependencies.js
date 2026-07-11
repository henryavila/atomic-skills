import { pathToFileURL } from 'node:url'
import {
  isDirectExecution,
  resolveConsumerPath,
  resolvePackagePath,
} from '../src/runtime-paths.js'

async function loadDependenciesModule() {
  return import(pathToFileURL(resolvePackagePath('src', 'links-sidecar.js')).href)
}

export async function runPlanDependencies(args, io = console) {
  const [command, planDirArg, prerequisiteSlug] = args
  if (command !== 'add') throw new Error('expected command add')
  if (!planDirArg) throw new Error('missing dependent plan directory')
  if (!prerequisiteSlug) throw new Error('missing prerequisite plan slug')

  const planDir = resolveConsumerPath(planDirArg)
  const dependency = {
    plan: prerequisiteSlug,
    createdBy: 'manual',
    release: { archived: 'blocked' },
  }
  const { addPlanDependency } = await loadDependenciesModule()
  addPlanDependency(planDir, dependency)
  io.log(JSON.stringify(dependency))
  return dependency
}

if (isDirectExecution(import.meta.url)) {
  runPlanDependencies(process.argv.slice(2)).catch((error) => {
    console.error(`plan-dependencies: ${error.message}`)
    process.exitCode = 1
  })
}
