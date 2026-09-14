# AIMeter Middleware

Token/cost metering and per-key rate limiting for AI/LLM backends. Handlers report the provider's token usage; the middleware accounts cost, enforces per-key request and token budgets within a fixed window (counters reset at the end of each window), and surfaces the result via response headers and an `OnResult` callback.

::: tip Looking for the guide?
This page is the middleware reference. For a walkthrough with billing hooks, streaming notes, and API-key metering, see the [Token & Cost Metering guide](/ja/ai/metering).
:::

## Features

- **Token accounting**: prompt, completion, and total tokens per request.
- **Cost metering**: USD cost derived from per-1K-token pricing.
- **Per-key limits**: a request count *and* a token budget within a fixed window.
- **Per-key isolation**: each API key (or IP) gets its own window and counters.
- **Reliable hook**: `OnResult` for logging, metrics, or billing — fires even on streamed responses where headers cannot be set.

## Usage

The default `KeyGenerator` identifies callers by `X-API-Key`, falling back to the remote IP. Set pricing and budgets in the config.

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

Inside a handler, after calling the provider, report usage. Token counts are only known after the model responds, so the middleware reads the value after the handler returns.

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

`Usage.Total()` returns `PromptTokens + CompletionTokens`. Other middleware (the recorder, for example) can read it back with `GetUsage`:

```go
u, ok := aimeter.GetUsage(c) // ok is false if the handler didn't set usage
```

`aimeter.Default()` installs the middleware with default settings (no pricing, no budgets) — useful when you only want the `X-Tokens-*` headers.

## Response Headers

On non-streaming responses (when the handler has not already flushed), the middleware sets:

| Header | Value |
|--------|-------|
| `X-Tokens-Prompt` | prompt tokens |
| `X-Tokens-Completion` | completion tokens |
| `X-Tokens-Total` | total tokens |
| `X-Cost-USD` | cost formatted to 6 decimals |

## Configuration Options

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

## How It Works

For each request the middleware:

1. **Identifies the caller** via `KeyGenerator` (default: `X-API-Key`, then remote IP).
2. **Checks budgets** against the key's fixed window before running the handler — a request-count check (`MaxRequests`) and a token-budget check (`MaxTokens`) using tokens already consumed this window.
3. **Runs the handler**, which reports usage with `SetUsage`.
4. **Records tokens** against the window and computes cost from the per-1K pricing.
5. **Emits results** — sets the `X-Tokens-*` / `X-Cost-USD` headers when the response has not been flushed, then calls `OnResult`.

Windows are fixed: counters reset when the window elapses, not on a sliding basis. Each key is tracked independently up to `MaxClients`.

## Notes

- **Token budgets are enforced from prior consumption.** Because token counts are only known *after* the provider responds, a request is rejected when the key's accumulated tokens for the window already exceed `MaxTokens`. Request-count limits, by contrast, are enforced before the handler runs.
- **Response headers are best-effort.** `X-Tokens-*` / `X-Cost-USD` are set only when the handler has not already flushed the response (i.e. non-streaming). For streaming endpoints, use `OnResult` as the reliable accounting path.
- If `SetUsage` is never called, the request is not token-accounted (only its request count is counted against `MaxRequests`).
