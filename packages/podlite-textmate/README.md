# @podlite/textmate

A TextMate grammar for [Podlite](https://podlite.org) markup. It colours directives,
block names, attributes and markup codes, keeps code and data blocks raw, and follows
the [Podlite specification 2.0](https://podlite.org/v2.0/specification).

The language is `podlite`, with `pod6` as an alias. The scope name is
`text.podlite`.

## Install

```sh
npm install @podlite/textmate shiki
```

## Use with shiki

```js
import { createHighlighter } from 'shiki'
import { podliteGrammar } from '@podlite/textmate'

const highlighter = await createHighlighter({ langs: [podliteGrammar], themes: ['github-dark'] })
const html = highlighter.codeToHtml(source, { lang: 'podlite', theme: 'github-dark' })
```

The grammar works with both regex engines of shiki, Oniguruma and the JavaScript one.

## The grammar as JSON

The same grammar is published as a file, for any TextMate highlighter:

```js
const grammar = require('@podlite/textmate/podlite.tmLanguage.json')
```

From Node without a bundler, take the grammar through `require` or this JSON file:
the ES module build is read by Node's syntax detection and prints a warning.

## Limits

TextMate grammars read one line at a time, and shiki never passes an empty line to
the grammar. So:

- a paragraph block of code, such as `=for code`, ends at the next directive or at a
  line of spaces, not at an empty line;
- after an empty line, an indented line goes on with the paragraph rather than
  starting a code block;
- a code or data block closes at `=end NAME` with an indent no deeper than its opener's;
- the body of `=begin markdown` and code with `:lang` are not highlighted with their
  own grammars, and `:allow` is not taken into account;
- a value in parentheses or braces that goes on over a continuation line, which the
  draft of specification 3.0 allows, is coloured on its first line only;
- in a link label, markup codes nested more than four deep make the label read as an address;
- a nested markup code left unclosed, as `I«` in `B<outer I«child> tail`, runs to the end
  of the block; specification 3.0 reads its angles as text of the enclosing code.
