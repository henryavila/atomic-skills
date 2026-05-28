const DELIM = '---'

export interface FrontmatterSplit {
  frontmatter: string
  body: string
}

export function splitFrontmatter(raw: string): FrontmatterSplit | null {
  const isCrlfOpen = raw.startsWith(`${DELIM}\r\n`)
  const isLfOpen = raw.startsWith(`${DELIM}\n`)
  if (!isLfOpen && !isCrlfOpen) return null

  const eol = isCrlfOpen ? '\r\n' : '\n'
  const open = `${DELIM}${eol}`

  const afterOpen = raw.slice(open.length)

  // Empty frontmatter: opening delimiter immediately followed by closing delimiter.
  if (afterOpen.startsWith(DELIM)) {
    const afterClose = afterOpen.slice(DELIM.length)
    if (afterClose === '' || afterClose === eol || afterClose.startsWith(eol)) {
      const body = afterClose.startsWith(eol) ? afterClose.slice(eol.length) : ''
      return { frontmatter: '', body }
    }
  }

  const close = `${eol}${DELIM}${eol}`
  const closeIdx = afterOpen.indexOf(close)
  if (closeIdx === -1) {
    const trailingClose = `${eol}${DELIM}`
    if (afterOpen.endsWith(trailingClose)) {
      const frontmatter = afterOpen.slice(0, afterOpen.length - DELIM.length - eol.length) + eol
      return { frontmatter, body: '' }
    }
    return null
  }

  const frontmatter = afterOpen.slice(0, closeIdx + eol.length)
  const body = afterOpen.slice(closeIdx + close.length)
  return { frontmatter, body }
}
