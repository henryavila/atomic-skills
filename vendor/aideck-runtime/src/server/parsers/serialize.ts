import { stringify } from 'yaml'

export function serializeFrontmatter(frontmatter: unknown, body: string): string {
  const yaml = stringify(frontmatter, { indent: 2, lineWidth: 0 })
  const trimmedYaml = yaml.endsWith('\n') ? yaml : `${yaml}\n`
  return `---\n${trimmedYaml}---\n${body}`
}
