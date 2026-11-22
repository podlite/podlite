import { runSelector } from '../src/selectors'
import { makeAttrs } from '../src'
import { podlite } from '../../core/src'

const p = podlite({ importPlugins: true })
const tree = (src: string) => p.toAst(p.parse(src, { podMode: 1 }))
const firstBlock = (src: string): any => tree(src).content.find((n: any) => n.type === 'block')
const options = (src: string) => (firstBlock(src)?.config || []).map((c: any) => [c.name, c.value])
const select = (selector: string, src: string) => runSelector(selector, [{ file: 'a.podlite', node: tree(src) }])

// Specification.pod6, General syntactic structure: identifiers take Unicode letters and digits,
// the underscore as a letter, and an apostrophe or hyphen before a letter
describe('a block name', () => {
  it('takes letters and digits of any script and an underscore', () => {
    expect(firstBlock('=for Στάδιο_2 :id<u>\nText\n')?.name).toBe('Στάδιο_2')
    expect(firstBlock('=for Στάδιο_\u0662 :id<d>\nText\n')?.name).toBe('Στάδιο_\u0662')
  })

  it('takes an apostrophe followed by a letter', () => {
    expect(firstBlock("=for Part'Deux :id<a>\nText\n")?.name).toBe("Part'Deux")
  })

  it('takes a hyphen, as before', () => {
    expect(firstBlock('=for Part-Deux :id<h>\nText\n')?.name).toBe('Part-Deux')
    expect(firstBlock('=for Part-2 :id<d>\nText\n')?.name).toBe('Part-2')
  })

  it('is found by a selector in either form', () => {
    const src = "=for Στάδιο_2 :id<u>\nText\n\n=for Part'Deux :id<a>\nText\n"
    expect(select('Στάδιο_2[ :id<u> ]', src)).toHaveLength(1)
    expect(select("Part'Deux[ :id<a> ]", src)).toHaveLength(1)
  })
})

describe('an option name', () => {
  it('takes letters of any script', () => {
    expect(options('=for para :όνομα<x>\nText\n')).toEqual([['όνομα', 'x']])
    expect(select('para[ :όνομα<x> ]', '=for para :όνομα<x>\nText\n')).toHaveLength(1)
  })

  it('ends before an apostrophe that opens a quoted value', () => {
    expect(options("=for para :u'a b'\nText\n")).toEqual([['u', 'a b']])
  })
})

describe('a name that is also a property of every object', () => {
  it('is a block name like any other', () => {
    expect(firstBlock('=for __defineGetter__\nText\n')?.name).toBe('__defineGetter__')
  })

  it('is an option name like any other', () => {
    const src = '=for para :__proto__<x>\nText\n'
    expect(select('para[ :?__proto__ ]', src)).toHaveLength(1)
  })
})

describe('an option name starting with an underscore', () => {
  it('leaves the directive line a block', () => {
    expect(firstBlock("=begin pod :_pubdate('2021-12-31')\nText\n=end pod\n")?.name).toBe('pod')
  })
})

describe('a key of a hash value', () => {
  it('takes letters of any script in both spellings', () => {
    expect(options('=for para :h{:π(1)}\nText\n')).toEqual([['h', { π: 1 }]])
    expect(options('=for para :h{π=>1}\nText\n')).toEqual([['h', { π: 1 }]])
  })

  it('takes an apostrophe followed by a letter in the spelling with an arrow', () => {
    expect(options("=for para :h{O'Brien=>1}\nText\n")).toEqual([['h', { "O'Brien": 1 }]])
  })
})

describe('a name in a script without letter case', () => {
  it('is neither a semantic nor a named block', () => {
    expect(firstBlock('=漢字 prose\n')).toBeUndefined()
    expect(firstBlock('=_ prose\n')).toBeUndefined()
  })

  it('leaves names with capitals as they were', () => {
    expect(firstBlock('=TITLE Text\n')?.name).toBe('TITLE')
    expect(firstBlock('=for MyBlock\nText\n')?.name).toBe('MyBlock')
    expect(firstBlock('=ΣΤΑΔΙΟ Text\n')?.name).toBe('ΣΤΑΔΙΟ')
  })
})

describe('the options of a block as a hash', () => {
  it('is an ordinary object holding every option as its own property', () => {
    const hash: any = makeAttrs(firstBlock('=for para :tag<x> :__proto__<y>\nText\n')).asHash()
    expect(hash.hasOwnProperty('tag')).toBe(true)
    expect(Object.keys(hash)).toEqual(['tag', '__proto__'])
  })

  it('is the same object each time, so a change to it is seen by the options', () => {
    const attrs = makeAttrs(firstBlock('=for para :tag<x>\nText\n'))
    expect(attrs.asHash()).toBe(attrs.asHash())
    delete (attrs.asHash() as any).tag
    expect(attrs.exists('tag')).toBe(false)
  })

  it('takes a new value written to it, beside an option named like one of its methods', () => {
    const attrs = makeAttrs(firstBlock('=for para :hasOwnProperty<own> :tag<x>\nText\n'))
    const hash: any = attrs.asHash()
    hash.tag = ['replacement']
    expect(attrs.getFirstValue('tag')).toBe('replacement')
  })
})
