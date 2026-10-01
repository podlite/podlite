import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../src/index'

describe('podlite mcp server', () => {
  it('lists the four podlite tools', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = createServer()
    const client = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const { tools } = await client.listTools()
    expect(tools.map(t => t.name).sort()).toEqual([
      'podlite_parse',
      'podlite_query',
      'podlite_render',
      'podlite_validate',
    ])
    await client.close()
    await server.close()
  })

  const call = async (name: string, args: Record<string, unknown>) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = createServer()
    const client = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result: any = await client.callTool({ name, arguments: args })
    await client.close()
    await server.close()
    return { isError: Boolean(result.isError), texts: result.content.map((c: { text: string }) => c.text) }
  }
  const doc = '=begin pod\n=include file:part.podlite\n=end pod\n'

  it('answers with the output alone when nothing is included and nothing goes wrong', async () => {
    const { isError, texts } = await call('podlite_render', { text: '=begin pod\n=para x\n=end pod\n', format: 'md' })
    expect([isError, texts.length]).toEqual([false, 1])
  })

  it('puts the output first and the files included after it', async () => {
    const { isError, texts } = await call('podlite_render', {
      text: doc,
      format: 'md',
      files: { 'part.podlite': '=begin pod\n=para From part\n=end pod\n' },
    })
    expect([isError, texts.length, texts[1]]).toEqual([false, 2, 'included from files: part.podlite'])
    expect(texts[0]).toContain('From part')
  })

  it('marks an answer that lost included content an error and puts the problems first', async () => {
    const { isError, texts } = await call('podlite_render', { text: doc, format: 'md', files: {} })
    expect([isError, texts[0]]).toEqual([true, 'input.podlite:2: include target not found: part.podlite'])
  })

  it('keeps an answer without files a success with one note after the output', async () => {
    const { isError, texts } = await call('podlite_query', { selector: 'include', text: doc, format: 'podlite' })
    expect([isError, texts]).toEqual([
      false,
      ['=include file:part.podlite', 'files were not given; includes not assembled: part.podlite'],
    ])
  })

  it('gives the paths asked for without files with the other warnings, in one part after the output', async () => {
    const { isError, texts } = await call('podlite_render', {
      text: '=begin pod\n=include doc:Other\n\n=include file:part.podlite\n=end pod\n',
      format: 'md',
    })
    expect([isError, texts.length]).toEqual([false, 2])
    expect(texts[1].split('\n')).toEqual([
      'input.podlite:2: include scheme is not supported: doc:',
      'files were not given; includes not assembled: part.podlite',
    ])
  })

  it('gives a warning of the assembly after the output', async () => {
    const { isError, texts } = await call('podlite_render', {
      text: '=begin pod\n=include doc:Other\n=end pod\n',
      format: 'md',
      files: {},
    })
    expect([isError, texts.length]).toEqual([false, 2])
  })
})
