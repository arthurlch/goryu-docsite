# Provider Proxy

`aiproxy` is a small streaming reverse-proxy helper for LLM/AI providers. It
forwards the current request to an upstream provider and streams the response
back to the client, flushing as data arrives — so SSE and chunked token streams
pass straight through. It injects your provider credential and strips the
caller's own secrets on the way out.

```go
import "github.com/arthurlch/goryu/aiproxy"
```

## Features

- **Streaming passthrough**: `Stream` flushes upstream bytes as they arrive
  (SSE / chunked token streams), with no client timeout.
- **Buffered forward**: `Forward` for ordinary non-streaming provider calls.
- **Auth injection**: attaches `Authorization: Bearer <key>` (configurable
  header and scheme).
- **Secret stripping**: removes the caller's `Authorization`, `Cookie`, and
  `X-Api-Key` before forwarding.
- **Header hygiene**: drops hop-by-hop headers in both directions.
- **Context-aware**: honors the request context for cancellation.

## Usage

### Streaming passthrough

Create one `*Proxy` at startup and call `Stream` from a handler.

```go
import (
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/aiproxy"
)

px := aiproxy.New(aiproxy.Config{
    BaseURL: "https://api.openai.com",
    APIKey:  os.Getenv("OPENAI_API_KEY"),
})

app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
    if err := px.Stream(c, "/v1/chat/completions"); err != nil {
        // upstream/network error; the response may be partially written.
        log.Printf("proxy error: %v", err)
    }
})
```

`Stream` copies the upstream status and headers, then relays the body chunk by
chunk, flushing after each write so tokens reach the client immediately.

### Non-streaming forward

Use `Forward` when you want the whole response buffered (it uses the configured
`Timeout`).

```go
app.POST("/v1/embeddings", func(c *goryu.Ctx) {
    if err := px.Forward(c, "/v1/embeddings"); err != nil {
        log.Printf("proxy error: %v", err)
    }
})
```

### A different provider or custom auth header

```go
px := aiproxy.New(aiproxy.Config{
    BaseURL:    "https://api.anthropic.com",
    APIKey:     os.Getenv("ANTHROPIC_API_KEY"),
    AuthHeader: "x-api-key", // provider uses a custom header
    AuthScheme: "",          // no "Bearer " prefix
    Header: http.Header{     // extra headers on every upstream request
        "anthropic-version": {"2023-06-01"},
    },
})
```

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| BaseURL | `string` | Upstream origin (required), e.g. `https://api.openai.com` | none |
| APIKey | `string` | Credential injected on `AuthHeader` | none |
| AuthHeader | `string` | Header carrying the credential | `Authorization` |
| AuthScheme | `string` | Scheme prefix before the key | `Bearer` |
| Header | `http.Header` | Extra headers added to every upstream request | none |
| Client | `*http.Client` | Custom HTTP client (overrides both stream & forward) | see below |
| Timeout | `time.Duration` | Timeout for `Forward` only | `60s` |

## Security

::: tip The caller's secrets never reach the provider
Before forwarding, `aiproxy` strips the caller's own `Authorization`, `Cookie`,
and `X-Api-Key` headers, then attaches *your* provider credential via
`AuthHeader`. A client's session cookie or personal API key can never leak to the
third-party provider. All other client headers (minus hop-by-hop headers) are
passed through.
:::

::: warning Do not pass a user-controlled path
The `path` argument is joined onto `BaseURL` to form the upstream URL. If you
build it from user input, a caller could reach unintended upstream endpoints
(SSRF-style path traversal against the provider). Always pass a fixed,
server-chosen path such as `"/v1/chat/completions"`.
:::

## Notes

- `Stream` uses an HTTP client with **no timeout** — streams can be long-lived —
  and relies on the request context for cancellation. `Forward` uses `Timeout`.
- Supplying your own `Client` overrides both the stream and forward clients. If
  you reuse it for streaming, set its `Timeout` to `0`.
- On a streaming error the response may already be partially written; you cannot
  change the status code after the first byte, so log and move on.
