import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js'],
})

const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
await client.connect(transport)

console.log('=== tools/list ===')
const tools = await client.listTools()
console.log(tools.tools.map((t) => t.name))

console.log('\n=== list_files (filter: lib/bots) ===')
const list = await client.callTool({ name: 'list_files', arguments: { filter: 'lib/bots' } })
console.log(list.content[0].text)

console.log('\n=== read_file (lib/bots/types.ts) ===')
const read = await client.callTool({ name: 'read_file', arguments: { path: 'lib/bots/types.ts' } })
console.log(JSON.parse(read.content[0].text).content.slice(0, 200), '...')

console.log('\n=== read_file path traversal attempt (should error) ===')
const escape = await client.callTool({ name: 'read_file', arguments: { path: '../../../etc/passwd' } })
console.log(escape.content[0].text, 'isError:', escape.isError)

console.log('\n=== read_file absolute-path escape attempt (should error) ===')
const escape2 = await client.callTool({ name: 'read_file', arguments: { path: '/etc/passwd' } })
console.log(escape2.content[0].text, 'isError:', escape2.isError)

console.log('\n=== search_code (query: SOCIAL_INSTRUCTIONS) ===')
const search = await client.callTool({ name: 'search_code', arguments: { query: 'SOCIAL_INSTRUCTIONS', limit: 5 } })
console.log(search.content[0].text)

await client.close()
process.exit(0)
