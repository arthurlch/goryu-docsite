---
layout: home

hero:
  name: "Goryu"
  text: "Go backends, batteries included."
  tagline: "From a plain REST API to a full AI/LLM service — streaming-first, observable, and secure by default. Productive for humans, easy for LLMs to generate."
  image:
    src: https://i.ibb.co/YBfgFnG0/goryu-v3.png
    alt: Goryu Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why Goryu?
      link: /guide/why-goryu
    - theme: alt
      text: GitHub
      link: https://github.com/arthurlch/goryu

features:
  - icon: 🔋
    title: Batteries included
    details: 29+ middleware, DB, CLI, monitoring, health checks, graceful shutdown — wired together from day one. No assembly required.
  - icon: 🤖
    title: AI-native
    details: SSE & typed streaming, Bind[T] + JSON Schema, token/cost metering, prompt caching, provider proxying, and eval recording. Build LLM backends without hand-rolling the plumbing.
  - icon: 🔒
    title: Secure by default
    details: Security headers, CSRF, JWT & sessions with a unified invalidation seam, OAuth2/OIDC, passkeys, RBAC, and an audit log. On every response path.
  - icon: ⚡
    title: Blazing fast
    details: Radix-tree router and optimized middleware chains. As fast as Gin — with 10× more built in.
  - icon: 🧩
    title: LLM-friendly DX
    details: llms.txt + machine-readable API reference, an MCP server, and scaffolds for streaming chat, RAG, and agent tools. Great for coding agents and humans alike.
  - icon: 🎯
    title: No magic
    details: Explicit, readable Go. Read the source and understand it — no reflection soup, no hidden control flow.
---

<div class="home-section">

## One framework, two jobs — done well {#two-jobs}

A plain REST API must stay **dead simple** to write by hand. An AI backend needs
streaming, metering, and provider proxying as **first-class batteries**. Goryu
serves both, and never makes the simple case pay for the advanced one.

::: code-group

```go [Plain REST]
package main

import "github.com/arthurlch/goryu"

func main() {
    app := goryu.New(goryu.Config{AppName: "api"})

    app.GET("/health", func(c *goryu.Ctx) {
        _ = c.JSON(200, goryu.Map{"status": "ok"})
    })

    app.POST("/users", func(c *goryu.Ctx) {
        user, err := goryu.Bind[CreateUser](c) // parse + validate
        if err != nil {
            _ = c.JSON(400, goryu.Map{"error": err.Error()})
            return
        }
        _ = c.JSON(201, user)
    })

    app.Run(":3000")
}

type CreateUser struct {
    Email string `json:"email" jsonschema:"format=email"`
    Name  string `json:"name"  jsonschema:"minLength=1"`
}

func (u CreateUser) Validate() error { /* ... */ return nil }
```

```go [Streaming chat]
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
)

type Token struct {
    Content string `json:"content"`
    Done    bool   `json:"done,omitempty"`
}

func main() {
    app := goryu.New(goryu.Config{AppName: "chat"})

    // Token/cost metering + per-key limits, out of the box.
    app.Use(aimeter.New(aimeter.Config{
        PromptCostPer1K:     0.003,
        CompletionCostPer1K: 0.015,
    }))

    app.POST("/chat/stream", func(c *goryu.Ctx) {
        // Stream typed tokens over SSE.
        _ = goryu.SSEJSON(c, "token", func(send func(Token) error) error {
            for tok := range generate(c) {
                if err := send(Token{Content: tok}); err != nil {
                    return err
                }
            }
            return send(Token{Done: true})
        })
    })

    app.Run(":3000")
}
```

```go [AI provider proxy]
package main

import (
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/aiproxy"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

func main() {
    app := goryu.New()

    // Cache identical prompts (POST-aware, streaming-safe).
    app.Use(promptcache.New())

    px := aiproxy.New(aiproxy.Config{
        BaseURL: "https://api.openai.com",
        APIKey:  os.Getenv("OPENAI_API_KEY"),
    })

    // Stream straight through to the provider (SSE passthrough).
    app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
        _ = px.Stream(c, "/v1/chat/completions")
    })

    app.Run(":3000")
}
```

:::

</div>

<div class="home-section">

## Everything you'd otherwise wire by hand {#batteries}

<div class="battery-grid">

<div class="battery-card">

### 🌊 Streaming & realtime

`c.SSE` · `c.Stream` · typed `SSEJSON[T]` / `StreamJSON[T]` (NDJSON) · zero-dependency `websocket.Upgrade`.

[Explore streaming →](/streaming/)

</div>

<div class="battery-card">

### 🧠 AI batteries

`aimeter` (token/cost + limits) · `promptcache` · `aiproxy` · `recorder` (evals) · `Bind[T]` + `Schema[T]`.

[Build AI backends →](/ai/)

</div>

<div class="battery-card">

### 🔐 Auth & security

JWT + sessions (unified invalidation) · OAuth2/OIDC · passkeys/WebAuthn · RBAC · audit log · `security.txt`.

[Secure your app →](/security/)

</div>

<div class="battery-card">

### 🤝 LLM-friendly DX

`llms.txt` + machine-readable API reference · MCP server · `scaffold ai` (chat / RAG / agent tool).

[See the tooling →](/ai/llms-txt)

</div>

<div class="battery-card">

### 📈 Observability

Structured logging · Prometheus metrics · OpenTelemetry tracing · health checks · live monitoring UI.

[Monitor everything →](/monitoring/)

</div>

<div class="battery-card">

### 🛠️ Productivity

Radix router · route builder · config system · DB helpers · a real CLI with generators & scaffolds.

[Meet the CLI →](/cli)

</div>

</div>

</div>

<div class="home-section">

## As fast as Gin. With 10× more built in. {#performance}

```
BenchmarkGoryu_JSON-8         1,245,364 ops/sec    967.2 ns/op
BenchmarkGin_JSON-8           1,232,113 ops/sec    977.2 ns/op
BenchmarkGoryu_Param-8        2,036,600 ops/sec    593.3 ns/op
BenchmarkGin_Param-8          2,015,674 ops/sec    590.9 ns/op
```

The Go ecosystem was missing a framework with Rails/Phoenix ergonomics and Go's
raw speed. Goryu is built on a high-performance Radix-tree router and optimized
middleware chains, so you never trade productivity for performance.

</div>

<div class="home-section">

## Ship in three commands {#quickstart}

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
goryu init myapp --template=api
goryu scaffold ai chat --kind=chat   # streaming chat endpoint, wired up
```

<div class="home-cta">

[Get started in 5 minutes →](/guide/getting-started)

</div>

</div>

<div class="home-section">

## Principles {#philosophy}

1. **The simple case stays simple.** A hand-written REST API never pays for AI features it doesn't use.
2. **Built for humans first; friendly to LLMs second.** The same clean API serves both.
3. **Secure by default, on every response path.** Not an afterthought, not opt-in.
4. **Streaming is a first-class citizen.**
5. **The core stays small and stable; breadth lives in contrib.**
6. **If an LLM can't reliably generate correct Goryu code, the API is too clever.**

</div>
