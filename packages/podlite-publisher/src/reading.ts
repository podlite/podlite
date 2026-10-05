import type { ScopedBlock } from '@podlite/schema'
import { podlite, readerFor } from 'podlite'

// the body of =React is Podlite text, read in its place
export const isReadBody = (block: ScopedBlock): boolean => (block as { name?: string }).name === 'React'

// How a record and a text an include brings into it are read: one reader for both,
// so that the body of =React is read in an included file as well.
export const readRecordText = readerFor(podlite({ importPlugins: true }), { body: isReadBody })
