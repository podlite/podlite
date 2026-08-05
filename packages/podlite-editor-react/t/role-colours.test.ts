import { Tag } from '@lezer/highlight'
import { ROLE_TAGS } from '../src/podliteMarkdown'
import { syntaxStyles } from '../src/theme'

// the last rule wins, the same way the highlighter reads the list
const colourOf = (tag: Tag): string | undefined => {
  let found: string | undefined
  for (const style of syntaxStyles) {
    const tags = Array.isArray(style.tag) ? style.tag : [style.tag]
    if (tags.includes(tag)) found = style.color
  }
  return found
}

describe('the colour of every kind of name', () => {
  it('is set', () => {
    const missing = Object.entries(ROLE_TAGS)
      .filter(([, tag]) => !colourOf(tag))
      .map(([role]) => role)
    expect(missing).toEqual([])
  })

  // two of these once reached the same colour by different tags: a section name
  // was coloured like a setting name, an author's name like an unknown one
  it('differs from the colour of every other kind', () => {
    const byColour: Record<string, string[]> = {}
    for (const [role, tag] of Object.entries(ROLE_TAGS)) {
      const colour = colourOf(tag) || 'none'
      byColour[colour] = [...(byColour[colour] || []), role]
    }
    const shared = Object.entries(byColour).filter(([, roles]) => roles.length > 1)
    expect(shared).toEqual([])
  })
})
