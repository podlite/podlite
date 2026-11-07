import * as fs from 'fs'
import { globSync } from 'glob'

// a broken link or a missing part of the path is not a file; any other failure is the caller's to see
const NOT_THERE = ['ENOENT', 'ELOOP', 'ENOTDIR']
const isFile = (name: string): boolean => {
  try {
    return fs.statSync(name).isFile()
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && NOT_THERE.includes(String(error.code)))
      return false
    throw error
  }
}

// a written path of a file is taken as written; a pattern gives files, case kept, ./ and order as glob 7 gave them
export const filesOf = (pattern: string): string[] => {
  if (!pattern) throw new TypeError('a path or a pattern of files is needed')
  return isFile(pattern)
    ? [pattern]
    : globSync(pattern, { nocase: false, dotRelative: pattern.startsWith('./') })
        .filter(isFile)
        .sort((a, b) => a.localeCompare(b, 'en'))
}
