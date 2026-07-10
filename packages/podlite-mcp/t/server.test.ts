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
})
