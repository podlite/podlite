import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './index'

const main = async () => {
  await createServer().connect(new StdioServerTransport())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
