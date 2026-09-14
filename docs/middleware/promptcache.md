# PromptCache Middleware

A response cache keyed on the **request body** (the "prompt") rather than the URL, so it can cache `POST` responses — the common shape for LLM endpoints where the same prompt should return the same answer.

::: tip Looking for the guide?
This page is the middleware reference. For a walkthrough with per-user keying, model-varied caches, and streaming behavior, see the [Prompt Cache guide](/ai/prompt-cache).
:::

## Features

- **Body-keyed**: SHA-256 of method + path + (optional vary headers) + body.
- **POST-friendly**: caches the methods you choose (default `POST`).
- **Streaming-safe**: `text/event-stream` and `application/x-ndjson` responses are passed through, never cached.
- **Bounded**: size cap with expiry-based eviction, plus a per-body size limit.
- **Correct by default**: never caches non-2xx, `Set-Cookie`, `no-store`, `no-cache`, or `private` responses. Adds `X-Cache: HIT|MISS`.

## Usage

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

app.Use(promptcache.New(promptcache.Config{
    Expiration:  10 * time.Minute,
    VaryHeaders: []string{"X-Model"}, // fold the model selector into the key
}))
```

Custom key (e.g. normalize the prompt before hashing):

```go
app.Use(promptcache.New(promptcache.Config{
    KeyGenerator: func(c *goryu.Ctx, body []byte) string {
        return normalizePrompt(body)
    },
}))
```

`promptcache.Default()` installs the middleware with default settings.

## Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Expiration | `time.Duration` | Freshness window | `5m` |
| MaxSize | `int` | Max cached entries (cannot exceed 100,000) | `1000` |
| MaxBodyBytes | `int64` | Max request/response bytes cached | `1 MiB` |
| Methods | `[]string` | Cacheable methods | `["POST"]` |
| VaryHeaders | `[]string` | Request headers folded into the key | none |
| KeyGenerator | `func(c, body) string` | Custom key derivation | body hash |

## How It Works

For each request the middleware:

1. **Skips** requests whose method is not in `Methods`.
2. **Guards privacy** — with the default key, a request carrying an `Authorization` or `Cookie` header is passed through un-cached, so one authenticated caller can never be served another's response.
3. **Derives the key** — SHA-256 of method + path + any `VaryHeaders` + the request body (or your `KeyGenerator`). The body is read up to `MaxBodyBytes` and restored so the handler still reads it in full.
4. **Serves a HIT** if a fresh entry exists, replaying its status, headers, and body with `X-Cache: HIT`.
5. **On a MISS**, runs the handler through a capturing writer, sets `X-Cache: MISS`, and stores the response if it is cacheable.

A response is cacheable only when it is 2xx, within `MaxBodyBytes`, not a streaming content type, has no `Set-Cookie`, and carries no `no-store` / `no-cache` / `private` `Cache-Control`. When the cache is full it first evicts expired entries, then drops an arbitrary entry if still full.

## Security Note

With the **default key** (request body only), requests carrying an `Authorization` or `Cookie` header are **not cached**, so one authenticated caller can never be served another's response.

To cache per-user responses, supply a `KeyGenerator` (or `VaryHeaders`) that folds the user/tenant identity into the key — then you own that correctness and the privacy guard steps aside. Never place auth headers in `VaryHeaders`.
