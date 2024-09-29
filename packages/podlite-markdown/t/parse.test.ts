import { frozenIds, isValidateError, podlitePluggable } from '@podlite/schema'
import { validateAstTree } from '@podlite/schema'
import { md2ast } from '../src/tools'
import { PodliteDocument } from '@podlite/schema'

const process = src => {
  return frozenIds()(md2ast(src))
}

export const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({})
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return asAst.interator
}
it('=markdown: parse para', () => {
  const pod = `text`
  //   const tree1 = parse(pod);
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "text",
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 5,
              "line": 1,
              "offset": 4,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it.skip('[markdown]: parse para', () => {
  const pod = `text`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  //   expect(process(pod)).toMatchInlineSnapshot();
})

it('[markdown]: parse headers', () => {
  const pod = `## build

Generate JavaScript documentation as a list of parsed JSDoc
comments, given a root file as a path`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "build",
          ],
          "id": "id",
          "level": 2,
          "location": Object {
            "end": Object {
              "column": 9,
              "line": 1,
              "offset": 8,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "head",
          "type": "block",
        },
        Object {
          "content": Array [
            "Generate JavaScript documentation as a list of parsed JSDoc
    comments, given a root file as a path",
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 38,
              "line": 4,
              "offset": 107,
            },
            "start": Object {
              "column": 1,
              "line": 3,
              "offset": 10,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})
it('[markdown]: parse link', () => {
  const pod = `[#raku IRC channel](https://raku.org/community/irc)`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                "#raku IRC channel",
              ],
              "meta": "https://raku.org/community/irc",
              "name": "L",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 52,
              "line": 1,
              "offset": 51,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})
it('[markdown]: parse image', () => {
  const pod = `![foo](/url "title")`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "config": Array [],
              "content": Array [
                Object {
                  "alt": "foo",
                  "src": "/url",
                  "type": "image",
                },
                Object {
                  "content": Array [
                    "title",
                  ],
                  "name": "caption",
                  "type": "block",
                },
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 21,
                  "line": 1,
                  "offset": 20,
                },
                "start": Object {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "margin": "",
              "name": "Image",
              "type": "block",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 21,
              "line": 1,
              "offset": 20,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: parse refs', () => {
  const pod = `### Table of Contents

-   [lint][1]
    -   [Parameters][2]


[1]: #lint

[2]: #parameters`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "Table of Contents",
          ],
          "id": "id",
          "level": 3,
          "location": Object {
            "end": Object {
              "column": 22,
              "line": 1,
              "offset": 21,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "head",
          "type": "block",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "lint",
                      ],
                      "meta": "#lint",
                      "name": "L",
                      "type": "fcode",
                    },
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 14,
                      "line": 3,
                      "offset": 36,
                    },
                    "start": Object {
                      "column": 5,
                      "line": 3,
                      "offset": 27,
                    },
                  },
                  "margin": "",
                  "text": "text",
                  "type": "para",
                },
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        Object {
                          "content": Array [
                            Object {
                              "content": Array [
                                "Parameters",
                              ],
                              "meta": "#parameters",
                              "name": "L",
                              "type": "fcode",
                            },
                          ],
                          "id": "id",
                          "location": Object {
                            "end": Object {
                              "column": 24,
                              "line": 4,
                              "offset": 60,
                            },
                            "start": Object {
                              "column": 9,
                              "line": 4,
                              "offset": 45,
                            },
                          },
                          "margin": "",
                          "text": "text",
                          "type": "para",
                        },
                      ],
                      "id": "id",
                      "level": 2,
                      "location": Object {
                        "end": Object {
                          "column": 24,
                          "line": 4,
                          "offset": 60,
                        },
                        "start": Object {
                          "column": 5,
                          "line": 4,
                          "offset": 41,
                        },
                      },
                      "margin": "",
                      "name": "item",
                      "type": "block",
                    },
                  ],
                  "id": "id",
                  "level": 2,
                  "list": "itemized",
                  "margin": "",
                  "type": "list",
                },
              ],
              "id": "id",
              "level": 1,
              "location": Object {
                "end": Object {
                  "column": 24,
                  "line": 4,
                  "offset": 60,
                },
                "start": Object {
                  "column": 1,
                  "line": 3,
                  "offset": 23,
                },
              },
              "margin": "",
              "name": "item",
              "type": "block",
            },
          ],
          "id": "id",
          "level": 1,
          "list": "itemized",
          "margin": "",
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

it('[markdown]: broken_refs', () => {
  const pod = `### Parameters

-   \`comments\` **[Array][17]&lt;[Object][19]>** parsed comments
-   \`args\` **[Object][19]** Options that can customize the output
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "Parameters",
          ],
          "id": "id",
          "level": 3,
          "location": Object {
            "end": Object {
              "column": 15,
              "line": 1,
              "offset": 14,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "head",
          "type": "block",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "comments",
                      ],
                      "name": "C",
                      "type": "fcode",
                    },
                    " ",
                    Object {
                      "content": Array [
                        "[Array][17]<[Object][19]>",
                      ],
                      "name": "B",
                      "type": "fcode",
                    },
                    " parsed comments",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 64,
                      "line": 3,
                      "offset": 79,
                    },
                    "start": Object {
                      "column": 5,
                      "line": 3,
                      "offset": 20,
                    },
                  },
                  "margin": "",
                  "text": "text",
                  "type": "para",
                },
              ],
              "id": "id",
              "level": 1,
              "location": Object {
                "end": Object {
                  "column": 64,
                  "line": 3,
                  "offset": 79,
                },
                "start": Object {
                  "column": 1,
                  "line": 3,
                  "offset": 16,
                },
              },
              "margin": "",
              "name": "item",
              "type": "block",
            },
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "args",
                      ],
                      "name": "C",
                      "type": "fcode",
                    },
                    " ",
                    Object {
                      "content": Array [
                        "[Object][19]",
                      ],
                      "name": "B",
                      "type": "fcode",
                    },
                    " Options that can customize the output",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 66,
                      "line": 4,
                      "offset": 145,
                    },
                    "start": Object {
                      "column": 5,
                      "line": 4,
                      "offset": 84,
                    },
                  },
                  "margin": "",
                  "text": "text",
                  "type": "para",
                },
              ],
              "id": "id",
              "level": 1,
              "location": Object {
                "end": Object {
                  "column": 66,
                  "line": 4,
                  "offset": 145,
                },
                "start": Object {
                  "column": 1,
                  "line": 4,
                  "offset": 80,
                },
              },
              "margin": "",
              "name": "item",
              "type": "block",
            },
          ],
          "id": "id",
          "level": 1,
          "list": "itemized",
          "margin": "",
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

it('[markdown]: parse code', () => {
  const pod = `
\`\`\`javascript
var documentation = require('documentation');
\`\`\`
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "config": Array [
            Object {
              "name": "lang",
              "type": "string",
              "value": "javascript",
            },
          ],
          "content": Array [
            Object {
              "type": "verbatim",
              "value": "var documentation = require('documentation');",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 4,
              "line": 4,
              "offset": 64,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "name": "code",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: inline_code', () => {
  const pod = `
*This text will be italic*
_This will also be italic_

**This text will be bold**
__This will also be bold__

_You **can** combine them_
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                "This text will be italic",
              ],
              "name": "I",
              "type": "fcode",
            },
            "
    ",
            Object {
              "content": Array [
                "This will also be italic",
              ],
              "name": "I",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 27,
              "line": 3,
              "offset": 54,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                "This text will be bold",
              ],
              "name": "B",
              "type": "fcode",
            },
            "
    ",
            Object {
              "content": Array [
                "This will also be bold",
              ],
              "name": "B",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 27,
              "line": 6,
              "offset": 109,
            },
            "start": Object {
              "column": 1,
              "line": 5,
              "offset": 56,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                "You ",
                Object {
                  "content": Array [
                    "can",
                  ],
                  "name": "B",
                  "type": "fcode",
                },
                " combine them",
              ],
              "name": "I",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 27,
              "line": 8,
              "offset": 137,
            },
            "start": Object {
              "column": 1,
              "line": 8,
              "offset": 111,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: thematic_break', () => {
  const pod = `

---
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: blockquote', () => {
  const pod = `
As Kanye West said:

> We're living the future so
> the present is our past.
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "As Kanye West said:",
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 20,
              "line": 2,
              "offset": 20,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                "We're living the future so
    the present is our past.",
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 27,
                  "line": 5,
                  "offset": 77,
                },
                "start": Object {
                  "column": 3,
                  "line": 4,
                  "offset": 24,
                },
              },
              "margin": "",
              "text": "text",
              "type": "para",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 27,
              "line": 5,
              "offset": 77,
            },
            "start": Object {
              "column": 1,
              "line": 4,
              "offset": 22,
            },
          },
          "margin": "",
          "name": "nested",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: parse table', () => {
  const pod = `
First Header | Second Header
------------ | -------------
Content from cell 1 | Content from cell 2
Content in the first column | Content in the second column
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    "First Header",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 15,
                      "line": 2,
                      "offset": 15,
                    },
                    "start": Object {
                      "column": 1,
                      "line": 2,
                      "offset": 1,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
                Object {
                  "content": Array [
                    "Second Header",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 29,
                      "line": 2,
                      "offset": 29,
                    },
                    "start": Object {
                      "column": 15,
                      "line": 2,
                      "offset": 15,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 29,
                  "line": 2,
                  "offset": 29,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 1,
                },
              },
              "margin": "",
              "name": "table_row",
              "type": "block",
            },
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    "Content from cell 1",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 22,
                      "line": 4,
                      "offset": 80,
                    },
                    "start": Object {
                      "column": 1,
                      "line": 4,
                      "offset": 59,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
                Object {
                  "content": Array [
                    "Content from cell 2",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 42,
                      "line": 4,
                      "offset": 100,
                    },
                    "start": Object {
                      "column": 22,
                      "line": 4,
                      "offset": 80,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 42,
                  "line": 4,
                  "offset": 100,
                },
                "start": Object {
                  "column": 1,
                  "line": 4,
                  "offset": 59,
                },
              },
              "margin": "",
              "name": "table_row",
              "type": "block",
            },
            Object {
              "content": Array [
                Object {
                  "content": Array [
                    "Content in the first column",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 30,
                      "line": 5,
                      "offset": 130,
                    },
                    "start": Object {
                      "column": 1,
                      "line": 5,
                      "offset": 101,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
                Object {
                  "content": Array [
                    "Content in the second column",
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 59,
                      "line": 5,
                      "offset": 159,
                    },
                    "start": Object {
                      "column": 30,
                      "line": 5,
                      "offset": 130,
                    },
                  },
                  "margin": "",
                  "name": "table_cell",
                  "type": "block",
                },
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 59,
                  "line": 5,
                  "offset": 159,
                },
                "start": Object {
                  "column": 1,
                  "line": 5,
                  "offset": 101,
                },
              },
              "margin": "",
              "name": "table_row",
              "type": "block",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 59,
              "line": 5,
              "offset": 159,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "name": "table",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('[markdown]: parse strikethrough', () => {
  const pod = `
~~this~~
`
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  const errorDescribe = isValidateError(r, tree)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                "this",
              ],
              "name": "Delete",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 9,
              "line": 2,
              "offset": 9,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})
it('[markdown]: parse diagrams', () => {
  const pod = `
\`\`\`mermaid caption="1"
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`
  `
  const tree = process(pod)
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "config": Array [],
          "content": Array [
            Object {
              "type": "verbatim",
              "value": "graph TD;
        A-->B;
        A-->C;
        B-->D;
        C-->D;",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 4,
              "line": 8,
              "offset": 81,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "name": "Mermaid",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})
it('[markdown]: parse formulas', () => {
  const pod = `
test \$x+1\over\sqrt{1-x^2}\$
 
  $$
   L = \frac{1}{2} \rho v^2 S C_L
  tes
  $$
  `
  const tree = process(pod)

  const r = validateAstTree([tree])
  expect(r).toEqual([])
  // expect(process(pod)).toMatchInlineSnapshot()
  //   console.log(JSON.stringify(tree, null, 2))
})

it('[markdown]: parse images', () => {
  const pod = `
[![Build Status](https://example.com/image.png)](https://example.org)

    `
  const tree = process(pod)
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "config": Array [],
                  "content": Array [
                    Object {
                      "alt": "Build Status",
                      "src": "https://example.com/image.png",
                      "type": "image",
                    },
                  ],
                  "id": "id",
                  "location": Object {
                    "end": Object {
                      "column": 48,
                      "line": 2,
                      "offset": 48,
                    },
                    "start": Object {
                      "column": 2,
                      "line": 2,
                      "offset": 2,
                    },
                  },
                  "margin": "",
                  "name": "Image",
                  "type": "block",
                },
              ],
              "meta": "https://example.org",
              "name": "L",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 70,
              "line": 2,
              "offset": 70,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})
