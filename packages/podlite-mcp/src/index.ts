import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseSource, querySource, renderSource, validateSource } from './tools'

const { version } = require('../package.json')

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

const textResult = (text: string): ToolResult => ({ content: [{ type: 'text', text }] })

const errorResult = (e: unknown): ToolResult => ({
  content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
  isError: true,
})

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
    async ({ text }) => {
      try {
        return textResult(JSON.stringify(parseSource(text), null, 2))
      } catch (e) {
        return errorResult(e)
      }
    },
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
    async ({ text }) => textResult(JSON.stringify(validateSource(text), null, 2)),
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
    async ({ text, format }) => {
      try {
        return textResult(renderSource(text, format))
      } catch (e) {
        return errorResult(e)
      }
    },
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
    async ({ selector, text, format }) => {
      try {
        const report = querySource(selector, text, format)
        if (report.matchCount === 0) {
          return textResult('No matches.')
        }
        return textResult(report.output)
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  return server
}
