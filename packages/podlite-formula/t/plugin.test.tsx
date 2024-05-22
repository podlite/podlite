import { PodliteDocument, validatePodliteAst, getFromTree, makeAttrs, podlitePluggable } from '@podlite/schema'
import { FormulaPlugin } from '../src/index'
import { TestPodlite as Podlite } from '@podlite/to-jsx'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({
    formula: FormulaPlugin,
    'F<>': FormulaPlugin,
  })
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return asAst.interator
}

const plugins = makeComponent => {
  return {
    formula: FormulaPlugin.toJSX?.(makeComponent),
    'F<>': FormulaPlugin.toJSX?.(makeComponent),
  }
}

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

const pod = `
=begin pod
=formula
\\sum_0^\\infty
=end pod`

it('=formula: toAst', () => {
  const p = parse(pod)
  // try to validate Formal AST
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})

it.skip('=formula: Error handle', () => {
  const p = parse(
    `=formula
#BAD FORMULA
`,
  )
  const formula = getFromTree(p, 'formula')[0] as Object
  expect('custom' in formula).toBeTruthy()
})

it.skip('=formula: JSX Error handle', () => {
  const pod = `
=formula
  #BAD FORMULA
`

  render(<Podlite plugins={plugins}>{pod}</Podlite>)
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div class="formula"
         id="id"
    >
      <div class="formula error">
      </div>
    </div>
  `)
})

it.skip('=formula: series of formulas', () => {
  const pod = `
  =begin pod
  =begin formula
  \sqrt{2+3} -1 =123
  
  \sqrt{sdsdsdd} = ssdsdsdsd
  =end formula
  =end pod
  `
  const r = validatePodliteAst(parse(pod))
  expect(r).toEqual([])
  // render(<Podlite plugins={plugins}>{pod}</Podlite>)
  // expect(root.innerHTML).toMatchInlineSnapshot()
})

it('=formula: caption', () => {
  const pod =
    `
=begin pod
=begin formula :caption('Caption test')
` +
    'c = \\pm\\sqrt{a^2 + b^2}' +
    `
=end formula
=end pod
`
  const r = validatePodliteAst(parse(pod))
  expect(r).toEqual([])
  render(<Podlite plugins={plugins}>{pod}</Podlite>)
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="formula"
           id="id"
      >
        <div class="formula">
        </div>
        <div class="caption">
          Caption test
        </div>
      </div>
    </div>
  `)
})

it('F<>: toAst', () => {
  const p = parse(`
    =begin pod
    formula:   F<\\sum_0^\\infty>
    =end pod`)
  // try to validate Formal AST
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})

it.skip('F<>: Error handle', () => {
  const pod = `
  test F<#BAD FORMULA>
  `

  //   render(<Podlite plugins={plugins}>{pod}</Podlite>)
  const formula = getFromTree(parse(pod), { name: 'F', type: 'fcode' })[0] as Object
  console.log(JSON.stringify(formula, null, 2))
  //   expect('custom' in formula).toBeTruthy()
})

it('F<>: JSX handle', () => {
  const pod = `
    test F<FORMULA>
    `
  render(<Podlite plugins={plugins}>{pod}</Podlite>)
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <p>
      test
      <span class="f-code">
      </span>
    </p>
  `)
})
