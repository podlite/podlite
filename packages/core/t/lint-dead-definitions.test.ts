import { lintSource } from '../src/lint'
import { DEAD_DEFINITIONS_RULE_ID, deadDefinitionsRule } from '../src/lint/rules/dead-definitions'

const check = (src: string) =>
  lintSource(src, 'doc.podlite', {}).violations.filter(v => v.rule === DEAD_DEFINITIONS_RULE_ID)

const dataBlock = (key: string) => `=begin data :key<${key}> :mime-type<text/csv>\nname,count\nalpha,1\n=end data\n`

describe('dead-definitions rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(DEAD_DEFINITIONS_RULE_ID).toBe('dead-definitions')
    expect(deadDefinitionsRule.severity).toBe('warning')
  })

  it('says nothing about a document that declares neither', () => {
    expect(check('=head1 Title\n\ntext\n')).toEqual([])
  })

  describe('an alias', () => {
    it('is left alone when a markup code calls it', () => {
      expect(check('=alias PRODUCT My Product\n\nA<PRODUCT> ships today.\n')).toEqual([])
    })

    it('is reported when nothing calls it', () => {
      const found = check('=alias PRODUCT My Product\n\nplain text only\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('PRODUCT')
    })

    it('is reported once per alias left unused', () => {
      expect(check('=alias ONE first\n=alias TWO second\n\ntext\n')).toHaveLength(2)
    })

    it('is not confused by a similar name', () => {
      expect(check('=alias PRODUCT My Product\n\nA<PRODUCTION> elsewhere\n')).toHaveLength(1)
    })
  })

  describe('a data block', () => {
    it('is left alone when a table reads it', () => {
      expect(check(`${dataBlock('rows')}\n=table data:rows\n`)).toEqual([])
    })

    it('is left alone when an attribute points at it', () => {
      expect(check(`${dataBlock('img')}\n=for picture :src<data:img>\nalt text\n`)).toEqual([])
    })

    it('is reported when the key is named nowhere', () => {
      const found = check(`${dataBlock('rows')}\ntext\n`)
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('rows')
    })

    it('catches the key that was mistyped at the reference', () => {
      const found = check(`${dataBlock('rows')}\n=table data:rowz\n`)
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('rows')
    })

    it('says nothing about a data block that carries no key', () => {
      expect(check('=begin data\nname,count\n=end data\n\ntext\n')).toEqual([])
    })
  })

  it('points at the line the definition stands on', () => {
    const found = check('=head1 Title\n\n=alias PRODUCT My Product\n\ntext\n')
    expect(found[0].location?.start.line).toBe(3)
  })
})

describe('without the source text', () => {
  it('keeps checking aliases, which the tree carries', () => {
    const { runRules } = require('../src/lint/engine')
    const { parseContent } = require('../src/lint/loader')
    const ast = parseContent('=alias PRODUCT My Product\n\ntext\n', 'podlite')
    const found = runRules(ast, [deadDefinitionsRule], { filePath: 'doc.podlite', fileType: 'podlite', config: {} })
    expect(found).toHaveLength(1)
  })

  it('says nothing about data keys it cannot look up', () => {
    const { runRules } = require('../src/lint/engine')
    const { parseContent } = require('../src/lint/loader')
    const ast = parseContent('=begin data :key<rows>\na,b\n=end data\n\ntext\n', 'podlite')
    const found = runRules(ast, [deadDefinitionsRule], { filePath: 'doc.podlite', fileType: 'podlite', config: {} })
    expect(found).toEqual([])
  })
})
