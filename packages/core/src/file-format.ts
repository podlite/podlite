/*
=begin pod :kind<module>

=head2 file-format

The format a file is read in, from its name or from a declared MIME type.

=end pod
*/

export type ReadFormat = 'podlite' | 'md' | 'default'

/*
=begin pod :kind<export>

=head2 formatOfFile

The format a file of that name is read in: C<.podlite> and C<.pod6> are Podlite,
C<.md> and C<.markdown> are Markdown, and any other extension, or none, is read
in the default mode, where text outside blocks is ambient. The extension is the
last part of the name and is compared without regard to case.

=end pod
*/
export const formatOfFile = (file: string): ReadFormat => {
  const name = file.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (extension === 'podlite' || extension === 'pod6') return 'podlite'
  if (extension === 'md' || extension === 'markdown') return 'md'
  return 'default'
}

/*
=begin pod :kind<export>

=head2 formatOfType

The format a declared MIME type asks for: C<text/podlite> is Podlite,
C<text/markdown> is Markdown, any other C<text/> type the default mode. A type
that is not text has no reader, and the answer is C<undefined>.

=end pod
*/
export const formatOfType = (type: string): ReadFormat | undefined => {
  const essence = type.split(';')[0].trim().toLowerCase()
  if (essence === 'text/podlite') return 'podlite'
  if (essence === 'text/markdown') return 'md'
  if (essence.startsWith('text/')) return 'default'
  return undefined
}
