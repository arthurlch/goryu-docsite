# Building AI/LLM backends with Goryu

Go is where teams build the infrastructure in front of models: gateways, agent
servers, inference proxies, RAG APIs, and eval harnesses. That code needs the
things Go is good at — streaming, concurrency, tight latency, small binaries —
plus a handful of AI-specific concerns that every team ends up reinventing:
metering tokens and cost, caching identical prompts, forwarding to a provider
without leaking secrets, and recording exchanges for evals.

Goryu ships those batteries. They are ordinary `*goryu.Ctx` middleware and
helpers, so you compose them with the rest of your app and drop into raw
`net/http` whenever you need to.

## The AI toolbox

| Piece | What it does | Docs |
|-------|--------------|------|
| Token & cost metering | Account prompt/completion tokens, compute USD cost, enforce per-key request/token budgets | [/ai/metering](/ai/metering) |
| Prompt cache | Cache `POST` responses keyed on the request body, with a privacy guard | [/ai/prompt-cache](/ai/prompt-cache) |
| Provider proxy | Stream/forward to an upstream provider, stripping the caller's secrets | [/ai/provider-proxy](/ai/provider-proxy) |
| Eval recording | Append every request/response pair to NDJSON (or any sink) for evals | [/ai/recording](/ai/recording) |
| AI scaffolds | Generate a ready-to-run AI service skeleton | [/ai/scaffolds](/ai/scaffolds) |
| llms.txt & API reference | Expose your API to tools and LLMs at `/llms.txt` | [/ai/llms-txt](/ai/llms-txt) |
| MCP server | Serve your routes as Model Context Protocol tools | [/ai/mcp](/ai/mcp) |

These build on Goryu's core primitives that AI backends lean on heavily:

- [Typed streaming](/streaming/typed) — `SSEJSON[T]` streams typed tokens over
  Server-Sent Events, the shape most chat UIs expect.
- [Binding & validation](/core/binding) — `Bind[T]` decodes and validates the
  request body (via an optional `Validate()` hook) into a typed struct.
- [JSON Schema](/core/schema) — `Schema[T]()` derives a JSON Schema from your
  request type; hand it to an LLM as a response schema or to clients for
  validation.

## How they fit together

A production AI endpoint is usually a small stack of middleware wrapping one
handler:

```
recorder      → captures the exchange for evals (outermost)
  aimeter     → enforces budgets, accounts tokens & cost
    promptcache → serves identical prompts from cache (non-streaming routes)
      handler → binds the request, calls the model, reports usage
```

Order matters. The recorder sits outermost so it captures everything, including
cache hits and 429s. The meter runs next so budgets are enforced before any work
happens and usage is accounted after the handler returns. The prompt cache
wraps only the routes where caching is safe (non-streaming). The handler reports
token usage with `aimeter.SetUsage`, which both the meter and the recorder read.

## Walkthrough: the `aichat` service

The `examples/aichat` service wires all of these together into one runnable
program. It ships a fake local "LLM", so it runs with **no API keys**. Below is
the shape of that service, annotated.

### Typed request, validation, and schema

The request body is a plain struct with a `Validate()` hook and `jsonschema`
tags. `Bind[ChatRequest]` decodes and validates it; `Schema[ChatRequest]()`
turns the same type into a JSON Schema endpoint.

```go
type Message struct {
    Role    string `json:"role" jsonschema:"description=Speaker role,enum=system|user|assistant"`
    Content string `json:"content" jsonschema:"description=Message text,minLength=1"`
}

type ChatRequest struct {
    Model    string    `json:"model" jsonschema:"description=Model to use,enum=fast|smart"`
    Messages []Message `json:"messages" jsonschema:"description=Conversation so far"`
    Stream   bool      `json:"stream,omitempty"`
}

// Validate runs automatically inside Bind[ChatRequest].
func (r ChatRequest) Validate() error {
    if len(r.Messages) == 0 {
        return errors.New("messages: at least one message is required")
    }
    if r.Model != "fast" && r.Model != "smart" {
        return errors.New("model: must be 'fast' or 'smart'")
    }
    return nil
}
```

### The middleware stack

```go
func main() {
    app := goryu.New(goryu.Config{AppName: "aichat"})

    // Eval recording (outermost): capture every request/response pair.
    sink, err := recorder.NewFileSink("evals.jsonl")
    if err != nil {
        log.Fatalf("open eval sink: %v", err)
    }
    defer func() { _ = sink.Close() }()

    app.Use(recorder.New(recorder.Config{
        Sink:    sink,
        KeyFunc: apiKey,
        MetaFunc: func(c *goryu.Ctx) map[string]any {
            u, _ := aimeter.GetUsage(c) // usage the handler reported
            return map[string]any{"tokens": u.Total()}
        },
    }))

    // Metering + per-key limits: pricing + 60 req/min + 100k tokens/min.
    app.Use(aimeter.New(aimeter.Config{
        KeyGenerator:        apiKey,
        PromptCostPer1K:     0.0005,
        CompletionCostPer1K: 0.0015,
        MaxRequests:         60,
        MaxTokens:           100_000,
        Window:              time.Minute,
        OnResult: func(c *goryu.Ctx, r aimeter.Result) {
            log.Printf("meter key=%s tokens=%d cost=$%.5f", r.Key, r.Usage.Total(), r.CostUSD)
        },
    }))

    // Streaming endpoint: tokens over SSE. Not cached (streams pass through).
    app.POST("/chat/stream", chatStream)

    // Schema endpoint: hand this to an LLM as a response schema, or to clients.
    app.GET("/chat/schema", func(c *goryu.Ctx) {
        _ = c.JSON(200, goryu.Schema[ChatRequest]())
    })

    // Non-streaming endpoint, wrapped in the prompt cache: identical bodies
    // return the cached answer (see the X-Cache header) without re-running.
    cached := app.Group("", promptcache.New(promptcache.Config{
        Expiration: 5 * time.Minute,
    }))
    cached.POST("/chat", chat)

    // Optional: stream straight through to a real provider when configured.
    if base := os.Getenv("PROVIDER_BASE_URL"); base != "" {
        px := aiproxy.New(aiproxy.Config{
            BaseURL: base,
            APIKey:  os.Getenv("PROVIDER_API_KEY"),
        })
        app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
            if err := px.Stream(c, "/v1/chat/completions"); err != nil {
                log.Printf("proxy error: %v", err)
            }
        })
    }

    // Expose the API to tools and LLMs at /llms.txt and /llms.json.
    app.MountLLMs()

    log.Println("aichat listening on :3000")
    _ = app.Run(":3000")
}
```

### The handlers report usage

Both handlers call `aimeter.SetUsage` after producing the reply. That single
call feeds the meter (for cost and budget accounting) and the recorder's
`MetaFunc`.

```go
func chatStream(c *goryu.Ctx) {
    req, err := goryu.Bind[ChatRequest](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    words := strings.Fields(fakeReply(req))
    completion := 0

    // Typed tokens over SSE.
    _ = goryu.SSEJSON(c, "token", func(send func(Token) error) error {
        for i, w := range words {
            if err := send(Token{Index: i, Content: w + " "}); err != nil {
                return err
            }
            completion++
        }
        return send(Token{Index: len(words), Done: true})
    })

    // Report usage so aimeter/recorder can account it. On a streamed response
    // headers won't apply, but OnResult and the eval record still capture it.
    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     promptTokens(req),
        CompletionTokens: completion,
    })
}
```

### Try it

```sh
go run ./examples/aichat
```

::: code-group

```sh [stream]
curl -N -X POST localhost:3000/chat/stream \
     -H 'Content-Type: application/json' -H 'X-API-Key: demo' \
     -d '{"model":"fast","messages":[{"role":"user","content":"hello there"}]}'
```

```sh [non-streaming + cache]
# Send twice and watch X-Cache go MISS -> HIT.
curl -i -X POST localhost:3000/chat \
     -H 'Content-Type: application/json' -H 'X-API-Key: demo' \
     -d '{"model":"smart","messages":[{"role":"user","content":"ping"}]}'
```

```sh [schema]
curl localhost:3000/chat/schema
```

:::

::: tip
Typed binding is selected by `Content-Type: application/json`. `curl -d`
defaults to form encoding, so always pass the header on the chat routes.
:::

## Where to go next

- [Token & Cost Metering](/ai/metering)
- [Prompt Cache](/ai/prompt-cache)
- [Provider Proxy](/ai/provider-proxy)
- [Eval Recording](/ai/recording)
- [Typed Streaming](/streaming/typed) · [Binding & Validation](/core/binding) · [JSON Schema](/core/schema)
