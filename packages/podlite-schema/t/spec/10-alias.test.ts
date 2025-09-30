import { toTree, toHtml } from '../..'

it('spec: 10-alias 0', () => {
  const pod = `
=begin pod
    =alias PROGNAME    Earl Irradiatem Evermore
    =alias VENDOR      4D Kingdoms
    =alias TERMS_URLS  =item L<http://www.4dk.com/eie>
    =                  =item L<http://www.4dk.co.uk/eie.io/>
    =                  =item L<http://www.fordecay.ch/canttouchthis>
The use of A<PROGNAME> is subject to the terms and conditions
laid out by A<VENDOR>, as specified at:

A<TERMS_URLS>

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
            "margin": "    ",
            "name": "PROGNAME",
            "replacement": Array [
              "Earl Irradiatem Evermore",
            ],
            "type": "alias",
          },
          Object {
            "margin": "    ",
            "name": "VENDOR",
            "replacement": Array [
              "4D Kingdoms",
            ],
            "type": "alias",
          },
          Object {
            "margin": "    ",
            "name": "TERMS_URLS",
            "replacement": Array [
              "=item L<http://www.4dk.com/eie>",
              "=item L<http://www.4dk.co.uk/eie.io/>",
              "=item L<http://www.fordecay.ch/canttouchthis>",
            ],
            "type": "alias",
          },
          Object {
            "content": Array [
              "The use of ",
              Object {
                "content": "PROGNAME",
                "name": "A",
                "type": "fcode",
              },
              " is subject to the terms and conditions
    laid out by ",
              Object {
                "content": "VENDOR",
                "name": "A",
                "type": "fcode",
              },
              ", as specified at:
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 382,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 280,
              },
            },
            "margin": "",
            "text": "The use of A<PROGNAME> is subject to the terms and conditions
    laid out by A<VENDOR>, as specified at:
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "content": "TERMS_URLS",
                "name": "A",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 12,
                "offset": 397,
              },
              "start": Object {
                "column": 1,
                "line": 11,
                "offset": 383,
              },
            },
            "margin": "",
            "text": "A<TERMS_URLS>
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 14,
            "offset": 407,
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

it('spec: 10-alias 1', () => {
  const pod = `
=para
A<  TERER >

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": "  TERER ",
                "name": "A",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 19,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "A<  TERER >
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 19,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "para",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})
