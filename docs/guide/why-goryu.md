# Why Goryu

Goryu is the Go backend framework your AI gets right the first time. You describe
the API; your coding agent builds it on Goryu; it compiles, and it's
production-safe. Batteries-included, secure by default, and no-magic readable — so
you can trust what your agent ships, not just run it.

## What changed

You don't hand-write boilerplate anymore — you direct an agent. That quietly
rewrote what a framework is *for*. It's no longer enough to be pleasant to type.
The framework now has to be two things:

- **The thing your agent generates correctly** — on the first try, not the third.
- **The artifact you can read and trust** — because someone has to believe the
  agent's output is safe before it ships, and that someone might not be the one
  who wrote it.

Goryu is built for both. A small, regular API gives a coding agent few wrong turns
to take. It's Go, so the compiler catches the rest before you ever run it. And it's
secure by default, so the one thing agents reliably get wrong — the security
basics — is handled whether the agent thinks about it or not.

## The Problem

Point an agent at raw `net/http` and you get a different shape every time, with
different security gaps, and nobody can review fifty bespoke services by hand. The
Go ecosystem has excellent routers, but no Rails/Phoenix-style, batteries-included
framework that carries agent *or* human all the way to production. You still
assemble the router, validation, error handling, logging, health checks, metrics,
and graceful shutdown yourself — and an agent assembling them freehand is an agent
inventing fifty ways to get them subtly wrong.

Building an AI/LLM backend is worse. Today that means hand-rolling the same
infrastructure over and over:

- **SSE / streaming** token responses, wired correctly with flushing and backpressure.
- **Token and cost metering** per request, with per-key and per-token budgets.
- **Prompt-keyed response caching** — caching `POST` bodies, not URLs.
- **Provider proxying** for upstream LLM APIs, streamed through to the client.
- **Eval recording** to capture request/response pairs for offline evaluation.

None of this is novel, but every team — and every agent — rebuilds it, and gets the
edge cases wrong.

## What Goryu Gives You

Out of the box, with `goryu.New()`, you get health checks, metrics, structured
logging, and graceful shutdown — no setup. A handler is just a function, and typed
input with validation is one call (`goryu.Bind[T]`). There are few ways to express
each of these, which is exactly why an agent writes them correctly.

Because the surface is small and the behavior is explicit, agent output is
**uniform, safe, and auditable**: every Goryu service looks like every other Goryu
service, so reviewing what the agent shipped is reading, not archaeology.

When you need them — and only then — the AI primitives are there:

- **First-class streaming**: `c.SSE(...)` and `c.Stream(...)`, plus typed streaming JSON (`goryu.StreamJSON[T]`, `goryu.SSEJSON[T]`) and a WebSocket helper (`websocket.Upgrade`).
- **[Token & cost metering](/middleware/aimeter)**: `middleware/aimeter` — per-key/per-token rate limiting and USD cost accounting.
- **[Prompt cache](/middleware/promptcache)**: `middleware/promptcache` — body-keyed response caching for LLM endpoints, plus a streaming reverse-proxy helper (`aiproxy`).
- **[Eval recording](/middleware/recorder)**: `middleware/recorder` — capture request/response pairs as NDJSON for eval datasets.
- **Self-describing to the next agent**: `llms.txt` and a machine-readable API reference (`App.MountLLMs`), an MCP server (`goryu mcp`), and AI scaffolds (`goryu scaffold ai <name> --kind=chat|rag|agent`) — so the next agent that touches your app already knows its shape.

These are additive. A hand-written REST app never pays for AI features it does not use.

## Secure by default

Agents reliably get security wrong — they forget CSRF, leave headers off, skip
session invalidation. Goryu puts security on every response path so the agent can't
skip it: security headers, CSRF, JWT & sessions with a unified invalidation seam,
OAuth2/OIDC, passkeys/WebAuthn, RBAC, and an audit log. You don't have to trust the
agent to remember — the framework remembers for it.

## How Goryu Compares

Goryu is not "just another fast router" — Gin, Fiber, Echo, and Chi own that space.
Goryu's edge is being the framework an agent generates correctly and a human can
trust, while being genuinely great for **both** a plain REST service and an AI
backend — without making the simple case complicated.

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

The honest summary: for a plain REST API, Goryu is as fast as Gin with far more
built in. For an AI backend, the pieces you would otherwise hand-roll are already
batteries. And whichever you're building, it's the surface your agent writes
correctly and you can read without a map.

## Principles

1. **If an LLM can't reliably generate correct Goryu code, the API is too clever.** The regular, predictable API is a feature for people and agents alike.
2. **Built to be directed, not just typed** — the same clean API serves the human reviewing and the agent writing.
3. **No magic** — read the source and understand it, because trusting what ships now matters more than typing it.
4. **Secure by default, on every response path.**
5. **The simple case stays simple** — a hand-written REST API must never pay for AI features it doesn't use.
6. **Streaming is a first-class citizen, not an afterthought.**
7. **The core stays small and stable; breadth lives in contrib.**

## Next Steps

- [Getting Started](/guide/getting-started) — install Goryu and build your first service.
- [AI backends](/ai/) — streaming, metering, caching, proxying, and recording.
- [Security](/security/) — RBAC, audit logging, and secure-by-default defaults.
- [Streaming](/streaming/) — SSE, typed streaming JSON, and WebSockets.
