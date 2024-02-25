import { getFromTree, getNodeId, getTextContentFromNode, mkRootBlock, PodliteDocument, toTree, validatePodliteAst } from '@podlite/schema'
import middleware from '../../core/src/ids'
import { cleanLocalHrefs, frozenIds, slugifyText } from '../src/helpers/ids'

export const parse = (text: string, opt?): PodliteDocument => {
  const rawTree = toTree()
    .use(middleware)
    .parse(text, (opt = { skipChain: 0, podMode: 1 }))
  const root = mkRootBlock({ margin: '' }, rawTree)
  return root
}
const pod = `=begin
  =for para :id<test>
      test
  =end`

it('[ID] validate', () => {
  const p = parse(pod)
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})

it('[ID] custom id', () => {
  const p = parse(pod)
  const para = getFromTree(p, 'para')[0]
  const id = getNodeId(para, {})
  expect(id).toEqual('test')
})

it('[ID] validate =item', () => {
  const p = parse(`=item1 test`)
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})

it('[cleanHrefs] local links', () => {
  const parsed = parse(`L<test|#PARA>
=for item :id<PARA>
test`)
  const p = cleanLocalHrefs()(frozenIds()(parsed))
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
  expect(p).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                "test",
              ],
              "meta": "#",
              "name": "L",
              "type": "fcode",
            },
            "
    ",
          ],
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 2,
              "offset": 14,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "L<test|#PARA>
    ",
          "type": "para",
        },
        Object {
          "content": Array [
            Object {
              "config": Array [
                Object {
                  "name": "id",
                  "type": "string",
                  "value": "PARA",
                },
              ],
              "content": Array [
                Object {
                  "content": Array [
                    "test",
                  ],
                  "location": Object {
                    "end": Object {
                      "column": 5,
                      "line": 3,
                      "offset": 38,
                    },
                    "start": Object {
                      "column": 1,
                      "line": 2,
                      "offset": 14,
                    },
                  },
                  "margin": "",
                  "text": "test",
                  "type": "para",
                },
              ],
              "id": "id",
              "level": 1,
              "location": Object {
                "end": Object {
                  "column": 5,
                  "line": 3,
                  "offset": 38,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 14,
                },
              },
              "margin": "",
              "name": "item",
              "type": "block",
            },
          ],
          "level": 1,
          "list": "itemized",
          "type": "list",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

const getTree = (text: string, opt?): PodliteDocument => {
    const rawTree = toTree()
      .parse(text, (opt = { skipChain: 0, podMode: 1 }))
    const root = mkRootBlock({ margin: '' }, rawTree)
    return root
  }


it('[slugifyText] multypass', () => {
    const pass1 = slugifyText('item id<> test');
    const pass2 = slugifyText(pass1);
    expect(pass1).toEqual(pass2)
  })
