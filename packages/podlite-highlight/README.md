# @podlite/highlight

Syntax highlighting for Podlite code blocks. The renderer (`@podlite/to-jsx`) and
the editor (`@podlite/editor-react`) both take it from here, so a document looks
the same in a preview as it does in an editor.

## Install

```sh
npm install @podlite/highlight shiki
```

`shiki` is an optional peer. Without it the component renders the code as plain
`<pre><code>` and nothing throws — install it when you want colour.

## Use

```jsx
import { HighlightedCode } from '@podlite/highlight'

<HighlightedCode node={node} ctx={ctx} keyProp={key} wrap="block">
  {children}
</HighlightedCode>
```

A block with no `:lang` attribute is not highlighted: nothing declares what the
code is, so no grammar is loaded for it.

Grammars load one at a time, when a block asks for one.
