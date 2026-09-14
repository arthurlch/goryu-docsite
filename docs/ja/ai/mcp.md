# MCP Server

`goryu mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes Goryu's project tooling to AI agents. It speaks JSON-RPC 2.0
over stdio, so any MCP-capable client — Claude Code, an IDE agent, or your own
harness — can list your routes, scaffold handlers, and start a dev server from
inside the project directory.

```bash
goryu mcp
```

The process reads one JSON-RPC request per line on stdin and writes one response
per line on stdout. It runs until stdin closes (EOF).

## Features

- **Standard transport**: JSON-RPC 2.0 over stdio, protocol version
  `2024-11-05` — works with any MCP client.
- **Project-aware**: tools operate on the current working directory (your Goryu
  project).
- **Three tools**: `list_routes`, `scaffold_handler`, and `run_dev_server`.
- **Safe scaffolding**: output paths must be relative and may not escape the
  project (`..` and absolute paths are rejected).

## Tools

| Tool | Arguments | Description |
|------|-----------|-------------|
| `list_routes` | — | List the HTTP routes discovered in the current project. |
| `scaffold_handler` | `name` (required), `type`, `kind`, `path` | Generate a handler. `type` ∈ `basic\|crud\|api\|ai`; for `ai`, `kind` ∈ `chat\|rag\|agent`. |
| `run_dev_server` | `port` | Start the dev server in the background; returns its PID and log file. |

Defaults for `scaffold_handler`: `type=ai`, `kind=chat`, `path=internal/handlers`.
`run_dev_server` defaults to `port=3000`, starts with hot-reload disabled, and
writes output to `goryu-dev.log`.

## Usage

### Point an MCP client at it

Configure your client to launch `goryu mcp` with the working directory set to
your project. For **Claude Code**, add it to your MCP config:

```json
{
  "mcpServers": {
    "goryu": {
      "command": "goryu",
      "args": ["mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

Or register it with the Claude Code CLI:

```bash
claude mcp add goryu -- goryu mcp
```

Most IDE agents use the same `command` / `args` / `cwd` shape. The key is that
`goryu mcp` must run **in the project directory** — its tools discover routes and
write handlers relative to the current working directory.

::: tip Make `goryu` available
Install the CLI so it's on your `PATH`: `go install github.com/arthurlch/goryu/cmd/goryu@latest`.
If it isn't on `PATH`, use the absolute path to the binary as `command`.
:::

### Try it by hand

The protocol is line-oriented, so you can drive it with `echo` and a pipe. Send
`initialize`, then call a tool:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | goryu mcp
```

## JSON-RPC examples

### initialize

Request:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {} }
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "goryu", "version": "0.1.0" }
  }
}
```

### tools/list

Request:

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

Response (abbreviated):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_routes",
        "description": "List the HTTP routes discovered in the current goryu project.",
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "scaffold_handler",
        "description": "Generate a handler in the current project. Supports type=ai with kind=chat|rag|agent.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "type": { "type": "string", "enum": ["basic", "crud", "api", "ai"] },
            "kind": { "type": "string", "enum": ["chat", "rag", "agent"] },
            "path": { "type": "string" }
          },
          "required": ["name"]
        }
      },
      {
        "name": "run_dev_server",
        "description": "Start the project's dev server in the background; returns its PID and log file.",
        "inputSchema": {
          "type": "object",
          "properties": { "port": { "type": "string" } }
        }
      }
    ]
  }
}
```

### tools/call

Scaffold a streaming chat handler:

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "scaffold_handler",
    "arguments": { "name": "support", "type": "ai", "kind": "chat" }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "🚀 Generating ai handler: support\n✅ Handler created: internal/handlers/support.go\n..." }
    ],
    "isError": false
  }
}
```

Tool results follow the MCP shape: a `content` array of `{type, text}` blocks and
an `isError` flag. When a tool fails (e.g. a missing `name`, or a `path`
containing `..`), the failure is reported as a tool result with `"isError": true`
rather than a JSON-RPC error.

## Notes

- **Notifications** (requests without an `id`, such as `notifications/initialized`)
  are processed but produce no response, per JSON-RPC.
- **Unknown methods** return a JSON-RPC error with code `-32601`; unknown tools
  and bad params return `-32602`.
- `ping` is supported and returns an empty result.
- Human-facing generator output is captured internally so it never corrupts the
  JSON-RPC stream on stdout.

::: warning One project per server
The tools operate on the current working directory. Run a separate `goryu mcp`
process per project, each launched with the right `cwd`.
:::

## See also

- [AI Scaffolds](/ja/ai/scaffolds) — what `scaffold_handler` generates for each
  `kind`.
- [llms.txt & API Reference](/ja/ai/llms-txt) — publish a machine-readable route
  index the same agents can read at runtime.
