# AI Scaffolds

Goryu's CLI generates ready-to-wire LLM endpoints so you can start from a typed,
validated, streaming handler instead of a blank file. Every AI scaffold uses the
same batteries: typed request binding with [`goryu.Bind[T]`](/ja/core/binding),
input `Validate()`, JSON Schema via `goryu.Schema[T]`, and token accounting
through the [`aimeter`](/ja/ai/metering) middleware.

There are two ways in — a focused scaffold command and the general handler
generator:

```bash
# Focused: scaffolds an AI endpoint and prints the middleware wiring to add
goryu scaffold ai <name> --kind=chat|rag|agent

# General: the handler generator with the ai type
goryu generate handler <name> --type=ai --kind=chat|rag|agent
```

Both produce the same file. `scaffold ai` is a thin wrapper that additionally
prints the recommended middleware and `app.MountLLMs()` wiring afterwards.

## Features

- **Three kinds**: `chat` (streaming SSE chat), `rag` (retrieve-then-answer with
  sources), and `agent` (typed tool endpoint with a function-calling schema).
- **Typed and validated**: request types implement `Validate()` and are bound
  with `goryu.Bind[T]`, which returns a `400` on malformed or invalid input.
- **Self-describing**: each kind ships a schema route built from
  `goryu.Schema[T]()`, so clients and agents can discover the request shape.
- **Metered by default**: handlers call `aimeter.SetUsage` so the `aimeter`
  middleware can account tokens and cost.
- **Stubs, not magic**: the provider call is a clearly marked `TODO` — swap in a
  real model call (see the [Provider Proxy](/ja/ai/provider-proxy)).

## Usage

### Scaffold a chat endpoint

```bash
goryu scaffold ai chat --kind=chat
```

```
🤖 Scaffolding chat AI endpoint: chat
🚀 Generating ai handler: chat
✅ Handler created: internal/handlers/chat.go

💡 Handler Tips:
  • Register routes:
    - app.POST("/chat/stream", handlers.ChatStream)  // SSE token streaming
    - app.GET("/chat/schema", handlers.ChatSchema)   // JSON Schema
  • Meter tokens/cost: app.Use(aimeter.New(aimeter.Config{...}))
  • Cache prompts:     app.Use(promptcache.New())
  • Record for evals:  app.Use(recorder.New(recorder.Config{Sink: sink}))
  • Replace the stubbed reply with a real provider call (see aiproxy)

💡 Wire the AI middleware in your main.go:
  app.Use(aimeter.New(aimeter.Config{...}))     // token/cost metering
  app.Use(promptcache.New())                    // cache identical prompts
  app.Use(recorder.New(recorder.Config{Sink: sink})) // record for evals
  app.MountLLMs()                               // serve /llms.txt
```

::: tip The name is Go-identified
`chat` becomes the `Chat` prefix and the `/chat` route prefix; `my-bot` becomes
`MyBot` / `/my-bot`. Names may contain letters, digits, `-`, and `_`.
:::

### The three kinds

#### `chat` — streaming SSE chat

Generates a request/message model with `jsonschema` tags, a `Validate()` that
requires at least one message, an SSE streaming handler, and a schema route.

```go
type ChatMessage struct {
    Role    string `json:"role" jsonschema:"description=Speaker role,enum=system|user|assistant"`
    Content string `json:"content" jsonschema:"description=Message text,minLength=1"`
}

type ChatRequest struct {
    Model    string        `json:"model" jsonschema:"description=Model to use,enum=fast|smart"`
    Messages []ChatMessage `json:"messages" jsonschema:"description=Conversation so far"`
}

func (r ChatRequest) Validate() error { /* requires >= 1 message */ }

// POST /chat/stream — streams tokens over SSE, then reports usage.
func ChatStream(c *goryu.Context) {
    req, err := goryu.Bind[ChatRequest](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    // TODO: replace the stub with a real provider call and stream its tokens.
    _ = goryu.SSEJSON(c, "token", func(send func(ChatToken) error) error {
        // send(ChatToken{Index: i, Content: ...})
        return send(ChatToken{Index: n, Done: true})
    })

    aimeter.SetUsage(c, aimeter.Usage{PromptTokens: prompt, CompletionTokens: completion})
}

// GET /chat/schema — serves the JSON Schema for ChatRequest.
func ChatSchema(c *goryu.Context) {
    _ = c.JSON(200, goryu.Schema[ChatRequest]())
}
```

Tokens are emitted as `event: token` SSE frames of shape
`{"index":N,"content":"..."}`, terminated by `{"index":N,"done":true}`. Because
SSE responses are flushed as they stream, `aimeter`'s `X-Tokens-*` headers cannot
be set — usage is reported via `SetUsage` and surfaced through the metering
middleware's `OnResult` hook instead. See [Streaming](/ja/streaming/sse) and
[Token & Cost Metering](/ja/ai/metering).

#### `rag` — retrieve then answer, with sources

Generates a query type (`question` + optional `top_k`), a stub retriever, and a
handler that retrieves context, answers, and returns the sources it used.

```go
type AskQuery struct {
    Question string `json:"question" jsonschema:"description=User question,minLength=1"`
    TopK     int    `json:"top_k,omitempty" jsonschema:"description=Documents to retrieve,minimum=1,maximum=20"`
}

type AskAnswer struct {
    Answer  string      `json:"answer"`
    Sources []AskSource `json:"sources"` // {id, score, text}
}

// POST /ask — retrieves context for the question and answers with sources.
func AskAsk(c *goryu.Context) {
    q, err := goryu.Bind[AskQuery](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    sources := retrieveAsk(q.Question, topK) // TODO: replace stub with a vector-store query
    answer := "TODO: answer using the retrieved sources."

    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     questionTokens + contextTokens,
        CompletionTokens: answerTokens,
    })
    _ = c.JSON(200, AskAnswer{Answer: answer, Sources: sources})
}
```

`retrieve<Name>` is a stub that returns placeholder passages — replace it with a
query against your vector store. `TopK` defaults to `3` when omitted. Prompt
usage is metered as the question tokens plus the retrieved context tokens.

#### `agent` — typed tool endpoint + function-calling schema

Generates a typed tool with an `Input`/`Result` pair, an execution handler, and a
schema route that emits an OpenAI-style tool definition suitable for
function-calling.

```go
type SearchInput struct {
    Query string `json:"query" jsonschema:"description=What the tool should act on,minLength=1"`
}

type SearchResult struct {
    Output string `json:"output"`
}

// POST /tools/search — runs the tool and returns its result.
func SearchTool(c *goryu.Context) {
    in, err := goryu.Bind[SearchInput](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }
    // TODO: execute the tool for in.Query.
    _ = c.JSON(200, SearchResult{Output: "..."})
}

// GET /tools/search/schema — an OpenAI-style tool definition for function calling.
func SearchToolSchema(c *goryu.Context) {
    _ = c.JSON(200, goryu.Map{
        "name":        "search",
        "description": "TODO: describe what this tool does",
        "parameters":  goryu.Schema[SearchInput](),
    })
}
```

The schema route returns `{name, description, parameters}` — exactly the shape a
model expects in a `tools` array. Feed the JSON from `GET /tools/<name>/schema`
to your model, and route its tool call to `POST /tools/<name>`.

::: code-group

```bash [chat]
goryu scaffold ai support --kind=chat
```

```bash [rag]
goryu scaffold ai docs --kind=rag
```

```bash [agent]
goryu scaffold ai search --kind=agent
```

:::

## Flags

Both commands accept the same options for the AI type.

| Flag | Applies to | Description | Default |
|------|-----------|-------------|---------|
| `--kind` (`-k`) | both | `chat`, `rag`, or `agent` | `chat` |
| `--path` (`-p`) | both | Output directory | `internal/handlers` |
| `--type` (`-t`) | `generate handler` | Handler type; use `ai` for AI kinds | `basic` |

An unknown `--kind` is rejected:

```
$ goryu generate handler chat --type=ai --kind=vision
Error: unknown ai kind: vision (available: chat, rag, agent)
```

## After scaffolding

The generated file is a handler only — register the routes and wire the AI
middleware in your `main.go`.

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
    "github.com/arthurlch/goryu/middleware/promptcache"
    "github.com/arthurlch/goryu/middleware/recorder"

    "yourmodule/internal/handlers"
)

func main() {
    app := goryu.New()

    // AI middleware
    app.Use(aimeter.New(aimeter.Config{ // token/cost metering + per-key budgets
        PromptCostPer1K:     0.003,
        CompletionCostPer1K: 0.015,
    }))
    app.Use(promptcache.New())                            // cache identical prompts
    app.Use(recorder.New(recorder.Config{Sink: sink}))    // record for evals

    // Routes (printed in the CLI tips for each kind)
    app.POST("/chat/stream", handlers.ChatStream)
    app.GET("/chat/schema", handlers.ChatSchema)

    app.MountLLMs() // serve GET /llms.txt and GET /llms.json

    _ = app.Listen(":3000")
}
```

- [Token & Cost Metering](/ja/ai/metering) — account tokens and cost per request.
- [Prompt Cache](/ja/ai/prompt-cache) — cache identical (POST) prompts.
- [Eval Recording](/ja/ai/recording) — capture requests/responses for evals.
- [Provider Proxy](/ja/ai/provider-proxy) — replace the stubbed reply with a real
  provider call.
- [llms.txt & API Reference](/ja/ai/llms-txt) — `app.MountLLMs()` publishes a
  machine-readable index of your routes.

::: tip Discoverable by agents
Combine the `/schema` routes with [`app.MountLLMs()`](/ja/ai/llms-txt) and the
[`goryu mcp`](/ja/ai/mcp) server so a coding agent can find your endpoints, read
their request schemas, and call them without hand-written docs.
:::
