# llms.txt & API Reference

Goryu can publish a machine-readable index of your HTTP API so that coding
agents, LLM clients, and other tools can discover your endpoints without you
writing docs by hand. One call — `app.MountLLMs()` — serves two documents built
from your live router:

- `GET /llms.txt` — an [llms.txt](https://llmstxt.org) Markdown document.
- `GET /llms.json` — the same information as structured JSON.

Both are generated from the routes you actually registered, so they never drift
from your code.

## Features

- **Zero maintenance**: the reference is derived from the router at request time.
- **Two formats**: human/LLM-friendly Markdown (`llms.txt`) and machine-readable
  JSON (`llms.json`).
- **Named routes**: route names, when set, appear as endpoint descriptions.
- **Programmatic access**: build the same data in Go with `app.APIReference()`
  or render the Markdown with `app.LLMsText()`.

## Usage

### Mount the endpoints

Call `MountLLMs()` **after** your routes are defined, so it captures the full set.

```go
package main

import "github.com/arthurlch/goryu"

func main() {
    app := goryu.New(goryu.Config{AppName: "Acme API"})

    app.GET("/health", healthHandler)
    app.POST("/chat/stream", chatStream)
    app.GET("/chat/schema", chatSchema)

    app.MountLLMs() // registers GET /llms.txt and GET /llms.json

    _ = app.Listen(":3000")
}
```

`AppName` from your `goryu.Config` becomes the document title; if unset it
defaults to `API`.

### `GET /llms.txt`

Served as `text/plain`, following the [llms.txt](https://llmstxt.org)
convention — a title, a `>` summary, and a list of endpoints:

```bash
curl http://localhost:3000/llms.txt
```

```text
# Acme API

> Acme API — HTTP API built with goryu, exposing 5 endpoints.

## Endpoints

- `GET /health`
- `POST /chat/stream` — ChatStream
- `GET /chat/schema` — ChatSchema
- `GET /llms.txt`
- `GET /llms.json`
```

The trailing `— Name` on each line is the route's name (from your route
registration), used as a short description when present.

### `GET /llms.json`

The same reference as JSON, matching the `APIReference` type:

```bash
curl http://localhost:3000/llms.json
```

```json
{
  "name": "Acme API",
  "summary": "Acme API — HTTP API built with goryu, exposing 5 endpoints.",
  "routes": [
    { "method": "GET",  "path": "/health" },
    { "method": "POST", "path": "/chat/stream", "name": "ChatStream" },
    { "method": "GET",  "path": "/chat/schema", "name": "ChatSchema" },
    { "method": "GET",  "path": "/llms.txt" },
    { "method": "GET",  "path": "/llms.json" }
  ]
}
```

### Build the reference in Go

You don't have to serve the endpoints to use the data. `APIReference()` returns
the structured reference, and `LLMsText()` returns the rendered Markdown.

```go
ref := app.APIReference()
fmt.Println(ref.Name)          // "Acme API"
fmt.Println(len(ref.Routes))   // number of registered routes
for _, r := range ref.Routes {
    fmt.Printf("%s %s %s\n", r.Method, r.Path, r.Name)
}

markdown := app.LLMsText() // the exact body served at /llms.txt
```

This is useful for writing the reference to a file at build time, embedding it in
a status page, or feeding it to another tool.

## Types

`APIReference` and `APIRoute` are exported from the `goryu` package.

```go
type APIRoute struct {
    Method string `json:"method"`
    Path   string `json:"path"`
    Name   string `json:"name,omitempty"`
}

type APIReference struct {
    Name    string     `json:"name"`
    Summary string     `json:"summary"`
    Routes  []APIRoute `json:"routes"`
}
```

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `app.APIReference()` | `APIReference` | Structured reference built from the router |
| `app.LLMsText()` | `string` | The `llms.txt` Markdown body |
| `app.MountLLMs()` | — | Serves `GET /llms.txt` and `GET /llms.json` |

## Why it helps agents and clients

`llms.txt` is a proposed convention (see [llmstxt.org](https://llmstxt.org)) for
giving LLMs a concise, curated entry point to a site or service. For a Goryu API
it turns your service into something an agent can reason about:

- **Discovery**: a coding agent can `GET /llms.txt` to learn every route, method,
  and name — no OpenAPI file or scraping required.
- **Grounding**: point an assistant at `/llms.txt` before it writes a client, and
  it will call the endpoints that actually exist rather than hallucinating them.
- **Tooling**: `/llms.json` is trivial to parse, so IDEs, dashboards, or client
  generators can consume it directly.

::: tip Pair with request schemas and MCP
Serve a `/schema` route (via `goryu.Schema[T]`, as the [AI
scaffolds](/ja/ai/scaffolds) do) alongside `MountLLMs()` so agents can discover both
the endpoints *and* their request shapes. For an interactive workflow, run the
[`goryu mcp`](/ja/ai/mcp) server so agents can list routes and scaffold handlers
directly.
:::

::: warning Mount after routes, and mind exposure
`MountLLMs()` only reflects routes registered before it runs — call it last.
Since it publishes your route map, gate it behind auth or restrict it to internal
networks if your API surface is sensitive.
:::
