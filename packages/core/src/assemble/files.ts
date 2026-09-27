/*
=begin pod :kind<module>

=head2 files

Sources kept in memory: a set of texts by path, for tests and for a host that
holds its files itself.

=end pod
*/
import { filePathMatches } from '@podlite/schema'
import type { Sources } from './index'

const isMask = (path: string): boolean => /[*?]/.test(path)

// a path with its . and .. steps taken, as a file system would take them
const normalize = (path: string): string => {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return (path.startsWith('/') ? '/' : '') + out.join('/')
}

const join = (dir: string, path: string): string => normalize(path.startsWith('/') ? path : `${dir}/${path}`)

const dirOf = (path: string): string => {
  const at = path.lastIndexOf('/')
  return at <= 0 ? (at === 0 ? '/' : '') : path.slice(0, at)
}

/*
=begin pod :kind<export>

=head2 sourcesFromFiles

Sources over texts given by path. A written path is resolved against the
directory of the text the directive is written in; the context of the document
itself is its directory, a string. A mask of C<*> and C<?> names the files that
match it, in the order of their paths.

=end pod
*/
export const sourcesFromFiles = (files: Record<string, string>): Sources => {
  const texts = new Map(Object.keys(files).map((path): [string, string] => [normalize(path), files[path]]))
  const sourceAt = (id: string, name: string) => ({ id, name, context: dirOf(id) })
  return {
    locate: (written, context) => {
      const dir = String(context ?? '')
      if (!isMask(written)) return { masked: false, sources: [sourceAt(join(dir, written), written)] }
      const prefix = dir === '' || dir.endsWith('/') ? dir : `${dir}/`
      const names = [...texts.keys()]
        .filter(id => id.startsWith(prefix))
        .map(id => id.slice(prefix.length))
        .filter(name => filePathMatches(name, written))
        .sort()
      return { masked: true, sources: names.map(name => sourceAt(join(dir, name), name)) }
    },
    read: source => texts.get(source.id) ?? null,
  }
}
