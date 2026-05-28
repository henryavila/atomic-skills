import { readEnvFile } from '../server/env-file.js'

export async function runEnvCmd(stdout: NodeJS.WritableStream = process.stdout): Promise<number> {
  const content = await readEnvFile()
  if (content) {
    stdout.write(content)
  }
  return 0
}
