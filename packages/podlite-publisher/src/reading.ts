import type { ScopedBlock } from '@podlite/schema'
import { podlite, readerFor } from 'podlite'

/*
=begin pod :kind<module>

=head2 reading

How the publisher reads a record, and the text an include brings into it.

=end pod
*/

/*
=begin pod :kind<export>

=head2 isReadBody

Whether the raw body of a block is Podlite text to be read in its place: the
body of C<=React> is.

=end pod
*/
export const isReadBody = (block: ScopedBlock): boolean => block.name === 'React'

/*
=begin pod :kind<export>

=head2 readRecordText

Reads a text as a record of that file name is read, with the body of C<=React>
read in its place. An include is given the same reader, so the body of
C<=React> in an included file is read as well.

=end pod
*/
export const readRecordText = readerFor(podlite({ importPlugins: true }), { body: isReadBody })
