import { existsSync } from 'fs'
import { dirname, isAbsolute, resolve } from 'path'
import { PodliteDocument } from '@podlite/schema'
import { STDIN_NAME } from '../types'
import type { Rule, Violation, LintContext } from '../types'
import { collectLinks, readAddress } from './link-targets'

export const LINK_FILE_RESOLVES_RULE_ID = 'link-file-resolves'

// Written with `./` or `../`, the author has declared a path as plainly as a
// scheme would. A bare word declares nothing. A leading slash reads as the root
// of a site far more often than the root of a disk, so it is left to the author
// to say `file:` when a disk is what was meant.
const looksLikePath = (path: string): boolean => path.startsWith('./') || path.startsWith('../')

// A home-relative path answers differently on every machine, so a check of it
// would make the run depend on who is running it.
const isHomeRelative = (path: string): boolean => path === '~' || path.startsWith('~/')

const candidatePath = (target: string, fileType: LintContext['fileType']): string | null => {
  if (!target || target.startsWith('#')) return null
  const { scheme, path } = readAddress(target)
  if (scheme !== null && scheme !== 'file') return null
  if (!path || isHomeRelative(path)) return null
  if (scheme === 'file') return path
  if (path.startsWith('/')) return null
  return fileType === 'md' || looksLikePath(path) ? path : null
}

export const linkFileResolvesRule: Rule = {
  id: LINK_FILE_RESOLVES_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    if (ctx.filePath === STDIN_NAME) return []
    const base = dirname(resolve(ctx.filePath))
    return collectLinks(ast)
      .map(site => ({ site, path: candidatePath(site.target, ctx.fileType) }))
      .filter(({ path }) => path !== null && !existsSync(isAbsolute(path) ? path : resolve(base, path)))
      .map(({ site }) => ({
        rule: LINK_FILE_RESOLVES_RULE_ID,
        severity: 'warning' as const,
        message: `Link target ${site.target} points at a file that is not there`,
        location: site.at,
      }))
  },
}
