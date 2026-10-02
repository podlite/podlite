# @podlite/mcp

MCP server for [Podlite](https://podlite.org): gives AI agents and editors four tools to parse, validate, render, and structurally query Podlite documents.

## Connect

Add to your MCP client config (Claude Code, Cursor, and other MCP-compatible tools):

```json
{
  "mcpServers": {
    "podlite": {
      "command": "npx",
      "args": ["-y", "@podlite/mcp"]
    }
  }
}
```

Claude Code one-liner:

```bash
claude mcp add podlite -- npx -y @podlite/mcp
```

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `podlite_parse` | `text` | AST as JSON: typed blocks with `line`/`column` locations |
| `podlite_validate` | `text`, `files?` | `{ok, counts, problems[]}` — parse errors, lint rules, schema check |
| `podlite_render` | `text`, `format: html\|md`, `files?` | rendered document |
| `podlite_query` | `selector`, `text`, `format: podlite\|json\|html\|md`, `files?` | blocks matching a structural selector |

Selector examples for `podlite_query`:

```
head1                  all level-1 headings
code[:lang<python>]    code blocks with a :lang attribute
*[:tags~<draft>]       any block tagged draft
```

A structural break in generated markup comes back as a line-located problem, so an agent can regenerate and re-check instead of shipping a silently broken document.

## Scope notes

- The lint rule set is growing. A clean `podlite_validate` result means the source parses and passes current rules, not an exhaustive audit.
- `=include` is resolved only against the `files` a call gives to `podlite_render`, `podlite_query` or `podlite_validate`: a map from path to text, with paths relative to the document, which stands at the root of the map as `input.podlite`. The server reads no disk. Without `files` an include of another path is left as written and the answer names the paths it asks for (an include of `input.podlite` is the document itself, a cycle that brings nothing); with `files: {}` a missing file is an error. When blocks of the files are in the document, the answer of `podlite_render` and `podlite_query` names those files; `podlite_validate` answers with its report alone.
- Included text goes through the same conversion as any text. The server checks the arguments of a call; the caller answers for what the files contain.
- A selector of `podlite_query` that names a source of its own (`file:part.podlite | head1`, a mask such as `file:notes/*.podlite`, or `input.podlite` for the document itself) reads it from `files`, each file with its own includes; the answer says when `text` was not used as the document of the selection. An operand such as `in file:terms.podlite` is read from `files` too. A mask's `*` does not go down into a directory; `**` does. In json each block carries the file it comes from.
- Read-only: no tools mutate files.

## Links

- [Podlite specification](https://podlite.org/specification)
- [Podlite skills for AI agents](https://github.com/podlite/podlite-skills)
- [Monorepo](https://github.com/podlite/podlite)

## License

MIT
