/*
=begin pod :kind<module>

=head2 async

Assembly over sources that answer later: a host that reads files through a
promise gives its answers to a store, and the assembly runs over the store until
nothing is left to ask.

=end pod
*/
import { assembleIncludes, silently } from './index'
import type { AssembleOptions, IncludeOrigin, IncludeStep, Located, Source, Sources } from './index'

export type AsyncSources = {
  locate: (path: string, context: unknown, plain?: boolean, at?: IncludeStep) => Located | Promise<Located>
  read: (source: Source) => string | null | Promise<string | null>
}

type Wanted =
  | { kind: 'locate'; path: string; context: unknown; plain: boolean; at?: IncludeStep }
  | { kind: 'read'; source: Source }

/*
=begin pod :kind<export>

=head2 SourceStore

The answers a host has given so far. C<sources> reads from them and notes what
it was asked and could not answer; C<wanted> gives those questions and forgets
them. An answer is kept until it is dropped, a failure as well: C<drop> with an
id forgets what was read for that source, without one it forgets everything.

=end pod
*/
export type SourceStore = {
  sources: () => Sources
  wanted: () => Wanted[]
  located: (path: string, context: unknown, plain: boolean, at: IncludeStep | undefined, answer: Located) => void
  text: (source: Source, answer: string | null) => void
  drop: (id?: string) => void
}

export const createSourceStore = (): SourceStore => {
  const places = new Map<unknown, Map<string, Located>>()
  const texts = new Map<string, string | null>()
  let asked: Wanted[] = []
  // A path read as written and the same path read as a mask are two questions,
  // and so is the same path at two directives: a host may answer by the place.
  const keyOf = (path: string, plain: boolean, at?: IncludeStep): string =>
    `${plain ? 'plain' : 'mask'}\u0000${path}\u0000${at ? `${at.file}@${at.location?.start?.offset ?? ''}` : ''}`
  const want = (item: Wanted, same: (other: Wanted) => boolean): void => {
    if (!asked.some(same)) asked.push(item)
  }
  return {
    sources: () => ({
      locate: (path, context, plain = false, at) => {
        const known = places.get(context)?.get(keyOf(path, plain, at))
        if (known) return known
        want(
          { kind: 'locate', path, context, plain, at },
          o => o.kind === 'locate' && o.context === context && keyOf(o.path, o.plain, o.at) === keyOf(path, plain, at),
        )
        return undefined
      },
      read: source => {
        if (texts.has(source.id)) return texts.get(source.id) ?? null
        want({ kind: 'read', source }, o => o.kind === 'read' && o.source.id === source.id)
        return undefined
      },
    }),
    wanted: () => {
      const out = asked
      asked = []
      return out
    },
    located: (path, context, plain, at, answer) => {
      const known = places.get(context) ?? new Map<string, Located>()
      known.set(keyOf(path, plain, at), answer)
      places.set(context, known)
    },
    text: (source, answer) => {
      texts.set(source.id, answer)
    },
    drop: id => {
      if (id === undefined) {
        places.clear()
        texts.clear()
      } else texts.delete(id)
    },
  }
}

export type AssembleAsyncOptions = Omit<AssembleOptions, 'sources'> & {
  sources: AsyncSources
  // answers kept between assemblies; one of its own when not given
  store?: SourceStore
}

// more rounds than any document needs: each one must bring a new answer
const maxRounds = 1000

/*
=begin pod :kind<export>

=head2 assembleAsync

Assembles a document whose sources answer through promises. The document is
assembled over the answers at hand; what was missing is asked of C<sources>, and
the assembly is run again from the document as given, until nothing is missing.
Only that last assembly reports problems, fills C<origin> and calls C<onCopy>. A
source that fails to answer is taken as one that cannot be had.

=end pod
*/
export const assembleAsync = async (tree: any, opts: AssembleAsyncOptions): Promise<any> => {
  const { sources, store = createSourceStore(), ...rest } = opts
  const ignore = (): void => {}
  for (let round = 0; round < maxRounds; round++) {
    silently(() =>
      assembleIncludes(tree, {
        ...rest,
        sources: store.sources(),
        origin: new WeakMap<object, IncludeOrigin>(),
        onCopy: undefined,
        onError: ignore,
        onWarning: ignore,
      }),
    )
    const wanted = store.wanted()
    if (wanted.length === 0) return assembleIncludes(tree, { ...rest, sources: store.sources() })
    await Promise.all(
      wanted.map(async item => {
        if (item.kind === 'locate') {
          const answer = await Promise.resolve()
            .then(() => sources.locate(item.path, item.context, item.plain, item.at))
            .catch((): Located => ({ masked: false, sources: [] }))
          store.located(item.path, item.context, item.plain, item.at, answer)
        } else {
          const answer = await Promise.resolve()
            .then(() => sources.read(item.source))
            .catch(() => null)
          store.text(item.source, answer)
        }
      }),
    )
  }
  throw new Error('include sources keep asking for more')
}
