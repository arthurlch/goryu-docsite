# Why Goryu

Goryu is a batteries-included Go framework for building backends — from simple hand-written REST APIs to AI/LLM services — that is productive for humans and easy for LLMs to generate. It is streaming-first, observable, and secure by default.

Two things are true at once, and Goryu serves both. Humans still write code, so a plain REST API must stay dead simple to build by hand, with Rails/Phoenix ergonomics. And Go is also where people build AI/LLM backends — gateways, agent servers, inference proxies — so Goryu ships the primitives those need as batteries.

## The Problem

The Go ecosystem has excellent routers, but no Rails/Phoenix-style, batteries-included framework that carries you all the way to production. You assemble the router, validation, error handling, logging, health checks, metrics, and graceful shutdown yourself.

Building an AI/LLM backend is worse. Today that means hand-rolling the same infrastructure over and over:

- **SSE / streaming** token responses, wired correctly with flushing and backpressure.
- **Token and cost metering** per request, with per-key and per-token budgets.
- **Prompt-keyed response caching** — caching `POST` bodies, not URLs.
- **Provider proxying** for upstream LLM APIs, streamed through to the client.
- **Eval recording** to capture request/response pairs for offline evaluation.

None of this is novel, but every team rebuilds it, and gets the edge cases wrong.

## What Goryu Gives You

Out of the box, with `goryu.New()`, you get health checks, metrics, structured logging, and graceful shutdown — no setup. A handler is just a function, and typed input with validation is one call (`goryu.Bind[T]`).

When you need them — and only then — the AI primitives are there:

- **First-class streaming**: `c.SSE(...)` and `c.Stream(...)`, plus typed streaming JSON (`goryu.StreamJSON[T]`, `goryu.SSEJSON[T]`) and a WebSocket helper (`websocket.Upgrade`).
- **[Token & cost metering](/middleware/aimeter)**: `middleware/aimeter` — per-key/per-token rate limiting and USD cost accounting.
- **[Prompt cache](/middleware/promptcache)**: `middleware/promptcache` — body-keyed response caching for LLM endpoints, plus a streaming reverse-proxy helper (`aiproxy`).
- **[Eval recording](/middleware/recorder)**: `middleware/recorder` — capture request/response pairs as NDJSON for eval datasets.
- **LLM-friendly DX**: `llms.txt` and a machine-readable API reference (`App.MountLLMs`), an MCP server (`goryu mcp`), and AI scaffolds (`goryu scaffold ai <name> --kind=chat|rag|agent`).

These are additive. A hand-written REST app never pays for AI features it does not use.

## How Goryu Compares

Goryu is not "just another fast router" — Gin, Fiber, Echo, and Chi own that space. Goryu's edge is being genuinely great for **both** a plain REST service and an AI backend, without making the simple case complicated.

| | Goryu | Gin | Fiber | Echo | Chi |
|---|---|---|---|---|---|
| Fast router | Yes | Yes | Yes | Yes | Yes |
| Batteries-included (health, metrics, logging, graceful shutdown) | Yes | No | Partial | Partial | No |
| CLI + scaffolding | Yes | No | No | No | No |
| Streaming-first (SSE, typed streaming, WebSocket) | Yes | Manual | Manual | Manual | Manual |
| Built-in token/cost metering | Yes | No | No | No | No |
| Prompt-keyed cache + provider proxy | Yes | No | No | No | No |
| Eval recording | Yes | No | No | No | No |
| Secure by default (on every response path) | Yes | No | No | No | No |
| LLM-friendly (`llms.txt`, MCP server) | Yes | No | No | No | No |

The honest summary: for a plain REST API, Goryu is as fast as Gin with far more built in. For an AI backend, the pieces you would otherwise hand-roll are already batteries — and the simple case stays simple.

## Principles

1. **The simple case stays simple** — a hand-written REST API must never pay for AI features it doesn't use.
2. **Built for humans first; friendly to LLMs second** — the same clean API serves both.
3. **Secure by default, on every response path.**
4. **Streaming is a first-class citizen, not an afterthought.**
5. **The core stays small and stable; breadth lives in contrib.**
6. **If an LLM can't reliably generate correct Goryu code, the API is too clever.**

## Next Steps

- [Getting Started](/guide/getting-started) — install Goryu and build your first service.
- [AI backends](/ai/) — streaming, metering, caching, proxying, and recording.
- [Security](/security/) — RBAC, audit logging, and secure-by-default defaults.
- [Streaming](/streaming/) — SSE, typed streaming JSON, and WebSockets.
