#!/usr/bin/env node
// crew-code-mcp — read-only MCP server exposing this repo to any MCP-compatible IDE/client.
// Runs locally via stdio; the calling client (Claude Desktop, Claude Code, Cursor, etc.)
// spawns this process and gets direct filesystem access to ROOT_DIR — no GitHub API, no token.
// Deliberately read-only in v1: list_files, read_file, search_code. No write tools.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(process.env.MCP_ROOT_DIR || path.join(__dirname, '..'))

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', '.wrangler', 'dist', 'build', 'coverage', '.open-next'])
const MAX_FILE_BYTES = 200_000
const MAX_LIST_RESULTS = 500
const MAX_SEARCH_RESULTS = 100

/** Resolve a client-supplied relative path against ROOT_DIR, refusing anything that escapes it. */
function resolveSafePath(relPath) {
  const cleaned = String(relPath || '').replace(/^\/+/, '')
  const resolved = path.resolve(ROOT_DIR, cleaned)
  if (resolved !== ROOT_DIR && !resolved.startsWith(ROOT_DIR + path.sep)) {
    throw new Error(`Path escapes the repo root: ${relPath}`)
  }
  return resolved
}

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

function looksBinary(buf) {
  const sample = buf.subarray(0, 8000)
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true
  }
  return false
}

const server = new Server(
  { name: 'crew-code', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_files',
      description: `List files in the crew repo (${path.basename(ROOT_DIR)}), optionally filtered by a substring match on the relative path. Excludes node_modules/.git/.next/build output.`,
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Substring to filter relative paths by, e.g. "components/" or ".ts"' },
          limit: { type: 'number', description: `Max results, default ${MAX_LIST_RESULTS}` },
        },
      },
    },
    {
      name: 'read_file',
      description: `Read a text file's contents by path relative to the repo root. Refuses to read outside the repo, binary files, or anything over ${MAX_FILE_BYTES} bytes.`,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the repo root, e.g. lib/bots/definitions.ts' },
        },
        required: ['path'],
      },
    },
    {
      name: 'search_code',
      description: 'Case-insensitive substring search across all text files in the repo. Returns matching file/line/text triples.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
          limit: { type: 'number', description: `Max results, default ${MAX_SEARCH_RESULTS}` },
        },
        required: ['query'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async ({ params: { name, arguments: args = {} } }) => {
  try {
    let result

    switch (name) {
      case 'list_files': {
        const limit = Math.min(Number(args.limit) || MAX_LIST_RESULTS, MAX_LIST_RESULTS)
        const filter = args.filter ? String(args.filter).toLowerCase() : null
        const files = []
        for await (const full of walk(ROOT_DIR)) {
          const rel = path.relative(ROOT_DIR, full)
          if (filter && !rel.toLowerCase().includes(filter)) continue
          files.push(rel)
          if (files.length >= limit) break
        }
        result = { root: path.basename(ROOT_DIR), count: files.length, truncated: files.length >= limit, files }
        break
      }

      case 'read_file': {
        if (!args.path) throw new Error('path is required')
        const full = resolveSafePath(args.path)
        const info = await stat(full).catch(() => null)
        if (!info || !info.isFile()) throw new Error(`Not a file: ${args.path}`)
        if (info.size > MAX_FILE_BYTES) {
          throw new Error(`File too large (${info.size} bytes, max ${MAX_FILE_BYTES}) — read a narrower slice isn't supported yet, ask for a specific section instead.`)
        }
        const buf = await readFile(full)
        if (looksBinary(buf)) throw new Error(`Refusing to read what looks like a binary file: ${args.path}`)
        result = { path: args.path, bytes: info.size, content: buf.toString('utf-8') }
        break
      }

      case 'search_code': {
        if (!args.query) throw new Error('query is required')
        const limit = Math.min(Number(args.limit) || MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS)
        const needle = String(args.query).toLowerCase()
        const matches = []
        for await (const full of walk(ROOT_DIR)) {
          if (matches.length >= limit) break
          const info = await stat(full).catch(() => null)
          if (!info || info.size > MAX_FILE_BYTES) continue
          const buf = await readFile(full).catch(() => null)
          if (!buf || looksBinary(buf)) continue
          const rel = path.relative(ROOT_DIR, full)
          const lines = buf.toString('utf-8').split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              matches.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 300) })
              if (matches.length >= limit) break
            }
          }
        }
        result = { query: args.query, count: matches.length, truncated: matches.length >= limit, matches }
        break
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`[crew-code-mcp] ready — root: ${ROOT_DIR}`)
