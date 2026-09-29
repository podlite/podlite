import type { AstTree, ConfigScope, Podlite, PodliteDocument, parseOpt } from '@podlite/schema'
import { parseMd } from '@podlite/markdown'

export type ReadFormat = 'podlite' | 'md'

export type ReaderOptions = {
  // the format a file of that name is read as; Podlite when not given
  format: (file: string) => ReadFormat
}

type Parser = Pick<Podlite, 'parse' | 'toAst'>
type ReadExtras = Pick<parseOpt, 'recognition' | 'diagnostics'>

type Reader<T> = (text: string, file: string, config?: ConfigScope, extras?: ReadExtras) => T

/*
=begin pod :kind<export>

=head2 readerFor

Makes the reading an include assembly asks for out of a parser: a text, the name
of its file and the settings in effect where it is placed give a tree. The parser
keeps its own plugins. The fourth argument carries the lists the parser fills
with recognition events and diagnostics. With C<format>, a file the function names C<md> is read as
Markdown and comes back as the Markdown reader leaves it, without the plugins and
without the settings.

=end pod
*/
export function readerFor(parser: Parser): Reader<PodliteDocument>
export function readerFor(parser: Parser, options: ReaderOptions): Reader<PodliteDocument | AstTree>
export function readerFor(parser: Parser, options?: ReaderOptions): Reader<PodliteDocument | AstTree> {
  return (text, file, config, extras = {}) =>
    options?.format(file) === 'md'
      ? parseMd(text)
      : parser.toAst(parser.parse(text, { ...extras, podMode: 1, config }), { config })
}
