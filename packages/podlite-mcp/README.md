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
| `podlite_validate` | `text` | `{ok, counts, problems[]}` — parse errors, lint rules, schema check |
| `podlite_render` | `text`, `format: html\|md` | rendered document |
| `podlite_query` | `selector`, `text`, `format: podlite\|json\|html\|md` | blocks matching a structural selector |

Selector examples for `podlite_query`:

```
head1                  all level-1 headings
code[:lang<python>]    code blocks with a :lang attribute
*[:tags~<draft>]       any block tagged draft
```

A structural break in generated markup comes back as a line-located problem, so an agent can regenerate and re-check instead of shipping a silently broken document.

## Scope notes

- The lint rule set is growing. A clean `podlite_validate` result means the source parses and passes current rules, not an exhaustive audit.
- `=include` blocks are not resolved: the server receives text without a file context.
- Read-only: no tools mutate files.

## Links

- [Podlite specification](https://podlite.org/specification)
- [Podlite skills for AI agents](https://github.com/podlite/podlite-skills)
- [Monorepo](https://github.com/podlite/podlite)

## License

MIT
