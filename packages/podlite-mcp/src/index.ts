import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const { version } = require('../package.json')

const notImplemented = (tool: string) => {
  throw new Error(`${tool}: not implemented`)
}

export const createServer = (): McpServer => {
  const server = new McpServer({ name: 'podlite', version })

  server.registerTool(
    'podlite_parse',
    {
      title: 'Parse Podlite',
      description: 'Parse Podlite source into its AST: a JSON tree of typed blocks with line/column locations.',
      inputSchema: {
        text: z.string().describe('Podlite source text'),
      },
    },
    async () => notImplemented('podlite_parse'),
  )

  server.registerTool(
    'podlite_validate',
    {
      title: 'Validate Podlite',
      description:
        'Check Podlite source: parse errors plus lint rules. The rule set is growing; a clean result means the source parses and passes current rules, not an exhaustive audit.',
      inputSchema: {
        text: z.string().describe('Podlite source text'),
      },
    },
    async () => notImplemented('podlite_validate'),
  )

  server.registerTool(
    'podlite_render',
    {
      title: 'Render Podlite',
      description: 'Render Podlite source to HTML or Markdown.',
      inputSchema: {
        text: z.string().describe('Podlite source text'),
        format: z.enum(['html', 'md']).describe('Output format'),
      },
    },
    async () => notImplemented('podlite_render'),
  )

  server.registerTool(
    'podlite_query',
    {
      title: 'Query Podlite',
      description:
        'Select blocks from Podlite source with a structural selector, e.g. "head1" or "*[:tags~<draft>]". Returns matches as Podlite source, JSON AST, HTML, or Markdown.',
      inputSchema: {
        selector: z.string().describe('Block selector'),
        text: z.string().describe('Podlite source text'),
        format: z.enum(['podlite', 'json', 'html', 'md']).describe('Output format'),
      },
    },
    async () => notImplemented('podlite_query'),
  )

  return server
}
