import { toTree, toHtml } from "../..";

it("spec: 06-lists 0", () => {
  const pod = `
=begin pod
The seven suspects are:

=item  Happy
=item  Dopey
=item  Sleepy
=item  Bashful
=item  Sneezy
=item  Grumpy
=item  Keyser Soze
=end pod

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "content": Array [
              "The seven suspects are:
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 36,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "text": "The seven suspects are:
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "Happy
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 6,
                        "offset": 50,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 5,
                        "offset": 37,
                      },
                    },
                    "margin": "",
                    "text": "Happy
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 6,
                    "offset": 50,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 5,
                    "offset": 37,
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
                      "Dopey
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 7,
                        "offset": 63,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 6,
                        "offset": 50,
                      },
                    },
                    "margin": "",
                    "text": "Dopey
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 7,
                    "offset": 63,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 6,
                    "offset": 50,
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
                      "Sleepy
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 77,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 7,
                        "offset": 63,
                      },
                    },
                    "margin": "",
                    "text": "Sleepy
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 8,
                    "offset": 77,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 7,
                    "offset": 63,
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
                      "Bashful
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 92,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 77,
                      },
                    },
                    "margin": "",
                    "text": "Bashful
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 9,
                    "offset": 92,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 8,
                    "offset": 77,
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
                      "Sneezy
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 106,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 92,
                      },
                    },
                    "margin": "",
                    "text": "Sneezy
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 10,
                    "offset": 106,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 9,
                    "offset": 92,
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
                      "Grumpy
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 11,
                        "offset": 120,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 106,
                      },
                    },
                    "margin": "",
                    "text": "Grumpy
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 11,
                    "offset": 120,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 10,
                    "offset": 106,
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
                      "Keyser Soze
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 12,
                        "offset": 139,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 11,
                        "offset": 120,
                      },
                    },
                    "margin": "",
                    "text": "Keyser Soze
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 12,
                    "offset": 139,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 11,
                    "offset": 120,
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
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 13,
            "offset": 148,
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
  `);
});

it("spec: 06-lists 1", () => {
  const pod = `
=begin pod
=item1  Animal
=item2     Vertebrate
=item2     Invertebrate

=item1  Phase
=item2     Solid
=item2     Liquid
=item2     Gas
=item2     Chocolate
=end pod

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "Animal
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 4,
                        "offset": 27,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 3,
                        "offset": 12,
                      },
                    },
                    "margin": "",
                    "text": "Animal
    ",
                    "type": "para",
                  },
                ],
                "level": "1",
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 27,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 3,
                    "offset": 12,
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
                          "Vertebrate
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 5,
                            "offset": 49,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 4,
                            "offset": 27,
                          },
                        },
                        "margin": "",
                        "text": "Vertebrate
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 5,
                        "offset": 49,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 4,
                        "offset": 27,
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
                          "Invertebrate
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 6,
                            "offset": 73,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 5,
                            "offset": 49,
                          },
                        },
                        "margin": "",
                        "text": "Invertebrate
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 6,
                        "offset": 73,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 5,
                        "offset": 49,
                      },
                    },
                    "margin": "",
                    "name": "item",
                    "type": "block",
                  },
                  Object {
                    "type": "blankline",
                  },
                ],
                "level": "2",
                "list": "itemized",
                "type": "list",
              },
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "Phase
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 88,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 7,
                        "offset": 74,
                      },
                    },
                    "margin": "",
                    "text": "Phase
    ",
                    "type": "para",
                  },
                ],
                "level": "1",
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 8,
                    "offset": 88,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 7,
                    "offset": 74,
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
                          "Solid
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 9,
                            "offset": 105,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 8,
                            "offset": 88,
                          },
                        },
                        "margin": "",
                        "text": "Solid
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 105,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 88,
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
                          "Liquid
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 10,
                            "offset": 123,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 9,
                            "offset": 105,
                          },
                        },
                        "margin": "",
                        "text": "Liquid
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 123,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 105,
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
                          "Gas
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 11,
                            "offset": 138,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 10,
                            "offset": 123,
                          },
                        },
                        "margin": "",
                        "text": "Gas
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 11,
                        "offset": 138,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 123,
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
                          "Chocolate
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 12,
                            "offset": 159,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 11,
                            "offset": 138,
                          },
                        },
                        "margin": "",
                        "text": "Chocolate
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 12,
                        "offset": 159,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 11,
                        "offset": 138,
                      },
                    },
                    "margin": "",
                    "name": "item",
                    "type": "block",
                  },
                ],
                "level": "2",
                "list": "itemized",
                "type": "list",
              },
            ],
            "level": "1",
            "list": "itemized",
            "type": "list",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 13,
            "offset": 168,
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
  `);
});

it("spec: 06-lists 2", () => {
  const pod = `
=begin pod
=comment CORRECT...
=begin item1
The choices are:
=end item1
=item2 Liberty
=item2 Death
=item2 Beer
=end pod

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
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
              "CORRECT...
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 32,
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
            "content": Array [
              Object {
                "config": Array [],
                "content": Array [
                  Object {
                    "content": Array [
                      "The choices are:
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 6,
                        "offset": 62,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 5,
                        "offset": 45,
                      },
                    },
                    "margin": "",
                    "text": "The choices are:
    ",
                    "type": "para",
                  },
                ],
                "level": "1",
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 7,
                    "offset": 73,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 32,
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
                          "Liberty
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 8,
                            "offset": 88,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 7,
                            "offset": 73,
                          },
                        },
                        "margin": "",
                        "text": "Liberty
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 88,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 7,
                        "offset": 73,
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
                          "Death
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 9,
                            "offset": 101,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 8,
                            "offset": 88,
                          },
                        },
                        "margin": "",
                        "text": "Death
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 101,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 88,
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
                          "Beer
    ",
                        ],
                        "location": Object {
                          "end": Object {
                            "column": 1,
                            "line": 10,
                            "offset": 113,
                          },
                          "start": Object {
                            "column": 1,
                            "line": 9,
                            "offset": 101,
                          },
                        },
                        "margin": "",
                        "text": "Beer
    ",
                        "type": "para",
                      },
                    ],
                    "level": "2",
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 113,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 9,
                        "offset": 101,
                      },
                    },
                    "margin": "",
                    "name": "item",
                    "type": "block",
                  },
                ],
                "level": "2",
                "list": "itemized",
                "type": "list",
              },
            ],
            "level": "1",
            "list": "itemized",
            "type": "list",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 11,
            "offset": 122,
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
  `);
});

it("spec: 06-lists 3", () => {
  const pod = `
=begin pod
Let's consider two common proverbs:

=begin item
I<The rain in Spain falls mainly on the plain.>

This is a common myth and an unconscionable slur on the Spanish
people, the majority of whom are extremely attractive.
=end item

=begin item
I<The early bird gets the worm.>

In deciding whether to become an early riser, it is worth
considering whether you would actually enjoy annelids
for breakfast.
=end item

As you can see, folk wisdom is often of dubious value.
=end pod

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "content": Array [
              "Let's consider two common proverbs:
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 48,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "text": "Let's consider two common proverbs:
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "config": Array [],
                "content": Array [
                  Object {
                    "content": Array [
                      Object {
                        "content": Array [
                          "The rain in Spain falls mainly on the plain.",
                        ],
                        "name": "I",
                        "type": "fcode",
                      },
                      "
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 7,
                        "offset": 109,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 6,
                        "offset": 61,
                      },
                    },
                    "margin": "",
                    "text": "I<The rain in Spain falls mainly on the plain.>
    ",
                    "type": "para",
                  },
                  Object {
                    "type": "blankline",
                  },
                  Object {
                    "content": Array [
                      "This is a common myth and an unconscionable slur on the Spanish
    people, the majority of whom are extremely attractive.
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 10,
                        "offset": 229,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 8,
                        "offset": 110,
                      },
                    },
                    "margin": "",
                    "text": "This is a common myth and an unconscionable slur on the Spanish
    people, the majority of whom are extremely attractive.
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 11,
                    "offset": 239,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 5,
                    "offset": 49,
                  },
                },
                "margin": "",
                "name": "item",
                "type": "block",
              },
              Object {
                "type": "blankline",
              },
              Object {
                "config": Array [],
                "content": Array [
                  Object {
                    "content": Array [
                      Object {
                        "content": Array [
                          "The early bird gets the worm.",
                        ],
                        "name": "I",
                        "type": "fcode",
                      },
                      "
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 14,
                        "offset": 285,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 13,
                        "offset": 252,
                      },
                    },
                    "margin": "",
                    "text": "I<The early bird gets the worm.>
    ",
                    "type": "para",
                  },
                  Object {
                    "type": "blankline",
                  },
                  Object {
                    "content": Array [
                      "In deciding whether to become an early riser, it is worth
    considering whether you would actually enjoy annelids
    for breakfast.
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 18,
                        "offset": 413,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 15,
                        "offset": 286,
                      },
                    },
                    "margin": "",
                    "text": "In deciding whether to become an early riser, it is worth
    considering whether you would actually enjoy annelids
    for breakfast.
    ",
                    "type": "para",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 19,
                    "offset": 423,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 12,
                    "offset": 240,
                  },
                },
                "margin": "",
                "name": "item",
                "type": "block",
              },
              Object {
                "type": "blankline",
              },
            ],
            "level": 1,
            "list": "itemized",
            "type": "list",
          },
          Object {
            "content": Array [
              "As you can see, folk wisdom is often of dubious value.
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 21,
                "offset": 479,
              },
              "start": Object {
                "column": 1,
                "line": 20,
                "offset": 424,
              },
            },
            "margin": "",
            "text": "As you can see, folk wisdom is often of dubious value.
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 22,
            "offset": 488,
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
  `);
});
