import { PodliteDocument, validatePodliteAst, getFromTree, makeAttrs, podlitePluggable } from '@podlite/schema'
import Formula, { FormulaPlugin } from '../src/index'
import { TestPodlite as Podlite } from '@podlite/to-jsx'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({
    formula: FormulaPlugin,
  })
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return asAst.interator
}

const parseToHtml = (str: string): string => {
  let podlite = podlitePluggable().use({
    formula: FormulaPlugin,
  })
  let tree = podlite.parse(str)
  const asAst = podlite.toAst(tree)
  return podlite.toHtml(asAst).toString()
}

const cleanHTML = (html: string) => {
  return html.replace(/\n+/g, '')
}

const plugins = makeComponent => {
  return {
    formula: () => (node, ctx, interator) => {
      const conf = makeAttrs(node, ctx)
      const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
      console.log({ g: node.content })
      return makeComponent(
        ({ children, key }) => {
          return <Formula isError={node.custom} key={key} caption={caption} formula={node.content[0].value} />
        },
        node,
        interator(node.content, { ...ctx }),
      )
    },
  }
}

// const root = document.body.appendChild(document.createElement('div'));

// function render(jsx) {
//   return ReactDOM.render(jsx, root);
// }

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

// afterEach(() => ReactDOM.unmountComponentAtNode(root));

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
graph EROROROOROR
A --- B
B-->C[fa:fa-ban forbidden]
B-->D(fa:fa-spinner aaaaa);
`,
  )
  const formula = getFromTree(p, 'formula')[0] as Object
  console.log(JSON.stringify(formula, null, 2))

  expect('custom' in formula).toBeTruthy()
})

it.skip('=fomula: parse to html', () => {
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`""`)
})

it.skip('=formula: caption', () => {
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
  render(<Podlite plugins={plugins}>{pod}</Podlite>)
  //   console.log(root.innerHTML)
  //   expect(root.innerHTML).toMatchInlineSnapshot()
})

it.skip('accepts =Mermaid', () => {
  render(<Podlite plugins={plugins}>{pod}</Podlite>)
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="diagram"
           id="id"
      >
        <div class="mermaid">
        </div>
      </div>
    </div>
  `)
})
