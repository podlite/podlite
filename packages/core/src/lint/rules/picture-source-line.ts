import { getFromTree, makeAttrs, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const PICTURE_SOURCE_LINE_RULE_ID = 'picture-source-line'

const blank = /^[\t\r    -   　]*$/
const MEDIA = /\.(?:png|jpe?g|gif|svg|webp|avif|bmp|ico|tiff?|mp4|mov|webm)$/i
const SCHEME = /^(?:data|https?|ftp|file):\S+$/i

const bodyOf = (node: { content?: unknown }): string =>
  (Array.isArray(node.content) ? node.content : [])
    .map(part =>
      part && typeof (part as { value?: unknown }).value === 'string' ? (part as { value: string }).value : '',
    )
    .join('')

// the address as the message names it: a data: URL up to its comma, and nothing
// longer than a line of text
const shown = (address: string): string => {
  const data = /^data:[^,]*,/i.exec(address)
  if (data) return `${data[0]}…`
  return address.length > 80 ? `${address.slice(0, 79)}…` : address
}

/*
=begin pod :kind<export>

=head2 pictureSourceLineRule

A C<=picture> with no C<:src>, written on it or given by C<=set> or C<=config>,
whose first line of text ends in a path to an image or a video, or in an
address with a C<data:>, C<http:>, C<https:>, C<ftp:> or C<file:> scheme. Before
norm 3.0 that word was the source; now the whole body is the caption and the
picture has none. A warning, since the line may be meant as the caption.

=end pod
*/
export const pictureSourceLineRule: Rule = {
  id: PICTURE_SOURCE_LINE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const pictures = getFromTree(ast, node => {
      const n = node as { type?: string; name?: string }
      return n.type === 'block' && n.name === 'picture'
    }) as Array<{ location?: Violation['location']; config?: unknown; content?: unknown }>
    const violations: Violation[] = []
    for (const node of pictures) {
      if (makeAttrs(node).exists('src')) continue
      const line = bodyOf(node)
        .split('\n')
        .find(text => !blank.test(text))
      const address = line?.trim().split(/\s+/).pop() ?? ''
      if (!MEDIA.test(address) && !SCHEME.test(address)) continue
      violations.push({
        rule: PICTURE_SOURCE_LINE_RULE_ID,
        severity: 'warning',
        message: `=picture takes its source only from :src; if ${shown(
          address,
        )} is the picture source, write it as :src of =for picture or =begin picture`,
        location: node.location,
      })
    }
    return violations
  },
}
