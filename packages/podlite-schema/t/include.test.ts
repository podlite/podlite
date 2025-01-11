import { toTree, toHtml, validatePodliteAst, validateAst } from '..'
const parse = pod => toTree().parse(pod, { podMode: 1, skipChain: 0 })

it('01: parse pod', () => {
  const p = parse(`=begin pod
=include t/data.txt
=end pod
`)

  const r = validateAst(p)
  expect(r).toEqual([])
})
