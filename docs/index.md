---
layout: home

hero:
  name: "Goryu"
  text: "The Go backend your AI gets right the first time."
  tagline: "Describe the API — your agent builds it on Goryu, it compiles, and it's production-safe. Batteries-included, secure by default, and no-magic readable, so you can trust what your agent ships, not just run it."
  image:
    src: /logo.webp
    alt: Goryu logo
  actions:
    - theme: brand
      text: Build one with an agent
      link: /guide/getting-started
    - theme: alt
      text: Why Goryu?
      link: /guide/why-goryu
    - theme: alt
      text: GitHub
      link: https://github.com/arthurlch/goryu

features:
  - icon: 🎯
    title: Agents get it right the first time
    details: A small, regular API constrains codegen — fewer ways to call it means fewer ways to get it wrong. Go's compiler rejects the rest on the spot. If an LLM can't reliably write correct Goryu, the API is too clever — so it isn't.
  - icon: 🔒
    title: Secure by default
    details: Security headers, CSRF, JWT & sessions with unified invalidation, OAuth2/OIDC, passkeys, RBAC, and an audit log — on every response path. The agent physically can't skip the security basics.
  - icon: 🔋
    title: Batteries included, few dependencies
    details: Router, DB, validation, monitoring, health checks, graceful shutdown — wired from day one. Fewer libraries means fewer versions and APIs for an agent to hallucinate. One binary, zero assembly.
  - icon: 🔍
    title: No magic — readable enough to trust
    details: Explicit, readable Go. No reflection soup, no hidden control flow. You — or a non-technical reviewer — can read what the agent shipped and believe it's safe to deploy.
  - icon: 🤖
    title: AI-native
    details: SSE & typed streaming, Bind[T] + JSON Schema, token/cost metering, prompt caching, provider proxying, and eval recording. Build LLM backends without hand-rolling the plumbing.
  - icon: ⚡
    title: As fast as Gin
    details: Radix-tree router and optimized middleware chains — Gin-class throughput with 10× more built in. The simple REST case never pays for features it doesn't use.
---

<div class="home-section">

## Describe it. Your agent builds it. It compiles — and it's safe to ship. {#agentic}

You don't hand-write boilerplate anymore — you direct an agent. So the framework's
job changed: it's no longer just pleasant to *type*, it has to be the thing your
agent **generates correctly** and that you can **read well enough to trust**.

Goryu is built for exactly that. The API is small and regular, so a coding agent
has few wrong turns to take. It's Go, so the compiler catches the rest before you
ever run it. And it's secure by default, so the one thing agents reliably get
wrong — the security basics — is handled whether the agent thinks about it or not.

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

## Why this matters now {#why-now}

Agents freeballing raw `net/http` produce a different shape every time, with
different security gaps, and nobody can review fifty bespoke services by hand.
Goryu makes agent output **uniform, safe, and auditable** — so the person
directing the agent can actually ship it.

<div class="battery-grid">

<div class="battery-card">

### 🎯 Right the first time

A regular, predictable API constrains what an agent can generate, so it generates correct Goryu. The compiler catches the rest before you run it.

[Why Goryu →](/guide/why-goryu)

</div>

<div class="battery-card">

### 🔍 Trust what it ships

No magic, no reflection, no hidden control flow. Read the agent's output end to end and understand every line — even if you're not the one who wrote it.

[See the core →](/core/context)

</div>

<div class="battery-card">

### 🔐 Safe without thinking about it

JWT + sessions (unified invalidation) · OAuth2/OIDC · passkeys/WebAuthn · RBAC · audit log · security headers · CSRF. On every response path.

[Secure your app →](/security/)

</div>

<div class="battery-card">

### 🤖 Self-describing to the next agent

`llms.txt` + machine-readable API reference (`App.MountLLMs`) · an MCP server (`goryu mcp`) · AI scaffolds. The next agent that touches your app already knows its shape.

[See the tooling →](/ai/llms-txt)

</div>

</div>

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

## A CLI that does the boring parts — and feeds your agent {#cli}

Goryu ships a real CLI — scaffold a project, generate handlers/models/middleware,
run a hot-reloading dev server, inspect your routes, and expose your project to
AI agents over **MCP**. It generates idiomatic Goryu code, so a human and a coding
agent produce the same clean, reviewable output.

```bash
# Scaffold a project and start building
goryu init myapp --template=api
goryu generate handler users --type=crud
goryu scaffold ai assistant --kind=rag     # a RAG endpoint, fully wired

# Develop, inspect, ship
goryu dev --port 8080                       # hot-reloading dev server
goryu routes list                           # inspect the route table
goryu build --static                        # production binary

# Let AI agents drive your project
goryu mcp                                    # MCP server (list routes, scaffold, run)
```

<div class="home-cta">

[Explore the CLI →](/cli)

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

Built on a high-performance Radix-tree router and optimized middleware chains, so
you never trade productivity — or the readability your agent depends on — for
performance.

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

1. **If an LLM can't reliably generate correct Goryu code, the API is too clever.** The regular, predictable API is a feature for people and agents alike.
2. **Built to be directed, not just typed.** The same clean API serves the human reviewing and the agent writing.
3. **No magic.** Read the source and understand it — because trusting what ships now matters more than typing it.
4. **Secure by default, on every response path.** Not an afterthought, not opt-in.
5. **The simple case stays simple.** A hand-written REST API never pays for AI features it doesn't use.
6. **The core stays small and stable; breadth lives in contrib.**

</div>
