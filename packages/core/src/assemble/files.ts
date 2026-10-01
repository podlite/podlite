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

// a set of texts is a root of its own: a leading slash in a path does not change the place it names
const placeOf = (path: string): string => normalize(path).replace(/^\/+/, '')

const dirOf = (path: string): string => {
  const at = path.lastIndexOf('/')
  return at <= 0 ? (at === 0 ? '/' : '') : path.slice(0, at)
}

/*
=begin pod :kind<export>

=head2 sourcesFromFiles

Sources over texts given by path. A written path is resolved against the
directory of the text the directive is written in; the context of the document
itself is its directory, a string, empty for the root of the set. The set is a
root of its own: C<a.podlite> and C</a.podlite> name one place, and of two such
paths the later one holds. A mask of C<*> and C<?> names the files that match
it, in the order of their paths.

=end pod
*/
export const sourcesFromFiles = (files: Record<string, string>): Sources => {
  const texts = new Map(Object.keys(files).map((path): [string, string] => [placeOf(path), files[path]]))
  const sourceAt = (id: string, name: string) => ({ id, name, context: dirOf(id) })
  return {
    locate: (written, context, plain) => {
      const dir = String(context ?? '')
      if (plain || !isMask(written)) return { masked: false, sources: [sourceAt(join(dir, written), written)] }
      const base = placeOf(dir)
      const prefix = base === '' ? '' : `${base}/`
      const names = [...texts.keys()]
        .filter(id => id.startsWith(prefix))
        .map(id => id.slice(prefix.length))
        .filter(name => filePathMatches(name, written))
        .sort()
      return { masked: true, sources: names.map(name => sourceAt(join(dir, name), name)) }
    },
    read: source => texts.get(placeOf(source.id)) ?? null,
  }
}
