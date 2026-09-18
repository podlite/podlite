import * as path from 'path'
import type { SourceProvider } from '../resolve-includes'
import type { ResourceDecl } from './types'

// A directory no disk holds: a fixture reads its relative paths from here, and
// nothing outside the names a test declares is there to read.
export const RESOURCE_ROOT = path.resolve(path.sep, 'podlite-test-resources')

// The form a resource is looked up by; undefined for a name that would leave
// the directory of the test.
export const resourceKey = (name: string): string | undefined => {
  const slashed = name.replace(/\\/g, '/')
  if (slashed.startsWith('/') || /^[a-zA-Z]:/.test(slashed)) return undefined
  const key = path.posix.normalize(slashed)
  return key === '.' || key.startsWith('../') || key === '..' ? undefined : key
}

const keyOfPath = (file: string): string | undefined => {
  const rel = path.relative(RESOURCE_ROOT, file)
  if (!rel || path.isAbsolute(rel)) return undefined
  return resourceKey(rel.split(path.sep).join('/'))
}

export const resourceProvider = (resources: ResourceDecl[]): SourceProvider => {
  const files = new Map<string, string>()
  for (const r of resources) {
    const key = resourceKey(r.name)
    if (key !== undefined && !files.has(key)) files.set(key, r.body)
  }
  return {
    read: file => {
      const key = keyOfPath(file)
      return key === undefined ? null : files.get(key) ?? null
    },
    list: (dir, deep) => {
      const rel = path.relative(RESOURCE_ROOT, dir).split(path.sep).join('/')
      if (rel.startsWith('..') || path.isAbsolute(rel)) return []
      const prefix = rel ? `${rel}/` : ''
      return [...files.keys()]
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length))
        .filter(name => deep || !name.includes('/'))
        .sort()
    },
  }
}
