import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseSource, querySource, renderReport, validateSource } from './tools'
import type { AssemblyReport } from './tools'

const { version } = require('../package.json')

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

const textResult = (text: string): ToolResult => ({ content: [{ type: 'text', text }] })

const errorResult = (e: unknown): ToolResult => ({
  content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
  isError: true,
})

// The output, then the problems of the assembly, then what was included. A
// problem that lost included content marks the answer an error and comes first.
const assembledResult = (output: string, report: AssemblyReport): ToolResult => {
  const problems = report.problems.length ? [{ type: 'text' as const, text: report.problems.join('\n') }] : []
  const notes = report.notes.map(note => ({ type: 'text' as const, text: note }))
  const shown = { type: 'text' as const, text: output }
  return report.error
    ? { content: [...problems, shown, ...notes], isError: true }
    : { content: [shown, ...problems, ...notes] }
}

const files = z
  .record(z.string(), z.string())
  .optional()
  .describe(
    'Texts the document includes, by path relative to the document. The document itself stands at the root of this set under the name input.podlite, which a key may not take. Without this field the includes are left as written and the paths they ask for are named. Included text goes through the same conversion as any text; the server checks these arguments, and the caller answers for what the files contain.',
  )

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
        files,
      },
    },
    async ({ text, files }) => {
      try {
        return textResult(JSON.stringify(validateSource(text, files), null, 2))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  server.registerTool(
    'podlite_render',
    {
      title: 'Render Podlite',
      description: 'Render Podlite source to HTML or Markdown.',
      inputSchema: {
        text: z.string().describe('Podlite source text'),
        format: z.enum(['html', 'md']).describe('Output format'),
        files,
      },
    },
    async ({ text, format, files }) => {
      try {
        const report = renderReport(text, format, files)
        return assembledResult(report.output, report)
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
        files,
      },
    },
    async ({ selector, text, format, files }) => {
      try {
        const report = querySource(selector, text, format, files)
        return assembledResult(report.matchCount === 0 ? 'No matches.' : report.output, report)
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  return server
}
