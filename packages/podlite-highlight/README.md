# @podlite/highlight

Syntax highlighting for Podlite code blocks. The renderer (`@podlite/to-jsx`) and
the editor (`@podlite/editor-react`) both take it from here, so a document looks
the same in a preview as it does in an editor.

## Install

```sh
npm install @podlite/highlight shiki
```

`shiki` is a peer, declared optional so it is never pulled in unnoticed. What
that does and does not buy you:

- **Types.** This package describes the parts of shiki it uses, so type checking
  passes with shiki absent.
- **Bundling.** The loader names `shiki` in a plain dynamic import, which lets a
  bundler split it into its own chunk. That same plain name has to resolve at
  build time, so install shiki if you bundle this package.
- **Runtime.** If the chunk fails to load after a successful build, say over a
  bad network, the component renders the code as plain `<pre><code>` instead of
  throwing. This does not cover a missing install: without shiki the bundle
  never gets built, so the fallback is never reached.

A block with no `:lang` never loads a grammar at all.

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
