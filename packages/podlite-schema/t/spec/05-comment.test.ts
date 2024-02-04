import { toTree, toHtml } from '../..'

it('spec: 05-comment 0', () => {
  const pod = `
=begin pod
=for comment
foo foo
bla bla    bla

This isn't a comment
=end pod

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "config": Array [],
            "content": Array [
              "foo foo
    bla bla    bla
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 48,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "name": "comment",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "This isn't a comment
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 8,
                "offset": 70,
              },
              "start": Object {
                "column": 1,
                "line": 7,
                "offset": 49,
              },
            },
            "margin": "",
            "text": "This isn't a comment
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 9,
            "offset": 79,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "pod",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 05-comment 1', () => {
  const pod = `
=comment
This file is deliberately specified in Raku Pod format

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          "This file is deliberately specified in Raku Pod format
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 65,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "comment",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 05-comment 2', () => {
  const pod = `
=begin comment
foo foo
=begin invalid pod
=as many invalid pod as we want
===yay!
=end comment

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          "foo foo
    =begin invalid pod
    =as many invalid pod as we want
    ===yay!
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 8,
            "offset": 96,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "comment",
        "text": "=begin comment
    foo foo
    =begin invalid pod
    =as many invalid pod as we want
    ===yay!
    =end comment
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})
