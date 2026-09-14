# Token & Cost Metering

`aimeter` accounts token usage and USD cost per request and enforces per-key
request and token budgets within a fixed window. Your handler reports the
provider's token usage; the middleware computes cost, checks budgets, and
surfaces the result through response headers and an `OnResult` callback.

```go
import "github.com/arthurlch/goryu/middleware/aimeter"
```

## Features

- **Token accounting**: prompt, completion, and total tokens per request.
- **Cost metering**: USD cost derived from per-1K-token pricing.
- **Per-key limits**: a request count *and* a token budget within a fixed window.
- **Per-key isolation**: each API key (or IP) gets its own window and counters.
- **Reliable hook**: `OnResult` for logging, metrics, or billing — fires even on
  streamed responses where headers cannot be set.

## Usage

### Basic setup

The default `KeyGenerator` identifies callers by `X-API-Key`, falling back to the
remote IP. Set pricing and budgets in the config.

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
)

app.Use(aimeter.New(aimeter.Config{
    PromptCostPer1K:     0.003,
    CompletionCostPer1K: 0.015,
    MaxRequests:         100,
    MaxTokens:           200_000,
    Window:              time.Minute,
    OnResult: func(c *goryu.Ctx, r aimeter.Result) {
        log.Printf("key=%s tokens=%d cost=$%.4f", r.Key, r.Usage.Total(), r.CostUSD)
    },
}))
```

`aimeter.Default()` installs the middleware with default settings (no pricing, no
budgets) — useful when you only want the `X-Tokens-*` headers.

### Report usage from the handler

Token counts are only known after the model responds, so the handler reports them
with `SetUsage`. The middleware reads that value after the handler returns.

```go
func chat(c *goryu.Ctx) {
    resp := callProvider(c)

    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     resp.Usage.PromptTokens,
        CompletionTokens: resp.Usage.CompletionTokens,
    })

    _ = c.JSON(200, resp)
}
```

`Usage.Total()` returns `PromptTokens + CompletionTokens`. Other middleware (the
recorder, for example) can read it back with `GetUsage`:

```go
u, ok := aimeter.GetUsage(c) // ok is false if the handler didn't set usage
```

### Metering by API key

Provide a `KeyGenerator` to control how callers are identified — each distinct
key gets its own window, budget, and cost accounting.

```go
app.Use(aimeter.New(aimeter.Config{
    KeyGenerator: func(c *goryu.Ctx) string {
        return c.GetHeader("X-API-Key") // or a tenant/user id from auth
    },
    MaxRequests: 60,
    Window:      time.Minute,
}))
```

### Custom rejection response

By default a blocked request gets a `429` with an `X-RateLimit-Reason` header.
Override `LimitReached` to shape your own response. The `reason` is either
`"request limit exceeded"` or `"token budget exceeded"`.

```go
app.Use(aimeter.New(aimeter.Config{
    MaxRequests: 60,
    MaxTokens:   100_000,
    Window:      time.Minute,
    LimitReached: func(c *goryu.Ctx, reason string) {
        _ = c.Status(429).JSON(goryu.Map{"error": reason})
    },
}))
```

### Billing hook

`OnResult` is the reliable accounting path. It fires once per metered request
with the key, usage, and computed cost — even for streamed responses where the
`X-*` headers cannot be written.

```go
app.Use(aimeter.New(aimeter.Config{
    PromptCostPer1K:     0.0005,
    CompletionCostPer1K: 0.0015,
    OnResult: func(c *goryu.Ctx, r aimeter.Result) {
        billing.Charge(r.Key, r.CostUSD)
        metrics.Add(r.Key, r.Usage.Total())
    },
}))
```

## Response headers

On non-streaming responses (when the handler has not already flushed), the
middleware sets:

| Header | Value |
|--------|-------|
| `X-Tokens-Prompt` | prompt tokens |
| `X-Tokens-Completion` | completion tokens |
| `X-Tokens-Total` | total tokens |
| `X-Cost-USD` | cost formatted to 6 decimals |

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| KeyGenerator | `func(*goryu.Ctx) string` | Caller identity | `X-API-Key` → remote IP |
| PromptCostPer1K | `float64` | USD per 1K prompt tokens | `0` |
| CompletionCostPer1K | `float64` | USD per 1K completion tokens | `0` |
| MaxRequests | `int` | Max requests per window (0 = off) | `0` |
| MaxTokens | `int` | Max tokens per window (0 = off) | `0` |
| Window | `time.Duration` | Fixed window length | `1m` |
| MaxClients | `int` | Max tracked keys (cannot exceed 100,000) | `10000` |
| OnResult | `func(c, Result)` | Post-request accounting hook | none |
| LimitReached | `func(c, reason)` | Custom rejection response | `429` |

The `Result` passed to `OnResult` is `{Key string, Usage Usage, CostUSD float64}`.

## Notes

::: warning Token budgets are enforced from prior consumption
Because token counts are only known *after* the provider responds, the token
budget is checked against the key's already-accumulated tokens for the window. A
request is rejected when the key has already exceeded `MaxTokens`; the request
that crosses the line is still served, and its tokens push the counter over so
the *next* request is blocked. Request-count limits, by contrast, are enforced
before the handler runs.
:::

::: tip Headers are best-effort; OnResult is reliable
`X-Tokens-*` / `X-Cost-USD` are only set when the response has not been flushed
yet — so they appear on JSON routes but not on SSE/streaming routes. For
streaming endpoints, account tokens and cost in `OnResult`.
:::

- The window is fixed: counters reset when the window elapses, not on a sliding
  basis.
- If `SetUsage` is never called, the request is not token-accounted (only its
  request count is counted against `MaxRequests`).
