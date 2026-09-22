# crew-code-mcp

Read-only MCP server exposing this repo (`crew` / HarvyXBOT) to any MCP-compatible IDE or AI
client. Runs locally, spawned directly by the client over stdio — it gets direct filesystem
access to this repo, no GitHub API and no token required.

**v1 is deliberately read-only.** Three tools: `list_files`, `read_file`, `search_code`. No file
writes, no shell execution. Every path is checked against the repo root and refused if it would
escape it (path-traversal guard), and it refuses to read binary files or anything over 200KB.

## Setup

```bash
cd mcp-server
npm install
```

## Connect it to a client

All MCP clients use roughly the same config shape — point `command`/`args` at this server with an
**absolute path** (adjust for your machine):

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
```json
{
  "mcpServers": {
    "crew-code": {
      "command": "node",
      "args": ["/Users/shahtabraiz/Desktop/crew/mcp-server/server.js"]
    }
  }
}
```
Restart Claude Desktop after editing.

### Claude Code
Either add to `.mcp.json` in the project root:
```json
{
  "mcpServers": {
    "crew-code": {
      "command": "node",
      "args": ["/Users/shahtabraiz/Desktop/crew/mcp-server/server.js"]
    }
  }
}
```
or run:
```bash
claude mcp add crew-code -- node /Users/shahtabraiz/Desktop/crew/mcp-server/server.js
```

### Cursor
Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):
```json
{
  "mcpServers": {
    "crew-code": {
      "command": "node",
      "args": ["/Users/shahtabraiz/Desktop/crew/mcp-server/server.js"]
    }
  }
}
```

## Point it at a different directory

By default it serves the repo it lives in (one level up from this folder). Override with
`MCP_ROOT_DIR` in the client config's `env` block if you want it to serve a different checkout.

## Smoke-test it yourself

```bash
node test-client.mjs
```
Spawns the server as a real MCP client would, lists tools, reads a real file, and confirms two
path-escape attempts are correctly rejected.

## What's NOT here yet

No write tools (can't edit files), no shell/code-execution tool. Those are a deliberately separate,
riskier step — this is the safe v1.
