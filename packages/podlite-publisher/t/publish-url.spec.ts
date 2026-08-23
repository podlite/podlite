import { podlite } from 'podlite'
import { getFromTree } from '@podlite/schema'
import { getDocumentAttributes, getPublishAttributes } from '../src/node-utils'

const parse = (source: string) => {
  const p = podlite({ importPlugins: true })
  return p.toAst(p.parse(source, { podMode: 1 }))
}

const document = (attr: string) => parse(`=begin pod ${attr}\n\n=TITLE Page\n\ntext\n\n=end pod\n`)

const podOf = (tree: any) => {
  const [node] = getFromTree(tree.content, 'pod')
  return node
}

describe('a publish address written with a space in it', () => {
  let warned: string[]
  let spy: jest.SpyInstance

  beforeEach(() => {
    warned = []
    spy = jest.spyOn(console, 'warn').mockImplementation(message => {
      warned.push(String(message))
    })
  })
  afterEach(() => spy.mockRestore())

  it('is reported instead of being shortened in silence', () => {
    const props = getDocumentAttributes(document(':puburl</books/all/Raku doc>'), 'books.podlite')
    expect(props.puburl).toBe('/books/all/Raku')
    expect(warned).toHaveLength(1)
    expect(warned[0]).toContain('puburl')
    expect(warned[0]).toContain('books.podlite')
    expect(warned[0]).toContain('/books/all/Raku')
  })

  it('names the old attribute by its own name', () => {
    getDocumentAttributes(document(':publishUrl</books/all/Raku doc>'), 'books.podlite')
    expect(warned[0]).toContain('publishUrl')
  })

  it('says nothing when the address holds no space', () => {
    const props = getDocumentAttributes(document(':puburl</books/all/Rakudoc>'), 'books.podlite')
    expect(props.puburl).toBe('/books/all/Rakudoc')
    expect(warned).toEqual([])
  })

  it('keeps a quoted address whole and stays quiet', () => {
    const props = getDocumentAttributes(document(":puburl<'/books/all/Raku doc'>"), 'books.podlite')
    expect(props.puburl).toBe('/books/all/Raku doc')
    expect(warned).toEqual([])
  })

  it('reports the same way on the publish path', () => {
    const props = getPublishAttributes(podOf(document(':puburl</books/all/Raku doc>')), 'books.podlite')
    expect(props.puburl).toBe('/books/all/Raku')
    expect(warned).toHaveLength(1)
  })

  it('still tells which document it happened in without a path given', () => {
    getDocumentAttributes(document(':puburl</books/all/Raku doc>'))
    expect(warned[0]).toContain('/books/all/Raku')
  })
})
